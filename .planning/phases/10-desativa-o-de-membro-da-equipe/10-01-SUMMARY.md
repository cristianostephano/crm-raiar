---
phase: 10-desativa-o-de-membro-da-equipe
plan: 01
subsystem: database
tags: [supabase, postgres, rls, security-definer, plpgsql, vitest]

# Dependency graph
requires:
  - phase: 01-autentica-o-e-pap-is
    provides: profiles table, is_supervisor() (original), SEED_ACCOUNTS test identities
  - phase: 02-cadastro-e-gest-o-de-clientes-pj
    provides: clientes table, status_acompanhamento enum
provides:
  - profiles.ativo boolean column (not null default true)
  - is_supervisor() extended to require ativo = true (cascades to every existing RLS policy with zero policy edits)
  - desativar_membro_equipe(p_profile_id, p_novo_responsavel_id) RPC — SECURITY DEFINER, self-gated, D-01 self-deactivation guard, EQP-02 TOCTOU-safe last-Supervisor guard, EQP-01/EQP-04 em_andamento-only reassignment
  - reativar_membro_equipe(p_profile_id) RPC — SECURITY DEFINER, self-gated, D-02 low-friction reactivation
  - tests/equipe/schema-desativacao.test.ts — read-only smoke test proving all four objects exist in the LIVE hosted database
