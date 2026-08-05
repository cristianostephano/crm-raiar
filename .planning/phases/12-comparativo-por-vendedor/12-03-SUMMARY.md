---
phase: 12-comparativo-por-vendedor
plan: 03
subsystem: ui
tags: [react, nextjs, dashboard, table, shadcn]

# Dependency graph
requires:
  - phase: 12-comparativo-por-vendedor (plan 02)
    provides: "getComparativoVendedorAction() no-argument Server Action + ComparativoVendedorRow type in lib/supabase/queries/dashboard.ts"
provides:
  - "ComparativoVendedorTable component (components/dashboard/ComparativoVendedorTable.tsx) — 5-column Card table, own loading/error/empty states, no props"
affects: [12-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "formatConversao(rate) multiplies the raw 0-1 ratio by 100 before formatting — named to match GanhosPerdidosCards.formatConversao, deliberately NOT formatPct (FunilDetalhadoTable's formatter, which has no multiplication and would be wrong here)"
    - "Row list rendered exactly as received from the RPC — no .sort()/.filter() in the component; order and active-vendedor scoping are SQL-owned"

key-files:
  created:
    - components/dashboard/ComparativoVendedorTable.tsx
    - tests/dashboard/comparativo-vendedor-table.test.tsx
  modified: []

key-decisions:
  - "formatConversao named explicitly (not formatPct) to keep the *100 distinction visible in the code, per the plan's explicit instruction to avoid the bug present in 12-PATTERNS.md's drafted excerpt"
  - "Negócios iniciados/Negócios ganhos always render a plain integer via integerFormatter, never em dash — only Taxa de conversão and Ciclo médio (dias) use the null-guard em-dash convention"

patterns-established: []

requirements-completed: [VEND-01]

coverage:
  - id: D1
    description: "ComparativoVendedorTable renders a 5-column table (Vendedor, Taxa de conversão, Negócios iniciados, Negócios ganhos, Ciclo médio (dias)) inside a Card, one row per active vendedor in the order the RPC returns them, with taxaConversao correctly converted to a percentage (rate * 100) and formatDias/formatConversao returning em dash only when null"
    requirement: "VEND-01"
    verification:
      - kind: unit
        ref: "node structural check (inline script from 12-03-PLAN.md) — symbols/classes present, Copywriting Contract strings verbatim, *100 multiplication present, no Badge/TriangleAlert/border-l-4/isSupervisor/ETAPAS, no .sort()/.filter() over rows"
        status: pass
      - kind: automated_ui
        ref: "tests/dashboard/comparativo-vendedor-table.test.tsx (7/7 passed) — row order preserved, 0.625 -> 62,5%, zero-real vs indefinido on the same row, 12,5 dias format, tooltip accessible label, empty state, error state"
        status: pass
    human_judgment: false
  - id: D2
    description: "npx tsc --noEmit and npm run lint are clean for the new component and test file"
    requirement: "VEND-01"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (no output = clean); npm run lint (no new errors/warnings — 2 pre-existing errors and 2 pre-existing warnings in unrelated files, unchanged by this plan)"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-08-05
status: complete
---

# Phase 12 Plan 3: Comparativo por Vendedor (UI component) Summary

**`ComparativoVendedorTable.tsx` — a 5-column Card table (Vendedor, Taxa de conversão, Negócios iniciados, Negócios ganhos, Ciclo médio (dias)) with its own loading/error/empty states, correctly converting `taxaConversao()`'s 0-1 ratio to a percentage via `formatConversao` (rate * 100).**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-05
- **Tasks:** 2/2
- **Files modified:** 2 (both new)

## Accomplishments

- `ComparativoVendedorTable` Client Component created, structurally mirroring `FunilDetalhadoTable.tsx`: `FetchState` union (`loading`/`error`/`ready`), fetch effect with `cancelled` guard and `reloadKey` retry counter, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` shell, and the `h-[320px]` loading/error/empty branch heights
- `formatConversao(rate)` implemented as the twin of `GanhosPerdidosCards.formatConversao` — multiplies the raw ratio by 100 before formatting (`0.625` -> `"62,5%"`), deliberately named to distinguish it from `FunilDetalhadoTable`'s unrelated `formatPct`, which has no multiplication and would have produced `"0,6%"` if copied verbatim from `12-PATTERNS.md`'s drafted excerpt
- `formatDias(value)` reused verbatim from `FunilDetalhadoTable` (no multiplication — value already arrives in days)
- Five columns in the exact locked order and copy: Vendedor, Taxa de conversão, Negócios iniciados, Negócios ganhos, Ciclo médio (dias) — the fifth header carries a `CircleHelp` tooltip with the exact D-04 disambiguation string in both the accessible label and visual content
- `Negócios iniciados`/`Negócios ganhos` always render via `integerFormatter`, never em dash — a real 0 is informative; `Taxa de conversão`/`Ciclo médio (dias)` return em dash only when their value is `null`
- No role check, no `.sort()`/`.filter()` over `state.rows`, no bottleneck/warning styling (`Badge`/`TriangleAlert`/`border-l-4`) — rows render exactly as the RPC returns them, keyed by `row.responsavel`
- Render test suite (`tests/dashboard/comparativo-vendedor-table.test.tsx`, 7 cases) mocking `getComparativoVendedorAction`, covering: row order preservation, the `0.625 -> "62,5%"` conversion (with an explicit negative assertion against the buggy `"0,6%"`), zero-real vs. indefinido on the same row without hiding it, `12,5 dias` formatting, the tooltip's exact accessible label, the empty state, and the error state with retry button

## Task Commits

1. **Task 1: Criar components/dashboard/ComparativoVendedorTable.tsx** - `3649e8b` (feat)
2. **Task 2: Criar o teste de render tests/dashboard/comparativo-vendedor-table.test.tsx** - `18d74c7` (test)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `components/dashboard/ComparativoVendedorTable.tsx` - new Client Component, 5-column comparison table with own loading/error/empty states
- `tests/dashboard/comparativo-vendedor-table.test.tsx` - new render test suite (7 cases), mocking the Server Action

## Decisions Made
- Named the percentage formatter `formatConversao` (not `formatPct`) specifically to keep the `* 100` conversion visible and distinct from `FunilDetalhadoTable`'s unrelated, non-multiplying `formatPct` — this was an explicit instruction in the plan text, not a new decision made during execution.
- No other decisions beyond what was already locked in `12-CONTEXT.md`/`12-UI-SPEC.md`/`12-PATTERNS.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored `.env.local` in this worktree**
- **Found during:** running `npm test` (the plan's final full-suite verification step)
- **Issue:** Git worktrees don't share gitignored files with the main checkout, so every integration test requiring `NEXT_PUBLIC_SUPABASE_URL`/related env vars failed with "Missing required environment variable" — a pre-existing, documented infra gap (same one noted in `12-02-SUMMARY.md`), not caused by this plan's own files.
- **Fix:** Read the main checkout's `.env.local` via the Read tool and wrote an identical copy into this worktree at the worktree root.
- **Files modified:** `.env.local` (gitignored, never staged — confirmed via `git check-ignore`)
- **Verification:** `git check-ignore .env.local` passes; the file never appears in `git status --short`.
- **Committed in:** n/a (gitignored, not committed)

**2. [Rule 1 - JSDoc self-check false positive] Reworded a component JSDoc comment**
- **Found during:** Task 1's own structural verification check
- **Issue:** The initial JSDoc comment used the literal word "isSupervisor" while explaining that `DashboardClient` owns the role gate — the plan's own structural check forbids the literal string `isSupervisor` anywhere in the file (to guarantee no role-check logic sneaks in), and the comment prose tripped that same check even though it wasn't a code reference.
- **Fix:** Reworded the comment to say "gated on the caller's role" / "the role gate in DashboardClient" instead of naming the variable literally.
- **Files modified:** `components/dashboard/ComparativoVendedorTable.tsx`
- **Verification:** Re-ran the structural check inline script — passed clean (`OK componente`).
- **Committed in:** `3649e8b` (Task 1 commit — fixed before the commit was made, not a separate commit)

---

**Total deviations:** 2 auto-fixed (1 blocking infra restore, 1 blocking self-check wording fix)
**Impact on plan:** Both fixes were necessary to complete the plan's own verification steps as written; neither changed the component's behavior or scope.

## Issues Encountered

1. **`npm test` (full suite) shows widespread `Request rate limit reached` failures** — after restoring `.env.local`, most of the previously-erroring integration/RLS test files (unrelated to this plan: `tests/equipe/*`, `tests/importacao/*`, `tests/auth/*`, etc.) still fail, now with `signInAs(...) failed: Request rate limit reached` instead of a missing-env-var error. This is Supabase Auth's own rate limit on the live project being hit by repeatedly signing in across many test files in one session — a known, separate infra constraint (explicitly flagged as out-of-scope in this plan's own instructions: "if your render test somehow needs live sign-in and hits rate-limit errors, this is a known, separate infra constraint — flag it, don't try to fix it"). This plan's own test file (`tests/dashboard/comparativo-vendedor-table.test.tsx`) does not sign in anywhere — it mocks the Server Action entirely — and passes cleanly in isolation (7/7). Confirmed via `git status --short` that no test file besides the new one was touched by this plan.
2. **Pre-existing lint errors/warnings in unrelated files** (`components/clientes/EstadoCidadeFields.tsx`, `components/clientes/FiltersPopover.tsx` — `react-hooks/set-state-in-effect`; `components/clientes/ClienteDetailSheet.tsx` — a compiler warning; `tests/importacao/annotarLinha.test.ts` — unused var warning), same as documented in `12-02-SUMMARY.md`. Confirmed unrelated to this plan's own files, not fixed (out of scope per the executor's scope-boundary rule).

