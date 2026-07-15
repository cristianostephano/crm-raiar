import { afterAll, describe, expect, it } from "vitest"

import { anonClient, serviceClient, signInAs } from "../helpers/supabase-test-clients"
import { SEED_ACCOUNTS } from "./rls-roles.test"

/**
 * Authorization test for the invite-user Edge Function (AUTH-02, D-10,
 * T-01-10). Exercises the real deployed function against the hosted
 * project — RED until Task 2 deploys it (mirrors the plan-02 db-push gate).
 *
 * A Vendedor calling this Edge Function must be rejected 403 with no
 * account created; a Supervisor call must create an account whose
 * profiles.role matches exactly the role chosen in the request.
 */

const createdUserIds: string[] = []

afterAll(async () => {
  if (createdUserIds.length === 0) return
  const admin = serviceClient()
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id)
  }
})

describe("invite-user Edge Function authorization", () => {
  it("rejects an unauthenticated call with 401 and creates no account", async () => {
    const client = anonClient()
    const { data, error } = await client.functions.invoke("invite-user", {
      body: {
        email: `unauth-invite-${Date.now()}@raiar.local`,
        nome: "Teste",
        sobrenome: "Nao Autenticado",
        celular: "11999990000",
        role: "vendedor",
      },
    })

    expect(data).toBeNull()
    expect(error).not.toBeNull()
    // FunctionsHttpError exposes the underlying Response via `.context`.
    const status = (error as { context?: Response })?.context?.status
    expect(status).toBe(401)
  })

  it("rejects a Vendedor-authenticated call with 403 and creates no account", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )

    const testEmail = `vendedor-attempt-${Date.now()}@raiar.local`
    const { data, error } = await vendedorA.functions.invoke("invite-user", {
      body: {
        email: testEmail,
        nome: "Teste",
        sobrenome: "Vendedor Attempt",
        celular: "11999990001",
        role: "vendedor",
      },
    })

    expect(data).toBeNull()
    expect(error).not.toBeNull()
    const status = (error as { context?: Response })?.context?.status
    expect(status).toBe(403)

    // Confirm no account was created for the attempted invite email.
    const admin = serviceClient()
    const { data: listData } = await admin.auth.admin.listUsers()
    const found = listData?.users.find((u) => u.email === testEmail)
    expect(found).toBeUndefined()
  })

  it("creates an account with the exact role chosen by a Supervisor caller", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )

    // `example.com` (RFC 2606 reserved test domain) is used here — not
    // `@raiar.local` — because the invite-user Edge Function calls the
    // real `auth.admin.inviteUserByEmail`, which GoTrue actively rejects
    // as an invalid address for the `.local` TLD (unlike admin.createUser,
    // used for seeding in plan 02, which never sends mail and skips this
    // check). This test consumes 1 of the hosted project's free-tier
    // built-in-SMTP email quota (2/hour, not configurable without a
    // separate paid SMTP provider — see 01-04-SUMMARY.md).
    const testEmail = `invite-test-${Date.now()}@example.com`
    const { data, error } = await supervisor.functions.invoke("invite-user", {
      body: {
        email: testEmail,
        nome: "Convite",
        sobrenome: "De Teste",
        celular: "11999990002",
        role: "vendedor",
      },
    })

    expect(error).toBeNull()
    expect(data).toMatchObject({ ok: true })

    const admin = serviceClient()
    const { data: listData } = await admin.auth.admin.listUsers()
    const createdUser = listData?.users.find((u) => u.email === testEmail)
    expect(createdUser).toBeDefined()
    if (createdUser) createdUserIds.push(createdUser.id)

    const { data: profileRow, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", createdUser!.id)
      .single()

    expect(profileError).toBeNull()
    expect(profileRow?.role).toBe("vendedor")
  })
})
