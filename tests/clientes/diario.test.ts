import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { anonClient, serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Consulta do Diário (DIAR-01, 16-03-PLAN.md) — leitura própria da trilha de
 * auditoria, filtrada por tipo de entrada NO SQL, ordenada da mais recente
 * para a mais antiga.
 *
 * getDiario()/getDiarioAction() dependem do contexto de requisição do Next
 * (leitura de cookies via next/headers), então não podem ser invocadas
 * diretamente pelo Vitest (precedente do projeto desde a Fase 2). Este
 * arquivo exercita a MESMA consulta que getDiario() faz
 * (from("historico").select("id, tipo, descricao, criado_em,
 * profiles(nome, sobrenome)").eq("cliente_id", clienteId).in("tipo", [...]).
 * order("criado_em", { ascending: false })), com sessões reais.
 *
 * historico não tem policy de INSERT para usuários (só os gatilhos
 * SECURITY DEFINER escrevem nela) — por isso o cenário é semeado
 * diretamente na tabela pela chave de serviço, nunca pelas RPCs de
 * conclusão (que já são cobertas noutro lugar).
 */

const TIPOS_DIARIO = ["tarefa_concluida", "visita_concluida"] as const

type DiarioRow = {
  id: string
  tipo: string
  descricao: string
  criado_em: string
  profiles: { nome: string; sobrenome: string } | null
}

async function lerDiario(client: SupabaseClient, clienteId: string) {
  const { data, error } = await client
    .from("historico")
    .select("id, tipo, descricao, criado_em, profiles(nome, sobrenome)")
    .eq("cliente_id", clienteId)
    .in("tipo", TIPOS_DIARIO)
    .order("criado_em", { ascending: false })

  return { data: (data ?? []) as unknown as DiarioRow[], error }
}

function uniqueRazaoSocial(label: string): string {
  return `Teste Diario ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function baseClienteFields(razaoSocial: string, responsavelId: string) {
  return {
    razao_social: razaoSocial,
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: responsavelId,
  }
}

async function getUserId(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
}

describe("Diário: consulta filtrada em SQL, ordenada, com autor resolvido", () => {
  let vendedorA: SupabaseClient
  let vendedorB: SupabaseClient
  let supervisor: SupabaseClient
  let vendedorAId: string
  let vendedorANome: string

  let clienteComEntradasId: string
  let clienteSemConclusaoId: string
  let clienteDeBId: string

  let entradaEtapaId: string
  let entradaStatusId: string
  let entradaTarefaId: string
  let entradaVisitaComAutorId: string
  let entradaVisitaSemAutorId: string

  const RESUMO_TAREFA = "Tarefa de prospecção concluída com sucesso"
  const RESUMO_VISITA_COM_AUTOR = "Visita realizada, pedido confirmado no local"
  const RESUMO_VISITA_SEM_AUTOR = "Visita concluída pelo processo antigo"

  const createdClienteIds: string[] = []

  beforeAll(async () => {
    vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    vendedorAId = await getUserId(vendedorA)

    const admin = serviceClient()

    const { data: perfilA, error: perfilError } = await admin
      .from("profiles")
      .select("nome, sobrenome")
      .eq("id", vendedorAId)
      .single()
    if (perfilError || !perfilA) {
      throw new Error(`Failed to read vendedorA profile: ${perfilError?.message}`)
    }
    vendedorANome = `${perfilA.nome} ${perfilA.sobrenome}`

    // Cliente A com 5 entradas de trilha de auditoria, carimbos controlados.
    const { data: clienteComEntradas, error: clienteError } = await admin
      .from("clientes")
      .insert(baseClienteFields(uniqueRazaoSocial("com-entradas"), vendedorAId))
      .select("id")
      .single()
    if (clienteError || !clienteComEntradas) {
      throw new Error(`Failed to seed cliente: ${clienteError?.message}`)
    }
    clienteComEntradasId = clienteComEntradas.id
    createdClienteIds.push(clienteComEntradasId)

    const agora = Date.now()
    const carimbo = (minutosAtras: number) =>
      new Date(agora - minutosAtras * 60_000).toISOString()

    const { data: entradas, error: entradasError } = await admin
      .from("historico")
      .insert([
        {
          cliente_id: clienteComEntradasId,
          tipo: "etapa",
          descricao: 'Etapa alterada para "Conversa realizada com comprador(a)"',
          autor_id: vendedorAId,
          criado_em: carimbo(5),
        },
        {
          cliente_id: clienteComEntradasId,
          tipo: "status_acompanhamento",
          descricao: 'Status alterado para "em_andamento"',
          autor_id: vendedorAId,
          criado_em: carimbo(4),
        },
        {
          cliente_id: clienteComEntradasId,
          tipo: "tarefa_concluida",
          descricao: RESUMO_TAREFA,
          autor_id: vendedorAId,
          criado_em: carimbo(3),
        },
        {
          cliente_id: clienteComEntradasId,
          tipo: "visita_concluida",
          descricao: RESUMO_VISITA_COM_AUTOR,
          autor_id: vendedorAId,
          criado_em: carimbo(2),
        },
        {
          cliente_id: clienteComEntradasId,
          tipo: "visita_concluida",
          descricao: RESUMO_VISITA_SEM_AUTOR,
          autor_id: null,
          criado_em: carimbo(1),
        },
      ])
      .select("id, tipo, descricao")
    if (entradasError || !entradas) {
      throw new Error(`Failed to seed historico: ${entradasError?.message}`)
    }

    // Casada pela descrição (sentinela única), não pelo carimbo — o Postgres
    // devolve timestamptz re-serializado (offset/frações diferentes da
    // string ISO enviada), então comparar strings de data por igualdade
    // não é confiável.
    entradaEtapaId = entradas.find((e) => e.tipo === "etapa")!.id
    entradaStatusId = entradas.find((e) => e.tipo === "status_acompanhamento")!.id
    entradaTarefaId = entradas.find((e) => e.tipo === "tarefa_concluida")!.id
    entradaVisitaComAutorId = entradas.find(
      (e) => e.tipo === "visita_concluida" && e.descricao === RESUMO_VISITA_COM_AUTOR
    )!.id
    entradaVisitaSemAutorId = entradas.find(
      (e) => e.tipo === "visita_concluida" && e.descricao === RESUMO_VISITA_SEM_AUTOR
    )!.id

    // Cliente A sem nenhuma entrada de conclusão.
    const { data: clienteSemConclusao, error: clienteSemConclusaoError } = await admin
      .from("clientes")
      .insert(baseClienteFields(uniqueRazaoSocial("sem-conclusao"), vendedorAId))
      .select("id")
      .single()
    if (clienteSemConclusaoError || !clienteSemConclusao) {
      throw new Error(
        `Failed to seed cliente sem conclusao: ${clienteSemConclusaoError?.message}`
      )
    }
    clienteSemConclusaoId = clienteSemConclusao.id
    createdClienteIds.push(clienteSemConclusaoId)

    // Cliente do Vendedor B.
    const vendedorBId = await getUserId(vendedorB)
    const { data: clienteDeB, error: clienteDeBError } = await admin
      .from("clientes")
      .insert(baseClienteFields(uniqueRazaoSocial("de-b"), vendedorBId))
      .select("id")
      .single()
    if (clienteDeBError || !clienteDeB) {
      throw new Error(`Failed to seed cliente de B: ${clienteDeBError?.message}`)
    }
    clienteDeBId = clienteDeB.id
    createdClienteIds.push(clienteDeBId)
  })

  afterAll(async () => {
    if (createdClienteIds.length === 0) return
    const admin = serviceClient()
    // on delete cascade em historico.cliente_id cobre a limpeza das entradas.
    await admin.from("clientes").delete().in("id", createdClienteIds)
  })

  it("filtro: devolve exatamente as tres entradas de conclusao; etapa e status NAO aparecem", async () => {
    const { data, error } = await lerDiario(vendedorA, clienteComEntradasId)
    expect(error).toBeNull()

    const ids = data.map((row) => row.id)
    expect(ids).toContain(entradaTarefaId)
    expect(ids).toContain(entradaVisitaComAutorId)
    expect(ids).toContain(entradaVisitaSemAutorId)
    expect(ids).not.toContain(entradaEtapaId)
    expect(ids).not.toContain(entradaStatusId)
    expect(data).toHaveLength(3)
  })

  it("ordem: entradas vem da mais recente para a mais antiga", async () => {
    const { data, error } = await lerDiario(vendedorA, clienteComEntradasId)
    expect(error).toBeNull()

    expect(data.map((row) => row.id)).toEqual([
      entradaVisitaSemAutorId,
      entradaVisitaComAutorId,
      entradaTarefaId,
    ])
  })

  it("autor: a entrada com autor preenchido traz o nome montado a partir do perfil", async () => {
    const { data, error } = await lerDiario(vendedorA, clienteComEntradasId)
    expect(error).toBeNull()

    const entrada = data.find((row) => row.id === entradaTarefaId)
    expect(entrada?.profiles).not.toBeNull()
    expect(
      `${entrada?.profiles?.nome} ${entrada?.profiles?.sobrenome}`
    ).toBe(vendedorANome)
  })

  it("autornulo: a entrada sem autor traz o autor nulo, nunca uma string qualquer", async () => {
    const { data, error } = await lerDiario(vendedorA, clienteComEntradasId)
    expect(error).toBeNull()

    const entrada = data.find((row) => row.id === entradaVisitaSemAutorId)
    expect(entrada?.profiles).toBeNull()
  })

  it("resumo: a descricao devolvida e exatamente o texto semeado, sem prefixo e sem transformacao", async () => {
    const { data, error } = await lerDiario(vendedorA, clienteComEntradasId)
    expect(error).toBeNull()

    expect(data.find((row) => row.id === entradaTarefaId)?.descricao).toBe(
      RESUMO_TAREFA
    )
    expect(
      data.find((row) => row.id === entradaVisitaComAutorId)?.descricao
    ).toBe(RESUMO_VISITA_COM_AUTOR)
    expect(
      data.find((row) => row.id === entradaVisitaSemAutorId)?.descricao
    ).toBe(RESUMO_VISITA_SEM_AUTOR)
  })

  it("vazio: o cliente sem entradas de conclusao devolve lista vazia", async () => {
    const { data, error } = await lerDiario(vendedorA, clienteSemConclusaoId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it("vendedor: o Vendedor B consultando o cliente de A recebe lista vazia, sem erro", async () => {
    const { data, error } = await lerDiario(vendedorB, clienteComEntradasId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it("supervisor: o Supervisor consultando o mesmo cliente de A recebe as tres entradas de conclusao", async () => {
    const { data, error } = await lerDiario(supervisor, clienteComEntradasId)
    expect(error).toBeNull()
    expect(data).toHaveLength(3)
    expect(data.map((row) => row.id).sort()).toEqual(
      [entradaTarefaId, entradaVisitaComAutorId, entradaVisitaSemAutorId].sort()
    )
  })

  it("anonimo: um cliente nao autenticado nao recebe entrada nenhuma", async () => {
    const { data, error } = await lerDiario(anonClient(), clienteComEntradasId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })
})
