import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  anonClient,
  createTestMember,
  deleteTestMember,
  serviceClient,
  signInAs,
  type TestMember,
} from "../helpers/supabase-test-clients"

/**
 * Testes ao vivo da leitura clientes_ganhos (migration 0053, quick
 * 261008-rxw): quais clientes estao ganhos hoje, desde quando e de qual
 * vendedor. Prova a RLS (Vendedor so os proprios, Supervisor todos), a data
 * do ganho (registro mais recente de troca de status no historico, com a data
 * de CADASTRO como reserva - nunca a da ultima edicao), o recorte de periodo,
 * a paginacao e as 6 colunas minimas (LGPD).
 *
 * O projeto Supabase de teste E o de producao, com dados reais de clientes.
 * Por isso este arquivo: usa so fixtures descartaveis (membros criados e
 * apagados aqui, nunca as contas semente antigas); NUNCA imprime linha lida
 * do banco no terminal; filtra TODA leitura da funcao, de qualquer sessao,
 * pelos ids de fixture no proprio PostgREST (nunca baixa a carteira real);
 * usa so razoes sociais, nomes fantasia e CNPJs inventados; nunca le nem
 * grava a tabela de registro de acesso diario da aderencia; e troca todo
 * status pelo cliente de servico (autor nulo no historico, entao nada conta
 * na aderencia de ninguem).
 *
 * Duas autenticacoes no arquivo inteiro: Vendedor A e Supervisor. Vendedor B
 * nunca faz login - os ganhos dele sao semeados pelo cliente de servico
 * (rate limit conhecido de login por senha).
 *
 * Fica VERMELHO (funcao inexistente no banco) ate o dono aplicar a 0053 pelo
 * SQL Editor. Esse vermelho e esperado e NAO foi medido na tarefa de
 * construcao: este arquivo so roda depois da aplicacao (Tarefa 6) - mesmo
 * procedimento da quick 261006-ncy.
 */

type GanhoRow = {
  cliente_id: string
  razao_social: string | null
  nome_fantasia: string | null
  ganho_em: string
  responsavel: string
  responsavel_nome: string | null
}

type HistoricoRow = {
  id: string
  tipo: string
  descricao: string
  criado_em: string
  autor_id: string | null
}

type ClienteRow = {
  id: string
  status_acompanhamento: string
  criado_em: string
  atualizado_em: string
}

const COLUNAS_ESPERADAS = [
  "cliente_id",
  "razao_social",
  "nome_fantasia",
  "ganho_em",
  "responsavel",
  "responsavel_nome",
]

const DIA_MS = 24 * 60 * 60_000

let cnpjCounter = 0

