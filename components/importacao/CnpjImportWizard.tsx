"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import {
  confirmarLoteCnpj,
  validarLoteCnpj,
  type ConfirmarLoteCnpjResult,
  type ValidatedRowCnpj,
} from "@/app/actions/importacaoCnpj"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ColumnMappingTable } from "@/components/importacao/ColumnMappingTable"
import { FileDropzone } from "@/components/importacao/FileDropzone"
import { CnpjPreviewTable } from "@/components/importacao/CnpjPreviewTable"
import { CnpjImportSummary } from "@/components/importacao/CnpjImportSummary"
import type { MappedRowCnpj } from "@/lib/importacao/annotarLinhaCnpj"
import {
  applyMapping,
  requiredFieldsFaltando,
  suggestMapping,
  type ColumnMappingOf,
  type MappingTargetOf,
} from "@/lib/importacao/mapping"
import { buildModeloCnpj } from "@/lib/importacao/modeloCnpj"
import { parseArquivo } from "@/lib/importacao/parseArquivo"
import { SYSTEM_FIELDS_CNPJ, type SystemFieldCnpj } from "@/lib/importacao/typesCnpj"
import type { ParsedFile } from "@/lib/importacao/types"
import { cn } from "@/lib/utils"

const MODELO_FILE_NAME = "modelo-cnpj-em-massa.xlsx"
const READING_FILE_LABEL = "Lendo arquivo…"
const VALIDATING_LABEL = "Validando linhas…"
const EMPTY_STATE_HEADING = "Nenhuma linha encontrada nesta planilha"
const EMPTY_STATE_BODY =
  "Verifique se o arquivo tem dados abaixo da linha de cabeçalho e tente enviar novamente."
const PARSE_ERROR =
  "Não foi possível ler esta planilha. Verifique se o arquivo não está corrompido e tente enviar novamente."
const VALIDATION_ERROR =
  "Não foi possível validar a planilha agora. Tente novamente."
const CONFIRM_ERROR =
  "Não foi possível concluir a gravação agora. Nenhum CNPJ foi alterado. Tente novamente."
const fileAcceptedMessage = (nome: string, linhas: number) =>
  `${nome} selecionado — ${linhas} linha${linhas === 1 ? "" : "s"} encontrada${linhas === 1 ? "" : "s"}`

type WizardStep = 1 | 2 | 3

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Enviar planilha",
  2: "Mapear colunas",
  3: "Revisar",
}

/**
 * Assistente de três passos da planilha "CNPJ em massa" (Fase 19, IMP-03).
 * Cópia estrutural de FrequenciaImportWizard.tsx — mesma casca de passos,
 * mesma disciplina de estado (um estado por preocupação, constantes de copy
 * no topo, sinalizador de carga marcado de forma síncrona antes de cada
 * chamada assíncrona) — mas servindo o TERCEIRO vocabulário de campos
 * (SYSTEM_FIELDS_CNPJ) e chamando as ações de servidor deste fluxo. Este
 * fluxo não tem estado de decisão por linha (o vocabulário de status é só
 * "ok"/"erro", nunca o terceiro valor) — por isso o estado por-linha do
 * passo de revisão do assistente de clientes simplesmente não existe aqui.
 * Nenhum dos dois assistentes já existentes é aberto para edição por este
 * arquivo.
 */
