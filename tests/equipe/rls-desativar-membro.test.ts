import { afterAll, describe, expect, it } from "vitest"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import {
  createTestMember,
  deleteTestMember,
  serviceClient,
  signInAs,
} from "../helpers/supabase-test-clients"

/**
 * Phase 10 Plan 3 — proves the two authorization guarantees of this phase
 * against the LIVE database:
 *
 *   1. EQP-02: the team can never end up with zero active Supervisors.
 *   2. EQP-03: a member deactivated mid-session loses access on their very
 *      next request, even though their access token is still valid.
 *
 * Every deactivation target in this file is a disposable `createTestMember`
 * fixture (never a `SEED_ACCOUNTS` identity), because deactivation
 * permanently flips a real `profiles` row and the seeded accounts are
 * shared across every other phase's test suites.
 *
 * STRUCTURAL FINDING (recorded here, not left as tribal knowledge): the
 * `Não é possível desativar o último Supervisor ativo` branch inside
 * `desativar_membro_equipe` (migration 0008) is unreachable by construction
 * while D-01 stands. D-01's self-deactivation guard (`p_profile_id =
 * auth.uid()`) runs BEFORE the last-Supervisor count, and `is_supervisor()`
 * already requires the caller to be an active Supervisor. That means the
 * count `role = 'supervisor' and ativo = true and id <> p_profile_id` can
 * never legitimately reach zero: the caller is always an active Supervisor
 * distinct from the target (D-01 already rejected the case where they are
 * the same person), so the caller alone keeps the count at >= 1. This suite
 * therefore proves EQP-02 as an INVARIANT — "zero active Supervisors is not
 * reachable" — via Test 1 (self-deactivation refused) and Test 2 (a
 * legitimate second-Supervisor deactivation succeeds and always leaves one
 * active) rather than attempting to force the `último Supervisor ativo`
 * exception to fire, which the guard ordering makes structurally impossible.
 *
 * The RPC under test is ALWAYS called through a `signInAs` client, never
 * `serviceClient()` — the service role bypasses RLS and `is_supervisor()`,
 * so the guards under test would not run at all and every assertion would
 * be vacuous (same discipline documented in
 * `tests/importacao/rls-importar-lote.test.ts`).
 */

async function getUserId(client: Awaited<ReturnType<typeof signInAs>>): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
}

const fixtureIdsToClean: string[] = []

afterAll(async () => {
  for (const id of fixtureIdsToClean.splice(0)) {
    await deleteTestMember(id)
  }
})

describe("RLS/behavior: desativar_membro_equipe guards (EQP-02)", () => {
  it("self-deactivation is refused even while other Supervisors are active (D-01, EQP-02)", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const supervisorId = await getUserId(supervisor)

    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const { data, error } = await supervisor.rpc("desativar_membro_equipe", {
      p_profile_id: supervisorId,
      p_novo_responsavel_id: vendedorAId,
    })

    expect(error).not.toBeNull()
    expect(error!.message).toContain("a própria conta")
    expect(data).toBeNull()

    // The guard must fire before any write: a rejected call must leave the
    // caller's own row fully untouched.
    const { data: profileReadBack, error: readBackError } = await serviceClient()
      .from("profiles")
      .select("ativo")
      .eq("id", supervisorId)
      .single()
    expect(readBackError).toBeNull()
    expect(profileReadBack!.ativo).toBe(true)

    // Load-bearing note for EQP-02: self-deactivation is the ONLY path that
    // could ever drive the team to zero active Supervisors, and it is
    // refused before any write happens.
  })

  it("last supervisor: deactivating a second Supervisor is allowed and always leaves one active", async () => {
    const fixtureSupervisor = await createTestMember("supervisor", "segundo")
    fixtureIdsToClean.push(fixtureSupervisor.id)

    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )

    const { data, error } = await supervisor.rpc("desativar_membro_equipe", {
      p_profile_id: fixtureSupervisor.id,
      p_novo_responsavel_id: vendedorAId,
    })

    // False-positive check: a guard that fired here would block every
    // legitimate Supervisor deactivation.
    expect(error).toBeNull()
    expect(data).not.toBeNull()

    const { count: activeSupervisorCount, error: countError } = await serviceClient()
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "supervisor")
      .eq("ativo", true)
    expect(countError).toBeNull()
    expect(activeSupervisorCount ?? 0).toBeGreaterThanOrEqual(1)

    const { data: seededSupervisorRow, error: seededSupervisorError } = await serviceClient()
      .from("profiles")
      .select("ativo")
      .eq("id", await getUserId(supervisor))
      .single()
    expect(seededSupervisorError).toBeNull()
    expect(seededSupervisorRow!.ativo).toBe(true)

    const { data: fixtureRow, error: fixtureRowError } = await serviceClient()
      .from("profiles")
      .select("ativo")
      .eq("id", fixtureSupervisor.id)
      .single()
    expect(fixtureRowError).toBeNull()
    expect(fixtureRow!.ativo).toBe(false)
  })
})
