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
 * Testes ao vivo da coluna clientes.ganho_em, do gatilho que a preenche e da
 * leitura clientes_ganhos (migration 0053 REESCRITA, quick 261008-rxw): quais
 * clientes estao ganhos hoje, a data real do ganho e o vendedor. Prova a RLS
 * (Vendedor so os proprios, Supervisor todos), o preenchimento automatico (so
 * na troca de status, nunca sobrescreve), a edicao da data por quem ja edita a
 * ficha, o recorte de periodo em data de Sao Paulo (cliente sem data so aparece
 * sem recorte), a ordem (data mais recente primeiro, sem data por ultimo), a
 * paginacao e as 6 colunas minimas (LGPD).
 *
 * O projeto Supabase de teste E o de producao, com dados reais de clientes.
 * Por isso este arquivo: usa so fixtures descartaveis (membros criados e
 * apagados aqui, nunca as contas semente antigas); NUNCA imprime linha lida do
 * banco no terminal; filtra TODA leitura da funcao, de qualquer sessao, pelos
 * ids de fixture no proprio PostgREST (nunca baixa a carteira real); usa so
 * razoes sociais, nomes fantasia e CNPJs inventados; nunca le nem grava a
 * tabela de registro de acesso diario da aderencia; e troca todo status pelo
 * cliente de servico (autor nulo no historico, entao nada conta na aderencia
 * de ninguem).
 *
 * Duas autenticacoes no arquivo inteiro: Vendedor A e Supervisor. Vendedor B
 * nunca faz login - os ganhos dele sao semeados pelo cliente de servico (rate
 * limit conhecido de login por senha).
 *
 * O gatilho e BEFORE UPDATE e nunca roda em INSERT. Por isso ha dois
 * semeadores: seedGanhoDireto (INSERT ja ganho, com ganho_em exatamente igual
 * ao informado, inclusive nulo) para todo caso que precisa de data conhecida
 * ou vazia; e seedGanhoPorTroca (INSERT em andamento e UPDATE separado para
 * ganho) so nos casos que provam o gatilho.
 *
 * O preenchimento unico pelo historico (backfill) roda so na aplicacao e NAO e
 * testavel ao vivo com fixtures criadas depois: ele e provado pelo teste
 * estrutural e o dono confere com uma contagem.
 *
 * Fica VERMELHO (coluna e funcao inexistentes no banco) ate o dono aplicar a
 * 0053 pelo SQL Editor. Esse vermelho e esperado e NAO foi medido na tarefa de
 * construcao: este arquivo so roda depois da aplicacao (Tarefa 6/7) - mesmo
 * procedimento da quick 261006-ncy.
 */

