---
phase: 10-desativa-o-de-membro-da-equipe
plan: 06
subsystem: ui
tags: [nextjs, react, server-component, supabase-auth, vitest]

# Dependency graph
requires:
  - phase: 10-desativa-o-de-membro-da-equipe (plan 05)
    provides: EquipeList (Status column + per-row Desativar/Reativar), DesativarMembroDialog (always-present replacement picker), EquipeMember type
provides:
  - "app/(app)/equipe/page.tsx wired to EquipeList: select() extended with `ativo`, currentUserId passed down, dead ROLE_LABELS/Badge removed"
  - "Live human verification that Supabase Auth ban_duration genuinely refuses login and reactivation genuinely restores it (the two 10-VALIDATION.md manual-only rows)"
  - "Full Per-Task Verification Map status recorded for Phase 10"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Component page passes the session user's id (already in scope from auth.getUser()) straight down as a prop for a client-side UX affordance (D-01 row hiding) — the real trust boundary stays server-side (RPC's own auth.uid() refusal), matching this project's established pattern of never letting client-only checks be the security control"

key-files:
  created:
    - .planning/phases/10-desativa-o-de-membro-da-equipe/10-06-SUMMARY.md
  modified:
    - "app/(app)/equipe/page.tsx"

key-decisions:
  - "Typed the `members` select() result inline as `EquipeMember[] | null` at the destructuring site (rather than a separate cast further down) so a future column rename on `profiles` fails `tsc` at the exact line that reads the columns, per the plan's own instruction"
  - "Copied .env.local from the main checkout into this git worktree before running any live-Supabase test — worktrees do not share gitignored files with the checkout they were created from, and without it every tests/equipe suite fails immediately with a missing-env-var error unrelated to this plan's code (same constraint 10-05-SUMMARY flagged and deferred; resolved here since this plan's whole point is live verification)"

requirements-completed: [EQP-01, EQP-02, EQP-03, EQP-04]

coverage:
  - id: D1
    description: "app/(app)/equipe/page.tsx renders EquipeList with the Status column and per-row actions reachable by a real Supervisor, select() extended with ativo, currentUserId passed down, dead ROLE_LABELS/Badge import removed, redirect guard and empty state untouched"
    requirement: "EQP-01"
    verification:
      - kind: other
        ref: "grep-based acceptance criteria on app/(app)/equipe/page.tsx (select ativo, currentUserId prop, no inline <table>, no ROLE_LABELS, empty state and redirect guard survived, no .tsx imports supabase/admin) — all pass"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit && npm run build — both exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "A real deactivated member (vendedor.b+test@raiar.local) is genuinely refused at the login screen, and a real reactivated member can log in again"
    requirement: "EQP-03"
    verification:
      - kind: manual_procedural
        ref: "10-06-PLAN.md Task 2 checkpoint:human-verify walkthrough, steps 1-9, personally performed end-to-end by the project owner against the live dev server — approved"
        status: pass
    human_judgment: true
    rationale: "Banning/unbanning a real auth.users row via the Supabase Auth Admin API is not safely repeatable/automatable against the live free-tier project (10-VALIDATION.md's two Manual-Only rows) — the login screen's actual accept/refuse behavior can only be judged by a human driving a real browser session."
  - id: D3
    description: "Reassignment (EQP-01) and closed-cliente preservation (EQP-04) re-confirmed automated, plus the verification account provably usable again (EQP-02/EQP-03)"
    requirement: "EQP-04"
    verification:
      - kind: integration
        ref: "npx vitest run tests/equipe/reassignment.test.ts (7/7, run as a whole file — see Issues Encountered for the -t isolation caveat)"
        status: pass
      - kind: integration
        ref: "npx vitest run tests/equipe (6 files, 43/43)"
        status: pass
      - kind: integration
        ref: "npx vitest run tests/auth/rls-roles.test.ts (5/5 — verification account signs in again)"
        status: pass
    human_judgment: false

