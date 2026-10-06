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
 * Testes de integracao da migration 0051 (quick task 261006-ncy): as duas
 * colunas de texto livre opcionais da Agenda (o_que_fazer e o_que_foi_feito)
 * contra o banco REAL (o projeto Supabase de teste E o de producao).
 *
 * Fica VERMELHO ate o dono aplicar a 0051 no projeto hospedado (SQL Editor)
 * — mesmo padrao dos testes ao vivo das fases anteriores.
 *
 * So usa fixtures descartaveis via createTestMember/deleteTestMember (nunca as
 * contas semente antigas). Exatamente duas autenticacoes no arquivo inteiro
 * (Vendedor A e Supervisor): o Vendedor B nunca faz login (os itens dele sao
 * semeados e conferidos pelo cliente de servico) e o anonimo usa o cliente sem
 * login. Nunca imprime nada; toda leitura de conferencia e pelo cliente de
 * servico filtrando pelos ids de fixture. Nomes e textos inventados (LGPD).
 */

type TextosRow = {
  id: string
  concluido: boolean
  o_que_fazer: string | null
  o_que_foi_feito: string | null
}

const TEXTO_PLANO = "Teste levar amostras"
const TEXTO_RESULTADO = "Teste pedido combinado"
const LIMITE = 500

let vendedorA: TestMember
let vendedorB: TestMember
let supervisor: TestMember
let clientA: SupabaseClient
let supervisorClient: SupabaseClient

beforeAll(async () => {
  vendedorA = await createTestMember("vendedor", "obs-a")
  vendedorB = await createTestMember("vendedor", "obs-b")
  supervisor = await createTestMember("supervisor", "obs")
  clientA = await signInAs(vendedorA.email, vendedorA.password)
  supervisorClient = await signInAs(supervisor.email, supervisor.password)
})

afterAll(async () => {
  const idsFixture = [vendedorA.id, vendedorB.id, supervisor.id]

  // A cascata tambem apagaria, mas limpar primeiro evita residuo se a
  // exclusao de usuario falhar.
  await serviceClient().from("agenda2_itens").delete().in("vendedor_id", idsFixture)

  await deleteTestMember(vendedorA.id)
  await deleteTestMember(vendedorB.id)
  await deleteTestMember(supervisor.id)
})

/**
 * Nome inventado unico — nunca o nome real de um cliente (LGPD). O timestamp
 * e quebrado a cada 3 digitos com a letra x para nunca formar uma sequencia
 * de 8+ digitos (a constraint do nome recusa isso de proposito).
 */
function nomeInventado(label: string): string {
  const timestampQuebrado = Date.now().toString().replace(/(\d{3})(?=\d)/g, "$1x")
  const sufixo = `${timestampQuebrado}-${Math.random().toString(36).slice(2, 8)}`
  return `Teste Agenda2 ${label} ${sufixo}`
}

/** Dia corrente no fuso de Sao Paulo, no formato AAAA-MM-DD. */
function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** Linha base valida para o dono inserir pela propria sessao. */
function linhaBase(
  vendedorId: string,
  label: string,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    vendedor_id: vendedorId,
    nome_cliente: nomeInventado(label),
    bairro: "Bairro Teste",
    data: hojeSaoPaulo(),
    ...extras,
  }
}

/** Semeia um item pelo cliente de servico (ignora a RLS de proposito — so
 * para semear/conferir, nunca para afirmar o comportamento da RLS). */
async function seedItem(
  vendedorId: string,
  textos: { o_que_fazer?: string | null; o_que_foi_feito?: string | null } = {}
): Promise<string> {
  const { data, error } = await serviceClient()
    .from("agenda2_itens")
    .insert(linhaBase(vendedorId, "seed", textos))
    .select("id")
    .single()

  if (error) {
    throw new Error(`seedItem falhou: ${error.message}`)
  }
  return (data as { id: string }).id
}

async function lerTextosPeloServico(itemId: string): Promise<TextosRow | null> {
  const { data } = await serviceClient()
    .from("agenda2_itens")
    .select("id, concluido, o_que_fazer, o_que_foi_feito")
    .eq("id", itemId)
    .maybeSingle()
  return (data as TextosRow | null) ?? null
}

