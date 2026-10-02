import { parseISO } from "date-fns"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { gerarDatasSemanais } from "@/lib/agenda2/repeticao"

import {
  createTestMember,
  deleteTestMember,
  serviceClient,
  signInAs,
  type TestMember,
} from "../helpers/supabase-test-clients"

/**
 * Integração da repetição semanal da Agenda 2 (Fase 32 Plano 3, AGD2-02/
 * AGD2-08, D-20/D-21/D-22/D-30, Pitfall 10) — contra o banco REAL (o projeto
 * Supabase de teste É o de produção). Não testa a Server Action (essa tem
 * mock em agenda2-actions.test.ts): testa o comportamento que o BANCO já
 * tem e do qual a ação depende — o `.insert(array)` do PostgREST vira um só
 * INSERT atômico, e a RLS/constraints da migration 0048 são avaliadas linha
 * a linha, então uma linha ruim derruba o lote inteiro.
 *
 * Só fixtures descartáveis (createTestMember/deleteTestMember), nunca contas
 * semente. Exatamente duas autenticações no arquivo (Vendedor A e
 * Supervisor) por causa do limite de login do Supabase Auth — Vendedor B
 * nunca faz login; os itens dele são semeados pelo cliente de serviço.
 * LGPD: só nomes inventados, leituras do Supervisor sempre filtradas pelos
 * ids de fixture (nunca baixa itens reais de outros vendedores), e este
 * arquivo NUNCA imprime nenhuma linha lida.
 */

type Agenda2ItemRow = {
  id: string
  vendedor_id: string
  nome_cliente: string
  bairro: string
  data: string
  concluido: boolean
}

type LinhaLote = {
  vendedor_id: string
  nome_cliente: string
  bairro: string
  data: string
}

const TIMEOUT_MS = 60_000

let vendedorA: TestMember
let vendedorB: TestMember
let supervisor: TestMember
let clientA: SupabaseClient
let supervisorClient: SupabaseClient

beforeAll(async () => {
  vendedorA = await createTestMember("vendedor", "agenda2-rep-a")
  vendedorB = await createTestMember("vendedor", "agenda2-rep-b")
  supervisor = await createTestMember("supervisor", "agenda2-rep")
  clientA = await signInAs(vendedorA.email, vendedorA.password)
  supervisorClient = await signInAs(supervisor.email, supervisor.password)
}, TIMEOUT_MS)

afterAll(async () => {
  const idsFixture = [vendedorA.id, vendedorB.id, supervisor.id]

  // A cascata (vendedor_id ... on delete cascade) também apagaria, mas
  // limpar primeiro evita resíduo se a exclusão de usuário falhar.
  await serviceClient().from("agenda2_itens").delete().in("vendedor_id", idsFixture)

  // Recoloca A como ativo caso o caso do vendedor desativado tenha falhado.
  await serviceClient().from("profiles").update({ ativo: true }).eq("id", vendedorA.id)

  await deleteTestMember(vendedorA.id)
  await deleteTestMember(vendedorB.id)
  await deleteTestMember(supervisor.id)
}, TIMEOUT_MS)

/**
 * Nome inventado único — nunca o nome real de um cliente (LGPD).
 *
 * `Date.now()` sozinho é uma sequência de 13 dígitos corridos, que a
 * constraint `chk_agenda2_nome_cliente_sem_documento` (migration 0048)
 * recusa de propósito (parece CPF/CNPJ/telefone/CEP). Por isso o timestamp
 * é quebrado a cada 3 dígitos com um separador não-numérico — nunca forma
 * uma sequência de 8+ dígitos.
 */
function nomeInventado(label: string): string {
  const timestampQuebrado = Date.now().toString().replace(/(\d{3})(?=\d)/g, "$1x")
  const sufixo = `${timestampQuebrado}-${Math.random().toString(36).slice(2, 8)}`
  return `Teste Agenda2 ${label} ${sufixo}`
}

/** Dia corrente no fuso de São Paulo (AAAA-MM-DD) — nunca o construtor de
 * data a partir de texto cru. */
function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** Monta as linhas de um lote: mesmo nome/bairro, uma por data. */
function montarLote(
  vendedorId: string,
  nome: string,
  datas: string[],
  bairro = "Centro"
): LinhaLote[] {
  return datas.map((data) => ({
    vendedor_id: vendedorId,
    nome_cliente: nome,
    bairro,
    data,
  }))
}

