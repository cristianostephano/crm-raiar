"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FREQUENCIA_VISITA_ITEMS,
  type FrequenciaVisita,
} from "@/lib/funil/frequencia"

const REQUIRED_FREQUENCIA_MESSAGE =
  "Selecione a frequência de visita antes de confirmar."
const REQUIRED_CNPJ_MESSAGE = "Informe o CNPJ antes de confirmar."
const CNPJ_SUPPORT_TEXT = "Informe o CNPJ para concluir o ganho deste cliente."
const GENERIC_ERROR = "Não foi possível salvar as alterações. Tente novamente."

/**
 * Required-frequência confirmation modal for marking a cliente "ganho"
 * (VIS-01). "Confirmar ganho" is disabled — and shows the copywriting
 * contract's validation copy — until a frequência is actually selected; the
 * real enforcement is the `mover_card_funil` RPC guard (13-01, migration
 * 0013), this dialog is a UX courtesy over that.
 *
 * Unlike PerdaMotivoDialog (which this mirrors structurally), there is no
 * async load: the four options are a static, pure vocabulary
 * (FREQUENCIA_VISITA_ITEMS), so there's no useEffect, loading state, or
 * load-error state here.
 *
 * `exigirCnpj` (CNPJ-01/CNPJ-02, 18-02): when false, the CNPJ field never
 * blocks confirmation — a cliente that is ALREADY "ganho" can't be charged
 * retroactively, and the `mover_card_funil` guard (18-01) uses the exact
 * same transition-only condition.
 */
export function GanhoFrequenciaDialog({
  open,
  onOpenChange,
  razaoSocial,
  cnpjAtual,
  exigirCnpj,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  razaoSocial: string
  cnpjAtual: string
  exigirCnpj: boolean
  // Typed with FrequenciaVisita (not string) for strict typing, per CLAUDE.md.
  onConfirm: (
    frequencia: FrequenciaVisita,
    cnpj: string
  ) => Promise<{ error?: { message: string } } | undefined>
}) {
  const [selectedFrequencia, setSelectedFrequencia] = useState("")
  const [cnpj, setCnpj] = useState(cnpjAtual)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const cnpjTrimmed = cnpj.trim()

  /** Resets this dialog's own local state whenever it closes — via the
   * onOpenChange handler (not a synchronous setState-in-effect on `open`
   * flipping to false), matching the react-hooks/set-state-in-effect rule's
   * "adjust state in the event handler that changes it" guidance. */
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedFrequencia("")
      // Reset to cnpjAtual (not "") for the same reason as the other resets
      // above: the field should reopen showing whatever the cliente already
      // has, not a blank one.
      setCnpj(cnpjAtual)
      setValidationError(null)
      setSubmitError(null)
    }
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    // The button itself is `disabled` (see below) whenever no frequência is
    // selected (or, when exigirCnpj, no CNPJ is filled), so this only guards
    // a stray Enter-key submit — kept as a defense-in-depth check, not the
    // primary gate.
    if (!selectedFrequencia) {
      setValidationError(REQUIRED_FREQUENCIA_MESSAGE)
      return
    }
    if (exigirCnpj && !cnpjTrimmed) {
      setValidationError(REQUIRED_CNPJ_MESSAGE)
      return
    }

    setValidationError(null)
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const result = await onConfirm(
        selectedFrequencia as FrequenciaVisita,
        cnpjTrimmed
      )

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
          <DialogTitle>Marcar {razaoSocial} como ganho?</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ganho-frequencia-select">Frequência de visita</Label>
          <Select
            value={selectedFrequencia}
            onValueChange={(value) => {
              setSelectedFrequencia(value ?? "")
              setValidationError(null)
            }}
          >
            <SelectTrigger id="ganho-frequencia-select" className="w-full">
              <SelectValue placeholder="Selecione a frequência" />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIA_VISITA_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validationError === REQUIRED_FREQUENCIA_MESSAGE ? (
            <p role="alert" className="text-sm text-destructive">
              {validationError}
            </p>
          ) : !selectedFrequencia ? (
            <p className="text-sm text-muted-foreground">
              Escolha a frequência de visita para este cliente.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ganho-cnpj-input">CNPJ</Label>
          <Input
            id="ganho-cnpj-input"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => {
              setCnpj(e.target.value)
              setValidationError(null)
            }}
          />
          {validationError === REQUIRED_CNPJ_MESSAGE ? (
            <p role="alert" className="text-sm text-destructive">
              {validationError}
            </p>
          ) : exigirCnpj && !cnpjTrimmed ? (
            <p className="text-sm text-muted-foreground">
              {CNPJ_SUPPORT_TEXT}
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
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              !selectedFrequencia ||
              (exigirCnpj && !cnpjTrimmed)
            }
          >
            {isSubmitting ? "Salvando..." : "Confirmar ganho"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
