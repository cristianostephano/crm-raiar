import { afterEach, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Integration tests for `agenda_do_vendedor()` (AGD-01/AGD-06, Fase 14
 * Plan 1) — proves the shape of the unified feed: origem/titulo per
 * frente, cliente/responsavel identification, date-ascending ordering
 * decided entirely in SQL, exclusion of already-completed items, exclusion
 * of a tarefa with no data_conclusao, and that the count contract (AGD-06)
 * matches the length of the full read.
 *
 * Same pattern as every other integration test in this project: real
 * signed-in sessions via signInAs()/SEED_ACCOUNTS, serviceClient() used
 * ONLY to seed/clean up test data (never to assert RLS behaviour — that
 * belongs to rls-agenda.test.ts). Vendedor A's identity is signed in ONCE
 * per file (rate-limit constraint documented in STATE.md) and reused
 * across every case below — never call signInAs inside an it().
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Agenda ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

type AgendaRow = {
  origem: string
  item_id: string
  cliente_id: string
  razao_social: string
  responsavel: string
  responsavel_nome: string | null
  titulo: string
  data: string
}

const createdClienteIds: string[] = []

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  const admin = serviceClient()
  // `on delete cascade` em tarefas.cliente_id/visitas.cliente_id cobre a
  // limpeza dos itens semeados junto do cliente.
  await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
})

async function getUserId(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
}

async function getActiveTipoTarefa(): Promise<{ id: string; nome: string }> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from("tipos_tarefa")
    .select("id, nome")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error("Nenhum tipo de tarefa ativo encontrado para o teste")
  }
  return data as { id: string; nome: string }
}

async function createTestCliente(
  client: SupabaseClient,
  responsavelId: string,
  label: string
): Promise<string> {
  const { data, error } = await client
    .from("clientes")
    .insert(baseClienteFields(uniqueRazaoSocial(label), responsavelId))
    .select("id")
    .single()
  if (error || !data) {
    throw new Error(`Failed to seed test cliente: ${error?.message}`)
  }
  createdClienteIds.push(data.id)
  return data.id
}

let vendedorA: SupabaseClient
let vendedorAId: string

beforeAll(async () => {
  vendedorA = await signInAs(
    SEED_ACCOUNTS.vendedorA.email,
    SEED_ACCOUNTS.vendedorA.password
  )
  vendedorAId = await getUserId(vendedorA)
})

describe("agenda_do_vendedor: origem e titulo de cada frente", () => {
  it("origem: tarefa e visita aparecem com origem e titulo corretos", async () => {
    const tipoTarefa = await getActiveTipoTarefa()
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "origem")

    const { error: tarefaError, data: tarefaInserted } = await vendedorA
      .from("tarefas")
      .insert({
        cliente_id: clienteId,
        tipo_tarefa_id: tipoTarefa.id,
        data_conclusao: "2026-09-01",
      })
      .select("id")
      .single()
    expect(tarefaError).toBeNull()

    const { error: visitaError, data: visitaInserted } = await vendedorA
      .from("visitas")
      .insert({ cliente_id: clienteId, data_prevista: "2026-09-02" })
      .select("id")
      .single()
    expect(visitaError).toBeNull()

    const { data, error } = await vendedorA.rpc("agenda_do_vendedor")
    expect(error).toBeNull()
    const rows = (data ?? []) as AgendaRow[]

    const tarefaRow = rows.find((r) => r.item_id === tarefaInserted!.id)
    const visitaRow = rows.find((r) => r.item_id === visitaInserted!.id)
    expect(tarefaRow).toBeDefined()
    expect(tarefaRow?.origem).toBe("prospeccao")
    expect(tarefaRow?.titulo).toBe(tipoTarefa.nome)
    expect(visitaRow).toBeDefined()
    expect(visitaRow?.origem).toBe("visita")
    expect(visitaRow?.titulo).toBe("Visita")
  })
})

describe("agenda_do_vendedor: identificacao do cliente e do responsavel", () => {
  it("cliente: cada linha traz cliente_id, razao_social e responsavel corretos", async () => {
    const tipoTarefa = await getActiveTipoTarefa()
    const razaoSocial = uniqueRazaoSocial("cliente")
    const { data: clienteInserted, error: clienteError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId))
      .select("id")
      .single()
    if (clienteError || !clienteInserted) {
      throw new Error(`Failed to seed test cliente: ${clienteError?.message}`)
    }
    createdClienteIds.push(clienteInserted.id)
    const clienteId = clienteInserted.id as string

    await vendedorA.from("tarefas").insert({
      cliente_id: clienteId,
      tipo_tarefa_id: tipoTarefa.id,
      data_conclusao: "2026-09-01",
    })
    await vendedorA
      .from("visitas")
      .insert({ cliente_id: clienteId, data_prevista: "2026-09-02" })

    const { data, error } = await vendedorA.rpc("agenda_do_vendedor")
    expect(error).toBeNull()
    const rows = ((data ?? []) as AgendaRow[]).filter(
      (r) => r.cliente_id === clienteId
    )
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.razao_social).toBe(razaoSocial)
      expect(row.responsavel).toBe(vendedorAId)
      expect(row.responsavel_nome).toBeTruthy()
    }
  })
})

