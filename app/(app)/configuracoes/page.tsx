import { redirect } from "next/navigation"

import { ConfiguracoesTabs } from "@/components/configuracoes/ConfiguracoesTabs"
import { createClient } from "@/lib/supabase/server"

/**
 * Supervisor-only "Configurações" screen (ADM-01..04, D-01/D-02). Redirects
 * any non-Supervisor to "/" — same app-layer guard as app/(app)/equipe/page.tsx
 * (this is UX only; the real authorization boundary is the RLS INSERT/UPDATE
 * policies on the 4 lookup tables, proven by tests/configuracoes/rls-listas.test.ts).
 *
 * Unlike "Gerenciar equipe"/"Clientes", there is no page-level action button
 * beside the heading (UI-SPEC line 118) — the primary action here is each
 * tab's own "Adicionar" form, not a page-level one.
 */
export default async function ConfiguracoesPage() {
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

  return (
    <div className="flex flex-1 flex-col gap-8 p-6">
      <h1 className="text-[28px] font-semibold">Configurações</h1>
      <ConfiguracoesTabs />
    </div>
  )
}
