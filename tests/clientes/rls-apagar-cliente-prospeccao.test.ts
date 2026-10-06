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
 * Testes de integração da migration 0050 (quick task 261006-gvo): a policy de
 * DELETE de clientes deixa o Vendedor ATIVO apagar só os PRÓPRIOS clientes
 * "em andamento" e o Supervisor apagar qualquer um. Provam a regra contra o
 * banco REAL (o projeto Supabase de teste É o de produção).
 *
 * Fica VERMELHO até o dono aplicar a 0050 no projeto hospedado: antes disso a
 * policy antiga é "somente supervisor apaga clientes" e o caso positivo do
 * Vendedor (vendedor-apaga-proprio-em-andamento-com-cascata) falha.
 *
 * NUNCA usa as contas semente antigas (apagadas — ver STATE.md): só
 * fixtures descartáveis via createTestMember/deleteTestMember. Exatamente duas
 * autenticações no arquivo inteiro (Vendedor A e Supervisor) — Vendedor B nunca
 * faz login e o anônimo usa o cliente sem login. Este arquivo NUNCA imprime
 * nada; toda leitura de conferência é feita pelo cliente de serviço filtrando
 * pelos ids de fixture (nunca baixa dado real) e só usa nomes inventados
 * (LGPD): sem CNPJ, endereço, telefone, e-mail ou contato.
 */

let vendedorA: TestMember
let vendedorB: TestMember
let supervisor: TestMember
let clientA: SupabaseClient
let supervisorClient: SupabaseClient
let motivoPerdaId: string
let motivoEncerramentoId: string
let tipoTarefaId: string
let produtoId: string

/** Todo id semeado, apagado pelo cliente de serviço no afterEach. */
const idsSemeados: string[] = []

async function primeiroId(tabela: string, apenasAtivos: boolean): Promise<string> {
  let consulta = serviceClient().from(tabela).select("id")
  if (apenasAtivos) consulta = consulta.eq("ativo", true)
  const { data, error } = await consulta.limit(1)
  if (error || !data || data.length === 0) {
    throw new Error(`Nenhuma linha disponivel em ${tabela} para o teste`)
  }
  return (data[0] as { id: string }).id
}

beforeAll(async () => {
  vendedorA = await createTestMember("vendedor", "apaga-a")
  vendedorB = await createTestMember("vendedor", "apaga-b")
  supervisor = await createTestMember("supervisor", "apaga")
  clientA = await signInAs(vendedorA.email, vendedorA.password)
  supervisorClient = await signInAs(supervisor.email, supervisor.password)

  motivoPerdaId = await primeiroId("motivos_perda", false)
  motivoEncerramentoId = await primeiroId("motivos_encerramento", true)
  tipoTarefaId = await primeiroId("tipos_tarefa", true)
  produtoId = await primeiroId("produtos_consumidos", false)
})

afterEach(async () => {
  if (idsSemeados.length === 0) return
  await serviceClient().from("clientes").delete().in("id", idsSemeados.splice(0))
})

afterAll(async () => {
  const idsMembros = [vendedorA.id, vendedorB.id, supervisor.id]

  // Recoloca A e B como ativos caso algum caso tenha falhado no meio
  // (vendedor-desativado-nao-apaga).
  await serviceClient().from("profiles").update({ ativo: true }).in("id", [vendedorA.id, vendedorB.id])

  // Ordem obrigatória: clientes primeiro (responsavel e visitas.criado_por
  // não têm ON DELETE; a cascata leva as visitas), membros depois.
  await serviceClient().from("clientes").delete().in("responsavel", idsMembros)

  await deleteTestMember(vendedorA.id)
  await deleteTestMember(vendedorB.id)
  await deleteTestMember(supervisor.id)
})

/**
 * Nome inventado único — nunca o nome real de um cliente (LGPD). O timestamp é
 * quebrado a cada 3 dígitos com um separador não-numérico, para nunca formar
 * uma sequência de 8+ dígitos; o sufixo base36 de 6 caracteres já fica abaixo
 * do limite por construção.
 */
function nomeInventado(rotulo: string): string {
  const timestampQuebrado = Date.now().toString().replace(/(\d{3})(?=\d)/g, "$1x")
  const sufixo = `${timestampQuebrado}-${Math.random().toString(36).slice(2, 8)}`
  return `Teste Apagar Prospeccao ${rotulo} ${sufixo}`
}

/** Dia corrente no fuso de São Paulo, AAAA-MM-DD. */
function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

type Situacao = "em_andamento" | "ganho" | "perdido" | "encerrado"

/** Semeia um cliente pelo cliente de serviço (ignora a RLS de propósito — só
 * para semear/conferir, nunca para afirmar o comportamento da RLS). Mínimo de
 * campos (minimização): razão social inventada, responsável e, conforme o
 * caso, etapa/status/motivo. */
async function semearCliente(
  responsavelId: string,
  rotulo: string,
  situacao: Situacao = "em_andamento"
): Promise<string> {
  const campos: Record<string, unknown> = {
    razao_social: nomeInventado(rotulo),
    responsavel: responsavelId,
  }
  if (situacao === "ganho") {
    campos.etapa = "primeira_venda"
    campos.status_acompanhamento = "ganho"
  } else if (situacao === "perdido") {
    campos.status_acompanhamento = "perdido"
    campos.motivo_perda_id = motivoPerdaId
  } else if (situacao === "encerrado") {
    campos.etapa = "primeira_venda"
    campos.status_acompanhamento = "encerrado"
    campos.motivo_encerramento_id = motivoEncerramentoId
  }

  const { data, error } = await serviceClient().from("clientes").insert(campos).select("id").single()
  if (error || !data) {
    throw new Error(`Falha ao semear cliente: ${error?.message}`)
  }
  const id = (data as { id: string }).id
  idsSemeados.push(id)
  return id
}

