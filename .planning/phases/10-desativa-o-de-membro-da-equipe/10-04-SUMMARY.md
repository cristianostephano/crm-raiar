---
phase: 10-desativa-o-de-membro-da-equipe
plan: 04
subsystem: api
tags: [supabase, service-role, auth-admin-api, server-actions, vitest, nextjs]

# Dependency graph
requires:
  - phase: 10-desativa-o-de-membro-da-equipe (plan 01)
    provides: profiles.ativo, extended is_supervisor(), desativar_membro_equipe/reativar_membro_equipe RPCs
  - phase: 10-desativa-o-de-membro-da-equipe (plan 02)
    provides: createTestMember/deleteTestMember disposable-fixture helpers
provides:
  - createAdminClient() — first Node-side service_role Supabase client in this codebase, confined to app/actions/equipe.ts
  - Live-verified proof that ban_duration "876000h" persists and "none" clears it (resolves 10-RESEARCH.md Assumptions A1/A2)
  - DesativarMembroErrorCode (8-member union), DesativarMembroResult, mapRpcErrorToCode() — pure, dependency-free error mapper
  - desativarMembroEquipe(profileId, novoResponsavelId) / reativarMembroEquipe(profileId) Server Actions — RPC-then-Auth-Admin-API orchestration
affects: [10-05, 10-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "service_role Supabase client confined to a single Next.js server module (lib/supabase/admin.ts), imported exclusively by the one Server Action file that needs it — mirrors the Deno-side invite-user Edge Function's own key-exposure discipline, transposed to the Node runtime"
    - "Single source-of-truth data array (RPC_ERROR_MATCHERS) used to derive BOTH a TypeScript literal-union type (via indexed-access on `as const`) AND the runtime matching logic, so each error-code string literal is written exactly once in the file — avoids the type declaration and the return-statement chain silently drifting apart"
    - "RPC-then-Auth-Admin-API sequencing in a Server Action: Postgres commits first (primary control, enforced via RLS on every subsequent request), then a second independent service call is attempted, with its own distinct failure code (ban_failed) rather than folding it into the RPC's own failure code"

key-files:
  created:
    - lib/supabase/admin.ts
    - lib/equipe/erros.ts
    - app/actions/equipe.ts
    - tests/equipe/auth-ban.test.ts
    - tests/equipe/erro-mapping.test.ts
  modified: []

key-decisions:
  - "Refactored lib/equipe/erros.ts away from the plan's literal if/else-chain description into a single RPC_ERROR_MATCHERS array that both the type union and the runtime matcher read from — the literal if/else design (as written in the plan's <action> prose) would have made 'self_deactivation'/'last_supervisor'/'invalid_substitute' each appear twice in the file (once in the type union, once in a return statement), failing the plan's own acceptance criteria (`grep -c` == 1). Same behavior, same test coverage, zero string-literal duplication."
  - "No app-layer role re-check in either Server Action — authorization lives entirely inside the SECURITY DEFINER RPC's own is_supervisor() first statement, per 10-PATTERNS.md's explicit instruction not to duplicate that boundary."

requirements-completed: [EQP-01, EQP-03]

coverage:
  - id: D1
    description: "createAdminClient() builds a working service_role client from the Next.js/Node process environment, proven by a real Auth Admin API round trip"
    requirement: "EQP-03"
    verification:
      - kind: integration
        ref: "tests/equipe/auth-ban.test.ts#builds a working service_role client from the Node process environment"
        status: pass
    human_judgment: false
  - id: D2
    description: "ban_duration '876000h' persists and 'none' clears it on the live hosted project — resolves 10-RESEARCH.md Assumptions Log A1 and A2"
    requirement: "EQP-03"
    verification:
      - kind: integration
        ref: "tests/equipe/auth-ban.test.ts#ban_duration '876000h' persists and 'none' clears it (resolves RESEARCH A1/A2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every distinct RPC failure (self-deactivation, last-active-Supervisor, invalid substitute, non-Supervisor caller, unmapped 'Membro não encontrado') maps to its own code via a pure unit-tested function"
    requirement: "EQP-01"
    verification:
      - kind: unit
        ref: "tests/equipe/erro-mapping.test.ts (9 assertions, all fragments + null/undefined/unmapped cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "desativarMembroEquipe/reativarMembroEquipe call the RPC first and the Auth Admin API second, reporting a step-2 (ban) failure with a code distinct from a step-1 (RPC) failure"
    requirement: "EQP-01"
    verification:
      - kind: unit
        ref: "grep-based acceptance criteria on app/actions/equipe.ts (supabase.rpc( line precedes createAdminClient() line in desativarMembroEquipe; ban_failed distinct from rpc_failed) — all pass"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "The actual live round-trip of desativarMembroEquipe/reativarMembroEquipe (calling the real RPC then the real Auth Admin API end-to-end) is exercised by plan 10-05/10-06's UI-level tests and 10-EVAL's manual login-block verification, not by a dedicated integration test in this plan — this plan proves the orchestration code's structure and sequencing (types, grep-verified line ordering, tsc) rather than a live Server-Action-level round trip, so a human sign-off on the later end-to-end flow is still warranted."

duration: ~25 min active work (3 tasks)
completed: 2026-07-28
status: complete
---

# Phase 10 Plan 4: Server-Side Deactivation Orchestration Summary

**`lib/supabase/admin.ts` (first Node-side service_role client in this codebase), a data-driven `mapRpcErrorToCode()` pure mapper, and the two Server Actions (`desativarMembroEquipe`/`reativarMembroEquipe`) that call the live RPC then the Auth Admin API — with a live-verified round trip resolving both `[ASSUMED]` claims (A1/A2) in 10-RESEARCH.md about `ban_duration`.**

## Performance

- **Duration:** ~25 min active work (3 tasks, all `type="auto"`)
- **Started:** 2026-07-28T16:19:37-03:00 (Task 1 test run)
- **Completed:** 2026-07-28T16:28:43-03:00 (Task 3 commit)
- **Tasks:** 3/3
- **Files modified:** 5 (all new files)

## Accomplishments

- `lib/supabase/admin.ts` — `createAdminClient()`, the first Next.js-server-process reader of `SUPABASE_SERVICE_ROLE_KEY` in this codebase (previously only the Deno Edge Function runtime read it); header comment documents the confined-import discipline (import only from `app/actions/equipe.ts`)
- `tests/equipe/auth-ban.test.ts` — 2 passing tests proving the service_role client is reachable from Node, and that `ban_duration: "876000h"` actually persists on the live hosted project while `ban_duration: "none"` actually clears it — **resolves RESEARCH.md's Assumptions Log rows A1 and A2**, both previously `[ASSUMED]`
- `lib/equipe/erros.ts` — `DesativarMembroErrorCode` (8-member union), `DesativarMembroResult`, and `mapRpcErrorToCode()`, a pure dependency-free mapper from Postgres exception text to one of four distinct causes (`self_deactivation`, `last_supervisor`, `invalid_substitute`, `forbidden`), everything else (including the deliberately-unmapped `Membro não encontrado`) falling back to `rpc_failed`
- `tests/equipe/erro-mapping.test.ts` — 9 passing assertions against the migration's exact exception strings, including the ordering property that `Somente supervisores...` must map to `forbidden`, not `rpc_failed`
- `app/actions/equipe.ts` — `desativarMembroEquipe`/`reativarMembroEquipe` Server Actions: `getUser()` preamble, RPC call first (transaction boundary), Auth Admin API ban/unban second, `ban_failed` reported as a code distinct from `rpc_failed` since the RPC has already committed by that point, `revalidatePath("/equipe")` on success for both

## Task Commits

Each task was committed atomically:

1. **Task 1: service_role client for the Next.js process + live ban/unban round trip** - `9c28e72` (feat)
2. **Task 2: Pure error-code mapper for the two RPCs** - `9e5b975` (feat)
3. **Task 3: Server Actions — desativarMembroEquipe / reativarMembroEquipe** - `85b6f56` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `lib/supabase/admin.ts` - `createAdminClient()` factory (service_role, server-only, no cached singleton)
- `tests/equipe/auth-ban.test.ts` - Live ban/unban round-trip proof, resolves RESEARCH A1/A2
- `lib/equipe/erros.ts` - `DesativarMembroErrorCode`, `DesativarMembroResult`, `mapRpcErrorToCode()`
- `tests/equipe/erro-mapping.test.ts` - Pure unit test for the mapper (9 assertions)
- `app/actions/equipe.ts` - `desativarMembroEquipe`/`reativarMembroEquipe` Server Actions

## Decisions Made

- Followed 10-PATTERNS.md's exact `createAdminClient()` factory and Server Action orchestration shape verbatim — no deviation there.
- Restructured `lib/equipe/erros.ts`'s internals (see Deviations below) from the plan's literal if/else description into a single-source-of-truth array, to satisfy the plan's own acceptance criteria without changing any observable behavior or test coverage.
- Confirmed via `.claude/skills/Supabase-conventions/SKILL.md`: this stays a Server Action, not a second Edge Function, since the service_role need here is purely to call the Auth Admin API after an already-authorized RPC call — no new trust boundary requiring the RLS/RPC/Edge-Function escalation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `lib/equipe/erros.ts`'s literal if/else design (as written in the plan's action prose) would have failed its own acceptance criteria**
- **Found during:** Task 2 (verifying acceptance criteria after writing the first draft)
- **Issue:** The plan's `<action>` describes `mapRpcErrorToCode` as an if/else chain with each branch doing `return "self_deactivation"` (etc.), while the exported type also declares `"self_deactivation"` (etc.) as literal union members. Writing it exactly as described makes `grep -c 'self_deactivation' lib/equipe/erros.ts` return `2` (one hit in the type union, one in the return statement) — but the plan's acceptance criteria requires it to return exactly `1`. Same collision for `last_supervisor` and `invalid_substitute`.
- **Fix:** Replaced the if/else chain with a single `RPC_ERROR_MATCHERS` array of `{ fragment, code }` pairs (`as const`), with the exported type union deriving the matchable codes via `(typeof RPC_ERROR_MATCHERS)[number]["code"]` instead of re-listing the literals, and `mapRpcErrorToCode` looping over the same array instead of hardcoding a parallel branch per literal. Each error-code string now appears exactly once in the file, and the type and the runtime logic can no longer silently drift apart from each other.
- **Files modified:** `lib/equipe/erros.ts`
- **Verification:** Re-ran all four affected greps (`self_deactivation`, `last_supervisor`, `invalid_substitute`, `ban_failed`) → each returns `1`; re-ran `npx vitest run tests/equipe/erro-mapping.test.ts` (all 9 assertions still pass, same behavior); re-ran `npx tsc --noEmit` (clean)
- **Committed in:** `9e5b975` (fixed before committing, not a separate commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 bug — a plan-description-vs-acceptance-criteria self-collision, same class already documented in 10-01's and 10-02's SUMMARYs, but structural here rather than a comment duplicating a grep target)
**Impact on plan:** The fix was necessary to satisfy the plan's own stated acceptance criteria. It changed the mapper's internal implementation strategy but not its type surface, its exported function signature, or any test's expected outcome — no scope creep.

