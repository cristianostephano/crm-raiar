"use client"

import { useEffect, useState } from "react"

import { getMotivosPerda } from "@/app/actions/funil"
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

const REQUIRED_MOTIVO_MESSAGE = "Selecione o motivo da perda antes de salvar."
const LOAD_ERROR = "Não foi possível carregar os motivos de perda."
const GENERIC_ERROR = "Não foi possível salvar as alterações. Tente novamente."

/**
 * Required-motivo confirmation modal for marking a cliente "perdido"
 * (FUN-06). "Confirmar perda" is disabled — and shows the copywriting
 * contract's validation copy — until a motivo is actually selected; the
 * real enforcement is the `chk_perdido_exige_motivo` DB CHECK constraint
 * (02-01)/mover_card_funil RPC, this dialog is a UX courtesy over that.
 */
export function PerdaMotivoDialog({
  open,
  onOpenChange,
  razaoSocial,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  razaoSocial: string
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
    // Standard "fetch on open" effect (mirrors ClienteDetailSheet's own
    // getClienteDetalhe effect) — the loading flag must be set
    // synchronously before the async call starts so the dialog shows
    // "Carregando..." from the very next render; there's no external
    // system to synchronize with instead of this fetch itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true)
    setLoadError(null)

    getMotivosPerda().then((result) => {
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
          <DialogTitle>Marcar {razaoSocial} como perdido?</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="perda-motivo-select">Motivo da perda</Label>
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
              <SelectTrigger id="perda-motivo-select" className="w-full">
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
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? "Salvando..." : "Confirmar perda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
