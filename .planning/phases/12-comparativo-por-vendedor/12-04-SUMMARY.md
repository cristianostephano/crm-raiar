---
phase: 12-comparativo-por-vendedor
plan: 04
subsystem: ui
tags: [nextjs, react, dashboard, supabase-rls, server-actions]

# Dependency graph
requires:
  - phase: 12-comparativo-por-vendedor (plan 03)
    provides: "ComparativoVendedorTable.tsx component (Card + Table, own loading/error/empty states, no props)"
provides:
  - "ComparativoVendedorTable mounted in DashboardClient.tsx, Supervisor-only, positioned in the whole-history block"
  - "Phase 12 (VEND-01) fully wired end-to-end and human-verified in the live browser"
affects: [dashboard, future-dashboard-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Role-gated section mount via ternary in the client orchestrator (DashboardClient), never inside the leaf component — matches DesempenhoVendedorChart's established precedent"

key-files:
  created: []
  modified:
    - "components/dashboard/DashboardClient.tsx"

key-decisions:
  - "ComparativoVendedorTable mounted with zero props, inside {isSupervisor ? ... : null}, positioned strictly between TempoAteFechamentoCards and GanhosPerdidosCards to keep the whole-history group separate from the period-filtered group (D-02)"

patterns-established:
  - "Whole-history dashboard sections (ClientesPorEtapaChart, FunilDetalhadoTable, TempoAteFechamentoCards, ComparativoVendedorTable) stay grouped and adjacent, ahead of all period-filtered sections in the same flex stack"

requirements-completed: [VEND-01]

coverage:
  - id: D1
    description: "ComparativoVendedorTable imported and mounted in DashboardClient.tsx, gated on isSupervisor, receiving zero props"
    requirement: "VEND-01"
    verification:
      - kind: unit
        ref: "structural node check on DashboardClient.tsx (import presence, isSupervisor ternary, zero props, no duplicated/removed sections) — inline node -e check in Task 1's <verify> block"
        status: pass
    human_judgment: false
  - id: D2
    description: "Section positioned after TempoAteFechamentoCards and before GanhosPerdidosCards, keeping the whole-history group separate from the period-filtered group; DesempenhoVendedorChart left unchanged, still period-filtered"
    requirement: "VEND-01"
    verification:
      - kind: unit
        ref: "structural node check on DashboardClient.tsx (index comparison of <TempoAteFechamentoCards>, <ComparativoVendedorTable>, <GanhosPerdidosCards>; regex check that <DesempenhoVendedorChart> still receives inicio={periodo.inicio})"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full suite of phase-relevant automated tests green (comparativo-vendedor.test.ts, rls-dashboard.test.ts, comparativo-vendedor-table.test.tsx)"
    verification:
      - kind: unit
        ref: "npx vitest run tests/dashboard/comparativo-vendedor.test.ts tests/dashboard/rls-dashboard.test.ts tests/dashboard/comparativo-vendedor-table.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live browser walkthrough: Supervisor sees the table in the correct position with correct caption/columns/tooltip, numbers stay identical across a period-filter change, and the section is invisible to a Vendedor account"
    requirement: "VEND-01"
    verification:
      - kind: manual_procedural
        ref: "Human walkthrough performed by the project owner at http://localhost:3000 — logged in as Supervisor and as Vendedor, changed period filter, inspected tooltip aria-label"
        status: pass
    human_judgment: true
    rationale: "Visual placement, copy correctness, tooltip content, cross-role visibility and number plausibility against real team data require a human to judge — exactly the blocking checkpoint this plan's Task 2 defines. Approved by the project owner."

# Metrics
duration: 12min
completed: 2026-08-05
status: complete
---

# Phase 12 Plan 04: Wire ComparativoVendedorTable into DashboardClient Summary

**Mounted the Phase 12 "Comparativo por vendedor" table into the Dashboard's whole-history section group, gated on Supervisor role, and closed the entire v1.2 milestone with a human-verified live browser walkthrough.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-05T13:24:22Z
- **Completed:** 2026-08-05T13:35:17Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 1 (`components/dashboard/DashboardClient.tsx`)

## Accomplishments
- `ComparativoVendedorTable` is now live on the Dashboard for Supervisors, immediately after `<TempoAteFechamentoCards />` and before the Ganhos/Perdidos KPI row — grouped with the other whole-history sections, never intermixed with the period-filtered ones (D-02).
- The mount takes zero props and uses the exact same `isSupervisor ? <X /> : null` shape already established by `DesempenhoVendedorChart`'s gate — the role check stays a UX nicety in the client orchestrator, never the authorization boundary (RLS on the RPC remains the real guarantee, per T-12-13).
- `DesempenhoVendedorChart` was left completely untouched, confirmed still receiving `inicio`/`fim` from `periodo` and still Supervisor-only — the two sections now coexist by design (D-02).
- The project owner performed the full live-browser verification personally: correct position/caption, 5 columns in the documented order, tooltip content matching D-04 verbatim, numbers unchanged across a period-filter switch (30 dias → Este ano), and the section correctly absent for a Vendedor account. **Approved.**
- This closes VEND-01 and the entire v1.2 milestone (Phase 12 was its final phase).

## Task Commits

Each task was committed atomically:

1. **Task 1: Montar ComparativoVendedorTable em DashboardClient.tsx, condicionada ao papel Supervisor** - `07e2331` (feat)
2. **Deviation tracking (out-of-scope lint findings)** - `7b05534` (docs)

**Plan metadata:** commit pending (this SUMMARY.md + deferred-items.md are the plan's docs commits; STATE.md/ROADMAP.md updates are owned by the orchestrator, not this worktree agent)

_Note: Task 2 (checkpoint:human-verify) required no code commit — it was the human verification gate itself, approved by the project owner._

## Files Created/Modified
- `components/dashboard/DashboardClient.tsx` - Added `ComparativoVendedorTable` import (alphabetical position) and its Supervisor-gated, prop-less mount between `TempoAteFechamentoCards` and `GanhosPerdidosCards`; extended the top-of-component comment listing whole-history (non-period-filtered) sections.
- `.planning/phases/12-comparativo-por-vendedor/deferred-items.md` - New file logging pre-existing lint findings in unrelated files (out of this plan's scope, not fixed).

## Decisions Made
- None beyond what the plan specified — followed the exact placement, import ordering, and conditional-mount shape dictated by `12-UI-SPEC.md` and `12-PATTERNS.md`.

## Deviations from Plan

### Auto-fixed Issues

None — no code deviations. One documentation-only deviation:

**1. [Scope boundary] Logged pre-existing lint findings instead of fixing them**
- **Found during:** Task 1 verification (`npm run lint`)
- **Issue:** `npm run lint` surfaced 2 errors and 2 warnings in files never touched by this plan (`components/clientes/ClienteDetailSheet.tsx`, `components/clientes/EstadoCidadeFields.tsx`, `components/clientes/FiltersPopover.tsx`, `tests/importacao/annotarLinha.test.ts`), confirmed pre-existing via `git status --short` showing only `DashboardClient.tsx` as modified.
- **Fix:** Not fixed (out of scope per the executor's scope boundary rule). Logged to `.planning/phases/12-comparativo-por-vendedor/deferred-items.md` for a follow-up cleanup task.
- **Files modified:** `.planning/phases/12-comparativo-por-vendedor/deferred-items.md` (new file)
- **Verification:** Confirmed `DashboardClient.tsx`'s own lint output is clean; the flagged issues live entirely outside this plan's `files_modified` list.
- **Committed in:** `7b05534`

**2. [Environment setup] Copied `.env.local` into the worktree to run the test suite**
- **Found during:** Task 1 verification (`npx vitest run` on the three phase-relevant suites)
- **Issue:** The worktree at `.claude/worktrees/agent-aa7ebad58ac9f2577` did not have `.env.local` (gitignored, not copied when the worktree was created), so RLS-integration tests failed with "Missing required environment variable NEXT_PUBLIC_SUPABASE_URL".
- **Fix:** Copied `.env.local` from the main repo checkout into the worktree (gitignored file, never staged/committed — confirmed via `git check-ignore -v` and `git status --short` before and after).
- **Files modified:** none tracked by git (`.env.local` is gitignored)
- **Verification:** All 26 tests across the three suites passed after the copy.
- **Committed in:** n/a (gitignored, not a git change)

---

**Total deviations:** 2 (1 scope-boundary logging, 1 environment setup) — neither is a code change to the deliverable.
**Impact on plan:** No scope creep. The wiring itself matches the plan exactly.

## Issues Encountered
None beyond the two items above, both resolved without blocking progress.

## User Setup Required
None - no external service configuration required. (The `.env.local` copy noted above is a local dev/test-running convenience inside an isolated worktree, not a new external service dependency.)

## Next Phase Readiness
- VEND-01 and Phase 12 are fully complete and human-approved. This was the final phase of the v1.2 milestone.
- No blockers or concerns carried forward. The `deferred-items.md` lint findings are a minor, unrelated follow-up candidate for a future cleanup pass — not blocking.

---
*Phase: 12-comparativo-por-vendedor*
*Completed: 2026-08-05*
