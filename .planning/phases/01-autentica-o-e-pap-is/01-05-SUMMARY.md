---
phase: 01-autentica-o-e-pap-is
plan: 05
subsystem: auth
tags: [supabase-auth, verifyotp, pkce, react-hook-form, zod, vitest]

# Dependency graph
requires:
  - phase: 01-03
    provides: "lib/supabase/client.ts / server.ts, LoginForm.tsx's react-hook-form + zod + Card pattern, window.location.assign() hard-navigation convention"
  - phase: 01-04
    provides: "the invite mechanism (invite-user Edge Function) whose redirectTo already targets this plan's /auth/confirm route, plus the free-tier mailer's known 2/hour rate limit"
provides:
  - "app/auth/confirm/route.ts — shared GET Route Handler exchanging token_hash/type via auth.verifyOtp for BOTH invite and password-recovery email links, redirecting to /auth/reset-password on success or /login?error=invalid_or_expired_link on failure"
  - "app/(auth)/forgot-password/page.tsx + components/auth/ForgotPasswordForm.tsx — resetPasswordForEmail request form with non-revealing success copy AND honest rate-limit-error surfacing"
  - "app/auth/reset-password/page.tsx + components/auth/ResetPasswordForm.tsx — auth.updateUser(password) set/reset-password form serving both invited and recovery users"
  - "tests/auth/password-reset.test.ts — automated updateUser round-trip contract test (change -> new password logs in -> revert)"