export function CnpjImportWizard() {
  const router = useRouter()

  const [step, setStep] = useState<WizardStep>(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [progressLabel, setProgressLabel] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Passo 2 (mapeamento) — vive aqui, não em ColumnMappingTable, para
  // sobreviver à navegação entre passos do assistente.
  const [mapping, setMapping] = useState<ColumnMappingOf<SystemFieldCnpj>>({})
  const [mappedRows, setMappedRows] = useState<MappedRowCnpj[] | null>(null)

  // Passo 3 (revisão) — resultado de validarLoteCnpj + seu próprio estado
  // de carga/erro.
  const [validating, setValidating] = useState(false)
  const [validatedRows, setValidatedRows] = useState<ValidatedRowCnpj[] | null>(
    null
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  // Passo de confirmação — estado de carga em voo/erro/resultado de
  // confirmarLoteCnpj. Não existe estado de decisão por linha neste fluxo
  // (este vocabulário nunca tem o terceiro valor de status).
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirmResult, setConfirmResult] = useState<
    NonNullable<ConfirmarLoteCnpjResult["data"]> | null
  >(null)

  // Dispara a validação somente-leitura assim que o passo 3 é alcançado com
  // um lote `mappedRows` novo (handleContinueFromMapping zera
  // `validatedRows` a cada clique em "Continuar", então este efeito
  // re-dispara sempre que o mapeamento muda) — mesmo padrão de sinalizador
  // síncrono de carga já usado nos outros dois assistentes.
  useEffect(() => {
    if (step !== 3 || !mappedRows || validatedRows !== null) return

    // Marcado de forma síncrona para "Validando linhas…" aparecer a partir
    // do próximo render, antes da chamada assíncrona começar (padrão
    // EditableListTab.tsx/ImportWizard.tsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValidating(true)
    setValidationError(null)

    validarLoteCnpj(mappedRows).then((result) => {
      setValidating(false)
      if (result.error) {
        setValidationError(VALIDATION_ERROR)
        return
      }
      setValidatedRows(result.data.linhas)
    })
  }, [step, mappedRows, validatedRows])

  function handleBaixarModelo() {
    const workbook = buildModeloCnpj()
    const blob = new Blob([new Uint8Array(workbook)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = MODELO_FILE_NAME
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function handleFileAccepted(acceptedFile: File) {
    setErrorMessage(null)
    setFile(acceptedFile)
    setParsed(null)
    // Marcado de forma síncrona para "Lendo arquivo…" aparecer a partir do
    // próximo render, antes do parseArquivo assíncrono começar.
    setProgressLabel(READING_FILE_LABEL)

    parseArquivo(acceptedFile)
      .then((result) => {
        setProgressLabel(null)
        setParsed(result)
        // Sugestão automática de mapeamento por coluna calculada contra o
        // TERCEIRO vocabulário de campos (SYSTEM_FIELDS_CNPJ), não a lista
        // de 16 nem a de frequência.
        const initialMapping: ColumnMappingOf<SystemFieldCnpj> = {}
        result.headers.forEach((header, columnIndex) => {
          initialMapping[columnIndex] = suggestMapping(header, SYSTEM_FIELDS_CNPJ)
        })
        setMapping(initialMapping)
        setMappedRows(null)
      })
      .catch(() => {
        setProgressLabel(null)
        setFile(null)
        setErrorMessage(PARSE_ERROR)
      })
  }

  function handleFileRejected(motivo: string) {
    setErrorMessage(motivo)
    setFile(null)
    setParsed(null)
    setMapping({})
    setMappedRows(null)
    setProgressLabel(null)
  }

  function handleRemoveFile() {
    setFile(null)
    setParsed(null)
    setMapping({})
    setMappedRows(null)
    setErrorMessage(null)
    setProgressLabel(null)
  }

  function handleMappingChange(
    columnIndex: number,
    target: MappingTargetOf<SystemFieldCnpj>
  ) {
    setMapping((current) => ({ ...current, [columnIndex]: target }))
  }

  function handleContinueFromMapping() {
    if (!parsed) return
    setMappedRows(
      applyMapping<SystemFieldCnpj>(parsed.headers, parsed.rows, mapping)
    )
    // Zera o resultado de validação anterior — sem isso, um "Voltar" seguido
    // de remapeamento manteria na tela uma revisão que não corresponde ao
    // que seria gravado (T-19-34).
    setValidatedRows(null)
    setValidationError(null)
    setStep(3)
  }

  function handleConfirmar() {
    if (!validatedRows) return

    // Marcado de forma síncrona ANTES da chamada — dois cliques rápidos não
    // podem gravar o lote duas vezes (T-19-32).
    setConfirming(true)
    setConfirmError(null)

    confirmarLoteCnpj(validatedRows).then((result) => {
      setConfirming(false)
      if (result.error) {
        setConfirmError(CONFIRM_ERROR)
        return
      }
      setConfirmResult(result.data)
    })
  }

  function handleEnviarOutra() {
    handleRemoveFile()
    setValidatedRows(null)
    setConfirmResult(null)
    setConfirmError(null)
    setStep(1)
  }

  const hasRows = parsed !== null && parsed.rows.length > 0
  const isEmptyResult = parsed !== null && parsed.rows.length === 0

  return (
    <div className="flex flex-col gap-6 rounded-lg border p-6">
      {confirmResult === null ? (
        <ol className="flex items-center gap-4 text-sm">
          {([1, 2, 3] as const).map((stepNumber) => (
            <li
              key={stepNumber}
              className={cn(
                "flex items-center gap-1.5",
                stepNumber === step
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              )}
            >
              <span>{stepNumber}</span>
              <span>{STEP_LABELS[stepNumber]}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {confirmResult !== null ? (
        <CnpjImportSummary
          atualizadosCount={confirmResult.atualizados.length}
          puladas={confirmResult.puladas}
          onVerClientes={() => router.push("/clientes")}
          onEnviarOutra={handleEnviarOutra}
        />
      ) : step === 1 ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Enviar planilha</h2>

          <Button
            type="button"
            variant="link"
            className="w-fit px-0"
            onClick={handleBaixarModelo}
          >
            Baixar modelo de planilha
          </Button>

          <FileDropzone
            onFileAccepted={handleFileAccepted}
            onFileRejected={handleFileRejected}
            selectedFileName={file?.name ?? null}
            onRemoveFile={handleRemoveFile}
          />

          {progressLabel ? (
            <div
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Skeleton className="size-4 rounded-full" />
              {progressLabel}
            </div>
          ) : null}

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          ) : null}

          {isEmptyResult ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
              <p className="text-base font-semibold">{EMPTY_STATE_HEADING}</p>
              <p className="max-w-md text-sm text-muted-foreground">
                {EMPTY_STATE_BODY}
              </p>
            </div>
          ) : null}

          {hasRows && file ? (
            <p role="status" className="text-sm text-foreground">
              {fileAcceptedMessage(file.name, parsed!.rows.length)}
            </p>
          ) : null}

          <Button
            type="button"
            disabled={!hasRows}
            className="w-fit"
            onClick={() => setStep(2)}
          >
            Continuar
          </Button>
        </div>
      ) : step === 2 && parsed ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Mapear colunas</h2>
          <p className="text-sm text-muted-foreground">
            Associe as colunas da planilha aos dois campos que o sistema
            espera: a razão social (para encontrar o cliente) e o CNPJ a
            gravar.
          </p>

          <ColumnMappingTable<SystemFieldCnpj>
            columns={parsed.headers}
            previews={parsed.headers.map((_header, columnIndex) =>
              parsed.rows.slice(0, 3).map((row) => row[columnIndex] ?? "")
            )}
            mapping={mapping}
            onMappingChange={handleMappingChange}
            fields={SYSTEM_FIELDS_CNPJ}
          />

          {requiredFieldsFaltando(mapping, SYSTEM_FIELDS_CNPJ).map((field) => (
            <div
              key={field.key}
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              O campo &quot;{field.label}&quot; é obrigatório e ainda não foi
              associado a nenhuma coluna.
            </div>
          ))}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button
              type="button"
              disabled={
                requiredFieldsFaltando(mapping, SYSTEM_FIELDS_CNPJ).length > 0
              }
              onClick={handleContinueFromMapping}
            >
              Continuar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Revisar antes de gravar</h2>

          {validating ? (
            <div
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Skeleton className="size-4 rounded-full" />
              {VALIDATING_LABEL}
            </div>
          ) : null}

          {validationError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {validationError}
            </div>
          ) : null}

          {validatedRows ? <CnpjPreviewTable linhas={validatedRows} /> : null}

          {confirmError ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {confirmError}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Voltar
            </Button>
            <Button
              type="button"
              disabled={!validatedRows || confirming}
              onClick={handleConfirmar}
            >
              {confirming ? "Gravando CNPJ…" : "Confirmar gravação"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
