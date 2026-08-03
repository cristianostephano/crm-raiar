import { redirect } from "next/navigation"

import { InviteUserForm } from "@/components/auth/InviteUserForm"
import { EquipeList } from "@/components/equipe/EquipeList"
import { type EquipeMember } from "@/lib/equipe/membros"
import { createClient } from "@/lib/supabase/server"

/**
 * Supervisor-only "Gerenciar equipe" screen (AUTH-02, D-10). Redirects any
 * non-Supervisor to "/" — this app-layer redirect is UX only; the real
 * authorization boundaries are the invite-user Edge Function's 403 check
 * and this table's underlying `profiles` RLS SELECT policy (T-01-14).
 */
export default async function EquipePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (callerProfile?.role !== "supervisor") {
    redirect("/")
  }

  const { data: members }: { data: EquipeMember[] | null } = await supabase
    .from("profiles")
    .select("id, nome, sobrenome, email, role, ativo")
    .order("nome", { ascending: true })

  const hasMembers = (members?.length ?? 0) > 0

  return (
    <div className="flex flex-1 flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold">Gerenciar equipe</h1>
        <InviteUserForm />
      </div>

      {hasMembers ? (
        // currentUserId lets EquipeList hide the Desativar action on the
        // caller's own row (D-01) — an affordance only; the RPC refuses
        // self-deactivation regardless of what this prop drives.
        <EquipeList members={members ?? []} currentUserId={user.id} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="text-base font-semibold">
            Nenhum membro cadastrado ainda
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Convide o primeiro vendedor ou supervisor da equipe usando o botão
            acima. Um e-mail de convite será enviado para essa pessoa definir
            a própria senha.
          </p>
        </div>
      )}
    </div>
  )
}
