import { afterAll, describe, expect, it } from "vitest"

import { anonClient, signInAs } from "../helpers/supabase-test-clients"
import { SEED_ACCOUNTS } from "./rls-roles.test"

/**
 * Proves the `updateUser` password-change contract that
 * components/auth/ResetPasswordForm.tsx relies on, with no email side
 * effect: change the seeded Vendedor A's password, confirm the new
 * password logs in, then revert it back to the original seeded value so
 * this test is idempotent across runs.
 */
describe("Password reset: updateUser round-trip", () => {
  const originalPassword = SEED_ACCOUNTS.vendedorA.password
  const temporaryPassword = "TempRoundTrip!2026"

  afterAll(async () => {
    // Best-effort revert in case the test body failed before its own
    // revert step ran — tries both possible current passwords so a single
    // failing run never permanently locks the seeded account out of the
    // password every other test file assumes.
    for (const candidate of [temporaryPassword, originalPassword]) {
      try {
        const client = await signInAs(SEED_ACCOUNTS.vendedorA.email, candidate)
        await client.auth.updateUser({ password: originalPassword })
        return
      } catch {
        // try the next candidate
      }
    }
  })

  it("changes the password via updateUser, the new password logs in, then reverts", async () => {
    // 1. Change the password while signed in with the original one.
    const client = await signInAs(SEED_ACCOUNTS.vendedorA.email, originalPassword)
    const { error: updateError } = await client.auth.updateUser({
      password: temporaryPassword,
    })
    expect(updateError).toBeNull()

    // 2. Confirm the new password actually logs in.
    const { data: newLogin, error: newLoginError } = await anonClient().auth.signInWithPassword(
      {
        email: SEED_ACCOUNTS.vendedorA.email,
        password: temporaryPassword,
      }
    )
    expect(newLoginError).toBeNull()
    expect(newLogin.session).not.toBeNull()

    // 3. Revert back to the original seeded password (idempotency).
    const revertClient = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      temporaryPassword
    )
    const { error: revertError } = await revertClient.auth.updateUser({
      password: originalPassword,
    })
    expect(revertError).toBeNull()

    // 4. Confirm the original password logs in again.
    const { data: revertedLogin, error: revertedLoginError } =
      await anonClient().auth.signInWithPassword({
        email: SEED_ACCOUNTS.vendedorA.email,
        password: originalPassword,
      })
    expect(revertedLoginError).toBeNull()
    expect(revertedLogin.session).not.toBeNull()
  })
})
