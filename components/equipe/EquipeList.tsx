"use client"

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"

import { reativarMembroEquipe } from "@/app/actions/equipe"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DesativarMembroDialog } from "@/components/equipe/DesativarMembroDialog"
import { type EquipeMember } from "@/lib/equipe/membros"

const ROLE_LABELS: Record<string, string> = {
  supervisor: "Supervisor",
  vendedor: "Vendedor",
}

const REATIVAR_ERROR = "Não foi possível reativar. Tente novamente."

/**
 * Hiding the Desativar action on the caller's own row (D-01) is a UX
 * affordance, not the security control — the SECURITY DEFINER RPC
 * (desativar_membro_equipe) refuses `p_profile_id = auth.uid()` regardless
 * of what this component renders, which is what CLAUDE.md's ban on
 * hand-rolled authorization requires.
 */
export function EquipeList({
  members,
  currentUserId,
}: {
  members: EquipeMember[]
  currentUserId: string
}) {
  const [rows, setRows] = useState<EquipeMember[]>(members)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<EquipeMember | null>(
    null
  )
  // reactivatingId tracks which row's Reativar button is mid-flight, so
  // only that row's button disables — never a page-wide loading lock.
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)

  async function handleReativar(member: EquipeMember) {
    setReactivatingId(member.id)

    const result = await reativarMembroEquipe(member.id)

    if (result.error) {
      setSuccessMessage(null)
      setFormError(REATIVAR_ERROR)
      setReactivatingId(null)
      return
    }

    setRows((current) =>
      current.map((m) => (m.id === member.id ? { ...m, ativo: true } : m))
    )
    setFormError(null)
    setSuccessMessage(`${member.nome} reativado(a).`)
    setReactivatingId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {formError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary"
        >
          {successMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Nome</th>
              <th className="px-4 py-2 text-left font-semibold">Sobrenome</th>
              <th className="px-4 py-2 text-left font-semibold">Papel</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-left font-semibold">E-mail</th>
              <th className="px-4 py-2 text-left font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => {
              const isSelf = member.id === currentUserId
              const isReactivating = reactivatingId === member.id

              return (
                <tr key={member.id} className="border-t">
                  <td className="px-4 py-2">{member.nome}</td>
                  <td className="px-4 py-2">{member.sobrenome}</td>
                  <td className="px-4 py-2">
                    <Badge variant="secondary">
                      {ROLE_LABELS[member.role] ?? member.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline">
                      {member.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">{member.email}</td>
                  <td className="px-4 py-2">
                    {member.ativo ? (
                      isSelf ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Desativar ${member.nome}`}
                          onClick={() => setDeactivateTarget(member)}
                        >
                          <EyeOff className="size-4" />
                        </Button>
                      )
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Reativar ${member.nome}`}
                        disabled={isReactivating}
                        onClick={() => void handleReativar(member)}
                      >
                        <Eye className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <DesativarMembroDialog
        member={deactivateTarget}
        members={rows}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateTarget(null)
          }
        }}
        onSuccess={({ member, clientesReatribuidos, substitutoNome }) => {
          setRows((current) =>
            current.map((m) =>
              m.id === member.id ? { ...m, ativo: false } : m
            )
          )
          setFormError(null)
          setDeactivateTarget(null)
          setSuccessMessage(
            `${member.nome} desativado(a). ${clientesReatribuidos} cliente(s) em andamento foram transferidos para ${substitutoNome}.`
          )
        }}
        onBanFailure={(member) => {
          setRows((current) =>
            current.map((m) =>
              m.id === member.id ? { ...m, ativo: false } : m
            )
          )
          setDeactivateTarget(null)
          setSuccessMessage(null)
          setFormError(
            `${member.nome} foi desativado(a) no sistema, mas houve falha ao bloquear o login. Tente desativar novamente em alguns instantes.`
          )
        }}
      />
    </div>
  )
}