/** Lê pelo serviço (ignora a RLS — só para conferir o estado real do banco). */
async function lerPorNome(nome: string): Promise<Agenda2ItemRow[]> {
  const { data, error } = await serviceClient()
    .from("agenda2_itens")
    .select("id, vendedor_id, nome_cliente, bairro, data, concluido")
    .eq("nome_cliente", nome)
    .order("data", { ascending: true })

  if (error) {
    throw new Error(`lerPorNome falhou: ${error.message}`)
  }
  return (data ?? []) as Agenda2ItemRow[]
}

async function lerPorIds(ids: string[]): Promise<Agenda2ItemRow[]> {
  const { data, error } = await serviceClient()
    .from("agenda2_itens")
    .select("id, vendedor_id, nome_cliente, bairro, data, concluido")
    .in("id", ids)

  if (error) {
    throw new Error(`lerPorIds falhou: ${error.message}`)
  }
  return (data ?? []) as Agenda2ItemRow[]
}

describe("rls-agenda2-repeticao: lote da repetição semanal contra o banco real", () => {
  it(
    "lote-12-grava",
    async () => {
      const nome = nomeInventado("lote-12")
      const datas = gerarDatasSemanais(hojeSaoPaulo(), 12)
      expect(datas).toHaveLength(12)

      const { error } = await clientA
        .from("agenda2_itens")
        .insert(montarLote(vendedorA.id, nome, datas))
      expect(error).toBeNull()

      const linhas = await lerPorNome(nome)
      expect(linhas).toHaveLength(12)
      expect(linhas.every((l) => l.vendedor_id === vendedorA.id)).toBe(true)
      expect(linhas.map((l) => l.data)).toEqual(datas)

      const diasDaSemana = new Set(linhas.map((l) => parseISO(l.data).getDay()))
      expect(diasDaSemana.size).toBe(1)
    },
    TIMEOUT_MS
  )

  it(
    "lote-atomico-check",
    async () => {
      const nome = nomeInventado("atomico-check")
      const datas = gerarDatasSemanais(hojeSaoPaulo(), 12)
      const lote = montarLote(vendedorA.id, nome, datas)
      // A última linha viola chk_agenda2_bairro_tamanho (máx. 60).
      lote[11] = { ...lote[11], bairro: "b".repeat(61) }

      const { error } = await clientA.from("agenda2_itens").insert(lote)
      expect(error).not.toBeNull()

      expect(await lerPorNome(nome)).toHaveLength(0)
    },
    TIMEOUT_MS
  )

  it(
    "lote-atomico-rls",
    async () => {
      const nome = nomeInventado("atomico-rls")
      const datas = gerarDatasSemanais(hojeSaoPaulo(), 12)
      const lote = montarLote(vendedorA.id, nome, datas)
      // A última linha tenta gravar em nome de outro vendedor.
      lote[11] = { ...lote[11], vendedor_id: vendedorB.id }

      const { error } = await clientA.from("agenda2_itens").insert(lote)
      expect(error).not.toBeNull()

      expect(await lerPorNome(nome)).toHaveLength(0)
    },
    TIMEOUT_MS
  )

  it(
    "lote-supervisor-recusado",
    async () => {
      const nome = nomeInventado("supervisor-lote")
      const datas = gerarDatasSemanais(hojeSaoPaulo(), 4)

      const { error } = await supervisorClient
        .from("agenda2_itens")
        .insert(montarLote(supervisor.id, nome, datas))
      expect(error).not.toBeNull()

      expect(await lerPorNome(nome)).toHaveLength(0)
    },
    TIMEOUT_MS
  )

  it(
    "lote-desativado-recusado",
    async () => {
      const nome = nomeInventado("desativado-lote")
      const datas = gerarDatasSemanais(hojeSaoPaulo(), 4)

      await serviceClient().from("profiles").update({ ativo: false }).eq("id", vendedorA.id)

      try {
        const { error } = await clientA
          .from("agenda2_itens")
          .insert(montarLote(vendedorA.id, nome, datas))
        expect(error).not.toBeNull()

        expect(await lerPorNome(nome)).toHaveLength(0)
      } finally {
        await serviceClient().from("profiles").update({ ativo: true }).eq("id", vendedorA.id)
      }
    },
    TIMEOUT_MS
  )

  it(
    "ocorrencias-independentes",
    async () => {
      const nome = nomeInventado("independentes")
      const datas = gerarDatasSemanais(hojeSaoPaulo(), 4)

      const { error: errInsert } = await clientA
        .from("agenda2_itens")
        .insert(montarLote(vendedorA.id, nome, datas))
      expect(errInsert).toBeNull()

      const [primeira, segunda, terceira, quarta] = await lerPorNome(nome)
      expect([primeira, segunda, terceira, quarta].every(Boolean)).toBe(true)

      // D-21: concluir a 2ª, renomear a 3ª e apagar a 4ª, cada uma por id.
      const { error: errConcluir } = await clientA
        .from("agenda2_itens")
        .update({ concluido: true })
        .eq("id", segunda.id)
      expect(errConcluir).toBeNull()

      const novoNome = nomeInventado("independentes-renomeada")
      const { error: errRenomear } = await clientA
        .from("agenda2_itens")
        .update({ nome_cliente: novoNome })
        .eq("id", terceira.id)
      expect(errRenomear).toBeNull()

      const { error: errApagar } = await clientA
        .from("agenda2_itens")
        .delete()
        .eq("id", quarta.id)
      expect(errApagar).toBeNull()

      const depois = await lerPorIds([primeira.id, segunda.id, terceira.id, quarta.id])
      const porId = new Map(depois.map((l) => [l.id, l]))

      // 1ª: igual ao que foi gravado (pendente, nome original).
      expect(porId.get(primeira.id)).toEqual(primeira)
      // 2ª: só mudou `concluido`.
      expect(porId.get(segunda.id)).toEqual({ ...segunda, concluido: true })
      // 3ª: só mudou o nome.
      expect(porId.get(terceira.id)).toEqual({ ...terceira, nome_cliente: novoNome })
      // 4ª: sumiu.
      expect(porId.has(quarta.id)).toBe(false)
    },
    TIMEOUT_MS
  )

  it(
    "periodo-escopo",
    async () => {
      const nomeA = nomeInventado("periodo-a")
      const nomeB = nomeInventado("periodo-b")
      const datas = gerarDatasSemanais(hojeSaoPaulo(), 4)
      const inicio = datas[0]
      const fim = datas[3]

      const { error: errA } = await clientA
        .from("agenda2_itens")
        .insert(montarLote(vendedorA.id, nomeA, datas))
      expect(errA).toBeNull()

      // Duas linhas de B dentro do mesmo período, semeadas pelo serviço.
      const { error: errB } = await serviceClient()
        .from("agenda2_itens")
        .insert(montarLote(vendedorB.id, nomeB, [datas[1], datas[2]]))
      expect(errB).toBeNull()

      // Vendedor A: mesma forma de leitura de getAgenda2Periodo (gte/lte em
      // `data`), sem filtro de dono — só a RLS escopa.
      const { data: vistoPorA, error: errLeituraA } = await clientA
        .from("agenda2_itens")
        .select("id, vendedor_id")
        .gte("data", inicio)
        .lte("data", fim)
      expect(errLeituraA).toBeNull()
      const donosVistosPorA = new Set((vistoPorA ?? []).map((l) => l.vendedor_id))
      expect(donosVistosPorA.has(vendedorA.id)).toBe(true)
      expect(donosVistosPorA.has(vendedorB.id)).toBe(false)
      expect([...donosVistosPorA].every((id) => id === vendedorA.id)).toBe(true)

      // Supervisor: mesmo filtro de período + ids de fixture (nunca baixa
      // itens reais de outros vendedores) — vê as linhas de A e de B.
      const { data: vistoPeloSupervisor, error: errLeituraSup } = await supervisorClient
        .from("agenda2_itens")
        .select("id, vendedor_id")
        .gte("data", inicio)
        .lte("data", fim)
        .in("vendedor_id", [vendedorA.id, vendedorB.id])
      expect(errLeituraSup).toBeNull()
      const donosVistosPeloSupervisor = new Set(
        (vistoPeloSupervisor ?? []).map((l) => l.vendedor_id)
      )
      expect(donosVistosPeloSupervisor.has(vendedorA.id)).toBe(true)
      expect(donosVistosPeloSupervisor.has(vendedorB.id)).toBe(true)
    },
    TIMEOUT_MS
  )
})
