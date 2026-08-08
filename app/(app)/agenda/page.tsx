import { redirect } from "next/navigation"

import { AgendaList } from "@/components/agenda/AgendaList"
import {
  getCategoriasAtivas,
  getProdutosAtivos,
} from "@/lib/supabase/queries/clientes"
import { createClient } from "@/lib/supabase/server"

/**
 * "/agenda" (AGD-01) — rota protegida, Server Component, dentro do grupo de
 * rotas `(app)` (fora dele a página perderia a guarda de sessão e o menu
 * lateral). A guarda real de sessão já vive em app/(app)/layout.tsx; esta
 * página relê `profile.role` só para derivar `isSupervisor` e buscar os
 * catálogos que a ficha do cliente (aberta a partir de uma linha da agenda)
 * exige — mesmo padrão de app/(app)/dashboard/page.tsx e
 * app/(app)/clientes/page.tsx.
 *
 * A leitura da lista da agenda em si NÃO acontece aqui: ela roda no
 * cliente, dentro de AgendaList, via Server Action, porque o componente
 * precisa refazê-la ao trocar o filtro de vendedor, clicar "Tentar
 * novamente" ou salvar/apagar pela ficha do cliente. Esta página não
 * renderiza título nem filtro — quem faz isso é o AgendaList.
 */
export default async function AgendaPage() {
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

  const [categoriaOptions, produtoOptions] = await Promise.all([
    getCategoriasAtivas(),
    getProdutosAtivos(),
  ])

  let vendedorOptions: { id: string; nome: string }[] = []
  if (isSupervisor) {
    const { data: membros } = await supabase
      .from("profiles")
      .select("id, nome, sobrenome")
      .order("nome", { ascending: true })
    vendedorOptions = (membros ?? []).map((membro) => ({
      id: membro.id,
      nome: `${membro.nome} ${membro.sobrenome}`,
    }))
  }

  return (
    <div className="flex flex-1 flex-col p-6">
      <AgendaList
        isSupervisor={isSupervisor}
        categoriaOptions={categoriaOptions}
        produtoOptions={produtoOptions}
        vendedorOptions={vendedorOptions}
      />
    </div>
  )
}
