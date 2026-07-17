import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"
import { ETAPA_FINAL } from "../../lib/funil/etapas"

/**
 * Funil business-rule negative-case tests (Phase 2 Plan 1) — FUN-05/FUN-06.
 *
 * These hit the clientes table API directly (raw UPDATE / rpc call),
 * bypassing any future UI/RPC wrapper, to prove the rules are enforced as
 * DB CHECK constraints (Pitfall 6, Pitfall 10's "Looks Done But Isn't"
 * checklist item: "verify via a direct API/RPC call bypassing the UI").
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Funil ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

describe("Funil constraint: ganho only from the final stage (FUN-05)", () => {
  it("direct UPDATE setting status_acompanhamento='ganho' while etapa is not primeira_venda is rejected", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "ganho-invalido")

    // Default etapa is 'aguardando_contato', not the final stage.
    const { error } = await vendedorA
      .from("clientes")
      .update({ status_acompanhamento: "ganho" })
      .eq("id", clienteId)

    expect(error).not.toBeNull()
    expect(error?.code).toBe("23514") // Postgres CHECK constraint violation
  })

  it("direct UPDATE setting status_acompanhamento='ganho' while etapa=primeira_venda succeeds", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "ganho-valido")

    const { error: stageError } = await vendedorA
      .from("clientes")
      .update({ etapa: ETAPA_FINAL })
      .eq("id", clienteId)

    expect(stageError).toBeNull()

    const { data, error } = await vendedorA
      .from("clientes")
      .update({ status_acompanhamento: "ganho" })
      .eq("id", clienteId)
      .select("id, status_acompanhamento")

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
    expect(data?.[0]?.status_acompanhamento).toBe("ganho")
  })
})

describe("Funil constraint: perdido requires motivo_perda_id (FUN-06)", () => {
  it("direct UPDATE setting status_acompanhamento='perdido' with motivo_perda_id NULL is rejected", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "perdido-sem-motivo")

    const { error } = await vendedorA
      .from("clientes")
      .update({ status_acompanhamento: "perdido", motivo_perda_id: null })
      .eq("id", clienteId)

    expect(error).not.toBeNull()
    expect(error?.code).toBe("23514")
  })
})

describe("Funil RPC: mover_card_funil raises a readable exception on invalid ganho transition", () => {
  it("rpc('mover_card_funil', ...) with an invalid ganho transition raises an exception", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "rpc-ganho-invalido")

    const { error } = await vendedorA.rpc("mover_card_funil", {
      p_cliente_id: clienteId,
      p_nova_etapa: "aguardando_contato",
      p_novo_status: "ganho",
    })

    expect(error).not.toBeNull()
    expect(error?.message).toBeTruthy()
  })
})
