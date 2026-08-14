import { redirect } from "next/navigation"

import { CnpjImportWizard } from "@/components/importacao/CnpjImportWizard"
import { createClient } from "@/lib/supabase/server"

/**
 * Tela exclusiva do Supervisor da planilha "CNPJ em massa" (Fase 19,
 * IMP-03). Cópia estrutural de
 * app/(app)/clientes/importar-frequencias/page.tsx: mesmo duplo
 * redirecionamento (para "/login" sem sessão, para "/" quando o papel não
 * for Supervisor) — este redirecionamento é conforto de interface, a trava
 * real de escrita é o guard dentro de atualizar_cnpj_lote (Fase 19-01)
 * somado à checagem de papel das ações de servidor deste fluxo (Fase
 * 19-03).
 */
export default async function ImportarCnpjPage() {
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
      <h1 className="text-[28px] font-semibold">Importar CNPJ em massa</h1>
      <CnpjImportWizard />
    </div>
  )
}
