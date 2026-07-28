import { describe, expect, it } from "vitest"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { signInAs } from "../helpers/supabase-test-clients"

/**
 * Phase 10 Plan 1 — read-only smoke test proving migration 0008
 * (`profiles.ativo`, the extended `is_supervisor()`, `desativar_membro_equipe`,
 * `reativar_membro_equipe`) actually landed in the LIVE hosted database, not
 * just on disk. Every later plan in this phase calls one of these objects,
 * and both `tsc` and `next build` pass with zero database connection at all —
 * so a clean compile/build is a false-positive "verified" signal on its own.
 * This suite is the guard against that: it fails loudly (schema-cache /
 * "could not find the function" errors) if the push never happened.
 *
 * Strictly read-only — no `.insert(`, `.update(`, `.delete(`, and no
 * `serviceClient()` call. Both RPC assertions below intentionally fail
 * before any row is ever written, since `is_supervisor()` is the literal
 * first statement of both function bodies (verified at the Task 2
 * checkpoint).
 */

const BOGUS_UUID = "00000000-0000-0000-0000-000000000000"

describe("Phase 10 Plan 1: migration 0008 landed in the live database", () => {
  it("profiles.ativo exists and defaults to true", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const { data, error } = await supervisor.from("profiles").select("id, ativo")

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
    for (const row of data ?? []) {
      expect(row.ativo).toBe(true)
    }
  })

  it("is_supervisor() still returns true for the active seeded Supervisor", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const { data, error } = await supervisor.rpc("is_supervisor")

    expect(error).toBeNull()
    expect(data).toBe(true)
  })

  it("desativar_membro_equipe exists and rejects a non-Supervisor caller", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const { data, error } = await vendedorA.rpc("desativar_membro_equipe", {
      p_profile_id: BOGUS_UUID,
      p_novo_responsavel_id: BOGUS_UUID,
    })

    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toContain("Somente supervisores")
  })

  it("reativar_membro_equipe exists and rejects a non-Supervisor caller", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const { data, error } = await vendedorA.rpc("reativar_membro_equipe", {
      p_profile_id: BOGUS_UUID,
    })

    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toContain("Somente supervisores")
  })
})