/** True se o cliente ainda existe (conferência pelo serviço, só por id). */
async function aindaExiste(id: string): Promise<boolean> {
  const { data } = await serviceClient().from("clientes").select("id").eq("id", id).maybeSingle()
  return data !== null
}

/** Conta linhas de uma tabela filha do cliente (head + count exato). */
async function contaFilhas(tabela: string, clienteId: string): Promise<number> {
  const { count, error } = await serviceClient()
    .from(tabela)
    .select("*", { count: "exact", head: true })
    .eq("cliente_id", clienteId)
  if (error) throw new Error(`Falha ao contar ${tabela}: ${error.message}`)
  return count ?? 0
}

describe("rls-apagar-cliente-prospeccao: migration 0050 contra o banco real", () => {
  it("vendedor-apaga-proprio-em-andamento-com-cascata", async () => {
    const id = await semearCliente(vendedorA.id, "proprio")

    const servico = serviceClient()
    const { error: erroTarefa } = await servico
      .from("tarefas")
      .insert({ cliente_id: id, tipo_tarefa_id: tipoTarefaId })
    expect(erroTarefa).toBeNull()
    const { error: erroVisita } = await servico
      .from("visitas")
      .insert({ cliente_id: id, data_prevista: hojeSaoPaulo(), criado_por: vendedorA.id })
    expect(erroVisita).toBeNull()
    const { error: erroProduto } = await servico
      .from("cliente_produtos")
      .insert({ cliente_id: id, produto_id: produtoId })
    expect(erroProduto).toBeNull()
    const { error: erroHistorico } = await servico
      .from("historico")
      .insert({ cliente_id: id, tipo: "teste", descricao: "Registro de teste", autor_id: null })
    expect(erroHistorico).toBeNull()

    const { data, error } = await clientA.from("clientes").delete().eq("id", id).select("id")
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)

    expect(await aindaExiste(id)).toBe(false)
    expect(await contaFilhas("tarefas", id)).toBe(0)
    expect(await contaFilhas("visitas", id)).toBe(0)
    expect(await contaFilhas("cliente_produtos", id)).toBe(0)
    expect(await contaFilhas("historico", id)).toBe(0)
  })

  it("vendedor-nao-apaga-cliente-de-outro-vendedor", async () => {
    const id = await semearCliente(vendedorB.id, "de-outro")

    const { data, error } = await clientA.from("clientes").delete().eq("id", id).select("id")
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
    expect(await aindaExiste(id)).toBe(true)
  })

  it("vendedor-nao-apaga-proprio-ganho", async () => {
    const id = await semearCliente(vendedorA.id, "ganho", "ganho")

    const { data, error } = await clientA.from("clientes").delete().eq("id", id).select("id")
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
    expect(await aindaExiste(id)).toBe(true)
  })

  it("vendedor-nao-apaga-proprio-perdido", async () => {
    const id = await semearCliente(vendedorA.id, "perdido", "perdido")

    const { data, error } = await clientA.from("clientes").delete().eq("id", id).select("id")
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
    expect(await aindaExiste(id)).toBe(true)
  })

  it("vendedor-nao-apaga-proprio-encerrado", async () => {
    const id = await semearCliente(vendedorA.id, "encerrado", "encerrado")

    const { data, error } = await clientA.from("clientes").delete().eq("id", id).select("id")
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
    expect(await aindaExiste(id)).toBe(true)
  })

  it("vendedor-desativado-nao-apaga", async () => {
    const id = await semearCliente(vendedorA.id, "desativado")

    try {
      const { error: erroDesativar } = await serviceClient()
        .from("profiles")
        .update({ ativo: false })
        .eq("id", vendedorA.id)
      expect(erroDesativar).toBeNull()

      // Sessão de A ainda válida: a decisão é só da policy.
      const { data, error } = await clientA.from("clientes").delete().eq("id", id).select("id")
      expect(error).toBeNull()
      expect(data ?? []).toHaveLength(0)
      expect(await aindaExiste(id)).toBe(true)
    } finally {
      await serviceClient().from("profiles").update({ ativo: true }).eq("id", vendedorA.id)
    }
  })

  it("supervisor-apaga-qualquer-status-e-dono", async () => {
    const ids = [
      await semearCliente(vendedorB.id, "sup-andamento"),
      await semearCliente(vendedorB.id, "sup-ganho", "ganho"),
      await semearCliente(vendedorB.id, "sup-perdido", "perdido"),
      await semearCliente(vendedorA.id, "sup-encerrado", "encerrado"),
    ]

    const { data, error } = await supervisorClient.from("clientes").delete().in("id", ids).select("id")
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(4)

    for (const id of ids) {
      expect(await aindaExiste(id)).toBe(false)
    }
  })

  it("anonimo-nao-apaga", async () => {
    const id = await semearCliente(vendedorA.id, "anonimo")

    // Aceita erro ou lista vazia; nunca uma linha apagada.
    const { data } = await anonClient().from("clientes").delete().eq("id", id).select("id")
    expect(data ?? []).toHaveLength(0)
    expect(await aindaExiste(id)).toBe(true)
  })
})
