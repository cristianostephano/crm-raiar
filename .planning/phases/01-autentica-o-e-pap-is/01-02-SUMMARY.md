---
phase: 01-autentica-o-e-pap-is
plan: 02
subsystem: auth
tags: [supabase, postgres, rls, security-definer, triggers, vitest]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Real Supabase project, installed @supabase/supabase-js + @supabase/ssr, Vitest wired, tests/helpers/supabase-test-clients.ts (anonClient/serviceClient/signInAs), supabase/config.toml"
provides:
  - "public.profiles table (id, email, nome, sobrenome, celular, role, created_at) with RLS enabled and a SELECT policy for all authenticated users"
  - "user_role enum ('supervisor' | 'vendedor') as the authorization source of truth"
  - "is_supervisor() SECURITY DEFINER helper — the pattern every future RLS policy in this project calls to check role"
  - "handle_new_user() trigger on auth.users that syncs invite/createUser metadata into profiles automatically"
  - "First Supervisor account (real owner email) + two Vendedor test accounts (Vendedor A, Vendedor B) seeded and authenticatable, via idempotent supabase/seed/seed-users.mjs"
  - "tests/auth/rls-roles.test.ts — reusable cross-role RLS isolation test pattern (signs in as each seeded role, not just service-role)"
affects: [01-03, 01-04, 01-05, phase-02-cliente, phase-03-kanban, phase-04-admin, phase-05-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "is_supervisor() SECURITY DEFINER, STABLE, set search_path = public — every future RLS policy needing a role check calls this, never re-derives the role lookup inline (avoids RLS recursion on profiles)"
    - "(select auth.uid()) wrapping in every RLS policy/function body from this migration onward (Pitfall 4 convention, now established project-wide)"
    - "profiles rows are only ever created by the handle_new_user AFTER INSERT trigger (SECURITY DEFINER) — no INSERT/UPDATE/DELETE policy exists for regular users; absence of a write policy is itself the Tampering control"
    - "Test accounts seeded via service-role admin.createUser (email_confirm: true, no invite email) for bootstrap/test purposes, distinct from the real Supervisor-invites-Vendedor flow (D-02) built in a later plan"
    - "RLS verification via the Supabase Management API (POST /v1/projects/{ref}/database/query with SUPABASE_ACCESS_TOKEN) — used because the JS client has no raw-SQL escape hatch to check pg_class.relrowsecurity"

key-files:
  created:
    - supabase/migrations/0001_profiles_and_roles.sql
    - supabase/seed/seed-users.mjs
    - tests/auth/rls-roles.test.ts
  modified: []

key-decisions:
  - "First Supervisor account (cristiano.stephano@raiarorganicos.com.br) created via admin.createUser with a known temporary password, not the invite flow — matches D-03 ('cadastrado diretamente no banco'); owner can change the password later via 'Esqueci minha senha' (D-08) once that flow ships in a later plan."
  - "Vendedor A/B test accounts use fixed @raiar.local test emails and known passwords, seeded idempotently — reused by every future phase's RLS tests per Pitfall 2 (never test only as Supervisor)."
  - "RLS enablement verified via the Supabase Management API's SQL-query endpoint (using the same personal access token needed for `supabase link`/`db push`), since supabase-js has no raw SQL passthrough for querying pg_class directly."

patterns-established:
  - "Every future migration's RLS policy checking 'is this user a Supervisor?' calls is_supervisor(), never repeats the SECURITY DEFINER lookup inline."
  - "tests/auth/rls-roles.test.ts's SEED_ACCOUNTS constants (supervisor/vendedorA/vendedorB emails+passwords) are the canonical seeded test identities — future phases' RLS tests should reuse these same three accounts via signInAs() rather than seeding new ones, unless a new role/scenario is actually needed."

requirements-completed: [AUTH-02, AUTH-03]

coverage:
  - id: D1
    description: "profiles table + user_role enum exist on the hosted project, with RLS enabled and a SELECT policy (no silent full-leak, no silent empty result)"
    requirement: AUTH-03
    verification:
      - kind: other
        ref: "supabase migration list --linked -> {\"migrations\":[{\"local\":\"0001\",\"remote\":\"0001\"}]}; Management API SELECT relrowsecurity FROM pg_class WHERE relname='profiles' -> true"
        status: pass
    human_judgment: false
  - id: D2
    description: "is_supervisor() SECURITY DEFINER helper correctly distinguishes Supervisor vs Vendedor callers, safe from RLS recursion"
    requirement: AUTH-03
    verification:
      - kind: integration
        ref: "tests/auth/rls-roles.test.ts#is_supervisor() returns true for a supervisor-role caller / #is_supervisor() returns false for a vendedor-role caller"
        status: pass
    human_judgment: false
  - id: D3
    description: "handle_new_user() trigger automatically creates a matching profiles row (with correct role) whenever a new auth.users row is inserted"
    requirement: AUTH-02
    verification:
      - kind: other
        ref: "supabase/seed/seed-users.mjs verifyProfileRole() — all 3 seeded accounts (supervisor.role='supervisor', vendedorA.role='vendedor', vendedorB.role='vendedor') confirmed post-createUser"
        status: pass
    human_judgment: false
  - id: D4
    description: "First Supervisor (real owner email) and two Vendedor test accounts exist and can authenticate"
    requirement: AUTH-02
    verification:
      - kind: integration
        ref: "tests/auth/rls-roles.test.ts — signInAs() succeeds for all three seeded accounts across all 5 tests"
        status: pass
    human_judgment: false
  - id: D5
    description: "Automated test proves Vendedor A cannot tamper with Vendedor B's profiles row (UPDATE and DELETE both affect zero rows), while every authenticated user can still SELECT the full list"
    requirement: AUTH-03
    verification:
      - kind: integration
        ref: "tests/auth/rls-roles.test.ts#Vendedor A cannot UPDATE Vendedor B's profiles row / #Vendedor A cannot DELETE Vendedor B's profiles row / #every authenticated user (Vendedor A) can SELECT the full profiles list"
        status: pass
    human_judgment: false

# Metrics
duration: ~45min (including 2 checkpoint pauses for D-03 owner email and Supabase personal access token)
completed: 2026-07-15
status: complete
---

# Phase 1 Plan 2: Profiles, Roles & RLS Foundation Summary

**profiles table + user_role enum + is_supervisor() SECURITY DEFINER + handle_new_user() trigger pushed live to the hosted Supabase project, with three seeded accounts (1 Supervisor + 2 Vendedor) and an automated cross-role RLS isolation test proving Vendedor-vs-Vendedor tampering is blocked.**

## Performance

- **Duration:** ~45 min active work (across 2 human checkpoint pauses: D-03 owner email, Supabase personal access token)
- **Started:** 2026-07-15 (session start, continuing from 01-01)
- **Completed:** 2026-07-15T12:44:04Z
- **Tasks:** 3 (1 checkpoint, 2 auto — Task 1 further hit a dynamic authentication gate before Task 3 could complete)
- **Files modified:** 3 (all new: 1 migration, 1 seed script, 1 test file)

## Accomplishments
- Wrote the single authoritative migration (`0001_profiles_and_roles.sql`) creating `user_role` enum, `profiles` table, enabled RLS + SELECT policy, `is_supervisor()` `SECURITY DEFINER`/`STABLE` helper, and the `handle_new_user()` `AFTER INSERT` trigger on `auth.users` — every `auth.uid()` wrapped as `(select auth.uid())` per the project's RLS convention
- Pushed the migration to the real hosted Supabase project (`supabase link` + `supabase db push`, confirmed via `supabase migration list --linked` showing `0001` applied both locally and remotely) and independently verified `relrowsecurity = true` for `public.profiles` via the Supabase Management API's SQL-query endpoint
- Wrote and ran `supabase/seed/seed-users.mjs` — an idempotent Node script that seeds the first Supervisor (real owner email, confirmed by the project owner) plus two Vendedor test accounts via `admin.createUser` (`email_confirm: true`, no invite email), and independently verifies each account's `profiles.role` was correctly populated by the trigger (validating RESEARCH.md Assumption A1)
- Proved the seed script is idempotent by re-running it (all three accounts correctly skipped as already-existing on the second run)
- Wrote `tests/auth/rls-roles.test.ts` and drove it from RED (5/5 failing — no accounts existed, migration not pushed) to GREEN (5/5 passing) once the migration was live and accounts seeded: every authenticated user can SELECT the full `profiles` list, Vendedor A's UPDATE/DELETE against Vendedor B's row both affect zero rows, and `is_supervisor()` correctly returns `true`/`false` for Supervisor/Vendedor respectively

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the profiles + RLS + is_supervisor + trigger migration and its RLS isolation test** - `a580eef` (test)
2. **Task 2: Get the first Supervisor email from the owner (D-03)** - checkpoint, no code commit (gate-only; answered by the project owner mid-session: `cristiano.stephano@raiarorganicos.com.br`)
3. **Task 3: Push the migration to hosted Supabase, seed users, verify RLS green** - `7f277f0` (feat)

**Plan metadata:** _pending — see final commit below_

_Note: Task 1 used `tdd="true"` — the `test` commit is the RED gate; Task 3's `feat` commit is the GREEN gate (migration pushed, seeds run, suite green). No separate REFACTOR commit was needed._

## Files Created/Modified
- `supabase/migrations/0001_profiles_and_roles.sql` - `user_role` enum, `profiles` table, RLS enable + SELECT policy, `is_supervisor()`, `handle_new_user()` trigger — applied to the hosted project
- `supabase/seed/seed-users.mjs` - Idempotent seed of Supervisor + 2 Vendedor test accounts via `admin.createUser`, with post-seed `profiles.role` verification
- `tests/auth/rls-roles.test.ts` - Cross-role RLS isolation tests (SELECT-allowed, UPDATE/DELETE-blocked for non-owning Vendedor) + `is_supervisor()` role-distinction tests; exports `SEED_ACCOUNTS` for reuse by future phases' RLS tests

## Decisions Made
- First Supervisor seeded with a known temporary password (not via the invite flow, since D-01/D-02's invite flow doesn't exist yet and no Supervisor exists to invite the first one) — the owner can rotate it later via "Esqueci minha senha" (D-08) once that screen is built.
- Vendedor A/B test accounts use fixed `@raiar.local` test emails, reused as the canonical seeded identities for every future phase's RLS tests (exported as `SEED_ACCOUNTS` from `tests/auth/rls-roles.test.ts`).
- Verified RLS enablement via the Supabase Management API's `database/query` endpoint (same personal access token already needed for `supabase link`/`db push`) rather than adding a `pg` dependency, since supabase-js has no raw-SQL passthrough.

## Deviations from Plan

None - plan executed exactly as written. Both pauses (Task 2's owner-email checkpoint and the dynamic authentication gate hit while attempting `supabase link` before any `SUPABASE_ACCESS_TOKEN` was available) were expected per the plan's own `[BLOCKING]` framing of Task 3 and D-03's explicit "ask the owner at implementation time" instruction — not deviations from the plan's design.

## Issues Encountered
- `supabase link`/`supabase db push` required a Supabase personal access token; none was present in the environment or in any local CLI credential store (`~/.supabase`, `%APPDATA%/supabase`, `%LOCALAPPDATA%/supabase` all checked). This is a standard authentication gate, not a bug — resolved by the project owner generating a token at https://supabase.com/dashboard/account/tokens and supplying it for one-time use (never written to any file, never echoed back).
- `supabase db push` printed a benign warning about failing to cache the migrations catalog because Docker Desktop isn't running/elevated on this machine — does not affect local dev going forward and did not block the push itself (`Finished supabase db push.` printed immediately after).

## User Setup Required

None further — the Supabase personal access token used to push the migration and verify RLS was supplied for one-time CLI use during this session and is not persisted anywhere in the repository or in a dotfile. If a future plan needs to run `supabase db push` again non-interactively, the owner will need to supply a token again (or run `supabase login` once locally, outside this automation).

## Next Phase Readiness
- The authorization backbone (`profiles`, `user_role`, `is_supervisor()`, the `handle_new_user` trigger) is live on the hosted project — every later phase's RLS policy can now call `is_supervisor()` directly.
- Three seeded, authenticatable test/bootstrap accounts exist (Supervisor + Vendedor A + Vendedor B) and are exported as `SEED_ACCOUNTS` from `tests/auth/rls-roles.test.ts` for reuse.
- No blockers for 01-03 (SSR session plumbing: `lib/supabase/client.ts`/`server.ts`/`middleware.ts`, login screen) — it can now sign in as any of the three seeded accounts to build/test the login round-trip.
- Reminder for 01-04 (Supervisor-invite Edge Function): the *real* D-02 invite flow (`admin.inviteUserByEmail`) is still unbuilt — this plan's `admin.createUser`-based seeding was a bootstrap/test-only mechanism, not the production invite path.

---
*Phase: 01-autentica-o-e-pap-is*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 4 claimed files found on disk (`supabase/migrations/0001_profiles_and_roles.sql`, `supabase/seed/seed-users.mjs`, `tests/auth/rls-roles.test.ts`, `.planning/phases/01-autentica-o-e-pap-is/01-02-SUMMARY.md`). Both task commits (`a580eef`, `7f277f0`) confirmed present in git history.
