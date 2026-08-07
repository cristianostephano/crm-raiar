import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"
import { ETAPA_FINAL } from "../../lib/funil/etapas"

/**
 * RLS negative-case tests for `visitas` (Fase 13 Plan 1, T-13-01). Proves
 * the four parent-gated policies match `tarefas`'s pattern (RLS does NOT
 * cascade via foreign key — 0002_clientes_and_funil.sql): Vendedor B cannot
 * select/insert/update/delete a visita belonging to Vendedor A's cliente,
 * while Vendedor A (owner) and the Supervisor can. Also proves
 * `mover_card_funil`'s row_count guard (T-13-02) blocks visita seeding on a
 * cross-vendedor call.
 *
 * Same pattern as every other RLS test in this project: real signed-in
 * sessions via signInAs()/SEED_ACCOUNTS (Pitfall 2), serviceClient() used
 * ONLY to seed/clean up test data, never to assert RLS behaviour.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste RLSVisitas ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  const admin = serviceClient()
  // `on delete cascade` em visitas.cliente_id cobre a limpeza das visitas.
  await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
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

async function createTestVisita(
  client: SupabaseClient,
  clienteId: string
): Promise<string> {
  const { data, error } = await client
    .from("visitas")
    .insert({ cliente_id: clienteId, data_prevista: "2026-12-01" })
    .select("id")
    .single()
  if (error || !data) {
    throw new Error(`Failed to seed test visita: ${error?.message}`)
  }
  return data.id
}

/** Cenário base comum a todos os casos: cliente + visita de Vendedor A. */
async function seedClienteEVisitaDeA(label: string) {
  const vendedorA = await signInAs(
    SEED_ACCOUNTS.vendedorA.email,
    SEED_ACCOUNTS.vendedorA.password
  )
  const vendedorAId = await getUserId(vendedorA)
  const clienteId = await createTestCliente(vendedorA, vendedorAId, label)
  const visitaId = await createTestVisita(vendedorA, clienteId)
  return { vendedorA, vendedorAId, clienteId, visitaId }
}

describe("RLS visitas: select (T-13-01)", () => {
  it("select: Vendedor B nao ve a visita de Vendedor A; Supervisor ve", async () => {
    const { visitaId } = await seedClienteEVisitaDeA("select")

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const { data: bSees, error: bError } = await vendedorB
      .from("visitas")
      .select("id")
      .eq("id", visitaId)
    expect(bError).toBeNull()
    expect(bSees ?? []).toHaveLength(0)

    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const { data: supervisorSees, error: supervisorError } = await supervisor
      .from("visitas")
      .select("id")
      .eq("id", visitaId)
    expect(supervisorError).toBeNull()
    expect(supervisorSees ?? []).toHaveLength(1)
  })
})

describe("RLS visitas: insert (T-13-01)", () => {
  it("insert: Vendedor B nao consegue inserir visita no cliente de Vendedor A", async () => {
    const { clienteId } = await seedClienteEVisitaDeA("insert")

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const { data: inserted, error: insertError } = await vendedorB
      .from("visitas")
      .insert({ cliente_id: clienteId, data_prevista: "2026-12-15" })
      .select("id")
    expect(insertError).not.toBeNull()
    expect(inserted ?? []).toHaveLength(0)

    const admin = serviceClient()
    const { data: visitasDoCliente } = await admin
      .from("visitas")
      .select("id")
      .eq("cliente_id", clienteId)
    // Só a visita original semeada em seedClienteEVisitaDeA continua lá.
    expect(visitasDoCliente ?? []).toHaveLength(1)
  })
})

describe("RLS visitas: update (T-13-01)", () => {
  it("update: Vendedor B nao consegue alterar a visita de Vendedor A (0 linhas afetadas)", async () => {
    const { visitaId } = await seedClienteEVisitaDeA("update")

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const { data: updateResult, error: updateError } = await vendedorB
      .from("visitas")
      .update({ data_prevista: "2099-01-01" })
      .eq("id", visitaId)
      .select("id")
    expect(updateError).toBeNull()
    expect(updateResult ?? []).toHaveLength(0)

    const admin = serviceClient()
    const { data: reread } = await admin
      .from("visitas")
      .select("data_prevista")
      .eq("id", visitaId)
      .single()
    expect(reread?.data_prevista).toBe("2026-12-01")
  })
})

describe("RLS visitas: delete (T-13-01)", () => {
  it("delete: Vendedor B nao consegue apagar a visita de Vendedor A (0 linhas afetadas)", async () => {
    const { visitaId } = await seedClienteEVisitaDeA("delete")

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const { data: deleteResult, error: deleteError } = await vendedorB
      .from("visitas")
      .delete()
      .eq("id", visitaId)
      .select("id")
    expect(deleteError).toBeNull()
    expect(deleteResult ?? []).toHaveLength(0)

    const admin = serviceClient()
    const { data: aindaExiste } = await admin
      .from("visitas")
      .select("id")
      .eq("id", visitaId)
    expect(aindaExiste ?? []).toHaveLength(1)
  })
})

describe("RLS visitas: dono (proprio) consegue select/update/delete", () => {
  it("proprio: Vendedor A opera normalmente sobre a propria visita", async () => {
    const { vendedorA, visitaId } = await seedClienteEVisitaDeA("proprio")

    const { data: selectResult, error: selectError } = await vendedorA
      .from("visitas")
      .select("id")
      .eq("id", visitaId)
    expect(selectError).toBeNull()
    expect(selectResult ?? []).toHaveLength(1)

    const { data: updateResult, error: updateError } = await vendedorA
      .from("visitas")
      .update({ resumo: "visita realizada, tudo certo" })
      .eq("id", visitaId)
      .select("id, resumo")
    expect(updateError).toBeNull()
    expect(updateResult ?? []).toHaveLength(1)
    expect(updateResult?.[0]?.resumo).toBe("visita realizada, tudo certo")

    const { data: deleteResult, error: deleteError } = await vendedorA
      .from("visitas")
      .delete()
      .eq("id", visitaId)
      .select("id")
    expect(deleteError).toBeNull()
    expect(deleteResult ?? []).toHaveLength(1)
  })
})

describe("RLS via RPC: mover_card_funil nao semeia visita em cliente alheio (T-13-02)", () => {
  it("rpc: Vendedor B chamando mover_card_funil no cliente de A nao marca ganho nem semeia visita", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "rpc-cross-vendedor")

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    // A chamada em si não precisa falhar (a RLS filtra silenciosamente o
    // UPDATE por dentro do RPC) — o que importa é que nada mudou.
    await vendedorB.rpc("mover_card_funil", {
      p_cliente_id: clienteId,
      p_nova_etapa: ETAPA_FINAL,
      p_novo_status: "ganho",
      p_frequencia_visita: "semanal",
    })

    const admin = serviceClient()
    const { data: cliente } = await admin
      .from("clientes")
      .select("status_acompanhamento")
      .eq("id", clienteId)
      .single()
    expect(cliente?.status_acompanhamento).not.toBe("ganho")

    const { data: visitas } = await admin
      .from("visitas")
      .select("id")
      .eq("cliente_id", clienteId)
    expect(visitas ?? []).toHaveLength(0)
  })
})
