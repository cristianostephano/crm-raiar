import { redirect } from "next/navigation"

import { LogoutButton } from "@/components/auth/LogoutButton"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"

const ROLE_LABELS: Record<string, string> = {
  supervisor: "Supervisor",
  vendedor: "Vendedor",
}

/**
 * Auth guard for the whole protected area: redirects to /login when there is
 * no session (RESEARCH.md Pattern 3 / AUTH-01). Role is read from `profiles`
 * and shown only as a UX reflection (neutral/secondary Badge, never blue) —
 * RLS remains the real authorization boundary (threat T-01-08).
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

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">{fullName}</span>
          {roleLabel ? <Badge variant="secondary">{roleLabel}</Badge> : null}
        </div>
        <LogoutButton />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