function uniqueRazaoSocial(label: string): string {
  return `Teste Ganhos ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 14 digitos derivados do timestamp + contador - evita colidir com a trava
 * de razao social+CNPJ da migration 0030 entre fixtures do arquivo. */
function uniqueCnpj(): string {
  cnpjCounter += 1
  return `${Date.now()}${cnpjCounter}`.slice(-14).padStart(14, "0")
}

function baseClienteFields(
  razaoSocial: string,
  responsavelId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    razao_social: razaoSocial,
    nome_fantasia: `Fantasia ${razaoSocial}`,
    cnpj: uniqueCnpj(),
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "Sao Paulo",
    estado: "SP",
    responsavel: responsavelId,
    ...overrides,
  }
}

/** Ids criados no caso corrente (apagados no afterEach). */
const createdClienteIds: string[] = []
/** Todos os ids criados no arquivo (conferencia de residuo no afterAll). */
const todosIdsCriados: string[] = []

let vendedorA: TestMember
let vendedorB: TestMember
let supervisor: TestMember
let clientA: SupabaseClient
let supervisorClient: SupabaseClient
let motivoPerdaId: string
let motivoEncerramentoId: string

beforeAll(async () => {
  vendedorA = await createTestMember("vendedor", "ganhos-a")
  vendedorB = await createTestMember("vendedor", "ganhos-b")
  supervisor = await createTestMember("supervisor", "ganhos")
  clientA = await signInAs(vendedorA.email, vendedorA.password)
  supervisorClient = await signInAs(supervisor.email, supervisor.password)

  motivoPerdaId = await primeiroMotivoAtivoId("motivos_perda", "perda")
  motivoEncerramentoId = await primeiroMotivoAtivoId("motivos_encerramento", "encerramento")
})

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  // O historico vai por cascata junto com o cliente.
  await serviceClient().from("clientes").delete().in("id", createdClienteIds.splice(0))
})

afterAll(async () => {
  // Ordem obrigatoria: clientes primeiro (FK sem ON DELETE), membros depois.
  await deleteTestMember(vendedorA.id)
  await deleteTestMember(vendedorB.id)
  await deleteTestMember(supervisor.id)

  if (todosIdsCriados.length === 0) return
  const admin = serviceClient()
  const { data: clientesRestantes, error: erroClientes } = await admin
    .from("clientes")
    .select("id")
    .in("id", todosIdsCriados)
  const { data: historicoRestante, error: erroHistorico } = await admin
    .from("historico")
    .select("id")
    .in("cliente_id", todosIdsCriados)
  if (erroClientes || erroHistorico) {
    throw new Error("Falha ao conferir residuo das fixtures de Ganhos")
  }
  const sobrouClientes = (clientesRestantes ?? []).length
  const sobrouHistorico = (historicoRestante ?? []).length
  if (sobrouClientes > 0 || sobrouHistorico > 0) {
    throw new Error(
      `Residuo de fixtures de Ganhos: ${sobrouClientes} cliente(s) e ${sobrouHistorico} linha(s) de historico`
    )
  }
})

/** Leitura read-only do primeiro motivo ativo de uma lista editavel. */
async function primeiroMotivoAtivoId(tabela: string, rotulo: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from(tabela)
    .select("id")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error(`Nenhum motivo de ${rotulo} ativo encontrado para o teste`)
  }
  return data.id as string
}

/** Insere pelo cliente de servico. `overrides` define etapa/status/datas
 * conforme o caso precisar. */
async function seedCliente(
  responsavelId: string,
  label: string,
  overrides: Record<string, unknown> = {}
): Promise<string> {
  const { data, error } = await serviceClient()
    .from("clientes")
    .insert(baseClienteFields(uniqueRazaoSocial(label), responsavelId, overrides))
    .select("id")
    .single()
  if (error || !data) {
    throw new Error(`Falha ao semear cliente: ${error?.message}`)
  }
  const id = data.id as string
  createdClienteIds.push(id)
  todosIdsCriados.push(id)
  return id
}

async function atualizarCliente(clienteId: string, campos: Record<string, unknown>): Promise<void> {
  const { error } = await serviceClient().from("clientes").update(campos).eq("id", clienteId)
  if (error) {
    throw new Error(`Falha ao atualizar cliente: ${error.message}`)
  }
}

/** Insere em primeira_venda/em_andamento e depois faz um UPDATE separado
 * para ganho - e o gatilho da 0002 que grava a troca no historico. */
async function seedGanhoPorTroca(responsavelId: string, label: string): Promise<string> {
  const id = await seedCliente(responsavelId, label, {
    etapa: "primeira_venda",
    status_acompanhamento: "em_andamento",
  })
  await atualizarCliente(id, { status_acompanhamento: "ganho" })
  return id
}

async function historicoDoCliente(clienteId: string): Promise<HistoricoRow[]> {
  const { data, error } = await serviceClient()
    .from("historico")
    .select("id, tipo, descricao, criado_em, autor_id")
    .eq("cliente_id", clienteId)
    .order("criado_em", { ascending: false })
  if (error) throw new Error(`Falha ao ler historico: ${error.message}`)
  return (data ?? []) as HistoricoRow[]
}

function linhasDeGanho(historico: HistoricoRow[]): HistoricoRow[] {
  return historico.filter((h) => h.tipo === "status_acompanhamento" && h.descricao.includes('"ganho"'))
}

async function clientePorId(clienteId: string): Promise<ClienteRow> {
  const { data, error } = await serviceClient()
    .from("clientes")
    .select("id, status_acompanhamento, criado_em, atualizado_em")
    .eq("id", clienteId)
    .single()
  if (error || !data) throw new Error(`Falha ao ler cliente: ${error?.message}`)
  return data as ClienteRow
}

/** Toda leitura da funcao filtra pelos ids de fixture no proprio PostgREST. */
async function lerGanhos(
  client: SupabaseClient,
  ids: string[],
  args: Record<string, unknown> = {}
): Promise<GanhoRow[]> {
  const { data, error } = await client.rpc("clientes_ganhos", args).in("cliente_id", ids)
  expect(error).toBeNull()
  return (data ?? []) as GanhoRow[]
}

describe("clientes_ganhos (0053, quick 261008-rxw)", () => {
  it("colunas-lgpd: as chaves de cada linha sao exatamente as 6 colunas combinadas, sem dado de contato", async () => {
    const id = await seedGanhoPorTroca(vendedorA.id, "colunas-lgpd")

    const linhas = await lerGanhos(clientA, [id])
    expect(linhas.length).toBe(1)
    expect(Object.keys(linhas[0]).sort()).toEqual([...COLUNAS_ESPERADAS].sort())
  })

  it("rls-vendedor: A recebe so o proprio ganho, nunca o de B", async () => {
    const idA = await seedGanhoPorTroca(vendedorA.id, "rls-vendedor-a")
    const idB = await seedGanhoPorTroca(vendedorB.id, "rls-vendedor-b")

    const linhas = await lerGanhos(clientA, [idA, idB])
    const ids = linhas.map((r) => r.cliente_id)
    expect(ids).toContain(idA)
    expect(ids).not.toContain(idB)
  })

  it("rls-supervisor: o Supervisor recebe os ganhos de A e de B, com o nome do vendedor", async () => {
    const idA = await seedGanhoPorTroca(vendedorA.id, "rls-supervisor-a")
    const idB = await seedGanhoPorTroca(vendedorB.id, "rls-supervisor-b")

    const linhas = await lerGanhos(supervisorClient, [idA, idB])
    const ids = linhas.map((r) => r.cliente_id)
    expect(ids).toContain(idA)
    expect(ids).toContain(idB)

    const linhaA = linhas.find((r) => r.cliente_id === idA)
    expect(linhaA!.responsavel).toBe(vendedorA.id)
    expect(linhaA!.responsavel_nome).toBe(`${vendedorA.nome} ${vendedorA.sobrenome}`)
  })

  it("data-do-ganho: ganho_em e a data da troca de status no historico, nao a do cadastro", async () => {
    const id = await seedCliente(vendedorA.id, "data-do-ganho", {
      etapa: "primeira_venda",
      status_acompanhamento: "em_andamento",
    })
    await atualizarCliente(id, {
      criado_em: "2020-01-01T00:00:00.000Z",
      etapa_alterada_em: "2020-01-01T00:00:00.000Z",
    })
    await atualizarCliente(id, { status_acompanhamento: "ganho" })

    const ganhos = linhasDeGanho(await historicoDoCliente(id))
    expect(ganhos.length).toBe(1)

    const janelaAntiga = await lerGanhos(clientA, [id], {
      p_inicio: "2019-12-31T00:00:00.000Z",
      p_fim: "2020-01-02T00:00:00.000Z",
    })
    expect(janelaAntiga.map((r) => r.cliente_id)).not.toContain(id)

    const agora = Date.now()
    const janelaAtual = await lerGanhos(clientA, [id], {
      p_inicio: new Date(agora - 10 * 60_000).toISOString(),
      p_fim: new Date(agora + 10 * 60_000).toISOString(),
    })
    const linha = janelaAtual.find((r) => r.cliente_id === id)
    expect(linha).toBeDefined()
    expect(new Date(linha!.ganho_em).getTime()).toBe(new Date(ganhos[0].criado_em).getTime())
  })

  it("sem-historico-usa-cadastro: cliente inserido ja ganho usa a data de cadastro, e editar a ficha nao muda isso", async () => {
    const agora = Date.now()
    const id = await seedCliente(vendedorA.id, "sem-historico-usa-cadastro", {
      etapa: "primeira_venda",
      status_acompanhamento: "ganho",
      criado_em: new Date(agora - 40 * DIA_MS).toISOString(),
    })
    // Edicao da ficha: renova atualizado_em, mas nao pode mexer em ganho_em.
    await atualizarCliente(id, { observacao: "Observacao inventada para o teste de Ganhos" })

    const historico = await historicoDoCliente(id)
    expect(historico.filter((h) => h.tipo === "status_acompanhamento").length).toBe(0)

    const cliente = await clientePorId(id)
    const criadoEm = new Date(cliente.criado_em).getTime()
    expect(new Date(cliente.atualizado_em).getTime()).not.toBe(criadoEm)

    const todas = await lerGanhos(clientA, [id])
    const linha = todas.find((r) => r.cliente_id === id)
    expect(linha).toBeDefined()
    expect(new Date(linha!.ganho_em).getTime()).toBe(criadoEm)
    expect(new Date(linha!.ganho_em).getTime()).not.toBe(new Date(cliente.atualizado_em).getTime())

    const ultimos30 = await lerGanhos(clientA, [id], {
      p_inicio: new Date(agora - 30 * DIA_MS).toISOString(),
    })
    expect(ultimos30.map((r) => r.cliente_id)).not.toContain(id)

    const ultimos41 = await lerGanhos(clientA, [id], {
      p_inicio: new Date(agora - 41 * DIA_MS).toISOString(),
    })
    expect(ultimos41.map((r) => r.cliente_id)).toContain(id)
  })

  it("ultimo-ganho: cliente encerrado e reativado conta a data da reativacao", async () => {
    const id = await seedGanhoPorTroca(vendedorA.id, "ultimo-ganho")
    await atualizarCliente(id, {
      status_acompanhamento: "encerrado",
      motivo_encerramento_id: motivoEncerramentoId,
    })
    await atualizarCliente(id, { status_acompanhamento: "ganho" })

    const ganhos = linhasDeGanho(await historicoDoCliente(id))
    expect(ganhos.length).toBe(2)
    const tempos = ganhos.map((h) => new Date(h.criado_em).getTime())
    const maior = Math.max(...tempos)
    const menor = Math.min(...tempos)
    expect(maior).toBeGreaterThan(menor)

    const linhas = await lerGanhos(clientA, [id])
    expect(linhas.length).toBe(1)
    expect(new Date(linhas[0].ganho_em).getTime()).toBe(maior)
  })

  it("so-ganho-atual: em andamento, perdido e encerrado nao entram; so o ganho de hoje", async () => {
    const idAndamento = await seedCliente(vendedorA.id, "so-ganho-atual-andamento", {
      etapa: "primeira_venda",
      status_acompanhamento: "em_andamento",
    })
    const idPerdido = await seedCliente(vendedorA.id, "so-ganho-atual-perdido", {
      status_acompanhamento: "perdido",
      motivo_perda_id: motivoPerdaId,
    })
    const idEncerrado = await seedGanhoPorTroca(vendedorA.id, "so-ganho-atual-encerrado")
    await atualizarCliente(idEncerrado, {
      status_acompanhamento: "encerrado",
      motivo_encerramento_id: motivoEncerramentoId,
    })
    const idGanho = await seedGanhoPorTroca(vendedorA.id, "so-ganho-atual-ganho")

    const linhas = await lerGanhos(clientA, [idAndamento, idPerdido, idEncerrado, idGanho])
    expect(linhas.map((r) => r.cliente_id)).toEqual([idGanho])
  })

  it("periodo: filtra pela janela ao redor de agora, com margem de tolerancia de relogio", async () => {
    const id = await seedGanhoPorTroca(vendedorA.id, "periodo")
    const agora = Date.now()

    const dentro = await lerGanhos(clientA, [id], {
      p_inicio: new Date(agora - 10 * 60_000).toISOString(),
      p_fim: new Date(agora + 10 * 60_000).toISOString(),
    })
    expect(dentro.map((r) => r.cliente_id)).toContain(id)

    const antesDaJanela = await lerGanhos(clientA, [id], {
      p_inicio: new Date(agora + 60 * 60_000).toISOString(),
      p_fim: null,
    })
    expect(antesDaJanela.map((r) => r.cliente_id)).not.toContain(id)

    const depoisDaJanela = await lerGanhos(clientA, [id], {
      p_inicio: null,
      p_fim: new Date(agora - 60 * 60_000).toISOString(),
    })
    expect(depoisDaJanela.map((r) => r.cliente_id)).not.toContain(id)

    const semLimite = await lerGanhos(clientA, [id])
    expect(semLimite.map((r) => r.cliente_id)).toContain(id)
  })

  it("paginacao: a mesma ordenacao (data desc, id asc) sustenta o recorte de pagina feito por fora", async () => {
    const id1 = await seedGanhoPorTroca(vendedorA.id, "paginacao-1")
    const id2 = await seedGanhoPorTroca(vendedorA.id, "paginacao-2")

    const pagina0 = await clientA
      .rpc("clientes_ganhos", {})
      .in("cliente_id", [id1, id2])
      .order("ganho_em", { ascending: false })
      .order("cliente_id", { ascending: true })
      .range(0, 0)
    expect(pagina0.error).toBeNull()
    expect((pagina0.data ?? []).length).toBe(1)

    const pagina1 = await clientA
      .rpc("clientes_ganhos", {})
      .in("cliente_id", [id1, id2])
      .order("ganho_em", { ascending: false })
      .order("cliente_id", { ascending: true })
      .range(1, 1)
    expect(pagina1.error).toBeNull()
    expect((pagina1.data ?? []).length).toBe(1)

    const idsPaginados = [
      ...((pagina0.data ?? []) as GanhoRow[]),
      ...((pagina1.data ?? []) as GanhoRow[]),
    ].map((r) => r.cliente_id)
    expect(new Set(idsPaginados)).toEqual(new Set([id1, id2]))
  })

  it("anonimo-sem-dados: sem login a leitura devolve erro ou zero linhas, nunca dados", async () => {
    const id = await seedGanhoPorTroca(vendedorA.id, "anonimo-sem-dados")

    const { data, error } = await anonClient().rpc("clientes_ganhos", {}).in("cliente_id", [id])
    if (error) {
      expect(error).not.toBeNull()
    } else {
      expect(data ?? []).toHaveLength(0)
    }
  })
})
