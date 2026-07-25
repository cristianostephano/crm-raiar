import { describe, expect, it } from "vitest"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Integration test for the `importar_clientes_lote` RPC (07-01 Task 3,
 * IMP-01/IMP-06/IMP-09). Unlike `validarLoteImportacao` (a Server Action
 * bound to `next/headers`, not directly callable from Vitest), the RPC is
 * plain `supabase.rpc(...)` and is directly testable from a signed-in
 * supabase-js client — same rationale as `rls-dedup-read.test.ts`.
 *
 * `serviceClient()` is used ONLY to seed lookup ids (categoria/produto) and
 * to read back / tear down created rows — never for the assertion itself
 * (Pitfall 2/10: negative-case tests must run as a restricted role, not
 * service-role, or they'd trivially always pass).
 *
 * Proves the three must-haves from 07-01-PLAN.md:
 *   1. Supervisor bulk-insert lands every row at etapa='aguardando_contato'
 *      (IMP-09, via the clientes.etapa DB default) and populates
 *      cliente_produtos (produtos are not silently dropped).
 *   2. A Vendedor calling the RPC is rejected before any row is written —
 *      the write path is Supervisor-only (T-07-01).
 *   3. A duplicate razão social is skipped via ON CONFLICT DO NOTHING
 *      without aborting the rest of the batch (IMP-06/T-07-04).
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Importar Lote ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function baseRowFields(razaoSocial: string, responsavelId: string) {
  return {
    razao_social: razaoSocial,
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    complemento: null,
    cidade: "São Paulo",
    estado: "SP",
    responsavel: responsavelId,
    categoria_id: null,
    contato: "Fulano de Tal",
    telefone: "11999990000",
    email: null,
    numero_de_lojas: null,
  }
}

async function getUserId(client: Awaited<ReturnType<typeof signInAs>>): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
}

const createdClienteIds: string[] = []

async function cleanup() {
  if (createdClienteIds.length === 0) return
  await serviceClient().from("clientes").delete().in("id", createdClienteIds.splice(0))
}

describe("RLS/behavior: importar_clientes_lote RPC (IMP-01/IMP-06/IMP-09/T-07-01/T-07-04)", () => {
  it("Supervisor bulk-inserts rows at aguardando_contato with produtos populated", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const { data: produto, error: produtoError } = await serviceClient()
      .from("produtos_consumidos")
      .select("id")
      .limit(1)
      .single()
    expect(produtoError).toBeNull()
    const produtoId = produto!.id as string

    const razaoSocialA = uniqueRazaoSocial("supervisor-A")
    const razaoSocialB = uniqueRazaoSocial("supervisor-B")

    const rowA = {
      ...baseRowFields(razaoSocialA, vendedorAId),
      produto_ids: [produtoId],
    }
    const rowB = {
      ...baseRowFields(razaoSocialB, vendedorAId),
      produto_ids: [],
    }

    const { data, error } = await supervisor.rpc("importar_clientes_lote", {
      p_clientes: [rowA, rowB],
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(2)
    for (const row of data!) {
      expect(row.status).toBe("inserido")
      createdClienteIds.push(row.id)
    }

    const { data: insertedRows, error: readError } = await serviceClient()
      .from("clientes")
      .select("id, razao_social, etapa")
      .in("id", createdClienteIds)

    expect(readError).toBeNull()
    expect(insertedRows).not.toBeNull()
    expect(insertedRows!.length).toBe(2)
    for (const row of insertedRows!) {
      expect(row.etapa).toBe("aguardando_contato")
    }

    const insertedRowA = insertedRows!.find((r) => r.razao_social === razaoSocialA)
    expect(insertedRowA).toBeDefined()

    const { data: clienteProdutos, error: cpError } = await serviceClient()
      .from("cliente_produtos")
      .select("produto_id")
      .eq("cliente_id", insertedRowA!.id)

    expect(cpError).toBeNull()
    expect(clienteProdutos).not.toBeNull()
    expect(clienteProdutos!.map((cp) => cp.produto_id)).toContain(produtoId)

    await cleanup()
  })

  it("Vendedor calling the RPC is rejected — no row is written", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const razaoSocial = uniqueRazaoSocial("vendedor-rejected")

    const row = {
      ...baseRowFields(razaoSocial, vendedorAId),
      produto_ids: [],
    }

    const { data, error } = await vendedorA.rpc("importar_clientes_lote", {
      p_clientes: [row],
    })

    expect(error).not.toBeNull()
    expect(data).toBeNull()

    const { data: existing, error: existingError } = await serviceClient()
      .from("clientes")
      .select("id")
      .eq("razao_social", razaoSocial)

    expect(existingError).toBeNull()
    expect(existing ?? []).toHaveLength(0)

    await cleanup()
  })

  it("a duplicate razão social is skipped without blocking the rest of the batch", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const razaoSocialExistente = uniqueRazaoSocial("ja-existe")
    const razaoSocialNova = uniqueRazaoSocial("nova")

    const { data: seeded, error: seedError } = await serviceClient()
      .from("clientes")
      .insert(baseRowFields(razaoSocialExistente, vendedorAId))
      .select("id")
      .single()
    expect(seedError).toBeNull()
    createdClienteIds.push(seeded!.id)

    const rowDuplicada = {
      ...baseRowFields(razaoSocialExistente, vendedorAId),
      produto_ids: [],
    }
    const rowNova = {
      ...baseRowFields(razaoSocialNova, vendedorAId),
      produto_ids: [],
    }

    const { data, error } = await supervisor.rpc("importar_clientes_lote", {
      p_clientes: [rowDuplicada, rowNova],
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(1)
    expect(data![0].razao_social).toBe(razaoSocialNova)
    createdClienteIds.push(data![0].id)

    const { data: existentes, error: existentesError } = await serviceClient()
      .from("clientes")
      .select("id")
      .eq("razao_social", razaoSocialExistente)

    expect(existentesError).toBeNull()
    expect(existentes ?? []).toHaveLength(1)

    const { data: novos, error: novosError } = await serviceClient()
      .from("clientes")
      .select("id")
      .eq("razao_social", razaoSocialNova)

    expect(novosError).toBeNull()
    expect(novos ?? []).toHaveLength(1)

    await cleanup()
  })
})
