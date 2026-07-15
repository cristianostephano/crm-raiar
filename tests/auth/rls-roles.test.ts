import { describe, expect, it } from "vitest"

import { signInAs } from "../helpers/supabase-test-clients"

/**
 * Seeded test accounts. Populated by `supabase/seed/seed-users.mjs` (Task 3
 * of this plan) via `admin.createUser` with `email_confirm: true` — no
 * invite email involved, since these are dedicated test/bootstrap accounts.
 *
 * `supervisor.email` is the real project-owner email supplied via the
 * Task 2 checkpoint (D-03 — Claude asks the owner for this at execution
 * time, no "first access" screen). It is filled in by Task 3 once known;
 * until then this test intentionally fails (RED), which is expected per
 * this task's TDD flow — it goes GREEN once Task 3 pushes the migration
 * and runs the seed script.
 */
export const SEED_ACCOUNTS = {
  supervisor: {
    email: "PENDING_OWNER_EMAIL_SET_IN_TASK_3",
    password: "TestSupervisor!2026",
  },
  vendedorA: {
    email: "vendedor.a+test@raiar.local",
    password: "TestVendedorA!2026",
  },
  vendedorB: {
    email: "vendedor.b+test@raiar.local",
    password: "TestVendedorB!2026",
  },
} as const

describe("RLS: profiles table role isolation", () => {
  it("every authenticated user (Vendedor A) can SELECT the full profiles list", async () => {
    const client = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const { data, error } = await client.from("profiles").select("id")

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it("Vendedor A cannot UPDATE Vendedor B's profiles row (zero rows affected)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const {
      data: { user: vendedorBUser },
    } = await vendedorB.auth.getUser()
    expect(vendedorBUser).not.toBeNull()

    const { data, error } = await vendedorA
      .from("profiles")
      .update({ nome: "tampered-by-vendedor-a" })
      .eq("id", vendedorBUser!.id)
      .select("id")

    // No UPDATE policy exists for regular users, so RLS filters the row out
    // of the update's WHERE clause: zero rows affected, not an error.
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it("Vendedor A cannot DELETE Vendedor B's profiles row (zero rows affected)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const {
      data: { user: vendedorBUser },
    } = await vendedorB.auth.getUser()
    expect(vendedorBUser).not.toBeNull()

    const { data, error } = await vendedorA
      .from("profiles")
      .delete()
      .eq("id", vendedorBUser!.id)
      .select("id")

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })
})

describe("RLS: is_supervisor() role distinction", () => {
  it("is_supervisor() returns true for a supervisor-role caller", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const { data, error } = await supervisor.rpc("is_supervisor")

    expect(error).toBeNull()
    expect(data).toBe(true)
  })

  it("is_supervisor() returns false for a vendedor-role caller", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const { data, error } = await vendedorA.rpc("is_supervisor")

    expect(error).toBeNull()
    expect(data).toBe(false)
  })
})