## User Setup Required

None - no external service configuration required beyond copying the already-approved `.env.local` into this worktree (a local dev secrets file, not a new service — same as `12-02-SUMMARY.md`'s precedent).

## Next Phase Readiness

- `ComparativoVendedorTable` is ready to be mounted by `DashboardClient.tsx` in plan 04, gated by `{isSupervisor ? <ComparativoVendedorTable /> : null}`, immediately after `TempoAteFechamentoCards` and before `GanhosPerdidosCards`, per `12-UI-SPEC.md`'s Placement section. The component takes no props.
- No blockers for plan 04. `npx tsc --noEmit` clean, `npm run lint` shows only the pre-existing unrelated warnings/errors noted above, and `npx vitest run tests/dashboard/comparativo-vendedor-table.test.tsx` is fully green (7/7).
- The full-suite rate-limit issue (Issue 1 above) is worth flagging to whoever runs `npm test` for the phase-04 verification pass — it may need spacing out test runs or a dedicated CI env with a higher Supabase Auth rate limit, not a code fix in this repo.

---
*Phase: 12-comparativo-por-vendedor*
*Completed: 2026-08-05*

## Self-Check: PASSED

- FOUND: `components/dashboard/ComparativoVendedorTable.tsx`
- FOUND: `tests/dashboard/comparativo-vendedor-table.test.tsx`
- FOUND: `.planning/phases/12-comparativo-por-vendedor/12-03-SUMMARY.md`
- FOUND: commit `3649e8b` in git log
- FOUND: commit `18d74c7` in git log
