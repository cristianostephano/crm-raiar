import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Tests for the status/tarefas data layer (Phase 2 Plan 7) —
 * marcarStatus/adicionarTarefa/toggleTarefa/removerTarefa
 * (app/actions/funil.ts, app/actions/tarefas.ts).
 *
 * Like createCliente/updateCliente (see 02-02/02-06's SUMMARY test-authoring
 * notes), these Server Actions call lib/supabase/server.ts's createClient(),
 * which reads next/headers' cookies() and needs a live Next.js request
 * scope — so they cannot be invoked directly from Vitest. Per this plan's
 * own test guidance, each action's behavior is proven by exercising the
 * exact same RPC/table call the action sends to Postgres, as a real
 * signed-in Vendedor/Supervisor session (never service-role, Pitfall 2) —
 * serviceClient() is used ONLY to seed/clean up test data.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste FunilStatus ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

const createdClienteIds: string[] = []
const createdTarefaIds: string[] = []

afterEach(async () => {
  const admin = serviceClient()
  if (createdTarefaIds.length > 0) {
    await admin.from("tarefas").delete().in("id", createdTarefaIds.splice(0))
  }
  if (createdClienteIds.length > 0) {
    await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
  }
})

async function getUserId(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
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

async function firstMotivoPerdaId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client
    .from("motivos_perda")
    .select("id")
    .limit(1)
  if (error || !data || data.length === 0) {
    throw new Error(`Failed to load a motivo_perda: ${error?.message}`)
  }
  return data[0].id as string
}

async function firstTipoTarefaId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client
    .from("tipos_tarefa")
    .select("id")
    .limit(1)
  if (error || !data || data.length === 0) {
    throw new Error(`Failed to load a tipo_tarefa: ${error?.message}`)
  }
  return data[0].id as string
}

/**
 * Mirrors exactly what marcarStatus() sends: mover_card_funil with the
 * card's CURRENT etapa (a status-only change never moves columns).
 */
async function callMarcarStatusRpc(
  client: SupabaseClient,
  clienteId: string,
  etapaAtual: string,
  novoStatus: "em_andamento" | "perdido" | "ganho",
  motivoPerdaId?: string | null
) {
  return client.rpc("mover_card_funil", {
    p_cliente_id: clienteId,
    p_nova_etapa: etapaAtual,
    p_novo_status: novoStatus,
    p_motivo_perda_id: motivoPerdaId ?? null,
  })
}

describe("marcarStatus's underlying guarantee: ganho only from the final stage (FUN-05)", () => {
  it("marcarStatus routes through mover_card_funil, which rejects ganho from a non-final stage", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "ganho-nao-final")

    // Default etapa is 'aguardando_contato', not the final stage — same
    // rejection path marcarStatus's own pre-check short-circuits before ever
    // reaching this RPC call.
    const { error } = await callMarcarStatusRpc(
      vendedorA,
      clienteId,
      "aguardando_contato",
      "ganho"
    )

    expect(error).not.toBeNull()
  })
})

describe("marcarStatus's underlying guarantee: perdido requires motivo_perda_id (FUN-06)", () => {
  it("perdido without motivo is rejected by mover_card_funil", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "perdido-sem-motivo")

    const { error } = await callMarcarStatusRpc(
      vendedorA,
      clienteId,
      "aguardando_contato",
      "perdido",
      null
    )

    expect(error).not.toBeNull()
  })

  it("perdido with a motivo succeeds AND writes exactly one historico row for that cliente (FUN-10)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "perdido-com-motivo")
    const motivoPerdaId = await firstMotivoPerdaId(vendedorA)

    const { error } = await callMarcarStatusRpc(
      vendedorA,
      clienteId,
      "aguardando_contato",
      "perdido",
      motivoPerdaId
    )

    expect(error).toBeNull()

    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("status_acompanhamento, motivo_perda_id")
      .eq("id", clienteId)
      .single()

    expect(readError).toBeNull()
    expect(cliente?.status_acompanhamento).toBe("perdido")
    expect(cliente?.motivo_perda_id).toBe(motivoPerdaId)

    // The 02-01 clientes_after_update_historico trigger — not any action —
    // is what writes this row (T-02-25: no user-facing historico INSERT
    // policy exists at all).
    const { data: historico, error: historicoError } = await vendedorA
      .from("historico")
      .select("id, tipo")
      .eq("cliente_id", clienteId)
      .eq("tipo", "status_acompanhamento")

    expect(historicoError).toBeNull()
    expect(historico ?? []).toHaveLength(1)
  })
})

describe("toggleTarefa's underlying guarantee: completing a task writes exactly one historico row (FUN-10)", () => {
  it("flipping concluida false -> true creates one historico row", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "tarefa-concluida")
    const tipoTarefaId = await firstTipoTarefaId(vendedorA)

    const { data: tarefa, error: insertError } = await vendedorA
      .from("tarefas")
      .insert({ cliente_id: clienteId, tipo_tarefa_id: tipoTarefaId })
      .select("id")
      .single()

    expect(insertError).toBeNull()
    createdTarefaIds.push(tarefa!.id)

    const { data: updated, error: updateError } = await vendedorA
      .from("tarefas")
      .update({ concluida: true })
      .eq("id", tarefa!.id)
      .select("id, concluida, concluida_em")
      .single()

    expect(updateError).toBeNull()
    expect(updated?.concluida).toBe(true)
    expect(updated?.concluida_em).not.toBeNull()

    const { data: historico, error: historicoError } = await vendedorA
      .from("historico")
      .select("id, tipo")
      .eq("cliente_id", clienteId)
      .eq("tipo", "tarefa_concluida")

    expect(historicoError).toBeNull()
    expect(historico ?? []).toHaveLength(1)
  })
})

describe("tarefas RLS is parent-cliente-gated (T-02-24) — a Vendedor cannot touch a non-owned cliente's tarefas", () => {
  it("Vendedor B toggling a tarefa on Vendedor A's cliente is a no-op (0 rows affected)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "tarefa-cross-vendedor")
    const tipoTarefaId = await firstTipoTarefaId(vendedorA)

    const { data: tarefa, error: insertError } = await vendedorA
      .from("tarefas")
      .insert({ cliente_id: clienteId, tipo_tarefa_id: tipoTarefaId })
      .select("id")
      .single()

    expect(insertError).toBeNull()
    createdTarefaIds.push(tarefa!.id)

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )

    const { data: updateResult, error: updateError } = await vendedorB
      .from("tarefas")
      .update({ concluida: true })
      .eq("id", tarefa!.id)
      .select("id")

    expect(updateError).toBeNull()
    expect(updateResult ?? []).toHaveLength(0)

    // Confirm it's genuinely untouched, not just a filtered SELECT response.
    const { data: stillOpen } = await vendedorA
      .from("tarefas")
      .select("concluida")
      .eq("id", tarefa!.id)
      .single()
    expect(stillOpen?.concluida).toBe(false)
  })
})