# Metrics
duration: ~45 min wall time (includes the human live-verification pause and two rate-limit-driven test retries)
completed: 2026-08-03
status: complete
---

# Phase 10 Plan 6: Wire Deactivation UI + Live Auth-Ban Verification Summary

**Wired `EquipeList`/`DesativarMembroDialog` into the real "Gerenciar equipe" screen and closed out Phase 10 with a human-performed live verification that Supabase Auth's `ban_duration` genuinely blocks a deactivated member's login and that reactivation genuinely restores it.**

## Performance

- **Duration:** ~45 min wall time (Task 1 automated work ~10 min; Task 2 checkpoint paused for the owner's live browser walkthrough; Task 3 automated re-verification ~20 min, extended by two rounds of Supabase Auth rate-limit backoff on the full suite)
- **Started:** 2026-08-03T12:20:00-03:00 (approx)
- **Completed:** 2026-08-03T13:05:00-03:00 (approx, this SUMMARY's commit)
- **Tasks:** 3/3 (1 `auto`, 1 `checkpoint:human-verify`, 1 `auto`)
- **Files modified:** 1 (`app/(app)/equipe/page.tsx`)

## Accomplishments

- `app/(app)/equipe/page.tsx` now fetches `ativo` alongside the existing profile columns (typed `EquipeMember[] | null`), passes `currentUserId={user.id}` down, and renders `<EquipeList members={...} currentUserId={...} />` in place of the old inline `<table>` — the Status column and per-row Desativar/Reativar actions are reachable by a real Supervisor, not just present in the repo.
- Dead code removed from the page: the `ROLE_LABELS` constant and the `Badge` import, both superseded by `EquipeList` in plan 10-05.
- Supervisor-only redirect guard, `InviteUserForm` header, and the "Nenhum membro cadastrado ainda" empty state are byte-for-byte unchanged.
- A production build (`npm run build`) succeeds, proving no server-only module (in particular the `service_role` admin client) leaked into a Client Component.
- **Both of `10-VALIDATION.md`'s Manual-Only rows are now closed.** The project owner personally drove the full 9-step live walkthrough against the running dev server (not just reviewing a report): a deactivated `vendedor.b+test@raiar.local` was genuinely refused at the login screen with the exact "E-mail ou senha incorretos..." error, and after reactivation the same credentials logged in successfully. Full transcript is in the checkpoint exchange for this plan.
- Re-ran the automated suite after the walkthrough: the verification account is provably usable again (`tests/auth/rls-roles.test.ts` 5/5), and the phase's schema/reassignment/RLS suites are green (`tests/equipe` 6 files, 43/43).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire EquipeList into the Gerenciar equipe page** - `1836be3` (feat)
2. **Task 2: Live verification** - checkpoint task, no file changes; approval recorded in this SUMMARY (see below)
3. **Task 3: Prove the verification account was restored and the suite is green** - verification-only task, no file changes

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `app/(app)/equipe/page.tsx` - select() extended with `ativo`, typed `EquipeMember[] | null`; renders `<EquipeList>` in place of the old inline table; `ROLE_LABELS`/`Badge` import removed; redirect guard, header, and empty state untouched

## Decisions Made

- See `key-decisions` in frontmatter: inline result typing for `tsc`-enforced schema drift protection, and copying `.env.local` into this worktree so the live-Supabase test suites could actually run here (a git worktree does not inherit gitignored files from the checkout it was created from).
- Followed `10-PATTERNS.md`'s wiring instructions verbatim — no deviation in the page edit itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] This worktree had no `.env.local`, so every live-Supabase test failed immediately**
- **Found during:** Task 1, before running `npx vitest run tests/equipe`
- **Issue:** Git worktrees do not share gitignored files with the checkout they were created from (per `CLAUDE.md`, `.env.local` is gitignored). Without it, every test in `tests/equipe`/`tests/auth` throws `Missing required environment variable "NEXT_PUBLIC_SUPABASE_URL"` before any assertion runs — this is exactly the constraint flagged (and deferred) in `10-05-SUMMARY.md`'s "Issues Encountered" section.
- **Fix:** Copied `.env.local` from the main checkout (`C:\Users\Cristiano\workspace\crm-raiar\.env.local`) into this worktree's root. No content was invented or fabricated — this is the same file the main checkout already uses, just made available to this isolated worktree.
- **Files modified:** none tracked by git (the file is gitignored in both locations; no commit involved)
- **Verification:** `npx vitest run tests/equipe` went from "Missing required environment variable" failures to real assertions running (and passing) against the live Supabase project.
- **Committed in:** n/a (gitignored file, not committed)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking — local environment setup only, no application code changed).
**Impact on plan:** No scope creep; this was strictly required to let this plan's own verification tasks run in this isolated worktree at all.

## Issues Encountered

- **`tests/equipe/reassignment.test.ts -t "preserves closed"` fails when run in isolation (pre-existing test design, not introduced by this plan).** The plan's own acceptance criteria list this `-t` filter as a separate command. In practice, `"preserves closed (ganho/perdido)..."` reads module-level mutable state (`alvoId`, `createdClienteIds`) that is only populated by the sibling test `"reassigns em_andamento clientes..."` running first in the same file/process. Vitest's `-t` filter still marks the non-matching sibling as "skipped" rather than executing it, so its setup body never runs, and the isolated `-t "preserves closed"` invocation always fails with `expected null not to be null`. This test coupling was written in plan 10-02, not touched by this plan, and is out of this plan's scope to refactor (scope-boundary rule). **The behavior itself is fully proven**: running the whole file together (`npx vitest run tests/equipe/reassignment.test.ts`, no `-t` filter) passes 7/7, and it also passes as part of the full `npx vitest run tests/equipe` run (43/43). Confirmed `-t "reassigns em_andamento"` alone also passes cleanly (1 passed, 6 skipped) since that test has no such dependency.
- **`npm test` (the full project suite, ~50 files) repeatedly hit Supabase Auth's "Request rate limit reached" during this session** — a documented, pre-existing infra constraint of the shared free-tier Supabase project under this project's own `fileParallelism: false` serial-suite volume, explicitly called out in this plan's own prompt guidance ("you may still hit 'Request rate limit reached' purely from sign-in volume — prefer tests/equipe/ and this plan's own new tests, not the full suite"). Two full-suite retry attempts (with 60-90s backoff) both still hit widespread rate-limiting across unrelated test files (`tests/clientes/*`, `tests/dashboard/*`, `tests/importacao/*`, etc.) — this is unrelated to any file this plan touched. Per the plan's own guidance, verification instead relied on the specifically-pinned, scoped commands below, **all of which are green**:
  - `npx tsc --noEmit` — exits 0
  - `npm run build` — succeeds
  - `npx vitest run tests/equipe` — 6 files, 43/43 passed
  - `npx vitest run tests/auth/rls-roles.test.ts` — 5/5 passed (verification account signs in again)
  - `npx vitest run tests/equipe/reassignment.test.ts -t "reassigns em_andamento"` — passed (EQP-01)
  - `npx vitest run tests/equipe/reassignment.test.ts` (whole file, proving "preserves closed" too) — 7/7 passed (EQP-01, EQP-04)
  - `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "last supervisor"` — passed (EQP-02)
  - `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "self"` — passed (EQP-02)
  - `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "is_supervisor"` — passed (EQP-03)
  - `npx vitest run tests/equipe/schema-desativacao.test.ts` — 9/9 passed (all seeded accounts, including the verification account, are `ativo`)
  - Recommended follow-up (same as 10-05's note): re-run `npm test` from an environment/time window with more Supabase Auth rate-limit headroom before treating the *entire* project suite as re-confirmed; this plan's own scope (EQP-01 through EQP-04) is fully green via the commands above.

## User Setup Required

None - no external service configuration required by this plan. (`.env.local` was copied locally into this worktree for testing purposes only, not created or modified in content — see Deviations above.)

## Per-Task Verification Map (10-VALIDATION.md) — Final Status

| Task ID | Requirement | Automated Command | Status |
|---------|-------------|--------------------|--------|
| 10-01-xx | EQP-01 | `npx vitest run tests/equipe/reassignment.test.ts -t "reassigns em_andamento"` | ✅ green |
| 10-01-xx | EQP-04 | `npx vitest run tests/equipe/reassignment.test.ts -t "preserves closed"` (proven via whole-file run, see Issues Encountered) | ✅ green |
| 10-01-xx | EQP-02 | `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "last supervisor"` | ✅ green |
| 10-01-xx | EQP-02 | `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "self"` | ✅ green |
| 10-01-xx | EQP-03 | `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "is_supervisor"` | ✅ green |
| 10-0x-xx (manual) | EQP-03 (manual) | Manual: attempt login as a just-deactivated test account | ✅ **completed** — checkpoint approval is the evidence (Task 2, step 7 of the walkthrough: login refused with "E-mail ou senha incorretos...") |

### Manual-Only Verifications (10-VALIDATION.md) — both closed

| Behavior | Status | Evidence |
|----------|--------|----------|
| Real Auth Admin API `ban_duration` blocks a fresh login attempt | ✅ **completed** | Task 2 checkpoint approval, step 7: login as `vendedor.b+test@raiar.local` with the correct password was refused at the login screen |
| `ban_duration: "none"` correctly unbans on Reativar | ✅ **completed** | Task 2 checkpoint approval, step 9: same credentials, after Reativar, logged in successfully ("Bem-vindo(a), Vendedor") |

Both rows are also independently re-proven by automated tests from a different direction: `tests/equipe/auth-ban.test.ts` (`ban_duration '876000h' persists and 'none' clears it`) exercises the same Admin API round trip directly, and `tests/auth/rls-roles.test.ts` re-confirms the verification account can complete a fresh sign-in after the live walkthrough left it reactivated.

**RESEARCH.md Assumptions A1 and A2 are now resolved:**
- **A2** (`ban_duration` writes persist on this hosted project): resolved by `tests/equipe/auth-ban.test.ts` asserting `banned_until` is truthy immediately after setting `ban_duration: "876000h"`, plus the live walkthrough's step 7 (login genuinely refused).
- **A1** (`ban_duration: "none"` is the correct unban value): resolved by the same test asserting `banned_until` clears after `ban_duration: "none"`, plus the live walkthrough's step 9 (login genuinely succeeds again) and `tests/auth/rls-roles.test.ts` passing post-walkthrough.

`10-VALIDATION.md`'s frontmatter can now be moved to `nyquist_compliant: true` / `wave_0_complete: true` — this is the last plan in the phase.

## Next Phase Readiness

- Phase 10 (desativação de membro da equipe) is functionally and verifiably complete: EQP-01 through EQP-04 all have automated coverage, and both Auth-ban manual-only rows have a recorded human approval plus independent automated re-confirmation.
- No architectural blockers for any following phase.
- Recommended follow-up (not blocking this plan): re-run the full `npm test` project suite from a session/time window with more Supabase Auth rate-limit headroom (e.g., staggered, or with `--reporter=dot` and increased spacing between file-level Auth calls) before relying on a fully green whole-project run — this is a pre-existing project-wide test-infra characteristic, not specific to Phase 10.

## Self-Check: PASSED

- `app/(app)/equipe/page.tsx` — FOUND, contains `EquipeList`, `currentUserId={user.id}`, `ativo` in select, no `<table`, no `ROLE_LABELS`
- Commit `1836be3` — FOUND in git log
- `npx tsc --noEmit` — exits 0 (re-confirmed)
- `npx vitest run tests/equipe` — 43/43 passed (re-confirmed)

---
*Phase: 10-desativa-o-de-membro-da-equipe*
*Completed: 2026-08-03*
