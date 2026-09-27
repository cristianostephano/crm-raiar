import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { addDays, format, parseISO } from "date-fns"

import {
  anonClient,
  createTestMember,
  deleteTestMember,
  serviceClient,
  signInAs,
  type TestMember,
} from "../helpers/supabase-test-clients"

/**
 * Integration tests for the migration 0038 surface (30-01-PLAN.md,
 * ADER-01..03, D-04/D-07/D-08/D-10/D-11): tabela `acessos_diarios`, suas 3
 * policies de RLS, e a RPC `registrar_acesso_diario()`.
 *
 * NUNCA usa as contas semente antigas (`vendedor.a+test`/`vendedor.b+test`,
 * apagadas em 2026-08-19 — ver STATE.md) — só fixtures descartáveis via
 * `createTestMember`/`deleteTestMember`. O projeto Supabase de teste É o de
 * produção, com dados reais de funcionários — por isso este arquivo NUNCA
 * imprime uma linha lida do banco no terminal, filtra toda leitura do
 * Supervisor pelos ids de fixture semeados aqui e usa só nomes inventados
 * (LGPD).
 *
 * No máximo duas autenticações no arquivo inteiro: Vendedor A e Supervisor.
 * Vendedor B nunca faz login — suas linhas são sempre semeadas diretamente
 * pelo cliente de serviço (que ignora a RLS de propósito, só para semear,
 * nunca para afirmar comportamento de RLS).
 *
 * Os casos rodam NA ORDEM em que aparecem neste arquivo (mesma disciplina
 * de tests/funil/encerrados-rpc.test.ts): os casos de retenção dependem do
 * estado deixado pelos casos anteriores (linha de hoje de A já existente;
 * linhas de B semeadas dentro do próprio caso de retenção).
 *
 * Fica VERMELHO (tabela/coluna/função inexistentes no banco) até o plano
 * 30-03 aplicar a migration 0038 no projeto hospedado.
 */

type AcessoRow = { usuario_id: string; dia: string }

/** Hoje no fuso de São Paulo, em AAAA-MM-DD — nunca a partir de string ISO
 * crua do relógio local do processo de teste (Pitfall 1 da 30-RESEARCH). */
function hojeSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const parte = (tipo: string) => parts.find((p) => p.type === tipo)?.value ?? ""
  return `${parte("year")}-${parte("month")}-${parte("day")}`
}

/** `n` dias antes de hoje em São Paulo, em AAAA-MM-DD. Sempre via
 * `parseISO` (nunca `new Date(texto)`, que interpretaria o texto no fuso
 * local do processo, não no de São Paulo). */
function diaMenos(n: number): string {
  return format(addDays(parseISO(hojeSaoPaulo()), -n), "yyyy-MM-dd")
}

let vendedorA: TestMember
let vendedorB: TestMember
let supervisor: TestMember
let clientA: SupabaseClient
let supervisorClient: SupabaseClient

beforeAll(async () => {
  vendedorA = await createTestMember("vendedor", "aderencia-a")
  vendedorB = await createTestMember("vendedor", "aderencia-b")
  supervisor = await createTestMember("supervisor", "aderencia")
  clientA = await signInAs(vendedorA.email, vendedorA.password)
  supervisorClient = await signInAs(supervisor.email, supervisor.password)
})

afterAll(async () => {
  const admin = serviceClient()
  // Limpeza explícita ANTES de apagar os membros: a cascata de
  // `deleteTestMember` (via `profiles.id references auth.users(id) on
  // delete cascade` → `acessos_diarios.usuario_id references profiles(id)
  // on delete cascade`) também apagaria estas linhas, mas limpar primeiro
  // evita resíduo se alguma exclusão de membro falhar no meio do caminho.
  await admin
    .from("acessos_diarios")
    .delete()
    .in("usuario_id", [vendedorA.id, vendedorB.id, supervisor.id])
  await deleteTestMember(vendedorA.id)
  await deleteTestMember(vendedorB.id)
  await deleteTestMember(supervisor.id)
})

async function linhasDe(usuarioId: string): Promise<AcessoRow[]> {
  const { data, error } = await serviceClient()
    .from("acessos_diarios")
    .select("usuario_id, dia")
    .eq("usuario_id", usuarioId)
  if (error) throw new Error(`Falha ao ler acessos_diarios: ${error.message}`)
  return (data ?? []) as AcessoRow[]
}

describe("registrar_acesso_diario() grava o dia do banco (D-04/D-10)", () => {
  it("registrar-grava-hoje: A chama a RPC sem erro e grava exatamente 1 linha, com dia = hoje em São Paulo", async () => {
    const { error } = await clientA.rpc("registrar_acesso_diario")
    expect(error).toBeNull()

    const linhas = await linhasDe(vendedorA.id)
    expect(linhas).toHaveLength(1)
    expect(linhas[0].dia).toBe(hojeSaoPaulo())
  })

  it("registrar-idempotente: chamar de novo no mesmo dia continua deixando 1 linha só, sem erro", async () => {
    const { error } = await clientA.rpc("registrar_acesso_diario")
    expect(error).toBeNull()

    const linhas = await linhasDe(vendedorA.id)
    expect(linhas).toHaveLength(1)
  })

  it("lgpd-duas-colunas: as chaves da linha lida com seleção de todas as colunas, ordenadas, são exatamente dia e usuario_id", async () => {
    const { data, error } = await serviceClient()
      .from("acessos_diarios")
      .select("*")
      .eq("usuario_id", vendedorA.id)
      .single()
    expect(error).toBeNull()
    expect(Object.keys(data as Record<string, unknown>).sort()).toEqual(["dia", "usuario_id"])
  })
})

