---
phase: 01-autentica-o-e-pap-is
plan: 04
subsystem: auth
tags: [supabase-edge-functions, deno, cors, supabase-auth-admin, react-hook-form, zod, base-ui-select, vitest]

# Dependency graph
requires:
  - phase: 01-02
    provides: "profiles table + user_role enum + is_supervisor() + handle_new_user() trigger live on the hosted project; SEED_ACCOUNTS (Supervisor + Vendedor A/B) for RLS/auth tests"
  - phase: 01-03
    provides: "lib/supabase/client.ts / server.ts, app/(app)/layout.tsx auth-guard + role-badge convention, tests/helpers/supabase-test-clients.ts"
provides:
  - "supabase/functions/invite-user/index.ts — Deno Edge Function: caller-role check (403 for non-Supervisor) BEFORE the service_role admin client, then auth.admin.inviteUserByEmail; CORS-aware (OPTIONS preflight + Access-Control-Allow-* on every response) and propagates GoTrue's real error status/code instead of flattening to a fixed 400"
  - "app/(app)/equipe/page.tsx — Supervisor-only 'Gerenciar equipe' Server Component: redirects non-Supervisors, lists members, hosts the collapsible invite form"
  - "components/auth/InviteUserForm.tsx — collapsed-by-default 'Convidar' trigger revealing an inline react-hook-form + zod form (nome/sobrenome/email/celular/papel, no default papel per D-05), calling functions.invoke('invite-user')"
  - "First real, confirmed 'vendedor' account created end-to-end through the actual invite mechanism (send -> real inbox -> click -> confirm), proving AUTH-02's production path works, not just a seeded test account"
affects: [01-05, phase-02-cliente, phase-03-kanban, phase-04-admin]

# Tech tracking
tech-stack:
  added: ["components/ui/select.tsx (shadcn base-nova Select primitive, @base-ui/react)"]
  patterns:
    - "Edge Functions called from the browser MUST handle CORS explicitly: short-circuit OPTIONS with Access-Control-Allow-Origin/-Headers, and attach the same headers to every response (success and error) via a small jsonResponse() helper. verify_jwt only proves authentication; it does nothing for CORS."
    - "Edge Function error responses should propagate the real upstream status/code (e.g. GoTrue's AuthApiError.status/.code) in a structured { error: { code, message } } JSON body, not a hardcoded status — the client branches on error.code, never on a guessed HTTP status."
    - "react-hook-form + Base UI Select: a Select's RHF-bound field MUST have a non-undefined default value (use \"\" as the empty-state sentinel, which Base UI's Select correctly renders as the placeholder) — an undefined default starts the Select uncontrolled, then flips to controlled on first selection, which React/Base UI forbid mid-lifecycle."
    - "Prefer z.object({...}).superRefine() over chaining .refine() onto an individual field inside the object shape when using @hookform/resolvers' zodResolver — a per-field .refine() turns that field into a ZodEffects type that broke zodResolver's generic FieldValues inference against zod v4 in this project."
    - "supabase/functions/** must be excluded from the root tsconfig.json (Deno globals + jsr:/npm: specifiers are incompatible with the Next.js TS project's bundler moduleResolution) — Edge Functions are a separate Deno runtime, type-checked independently, not part of the app's tsc run."
    - "GoTrue's auth.admin.inviteUserByEmail validates real MX-record deliverability, not just email format — .local TLDs and MX-less reserved domains (example.com) are both rejected; use a real MX-having domain with a random local-part for automated tests that must reach a genuine send attempt."

key-files:
  created:
    - supabase/functions/invite-user/index.ts
    - supabase/functions/invite-user/deno.json
    - supabase/functions/invite-user/.npmrc
    - tests/auth/invite.test.ts
    - app/(app)/equipe/page.tsx
    - components/auth/InviteUserForm.tsx
    - components/ui/select.tsx
  modified:
    - supabase/config.toml
    - app/(app)/layout.tsx
    - tsconfig.json

key-decisions:
  - "SITE_URL Edge Function secret set to http://localhost:3000 (app not yet deployed to Vercel) — only affects the invite email's redirectTo link target; the account-creation/role-assignment mechanism this plan verifies is unaffected. Must be updated to the real production URL once the app is deployed (flagged for 01-05 / deployment phase)."
  - "Edge Function CORS: used a permissive Access-Control-Allow-Origin: '*' rather than an allowlist of specific origins — acceptable for this MVP's single trusted first-party frontend calling its own backend with a Supervisor-authenticated JWT (the real authorization boundary is the server-side role check, not CORS); revisit if a public/third-party integration is ever added."
  - "Edge Function error bodies now use a structured { error: { code, message } } JSON shape instead of raw text/flattened status codes — this is the project's new convention for any future Edge Function needing to distinguish error types client-side."

