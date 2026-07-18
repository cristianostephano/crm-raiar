import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Behavior tests for `dashboard_clientes_por_etapa()` (DSH-01).
 *
 * Mirrors tests/clientes/rls-clientes.test.ts's structure: seed via a
 * signed-in Vendedor A client, clean up via service role in afterEach.
 *
 * DSH-08 (04-CONTEXT.md D-08): this metric is a live snapshot of the current
 * pipeline — the function takes NO date parameters, so every assertion here
 * calls the RPC with zero arguments.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Dashboard ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function baseClienteFields(
  razaoSocial: string,
  responsavelId: string,
  etapa: string
) {
  return {
    razao_social: razaoSocial,
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: responsavelId,
    etapa,
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

type EtapaTotalRow = { etapa: string; total: number | string }

function toEtapaCountMap(rows: EtapaTotalRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.etapa, Number(row.total)]))
}

describe("dashboard_clientes_por_etapa", () => {
  it("takes no parameters and returns per-etapa counts scoped to the caller's own clientes (DSH-01, DSH-08 snapshot)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const { data: before, error: beforeError } = await vendedorA.rpc(
      "dashboard_clientes_por_etapa"
    )
    expect(beforeError).toBeNull()
    const beforeCounts = toEtapaCountMap((before ?? []) as EtapaTotalRow[])

    const razaoSocial1 = uniqueRazaoSocial("etapa-a")
    const razaoSocial2 = uniqueRazaoSocial("etapa-b")

    const { data: c1, error: e1 } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial1, vendedorAId, "conversa_comprador"))
      .select("id")
      .single()
    expect(e1).toBeNull()
    createdClienteIds.push(c1!.id)

    const { data: c2, error: e2 } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial2, vendedorAId, "aguardando_feedback"))
      .select("id")
      .single()
    expect(e2).toBeNull()
    createdClienteIds.push(c2!.id)

    const { data: after, error: afterError } = await vendedorA.rpc(
      "dashboard_clientes_por_etapa"
    )
    expect(afterError).toBeNull()
    const afterCounts = toEtapaCountMap((after ?? []) as EtapaTotalRow[])

    expect(afterCounts.conversa_comprador ?? 0).toBe(
      (beforeCounts.conversa_comprador ?? 0) + 1
    )
    expect(afterCounts.aguardando_feedback ?? 0).toBe(
      (beforeCounts.aguardando_feedback ?? 0) + 1
    )
    // Deliberately NOT asserting a whole-sum delta here: other dashboard
    // test files run concurrently against this same shared vendedorA
    // account (e.g. ganhos-perdidos.test.ts creates/deletes its own
    // 'primeira_venda' clientes mid-test), so the grand total across every
    // etapa isn't stable within this test's narrow before/after window.
    // Per-etapa deltas on etapas this test owns exclusively are the stable
    // assertion; "no bleed from any other vendedor's rows" (RLS isolation)
    // is proven precisely by tests/dashboard/rls-dashboard.test.ts instead.
  })
})
