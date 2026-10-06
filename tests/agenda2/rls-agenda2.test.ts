import { afterAll, beforeAll, describe, expect, it } from "vitest"
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
 * Testes de integração da migration 0048 (Fase 31, Tarefa 2 — AGD2-01/03/
 * 04/05/07, D-16, D-19, correção 1 do 31-01-PLAN.md). Provam dono-escreve/
 * Supervisor-só-lê, isolamento entre vendedores, carimbos do servidor,
 * minimização LGPD, limites de tamanho e o comportamento de desativação —
 * contra o banco REAL (o projeto Supabase de teste É o de produção).
 *
 * NUNCA usa as contas semente antigas (vendedor.a+test/vendedor.b+test,
 * apagadas em 2026-08-19 — ver STATE.md): só fixtures descartáveis via
 * createTestMember/deleteTestMember. Este arquivo NUNCA imprime o
 * resultado de uma leitura no terminal, filtra TODA leitura do Supervisor
 * e do cliente anônimo pelos ids de fixture (nunca baixa itens reais de
 * outros vendedores) e usa só nomes inventados (LGPD). Exatamente duas
 * autenticações no arquivo inteiro (Vendedor A e Supervisor) — Vendedor B
 * nunca faz login; os itens dele são semeados/conferidos pelo cliente de
 * serviço.
 *
 * Fica VERMELHO (tabela agenda2_itens inexistente) até o plano 31-03
 * aplicar a migration 0048 no projeto hospedado — mesmo padrão de
 * tests/funil/encerrados-rpc.test.ts / tests/funil/perdidos-rpc.test.ts.
 */

type Agenda2ItemRow = {
  id: string
  vendedor_id: string
  nome_cliente: string
  bairro: string
  data: string
  concluido: boolean
  criado_em: string
  atualizado_em: string
}

let vendedorA: TestMember
let vendedorB: TestMember
let supervisor: TestMember
let clientA: SupabaseClient
let supervisorClient: SupabaseClient

beforeAll(async () => {
  vendedorA = await createTestMember("vendedor", "agenda2-a")
  vendedorB = await createTestMember("vendedor", "agenda2-b")
  supervisor = await createTestMember("supervisor", "agenda2")
  clientA = await signInAs(vendedorA.email, vendedorA.password)
  supervisorClient = await signInAs(supervisor.email, supervisor.password)
})

afterAll(async () => {
  const idsFixture = [vendedorA.id, vendedorB.id, supervisor.id]

  // A cascata (vendedor_id ... on delete cascade) também apagaria, mas
  // limpar primeiro evita resíduo se a exclusão de usuário falhar.
  await serviceClient().from("agenda2_itens").delete().in("vendedor_id", idsFixture)

  // Recoloca A e B como ativos caso algum caso tenha falhado no meio
  // (vendedor-desativado-nao-escreve / desativado-continua-visivel).
  await serviceClient()
    .from("profiles")
    .update({ ativo: true })
    .in("id", [vendedorA.id, vendedorB.id])

  await deleteTestMember(vendedorA.id)
  await deleteTestMember(vendedorB.id)
  await deleteTestMember(supervisor.id)
})

/**
 * Nome inventado único — nunca o nome real de um cliente (LGPD).
 *
 * `Date.now()` sozinho é uma sequência de 13 dígitos corridos, que a
 * constraint `chk_agenda2_nome_cliente_sem_documento` (migration 0048)
 * recusa de propósito (parece CPF/CNPJ/telefone/CEP). Por isso o timestamp
 * é quebrado a cada 3 dígitos com um separador não-numérico — nunca forma
 * uma sequência de 8+ dígitos, mas continua único o bastante para a
 * fixture. O sufixo aleatório (6 caracteres base36) já fica abaixo do
 * limite de 8 por construção.
 */
