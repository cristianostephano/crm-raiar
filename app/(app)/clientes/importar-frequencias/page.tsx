import { redirect } from "next/navigation"

import { FrequenciaImportWizard } from "@/components/importacao/FrequenciaImportWizard"
import { createClient } from "@/lib/supabase/server"

/**
 * Tela exclusiva do Supervisor de importação em massa de frequência de
 * visita (Fase 17, IMP-01, D1). Cópia estrutural de
 * app/(app)/clientes/importar/page.tsx: mesmo duplo redirecionamento (para
 * "/login" sem sessão, para "/" quando o papel não for Supervisor) — este
 * redirecionamento é conforto de interface, a trava real de escrita é o
 * guard dentro de atualizar_frequencia_visita_lote (Fase 17-01) somado à
 * checagem de papel das ações de servidor deste fluxo (Fase 17-03).
 */
export default async function ImportarFrequenciasPage() {
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
      <h1 className="text-[28px] font-semibold">
        Importar frequências de visita
      </h1>
      <FrequenciaImportWizard />
    </div>
  )
}
