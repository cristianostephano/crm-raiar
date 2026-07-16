import { type EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

/**
 * Shared invite + password-recovery callback (RESEARCH.md: "one callback
 * route serves both"). Both plan 04's `inviteUserByEmail` and this plan's
 * `resetPasswordForEmail` set their `redirectTo` to this exact route.
 *
 * Exchanges the one-time email token for a session via `verifyOtp` (never a
 * custom token scheme — T-01-16), then sends the user to the set-password
 * page for BOTH `invite` and `recovery` types: an invited user sets their
 * initial senha here (D-02, closing AUTH-02); a recovery user sets a new one
 * (D-08). Any other `type` (e.g. a future `email` change confirmation) falls
 * back to `next`/home instead.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/"

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (!error) {
      const destination =
        type === "invite" || type === "recovery" ? "/auth/reset-password" : next
      return NextResponse.redirect(new URL(destination, origin))
    }
  }

  // Missing, invalid, or expired token — send back to login with an error
  // indicator so the login screen can surface a message; never leave the
  // user on a bare error page.
  return NextResponse.redirect(
    new URL("/login?error=invalid_or_expired_link", origin)
  )
}
