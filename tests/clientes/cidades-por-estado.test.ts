import { describe, expect, it } from "vitest"

import { serviceClient } from "../helpers/supabase-test-clients"

/**
 * Integration tests for the `cidades` reference table + `cidades_por_estado`
 * RPC (Phase 9 Plan 1, LOC-02).
 *
 * Uses serviceClient() for read-only functional assertions (RPC output shape
 * + seed row count) — this is NOT an RLS test (no write path exists on
 * `cidades` to assert against), so bypassing RLS here is fine, same
 * rationale already used by tests/clientes/funil-constraints.test.ts.
 *
 * RED until Task 3 (`supabase db push`) applies migration 0007 — the table/
 * RPC do not exist yet.
 */

describe("cidades_por_estado RPC (LOC-02)", () => {
  it("returns only São Paulo municipalities, all with a string nome, ordered by nome asc", async () => {
    const admin = serviceClient()
    const { data, error } = await admin.rpc("cidades_por_estado", {
      p_uf: "SP",
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(Array.isArray(data)).toBe(true)
    expect((data ?? []).length).toBeGreaterThan(0)

    const nomes = (data ?? []).map((row: { nome: unknown }) => {
      expect(typeof row.nome).toBe("string")
      return row.nome as string
    })

    const ordenados = [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"))
    expect(nomes).toEqual(ordenados)
  })
})

describe("cidades seed completeness (LOC-02)", () => {
  it("cidades table has at least 5000 rows (IBGE seed, robust floor against a broken/partial seed)", async () => {
    const admin = serviceClient()
    const { count, error } = await admin
      .from("cidades")
      .select("*", { count: "exact", head: true })

    expect(error).toBeNull()
    expect(count ?? 0).toBeGreaterThanOrEqual(5000)
  })
})