## Issues Encountered

- **External, pre-existing infra constraint (not caused by this plan's code): live Supabase Auth rate-limiting under concurrent wave load.** Running `npx vitest run tests/equipe` (the full directory, as the plan's Task 3 acceptance criterion asks) intermittently fails several tests in `tests/equipe/schema-desativacao.test.ts` and `tests/equipe/reassignment.test.ts` — both files from earlier plans (10-01/10-02), untouched by this plan — with `Request rate limit reached` on `signInAs(...)` calls. This is the exact free-tier Supabase Auth throttling flagged in this plan's own `<important_note>`, worsened here because plan 10-03 runs in the same wave, in a sibling worktree, against the same shared live Supabase project, also issuing password sign-ins concurrently. Confirmed this is not a regression from this plan's changes: `tests/equipe/auth-ban.test.ts` and `tests/equipe/erro-mapping.test.ts` (this plan's own new files, which use only the service_role client or pure functions — no password sign-in) pass reliably and repeatedly in isolation (`npx vitest run tests/equipe/auth-ban.test.ts tests/equipe/erro-mapping.test.ts` — 11/11 passing on the final run). `npx tsc --noEmit` is clean across the whole project. Per the executor's scope-boundary rule ("Only auto-fix issues DIRECTLY caused by the current task's changes"), no fix was attempted on the shared-account rate-limit condition itself — it is a live-account/timing state, not a code defect, and it is already flagged for the project coordinator as a known constraint. Recommended follow-up: re-run `npx vitest run tests/equipe` once wave 3's parallel worktree agents have finished and released load on the shared project.

## User Setup Required

**Action needed before the first production deploy of this feature (not blocking local development):** add `SUPABASE_SERVICE_ROLE_KEY` to Vercel's environment variables (Production **and** Preview), per this plan's `user_setup` frontmatter. Source: Supabase Dashboard -> Project Settings -> API -> `service_role` (secret). **Never** prefix it with `NEXT_PUBLIC_` — that would publish it into the browser bundle. The key already exists in `.env.local` for local work (same value `tests/helpers/supabase-test-clients.ts` reads today), so nothing blocks continued local development or this plan's own test suite; this is only a pending item before `desativarMembroEquipe`/`reativarMembroEquipe` can actually block/unblock logins once deployed.

## Next Phase Readiness

- `app/actions/equipe.ts` is ready for plan 10-05 (UI: `EquipeList.tsx`, `DesativarMembroDialog.tsx`, `page.tsx` edit) to call directly — both Server Actions' result shape (`DesativarMembroResult`) and error codes (`DesativarMembroErrorCode`) match 10-PATTERNS.md exactly, so the dialog's error-to-copy mapping in 10-UI-SPEC.md's Copywriting Contract can be wired without any further backend changes.
- RESEARCH.md's Assumptions Log rows A1 and A2 are now resolved by an automated, passing test (`tests/equipe/auth-ban.test.ts`) — only the human-facing half (a real login attempt actually being refused after a real deactivation, per 10-RESEARCH.md's "EQP-03 (manual)" row) remains manual, unchanged from before this plan.
- No architectural blockers for 10-05/10-06. The one open item worth flagging forward: the Vercel `SUPABASE_SERVICE_ROLE_KEY` environment variable (see User Setup Required above) needs to be set before this feature's ban/unban behavior works in a deployed environment — it does not block any further local plan execution in this phase.

## Self-Check: PASSED

- `lib/supabase/admin.ts` — FOUND
- `tests/equipe/auth-ban.test.ts` — FOUND
- `lib/equipe/erros.ts` — FOUND
- `tests/equipe/erro-mapping.test.ts` — FOUND
- `app/actions/equipe.ts` — FOUND
- Commit `9c28e72` — FOUND in git log
- Commit `9e5b975` — FOUND in git log
- Commit `85b6f56` — FOUND in git log

---
*Phase: 10-desativa-o-de-membro-da-equipe*
*Completed: 2026-07-28*
