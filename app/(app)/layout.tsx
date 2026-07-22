import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/layout/AppSidebar"
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

  return (
    <div className="flex min-h-screen flex-1">
      <AppSidebar
        fullName={fullName ?? ""}
        roleLabel={roleLabel}
        role={profile?.role ?? ""}
        initials={initials}
      />
      <main className="flex flex-1 flex-col overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
