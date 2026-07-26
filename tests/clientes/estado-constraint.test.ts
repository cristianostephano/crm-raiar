import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Integration tests for the `chk_estado_valido` CHECK constraint (Phase 9
 * Plan 1, LOC-01/LOC-04).
 *
 * Follows the funil-constraints.test.ts pattern: signInAs a restricted role
 * (vendedorA), hit the clientes table directly via a raw insert (bypassing
 * any future UI/RPC wrapper) to prove the rule is enforced as a DB CHECK
 * constraint, not just client-side validation.
 *
 * RED until Task 3 (`supabase db push`) applies migration 0007 — the
 * constraint does not exist yet.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Estado ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function baseClienteFields(razaoSocial: string, responsavelId: string, estado: string) {
  return {
    razao_social: razaoSocial,
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado,
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

describe("chk_estado_valido rejects an invalid UF (LOC-01)", () => {
  it("direct INSERT with estado='ZZ' is rejected with a CHECK violation and creates no row", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const razaoSocial = uniqueRazaoSocial("uf-invalida")

    const { data, error } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId, "ZZ"))
      .select("id")

    expect(error).not.toBeNull()
    expect(error?.code).toBe("23514") // Postgres CHECK constraint violation
    expect(data ?? []).toHaveLength(0)

    // Confirm no row was actually created for this razao_social.
    const admin = serviceClient()
    const { data: rows } = await admin
      .from("clientes")
      .select("id")
      .eq("razao_social", razaoSocial)
    expect(rows ?? []).toHaveLength(0)
  })
})

describe("chk_estado_valido does not block access to valid clientes (LOC-04 positive control)", () => {
  it("direct INSERT with estado='SP' succeeds and the row remains readable", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const razaoSocial = uniqueRazaoSocial("uf-valida")

    const { data, error } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId, "SP"))
      .select("id")
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    if (data?.id) createdClienteIds.push(data.id)

    const { data: lido, error: erroLeitura } = await vendedorA
      .from("clientes")
      .select("id, estado")
      .eq("id", data?.id)
      .single()

    expect(erroLeitura).toBeNull()
    expect(lido?.estado).toBe("SP")
  })
})
