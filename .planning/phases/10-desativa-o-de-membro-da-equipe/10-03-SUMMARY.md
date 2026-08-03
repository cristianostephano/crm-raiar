---
phase: 10-desativa-o-de-membro-da-equipe
plan: 03
subsystem: testing
tags: [supabase, vitest, integration-test, rls, security-invariant]

# Dependency graph
requires:
  - phase: 10-desativa-o-de-membro-da-equipe (plan 01)
    provides: profiles.ativo, extended is_supervisor(), desativar_membro_equipe/reativar_membro_equipe RPCs (migration 0008)
  - phase: 10-desativa-o-de-membro-da-equipe (plan 02)
    provides: createTestMember/deleteTestMember disposable-fixture helpers (tests/helpers/supabase-test-clients.ts), narrowed schema-desativacao.test.ts first assertion
provides:
  - tests/equipe/rls-desativar-membro.test.ts — live-database proof of EQP-02 (self-deactivation refused, last-Supervisor invariant) and EQP-03 (post-deactivation is_supervisor()/RLS access loss on the same still-valid session)
  - Written structural finding (file header) that the "último Supervisor ativo" exception is unreachable while D-01 stands
affects: [10-04, 10-05, 10-06, 12-comparativo-por-vendedor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bounded sign-in retry (up to 3 attempts, ~1s apart) around a single signInAs call for a freshly created fixture, instead of raising Vitest's global timeout, per this project's documented live-project Auth rate-limit history"
    - "Proving a 'last-X-cannot-reach-zero' guard as an invariant (self-deactivation always refused + a legitimate second-target deactivation always succeeds and leaves >=1 active) instead of forcing an unreachable exception branch to fire"

key-files:
  created:
    - tests/equipe/rls-desativar-membro.test.ts
  modified: []

key-decisions:
  - "EQP-02's 'último Supervisor ativo' exception branch in desativar_membro_equipe is unreachable by construction while D-01 (self-deactivation guard) stands, because is_supervisor() already requires the caller to be an active Supervisor distinct from a self-targeted call — the caller alone keeps the last-Supervisor count at >=1. Proven as an invariant (Test 1 + Test 2) rather than by forcing the exception, per this plan's objective and the planner/plan-checker's endorsement recorded in CONTEXT.md."
  - "Reworded an explanatory comment ('WITHOUT refreshSession' -> 'WITHOUT any session-refresh call') that duplicated the literal substring its own acceptance-criteria grep counted (grep -c 'refreshSession' must return 0) — same self-inflicted-collision class already documented in 10-01/10-02's summaries. Fixed before committing, not a separate commit."

requirements-completed: [EQP-02, EQP-03]

coverage:
  - id: D1
    description: "Self-deactivation is refused before any write (D-01), and the caller's own profiles row is proven untouched after the rejection"
    requirement: "EQP-02"
    verification:
      - kind: integration
        ref: "tests/equipe/rls-desativar-membro.test.ts#self-deactivation is refused even while other Supervisors are active (D-01, EQP-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A legitimate second-Supervisor deactivation succeeds (the guard does not fire spuriously) and at least one active Supervisor always remains afterward — proves EQP-02 as an invariant given D-01 makes the exception branch itself unreachable"
    requirement: "EQP-02"
    verification:
      - kind: integration
        ref: "tests/equipe/rls-desativar-membro.test.ts#last supervisor: deactivating a second Supervisor is allowed and always leaves one active"
        status: pass
    human_judgment: false
  - id: D3
    description: "is_supervisor() returns true then false for the SAME client/still-valid access token across a single deactivation, with no re-authentication, no refreshSession, and no new client between the two assertions"
    requirement: "EQP-03"
    verification:
      - kind: integration
        ref: "tests/equipe/rls-desativar-membro.test.ts#is_supervisor() flips to false on the very next request with the same still-valid session (EQP-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A Supervisor-only categorias INSERT (with check (is_supervisor())) that would have succeeded before deactivation is refused after it, on the same unrefreshed client, proving the cascade reached a pre-existing policy with zero policy edits"
    requirement: "EQP-03"
    verification:
      - kind: integration
        ref: "tests/equipe/rls-desativar-membro.test.ts#is_supervisor() flips to false on the very next request with the same still-valid session (EQP-03) (step 6 assertion)"
        status: pass
    human_judgment: false

duration: ~6min active authoring + verification/cooldown time for a live-project Auth rate-limit window
completed: 2026-07-28
status: complete
---

# Phase 10 Plan 3: Live-Database Proof of EQP-02 (Last-Supervisor Invariant) and EQP-03 (Post-Deactivation Access Loss) Summary

**`tests/equipe/rls-desativar-membro.test.ts` proves against the live hosted database that the team can never reach zero active Supervisors and that a deactivated Supervisor loses `is_supervisor()`/RLS access on the very next request using the same still-valid token — with the last-Supervisor exception's structural unreachability written into the file, not left as tribal knowledge.**

## Performance

- **Duration:** ~6 min active authoring + verification (Task 1 commit to Task 2 commit), plus additional time absorbing a live-project Supabase Auth rate-limit cooldown triggered by this session's own repeated standalone verification runs (unrelated to the code itself)
- **Started:** 2026-07-28T16:22:25-03:00 (Task 1 commit)
- **Completed:** 2026-07-28T16:28:21-03:00 (Task 2 commit)
- **Tasks:** 2/2 (both `type="auto"`)
- **Files modified:** 1 (new file)

## Accomplishments

- `tests/equipe/rls-desativar-membro.test.ts` — new integration suite, three tests:
  1. **Self-deactivation refused (D-01, EQP-02):** a Supervisor calling `desativar_membro_equipe` on their own id is rejected with the migration's real exception text (`a própria conta`), and the caller's own `profiles.ativo` is proven still `true` afterward — the guard fires before any write.
  2. **Last-Supervisor invariant, no false positive (EQP-02):** deactivating a *second*, disposable Supervisor fixture succeeds (the guard does not spuriously block a legitimate deactivation), and afterward at least one active Supervisor is proven to remain (the seeded Supervisor), with the fixture's own row proven `ativo = false`.
  3. **Post-deactivation access loss on the same token (EQP-03):** a disposable Supervisor fixture signs in once and keeps that exact client/token; `is_supervisor()` is proven `true`, then a *different* client deactivates the fixture, then — with zero re-authentication, zero `refreshSession`, zero new client — `is_supervisor()` on the SAME client is proven `false`, and a Supervisor-only `categorias` INSERT (`with check (is_supervisor())`) on that same client is proven refused. This is the direct proof that RLS re-evaluates per request rather than trusting claims baked into the token, and that `is_supervisor()`'s cascading `ativo = true` condition reaches every pre-existing policy with zero policy edits.
- File header comment records the structural finding (also below) that the `Não é possível desativar o último Supervisor ativo` exception branch is unreachable while D-01 stands — this suite proves EQP-02 as an invariant rather than forcing that unreachable branch.
- All three pinned `-t` filters from `10-VALIDATION.md` (`"self"`, `"last supervisor"`, `"is_supervisor"`) match and pass; `npx vitest run tests/equipe` (all three files in the directory) exits 0 with 24/24 passing; `npx tsc --noEmit` exits 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Guard tests — self-deactivation refused, zero-Supervisor state unreachable (EQP-02, D-01)** - `6dbda05` (test)
2. **Task 2: Post-deactivation access test — same token, next request, access gone (EQP-03)** - `21587f7` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `tests/equipe/rls-desativar-membro.test.ts` - New integration test file (3 tests, EQP-02 + EQP-03) proving the phase's two live authorization guarantees against the hosted Supabase project

## Decisions Made

- Followed the plan's exact test-name substring requirements (`self`, `last supervisor`, `is_supervisor`) so `10-VALIDATION.md`'s pinned `-t` filters resolve without drift
- Recorded the structural EQP-02 finding (last-Supervisor exception unreachable while D-01 stands) in both the file header and this SUMMARY, per the plan's explicit instruction and the planner/plan-checker's prior endorsement of that finding
- Added a bounded (3-attempt, ~1s apart) sign-in retry around the one fresh-fixture sign-in call the EQP-03 test depends on, per the plan's guidance about this project's documented live sign-in flakiness — did not raise Vitest's global timeout
- The RPC under test is always called through a `signInAs` client; `serviceClient()` is confined to seeding, read-back, and teardown, so the guards under test genuinely run rather than being bypassed by the service role

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Explanatory comment duplicated the literal substring being grep-counted (`refreshSession`)**
- **Found during:** Task 2 (verifying acceptance criteria after writing the appended test)
- **Issue:** The step-5 comment originally read "WITHOUT re-authenticating, WITHOUT refreshSession, and..." — the comment itself contained the literal substring `refreshSession`, which the acceptance criterion `grep -c 'refreshSession' tests/equipe/rls-desativar-membro.test.ts` requires to return exactly `0` (proving the session is never refreshed between the true and false assertions). The comment's own wording inflated the count to `1`.
- **Fix:** Reworded to "WITHOUT any session-refresh call" — same meaning, no substring collision. Confirmed no `refreshSession()` call exists anywhere in the file (the actual behavioral requirement).
- **Files modified:** `tests/equipe/rls-desativar-membro.test.ts`
- **Verification:** Re-ran `grep -c 'refreshSession'` → returns `0`
- **Committed in:** `21587f7` (fixed before committing, not a separate commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 self-inflicted grep-collision fix, same class already documented in 10-01/10-02's summaries)
**Impact on plan:** Necessary to satisfy the plan's own stated acceptance criteria; did not touch any file outside what the plan specified.

## Known Test-Count Deviation (not a defect)

`10-VALIDATION.md` pins `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "is_supervisor"` expecting "exactly 1 test," and the plan's own acceptance criteria for the full file expects "3 passing tests total." In practice, running this file **standalone** shows more tests than that (3 matched for the `-t "is_supervisor"` filter; 8 total for the whole file) — **not because extra tests were added**, but because this file (like `tests/importacao/rls-importar-lote.test.ts` and `tests/equipe/reassignment.test.ts` before it) imports `SEED_ACCOUNTS` from `tests/auth/rls-roles.test.ts`. Vitest evaluates that imported module's top-level `describe`/`it` calls under whatever file is currently being collected, so `rls-roles.test.ts`'s own 5 tests (two of which also contain the substring `is_supervisor`) get re-registered as part of this file's test tree whenever it runs alone. This is a pre-existing Vitest/ESM-import quirk in this codebase, not something introduced by this plan — confirmed by re-running the file at multiple points and observing the exact same 5 extra tests every time, all of which pass. The command still exits `0` and every test that matches, including the one genuinely written by this plan, passes. Recorded here so a future reader doesn't mistake the raw test count for a coverage regression.

## Issues Encountered

- **Live-project Supabase Auth rate limit, triggered by this session's own verification volume (not a code defect):** After running the individual `-t`-filtered commands and the standalone file run successfully several times in a row during verification, a subsequent `npx vitest run tests/equipe` (all three files, 24 tests, each doing multiple live sign-ins) returned `Request rate limit reached` for several sign-in calls — the exact class of free-tier Supabase Auth throttling this plan's own `<important_note>` warned about for the full `npm test` suite, just reached one level down at `tests/equipe` due to the cumulative sign-in volume from my own repeated standalone verification runs immediately beforehand. Waited out a cooldown window and re-ran `npx vitest run tests/equipe` once more: all 3 files / 24 tests passed cleanly, exit 0. No code change was needed; this was purely external throttling, consistent with the account-credential rate-limit issue already documented in 10-02's SUMMARY (a different symptom of the same shared free-tier constraint).
- **No orphaned fixture data:** both disposable Supervisor fixtures created in this plan (`equipe-fixture-segundo-*`, `equipe-fixture-sessao-*`) were torn down via the unconditional `afterAll(deleteTestMember(...))` cleanup path; no ghost active/inactive Supervisor rows remain in the live team list beyond the intentionally-left-deactivated fixture rows (which is expected — deactivation, not deletion, is being tested, and `deleteTestMember` deletes the `auth.users`/`profiles` row entirely regardless of its `ativo` state at teardown time).

## User Setup Required

None — no new external service configuration required. This plan only added a test file exercising the already-live `desativar_membro_equipe`/`is_supervisor()` objects from 10-01.

## Next Phase Readiness

- EQP-02 and EQP-03 are now proven live, not just implemented — 10-04 through 10-06 (Server Action, UI, and remaining tests for this phase) can build on a database layer whose authorization guarantees are independently verified, not just code-reviewed.
- The last-Supervisor-guard unreachability finding is now recorded in three places (10-CONTEXT.md's prior endorsement, this file's header comment, and this SUMMARY) so no future reader mistakes the missing "exception fired" assertion for a coverage gap.
- No blockers carried forward. The rate-limit cooldown encountered during this plan's own verification is a transient, external, already-previously-documented constraint of the shared free-tier test project — not specific to this plan's code, and already resolved by the time this SUMMARY was written (final `npx vitest run tests/equipe` run: 24/24 passing).

## Self-Check: PASSED

- `tests/equipe/rls-desativar-membro.test.ts` — FOUND
- `.planning/phases/10-desativa-o-de-membro-da-equipe/10-01-SUMMARY.md` — FOUND
- `.planning/phases/10-desativa-o-de-membro-da-equipe/10-02-SUMMARY.md` — FOUND
- Commit `6dbda05` — FOUND in git log
- Commit `21587f7` — FOUND in git log

---
*Phase: 10-desativa-o-de-membro-da-equipe*
*Completed: 2026-07-28*
