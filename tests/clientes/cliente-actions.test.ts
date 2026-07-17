import { afterEach, describe, expect, it } from "vitest"

import { createClienteSchema } from "../../lib/validations/cliente"
import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Tests for the cadastro data layer (createClienteSchema +
 * app/actions/clientes.ts's createCliente Server Action).
 *
 * createCliente() itself cannot be invoked directly from Vitest: it calls
 * lib/supabase/server.ts's createClient(), which reads next/headers'
 * cookies() — that API requires a live Next.js request scope
 * (AsyncLocalStorage) that does not exist under Vitest. Per this plan's
 * explicit test guidance, the duplicate-razao_social behavior is instead
 * proven with a direct signed-in insert exercising the exact same shape the
 * action sends to Postgres — the same 23505 unique-violation the action's
 * `if (error.code === "23505")` branch maps to `{ error: { code:
 * "duplicate_razao_social" } }`.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Cadastro ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

describe("createClienteSchema", () => {
  it("accepts the minimal required fields (CLI-01/CLI-02) with every optional blank", () => {
    const result = createClienteSchema.safeParse({
      razaoSocial: "Acme Ltda",
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      cidade: "São Paulo",
      estado: "SP",
      responsavel: "11111111-1111-1111-1111-111111111111",
    })

    expect(result.success).toBe(true)
  })

  it("rejects a missing required field with a per-field error", () => {
    const result = createClienteSchema.safeParse({
      razaoSocial: "",
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      cidade: "São Paulo",
      estado: "SP",
      responsavel: "11111111-1111-1111-1111-111111111111",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const razaoSocialIssue = result.error.issues.find(
        (issue) => issue.path[0] === "razaoSocial"
      )
      expect(razaoSocialIssue).toBeDefined()
    }
  })

  it("rejects responsavel === '' via object-level superRefine (CLI-03, no default pre-selected)", () => {
    const result = createClienteSchema.safeParse({
      razaoSocial: "Acme Ltda",
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      cidade: "São Paulo",
      estado: "SP",
      responsavel: "",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const responsavelIssue = result.error.issues.find(
        (issue) => issue.path[0] === "responsavel"
      )
      expect(responsavelIssue).toBeDefined()
    }
  })
})

describe("createCliente duplicate razao_social handling (D-06)", () => {
  it("a second insert with an already-existing razao_social fails with 23505 (the code createCliente maps to duplicate_razao_social)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const {
      data: { user: vendedorAUser },
    } = await vendedorA.auth.getUser()
    if (!vendedorAUser) throw new Error("Expected an authenticated Vendedor A")

    const razaoSocial = uniqueRazaoSocial("duplicado-action")

    const { data: firstInsert, error: firstError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAUser.id))
      .select("id")
      .single()

    expect(firstError).toBeNull()
    expect(firstInsert).not.toBeNull()
    createdClienteIds.push(firstInsert!.id)

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const {
      data: { user: vendedorBUser },
    } = await vendedorB.auth.getUser()
    if (!vendedorBUser) throw new Error("Expected an authenticated Vendedor B")

    const { data: secondInsert, error: secondError } = await vendedorB
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorBUser.id))
      .select("id")
      .single()

    expect(secondInsert).toBeNull()
    expect(secondError).not.toBeNull()
    expect(secondError?.code).toBe("23505")
  })

  it("clientes.etapa defaults to 'aguardando_contato' on insert (FUN-01 origin stage)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const {
      data: { user: vendedorAUser },
    } = await vendedorA.auth.getUser()
    if (!vendedorAUser) throw new Error("Expected an authenticated Vendedor A")

    const razaoSocial = uniqueRazaoSocial("etapa-inicial")

    const { data: inserted, error } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAUser.id))
      .select("id, etapa")
      .single()

    expect(error).toBeNull()
    expect(inserted).not.toBeNull()
    createdClienteIds.push(inserted!.id)
    expect(inserted!.etapa).toBe("aguardando_contato")
  })
})