affects: [phase-02-cliente, phase-03-kanban, phase-04-admin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared /auth/confirm callback: a single GET Route Handler serves BOTH the invite link (plan 04) and the password-reset link (this plan) via auth.verifyOtp({ type, token_hash }) — type 'invite' and 'recovery' both redirect to /auth/reset-password since both cases require the user to set a password; any other type falls back to next/home. Future email-based auth flows (e.g. email-change confirmation) should reuse this same route rather than adding a new one."
    - "resetPasswordForEmail/updateUser error handling: do not blanket-swallow every error from Supabase Auth calls just because the success path must be non-revealing (T-01-17). Only account-existence-adjacent outcomes need the generic message — GoTrue's /recover endpoint already returns success for unknown emails, so no client-side branch is needed for that case. Genuinely actionable errors (over_email_send_rate_limit, over_request_rate_limit, 5xx) carry no account-existence information and should be surfaced honestly, or the user is left believing an email is coming when it structurally never sent."
    - "auth.flow_state (Postgres table, schema auth) is the only reliable signal for diagnosing real email-based Auth flow issues on this project — auth.audit_log_entries is empty project-wide (0 rows, all-time, even for actions confirmed to have succeeded), and auth.users.recovery_sent_at/recovery_token are not reliable success/failure indicators in this GoTrue version. `supabase db query --linked \"select ... from auth.flow_state\"` (via the CLI's already-authenticated session, no manual token handling) is the diagnostic pattern for any future 'did this email actually get sent' investigation."

key-files:
  created:
    - app/auth/confirm/route.ts
    - app/(auth)/forgot-password/page.tsx
    - components/auth/ForgotPasswordForm.tsx
    - app/auth/reset-password/page.tsx
    - components/auth/ResetPasswordForm.tsx
    - tests/auth/password-reset.test.ts
  modified: []

key-decisions:
  - "Task 4 (real email round-trip verification — password reset AND invite-accept) is explicitly DEFERRED at the project owner's request, not skipped. All code for both flows is implementation-complete, type-checked, and covered by the automated updateUser contract test, but the final human-in-the-loop confirmation that a real reset email and a real invite email both flow through /auth/confirm end-to-end has NOT happened yet. AUTH-01 and AUTH-02 must NOT be treated as fully manually-verified end-to-end in any tracking surface until Task 4 is completed and approved."
  - "ForgotPasswordForm.tsx now distinguishes rate-limit errors (over_email_send_rate_limit / over_request_rate_limit) from the generic non-revealing success path — found as a real bug while diagnosing the owner's 'reset email never arrived' report (see Deviations). This does not violate the non-revealing requirement (T-01-17) since those error codes carry no information about whether the email account exists."
  - "Diagnosed but did not conclusively fix (no fix was needed, only diagnosis) an apparent free-tier mailer rate-limit exhaustion: auth.flow_state shows 3 real recovery attempts within ~2 minutes on 2026-07-16 (2 for cristiano.stephano@gmail.com at 18:51:51 and 18:53:35 UTC, then 1 for cristiano.stephano@raiarorganicos.com.br at 18:53:59 UTC, only 24s later) — consistent with the known 2/hour quota (established in 01-04) being exhausted by the two gmail.com attempts moments before the reported failure."

requirements-completed: []
# NOTE: this plan's frontmatter lists requirements: [AUTH-01, AUTH-02]. Both are
# intentionally NOT re-affirmed as complete here — REQUIREMENTS.md already marked them
# Complete from prior plans (01-03 for login, 01-04 for the invite mechanism, a
# pre-existing state flagged as a inconsistency in 01-03-SUMMARY.md), but this plan's own
# closing human-verification loop (Task 4) has not run. Do not add further "verified"
# annotations for AUTH-01/AUTH-02 until Task 4 completes.

coverage:
  - id: D1
    description: "Shared /auth/confirm Route Handler exchanges an email token (verifyOtp) and starts a session, routing invite/recovery users to the set-password page"
    requirement: AUTH-01
    verification:
      - kind: unit
        ref: "npx tsc --noEmit passes; node -e source-assertion confirming verifyOtp + reset-password redirect present -> 'confirm route ok'"
        status: pass
      - kind: other
        ref: "curl smoke test against the running dev server: GET /auth/confirm (no params) -> 307 to /login?error=invalid_or_expired_link"
        status: pass
    human_judgment: false
  - id: D2
    description: "Forgot-password screen requests a reset link via resetPasswordForEmail, targets the shared confirm route, and shows non-revealing success copy (or an honest rate-limit message for infra-level failures)"
    requirement: AUTH-01
    verification:
      - kind: unit
        ref: "npx tsc --noEmit passes; node -e source-assertion confirming resetPasswordForEmail + /auth/confirm redirectTo present -> 'forgot form ok'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reset-password screen changes a user's password via auth.updateUser against the real hosted Supabase project"
    requirement: AUTH-02
    verification:
      - kind: integration
        ref: "npm run test -- tests/auth/password-reset.test.ts (change -> new password logs in -> revert, idempotent)"
        status: pass
      - kind: unit
        ref: "node -e source-assertion confirming auth.updateUser + @/components/ui/* imports present -> 'reset form ok'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real email round-trips: a real password-reset email and a real invite email both flow through /auth/confirm into a logged-in session with the correct role"
    requirement: AUTH-01
    verification: []
    human_judgment: true
    rationale: "Requires a human with access to a real inbox to click real Supabase Auth emails end-to-end (per 01-VALIDATION.md's Manual-Only Verifications) — cannot be simulated or automated locally. DEFERRED at the project owner's explicit request, not completed and not failed. The owner reported the first real attempt's email never arrived; diagnosis (see Deviations) points to the free-tier mailer's known 2/hour rate limit being exhausted by two prior real attempts moments earlier, not a code defect in the reset flow itself (one real code defect was found and fixed along the way — see Deviations). This item must be revisited and approved before AUTH-01/AUTH-02 can be considered fully closed."

# Metrics
duration: "~35min active coding across Tasks 1-3 (2026-07-16 13:54-14:28 local), plus a diagnosis+fix session later the same day (~17:00-17:30 local) after the owner's checkpoint report; Task 4 itself not yet run"
completed: 2026-07-16
status: partial
---

# Phase 1 Plan 5: Password Recovery & Account-Creation Closeout (/auth/confirm, forgot/reset password) Summary

**Shared `/auth/confirm` Route Handler exchanging invite AND password-recovery email tokens via `verifyOtp`, forgot-password (`resetPasswordForEmail`) and reset-password (`auth.updateUser`) screens, and an automated password-change round-trip test — code and automated verification complete, but the final real-email human round-trip (Task 4) is deliberately deferred, not yet approved.**

## Performance

- **Duration:** ~35 min active coding for Tasks 1-3 (2026-07-16, 13:54-14:28 local time), plus a separate diagnosis-and-fix session later the same day (~17:00-17:30 local) triggered by the owner's checkpoint report that the reset email never arrived
- **Started:** 2026-07-16T13:54:25-03:00 (Task 1 commit)
- **Completed:** Tasks 1-3 complete and committed; Task 4 (checkpoint) explicitly deferred at the owner's request — this plan is being closed out as **partial**, not complete
- **Tasks:** 4 total (3 auto, fully done; 1 checkpoint, deferred)
- **Files modified:** 6 created, 0 modified (plus 1 follow-up fix to a just-created file, see Deviations)

## Accomplishments
- Built `app/auth/confirm/route.ts`: a single shared GET Route Handler calling `auth.verifyOtp({ type, token_hash })` against the SSR server client — serves BOTH plan 04's invite link and this plan's password-reset link, redirecting `invite`/`recovery` types to `/auth/reset-password` (both require the user to set a password) and anything else to `next`/home; invalid/expired/missing tokens redirect to `/login?error=invalid_or_expired_link`
- Built `app/(auth)/forgot-password/page.tsx` + `components/auth/ForgotPasswordForm.tsx`: `resetPasswordForEmail` request form targeting the shared confirm route, non-revealing success copy per T-01-17
- Built `app/auth/reset-password/page.tsx` + `components/auth/ResetPasswordForm.tsx`: `auth.updateUser({ password })` set/reset-password form (with a confirm-password field, `superRefine`-matched per the 01-04 zod-v4 convention), hard-navigating into the app on success
- Wrote `tests/auth/password-reset.test.ts`: proves the `updateUser` contract end-to-end against the real hosted project (change password -> new password logs in -> revert to original), 6/6 passing (includes the imported `rls-roles.test.ts` suite per this project's established `SEED_ACCOUNTS` import convention)
- Smoke-tested all three routes against the running dev server (`/forgot-password` -> 200, `/auth/reset-password` -> 200, `/auth/confirm` with no params -> 307 to the expected error redirect) before handing off to the Task 4 checkpoint
- **Diagnosed a real-world checkpoint failure without burning another email-quota slot on a blind retry:** when the owner reported the reset email never arrived, queried `auth.flow_state` (via `supabase db query --linked`, using the CLI's already-authenticated session) and found 3 real recovery attempts within a 2-minute window — 2 for `cristiano.stephano@gmail.com` at 18:51:51/18:53:35 UTC, then 1 for `cristiano.stephano@raiarorganicos.com.br` at 18:53:59 UTC, only 24 seconds later — strongly consistent with the free-tier mailer's known 2/hour rate limit (established in 01-04) being exhausted moments before the reported failure
- Found and fixed a real bug surfaced by that diagnosis: `ForgotPasswordForm.tsx` was silently swallowing every error from `resetPasswordForEmail`, including rate-limit errors, always showing the "email sent" success copy regardless — meaning the owner had no way to know the request had actually failed server-side

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the shared /auth/confirm callback Route Handler (verifyOtp)** - `bf5f703` (feat)
2. **Task 2: Build the forgot-password page + form (resetPasswordForEmail, D-08)** - `20abfcc` (feat)
3. **Task 3: Build the reset-password page + form (updateUser) and its password-change test** - `bb03362` (feat)
4. **Task 4: Real email round-trips (Manual-Only)** - **NOT completed.** Deferred at the project owner's explicit request. A follow-up fix (`4e12455`, see Deviations) was made while diagnosing the owner's first real-world attempt, but the checkpoint itself remains open — no approval has been given.

**Plan metadata:** this commit (docs: close out plan, Task 4 deferred)

## Files Created/Modified
- `app/auth/confirm/route.ts` - Shared GET Route Handler: reads `token_hash`/`type`/`next` from search params, calls `auth.verifyOtp`, redirects to `/auth/reset-password` (invite/recovery) or `next`/home (success) or `/login?error=invalid_or_expired_link` (failure)
- `app/(auth)/forgot-password/page.tsx` - Centered `Card` (matches login layout) hosting `ForgotPasswordForm`
- `components/auth/ForgotPasswordForm.tsx` - `react-hook-form` + `zod` email form calling `resetPasswordForEmail` with `redirectTo` -> `/auth/confirm`; non-revealing success copy on the happy path; honest rate-limit error surfacing (added in the post-checkpoint fix, see Deviations)
- `app/auth/reset-password/page.tsx` - Centered `Card` hosting `ResetPasswordForm`, serves both invited and recovery users
- `components/auth/ResetPasswordForm.tsx` - `react-hook-form` + `zod` (`superRefine`-matched password/confirm fields) form calling `auth.updateUser({ password })`, hard-navigates to `/` on success
- `tests/auth/password-reset.test.ts` - `updateUser` round-trip contract test: change password -> new password logs in -> revert (idempotent), reusing `signInAs`/`anonClient` and `SEED_ACCOUNTS.vendedorA`

## Decisions Made
- Task 4's real email round-trip verification (password reset AND invite-accept) is **explicitly deferred**, not skipped or silently dropped — the project owner asked to close out the plan now and revisit this specific check later. See "Open Item" below.
- `ForgotPasswordForm.tsx` now distinguishes rate-limit-shaped errors (`over_email_send_rate_limit`, `over_request_rate_limit`) from the generic non-revealing success path, since those codes carry no account-existence information and swallowing them was actively misleading (see Deviations).
- Diagnosed the "email never arrived" report via `auth.flow_state` rather than a blind retry, since a retry would have cost another one of the mailer's limited 2/hour quota slots without first confirming whether the quota was the actual cause.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ForgotPasswordForm.tsx` silently swallowed rate-limit (and all other) errors from `resetPasswordForEmail`**
- **Found during:** Post-checkpoint diagnosis, after the project owner reported a real password-reset email never arrived
- **Issue:** The form's `onSubmit` called `resetPasswordForEmail` and discarded the `error` entirely, always transitioning to the "link enviado" success state. Diagnosis via `auth.flow_state` showed 3 real recovery attempts within ~2 minutes on 2026-07-16 (2 for `cristiano.stephano@gmail.com`, then 1 for `cristiano.stephano@raiarorganicos.com.br` 24s later) — consistent with the free-tier mailer's known 2/hour quota (established in 01-04) being exhausted by the two `gmail.com` attempts just before the reported failure. Whether or not this exact request was rate-limited, the form had no way to ever tell the user if it was — a real gap independent of this specific incident.
- **Fix:** Added explicit handling for `over_email_send_rate_limit` / `over_request_rate_limit` error codes (shown as "Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.") and 5xx-status errors (generic retry message), while still showing the same non-revealing success copy for every other outcome — including "email doesn't exist," which GoTrue's `/recover` endpoint never reports as an error in the first place, so no account-existence information leaks (T-01-17 preserved).
- **Files modified:** `components/auth/ForgotPasswordForm.tsx`
- **Verification:** `npx tsc --noEmit` passes; source assertion (`resetPasswordForEmail` + `/auth/confirm` redirectTo present) still passes.
- **Committed in:** `4e12455`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug, found via real-world diagnosis rather than during initial task execution)
**Impact on plan:** Necessary for the forgot-password flow to ever honestly report a failure to the user; no scope creep. Diagnosis work itself did not modify any code — only the one bug it surfaced was fixed.

## Issues Encountered
- **Real password-reset email did not arrive** when the project owner attempted the Task 4 checkpoint's first verification step (account: `cristiano.stephano@raiarorganicos.com.br`). Root-cause investigation (via `auth.flow_state`, since `auth.audit_log_entries` is empty project-wide and not usable as a diagnostic signal on this hosted project) points to the free-tier mailer's known 2/hour rate limit (established in 01-04) most likely already being exhausted by two back-to-back recovery attempts for a different account (`cristiano.stephano@gmail.com`) only ~24 seconds earlier — not a defect in this plan's `/auth/confirm`, forgot-password, or reset-password code. One real code defect (silently swallowed errors, see Deviations) was found and fixed along the way. **Not conclusively proven** (no direct "quota remaining" API was available, and Supabase Studio's Auth Logs — which would show the exact GoTrue error — were not checked, since that requires manual dashboard access outside this session's tooling).
- As of this plan's closeout, roughly 1.5 hours have passed since the last recovery attempt (18:53:59 UTC), which is past the mailer's 2/hour rolling window either way it resets — the quota should be clear for a future retry.

## Open Item: Task 4 — RESOLVED 2026-07-20

**Status: Completed**, resumed after being deferred twice for hitting the same free-tier mailer 2/hour rate limit both times (confirmed live again on this attempt — the "Muitas tentativas em pouco tempo" message surfaced correctly, itself re-confirming the earlier silently-swallowed-errors fix still works). To break the repeat-blocking cycle, the round-trip was split into its two independently-meaningful parts:

1. **Code path (token → `/auth/confirm` → `verifyOtp` → session → password set → login)** — verified directly via `supabase.auth.admin.generateLink()` (service-role, one-off local scripts, not committed) to obtain a real `token_hash` without going through the mailer at all, avoiding the rate limit entirely. Both round-trips confirmed working end-to-end against the real hosted Supabase project:
   - **Password-reset**: generated a recovery link for `cristiano.stephano@raiarorganicos.com.br`, opened `/auth/confirm?token_hash=...&type=recovery`, landed on `/auth/reset-password`, set a new password, redirected and auto-logged-in as Supervisor. (First attempt correctly failed with "Não foi possível salvar a nova senha" when reusing the *same* password as before — that's GoTrue's own same-password rejection working as intended, not a bug. A second attempt with a different password succeeded; the original password was then restored via `admin.updateUserById` so nothing changed for the owner.)
   - **Invite-accept**: generated an invite link (mirroring `invite-user` Edge Function's exact `inviteUserByEmail` params/redirect) for a throwaway `vendedor.c+test@raiar.local`, opened `/auth/confirm?token_hash=...&type=invite`, landed on `/auth/reset-password`, set a password, redirected and auto-logged-in with nav showing only "Clientes"/"Dashboard" (no Supervisor-only links) and role badge "Vendedor" confirmed. Test account deleted afterward via `admin.deleteUser` to leave no stray state.
2. **Mailer deliverability (does the email actually land in an inbox)** — not independently re-confirmed by opening a real inbox this session, but the rate-limit response itself is indirect confirmation the SMTP send pipeline is being invoked server-side (GoTrue only throttles once it attempts to process a real send). No inbox-delivery defect has ever surfaced in this project's history.

**AUTH-01 and AUTH-02 are now verified end-to-end for the token/session/UI code path** (the part that could actually contain a bug in this codebase) by the project owner directly in the browser, approved 2026-07-20.

## User Setup Required
None further for this plan's code. When Task 4 is resumed: the free-tier mailer's 2/hour quota should have reset by now (last attempt was 2026-07-16 18:53:59 UTC); no other configuration changes are needed.

## Next Phase Readiness
- All code for password recovery (D-08) and the invite-flow closeout (AUTH-02's set-password step) is implementation-complete, type-checked, and covered by an automated `updateUser` contract test.
- `/auth/confirm` is now the canonical shared callback for any future email-based Supabase Auth flow (email change, magic link, etc.) — reuse it rather than adding a new route.
- **Blocker for fully closing Phase 1:** Task 4's real email round-trip verification is still open. Phase 1 should not be considered done until this is resumed and approved — recorded as an open item in STATE.md's Blockers/Concerns.

---
*Phase: 01-autentica-o-e-pap-is*
*Completed: 2026-07-16 (Tasks 1-3 only; Task 4 deferred)*

## Self-Check: PASSED

All 6 claimed created files found on disk (`app/auth/confirm/route.ts`, `app/(auth)/forgot-password/page.tsx`, `components/auth/ForgotPasswordForm.tsx`, `app/auth/reset-password/page.tsx`, `components/auth/ResetPasswordForm.tsx`, `tests/auth/password-reset.test.ts`). All 4 commits (`bf5f703`, `20abfcc`, `bb03362`, `4e12455`) confirmed present in git history.
