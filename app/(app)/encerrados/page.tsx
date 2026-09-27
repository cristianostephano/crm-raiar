import { redirect } from "next/navigation"

import { EncerradosList } from "@/components/encerrados/EncerradosList"
import { createClient } from "@/lib/supabase/server"

/**
 * "/encerrados" (Fase 29) — rota protegida, Server Component, dentro do
 * grupo de rotas `(app)` (a guarda de sessão e o menu lateral vivem no
 * layout desse grupo). Esta página relê `profile.role` só para derivar
 * `isSupervisor` — quem decide QUAIS linhas voltam é a RLS de
 * `clientes_encerrados` (29-01/29-05); `isSupervisor` só escolhe mostrar o
 * nome do vendedor na linha (D-08).
 *
 * A leitura da lista em si NÃO acontece aqui: roda no navegador, dentro de
 * EncerradosList, via Server Action, porque precisa ser refeita ao trocar o
 * período e depois de cada "Reativar" (D-09/D-10).
 */
export default async function EncerradosPage() {
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
      <EncerradosList isSupervisor={isSupervisor} />
    </div>
  )
}
