"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { FileDropzone } from "@/components/importacao/FileDropzone"
import { buildModeloImportacao } from "@/lib/importacao/modelo"
import { parseArquivo } from "@/lib/importacao/parseArquivo"
import type { ParsedFile } from "@/lib/importacao/types"
import { cn } from "@/lib/utils"

const MODELO_FILE_NAME = "modelo-importacao-clientes.xlsx"
const READING_FILE_LABEL = "Lendo arquivo…"
const EMPTY_STATE_HEADING = "Nenhuma linha encontrada nesta planilha"
const EMPTY_STATE_BODY =
  "Verifique se o arquivo tem dados abaixo da linha de cabeçalho e tente enviar novamente."
const PARSE_ERROR =
  "Não foi possível ler esta planilha. Verifique se o arquivo não está corrompido e tente enviar novamente."
const fileAcceptedMessage = (nome: string, linhas: number) =>
  `${nome} selecionado — ${linhas} linha${linhas === 1 ? "" : "s"} encontrada${linhas === 1 ? "" : "s"}`

type WizardStep = 1 | 2 | 3

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Enviar planilha",
  2: "Mapear colunas",
  3: "Revisar",
}

/**
 * Shell of the 3-step import wizard (IMP-02, IMP-10's screen). This plan
 * (06-03) fully implements Step 1 (baixar modelo + enviar arquivo + "N
 * linhas encontradas"/empty state); Steps 2 (mapeamento) and 3 (revisão)
 * are structural placeholders for 06-04 to fill in — no dead UI implying
 * functionality that doesn't exist yet, per the plan's explicit
 * instruction.
 *
 * State pattern mirrors EditableListTab.tsx (06-PATTERNS.md): one useState
 * per concern, top-of-file copy constants, synchronous loading-flag set
 * before the async parseArquivo call starts.
 */
export function ImportWizard() {
  const [step, setStep] = useState<WizardStep>(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [progressLabel, setProgressLabel] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function handleBaixarModelo() {
    const workbook = buildModeloImportacao()
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
    // Set synchronously so the "Lendo arquivo…" label shows from the very
    // next render, before parseArquivo's async work starts (EditableListTab
    // loading-flag pattern).
    setProgressLabel(READING_FILE_LABEL)

    parseArquivo(acceptedFile)
      .then((result) => {
        setProgressLabel(null)
        setParsed(result)
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
    setProgressLabel(null)
  }

  function handleRemoveFile() {
    setFile(null)
    setParsed(null)
    setErrorMessage(null)
    setProgressLabel(null)
  }

  const hasRows = parsed !== null && parsed.rows.length > 0
  const isEmptyResult = parsed !== null && parsed.rows.length === 0

  return (
    <div className="flex flex-col gap-6 rounded-lg border p-6">
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

      {step === 1 ? (
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
      ) : step === 2 ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Mapear colunas</h2>
          <p className="text-sm text-muted-foreground">
            Associe cada coluna da planilha a um campo do sistema. Colunas
            que não devem ser importadas podem ficar marcadas como &quot;Não
            importar&quot;.
          </p>
          {/* Estrutura preenchida em 06-04: ColumnMappingTable por coluna detectada em `parsed.headers`. */}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Voltar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Revisar antes de importar</h2>
          {/* Estrutura preenchida em 06-04: tabela de revisão OK/erro/duplicado por linha. */}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Voltar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
