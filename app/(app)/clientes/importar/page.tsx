import { redirect } from "next/navigation"

import { ImportWizard } from "@/components/importacao/ImportWizard"
import { createClient } from "@/lib/supabase/server"

/**
 * Supervisor-only "Importar clientes" screen (IMP-10). Redirects any
 * non-Supervisor to "/" — same app-layer guard as
 * app/(app)/configuracoes/page.tsx and app/(app)/equipe/page.tsx: this is
 * UX only, the real authorization boundary for any write this wizard
 * eventually triggers is the RLS/RPC guard shipped in Fase 7
 * (`importar_clientes_lote`), not this redirect.
 */
export default async function ImportarClientesPage() {
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
      <h1 className="text-[28px] font-semibold">Importar clientes</h1>
      <ImportWizard />
    </div>
  )
}
