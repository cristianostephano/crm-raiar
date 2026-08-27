import { redirect } from "next/navigation"

import { AtivoImportWizard } from "@/components/importacao/AtivoImportWizard"
import { createClient } from "@/lib/supabase/server"

/**
 * Tela exclusiva do Supervisor da planilha "Importar clientes ativos" (Fase
 * 25, ATIVO-01..04). Cópia estrutural de
 * app/(app)/clientes/importar/page.tsx: mesmo duplo redirecionamento (para
 * "/login" sem sessão, para "/" quando o papel não for Supervisor) — este
 * redirecionamento é conforto de interface; a trava real é a trava de papel
 * dentro da RPC `importar_clientes_ativos_lote` (Fase 25 Plano 1) somada à
 * checagem de papel das duas ações de servidor deste fluxo (Fase 25 Plano
 * 2).
 */
export default async function ImportarAtivosPage() {
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
      <h1 className="text-[28px] font-semibold">Importar Clientes Ativos</h1>
      <AtivoImportWizard />
    </div>
  )
}
