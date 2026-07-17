import { afterEach, describe, expect, it } from "vitest"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * RLS contract test for the 4 editable-list lookup tables (categorias,
 * produtos_consumidos, tipos_tarefa, motivos_perda) — Phase 3 Plan 1, Task 1.
 *
 * These tables' schema and RLS policies were created in Phase 2 (migration
 * 0002_clientes_and_funil.sql, lines ~51-98 and ~208-245), not this phase —
 * this suite is a regression lock, not a TDD RED gate (tdd_mode is off for
 * this phase). It proves, for all 4 tables at once (their policies are
 * identical): Supervisor-only INSERT/UPDATE, the unique(nome) constraint
 * backing the "duplicate value" UI error, and soft-delete via UPDATE ativo
 * (D-03) rather than DELETE. This is the base-of-database-contract half of
 * ADM-05/D-02 — the app-layer redirect guard is proven separately at the UI
 * level in Task 3.
 *
 * Same discipline as tests/clientes/rls-clientes.test.ts (Pitfall 2): every
 * assertion runs as a real signed-in restricted role (Supervisor or Vendedor
 * A) via signInAs(); serviceClient() is used ONLY in afterEach cleanup,
 * never to assert RLS behaviour (service-role bypasses RLS entirely and
 * would give a false pass).
 *
 * Run in isolation (`npx vitest run tests/configuracoes/rls-listas.test.ts`)
 * — suites with many back-to-back signInWithPassword calls can trip the
 * free-tier auth rate limit, per 02-01-SUMMARY.md.
 */

type TabelaLookup = "categorias" | "produtos_consumidos" | "tipos_tarefa" | "motivos_perda"

const TABELAS: { tabela: TabelaLookup; label: string }[] = [
  { tabela: "categorias", label: "Categoria" },
  { tabela: "produtos_consumidos", label: "Produto" },
  { tabela: "tipos_tarefa", label: "Tarefa" },
  { tabela: "motivos_perda", label: "Motivo" },
]

function uniqueNome(label: string): string {
  return `Teste Lista ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Track every row id created across the suite, per table, so afterEach can
// always clean up via service role, even when a test fails mid-way.
const createdIds: Record<TabelaLookup, string[]> = {
  categorias: [],
  produtos_consumidos: [],
  tipos_tarefa: [],
  motivos_perda: [],
}

afterEach(async () => {
  const admin = serviceClient()
  for (const tabela of Object.keys(createdIds) as TabelaLookup[]) {
    const ids = createdIds[tabela].splice(0)
    if (ids.length === 0) continue
    await admin.from(tabela).delete().in("id", ids)
  }
})

describe.each(TABELAS)("RLS: $tabela lookup table", ({ tabela, label }) => {
  it("Supervisor CAN insert a row with a unique nome", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const nome = uniqueNome(`${label} supervisor-insert`)

    const { data: inserted, error } = await supervisor
      .from(tabela)
      .insert({ nome })
      .select("id")
      .single()

    expect(error).toBeNull()
    expect(inserted).not.toBeNull()
    createdIds[tabela].push(inserted!.id)
  })

  it("Vendedor A CANNOT insert a row (RLS INSERT policy denies)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const nome = uniqueNome(`${label} vendedor-insert`)

    const { data: inserted, error } = await vendedorA
      .from(tabela)
      .insert({ nome })
      .select("id")

    // Same non-revealing assertion style as rls-clientes.test.ts's
    // Supervisor-only DELETE case: RLS denies via a 0-row result rather than
    // throwing, so assert on both possibilities without assuming which.
    expect(inserted ?? []).toHaveLength(0)
    if (error) {
      expect(error).not.toBeNull()
    }
  })

  it("a second insert with an already-existing nome fails with 23505", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const nome = uniqueNome(`${label} duplicado`)

    const { data: firstInsert, error: firstError } = await supervisor
      .from(tabela)
      .insert({ nome })
      .select("id")
      .single()

    expect(firstError).toBeNull()
    createdIds[tabela].push(firstInsert!.id)

    const { data: secondInsert, error: secondError } = await supervisor
      .from(tabela)
      .insert({ nome })
      .select("id")
      .single()

    expect(secondInsert).toBeNull()
    expect(secondError).not.toBeNull()
    expect(secondError?.code).toBe("23505")
  })

  it("Supervisor CAN update ativo to false and back to true (soft-delete, D-03)", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const nome = uniqueNome(`${label} toggle-ativo`)

    const { data: inserted, error: insertError } = await supervisor
      .from(tabela)
      .insert({ nome })
      .select("id")
      .single()

    expect(insertError).toBeNull()
    createdIds[tabela].push(inserted!.id)

    const { data: deactivated, error: deactivateError } = await supervisor
      .from(tabela)
      .update({ ativo: false })
      .eq("id", inserted!.id)
      .select("id, ativo")
      .single()

    expect(deactivateError).toBeNull()
    expect(deactivated?.ativo).toBe(false)

    const { data: reactivated, error: reactivateError } = await supervisor
      .from(tabela)
      .update({ ativo: true })
      .eq("id", inserted!.id)
      .select("id, ativo")
      .single()

    expect(reactivateError).toBeNull()
    expect(reactivated?.ativo).toBe(true)
  })

  it("Vendedor A CANNOT update ativo (RLS UPDATE policy denies)", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const nome = uniqueNome(`${label} vendedor-update`)

    const { data: inserted, error: insertError } = await supervisor
      .from(tabela)
      .insert({ nome })
      .select("id")
      .single()

    expect(insertError).toBeNull()
    createdIds[tabela].push(inserted!.id)

    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )

    const { data: updateResult, error: updateError } = await vendedorA
      .from(tabela)
      .update({ ativo: false })
      .eq("id", inserted!.id)
      .select("id")

    expect(updateResult ?? []).toHaveLength(0)
    if (updateError) {
      expect(updateError).not.toBeNull()
    }
  })
})
