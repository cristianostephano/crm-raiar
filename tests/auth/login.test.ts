import { describe, expect, it } from "vitest"

import { anonClient } from "../helpers/supabase-test-clients"
import { SEED_ACCOUNTS } from "./rls-roles.test"

/**
 * Tests the auth contract components/auth/LoginForm.tsx depends on:
 * supabase.auth.signInWithPassword() against the real hosted project, using
 * the seeded Vendedor A test account from tests/auth/rls-roles.test.ts.
 */
describe("Login: signInWithPassword contract", () => {
  it("valid seeded Vendedor credentials return a session", async () => {
    const client = anonClient()
    const { data, error } = await client.auth.signInWithPassword({
      email: SEED_ACCOUNTS.vendedorA.email,
      password: SEED_ACCOUNTS.vendedorA.password,
    })

    expect(error).toBeNull()
    expect(data.session).not.toBeNull()
    expect(data.user?.email).toBe(SEED_ACCOUNTS.vendedorA.email)
  })

  it("wrong password returns an error and no session", async () => {
    const client = anonClient()
    const { data, error } = await client.auth.signInWithPassword({
      email: SEED_ACCOUNTS.vendedorA.email,
      password: "definitely-wrong-password",
    })

    expect(error).not.toBeNull()
    expect(data.session).toBeNull()
  })
})
