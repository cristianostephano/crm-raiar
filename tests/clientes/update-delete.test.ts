import { afterEach, describe, expect, it } from "vitest"

import { updateClienteSchema } from "../../lib/validations/cliente"
import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Tests for the edit/delete data layer (Phase 2 Plan 6): updateClienteSchema
 * + the RLS guarantees updateCliente/deleteCliente (app/actions/clientes.ts)
 * rely on as their real authorization boundary.
 *
 * Like createCliente (see tests/clientes/cliente-actions.test.ts's header
 * comment), updateCliente/deleteCliente cannot be invoked directly from
 * Vitest — they call lib/supabase/server.ts's createClient(), which reads
 * next/headers' cookies() and needs a live Next.js request scope. So, per
 * this plan's own test guidance, the behavior each action depends on is
 * proven with direct signed-in Supabase calls exercising the exact same
 * UPDATE/DELETE shape the action sends to Postgres — the CLI-05/CLI-06
 * negative cases (Vendedor cannot delete, cannot reassign responsavel) are
 * already covered as pure-RLS tests in tests/clientes/rls-clientes.test.ts
 * (written in 02-01); they are reproduced here too because this plan's own
 * Server Actions are what actually depend on those guarantees holding.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste UpdateDelete ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

describe("updateClienteSchema", () => {
  it("accepts a full valid edit payload, including the optional CLI-02 fields", () => {
    const result = updateClienteSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      razaoSocial: "Acme Ltda",
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      cidade: "São Paulo",
      estado: "SP",
      responsavel: "22222222-2222-2222-2222-222222222222",
      categoriaId: "33333333-3333-3333-3333-333333333333",
      contato: "Fulano de Tal",
      telefone: "11999999999",
      email: "fulano@example.com",
      numeroDeLojas: 2,
      produtoIds: ["44444444-4444-4444-4444-444444444444"],
    })

    expect(result.success).toBe(true)
  })

  it("rejects a missing required field (razaoSocial) with a per-field error", () => {
    const result = updateClienteSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      razaoSocial: "",
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      cidade: "São Paulo",
      estado: "SP",
      responsavel: "22222222-2222-2222-2222-222222222222",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path[0] === "razaoSocial"
      )
      expect(issue).toBeDefined()
    }
  })

  it("rejects responsavel === '' via object-level superRefine (no defaults silently accepted)", () => {
    const result = updateClienteSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
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
      const issue = result.error.issues.find(
        (i) => i.path[0] === "responsavel"
      )
      expect(issue).toBeDefined()
    }
  })
})

describe("updateCliente's underlying guarantee: Vendedor A can edit their own cliente's optional fields", () => {
  it("Vendedor A can UPDATE contato/telefone on their own cliente (CLI-02/CLI-06)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const {
      data: { user: vendedorAUser },
    } = await vendedorA.auth.getUser()
    if (!vendedorAUser) throw new Error("Expected an authenticated Vendedor A")

    const razaoSocial = uniqueRazaoSocial("update-optional")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAUser.id))
      .select("id")
      .single()

    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { data: updated, error: updateError } = await vendedorA
      .from("clientes")
      .update({ contato: "Maria Souza", telefone: "11988887777" })
      .eq("id", inserted!.id)
      .select("id, contato, telefone")
      .single()

    expect(updateError).toBeNull()
    expect(updated?.contato).toBe("Maria Souza")
    expect(updated?.telefone).toBe("11988887777")
  })

  it("Vendedor A can sync cliente_produtos for their own cliente (multi-value produtos consumidos)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const {
      data: { user: vendedorAUser },
    } = await vendedorA.auth.getUser()
    if (!vendedorAUser) throw new Error("Expected an authenticated Vendedor A")

    const razaoSocial = uniqueRazaoSocial("update-produtos")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAUser.id))
      .select("id")
      .single()

    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { data: produtos, error: produtosError } = await vendedorA
      .from("produtos_consumidos")
      .select("id")
      .limit(1)

    expect(produtosError).toBeNull()
    expect(produtos ?? []).not.toHaveLength(0)
    const produtoId = produtos![0].id as string

    const { error: linkError } = await vendedorA
      .from("cliente_produtos")
      .insert({ cliente_id: inserted!.id, produto_id: produtoId })

    expect(linkError).toBeNull()

    const { data: linked, error: readError } = await vendedorA
      .from("cliente_produtos")
      .select("produto_id")
      .eq("cliente_id", inserted!.id)

    expect(readError).toBeNull()
    expect(linked ?? []).toHaveLength(1)
  })
})

describe("deleteCliente's underlying guarantee: Supervisor-only (CLI-05/CLI-06)", () => {
  it("Vendedor A cannot DELETE their own cliente (0 rows affected — deleteCliente's forbidden path never needs to be reached for RLS to already fail closed)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const {
      data: { user: vendedorAUser },
    } = await vendedorA.auth.getUser()
    if (!vendedorAUser) throw new Error("Expected an authenticated Vendedor A")

    const razaoSocial = uniqueRazaoSocial("delete-forbidden")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAUser.id))
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

  it("Supervisor CAN delete a cliente", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const {
      data: { user: vendedorAUser },
    } = await vendedorA.auth.getUser()
    if (!vendedorAUser) throw new Error("Expected an authenticated Vendedor A")

    const razaoSocial = uniqueRazaoSocial("delete-supervisor")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAUser.id))
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

describe("updateCliente's responsavel-stripping guarantee is backstopped by RLS (T-02-19)", () => {
  it("a Vendedor's attempt to reassign responsavel to another vendedor fails at the RLS layer (0 rows / 42501)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const {
      data: { user: vendedorAUser },
    } = await vendedorA.auth.getUser()
    if (!vendedorAUser) throw new Error("Expected an authenticated Vendedor A")

    const razaoSocial = uniqueRazaoSocial("reassign-blocked")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAUser.id))
      .select("id")
      .single()

    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const {
      data: { user: vendedorBUser },
    } = await vendedorB.auth.getUser()
    if (!vendedorBUser) throw new Error("Expected an authenticated Vendedor B")

    const { data: updateResult, error: updateError } = await vendedorA
      .from("clientes")
      .update({ responsavel: vendedorBUser.id })
      .eq("id", inserted!.id)
      .select("id")

    // Same WITH CHECK failure mode as tests/clientes/rls-clientes.test.ts —
    // reproduced here because updateCliente() is the Server Action that
    // actually depends on this guarantee holding (it strips the change
    // server-side too, as defense in depth, but this is the real boundary).
    expect(updateError).not.toBeNull()
    expect(updateError?.code).toBe("42501")
    expect(updateResult ?? []).toHaveLength(0)
  })
})
