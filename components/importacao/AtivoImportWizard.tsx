"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import {
  confirmarLoteAtivos,
  validarLoteAtivos,
  type ConfirmarLoteAtivosResult,
  type ValidatedRowAtivo,
} from "@/app/actions/importacaoAtivos"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ColumnMappingTable } from "@/components/importacao/ColumnMappingTable"
import { FileDropzone } from "@/components/importacao/FileDropzone"
import { AtivoPreviewTable } from "@/components/importacao/AtivoPreviewTable"
import { AtivoImportSummary } from "@/components/importacao/AtivoImportSummary"
import type { MappedRow } from "@/lib/importacao/annotarLinha"
import {
  applyMapping,
  requiredFieldsFaltando,
  suggestMapping,
  type ColumnMapping,
  type MappingTarget,
} from "@/lib/importacao/mapping"
import { buildModeloAtivos } from "@/lib/importacao/modeloAtivo"
import { parseArquivo } from "@/lib/importacao/parseArquivo"
import { SYSTEM_FIELDS_ATIVO } from "@/lib/importacao/typesAtivo"
import type { ParsedFile } from "@/lib/importacao/types"
import { cn } from "@/lib/utils"

const MODELO_FILE_NAME = "modelo-clientes-ativos.xlsx"
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
  "Não foi possível concluir a importação agora. Nenhum cliente ativo foi criado. Tente novamente."
const fileAcceptedMessage = (nome: string, linhas: number) =>
  `${nome} selecionado — ${linhas} linha${linhas === 1 ? "" : "s"} encontrada${linhas === 1 ? "" : "s"}`

type WizardStep = 1 | 2 | 3

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Enviar planilha",
  2: "Mapear colunas",
  3: "Revisar",
}

/**
 * Assistente de 3 passos "Importar clientes ativos" (Fase 25 Plano 3,
 * ATIVO-01..04) — cópia estrutural de `ImportWizard.tsx` (o molde funcional
 * certo, porque este fluxo CRIA clientes e tem decisão por linha em
 * duplicado, ao contrário do fluxo de CNPJ, que só atualiza).
 *
 * Preserva sem mudança de forma: o estado por preocupação (arquivo, conteúdo
 * lido, mapeamento, linhas mapeadas, linhas validadas, decisões por linha,
 * confirmação), a marcação síncrona da bandeira de carregamento antes de cada
 * chamada assíncrona (EditableListTab.tsx pattern), o efeito que dispara a
 * validação ao chegar no passo 3 com um lote novo, e o fato de as decisões
 * por linha viverem AQUI e não na tabela de revisão — a ação de confirmar
 * precisa recebê-las.
 *
 * `SYSTEM_FIELDS_ATIVO` é passado para `suggestMapping`/`applyMapping`/
 * `requiredFieldsFaltando`/`ColumnMappingTable` — sem isso o passo 2
 * ofereceria e exigiria a lista antiga de 2 campos obrigatórios. Diferente de
 * `CnpjImportWizard.tsx`, `SYSTEM_FIELDS_ATIVO` reusa o MESMO tipo `SystemField`
 * de `lib/importacao/types.ts` (não introduz um vocabulário de chaves novo),
 * então nenhuma das chamadas genéricas precisa de anotação explícita de tipo.
 */