type GanhoRow = {
  cliente_id: string
  razao_social: string | null
  nome_fantasia: string | null
  ganho_em: string | null
  responsavel: string
  responsavel_nome: string | null
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

/** Hoje em Sao Paulo, no formato AAAA-MM-DD. */
function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
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

/** INSERT ja ganho (etapa primeira_venda) com ganho_em exatamente igual ao
 * argumento (nulo grava nulo). O gatilho e so de UPDATE, entao nada altera o
 * valor informado. */
async function seedGanhoDireto(
  responsavelId: string,
  label: string,
  ganhoEm: string | null
): Promise<string> {
  return seedCliente(responsavelId, label, {
    etapa: "primeira_venda",
    status_acompanhamento: "ganho",
    ganho_em: ganhoEm,
  })
}

/** INSERT em primeira_venda/em_andamento e UPDATE separado para ganho - e esse
 * UPDATE que aciona o gatilho de preenchimento. Usado so nos casos que provam
 * o gatilho. */
async function seedGanhoPorTroca(responsavelId: string, label: string): Promise<string> {
  const id = await seedCliente(responsavelId, label, {
    etapa: "primeira_venda",
    status_acompanhamento: "em_andamento",
  })
  await atualizarCliente(id, { status_acompanhamento: "ganho" })
  return id
}

/** Relê ganho_em pelo cliente de servico. */
async function ganhoEmDe(clienteId: string): Promise<string | null> {
  const { data, error } = await serviceClient()
    .from("clientes")
    .select("ganho_em")
    .eq("id", clienteId)
    .single()
  if (error || !data) throw new Error(`Falha ao ler ganho_em: ${error?.message}`)
  return (data as { ganho_em: string | null }).ganho_em
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

describe("clientes_ganhos e ganho_em (0053 reescrita, quick 261008-rxw)", () => {
  it("colunas-lgpd: as chaves de cada linha sao exatamente as 6 colunas combinadas, sem dado de contato", async () => {
    const id = await seedGanhoDireto(vendedorA.id, "colunas-lgpd", "2025-02-01")

    const linhas = await lerGanhos(clientA, [id])
    expect(linhas.length).toBe(1)
    expect(Object.keys(linhas[0]).sort()).toEqual([...COLUNAS_ESPERADAS].sort())
  })

  it("rls-vendedor: A recebe so o proprio ganho, nunca o de B", async () => {
    const idA = await seedGanhoDireto(vendedorA.id, "rls-vendedor-a", "2025-03-01")
    const idB = await seedGanhoDireto(vendedorB.id, "rls-vendedor-b", "2025-03-02")

    const linhas = await lerGanhos(clientA, [idA, idB])
    const ids = linhas.map((r) => r.cliente_id)
    expect(ids).toContain(idA)
    expect(ids).not.toContain(idB)
  })

  it("rls-supervisor: o Supervisor recebe os ganhos de A e de B, com o nome do vendedor", async () => {
    const idA = await seedGanhoDireto(vendedorA.id, "rls-supervisor-a", "2025-03-01")
    const idB = await seedGanhoDireto(vendedorB.id, "rls-supervisor-b", "2025-03-02")

    const linhas = await lerGanhos(supervisorClient, [idA, idB])
    const ids = linhas.map((r) => r.cliente_id)
    expect(ids).toContain(idA)
    expect(ids).toContain(idB)

    const linhaA = linhas.find((r) => r.cliente_id === idA)
    expect(linhaA!.responsavel).toBe(vendedorA.id)
    expect(linhaA!.responsavel_nome).toBe(`${vendedorA.nome} ${vendedorA.sobrenome}`)
  })

  it("gatilho-preenche-ao-ganhar: ao virar ganho, ganho_em recebe a data de hoje em Sao Paulo", async () => {
    const antes = hojeSaoPaulo()
    const id = await seedGanhoPorTroca(vendedorA.id, "gatilho-preenche")
    const depois = hojeSaoPaulo()

    const ganhoEm = await ganhoEmDe(id)
    expect([antes, depois]).toContain(ganhoEm)

    const linhas = await lerGanhos(clientA, [id])
    expect(linhas.length).toBe(1)
    expect(linhas[0].ganho_em).toBe(ganhoEm)
  })

  it("gatilho-nao-sobrescreve: uma data ja existente nunca e trocada ao reativar o cliente", async () => {
    const id = await seedGanhoPorTroca(vendedorA.id, "gatilho-nao-sobrescreve")
    await atualizarCliente(id, { ganho_em: "2025-03-15" })
    await atualizarCliente(id, {
      status_acompanhamento: "encerrado",
      motivo_encerramento_id: motivoEncerramentoId,
    })
    await atualizarCliente(id, { status_acompanhamento: "ganho" })

    expect(await ganhoEmDe(id)).toBe("2025-03-15")
  })

  it("gatilho-so-na-troca: INSERT ja ganho e edicao sem trocar o status nao preenchem a data", async () => {
    const id = await seedGanhoDireto(vendedorA.id, "gatilho-so-na-troca", null)
    expect(await ganhoEmDe(id)).toBeNull()

    await atualizarCliente(id, { observacao: "Observacao inventada para o teste de Ganhos" })
    expect(await ganhoEmDe(id)).toBeNull()

    const linhas = await lerGanhos(clientA, [id])
    expect(linhas.length).toBe(1)
    expect(linhas[0].ganho_em).toBeNull()
  })

  it("sem-data-so-em-tudo: cliente sem data aparece sem recorte e some de qualquer periodo", async () => {
    const id = await seedGanhoDireto(vendedorA.id, "sem-data-so-em-tudo", null)

    const tudo = await lerGanhos(clientA, [id])
    expect(tudo.map((r) => r.cliente_id)).toContain(id)

    const ultimos30 = await lerGanhos(clientA, [id], {
      p_inicio: new Date(Date.now() - 30 * DIA_MS).toISOString(),
    })
    expect(ultimos30.map((r) => r.cliente_id)).not.toContain(id)

    const personalizadoAmplo = await lerGanhos(clientA, [id], {
      p_inicio: "1990-01-01T03:00:00Z",
      p_fim: "2100-01-01T03:00:00Z",
    })
    expect(personalizadoAmplo.map((r) => r.cliente_id)).not.toContain(id)
  })

  it("edicao-supervisor-persiste: o Supervisor corrige a data de qualquer cliente ganho", async () => {
    const idB = await seedGanhoDireto(vendedorB.id, "edicao-supervisor", null)

    const { data, error } = await supervisorClient
      .from("clientes")
      .update({ ganho_em: "2024-05-20" })
      .eq("id", idB)
      .select("id")
    expect(error).toBeNull()
    expect((data ?? []).length).toBe(1)
    expect(await ganhoEmDe(idB)).toBe("2024-05-20")

    const maio = await lerGanhos(supervisorClient, [idB], {
      p_inicio: "2024-05-01T03:00:00Z",
      p_fim: "2024-06-01T03:00:00Z",
    })
    expect(maio.map((r) => r.cliente_id)).toContain(idB)
  })

  it("edicao-vendedor-so-proprio: o Vendedor corrige a data do proprio cliente e nao consegue mexer na de outro", async () => {
    const idA = await seedGanhoDireto(vendedorA.id, "edicao-vendedor-a", "2022-01-10")
    const idB = await seedGanhoDireto(vendedorB.id, "edicao-vendedor-b", "2022-02-10")

    const proprio = await clientA
      .from("clientes")
      .update({ ganho_em: "2023-11-30" })
      .eq("id", idA)
      .select("id")
    expect(proprio.error).toBeNull()
    expect((proprio.data ?? []).length).toBe(1)
    expect(await ganhoEmDe(idA)).toBe("2023-11-30")

    const alheio = await clientA
      .from("clientes")
      .update({ ganho_em: "2023-11-30" })
      .eq("id", idB)
      .select("id")
    expect((alheio.data ?? []).length).toBe(0)
    expect(await ganhoEmDe(idB)).toBe("2022-02-10")
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
    const idGanho = await seedGanhoDireto(vendedorA.id, "so-ganho-atual-ganho", "2025-04-01")

    const linhas = await lerGanhos(clientA, [idAndamento, idPerdido, idEncerrado, idGanho])
    expect(linhas.map((r) => r.cliente_id)).toEqual([idGanho])
  })

  it("periodo-limites: o periodo vale em data de Sao Paulo, com inicio inclusivo e fim exclusivo", async () => {
    const id = await seedGanhoDireto(vendedorA.id, "periodo-limites", "2026-01-31")

    const dentro = await lerGanhos(clientA, [id], {
      p_inicio: "2026-01-31T03:00:00Z",
      p_fim: "2026-02-01T03:00:00Z",
    })
    expect(dentro.map((r) => r.cliente_id)).toContain(id)

    const fimExclusivo = await lerGanhos(clientA, [id], {
      p_inicio: null,
      p_fim: "2026-01-31T03:00:00Z",
    })
    expect(fimExclusivo.map((r) => r.cliente_id)).not.toContain(id)

    const comecaDepois = await lerGanhos(clientA, [id], {
      p_inicio: "2026-02-01T03:00:00Z",
      p_fim: null,
    })
    expect(comecaDepois.map((r) => r.cliente_id)).not.toContain(id)
  })

  it("ordem-nulos-por-ultimo: data mais recente primeiro, sem data por ultimo, e a paginacao nao repete linhas", async () => {
    const idRecente = await seedGanhoDireto(vendedorA.id, "ordem-recente", "2025-06-10")
    const idAntigo = await seedGanhoDireto(vendedorA.id, "ordem-antigo", "2025-01-10")
    const idSemData = await seedGanhoDireto(vendedorA.id, "ordem-sem-data", null)
    const ids = [idRecente, idAntigo, idSemData]

    const linhas = await lerGanhos(clientA, ids)
    expect(linhas.map((r) => r.cliente_id)).toEqual([idRecente, idAntigo, idSemData])

    const paginados: string[] = []
    for (const posicao of [0, 1, 2]) {
      const pagina = await clientA
        .rpc("clientes_ganhos", {})
        .in("cliente_id", ids)
        .order("ganho_em", { ascending: false, nullsFirst: false })
        .order("cliente_id", { ascending: true })
        .range(posicao, posicao)
      expect(pagina.error).toBeNull()
      expect((pagina.data ?? []).length).toBe(1)
      paginados.push((pagina.data as GanhoRow[])[0].cliente_id)
    }
    expect(paginados).toEqual([idRecente, idAntigo, idSemData])
  })

  it("anonimo-sem-dados: sem login a leitura devolve erro ou zero linhas, nunca dados", async () => {
    const id = await seedGanhoDireto(vendedorA.id, "anonimo-sem-dados", "2025-02-01")

    const { data, error } = await anonClient().rpc("clientes_ganhos", {}).in("cliente_id", [id])
    if (error) {
      expect(error).not.toBeNull()
    } else {
      expect(data ?? []).toHaveLength(0)
    }
  })
})
