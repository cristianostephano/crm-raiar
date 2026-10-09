import { redirect } from "next/navigation"

import { GanhosList } from "@/components/ganhos/GanhosList"
import { getCategoriasAtivas, getProdutosAtivos } from "@/lib/supabase/queries/clientes"
import { createClient } from "@/lib/supabase/server"

/**
 * "/ganhos" (quick 261008-rxw) — rota protegida, Server Component, dentro do
 * grupo de rotas `(app)` (como /perdidos: fora dele a página perderia a guarda
 * de sessão e o menu lateral). A guarda real de sessão já vive em
 * app/(app)/layout.tsx; esta página relê `profile.role` só para derivar
 * `isSupervisor` e buscar os catálogos que a ficha do cliente — aberta a
 * partir de uma linha da lista — exige (mesmo molde de app/(app)/agenda/
 * page.tsx). A RLS do banco decide quais linhas cada pessoa recebe.
 *
 * A leitura da lista em si NÃO acontece aqui: ela roda no cliente, dentro de
 * GanhosList, via Server Action, porque precisa ser refeita ao trocar o
 * período e depois de salvar, apagar ou encerrar pela ficha.
 */
export default async function GanhosPage() {
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
      <GanhosList
        isSupervisor={isSupervisor}
        categoriaOptions={categoriaOptions}
        produtoOptions={produtoOptions}
        vendedorOptions={vendedorOptions}
      />
    </div>
  )
}