requirements-completed: [AUTH-02, AUTH-03]

coverage:
  - id: D1
    description: "invite-user Edge Function checks the caller's own profiles.role (via JWT-scoped client) and returns 403 for non-Supervisors BEFORE ever constructing the service_role admin client; re-validates the request body server-side with zod after the 403 gate"
    requirement: AUTH-03
    verification:
      - kind: integration
        ref: "tests/auth/invite.test.ts#rejects a Vendedor-authenticated call with 403 and creates no account"
        status: pass
      - kind: unit
        ref: "node -e source-assertion confirming the caller-role check precedes SUPABASE_SERVICE_ROLE_KEY usage -> 'invite edge fn shape ok'"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Supervisor invites a new Vendedor (or Supervisor) with nome/sobrenome/email/celular + an explicitly-chosen papel (no default, D-05); Supabase Auth sends the real invite and the plan-02 handle_new_user trigger creates profiles with exactly that role"
    requirement: AUTH-02
    verification:
      - kind: integration
        ref: "tests/auth/invite.test.ts#creates an account with the exact role chosen by a Supervisor caller"
        status: pass
      - kind: manual_procedural
        ref: "Task 4 checkpoint — real invite sent to cristiano.stephano@gmail.com, real inbox received it, owner clicked through, account confirmed (email_confirmed_at set) with profiles.role='vendedor' verified directly against the hosted project"
        status: pass
    human_judgment: true
    rationale: "Requires a human-controlled real inbox to receive and click a real invite email — not expressible as an automated assertion; approved by the project owner after the full send -> inbox -> click -> confirm round-trip completed for real."
  - id: D3
    description: "The 'Gerenciar equipe' screen is Supervisor-only: a Vendedor visiting /equipe directly by URL is redirected away (to '/') and never sees the nav link"
    requirement: AUTH-03
    verification:
      - kind: e2e
        ref: "Playwright ad hoc script: Vendedor A signed in, navigated to /equipe, landed on '/' — 'Gerenciar equipe' nav link absent"
        status: pass
      - kind: unit
        ref: "node -e source-assertion confirming equipe/page.tsx calls redirect(...) and reads profiles for role -> 'equipe ui ok'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Edge Function calls from the real browser succeed (not just server-to-server test/script calls) — CORS preflight handled correctly"
    verification:
      - kind: other
        ref: "raw OPTIONS request with an Origin header -> 200 with Access-Control-Allow-Origin/-Headers present (previously 401, no CORS headers)"
        status: pass
      - kind: manual_procedural
        ref: "Task 4 checkpoint — owner's real browser submission succeeded post-fix"
        status: pass
    human_judgment: true
    rationale: "The original bug (browser-only CORS preflight failure) was invisible to every automated/server-to-server check in this plan; only a real browser submission by a human could have caught it, and did."

# Metrics
duration: "~3h active work (2026-07-15 13:46-19:45 local, across pauses for the Supabase access token, the free-tier email rate limit, and CORS/Select bug diagnosis), plus a short follow-up session on 2026-07-16 for final human verification and closeout"
completed: 2026-07-16
status: complete
---

# Phase 1 Plan 4: Supervisor Invite Flow (invite-user Edge Function + Gerenciar Equipe) Summary

**Supervisor-only invite mechanism — a CORS-aware `invite-user` Edge Function that authorizes the caller server-side before ever touching the service_role key, a "Gerenciar equipe" screen with an explicit-papel invite form, and a real end-to-end proof (send -> inbox -> click -> confirm) creating the CRM's first genuine Vendedor account.**

## Performance

