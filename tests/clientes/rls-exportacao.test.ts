import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * RLS negative-case tests for the export read (05-01, EXP-01/EXP-02/EXP-03).
 *
 * getClientesParaExportacao() itself calls createClient() (next/headers-
 * bound), so it can't be invoked directly from Vitest (same constraint
 * recorded for createCliente in 02-02). Instead this asserts the RLS
 * behaviour directly against the same `clientes` SELECT + `.in("id", ids)`
 * shape the function uses, signed in as each seeded role (Pitfall 2/10 —
 * negative-case tests from a restricted role, never service-role for the
 * assertion). serviceClient() is used ONLY to seed/clean up test data.
 */

const EXPORT_COLUMNS =
  "id, razao_social, etapa, status_acompanhamento, responsavel"

function uniqueRazaoSocial(label: string): string {
  return `Teste Export ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

describe("RLS: clientes export read scoping (EXP-01/EXP-02)", () => {
  it("Vendedor A's export select returns only Vendedor A's own clientes", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const { data: insertedA, error: insertAError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(uniqueRazaoSocial("vendedorA"), vendedorAId))
      .select("id")
      .single()
    expect(insertAError).toBeNull()
    createdClienteIds.push(insertedA!.id)

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const vendedorBId = await getUserId(vendedorB)

    const { data: insertedB, error: insertBError } = await vendedorB
      .from("clientes")
      .insert(baseClienteFields(uniqueRazaoSocial("vendedorB"), vendedorBId))
      .select("id")
      .single()
    expect(insertBError).toBeNull()
    createdClienteIds.push(insertedB!.id)

    const { data: aExport, error: aError } = await vendedorA
      .from("clientes")
      .select(EXPORT_COLUMNS)

    expect(aError).toBeNull()
    const aIds = (aExport ?? []).map((row) => row.id)
    expect(aIds).toContain(insertedA!.id)
    expect(aIds).not.toContain(insertedB!.id)

    // D-03: every returned row carries a non-null etapa.
    for (const row of aExport ?? []) {
      expect(row.etapa).not.toBeNull()
    }
  })

  it("Vendedor A passing a Vendedor B id in the ids array gets 0 rows for it, own ids still come back (EXP-03)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const { data: insertedA, error: insertAError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(uniqueRazaoSocial("vendedorA-narrow"), vendedorAId))
      .select("id")
      .single()
    expect(insertAError).toBeNull()
    createdClienteIds.push(insertedA!.id)

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const vendedorBId = await getUserId(vendedorB)

    const { data: insertedB, error: insertBError } = await vendedorB
      .from("clientes")
      .insert(baseClienteFields(uniqueRazaoSocial("vendedorB-narrow"), vendedorBId))
      .select("id")
      .single()
    expect(insertBError).toBeNull()
    createdClienteIds.push(insertedB!.id)

    const { data: narrowed, error: narrowError } = await vendedorA
      .from("clientes")
      .select(EXPORT_COLUMNS)
      .in("id", [insertedA!.id, insertedB!.id])

    expect(narrowError).toBeNull()
    const narrowedIds = (narrowed ?? []).map((row) => row.id)
    expect(narrowedIds).toContain(insertedA!.id)
    expect(narrowedIds).not.toContain(insertedB!.id)
  })

  it("Supervisor's export select returns clientes across all vendedores", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const { data: insertedA, error: insertAError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(uniqueRazaoSocial("vendedorA-super"), vendedorAId))
      .select("id")
      .single()
    expect(insertAError).toBeNull()
    createdClienteIds.push(insertedA!.id)

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const vendedorBId = await getUserId(vendedorB)

    const { data: insertedB, error: insertBError } = await vendedorB
      .from("clientes")
      .insert(baseClienteFields(uniqueRazaoSocial("vendedorB-super"), vendedorBId))
      .select("id")
      .single()
    expect(insertBError).toBeNull()
    createdClienteIds.push(insertedB!.id)

    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )

    const { data: supervisorExport, error: supervisorError } = await supervisor
      .from("clientes")
      .select(EXPORT_COLUMNS)

    expect(supervisorError).toBeNull()
    const supervisorIds = (supervisorExport ?? []).map((row) => row.id)
    expect(supervisorIds).toContain(insertedA!.id)
    expect(supervisorIds).toContain(insertedB!.id)
  })

  it("ids array narrows an already-RLS-scoped result to exactly those ids", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const { data: insertedA1, error: insertA1Error } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(uniqueRazaoSocial("vendedorA-narrow-1"), vendedorAId))
      .select("id")
      .single()
    expect(insertA1Error).toBeNull()
    createdClienteIds.push(insertedA1!.id)

    const { data: insertedA2, error: insertA2Error } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(uniqueRazaoSocial("vendedorA-narrow-2"), vendedorAId))
      .select("id")
      .single()
    expect(insertA2Error).toBeNull()
    createdClienteIds.push(insertedA2!.id)

    const { data: narrowed, error: narrowError } = await vendedorA
      .from("clientes")
      .select(EXPORT_COLUMNS)
      .in("id", [insertedA1!.id])

    expect(narrowError).toBeNull()
    expect(narrowed ?? []).toHaveLength(1)
    expect(narrowed![0].id).toBe(insertedA1!.id)
  })
})