affects: [10-02, 10-03, 10-04, 10-05, 10-06, 12-comparativo-por-vendedor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER RPC pair with is_supervisor() as the literal first statement of the function body (second/third documented exception to this codebase's non-security-definer convention, after is_supervisor() itself)"
    - "Row-locking guard (perform ... for update) taken BEFORE a count(*) check, inside the same transaction, to close a TOCTOU window on a last-active-role guard"
    - "Two sequential top-level UPDATE statements (never chained into one data-modifying CTE) when one write's visibility must be seen by relying application logic in the same function — the 0006 CTE/RLS-visibility bug precedent"

key-files:
  created:
    - supabase/migrations/0008_desativacao_membro_equipe.sql
    - tests/equipe/schema-desativacao.test.ts
  modified: []

key-decisions:
  - "D-01/D-02 implemented entirely at the database level in this plan, ahead of any Server Action or UI (later plans in this phase depend on it)"
  - "No UPDATE policy added on profiles; no is_ativo() helper; no edits to the Vendedor branch of clientes/tarefas/historico policies — explicitly out of scope per 10-CONTEXT.md/10-PATTERNS.md (T-10-06 accepted residual)"

patterns-established:
  - "Live-database push verification via a dedicated read-only smoke test in tests/<feature>/schema-*.test.ts, run immediately after supabase db push, so a clean tsc/next build can never falsely signal a migration verified state"

requirements-completed: [EQP-01, EQP-02, EQP-03, EQP-04]

coverage:
  - id: D1
    description: "profiles.ativo column added, not null default true, every existing member stays active after the push"
    requirement: "EQP-02"
    verification:
      - kind: integration
        ref: "tests/equipe/schema-desativacao.test.ts#profiles.ativo exists and defaults to true"
        status: pass
    human_judgment: false
  - id: D2
    description: "is_supervisor() extended to require ativo = true, cascading to every existing RLS policy with zero policy edits (primary EQP-03 enforcement)"
    requirement: "EQP-03"
    verification:
      - kind: integration
        ref: "tests/equipe/schema-desativacao.test.ts#is_supervisor() still returns true for the active seeded Supervisor"
        status: pass
    human_judgment: false
  - id: D3
    description: "desativar_membro_equipe RPC exists live, self-gated by is_supervisor() as the literal first statement, rejects non-Supervisor callers before touching any row, implements D-01 self-deactivation guard and the TOCTOU-safe last-active-Supervisor guard, reassigns only em_andamento clientes (EQP-01/EQP-04)"
    requirement: "EQP-01"
    verification:
      - kind: integration
        ref: "tests/equipe/schema-desativacao.test.ts#desativar_membro_equipe exists and rejects a non-Supervisor caller"
        status: pass
      - kind: manual_procedural
        ref: "Task 2 human-verify checkpoint — coordinator independently confirmed guard order, D-01 placement, for-update-before-count ordering, two-separate-statements structure, and em_andamento filter against the actual committed SQL"
        status: pass
    human_judgment: true
    rationale: "The guard-ordering and TOCTOU-safety properties of a SECURITY DEFINER RPC against a live production database are exactly the kind of irreversible-if-wrong change this project's Task 2 blocking checkpoint exists for — automated tests prove the RPC rejects a non-Supervisor caller, but they cannot prove absence of a subtle ordering bug the way a human line-by-line read can. Already satisfied via the completed Task 2 checkpoint, included here for the traceability record."
  - id: D4
    description: "reativar_membro_equipe RPC exists live, self-gated by is_supervisor(), implements D-02 low-friction reactivation"
    requirement: "EQP-02"
    verification:
      - kind: integration
        ref: "tests/equipe/schema-desativacao.test.ts#reativar_membro_equipe exists and rejects a non-Supervisor caller"
        status: pass
    human_judgment: false

duration: ~50min active work (Task 1 + Task 3), spanning a blocking human-verify checkpoint pause between sessions
completed: 2026-07-28
status: complete
---

# Phase 10 Plan 1: Database Foundation for Team Member Deactivation Summary

**Migration 0008 adds `profiles.ativo`, extends `is_supervisor()` to require it, and ships two `SECURITY DEFINER` RPCs (`desativar_membro_equipe`, `reativar_membro_equipe`) — pushed live and proven by a read-only smoke test, not just a clean build.**

## Performance

- **Duration:** ~50 min active work (Task 1 authoring + Task 3 test/verification), with a blocking human-verify checkpoint (Task 2) pausing execution between sessions for real coordinator review of the SQL before it touched production
- **Started:** 2026-07-27T15:55:34-03:00 (Task 1 commit)
- **Completed:** 2026-07-28T11:11:35-03:00 (Task 3 commit)
- **Tasks:** 3/3 (1 auto, 1 checkpoint, 1 auto)
- **Files modified:** 2 (both new files)

## Accomplishments
- `profiles.ativo boolean not null default true` — every existing team member stays active after the push
- `is_supervisor()` now also requires `ativo = true`, cascading to every existing RLS policy with zero policy edits — this is the primary EQP-03 enforcement, since RLS re-evaluates on every request
- `desativar_membro_equipe(p_profile_id, p_novo_responsavel_id)` — `SECURITY DEFINER` RPC, gated by `is_supervisor()` as its literal first statement, implementing D-01 (no self-deactivation), the TOCTOU-safe last-active-Supervisor guard (EQP-02), and EQP-01/EQP-04 reassignment of only `em_andamento` clientes (already-won/lost clientes stay with the deactivated member)
- `reativar_membro_equipe(p_profile_id)` — `SECURITY DEFINER` RPC implementing D-02 (low-friction reactivation, no guards beyond the Supervisor check)
- `tests/equipe/schema-desativacao.test.ts` — 4 read-only assertions proving all four database objects exist in the LIVE hosted database, guarding against the false-positive "verified" state a clean `tsc`/`next build` would otherwise produce
- Migration applied to the live hosted database via `supabase db push` (confirmed via `supabase migration list`: `0008` present both locally and remotely)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write migration 0008 — profiles.ativo, is_supervisor() extension, and both RPCs** - `36fe381` (feat)
2. **Task 2: Human review of the migration SQL before it touches the live database** - checkpoint only, no file change; approved by the project coordinator, who independently verified all 7 review points against the actual committed SQL
3. **Task 3: Push the migration to the live database and prove it landed** - `48b7c8d` (test)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `supabase/migrations/0008_desativacao_membro_equipe.sql` - New migration: `profiles.ativo` column, extended `is_supervisor()`, `desativar_membro_equipe` RPC, `reativar_membro_equipe` RPC
- `tests/equipe/schema-desativacao.test.ts` - New read-only smoke test proving the migration landed in the live database (4 assertions)

## Decisions Made
- Followed 10-PATTERNS.md's exact SQL for the migration verbatim, as instructed — no deviation from the specified RPC bodies, guard order, or comment content beyond what's noted below
- D-01/D-02 and the EQP-01..04 requirements are implemented entirely at the database level in this plan; the Server Action / UI layers that call these RPCs are deferred to later plans in this phase (already reflected in the plan's own scope)
- Confirmed via 10-CONTEXT.md/10-PATTERNS.md: no `is_ativo()` helper and no edits to the Vendedor branch of `clientes`/`tarefas`/`historico` policies — the residual window where a deactivated Vendedor's still-valid JWT (up to ~1h) can read their own already-closed clientes was already presented to and accepted by the project owner in an earlier session; out of scope for this plan
- **REQUIREMENTS.md traceability intentionally left as "Pending" for EQP-01..04**, mirroring the exact precedent already recorded in STATE.md for Phase 9 (LOC-01/02/04): this plan only delivers the database foundation. EQP-01's "Supervisor desativa um membro da equipe" and EQP-03's "Membro desativado não consegue mais entrar no sistema" describe the full user-facing flow, which requires the Server Action (Auth Admin API `ban_duration` call) and UI still to be built in 10-02 through 10-06. Ran `gsd-tools query requirements.mark-complete` once to check the actual behavior, saw it would mark all four `[x]` and "Complete" prematurely, then reverted `.planning/REQUIREMENTS.md` via `git checkout --` before staging anything else

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Explanatory comment accidentally duplicated the literal substring being grep-counted by an acceptance criterion**
- **Found during:** Task 1 (verifying acceptance criteria after writing the migration)
- **Issue:** The plan's acceptance criteria requires `grep -c 'for update' supabase/migrations/0008_desativacao_membro_equipe.sql` to return exactly `1` (proving the TOCTOU row lock is present exactly once). My first draft's explanatory comment above the guard read "The `for update` row lock is taken BEFORE..." — the comment itself contained the literal substring `for update`, inflating the grep count to 2 and failing the acceptance criterion even though the actual SQL was correct.
- **Fix:** Reworded the comment to "The row-locking `perform` statement below is taken BEFORE the count(*) check..." — same meaning, without the literal substring collision.
- **Files modified:** `supabase/migrations/0008_desativacao_membro_equipe.sql`
- **Verification:** Re-ran `grep -c 'for update'` → returns `1`; all other acceptance-criteria greps re-verified individually (security definer count 3, ativo column-add count 1, `role = 'supervisor' and ativo = true` count 3, `get diagnostics` count 1, `em_andamento` filter count 1, `reativar_membro_equipe` definition count 1, guard line precedes both UPDATE lines)
- **Committed in:** `36fe381` (Task 1 commit — fixed before committing, not a separate commit)

**2. [Rule 3 - Blocking] `.env.local` missing in this git worktree, blocking the Task 3 smoke test from running at all**
- **Found during:** Task 3 (first `npx vitest run tests/equipe/schema-desativacao.test.ts` attempt)
- **Issue:** All 9 tests failed immediately with `Missing required environment variable "NEXT_PUBLIC_SUPABASE_URL"`. `.env.local` is gitignored and — same class of issue STATE.md already flagged for `gsd-tools.cjs` in a prior phase's worktree (09-01) — does not carry over from the main checkout into a freshly created git worktree, since it was never a tracked file to begin with.
- **Fix:** Copied `.env.local` directly from the main checkout (`C:\Users\Cristiano\workspace\crm-raiar\.env.local`) into this worktree's root via `cp`, without ever reading/printing its contents into the conversation. Confirmed via `git check-ignore -v .env.local` that the file remains gitignored in the worktree and cannot be accidentally committed.
- **Files modified:** none tracked (`.env.local` itself is not part of any commit — confirmed via `git status --short` before and after staging Task 3's files)
- **Verification:** Re-ran the test suite — all 9 tests (4 new + 5 imported via `SEED_ACCOUNTS`) passed
- **Committed in:** not applicable — no tracked file changed by this fix

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocking issue)
**Impact on plan:** Both fixes were necessary to satisfy the plan's own stated acceptance criteria and to run the plan's own required verification command; neither introduced scope creep or touched any file outside what the plan specified.

## Issues Encountered

- **Tooling/permission blocker (not a plan or SQL defect):** After the coordinator's Task 2 "approved" message, my own attempt to run `npx supabase link` (a prerequisite for `supabase db push`) was denied twice by the Claude Code auto-mode classifier as a state-changing production-database operation, even though conversational approval had already been given. Per the executor's own auth-gate/deviation-rule guidance, I did not attempt to work around this (no raw `psql`, no sandbox bypass) and instead stopped and reported the exact blocker back to the coordinator. The coordinator ran `supabase link` + `supabase db push` themselves directly from a terminal at this worktree's path, confirmed via `supabase db push --dry-run` (exactly one pending migration, no drift) followed by the real push (`"Finished supabase db push."`, migration `0008_desativacao_membro_equipe.sql` applied). I independently re-verified this afterward via the read-only `supabase migration list` command, which showed `0008` present in both the `local` and `remote` columns before writing this summary.
- A second, unrelated `git commit` attempt (Task 3's commit) was denied once by the same classifier with an explicit "usually transient — retrying often succeeds" message; the immediate retry succeeded with no changes to the command.

## User Setup Required

None - no new external service configuration required. The migration was pushed to the already-linked, already-configured Supabase project.

## Next Phase Readiness

- All four database objects this phase's later plans depend on (`profiles.ativo`, extended `is_supervisor()`, `desativar_membro_equipe`, `reativar_membro_equipe`) are live and proven, not just committed to a file — plans 10-02 through 10-06 (admin client, Server Actions, UI, tests) can now safely call them.
- No blockers carried forward. The one open item worth a note for a future phase (not this one): T-10-06's accepted residual ~1h JWT window for a deactivated Vendedor remains intentionally unaddressed, per the already-locked decision in 10-CONTEXT.md.

## Self-Check: PASSED

- `supabase/migrations/0008_desativacao_membro_equipe.sql` — FOUND
- `tests/equipe/schema-desativacao.test.ts` — FOUND
- `.planning/phases/10-desativa-o-de-membro-da-equipe/10-01-SUMMARY.md` — FOUND
- Commit `36fe381` — FOUND in git log
- Commit `48b7c8d` — FOUND in git log

---
*Phase: 10-desativa-o-de-membro-da-equipe*
*Completed: 2026-07-28*
