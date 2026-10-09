import { redirect } from "next/navigation"

import { DashboardClient } from "@/components/dashboard/DashboardClient"
import { getVendedoresAtivosFiltro } from "@/lib/supabase/queries/dashboard"
import { createClient } from "@/lib/supabase/server"

/**
 * "/dashboard" (D-03) — protected Server Component route, separate from the
 * kanban landing screen. Auth is already guarded at app/(app)/layout.tsx;
 * this page re-reads `profile.role` (the same `profile?.role ===
 * "supervisor"` conditional already used in layout.tsx) only to pass
 * `isSupervisor` down as a prop — DashboardClient never re-derives role
 * client-side (mirrors app/(app)/configuracoes/page.tsx's own re-read).
 *
 * Quick 261009-npp: only for the Supervisor, also loads the names of the
 * active vendedores for the Dashboard "Vendedor" select (id + name only). A
 * failure becomes an empty list (the select then only offers "Todos os
 * vendedores"); a Vendedor receives an empty list and never sees the select.
 */
export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const isSupervisor = profile?.role === "supervisor"
  const vendedorOptions = isSupervisor
    ? await getVendedoresAtivosFiltro().catch(() => [])
    : []

  return (
    <DashboardClient isSupervisor={isSupervisor} vendedorOptions={vendedorOptions} />
  )
}