export function AtivoImportWizard() {
  const router = useRouter()

  const [step, setStep] = useState<WizardStep>(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [progressLabel, setProgressLabel] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Passo 2 (mapeamento) — vive aqui, não em ColumnMappingTable, para
  // sobreviver à navegação entre passos do assistente.
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [mappedRows, setMappedRows] = useState<MappedRow[] | null>(null)

  // Passo 3 (revisão) — resultado de validarLoteAtivos + seu próprio estado
  // de carga/erro.
  const [validating, setValidating] = useState(false)
  const [validatedRows, setValidatedRows] = useState<ValidatedRowAtivo[] | null>(
    null
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  // Decisão por linha da tabela de revisão (linha duplicado apenas, padrão
  // "pular") — vive aqui (não em AtivoPreviewTable) porque
  // confirmarLoteAtivos(validatedRows, decisions) precisa lê-la no nível do
  // assistente.
  const [decisions, setDecisions] = useState<
    Record<number, "importar" | "pular">
  >({})

  // Passo de confirmação (ATIVO-02) — estado de carga em voo/erro/resultado
  // de confirmarLoteAtivos.
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirmResult, setConfirmResult] = useState<
    NonNullable<ConfirmarLoteAtivosResult["data"]> | null
  >(null)

  // Dispara a validação somente-leitura assim que o passo 3 é alcançado com
  // um lote `mappedRows` novo (handleContinueFromMapping zera `validatedRows`
  // a cada clique em "Continuar", então este efeito re-dispara sempre que o
  // mapeamento muda) — mesmo padrão de sinalizador síncrono de carga já usado
  // no passo 1 (parseArquivo).
  useEffect(() => {
    if (step !== 3 || !mappedRows || validatedRows !== null) return

    // Marcado de forma síncrona para "Validando linhas…" aparecer a partir do
    // próximo render, antes da chamada assíncrona começar (padrão
    // EditableListTab.tsx/ImportWizard.tsx).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValidating(true)
    setValidationError(null)

    validarLoteAtivos(mappedRows).then((result) => {
      setValidating(false)
      if (result.error) {
        setValidationError(VALIDATION_ERROR)
        return
      }
      setValidatedRows(result.data.linhas)
    })
  }, [step, mappedRows, validatedRows])

  function handleBaixarModelo() {
    const workbook = buildModeloAtivos()
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
        // Sugestão automática de mapeamento por coluna, calculada contra o
        // vocabulário de campos de clientes ATIVOS (SYSTEM_FIELDS_ATIVO), não
        // a lista de importação de clientes novos.
        const initialMapping: ColumnMapping = {}
        result.headers.forEach((header, columnIndex) => {
          initialMapping[columnIndex] = suggestMapping(header, SYSTEM_FIELDS_ATIVO)
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
    setDecisions({})
  }

  function handleMappingChange(columnIndex: number, target: MappingTarget) {
    setMapping((current) => ({ ...current, [columnIndex]: target }))
  }

  function handleDecisionChange(row: number, decision: "importar" | "pular") {
    setDecisions((current) => ({ ...current, [row]: decision }))
  }

  function handleConfirmar() {
    if (!validatedRows) return

    // Marcado de forma síncrona antes da chamada — o rótulo "Importando
    // clientes ativos…" aparece a partir do próximo render, antes de
    // confirmarLoteAtivos começar (mesmo padrão de parseArquivo/
    // validarLoteAtivos).
    setConfirming(true)
    setConfirmError(null)

    confirmarLoteAtivos(validatedRows, decisions).then((result) => {
      setConfirming(false)
      if (result.error) {
        setConfirmError(CONFIRM_ERROR)
        return
      }
      setConfirmResult(result.data)
    })
  }

  function handleImportarOutra() {
    handleRemoveFile()
    setValidatedRows(null)
    setConfirmResult(null)
    setConfirmError(null)
    setStep(1)
  }

  function handleContinueFromMapping() {
    if (!parsed) return
    setMappedRows(applyMapping(parsed.headers, parsed.rows, mapping))
    setValidatedRows(null)
    setValidationError(null)
    setDecisions({})
    setStep(3)
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
        <AtivoImportSummary
          importadosCount={confirmResult.importados.length}
          puladas={confirmResult.puladas}
          onVerClientes={() => router.push("/clientes")}
          onImportarOutra={handleImportarOutra}
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
            Associe cada coluna da planilha a um campo do sistema. Colunas
            que não devem ser importadas podem ficar marcadas como &quot;Não
            importar&quot;.
          </p>

          <ColumnMappingTable
            columns={parsed.headers}
            previews={parsed.headers.map((_header, columnIndex) =>
              parsed.rows
                .slice(0, 3)
                .map((row) => row[columnIndex] ?? "")
            )}
            mapping={mapping}
            onMappingChange={handleMappingChange}
            fields={SYSTEM_FIELDS_ATIVO}
          />

          {requiredFieldsFaltando(mapping, SYSTEM_FIELDS_ATIVO).map((field) => (
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
                requiredFieldsFaltando(mapping, SYSTEM_FIELDS_ATIVO).length > 0
              }
              onClick={handleContinueFromMapping}
            >
              Continuar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">
            Revisar clientes ativos antes de importar
          </h2>

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

          {validatedRows ? (
            <AtivoPreviewTable
              linhas={validatedRows}
              decisions={decisions}
              onDecisionChange={handleDecisionChange}
            />
          ) : null}

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
              {confirming ? "Importando clientes ativos…" : "Confirmar importação"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
