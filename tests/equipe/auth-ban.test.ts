import { afterEach, describe, expect, it } from "vitest"

import { createAdminClient } from "@/lib/supabase/admin"
import { createTestMember, deleteTestMember, type TestMember } from "../helpers/supabase-test-clients"

/**
 * Phase 10 (desativação de membro da equipe) — this suite exists to convert
 * two [ASSUMED] claims from 10-RESEARCH.md's Assumptions Log into verified
 * facts, and to prove the service_role key is genuinely reachable from the
 * Node process rather than only from the Deno Edge Function runtime:
 *   A1: `ban_duration: "none"` is the correct value to unban/reactivate a user.
 *   A2: `ban_duration: "876000h"` actually persists on this hosted project.
 */
describe("createAdminClient() — service_role reachability + ban/unban round trip", () => {
  let fixture: TestMember | null = null

  afterEach(async () => {
    if (fixture) {
      await deleteTestMember(fixture.id)
      fixture = null
    }
  })

  it("builds a working service_role client from the Node process environment", () => {
    // Unlike @/lib/supabase/server, @/lib/supabase/admin never touches
    // next/headers, so it is safe to import directly from Vitest — no live
    // request scope needed.
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeTruthy()
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy()

    const client = createAdminClient()
    expect(typeof client.auth.admin.updateUserById).toBe("function")
  })

  it("ban_duration '876000h' persists and 'none' clears it (resolves RESEARCH A1/A2)", async () => {
    fixture = await createTestMember("vendedor", "ban")
    const admin = createAdminClient()

    const { error: banError } = await admin.auth.admin.updateUserById(fixture.id, {
      ban_duration: "876000h",
    })
    expect(banError).toBeNull()

    const { data: bannedUser } = await admin.auth.admin.getUserById(fixture.id)
    // A2: the ban actually persists on this hosted instance — if the write
    // were silently dropped, banned_until would come back empty here.
    //
    // `banned_until` isn't in the published `User` type, so it's read
    // through a narrow local shape instead of `any` (CLAUDE.md forbids `any`
    // without a written justification).
    const bannedUserWithBan = bannedUser.user as unknown as { banned_until?: string | null }
    expect(bannedUserWithBan.banned_until).toBeTruthy()

    const { error: unbanError } = await admin.auth.admin.updateUserById(fixture.id, {
      ban_duration: "none",
    })
    expect(unbanError).toBeNull()

    const { data: unbannedUser } = await admin.auth.admin.getUserById(fixture.id)
    // A1: 'none' is the correct unban value. The exact cleared
    // representation was the unverified part, so this asserts "no longer
    // banned" rather than pinning one shape — absent, null, or an
    // already-past timestamp are all acceptable proof of "not banned".
    const unbannedUserWithBan = unbannedUser.user as unknown as { banned_until?: string | null }
    const bannedUntil = unbannedUserWithBan.banned_until
    const isNoLongerBanned =
      !bannedUntil || new Date(bannedUntil).getTime() <= Date.now()
    expect(isNoLongerBanned).toBe(true)
  })
})
