"use client"

import { useEffect, useState } from "react"

import { getMotivosEncerramento } from "@/app/actions/encerrados"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { LookupOption } from "@/lib/supabase/queries/clientes"

const REQUIRED_MOTIVO_MESSAGE =
  "Selecione o motivo do encerramento antes de salvar."
const LOAD_ERROR = "Não foi possível carregar os motivos de encerramento."
const GENERIC_ERROR = "Não foi possível salvar as alterações. Tente novamente."

/**
 * Required-motivo confirmation modal for marking an ativo cliente "encerrado"
 * (Fase 29, ENCR-02) — sibling of PerdaMotivoDialog.tsx (D-05, discretionary
 * decision: not a generalization), same fetch-on-open/disabled-until-
 * selected/error-keeps-dialog-open shape, domain words swapped. "Confirmar
 * encerramento" is disabled until a motivo is actually selected; the real
 * backstop is the `chk_encerrado_exige_motivo` DB CHECK constraint + the
 * `mover_card_funil` RPC guard (migration 0036) — this dialog is a UX
 * courtesy over that.
 */
export function EncerramentoMotivoDialog({
  open,
  onOpenChange,
  nomeCliente,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nomeCliente: string
  onConfirm: (
    motivoId: string
  ) => Promise<{ error?: { message: string } } | undefined>
}) {
  const [motivos, setMotivos] = useState<LookupOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedMotivoId, setSelectedMotivoId] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return undefined

    let cancelled = false
    // Standard "fetch on open" effect (mirrors PerdaMotivoDialog's own
    // effect) — the loading flag must be set synchronously before the async
    // call starts so the dialog shows "Carregando..." from the very next
    // render; there's no external system to synchronize with instead of
    // this fetch itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true)
    setLoadError(null)

    getMotivosEncerramento().then((result) => {
      if (cancelled) return
      setIsLoading(false)

      if (result.error) {
        setLoadError(LOAD_ERROR)
        return
      }

      setMotivos(result.data)
    })

    return () => {
      cancelled = true
    }
  }, [open])

  /** Resets this dialog's own local state whenever it closes — via the
   * onOpenChange handler (not a synchronous setState-in-effect on `open`
   * flipping to false), matching the react-hooks/set-state-in-effect rule's
   * "adjust state in the event handler that changes it" guidance. */
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedMotivoId("")
      setValidationError(null)
      setSubmitError(null)
    }
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    // The button itself is `disabled` (see below) whenever no motivo is
    // selected, so this only guards a stray Enter-key submit — kept as a
    // defense-in-depth check, not the primary gate.
    if (!selectedMotivoId) {
      setValidationError(REQUIRED_MOTIVO_MESSAGE)
      return
    }

    setValidationError(null)
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const result = await onConfirm(selectedMotivoId)

      if (result?.error) {
        setSubmitError(result.error.message)
        setIsSubmitting(false)
        return
      }

      setIsSubmitting(false)
      handleOpenChange(false)
    } catch {
      setSubmitError(GENERIC_ERROR)
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar {nomeCliente} como encerrado?</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="encerramento-motivo-select">
            Motivo do encerramento
          </Label>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : loadError ? (
            <p role="alert" className="text-sm text-destructive">
              {loadError}
            </p>
          ) : (
            <Select
              value={selectedMotivoId}
              onValueChange={(value) => {
                setSelectedMotivoId(value ?? "")
                setValidationError(null)
              }}
            >
              <SelectTrigger id="encerramento-motivo-select" className="w-full">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivos.map((motivo) => (
                  <SelectItem key={motivo.id} value={motivo.id}>
                    {motivo.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {validationError ? (
            <p role="alert" className="text-sm text-destructive">
              {validationError}
            </p>
          ) : !isLoading && !loadError && !selectedMotivoId ? (
            <p className="text-sm text-muted-foreground">
              {REQUIRED_MOTIVO_MESSAGE}
            </p>
          ) : null}
        </div>

        {submitError ? (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isSubmitting || isLoading || !selectedMotivoId}
          >
            {isSubmitting ? "Salvando..." : "Confirmar encerramento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
