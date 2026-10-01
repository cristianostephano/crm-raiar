import { redirect } from "next/navigation"

import { Agenda2List } from "@/components/agenda2/Agenda2List"
import { createClient } from "@/lib/supabase/server"

/**
 * "/agenda-2" (AGD2-06/AGD2-07) — rota protegida, Server Component, dentro
 * do grupo de rotas `(app)` (guarda de sessão e menu lateral já vêm do
 * layout). Espelha `app/(app)/agenda/page.tsx`, simplificada: esta página só
 * precisa saber `isSupervisor` para decidir o que a tela mostra — quem
 * decide os DADOS é sempre a RLS.
 *
 * Diferente de "/agenda", esta página NÃO busca categorias/produtos/motivos
 * de conclusão nem a lista de membros da equipe (minimização, T-31-34): as
 * opções do filtro de vendedor vêm dos próprios itens que a RLS já liberou
 * (`vendedoresDaAgenda2`, dentro de `Agenda2List`), nunca de uma consulta
 * separada à tabela de perfis.
 *
 * A leitura da Lista em si NÃO acontece aqui: roda no navegador, dentro de
 * `Agenda2List`, via Server Action (`getAgenda2Action`), porque o componente
 * precisa refazê-la ao trocar o filtro, clicar "Tentar novamente" ou
 * salvar/apagar/concluir/desmarcar um item.
 */
export default async function Agenda2Page() {
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
      <Agenda2List isSupervisor={isSupervisor} />
    </div>
  )
}