- **Duration:** ~3h active work across the main session (2026-07-15 13:46-19:45 local time), spanning three external pauses (Supabase personal access token, the free-tier mailer's 2/hour rate limit, and root-causing a real browser-only CORS bug), plus a short follow-up session on 2026-07-16 for the owner's final manual verification and plan closeout
- **Started:** 2026-07-15T16:46:04Z (Task 1 commit)
- **Completed:** 2026-07-16 (Task 4 checkpoint approved)
- **Tasks:** 4 (3 auto + 1 checkpoint)
- **Files modified:** 7 created, 3 modified

## Accomplishments
- Wrote `supabase/functions/invite-user/index.ts` following RESEARCH Pattern 2: an `anonClient` (caller's own JWT) resolves the caller's identity and `profiles.role`, returning 401/403 **before** the `adminClient` (service_role key) is ever constructed — the real authorization boundary for AUTH-03/T-01-10, proven by `tests/auth/invite.test.ts` (unauthenticated -> 401, Vendedor -> 403 with no account created, Supervisor -> account created with the exact chosen role)
- Deployed the function to the hosted project, registered it in `supabase/config.toml` (`verify_jwt = true`, defense-in-depth), and set the `SITE_URL` secret for the invite `redirectTo`
- Built `app/(app)/equipe/page.tsx` (Supervisor-only, redirects everyone else) and `components/auth/InviteUserForm.tsx` (collapsible "Convidar" trigger -> inline form, papel with no default per D-05, calling `functions.invoke('invite-user')`), extending `app/(app)/layout.tsx` with a Supervisor-gated nav link without touching the existing auth-guard logic
- Found and fixed **five real bugs** during verification (see Deviations) — most significantly, a missing CORS handler in the Edge Function that made the entire feature silently fail for real browser users while passing every server-to-server test, and a hardcoded error status that made the client's duplicate-email detection unreachable
- Closed the loop for real: the project owner's actual invite to `cristiano.stephano@gmail.com` (role Vendedor) was sent, received in a real inbox, clicked, and confirmed — `profiles.role = 'vendedor'` verified directly against the hosted database. This is the CRM's first genuine (non-seeded) team member account, created through the exact production mechanism AUTH-02 requires.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the invite-user Edge Function and its authorization test (RED)** - `7d25af1` (test)
2. **Task 2: [BLOCKING] Deploy the invite-user Edge Function, set its secret, run the authorization test GREEN** - `66526b9` (feat), `72e1885` (fix — email-domain correction, confirmed GREEN)
3. **Task 3: Build the Supervisor-only "Gerenciar equipe" screen, invite form, and nav link** - `52f737f` (feat), `5a8a943` (fix — Select controlled-from-mount), `b338734` (fix — CORS + real error-code propagation)
4. **Task 4: Real invite email round-trip (AUTH-02 — Manual-Only)** - checkpoint, no code commit (gate-only; approved by the project owner after the full send -> inbox -> click -> confirm round-trip succeeded)

**Plan metadata:** _pending — see final commit below_

_Note: Task 1 used `tdd="true"` — the `test` commit (`7d25af1`) is the RED gate; Task 2's `feat` commit (`66526b9`) plus its immediate `fix` (`72e1885`) is the GREEN gate (function deployed, test suite 8/8 passing). No separate REFACTOR commit was needed._

## Files Created/Modified
- `supabase/functions/invite-user/index.ts` - Deno Edge Function: caller-role check (403 before service_role client), zod body re-validation, `inviteUserByEmail`, CORS handling (`OPTIONS` short-circuit + `Access-Control-Allow-*` on every response), structured `{ error: { code, message } }` bodies propagating GoTrue's real status/code
- `supabase/functions/invite-user/deno.json`, `.npmrc` - CLI-scaffolded supporting files for the function
- `tests/auth/invite.test.ts` - Authorization test: unauthenticated -> 401, Vendedor -> 403 (no account created), Supervisor -> account created with the exact chosen role (verified against `profiles.role`), cleaned up via `serviceClient().auth.admin.deleteUser`
- `supabase/config.toml` - `[functions.invite-user]` registered, `verify_jwt = true`
- `app/(app)/equipe/page.tsx` - Supervisor-only Server Component: redirect guard, member list (nome/sobrenome/papel badge/email), empty-state copy, hosts `InviteUserForm`
- `components/auth/InviteUserForm.tsx` - Collapsed "Convidar" trigger revealing an inline `react-hook-form` + `zod` form; papel `Select` with no default (D-05, controlled from mount via `""` sentinel); duplicate-email vs. generic error copy read from the Edge Function's structured error code
- `components/ui/select.tsx` - shadcn `base-nova`/`@base-ui/react` Select primitive (newly installed)
- `app/(app)/layout.tsx` - Added a Supervisor-only "Gerenciar equipe" nav link; existing `auth.getUser()` guard and role badge untouched
- `tsconfig.json` - Excluded `supabase/functions/**` from the root TS project (Deno runtime files were breaking `tsc --noEmit`)

## Decisions Made
- `SITE_URL` secret set to `http://localhost:3000` since the app isn't deployed to Vercel yet — only affects the invite email's link target, not the account/role creation this plan verifies; must be updated once the app has a real production URL.
- CORS uses `Access-Control-Allow-Origin: '*'` rather than an origin allowlist — acceptable since the real authorization boundary is the server-side Supervisor-role check, not CORS, and there's a single trusted first-party frontend at this stage.
- Standardized Edge Function error responses on a structured `{ error: { code, message } }` JSON body (propagating the real upstream `status`/`code`) rather than flattening every failure to one hardcoded status — the new convention for any future Edge Function needing client-distinguishable error types.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded `supabase/functions/**` from the root `tsconfig.json`**
- **Found during:** Task 3 (running `npx tsc --noEmit` per the plan's own verify step)
- **Issue:** The root tsconfig's broad `**/*.ts` include picked up the Deno Edge Function file, which uses `Deno` globals and `jsr:`/`npm:` specifiers incompatible with the Next.js project's `bundler` moduleResolution — `tsc --noEmit` failed with 9 errors, none related to actual application code.
- **Fix:** Added `supabase/functions/**` to `tsconfig.json`'s `exclude` array — Edge Functions are a separate Deno runtime and were never meant to be type-checked by the Next.js TS project.
- **Files modified:** `tsconfig.json`
- **Verification:** `npx tsc --noEmit` passes clean.
- **Committed in:** `52f737f` (Task 3 commit)

**2. [Rule 1 - Bug] Test used email domains GoTrue actually rejects**
- **Found during:** Task 2 (running the invite test against the newly-deployed function)
- **Issue:** The test originally used `@raiar.local` (rejected: invalid TLD format) and then, after fixing that, `@example.com` (rejected: RFC 2606 reserved domain with no real MX records — GoTrue validates deliverability, not just format). `admin.createUser`, used for seeding in plan 02, skips both checks since it never sends mail, which is why this gap wasn't caught until this plan's real-send test.
- **Fix:** Switched to a real MX-having domain (`@gmail.com`) with a random, non-existent local-part — passes GoTrue's deliverability check without ever reaching a real mailbox.
- **Files modified:** `tests/auth/invite.test.ts`
- **Verification:** `npm run test -- tests/auth/invite.test.ts` — 8/8 passing.
- **Committed in:** `72e1885`

**3. [Rule 1 - Bug] papel Select switching from uncontrolled to controlled**
- **Found during:** Task 4 (the project owner's manual browser verification — console error)
- **Issue:** `InviteUserForm.tsx`'s `role` field defaulted to `undefined`, so Base UI's `Select` started uncontrolled and then became controlled the instant a papel was chosen — forbidden mid-lifecycle, producing a console error and (per Base UI's stated behavior) unreliable Select state.
- **Fix:** Defaulted `role` to `""` instead of `undefined` (Base UI recognizes `""` as "nothing selected," so the D-05 no-default requirement is unaffected) and moved the "papel is required" validation from a per-field `.refine()` to an object-level `.superRefine()`, since the per-field refine had also broken `@hookform/resolvers`' TypeScript inference against zod v4.
- **Files modified:** `components/auth/InviteUserForm.tsx`
- **Verification:** Playwright: opening the form and selecting a papel produces 0 console errors (was 1); `npx tsc --noEmit`/`eslint` clean; `tests/auth/invite.test.ts` still 8/8.
- **Committed in:** `5a8a943`

**4. [Rule 1 - Bug] Missing CORS handling in the invite-user Edge Function**
- **Found during:** Task 4 (the project owner's real manual invite submission failed with a generic error)
- **Issue:** The Edge Function had no `OPTIONS` handling and set no `Access-Control-Allow-*` headers on any response. Every real browser call is cross-origin (`localhost:3000` vs. `*.supabase.co`), so the browser's CORS preflight `OPTIONS` request got a `401` with zero CORS headers and was silently blocked — the real `POST` never happened. `supabase-js` then surfaced a generic network-level error with no HTTP status, which the client correctly fell back to a generic message for. Server-to-server calls (curl, this plan's own test suite) never hit this, since CORS is a browser-only enforcement mechanism — explaining why the automated suite was green throughout while the real UI was broken.
- **Fix:** Added an `OPTIONS` short-circuit and `Access-Control-Allow-Origin`/`-Headers` on every response via a `jsonResponse()` helper; redeployed.
- **Files modified:** `supabase/functions/invite-user/index.ts`
- **Verification:** Raw `OPTIONS` request with an `Origin` header now returns `200` with the correct CORS headers (was `401`, no headers); `tests/auth/invite.test.ts` still 8/8 after redeploy.
- **Committed in:** `b338734`

**5. [Rule 1 - Bug] Every Edge Function error flattened to a hardcoded 400**
- **Found during:** Same diagnostic pass as #4
- **Issue:** `return new Response(error.message, { status: 400 })` collapsed every `inviteUserByEmail` failure to `400`, regardless of GoTrue's actual status. Confirmed directly against a real confirmed-account duplicate that GoTrue's true response is `status 422 / code "email_exists"` — meaning the client's duplicate-vs-generic branching (checking `status === 400`) could never have correctly detected a real duplicate, even before the CORS bug.
- **Fix:** Propagate `error.status`/`error.code` from GoTrue in a structured `{ error: { code, message } }` JSON body; client now reads `code === "email_exists"` instead of guessing from HTTP status.
- **Files modified:** `supabase/functions/invite-user/index.ts`, `components/auth/InviteUserForm.tsx`
- **Verification:** Confirmed a real duplicate invite (against the now-confirmed `cristiano.stephano@gmail.com` account) correctly surfaces "Já existe uma conta com esse e-mail." after the fix.
- **Committed in:** `b338734`

---

**Total deviations:** 5 auto-fixed (1 Rule 3 blocking tooling fix, 4 Rule 1 bugs — one config/type-inference issue, one deliverability-validation gap in test data, and two real production-path bugs only a real browser user could surface)
**Impact on plan:** All five were necessary for the plan's actual deliverable (a working invite mechanism reachable from a real browser, with correct error messaging) to function as intended. No scope creep — no new features beyond what the plan specified; #4 and #5 in particular are exactly the class of bug this phase's manual-verification checkpoint (Task 4) exists to catch, since nothing server-to-server (including this plan's own automated test suite) could have found them.

## Issues Encountered
- The hosted project's free-tier built-in mailer enforces a 2-email/hour rate limit (confirmed via the Management API; not raiseable without configuring a separate custom SMTP provider, which was declined to preserve the zero-infra-cost MVP goal per `CLAUDE.md`). This paused verification twice during the session; resolved by waiting for the window to reset rather than adding a new external dependency.
- `tests/auth/rls-roles.test.ts` (plan 01-02's test, untouched by this plan) hit one transient `"JWT issued at future"` clock-skew failure during a full-suite run; confirmed non-reproducible on immediate retry (5/5 pass) and unrelated to any change in this plan — logged here, not fixed, per the scope-boundary rule (pre-existing/environmental, not introduced by this plan's changes).
- A Supabase personal access token was needed twice for non-interactive CLI use (`supabase link`/`secrets set`/`functions deploy`); per this project's established convention (see 01-02/01-03 summaries), it was used session-only and never persisted to a file. Mid-plan, the owner separately ran `supabase login` interactively on their own machine to set up persistent CLI credentials (verified working via `supabase projects list` with no `SUPABASE_ACCESS_TOKEN` env var needed) — a request to instead write the raw access token into `.env.local` was declined, since that file is loaded into every test run and server process in this codebase, which is a much larger blast radius than an account-wide management token warrants; `supabase login`'s own credential store was the safer alternative and is what the owner used.

## User Setup Required

None further for this plan specifically. `SITE_URL` will need to be updated from `http://localhost:3000` to the real production URL once the app is deployed (Vercel) — flag this at deployment time, not before.

## Next Phase Readiness
- The invite mechanism (Edge Function + UI + real end-to-end proof) is fully live on the hosted project. Plan 01-05 can build `/auth/confirm` and the set-password screen knowing the invite send/create/role-assignment path already works correctly, including from a real browser.
- The CRM's first real (non-seeded) Vendedor account already exists and is confirmed — useful for 01-05's own verification of the set-password completion flow, though 01-05 may prefer a fresh invite for its own clean test given this account already completed confirmation via Supabase's hosted verify endpoint (before `/auth/confirm` existed).
- New project-wide conventions worth reusing in any future Edge Function: the CORS-handling pattern (`corsHeaders` + `jsonResponse()` short-circuiting `OPTIONS`) and the structured `{ error: { code, message } }` error-body shape.
- No blockers.

---
*Phase: 01-autentica-o-e-pap-is*
*Completed: 2026-07-16*

## Self-Check: PASSED

All 10 claimed created/modified files found on disk (`supabase/functions/invite-user/index.ts`, `deno.json`, `.npmrc`, `tests/auth/invite.test.ts`, `app/(app)/equipe/page.tsx`, `components/auth/InviteUserForm.tsx`, `components/ui/select.tsx`, `supabase/config.toml`, `app/(app)/layout.tsx`, `tsconfig.json`). All 6 task commits (`7d25af1`, `66526b9`, `72e1885`, `52f737f`, `5a8a943`, `b338734`) confirmed present in git history.