function nomeInventado(label: string): string {
  const timestampQuebrado = Date.now().toString().replace(/(\d{3})(?=\d)/g, "$1x")
  const sufixo = `${timestampQuebrado}-${Math.random().toString(36).slice(2, 8)}`
  return `Teste Agenda2 ${label} ${sufixo}`
}

/** Dia corrente no fuso de São Paulo, no formato AAAA-MM-DD — nunca o
 * construtor de data a partir de texto cru (disciplina de fuso horário já
 * documentada em lib/agenda/itens.ts). */
function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** Semeia um item pelo cliente de serviço (ignora a RLS de propósito — só
 * para semear/conferir, nunca para afirmar o comportamento da RLS). */
async function seedItem(
  vendedorId: string,
  overrides: Partial<Pick<Agenda2ItemRow, "nome_cliente" | "bairro" | "data" | "concluido">> = {}
): Promise<Agenda2ItemRow> {
  const { data, error } = await serviceClient()
    .from("agenda2_itens")
    .insert({
      vendedor_id: vendedorId,
      nome_cliente: nomeInventado("seed"),
      bairro: "Bairro Teste",
      data: hojeSaoPaulo(),
      ...overrides,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`seedItem falhou: ${error.message}`)
  }
  return data as Agenda2ItemRow
}

async function lerPeloServico(itemId: string): Promise<Agenda2ItemRow | null> {
  const { data } = await serviceClient()
    .from("agenda2_itens")
    .select()
    .eq("id", itemId)
    .maybeSingle()
  return (data as Agenda2ItemRow | null) ?? null
}

