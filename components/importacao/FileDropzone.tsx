"use client"

import { Upload, X } from "lucide-react"
import { useRef, useState, type DragEvent } from "react"

import { Button } from "@/components/ui/button"
import { validateUploadFile } from "@/lib/importacao/parseArquivo"
import { cn } from "@/lib/utils"

const WRONG_TYPE_ERROR =
  "Não foi possível ler este arquivo. Envie um arquivo .xlsx ou .csv."
const TOO_LARGE_ERROR =
  "Este arquivo é maior que 10 MB. Reduza o arquivo ou divida em partes menores."

/**
 * Native drag-and-drop + file-input dropzone for the import wizard's
 * upload step (IMP-02). No analog exists in this codebase (06-PATTERNS.md
 * "No Analog Found") — plain HTML5 drag events + `<input type="file">`,
 * styled with 06-UI-SPEC.md's tokens. Purely controlled: all file/parse
 * state lives in the parent (ImportWizard); this component only validates
 * (via validateUploadFile, 06-01) and reports the outcome via callbacks.
 */
export function FileDropzone({
  onFileAccepted,
  onFileRejected,
  selectedFileName,
  onRemoveFile,
}: {
  onFileAccepted: (file: File) => void
  onFileRejected: (motivo: string) => void
  /** Currently accepted file's name, if any — renders the "Remover arquivo" control. */
  selectedFileName?: string | null
  onRemoveFile?: () => void
}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const validation = validateUploadFile(file)
    if (!validation.ok) {
      onFileRejected(
        validation.motivo === "tipo" ? WRONG_TYPE_ERROR : TOO_LARGE_ERROR
      )
      return
    }
    onFileAccepted(file)
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      handleFile(file)
    }
    // Allow re-selecting the same file name after a rejection/removal.
    event.target.value = ""
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingOver(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingOver(false)
  }

  if (selectedFileName) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border p-4">
        <span className="truncate text-sm">{selectedFileName}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remover arquivo"
          className="size-11"
          onClick={onRemoveFile}
        >
          <X className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center transition-colors",
        isDraggingOver ? "border-primary bg-primary/5" : "hover:bg-muted/50"
      )}
    >
      <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-base font-semibold">
        Arraste o arquivo aqui ou clique para selecionar
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        Aceita arquivos .xlsx ou .csv, até 10 MB
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        onChange={handleInputChange}
        className="sr-only"
        aria-label="Selecionar arquivo"
      />
    </div>
  )
}
