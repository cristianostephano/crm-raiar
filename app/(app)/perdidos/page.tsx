import { redirect } from "next/navigation"

import { PerdidosList } from "@/components/perdidos/PerdidosList"
import { createClient } from "@/lib/supabase/server"

/**
 * "/perdidos" (Fase 28) — rota protegida, Server Component, dentro do grupo
 * de rotas `(app)` (a guarda de sessão e o menu lateral vivem no layout desse
 * grupo). Esta página relê `profile.role` só para derivar `isSupervisor` —
 * quem decide QUAIS linhas voltam é a RLS de `clientes_perdidos` (28-01),
 * `isSupervisor` só escolhe mostrar o nome do vendedor na linha (D-04).
 *
 * Sem catálogos (categoria/produto/vendedor): esta tela não abre a ficha do
 * cliente, diferente de app/(app)/agenda/page.tsx.
 *
 * A leitura da lista em si NÃO acontece aqui: roda no navegador, dentro de
 * PerdidosList, via Server Action, porque precisa ser refeita ao trocar o
 * período e depois de cada "Reabrir" (D-09).
 */
export default async function PerdidosPage() {
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

  return (
    <div className="flex flex-1 flex-col p-6">
      <PerdidosList isSupervisor={isSupervisor} />
    </div>
  )
}
