import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/layout/AppSidebar"
import { getAgendaPendentesCount } from "@/lib/supabase/queries/agenda"
import { createClient } from "@/lib/supabase/server"

const ROLE_LABELS: Record<string, string> = {
  supervisor: "Supervisor",
  vendedor: "Vendedor",
}

/**
 * Auth guard for the whole protected area: redirects to /login when there is
 * no session (RESEARCH.md Pattern 3 / AUTH-01). Role is read from `profiles`
 * and passed to AppSidebar purely as a UX reflection (nav visibility, never
 * a colored badge) — RLS remains the real authorization boundary (threat
 * T-01-08 / T-nav-01).
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, sobrenome, role")
    .eq("id", user.id)
    .single()

  const fullName = profile
    ? `${profile.nome} ${profile.sobrenome}`
    : user.email
  const roleLabel = profile
    ? (ROLE_LABELS[profile.role] ?? profile.role)
    : null
  const initials = profile
    ? `${profile.nome.charAt(0)}${profile.sobrenome.charAt(0)}`.toUpperCase()
    : (user.email?.charAt(0) ?? "").toUpperCase()

  // AGD-06: this layout wraps EVERY authenticated screen (Clientes,
  // Dashboard, Equipe, Configurações, Agenda), so a single unhandled
  // exception here would take the entire logged-in area down for the sake
  // of a decorative sidebar number. Zero is the deliberate fallback — the
  // menu still renders normally, just without a badge (T-14-21).
  let agendaCount = 0
  try {
    agendaCount = await getAgendaPendentesCount()
  } catch {
    agendaCount = 0
  }

  return (
    <div className="flex min-h-screen flex-1">
      <AppSidebar
        fullName={fullName ?? ""}
        roleLabel={roleLabel}
        role={profile?.role ?? ""}
        initials={initials}
        agendaCount={agendaCount}
      />
      {/* quick 260928-ilo: fundo cinza bem claro na área logada para os
          cards brancos se destacarem (referência visual do dono do
          projeto). slate-50 é o tom mais escuro que ainda mantém o texto
          secundário (text-muted-foreground) em ~4,5:1 de contraste (AA) —
          não escurecer. O degradê em
          components/clientes/ScrollColumnShell.tsx usa a mesma cor e
          precisa mudar junto, senão sobra uma faixa de cor errada no pé de
          cada coluna do Kanban. */}
      <main className="flex flex-1 flex-col overflow-x-hidden bg-slate-50">
        {children}
      </main>
    </div>
  )
}
