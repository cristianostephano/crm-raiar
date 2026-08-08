import { afterEach, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import {
  anonClient,
  serviceClient,
  signInAs,
} from "../helpers/supabase-test-clients"

/**
 * RLS negative-case tests for `agenda_do_vendedor()` (AGD-04, Fase 14
 * Plan 1, T-14-01/T-14-02/T-14-03) — the behavioral gate that fails loudly
 * if the function ever accidentally gains a `security definer` clause or a
 * manual filtro de dono/checagem de papel inside its body. Mirrors
 * tests/dashboard/rls-dashboard.test.ts and tests/clientes/rls-visitas.test.ts's
 * cross-vendedor pattern: seed via service role (bypasses RLS on purpose,
 * only for setup), assert as a DIFFERENT signed-in role, never as
 * service-role (that would trivially always pass since RLS is bypassed).
 *
 * Every identity (Vendedor A, Vendedor B, Supervisor) is signed in ONCE per
 * file (rate-limit constraint documented in STATE.md) and reused across the
 * three cases below — never call signInAs inside an it().
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste RLSAgenda ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
  // `on delete cascade` em tarefas.cliente_id cobre a limpeza da tarefa
  // semeada junto do cliente.
  await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
})

async function getUserId(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
}

async function getActiveTipoTarefa(): Promise<{ id: string }> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from("tipos_tarefa")
    .select("id")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error("Nenhum tipo de tarefa ativo encontrado para o teste")
  }
  return data as { id: string }
}

/**
 * Semeia via serviceClient() (nao depende de RLS na semeadura, so a
 * asercao depois precisa de sessao real) um cliente + uma tarefa em aberto
 * com data para o responsavel dado.
 */
async function seedClienteComPendente(
  responsavelId: string,
  label: string
): Promise<{ clienteId: string; tarefaId: string }> {
  const admin = serviceClient()
  const tipoTarefa = await getActiveTipoTarefa()
  const { data: cliente, error: clienteError } = await admin
    .from("clientes")
    .insert(baseClienteFields(uniqueRazaoSocial(label), responsavelId))
    .select("id")
    .single()
  if (clienteError || !cliente) {
    throw new Error(`Failed to seed test cliente: ${clienteError?.message}`)
  }
  createdClienteIds.push(cliente.id)

  const { data: tarefa, error: tarefaError } = await admin
    .from("tarefas")
    .insert({
      cliente_id: cliente.id,
      tipo_tarefa_id: tipoTarefa.id,
      data_conclusao: "2026-09-01",
    })
    .select("id")
    .single()
  if (tarefaError || !tarefa) {
    throw new Error(`Failed to seed test tarefa: ${tarefaError?.message}`)
  }

  return { clienteId: cliente.id as string, tarefaId: tarefa.id as string }
}

let vendedorA: SupabaseClient
let vendedorAId: string
let vendedorB: SupabaseClient
let vendedorBId: string
let supervisor: SupabaseClient

beforeAll(async () => {
  vendedorA = await signInAs(
    SEED_ACCOUNTS.vendedorA.email,
    SEED_ACCOUNTS.vendedorA.password
  )
  vendedorAId = await getUserId(vendedorA)
  vendedorB = await signInAs(
    SEED_ACCOUNTS.vendedorB.email,
    SEED_ACCOUNTS.vendedorB.password
  )
  vendedorBId = await getUserId(vendedorB)
  supervisor = await signInAs(
    SEED_ACCOUNTS.supervisor.email,
    SEED_ACCOUNTS.supervisor.password
  )
})

describe("RLS agenda_do_vendedor: isolamento entre vendedores (AGD-04)", () => {
  it("vendedor: Vendedor A nao ve item do cliente de Vendedor B, e vice-versa", async () => {
    const seedA = await seedClienteComPendente(vendedorAId, "vendedor-a")
    const seedB = await seedClienteComPendente(vendedorBId, "vendedor-b")

    const { data: agendaA, error: errorA } =
      await vendedorA.rpc("agenda_do_vendedor")
    expect(errorA).toBeNull()
    const clientesA = ((agendaA ?? []) as AgendaRow[]).map(
      (r) => r.cliente_id
    )
    expect(clientesA).toContain(seedA.clienteId)
    expect(clientesA).not.toContain(seedB.clienteId)

    const { data: agendaB, error: errorB } =
      await vendedorB.rpc("agenda_do_vendedor")
    expect(errorB).toBeNull()
    const clientesB = ((agendaB ?? []) as AgendaRow[]).map(
      (r) => r.cliente_id
    )
    expect(clientesB).toContain(seedB.clienteId)
    expect(clientesB).not.toContain(seedA.clienteId)
  })
})

describe("RLS agenda_do_vendedor: visao completa do supervisor (AGD-04)", () => {
  it("supervisor: enxerga os itens dos dois vendedores, cada um com o responsavel_nome correto", async () => {
    const seedA = await seedClienteComPendente(vendedorAId, "supervisor-a")
    const seedB = await seedClienteComPendente(vendedorBId, "supervisor-b")

    const { data, error } = await supervisor.rpc("agenda_do_vendedor")
    expect(error).toBeNull()
    const rows = (data ?? []) as AgendaRow[]

    const rowA = rows.find((r) => r.item_id === seedA.tarefaId)
    const rowB = rows.find((r) => r.item_id === seedB.tarefaId)
    expect(rowA).toBeDefined()
    expect(rowB).toBeDefined()
    expect(rowA?.responsavel).toBe(vendedorAId)
    expect(rowB?.responsavel).toBe(vendedorBId)
    expect(rowA?.responsavel_nome).toBeTruthy()
    expect(rowB?.responsavel_nome).toBeTruthy()
  })
})

describe("RLS agenda_do_vendedor: usuario nao autenticado", () => {
  it("anonimo: chamada sem sessao nao devolve nenhum item dos clientes semeados", async () => {
    const seedA = await seedClienteComPendente(vendedorAId, "anonimo")

    const anon = anonClient()
    const { data, error } = await anon.rpc("agenda_do_vendedor")

    if (error) {
      expect(error).not.toBeNull()
    } else {
      const ids = ((data ?? []) as AgendaRow[]).map((r) => r.cliente_id)
      expect(ids).not.toContain(seedA.clienteId)
    }
  })
})
