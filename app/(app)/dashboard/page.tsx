import { redirect } from "next/navigation"

import { DashboardClient } from "@/components/dashboard/DashboardClient"
import { createClient } from "@/lib/supabase/server"

/**
 * "/dashboard" (D-03) — protected Server Component route, separate from the
 * kanban landing screen. Auth is already guarded at app/(app)/layout.tsx;
 * this page re-reads `profile.role` (the same `profile?.role ===
 * "supervisor"` conditional already used in layout.tsx) only to pass
 * `isSupervisor` down as a prop — DashboardClient never re-derives role
 * client-side (mirrors app/(app)/configuracoes/page.tsx's own re-read).
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

  return <DashboardClient isSupervisor={profile?.role === "supervisor"} />
}
