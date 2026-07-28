---
phase: 11-funil-de-convers-o-detalhado
plan: 04
subsystem: ui
tags: [nextjs, react, dashboard, vitest]

requires:
  - phase: 11-funil-de-convers-o-detalhado
    provides: getTempoAteFechamentoAction() Server Action (plan 02) and TempoAteFechamentoRow type
provides:
  - components/dashboard/TempoAteFechamentoCards.tsx (FNL-02 KPI pair, no props)
affects: [11-05-dashboard-client-wiring]

tech-stack:
  added: []
  patterns:
    - "Structural transplant of GanhosPerdidosCards' FetchState/reloadKey/skeleton/error scaffold, reduced to 2 tiles and a no-arg fetch effect (dependency array is [reloadKey] only, mirroring ClientesPorEtapaChart's no-period pattern)"
    - "Absence of a status row from the RPC (.find() returns undefined) maps to null, rendered as em dash — never coerced to 0"

key-files:
  created:
    - components/dashboard/TempoAteFechamentoCards.tsx
    - tests/dashboard/tempo-ate-fechamento-cards.test.tsx
  modified: []

key-decisions:
  - "11-PATTERNS.md referenced by the plan's read_first was not present in this worktree checkout; proceeded using GanhosPerdidosCards.tsx and ClientesPorEtapaChart.tsx directly (both explicitly named as the structural/dependency-array references) plus the approved 11-UI-SPEC.md, which fully specify the required markup, classes, and copy"

requirements-completed: [FNL-02]

coverage:
  - id: T1
    description: "TempoAteFechamentoCards renders both averages as independent values, pt-BR 1-decimal format, no props, no role read, fetch depends only on reloadKey"
    requirement: "FNL-02"
    verification:
      - kind: other
        ref: "node structural check (task 1 verify script): all required labels/classes present, exactly 2 skeletons, no md:grid-cols-3, no isSupervisor, no props on function signature"
        status: pass
      - kind: unit
        ref: "npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: T2
    description: "Render test locks the two labels, pt-BR decimal format, em-dash fallback (partial and full absence), error state, and green/destructive border-to-label mapping"
    requirement: "FNL-02"
    verification:
      - kind: unit
        ref: "npx vitest run tests/dashboard/tempo-ate-fechamento-cards.test.tsx (5/5 passed)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-07-28
status: complete
---

# Phase 11 Plan 4: Tempo Até Fechamento Cards Summary

**`TempoAteFechamentoCards` — two independent stat tiles (avg days to "ganho", avg days to "perdido") built as a structural transplant of `GanhosPerdidosCards`, fetching via `getTempoAteFechamentoAction()` with a no-argument dependency array.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-28T13:10Z
- **Completed:** 2026-07-28T13:25Z
- **Tasks:** 2/2
- **Files modified:** 2 (both new)

## Accomplishments
- `components/dashboard/TempoAteFechamentoCards.tsx` created: Client Component, no props, no role read, fetches via `getTempoAteFechamentoAction()` only, `useEffect` dependency array is `[reloadKey]` alone (documented inline as intentional — this RPC takes no period argument)
- Two tiles: "Média de dias até ganho" (`border-l-green-600`, `TrendingUp`) and "Média de dias até perdido" (`border-l-destructive`, `TrendingDown`), both at `text-[36px] leading-[1.1] font-semibold`
- `formatMediaDias()` helper: null → em dash (U+2014), otherwise `Intl.NumberFormat("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1})` + " dias" — absence of a status row from the RPC is never coerced to `0`
- Loading state: 2× `Skeleton h-[140px] w-full` in a `grid grid-cols-1 gap-4 md:grid-cols-2`; error state: single `Card` with the standard dashboard retry copy/button, independent `reloadKey`
- `tests/dashboard/tempo-ate-fechamento-cards.test.tsx` created: 5 render tests covering separated averages, partial em-dash, full em-dash, error state, and border/label color mapping — all passing

## Task Commits

1. **Task 1: Criar components/dashboard/TempoAteFechamentoCards.tsx** - `757d267` (feat)
2. **Task 2: Criar o teste de render tests/dashboard/tempo-ate-fechamento-cards.test.tsx** - `2aaf63c` (test)

## Files Created/Modified
- `components/dashboard/TempoAteFechamentoCards.tsx` - new Client Component, FNL-02 KPI pair
- `tests/dashboard/tempo-ate-fechamento-cards.test.tsx` - new render test (jsdom), 5 cases

## Decisions Made
- `11-PATTERNS.md` was referenced by the plan's `read_first` list but was not present in this worktree's checkout of `.planning/phases/11-funil-de-convers-o-detalhado/` (only `11-01`/`11-02` PLAN+SUMMARY, `11-03`/`11-04`/`11-05` PLAN, `11-CONTEXT`, `11-DISCUSSION-LOG`, `11-RESEARCH`, `11-UI-SPEC`, `11-VALIDATION` exist here). Proceeded directly from `components/dashboard/GanhosPerdidosCards.tsx` (explicitly named as the near-exact structural transplant source) and `components/dashboard/ClientesPorEtapaChart.tsx` (explicitly named as the no-period dependency-array reference), cross-checked against the approved `11-UI-SPEC.md`'s Copywriting Contract and §2 Implementation Notes, which together fully specify every class, label, and format string the plan's acceptance criteria require. No ambiguity resulted — both the structural verify script and the render tests pass against this reconstruction, so plan intent (a verbatim transplant with a reduced tile count and a no-arg fetch) was met without needing the missing pattern file's worked example.

## Deviations from Plan

None - plan executed exactly as written (aside from the missing-file substitution above, which produced identical output to what the plan specified).

## Issues Encountered

- `npm run lint` reports 2 pre-existing errors (`EstadoCidadeFields.tsx`, `FiltersPopover.tsx` — both `react-hooks/set-state-in-effect`) and 2 pre-existing warnings (`ClienteDetailSheet.tsx`, `tests/importacao/annotarLinha.test.ts`), all in files untouched by this plan. Confirmed out of scope per the executor's scope-boundary rule; not fixed. `components/dashboard/TempoAteFechamentoCards.tsx` and `tests/dashboard/tempo-ate-fechamento-cards.test.tsx` produce zero lint output of their own.

## User Setup Required

None - component-level render tests only, no live Supabase sign-in required for this plan's own verification, matching the important_note's expectation.

## Next Phase Readiness

- `TempoAteFechamentoCards` is ready to be imported and placed into `DashboardClient.tsx` by plan 05, immediately after `FunilDetalhadoTable` per the UI-SPEC's placement note (§3).
- No new shared symbols beyond the component export itself; `TempoAteFechamentoRow` was already exported by plan 02.

---
*Phase: 11-funil-de-convers-o-detalhado*
*Completed: 2026-07-28*

## Self-Check: PASSED