describe("rls-agenda2: migration 0048 contra o banco real", () => {
  it("vendedor-cria-proprio", async () => {
    const nome = nomeInventado("cria-proprio")
    const { error } = await clientA.from("agenda2_itens").insert({
      vendedor_id: vendedorA.id,
      nome_cliente: nome,
      bairro: "Centro",
      data: hojeSaoPaulo(),
    })
    expect(error).toBeNull()

    const { data: linha } = await serviceClient()
      .from("agenda2_itens")
      .select()
      .eq("nome_cliente", nome)
      .maybeSingle()

    expect(linha).not.toBeNull()
    expect((linha as Agenda2ItemRow).vendedor_id).toBe(vendedorA.id)
    expect((linha as Agenda2ItemRow).concluido).toBe(false)
  })

  it("vendedor-nao-cria-para-outro", async () => {
    const nome = nomeInventado("nao-cria-para-outro")
    const { error } = await clientA.from("agenda2_itens").insert({
      vendedor_id: vendedorB.id,
      nome_cliente: nome,
      bairro: "Centro",
      data: hojeSaoPaulo(),
    })
    expect(error).not.toBeNull()

    const { data: linha } = await serviceClient()
      .from("agenda2_itens")
      .select("id")
      .eq("nome_cliente", nome)
      .maybeSingle()
    expect(linha).toBeNull()
  })

  it("carimbos-do-servidor", async () => {
    const nome = nomeInventado("carimbos")
    const { error } = await clientA.from("agenda2_itens").insert({
      vendedor_id: vendedorA.id,
      nome_cliente: nome,
      bairro: "Centro",
      data: hojeSaoPaulo(),
      criado_em: "2020-01-01T00:00:00Z",
    })
    expect(error).toBeNull()

    const { data: linha } = await serviceClient()
      .from("agenda2_itens")
      .select()
      .eq("nome_cliente", nome)
      .single()

    const criadoEmMs = new Date((linha as Agenda2ItemRow).criado_em).getTime()
    const diffMinutos = Math.abs(Date.now() - criadoEmMs) / 60000
    expect(diffMinutos).toBeLessThan(10)
  })

  it("lgpd-colunas-minimas", async () => {
    const item = await seedItem(vendedorA.id)
    const { data: linha } = await serviceClient()
      .from("agenda2_itens")
      .select("*")
      .eq("id", item.id)
      .single()

    // 10 colunas: as 8 da 0048 + o_que_fazer e o_que_foi_feito da 0051 (decisao do dono de 2026-10-06, quick 261006-ncy).
    expect(Object.keys(linha as object).sort()).toEqual([
      "atualizado_em",
      "bairro",
      "concluido",
      "criado_em",
      "data",
      "id",
      "nome_cliente",
      "o_que_fazer",
      "o_que_foi_feito",
      "vendedor_id",
    ])
  })

  it("limite-de-tamanho", async () => {
    const nome121 = "a".repeat(121)
    const bairro61 = "b".repeat(61)
    const nome120 = "c".repeat(120)
    const bairro60 = "d".repeat(60)
    const nomeSoEspacos = "    "

    const { error: errNome121 } = await clientA.from("agenda2_itens").insert({
      vendedor_id: vendedorA.id,
      nome_cliente: nome121,
      bairro: "Centro",
      data: hojeSaoPaulo(),
    })
    expect(errNome121).not.toBeNull()

    const { error: errBairro61 } = await clientA.from("agenda2_itens").insert({
      vendedor_id: vendedorA.id,
      nome_cliente: nomeInventado("bairro-61"),
      bairro: bairro61,
      data: hojeSaoPaulo(),
    })
    expect(errBairro61).not.toBeNull()

    const { error: errSoEspacos } = await clientA.from("agenda2_itens").insert({
      vendedor_id: vendedorA.id,
      nome_cliente: nomeSoEspacos,
      bairro: "Centro",
      data: hojeSaoPaulo(),
    })
    expect(errSoEspacos).not.toBeNull()

    const nomeValido = `${nomeInventado("limite-ok")}${nome120}`.slice(0, 120)
    const { error: errValido } = await clientA.from("agenda2_itens").insert({
      vendedor_id: vendedorA.id,
      nome_cliente: nomeValido,
      bairro: bairro60,
      data: hojeSaoPaulo(),
    })
    expect(errValido).toBeNull()
  })

  it("sem-sequencia-de-documento", async () => {
    const { error: errCpf } = await clientA.from("agenda2_itens").insert({
      vendedor_id: vendedorA.id,
      nome_cliente: "Cliente Teste 123.456.789-09",
      bairro: "Centro",
      data: hojeSaoPaulo(),
    })
    expect(errCpf).not.toBeNull()

    const { error: errCep } = await clientA.from("agenda2_itens").insert({
      vendedor_id: vendedorA.id,
      nome_cliente: nomeInventado("sem-doc-bairro"),
      bairro: "01310-100",
      data: hojeSaoPaulo(),
    })
    expect(errCep).not.toBeNull()

    const { error: errOk } = await clientA.from("agenda2_itens").insert({
      vendedor_id: vendedorA.id,
      nome_cliente: `${nomeInventado("padaria")} Padaria 2 Irmaos 1990`,
      bairro: "Centro",
      data: hojeSaoPaulo(),
    })
    expect(errOk).toBeNull()
  })

  it("vendedor-le-so-os-proprios", async () => {
    const itemA = await seedItem(vendedorA.id, { nome_cliente: nomeInventado("le-so-proprio-a") })
    const itemB = await seedItem(vendedorB.id, { nome_cliente: nomeInventado("le-so-proprio-b") })

    const { data: linhas } = await clientA
      .from("agenda2_itens")
      .select("id, vendedor_id")
      .in("id", [itemA.id, itemB.id])

    const idsRetornados = (linhas ?? []).map((l) => l.id)
    expect(idsRetornados).toContain(itemA.id)
    expect(idsRetornados).not.toContain(itemB.id)
  })

  it("vendedor-edita-proprio", async () => {
    const item = await seedItem(vendedorA.id)
    const novoNome = nomeInventado("edita-proprio")
    const novoBairro = "Bairro Editado"
    const novaData = hojeSaoPaulo()

    const { error } = await clientA
      .from("agenda2_itens")
      .update({ nome_cliente: novoNome, bairro: novoBairro, data: novaData })
      .eq("id", item.id)
    expect(error).toBeNull()

    const atualizado = await lerPeloServico(item.id)
    expect(atualizado?.nome_cliente).toBe(novoNome)
    expect(atualizado?.bairro).toBe(novoBairro)
    expect(atualizado?.criado_em).toBe(item.criado_em)
    expect(new Date(atualizado!.atualizado_em).getTime()).toBeGreaterThanOrEqual(
      new Date(item.atualizado_em).getTime()
    )
  })

  it("vendedor-nao-transfere-item", async () => {
    const item = await seedItem(vendedorA.id)

    const { data: alteradas, error } = await clientA
      .from("agenda2_itens")
      .update({ vendedor_id: vendedorB.id })
      .eq("id", item.id)
      .select("id")

    const bloqueado = Boolean(error) || (alteradas ?? []).length === 0
    expect(bloqueado).toBe(true)

    const atual = await lerPeloServico(item.id)
    expect(atual?.vendedor_id).toBe(vendedorA.id)
  })

  it("vendedor-conclui-e-desmarca", async () => {
    const item = await seedItem(vendedorA.id)

    const { error: errConcluir } = await clientA
      .from("agenda2_itens")
      .update({ concluido: true })
      .eq("id", item.id)
    expect(errConcluir).toBeNull()
    expect((await lerPeloServico(item.id))?.concluido).toBe(true)

    const { error: errDesmarcar } = await clientA
      .from("agenda2_itens")
      .update({ concluido: false })
      .eq("id", item.id)
    expect(errDesmarcar).toBeNull()
    expect((await lerPeloServico(item.id))?.concluido).toBe(false)
  })

  it("vendedor-nao-edita-alheio", async () => {
    const itemB = await seedItem(vendedorB.id, { nome_cliente: nomeInventado("alheio-edita") })
    const nomeTentativa = nomeInventado("tentativa-edicao-alheia")

    const { data: alteradas } = await clientA
      .from("agenda2_itens")
      .update({ nome_cliente: nomeTentativa })
      .eq("id", itemB.id)
      .select("id")
    expect(alteradas ?? []).toHaveLength(0)

    const atual = await lerPeloServico(itemB.id)
    expect(atual?.nome_cliente).toBe(itemB.nome_cliente)
  })

  it("vendedor-nao-apaga-alheio", async () => {
    const itemB = await seedItem(vendedorB.id, { nome_cliente: nomeInventado("alheio-apaga") })

    await clientA.from("agenda2_itens").delete().eq("id", itemB.id)

    const atual = await lerPeloServico(itemB.id)
    expect(atual).not.toBeNull()
  })

  it("vendedor-apaga-proprio", async () => {
    const item = await seedItem(vendedorA.id)

    const { error } = await clientA.from("agenda2_itens").delete().eq("id", item.id)
    expect(error).toBeNull()

    const atual = await lerPeloServico(item.id)
    expect(atual).toBeNull()
  })

  it("supervisor-le-o-time", async () => {
    const itemA = await seedItem(vendedorA.id, { nome_cliente: nomeInventado("supervisor-le-a") })
    const itemB = await seedItem(vendedorB.id, { nome_cliente: nomeInventado("supervisor-le-b") })

    const { data: linhas } = await supervisorClient
      .from("agenda2_itens")
      .select("id, vendedor_id")
      .in("id", [itemA.id, itemB.id])

    const idsRetornados = (linhas ?? []).map((l) => l.id)
    expect(idsRetornados).toContain(itemA.id)
    expect(idsRetornados).toContain(itemB.id)
  })

  it("supervisor-nao-cria", async () => {
    const { error: errParaSiMesmo } = await supervisorClient.from("agenda2_itens").insert({
      vendedor_id: supervisor.id,
      nome_cliente: nomeInventado("supervisor-cria-si"),
      bairro: "Centro",
      data: hojeSaoPaulo(),
    })
    expect(errParaSiMesmo).not.toBeNull()

    const { error: errParaA } = await supervisorClient.from("agenda2_itens").insert({
      vendedor_id: vendedorA.id,
      nome_cliente: nomeInventado("supervisor-cria-a"),
      bairro: "Centro",
      data: hojeSaoPaulo(),
    })
    expect(errParaA).not.toBeNull()
  })

  it("supervisor-nao-edita", async () => {
    const item = await seedItem(vendedorA.id, { nome_cliente: nomeInventado("supervisor-nao-edita") })

    const { data: alteradas } = await supervisorClient
      .from("agenda2_itens")
      .update({ nome_cliente: nomeInventado("supervisor-tentou-editar"), concluido: true })
      .eq("id", item.id)
      .select("id")
    expect(alteradas ?? []).toHaveLength(0)

    const atual = await lerPeloServico(item.id)
    expect(atual?.nome_cliente).toBe(item.nome_cliente)
    expect(atual?.concluido).toBe(false)
  })

  it("supervisor-nao-apaga", async () => {
    const itemB = await seedItem(vendedorB.id, { nome_cliente: nomeInventado("supervisor-nao-apaga") })

    await supervisorClient.from("agenda2_itens").delete().eq("id", itemB.id)

    const atual = await lerPeloServico(itemB.id)
    expect(atual).not.toBeNull()
  })

  it("desativado-continua-visivel", async () => {
    await serviceClient().from("profiles").update({ ativo: false }).eq("id", vendedorB.id)

    try {
      const itemB = await seedItem(vendedorB.id, {
        nome_cliente: nomeInventado("desativado-continua-visivel"),
      })

      const { data: linhas } = await supervisorClient
        .from("agenda2_itens")
        .select("id, vendedor_id")
        .eq("id", itemB.id)

      expect((linhas ?? []).map((l) => l.id)).toContain(itemB.id)
    } finally {
      await serviceClient().from("profiles").update({ ativo: true }).eq("id", vendedorB.id)
    }
  })

  it("vendedor-desativado-nao-escreve", async () => {
    const item = await seedItem(vendedorA.id, {
      nome_cliente: nomeInventado("desativado-nao-escreve-base"),
    })

    await serviceClient().from("profiles").update({ ativo: false }).eq("id", vendedorA.id)

    try {
      const { error: errInsert } = await clientA.from("agenda2_itens").insert({
        vendedor_id: vendedorA.id,
        nome_cliente: nomeInventado("desativado-nao-escreve-insert"),
        bairro: "Centro",
        data: hojeSaoPaulo(),
      })
      expect(errInsert).not.toBeNull()

      const nomeTentativa = nomeInventado("desativado-nao-escreve-update")
      const { data: alteradas } = await clientA
        .from("agenda2_itens")
        .update({ nome_cliente: nomeTentativa })
        .eq("id", item.id)
        .select("id")
      expect(alteradas ?? []).toHaveLength(0)

      const atual = await lerPeloServico(item.id)
      expect(atual?.nome_cliente).toBe(item.nome_cliente)
    } finally {
      // A volta a ativo no fim do caso.
      await serviceClient().from("profiles").update({ ativo: true }).eq("id", vendedorA.id)
    }
  })

  it("anonimo-sem-acesso", async () => {
    const itemA = await seedItem(vendedorA.id, { nome_cliente: nomeInventado("anonimo-a") })
    const itemB = await seedItem(vendedorB.id, { nome_cliente: nomeInventado("anonimo-b") })

    const anon = anonClient()
    const { data: linhas } = await anon
      .from("agenda2_itens")
      .select("id")
      .in("id", [itemA.id, itemB.id])
    expect(linhas ?? []).toHaveLength(0)

    const { error: errInsert } = await anon.from("agenda2_itens").insert({
      vendedor_id: vendedorA.id,
      nome_cliente: nomeInventado("anonimo-insert"),
      bairro: "Centro",
      data: hojeSaoPaulo(),
    })
    expect(errInsert).not.toBeNull()
  })
})