describe("agenda_do_vendedor: ordem por data crescente", () => {
  it("ordem: tres itens fora de ordem voltam da data mais antiga para a mais recente", async () => {
    const tipoTarefa = await getActiveTipoTarefa()
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "ordem")

    const hoje = new Date()
    const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000)
    const daqui10dias = new Date(hoje.getTime() + 10 * 24 * 60 * 60 * 1000)
    const toISODate = (d: Date) => d.toISOString().slice(0, 10)

    const { data: futuraTarefa } = await vendedorA
      .from("tarefas")
      .insert({
        cliente_id: clienteId,
        tipo_tarefa_id: tipoTarefa.id,
        data_conclusao: toISODate(daqui10dias),
      })
      .select("id")
      .single()
    const { data: ontemVisita } = await vendedorA
      .from("visitas")
      .insert({ cliente_id: clienteId, data_prevista: toISODate(ontem) })
      .select("id")
      .single()
    const { data: hojeTarefa } = await vendedorA
      .from("tarefas")
      .insert({
        cliente_id: clienteId,
        tipo_tarefa_id: tipoTarefa.id,
        data_conclusao: toISODate(hoje),
      })
      .select("id")
      .single()

    const { data, error } = await vendedorA.rpc("agenda_do_vendedor")
    expect(error).toBeNull()
    const rows = (data ?? []) as AgendaRow[]
    // NAO reordenar aqui antes de comparar — e justamente a ordenacao do
    // SQL que este caso prova.
    const idsEsperados = [ontemVisita!.id, hojeTarefa!.id, futuraTarefa!.id]
    const ordemRecebida = rows
      .filter((r) => idsEsperados.includes(r.item_id))
      .map((r) => r.item_id)

    expect(ordemRecebida).toEqual(idsEsperados)
  })
})

describe("agenda_do_vendedor: apenas itens pendentes", () => {
  it("pendente: tarefa concluida e visita realizada nao aparecem no resultado", async () => {
    const tipoTarefa = await getActiveTipoTarefa()
    const clienteId = await createTestCliente(
      vendedorA,
      vendedorAId,
      "pendente"
    )
    const admin = serviceClient()

    const { data: tarefaConcluida } = await vendedorA
      .from("tarefas")
      .insert({
        cliente_id: clienteId,
        tipo_tarefa_id: tipoTarefa.id,
        data_conclusao: "2026-09-01",
      })
      .select("id")
      .single()
    await admin
      .from("tarefas")
      .update({ concluida: true })
      .eq("id", tarefaConcluida!.id)

    const { data: visitaRealizada } = await vendedorA
      .from("visitas")
      .insert({ cliente_id: clienteId, data_prevista: "2026-09-02" })
      .select("id")
      .single()
    await admin
      .from("visitas")
      .update({ data_realizada: "2026-09-02" })
      .eq("id", visitaRealizada!.id)

    const { data, error } = await vendedorA.rpc("agenda_do_vendedor")
    expect(error).toBeNull()
    const ids = ((data ?? []) as AgendaRow[]).map((r) => r.item_id)
    expect(ids).not.toContain(tarefaConcluida!.id)
    expect(ids).not.toContain(visitaRealizada!.id)
  })
})

describe("agenda_do_vendedor: tarefa sem data fica de fora", () => {
  it("semdata: tarefa aberta com data_conclusao nula nao aparece no resultado", async () => {
    const tipoTarefa = await getActiveTipoTarefa()
    const clienteId = await createTestCliente(
      vendedorA,
      vendedorAId,
      "semdata"
    )

    const { data: tarefaSemData } = await vendedorA
      .from("tarefas")
      .insert({
        cliente_id: clienteId,
        tipo_tarefa_id: tipoTarefa.id,
        data_conclusao: null,
      })
      .select("id")
      .single()

    const { data, error } = await vendedorA.rpc("agenda_do_vendedor")
    expect(error).toBeNull()
    const ids = ((data ?? []) as AgendaRow[]).map((r) => r.item_id)
    expect(ids).not.toContain(tarefaSemData!.id)
  })
})

describe("agenda_do_vendedor: contagem bate com o tamanho da lista (AGD-06)", () => {
  it("contagem: contagem exata bate com o tamanho da lista completa", async () => {
    const tipoTarefa = await getActiveTipoTarefa()
    const clienteId = await createTestCliente(
      vendedorA,
      vendedorAId,
      "contagem"
    )
    await vendedorA.from("tarefas").insert({
      cliente_id: clienteId,
      tipo_tarefa_id: tipoTarefa.id,
      data_conclusao: "2026-09-01",
    })

    const { data: full, error: fullError } =
      await vendedorA.rpc("agenda_do_vendedor")
    expect(fullError).toBeNull()

    // Se a combinacao head/count nao devolver contagem para uma funcao que
    // retorna tabela nesta versao do supabase-js, este caso deve FALHAR de
    // forma visivel (nao ser relaxado) — a restricao real e diagnosticada e
    // registrada no SUMMARY no Task 3, apos o push.
    const { count, error: countError } = await vendedorA.rpc(
      "agenda_do_vendedor",
      {},
      { count: "exact", head: true }
    )
    expect(countError).toBeNull()
    expect(count).toBe((full ?? []).length)
  })
})