describe("Leitura restrita ao Supervisor (D-08)", () => {
  it("vendedor-nao-le: A lê acessos_diarios e recebe zero linhas, sem erro, nem a própria", async () => {
    const { data, error } = await clientA.from("acessos_diarios").select("usuario_id, dia")
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it("supervisor-le: o Supervisor, filtrando por usuario_id de A, lê 1 linha", async () => {
    const { data, error } = await supervisorClient
      .from("acessos_diarios")
      .select("usuario_id, dia")
      .eq("usuario_id", vendedorA.id)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })
})

describe("Gravação direta na tabela tem o mesmo efeito da RPC de hoje (T-30-01/T-30-02)", () => {
  it("gravacao-direta-dia-retroativo-recusada: A grava direto com dia retroativo e a policy recusa", async () => {
    const diaRetroativo = diaMenos(3)
    const { error } = await clientA
      .from("acessos_diarios")
      .insert({ usuario_id: vendedorA.id, dia: diaRetroativo })
    expect(error).not.toBeNull()

    const { data } = await serviceClient()
      .from("acessos_diarios")
      .select("dia")
      .eq("usuario_id", vendedorA.id)
      .eq("dia", diaRetroativo)
    expect(data ?? []).toHaveLength(0)
  })

  it("gravacao-direta-outro-usuario-recusada: A grava direto em nome de B e a policy recusa", async () => {
    const { error } = await clientA
      .from("acessos_diarios")
      .insert({ usuario_id: vendedorB.id, dia: hojeSaoPaulo() })
    expect(error).not.toBeNull()

    const linhasB = await linhasDe(vendedorB.id)
    expect(linhasB).toHaveLength(0)
  })
})

describe("Minimização — só vendedor ativo é registrado (correção 3, LGPD)", () => {
  it("supervisor-nao-registrado: o Supervisor chama a RPC sem erro e nenhuma linha é gravada com o id dele", async () => {
    const { error } = await supervisorClient.rpc("registrar_acesso_diario")
    expect(error).toBeNull()

    const linhas = await linhasDe(supervisor.id)
    expect(linhas).toHaveLength(0)
  })

  it("inativo-nao-registrado: A marcado inativo e sem linha de hoje não registra nada ao chamar a RPC", async () => {
    const admin = serviceClient()
    await admin
      .from("acessos_diarios")
      .delete()
      .eq("usuario_id", vendedorA.id)
      .eq("dia", hojeSaoPaulo())
    await admin.from("profiles").update({ ativo: false }).eq("id", vendedorA.id)

    try {
      const { error } = await clientA.rpc("registrar_acesso_diario")
      expect(error).toBeNull()

      const linhas = await linhasDe(vendedorA.id)
      expect(linhas).toHaveLength(0)
    } finally {
      await admin.from("profiles").update({ ativo: true }).eq("id", vendedorA.id)
    }
  })
})

describe("Descarte de 35 dias (D-11, correção 1)", () => {
  it("vendedor-nao-apaga-recente: A não consegue apagar a própria linha recente pela API", async () => {
    const admin = serviceClient()
    await admin.from("acessos_diarios").upsert({ usuario_id: vendedorA.id, dia: hojeSaoPaulo() })

    await clientA.from("acessos_diarios").delete().eq("usuario_id", vendedorA.id)

    const linhas = await linhasDe(vendedorA.id)
    expect(linhas).toHaveLength(1)
  })

  it("retencao-vendedor-nao-limpa: a chamada de A não apaga nenhuma linha vencida de B", async () => {
    const admin = serviceClient()
    const diasSemeados = [diaMenos(40), diaMenos(36), diaMenos(35), hojeSaoPaulo()]
    const { error: seedError } = await admin
      .from("acessos_diarios")
      .upsert(diasSemeados.map((dia) => ({ usuario_id: vendedorB.id, dia })))
    expect(seedError).toBeNull()

    const { error } = await clientA.rpc("registrar_acesso_diario")
    expect(error).toBeNull()

    const linhasB = await linhasDe(vendedorB.id)
    expect(linhasB.map((l) => l.dia).sort()).toEqual([...diasSemeados].sort())
  })

  it("retencao-supervisor-limpa: a chamada do Supervisor apaga só o que passou de hoje menos 35", async () => {
    const { error } = await supervisorClient.rpc("registrar_acesso_diario")
    expect(error).toBeNull()

    const linhasB = await linhasDe(vendedorB.id)
    expect(linhasB.map((l) => l.dia).sort()).toEqual([diaMenos(35), hojeSaoPaulo()].sort())
  })

  it("supervisor-nao-apaga-recente: o Supervisor não consegue apagar direto a linha de hoje de B", async () => {
    await supervisorClient
      .from("acessos_diarios")
      .delete()
      .eq("usuario_id", vendedorB.id)
      .eq("dia", hojeSaoPaulo())

    const linhasB = await linhasDe(vendedorB.id)
    expect(linhasB.some((l) => l.dia === hojeSaoPaulo())).toBe(true)
  })
})

describe("Chamador anônimo (D-10)", () => {
  it("anonimo-sem-efeito: o cliente anônimo chama a RPC sem gravar nenhuma linha nova para os ids de fixture", async () => {
    const idsFixture = [vendedorA.id, vendedorB.id, supervisor.id]
    const contarTotal = async () => {
      const linhas = await Promise.all(idsFixture.map((id) => linhasDe(id)))
      return linhas.reduce((total, l) => total + l.length, 0)
    }

    const antes = await contarTotal()
    await anonClient().rpc("registrar_acesso_diario")
    const depois = await contarTotal()

    expect(depois).toBe(antes)
  })
})
