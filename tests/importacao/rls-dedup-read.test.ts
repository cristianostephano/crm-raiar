import { describe, expect, it } from "vitest"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * RLS negative-case test for the import preview's duplicate-check read
 * (06-02 Task 3, IMP-10/T-06-02). validarLoteImportacao itself calls
 * createClient() (next/headers-bound, see lib/supabase/server.ts), so it
 * cannot be invoked directly from Vitest — same constraint recorded for
 * createCliente in 02-02 and getClientesParaExportacao in 05-01. Instead
 * this exercises the exact `clientes.select("razao_social")` shape the
 * Server Action uses for dedup, signed in as each seeded role (Pitfall
 * 2/10 — negative-case tests from a restricted role, never service-role for
 * the assertion). serviceClient() is used ONLY to seed/clean up test data.
 *
 * This proves the dedup read is RLS-scoped: a Vendedor's duplicate-check
 * query never sees another vendedor's razão social (so the dedup step in
 * validarLoteImportacao can never leak the full customer base to a
 * non-Supervisor caller), while a Supervisor's query sees the whole base —
 * exactly the set findDuplicates needs to compare a batch against. The
 * app-layer `forbidden` gate itself (rejecting a non-Supervisor caller
 * before any read) mirrors deleteCliente's discipline and is not
 * independently re-testable here without a live Next.js request scope —
 * documented, not re-proven, per the same constraint as above.
 */

const DEDUP_COLUMNS = "razao_social"

function uniqueRazaoSocial(label: string): string {
  return `Teste Dedup ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

async function getUserId(client: Awaited<ReturnType<typeof signInAs>>): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
}

describe("RLS: import dedup read scoping (IMP-10/T-06-02)", () => {
  it("Vendedor A's dedup select does not see Vendedor B's razão social", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const razaoSocialA = uniqueRazaoSocial("vendedorA")

    const { data: insertedA, error: insertAError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocialA, vendedorAId))
      .select("id")
      .single()
    expect(insertAError).toBeNull()
    createdClienteIds.push(insertedA!.id)

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const vendedorBId = await getUserId(vendedorB)
    const razaoSocialB = uniqueRazaoSocial("vendedorB")

    const { data: insertedB, error: insertBError } = await vendedorB
      .from("clientes")
      .insert(baseClienteFields(razaoSocialB, vendedorBId))
      .select("id")
      .single()
    expect(insertBError).toBeNull()
    createdClienteIds.push(insertedB!.id)

    const { data: dedupReadA, error: dedupErrorA } = await vendedorA
      .from("clientes")
      .select(DEDUP_COLUMNS)

    expect(dedupErrorA).toBeNull()
    const razoesA = (dedupReadA ?? []).map((row) => row.razao_social)
    expect(razoesA).toContain(razaoSocialA)
    expect(razoesA).not.toContain(razaoSocialB)

    await serviceClient().from("clientes").delete().in("id", createdClienteIds.splice(0))
  })

  it("Supervisor's dedup select sees razão social across all vendedores", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const razaoSocialA = uniqueRazaoSocial("vendedorA-super")

    const { data: insertedA, error: insertAError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocialA, vendedorAId))
      .select("id")
      .single()
    expect(insertAError).toBeNull()
    createdClienteIds.push(insertedA!.id)

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const vendedorBId = await getUserId(vendedorB)
    const razaoSocialB = uniqueRazaoSocial("vendedorB-super")

    const { data: insertedB, error: insertBError } = await vendedorB
      .from("clientes")
      .insert(baseClienteFields(razaoSocialB, vendedorBId))
      .select("id")
      .single()
    expect(insertBError).toBeNull()
    createdClienteIds.push(insertedB!.id)

    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )

    const { data: dedupReadSupervisor, error: dedupErrorSupervisor } = await supervisor
      .from("clientes")
      .select(DEDUP_COLUMNS)

    expect(dedupErrorSupervisor).toBeNull()
    const razoesSupervisor = (dedupReadSupervisor ?? []).map((row) => row.razao_social)
    expect(razoesSupervisor).toContain(razaoSocialA)
    expect(razoesSupervisor).toContain(razaoSocialB)

    await serviceClient().from("clientes").delete().in("id", createdClienteIds.splice(0))
  })
})
