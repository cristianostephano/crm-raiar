"use client"

import { useState } from "react"

import { desativarMembroEquipe } from "@/app/actions/equipe"
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
import { substitutosDisponiveis, type EquipeMember } from "@/lib/equipe/membros"

const VALIDATION_ERROR = "Selecione um vendedor substituto antes de confirmar."
const GENERIC_ERROR = "Não foi possível desativar. Tente novamente."
const SELF_DEACTIVATION_ERROR = "Não é possível desativar a própria conta."
const LAST_SUPERVISOR_ERROR =
  "Não é possível desativar o último Supervisor ativo — a equipe sempre precisa de pelo menos um Supervisor."
const INVALID_SUBSTITUTE_ERROR =
  "O vendedor substituto escolhido não é válido. Atualize a página e tente novamente."

/**
 * Deactivation confirmation dialog (D-02, D-03). The dialog is open exactly
 * when `member` is non-null. Always renders the replacement-vendedor
 * `Select` unconditionally — D-03 forbids a branch that hides or skips it
 * when the target has nothing in progress to transfer.
 */
export function DesativarMembroDialog({
  member,
  members,
  onOpenChange,
  onSuccess,
  onBanFailure,
}: {
  member: EquipeMember | null
  members: EquipeMember[]
  onOpenChange: (open: boolean) => void
  onSuccess: (payload: {
    member: EquipeMember
    clientesReatribuidos: number
    substitutoNome: string
  }) => void
  onBanFailure: (member: EquipeMember) => void
}) {
  const [novoResponsavelId, setNovoResponsavelId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const substitutos = member ? substitutosDisponiveis(members, member.id) : []

  function reset() {
    setNovoResponsavelId("")
    setIsSubmitting(false)
    setFormError(null)
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      reset()
    }
    onOpenChange(open)
  }

  async function handleConfirm() {
    if (!member) return

    // Cheapest feedback first, per UI-SPEC §2's validation order — never
    // call the Server Action when nothing is picked.
    if (!novoResponsavelId) {
      setFormError(VALIDATION_ERROR)
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    try {
      const result = await desativarMembroEquipe(member.id, novoResponsavelId)

      if (result.error) {
        if (result.error.code === "ban_failed") {
          // The deactivation itself already committed — the row must flip
          // to Inativo and the warning belongs on the page, not inside a
          // dialog that is about to disappear.
          onBanFailure(member)
          reset()
          onOpenChange(false)
          return
        }

        const message =
          result.error.code === "self_deactivation"
            ? SELF_DEACTIVATION_ERROR
            : result.error.code === "last_supervisor"
              ? LAST_SUPERVISOR_ERROR
              : result.error.code === "invalid_substitute"
                ? INVALID_SUBSTITUTE_ERROR
                : GENERIC_ERROR
        setFormError(message)
        setIsSubmitting(false)
        return
      }

      const substituto = substitutos.find((v) => v.id === novoResponsavelId)
      const substitutoNome = substituto
        ? `${substituto.nome} ${substituto.sobrenome}`
        : ""

      onSuccess({
        member,
        clientesReatribuidos: result.data.clientesReatribuidos,
        substitutoNome,
      })
      reset()
      onOpenChange(false)
    } catch {
      setFormError(GENERIC_ERROR)
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={member !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Desativar {member?.nome} {member?.sobrenome}?
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Os clientes em andamento de {member?.nome} passam a ser atendidos pelo vendedor que você escolher abaixo. Os clientes já ganhos ou perdidos continuam no histórico de {member?.nome}, sem mudar. {member?.nome} não vai mais conseguir entrar no sistema, mas o nome e o histórico dele(a) continuam visíveis. Você pode reativar o acesso quando quiser.
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor="substituto-select">Vendedor substituto</Label>
          <Select
            value={novoResponsavelId}
            onValueChange={(value) => setNovoResponsavelId(value ?? "")}
            items={substitutos.map((v) => ({
              value: v.id,
              label: `${v.nome} ${v.sobrenome}`,
            }))}
          >
            <SelectTrigger id="substituto-select" className="w-full">
              <SelectValue placeholder="Selecione o substituto" />
            </SelectTrigger>
            <SelectContent>
              {substitutos.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.nome} {v.sobrenome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
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
            variant="secondary"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Desativando..." : "Desativar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
