import { redirect } from "next/navigation"

import {
  ClienteQuickCreateForm,
  type TeamMember,
} from "@/components/clientes/ClienteQuickCreateForm"
import { KanbanBoard } from "@/components/clientes/KanbanBoard"
import { getClientesAgrupadosPorEtapa } from "@/lib/supabase/queries/clientes"
import { createClient } from "@/lib/supabase/server"

/**
 * Client list / kanban origin screen (CLI-01/CLI-02/CLI-03, FUN-01). Every
 * authenticated user (Vendedor or Supervisor) can access this page — unlike
 * /equipe there is NO supervisor-only redirect here. RLS on `clientes`
 * (is_supervisor() OR responsavel = auth.uid(), from 02-01) is the real
 * boundary restricting which clientes come back from
 * getClientesAgrupadosPorEtapa(); this page's query and UI conditionals
 * (e.g. showing the responsável Select only to a Supervisor) are UX only
 * (T-02-09).
 *
 * Renders the 7-column compact kanban board (KanbanBoard, D-05) — clients
 * grouped by funil stage. No drag-and-drop yet (that lands in 02-04).
 */
export default async function ClientesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("nome, sobrenome, role")
    .eq("id", user.id)
    .single()

  const isSupervisor = callerProfile?.role === "supervisor"
  const currentUserName = callerProfile
    ? `${callerProfile.nome} ${callerProfile.sobrenome}`
    : (user.email ?? "")

  let teamMembers: TeamMember[] = []
  if (isSupervisor) {
    const { data: members } = await supabase
      .from("profiles")
      .select("id, nome, sobrenome")
      .order("nome", { ascending: true })
    teamMembers = members ?? []
  }

  const grouped = await getClientesAgrupadosPorEtapa()
  const totalClientes = Object.values(grouped).reduce(
    (total, clientes) => total + clientes.length,
    0
  )

  return (
    <div className="flex flex-1 flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold">Clientes</h1>
        <ClienteQuickCreateForm
          currentUserId={user.id}
          currentUserName={currentUserName}
          isSupervisor={isSupervisor}
          teamMembers={teamMembers}
        />
      </div>

      {totalClientes === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="text-base font-semibold">
            Nenhum cliente cadastrado ainda. Clique em &quot;Novo cliente&quot;
            para começar.
          </p>
        </div>
      ) : (
        <KanbanBoard
          grouped={grouped}
          callerRole={isSupervisor ? "supervisor" : "vendedor"}
        />
      )}
    </div>
  )
}
