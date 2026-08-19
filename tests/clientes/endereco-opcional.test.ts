import { afterEach, describe, expect, it } from "vitest"

import { serviceClient } from "../helpers/supabase-test-clients"

/**
 * Integration tests for migration 0023 (quick task 260819-m8q):
 * `cep`/`rua`/`numero`/`cidade`/`estado` on `clientes` stop being NOT NULL,
 * and `chk_estado_valido` (migration 0007) keeps rejecting empty string
 * without any change to the constraint itself (D-04).
 *
 * Uses `serviceClient()` for every insert, never `signInAs` — what this
 * file proves is a SCHEMA fact (nullability + CHECK behaviour), not an RLS
 * fact, and `signInWithPassword` has a known rate limit in this project
 * (see Blockers/Concerns in STATE.md). `responsavel` is read from an
 * arbitrary existing `profiles` row via the service-role client instead of
 * being derived from a session.
 *
 * RED until the migration is applied to the hosted database (this quick
 * task's checkpoint task) — expected and documented here, same pattern as
 * `tests/clientes/estado-constraint.test.ts`.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Endereco Opcional ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const createdClienteIds: string[] = []

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  const admin = serviceClient()
  await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
})

async function getResponsavelId(): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin.from("profiles").select("id").limit(1).single()
  if (error || !data) {
    throw new Error(`Failed to read a responsavel id from profiles: ${error?.message}`)
  }
  return data.id
}

describe("clientes.cep/rua/numero/cidade/estado aceitam valor nulo (migration 0023)", () => {
  it("direct INSERT with the 5 address fields all null is accepted and creates the row", async () => {
    const admin = serviceClient()
    const responsavelId = await getResponsavelId()
    const razaoSocial = uniqueRazaoSocial("todos-nulos")

    const { data, error } = await admin
      .from("clientes")
      .insert({
        razao_social: razaoSocial,
        responsavel: responsavelId,
        cep: null,
        rua: null,
        numero: null,
        cidade: null,
        estado: null,
      })
      .select("id, cep, rua, numero, cidade, estado")
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    if (data?.id) createdClienteIds.push(data.id)
    expect(data?.cep).toBeNull()
    expect(data?.rua).toBeNull()
    expect(data?.numero).toBeNull()
    expect(data?.cidade).toBeNull()
    expect(data?.estado).toBeNull()
  })

  it("direct INSERT with estado='' (empty string) is rejected with a CHECK violation and creates no row", async () => {
    const admin = serviceClient()
    const responsavelId = await getResponsavelId()
    const razaoSocial = uniqueRazaoSocial("estado-vazio")

    const { data, error } = await admin
      .from("clientes")
      .insert({
        razao_social: razaoSocial,
        responsavel: responsavelId,
        estado: "",
      })
      .select("id")

    expect(error).not.toBeNull()
    expect(error?.code).toBe("23514") // Postgres CHECK constraint violation
    expect(data ?? []).toHaveLength(0)

    const { data: rows } = await admin.from("clientes").select("id").eq("razao_social", razaoSocial)
    expect(rows ?? []).toHaveLength(0)
  })

  it("direct INSERT with estado=null and cidade filled is accepted (fields are independent)", async () => {
    const admin = serviceClient()
    const responsavelId = await getResponsavelId()
    const razaoSocial = uniqueRazaoSocial("estado-nulo-cidade-preenchida")

    const { data, error } = await admin
      .from("clientes")
      .insert({
        razao_social: razaoSocial,
        responsavel: responsavelId,
        cidade: "São Paulo",
        estado: null,
      })
      .select("id, cidade, estado")
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    if (data?.id) createdClienteIds.push(data.id)
    expect(data?.cidade).toBe("São Paulo")
    expect(data?.estado).toBeNull()
  })
})