describe("rls-agenda2-observacoes: migration 0051 contra o banco real", () => {
  it("dono-grava-os-dois-textos", async () => {
    const { data: criado, error: erroInsert } = await clientA
      .from("agenda2_itens")
      .insert(linhaBase(vendedorA.id, "dono-grava", { o_que_fazer: TEXTO_PLANO }))
      .select("id")
      .single()
    expect(erroInsert).toBeNull()
    const id = (criado as { id: string }).id

    const { data: concluidos, error: erroConcluir } = await clientA
      .from("agenda2_itens")
      .update({ concluido: true, o_que_foi_feito: TEXTO_RESULTADO })
      .eq("id", id)
      .select("id")
    expect(erroConcluir).toBeNull()
    expect(concluidos).toHaveLength(1)

    const { data: desmarcados, error: erroDesmarcar } = await clientA
      .from("agenda2_itens")
      .update({ concluido: false })
      .eq("id", id)
      .select("id")
    expect(erroDesmarcar).toBeNull()
    expect(desmarcados).toHaveLength(1)

    const linha = await lerTextosPeloServico(id)
    expect(linha).not.toBeNull()
    expect(linha?.o_que_fazer).toBe(TEXTO_PLANO)
    expect(linha?.o_que_foi_feito).toBe(TEXTO_RESULTADO)
    expect(linha?.concluido).toBe(false)
  })

  it("outro-vendedor-nao-le-nem-altera-os-textos", async () => {
    const idDeB = await seedItem(vendedorB.id, {
      o_que_fazer: TEXTO_PLANO,
      o_que_foi_feito: TEXTO_RESULTADO,
    })

    const { data: lidos } = await clientA
      .from("agenda2_itens")
      .select("id, o_que_fazer, o_que_foi_feito")
      .eq("id", idDeB)
    expect(lidos ?? []).toHaveLength(0)

    const { data: alterados } = await clientA
      .from("agenda2_itens")
      .update({ o_que_foi_feito: "Teste texto trocado" })
      .eq("id", idDeB)
      .select("id")
    expect(alterados ?? []).toHaveLength(0)

    const linha = await lerTextosPeloServico(idDeB)
    expect(linha?.o_que_fazer).toBe(TEXTO_PLANO)
    expect(linha?.o_que_foi_feito).toBe(TEXTO_RESULTADO)
  })

  it("supervisor-le-os-textos-mas-nao-altera", async () => {
    const idDeA = await seedItem(vendedorA.id, {
      o_que_fazer: TEXTO_PLANO,
      o_que_foi_feito: TEXTO_RESULTADO,
    })

    const { data: lidos, error: erroLeitura } = await supervisorClient
      .from("agenda2_itens")
      .select("id, o_que_fazer, o_que_foi_feito")
      .eq("id", idDeA)
    expect(erroLeitura).toBeNull()
    expect(lidos).toHaveLength(1)
    expect(lidos?.[0]?.o_que_fazer).toBe(TEXTO_PLANO)
    expect(lidos?.[0]?.o_que_foi_feito).toBe(TEXTO_RESULTADO)

    const { data: alterados } = await supervisorClient
      .from("agenda2_itens")
      .update({ o_que_fazer: "Teste texto trocado" })
      .eq("id", idDeA)
      .select("id")
    expect(alterados ?? []).toHaveLength(0)

    const linha = await lerTextosPeloServico(idDeA)
    expect(linha?.o_que_fazer).toBe(TEXTO_PLANO)
    expect(linha?.o_que_foi_feito).toBe(TEXTO_RESULTADO)
  })

  it("limite-500-depois-de-aparar", async () => {
    const { error: erroFazer501 } = await clientA
      .from("agenda2_itens")
      .insert(linhaBase(vendedorA.id, "fazer-501", { o_que_fazer: "a".repeat(LIMITE + 1) }))
    expect(erroFazer501).not.toBeNull()

    const { error: erroFeito501 } = await clientA
      .from("agenda2_itens")
      .insert(linhaBase(vendedorA.id, "feito-501", { o_que_foi_feito: "b".repeat(LIMITE + 1) }))
    expect(erroFeito501).not.toBeNull()

    const { error: erroOs500 } = await clientA.from("agenda2_itens").insert(
      linhaBase(vendedorA.id, "os-500", {
        o_que_fazer: "c".repeat(LIMITE),
        o_que_foi_feito: "d".repeat(LIMITE),
      })
    )
    expect(erroOs500).toBeNull()

    // A regra apara antes de contar: 500 letras com dois espacos de cada lado.
    const { error: erroCercado } = await clientA
      .from("agenda2_itens")
      .insert(linhaBase(vendedorA.id, "cercado", { o_que_fazer: `  ${"e".repeat(LIMITE)}  ` }))
    expect(erroCercado).toBeNull()
  })

  it("so-espacos-aceito-pelo-banco", async () => {
    const soEspacos = "     "
    const { data: criado, error } = await clientA
      .from("agenda2_itens")
      .insert(linhaBase(vendedorA.id, "so-espacos", { o_que_fazer: soEspacos }))
      .select("id")
      .single()
    expect(error).toBeNull()

    // O banco so limita o tamanho; quem transforma em vazio e a acao
    // (provado em agenda2-actions.test.ts).
    const linha = await lerTextosPeloServico((criado as { id: string }).id)
    expect(linha?.o_que_fazer).toBe(soEspacos)
  })

  it("sem-texto-continua-valendo", async () => {
    // Como a tela antiga faz: sem as duas chaves.
    const { data: criado, error } = await clientA
      .from("agenda2_itens")
      .insert(linhaBase(vendedorA.id, "sem-texto"))
      .select("id")
      .single()
    expect(error).toBeNull()

    const linha = await lerTextosPeloServico((criado as { id: string }).id)
    expect(linha?.o_que_fazer).toBeNull()
    expect(linha?.o_que_foi_feito).toBeNull()
  })

  it("anonimo-nao-le-os-textos", async () => {
    const idDeA = await seedItem(vendedorA.id, {
      o_que_fazer: TEXTO_PLANO,
      o_que_foi_feito: TEXTO_RESULTADO,
    })

    const { data } = await anonClient()
      .from("agenda2_itens")
      .select("id, o_que_fazer, o_que_foi_feito")
      .eq("id", idDeA)
    expect(data ?? []).toHaveLength(0)
  })
})
