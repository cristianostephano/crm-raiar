import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * RLS negative-case tests for `clientes` (Phase 2 Plan 1).
 *
 * Reuses the seeded SEED_ACCOUNTS (supervisor / vendedorA / vendedorB) from
 * tests/auth/rls-roles.test.ts (Pitfall 2 — always test as a restricted
 * role, never only as service-role or Supervisor). All assertions run as a
 * signed-in role via signInAs(); serviceClient() is used ONLY to seed/clean
 * up test data, never to assert RLS behaviour (service-role bypasses RLS
 * entirely and would give a false pass).
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste RLS ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

// Track every cliente id created across the suite so afterEach can always
// clean up via service role, even when a test fails mid-way.
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

describe("RLS: clientes cross-vendedor isolation (Pitfall 2)", () => {
  it("Vendedor B cannot see Vendedor A's cliente; Supervisor sees it", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const razaoSocial = uniqueRazaoSocial("isolamento")

    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId))
      .select("id")
      .single()

    expect(insertError).toBeNull()
    expect(inserted).not.toBeNull()
    createdClienteIds.push(inserted!.id)

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const { data: bSees, error: bError } = await vendedorB
      .from("clientes")
      .select("id")
      .eq("id", inserted!.id)

    expect(bError).toBeNull()
    expect(bSees ?? []).toHaveLength(0)

    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const { data: supervisorSees, error: supervisorError } = await supervisor
      .from("clientes")
      .select("id")
      .eq("id", inserted!.id)

    expect(supervisorError).toBeNull()
    expect(supervisorSees ?? []).toHaveLength(1)
  })
})

describe("RLS: clientes UPDATE WITH CHECK blocks responsavel reassignment", () => {
  it("Vendedor A cannot reassign their own cliente's responsavel to Vendedor B (0 rows affected)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const razaoSocial = uniqueRazaoSocial("reassign")

    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId))
      .select("id")
      .single()

    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const vendedorBId = await getUserId(vendedorB)

    const { data: updateResult, error: updateError } = await vendedorA
      .from("clientes")
      .update({ responsavel: vendedorBId })
      .eq("id", inserted!.id)
      .select("id")

    // The row matches the UPDATE policy's USING clause (responsavel is
    // still Vendedor A), but the resulting new row fails WITH CHECK
    // (responsavel would no longer equal the caller, and the caller is not
    // a supervisor). Postgres rejects this with a 42501 RLS-violation
    // error rather than silently filtering the row (that silent-filter
    // behavior applies to USING on SELECT/DELETE, not to WITH CHECK on
    // UPDATE/INSERT).
    expect(updateError).not.toBeNull()
    expect(updateError?.code).toBe("42501")
    expect(updateResult ?? []).toHaveLength(0)
  })
})

describe("RLS: clientes DELETE is Supervisor-only (CLI-06)", () => {
  it("Vendedor A cannot delete their own cliente (0 rows affected)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const razaoSocial = uniqueRazaoSocial("delete-vendedor")

    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId))
      .select("id")
      .single()

    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { data: deleteResult, error: deleteError } = await vendedorA
      .from("clientes")
      .delete()
      .eq("id", inserted!.id)
      .select("id")

    expect(deleteError).toBeNull()
    expect(deleteResult ?? []).toHaveLength(0)
  })

  it("Supervisor CAN delete any cliente row", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const razaoSocial = uniqueRazaoSocial("delete-supervisor")

    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId))
      .select("id")
      .single()

    expect(insertError).toBeNull()

    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const { data: deleteResult, error: deleteError } = await supervisor
      .from("clientes")
      .delete()
      .eq("id", inserted!.id)
      .select("id")

    expect(deleteError).toBeNull()
    expect(deleteResult ?? []).toHaveLength(1)
    // Already deleted by supervisor; nothing left for afterEach to clean up.
  })
})

describe("RLS: clientes razao_social uniqueness across vendedores (D-06)", () => {
  it("a second insert with an already-existing razao_social fails with 23505", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const razaoSocial = uniqueRazaoSocial("duplicado")

    const { data: firstInsert, error: firstError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId))
      .select("id")
      .single()

    expect(firstError).toBeNull()
    createdClienteIds.push(firstInsert!.id)

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const vendedorBId = await getUserId(vendedorB)

    const { data: secondInsert, error: secondError } = await vendedorB
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorBId))
      .select("id")
      .single()

    expect(secondInsert).toBeNull()
    expect(secondError).not.toBeNull()
    expect(secondError?.code).toBe("23505")
  })
})
