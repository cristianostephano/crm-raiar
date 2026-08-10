import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { anonClient, serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Testes de integração do leitor de exportação do diário (IMP-02, critério
 * de sucesso 5, plano 17-02) — no molde de tests/clientes/rls-exportacao.test.ts
 * (RLS negativa contra sessões reais) + tests/clientes/diario.test.ts (como
 * semear a trilha de auditoria).
 *
 * getDiarioParaExportacao() chama createClient() (ligado a next/headers),
 * então não pode ser invocada diretamente pelo Vitest (mesma restrição já
 * registrada para getDiario/createCliente). Este arquivo exercita a MESMA
 * consulta que a função faz (from("historico").select("descricao, tipo,
 * criado_em, clientes(razao_social, profiles(nome, sobrenome)),
 * autor:profiles!historico_autor_id_fkey(nome, sobrenome)").in("tipo", [...]).
 * order("criado_em", { ascending: false })), com sessões reais.
 *
 * `historico` não tem policy de INSERT para usuários — só os gatilhos
 * SECURITY DEFINER escrevem nela — então o cenário é semeado diretamente na
 * tabela pela chave de serviço, nunca pelas RPCs de conclusão.
 */

const TIPOS_DIARIO = ["tarefa_concluida", "visita_concluida"] as const

type DiarioExportQueryRow = {
  descricao: string
  tipo: string
  criado_em: string
  clientes: {
    razao_social: string
    profiles: { nome: string; sobrenome: string } | null
  } | null
  autor: { nome: string; sobrenome: string } | null
}

async function lerDiarioParaExportacao(client: SupabaseClient) {
  const { data, error } = await client
    .from("historico")
    .select(
      "descricao, tipo, criado_em, clientes(razao_social, profiles(nome, sobrenome)), autor:profiles!historico_autor_id_fkey(nome, sobrenome)"
    )
    .in("tipo", TIPOS_DIARIO)
    .order("criado_em", { ascending: false })

  return { data: (data ?? []) as unknown as DiarioExportQueryRow[], error }
}

function uniqueRazaoSocial(label: string): string {
  return `Teste ExportDiario ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

describe("Exportação do diário (IMP-02): visibilidade por RLS, filtro no SQL, ordem e campos", () => {
  let vendedorA: SupabaseClient
  let vendedorB: SupabaseClient
  let supervisor: SupabaseClient
  let vendedorAId: string
  let vendedorANome: string

  let clienteDeAId: string
  let clienteDeBId: string
  let razaoSocialClienteDeA: string

  const RESUMO_ETAPA = 'Etapa alterada para "Conversa realizada com comprador(a)"'
  const RESUMO_STATUS = 'Status alterado para "em_andamento"'
  const RESUMO_TAREFA_A = "Ligação de prospecção concluída com o comprador"
  const RESUMO_VISITA_A = "Visita realizada, pedido confirmado no local"
  const RESUMO_TAREFA_B = "Mensagem de prospecção enviada pelo Vendedor B"

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
    const vendedorBId = await getUserId(vendedorB)

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

    razaoSocialClienteDeA = uniqueRazaoSocial("cliente-de-a")

    // Cliente do Vendedor A, com entradas de conclusão E entradas de
    // mudança de etapa/status (caso `filtro`).
    const { data: clienteDeA, error: clienteDeAError } = await admin
      .from("clientes")
      .insert(baseClienteFields(razaoSocialClienteDeA, vendedorAId))
      .select("id")
      .single()
    if (clienteDeAError || !clienteDeA) {
      throw new Error(`Failed to seed cliente de A: ${clienteDeAError?.message}`)
    }
    clienteDeAId = clienteDeA.id
    createdClienteIds.push(clienteDeAId)

    // Cliente do Vendedor B, também com entrada de conclusão.
    const { data: clienteDeB, error: clienteDeBError } = await admin
      .from("clientes")
      .insert(baseClienteFields(uniqueRazaoSocial("cliente-de-b"), vendedorBId))
      .select("id")
      .single()
    if (clienteDeBError || !clienteDeB) {
      throw new Error(`Failed to seed cliente de B: ${clienteDeBError?.message}`)
    }
    clienteDeBId = clienteDeB.id
    createdClienteIds.push(clienteDeBId)

    const agora = Date.now()
    const carimbo = (minutosAtras: number) =>
      new Date(agora - minutosAtras * 60_000).toISOString()

    const { data: entradasA, error: entradasAError } = await admin
      .from("historico")
      .insert([
        {
          cliente_id: clienteDeAId,
          tipo: "etapa",
          descricao: RESUMO_ETAPA,
          autor_id: vendedorAId,
          criado_em: carimbo(4),
        },
        {
          cliente_id: clienteDeAId,
          tipo: "status_acompanhamento",
          descricao: RESUMO_STATUS,
          autor_id: vendedorAId,
          criado_em: carimbo(3),
        },
        {
          cliente_id: clienteDeAId,
          tipo: "tarefa_concluida",
          descricao: RESUMO_TAREFA_A,
          autor_id: vendedorAId,
          criado_em: carimbo(2),
        },
        {
          cliente_id: clienteDeAId,
          tipo: "visita_concluida",
          descricao: RESUMO_VISITA_A,
          autor_id: vendedorAId,
          criado_em: carimbo(1),
        },
      ])
      .select("id, tipo, descricao")
    if (entradasAError || !entradasA) {
      throw new Error(`Failed to seed historico de A: ${entradasAError?.message}`)
    }

    const { data: entradasB, error: entradasBError } = await admin
      .from("historico")
      .insert([
        {
          cliente_id: clienteDeBId,
          tipo: "tarefa_concluida",
          descricao: RESUMO_TAREFA_B,
          autor_id: vendedorBId,
          criado_em: carimbo(0),
        },
      ])
      .select("id, tipo, descricao")
    if (entradasBError || !entradasB) {
      throw new Error(`Failed to seed historico de B: ${entradasBError?.message}`)
    }
  })

  afterAll(async () => {
    if (createdClienteIds.length === 0) return
    const admin = serviceClient()
    // on delete cascade em historico.cliente_id cobre a limpeza das entradas.
    await admin.from("clientes").delete().in("id", createdClienteIds)
  })

  it("vendedor: o Vendedor A recebe as conclusoes do proprio cliente e NENHUMA do cliente do Vendedor B", async () => {
    const { data, error } = await lerDiarioParaExportacao(vendedorA)
    expect(error).toBeNull()

    const descricoes = data.map((row) => row.descricao)
    expect(descricoes).toContain(RESUMO_TAREFA_A)
    expect(descricoes).toContain(RESUMO_VISITA_A)
    expect(descricoes).not.toContain(RESUMO_TAREFA_B)
  })

  it("supervisor: o Supervisor recebe as conclusoes dos dois clientes", async () => {
    const { data, error } = await lerDiarioParaExportacao(supervisor)
    expect(error).toBeNull()

    const descricoes = data.map((row) => row.descricao)
    expect(descricoes).toContain(RESUMO_TAREFA_A)
    expect(descricoes).toContain(RESUMO_VISITA_A)
    expect(descricoes).toContain(RESUMO_TAREFA_B)
  })

  it("filtro: entradas de mudanca de etapa e de status NAO aparecem no resultado", async () => {
    const { data, error } = await lerDiarioParaExportacao(supervisor)
    expect(error).toBeNull()

    const descricoes = data.map((row) => row.descricao)
    expect(descricoes).not.toContain(RESUMO_ETAPA)
    expect(descricoes).not.toContain(RESUMO_STATUS)
  })

  it("ordem: as entradas vem da mais recente para a mais antiga", async () => {
    const { data, error } = await lerDiarioParaExportacao(supervisor)
    expect(error).toBeNull()

    const relevantes = data.filter((row) =>
      [RESUMO_TAREFA_A, RESUMO_VISITA_A, RESUMO_TAREFA_B].includes(
        row.descricao
      )
    )
    // Semeadas em ordem crescente de "minutos atrás" decrescentes: tarefa A
    // (carimbo mais antigo), visita A, depois tarefa B (mais recente).
    expect(relevantes.map((row) => row.descricao)).toEqual([
      RESUMO_TAREFA_B,
      RESUMO_VISITA_A,
      RESUMO_TAREFA_A,
    ])
  })

  it("campos: uma entrada semeada traz razao social, responsavel, resumo e autor corretos", async () => {
    const { data, error } = await lerDiarioParaExportacao(supervisor)
    expect(error).toBeNull()

    const entrada = data.find((row) => row.descricao === RESUMO_TAREFA_A)
    expect(entrada).toBeDefined()
    expect(entrada?.clientes?.razao_social).toBe(razaoSocialClienteDeA)
    expect(entrada?.clientes?.profiles).not.toBeNull()
    expect(
      `${entrada?.clientes?.profiles?.nome} ${entrada?.clientes?.profiles?.sobrenome}`
    ).toBe(vendedorANome)
    expect(entrada?.descricao).toBe(RESUMO_TAREFA_A)
    expect(entrada?.autor).not.toBeNull()
    expect(`${entrada?.autor?.nome} ${entrada?.autor?.sobrenome}`).toBe(
      vendedorANome
    )
  })

  it("anonimo: um chamador nao autenticado nao recebe entrada nenhuma", async () => {
    const { data, error } = await lerDiarioParaExportacao(anonClient())
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })
})
