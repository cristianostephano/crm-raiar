---
phase: 04-dashboard-gerencial
plan: 04
subsystem: ui
tags: [nextjs, dashboard, server-components, rls, dataviz]

# Dependency graph
requires:
  - phase: 04-dashboard-gerencial (plan 01)
    provides: "app/actions/dashboard.ts getGanhosPerdidosAction, lib/dashboard/periodo.ts (resolvePeriodo/taxaConversao)"
  - phase: 04-dashboard-gerencial (plan 02)
    provides: "components/ui/skeleton.tsx"
  - phase: 04-dashboard-gerencial (plan 03)
    provides: "components/dashboard/DashboardClient.tsx orchestrator holding preset/customRange période state, PeriodoFilter"
provides:
  - "components/dashboard/GanhosPerdidosCards.tsx — 3 period-reactive KPI stat tiles (Ganhos/Perdidos/Taxa de conversão)"
  - "components/dashboard/DashboardClient.tsx now computes resolvePeriodo(preset, customRange) and passes {inicio, fim} to period-filtered children"
affects: [04-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GanhosPerdidosCards' fetch-on-mount/prop-change effect reuses ClientesPorEtapaChart's established pattern exactly (synchronous setState in effect body + eslint-disable-next-line react-hooks/set-state-in-effect + cancelled guard + reloadKey retry counter), extended with {inicio, fim} in the effect's dependency array so a période change re-fetches"
    - "KPI tiles never hide behind a generic 'no data' banner — Ganhos/Perdidos render 0 and Taxa de conversão renders an em dash (taxaConversao's null guard) when ganho+perdido is 0, since a zero count is itself the informative answer for a period-scoped KPI"

key-files:
  created:
    - components/dashboard/GanhosPerdidosCards.tsx
  modified:
    - components/dashboard/DashboardClient.tsx

key-decisions:
  - "GanhosPerdidosCards always renders its 3 tiles once fetched (never swaps them for a full-row 'Nenhum dado no período selecionado.' banner) — the plan's acceptance criteria explicitly requires a reachable guarded-null branch making Taxa de conversão render an em dash, which only makes sense if the tile itself stays visible; showing Ganhos=0/Perdidos=0/Conversão=— is the more informative and internally-consistent reading of the UI-SPEC's generic empty-state copy for this specific KPI-tile case (as opposed to a bar chart, where zero rows would render nothing to look at)"
  - "DashboardClient now computes periodo via useMemo(() => resolvePeriodo(preset, customRange), [preset, customRange]) — the first real consumer of resolvePeriodo, exactly where 04-03's SUMMARY flagged it would be added"
  - "Fixed two leftover placeholder comments in DashboardClient.tsx (written during 04-03) that incorrectly said 'Desempenho por vendedor'/'Prospecção' land in plan 04-04 — corrected to 04-05, matching 04-05-PLAN.md's actual scope, to avoid misleading future context reads"

requirements-completed: [DSH-02, DSH-04]

coverage:
  - id: D1
    description: "GanhosPerdidosCards renders 3 big-number stat tiles (Ganhos green, Perdidos red, Taxa de conversão neutral), each with its own TrendingUp/TrendingDown/Percent icon, using the 36px/600 Stat waiver reserved exclusively for these 3 numbers"
    requirement: "DSH-02"
    verification:
      - kind: other
        ref: "grep -q 'text-\\[36px\\]' components/dashboard/GanhosPerdidosCards.tsx (pass, 3 occurrences); grep -q 'Ganhos' / 'Perdidos' / 'Taxa de conversão' (all pass); npx tsc --noEmit && npm run build (clean)"
        status: pass
    human_judgment: true
    rationale: "Visual stat-tile rendering (color, sizing, icon placement, 3-column grid vs stacked mobile) needs a human to confirm against the UI-SPEC's dataviz conventions; no Playwright visual test exists for this project's dashboard yet, matching 04-03's established precedent for pure UI-rendering plans."
  - id: D2
    description: "Taxa de conversão is computed via taxaConversao(ganho, perdido) from lib/dashboard/periodo.ts (not an inline division), formatted with exactly one pt-BR decimal, and renders an em dash instead of 0,0%/NaN when ganho+perdido is 0"
    requirement: "DSH-04"
    verification:
      - kind: unit
        ref: "tests/dashboard/periodo.test.ts (taxaConversao's null-on-zero-total behavior already unit-tested in 04-01; this plan is a pure consumer, adds no new pure logic requiring a new test, matching 04-03's own no-new-tests precedent for UI-orchestration plans)"
        status: pass
      - kind: other
        ref: "grep -q 'taxaConversao' components/dashboard/GanhosPerdidosCards.tsx && grep -q 'pt-BR' components/dashboard/GanhosPerdidosCards.tsx && grep -vq '/ (' components/dashboard/GanhosPerdidosCards.tsx (no inline division) — all pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "GanhosPerdidosCards fetches independently via getGanhosPerdidosAction(inicio, fim), reacting whenever the period filter changes, and owns its own loading (Skeleton)/error+retry states so a fetch failure never blanks the rest of the dashboard"
    requirement: "DSH-02"
    verification:
      - kind: other
        ref: "npx eslint components/dashboard/GanhosPerdidosCards.tsx (0 problems, confirms the set-state-in-effect pattern is correctly justified); npx tsc --noEmit && npm run build (clean, /dashboard still builds as a dynamic route)"
        status: pass
    human_judgment: true
    rationale: "Interactive period-filter-driven refetch and the loading/error/retry states need a human (or Playwright) click-through against a real logged-in session; RLS-scoped correctness of the underlying counts is already proven server-side by tests/dashboard/rls-dashboard.test.ts (04-01), so this deliverable is UI-wiring judgment, not a re-proof of the data boundary."
  - id: D4
    description: "DashboardClient renders GanhosPerdidosCards in block slot 2 (directly below ClientesPorEtapaChart), passing the resolved {inicio, fim} période; ClientesPorEtapaChart continues to receive no période prop (D-08 unaffected)"
    requirement: "DSH-02"
    verification:
      - kind: other
        ref: "grep -q 'GanhosPerdidosCards' components/dashboard/DashboardClient.tsx (pass); ClientesPorEtapaChart call site still has zero props (grep confirms '<ClientesPorEtapaChart />' with no attributes); npx tsc --noEmit && npm run build (clean)"
        status: pass
    human_judgment: false

# Metrics
duration: ~15min
completed: 2026-07-19
status: complete
---

# Phase 4 Plan 4: Ganhos/Perdidos/Taxa de Conversão KPI Row Summary

**Added the "ganhos x perdidos + taxa de conversão" KPI row to the dashboard: three 36px hero-number stat tiles (Success-green Ganhos, Destructive-red Perdidos, neutral Taxa de conversão) that react live to the period filter, reusing the already-unit-tested `taxaConversao` divide-by-zero-safe helper from 04-01.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-19T03:03:00Z (approx.)
- **Completed:** 2026-07-19T03:19:29Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `GanhosPerdidosCards` is a new period-reactive Client Component: 3 `Card`s in a `md`-gapped 3-column grid (desktop) / stacked (mobile), `lg` internal padding, each with a `TrendingUp`/`TrendingDown`/`Percent` icon and the phase's exclusive 36px/600 "Stat" hero-number waiver
- Ganhos renders in `green-600`/`green-500` (light/dark), Perdidos in `--destructive`, Taxa de conversão in plain `--foreground` — exactly the color roles UI-SPEC assigns, reusing Phase 2's status-badge green/red meaning
- Taxa de conversão is derived exclusively through `taxaConversao(ganho, perdido)` from `lib/dashboard/periodo.ts` (never an inline `ganho / (ganho + perdido)`), formatted with `Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })` and a literal `"%"` suffix; when `ganho + perdido` is 0, `taxaConversao` returns `null` and the tile renders an em dash (`—`) instead of `"0,0%"` or `NaN`
- Ganhos/Perdidos counts use plain `Intl.NumberFormat("pt-BR")` integers, no compact notation
- The component fetches independently via the 04-01 `getGanhosPerdidosAction(inicio, fim)` whenever `{inicio, fim}` changes, with its own `Skeleton`-tile loading state and an inline "Não foi possível carregar os dados do dashboard. Tente novamente." + "Tentar novamente" retry state — mirrors `ClientesPorEtapaChart`'s fetch-effect pattern exactly (synchronous `setState` in the effect body with a justifying `eslint-disable-next-line react-hooks/set-state-in-effect` comment, `cancelled` guard, `reloadKey` retry counter), extended so `[inicio, fim, reloadKey]` are all effect dependencies
- `DashboardClient` now computes `periodo` via `useMemo(() => resolvePeriodo(preset, customRange), [preset, customRange])` — the first real consumer of `resolvePeriodo`, exactly where 04-03's SUMMARY said it would land — and renders `GanhosPerdidosCards` in block slot 2, directly below the (still période-independent) `ClientesPorEtapaChart`
- No client-side role/responsavel filtering anywhere in the KPI data path — counts come straight from the RLS-scoped `dashboard_ganhos_perdidos()` SECURITY INVOKER function via `getGanhosPerdidosAction` (T-04-06 mitigation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Ganhos/Perdidos/Conversão KPI stat tiles (DSH-02, DSH-04)** - `dc545fa` (feat)
2. **Task 2: Wire the KPI row into DashboardClient** - `251e43d` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `components/dashboard/GanhosPerdidosCards.tsx` - new: 3 period-reactive KPI stat tiles, fetches via `getGanhosPerdidosAction`, formats with `taxaConversao` + `Intl.NumberFormat("pt-BR")`
- `components/dashboard/DashboardClient.tsx` - now resolves `periodo` and renders `GanhosPerdidosCards` below `ClientesPorEtapaChart`; also corrects two leftover 04-03 placeholder comments that mis-pointed "Desempenho por vendedor"/"Prospecção" at plan 04-04 instead of 04-05

## Decisions Made
- `GanhosPerdidosCards` always renders its 3 tiles once the fetch resolves — it does not swap them for a full-row "Nenhum dado no período selecionado." banner when `ganho + perdido` is 0. The plan's acceptance criteria explicitly require a reachable guarded-null branch that renders an em dash inside the Taxa de conversão tile, which only makes sense if that tile (and, for visual consistency, its siblings) stays visible. Showing `Ganhos: 0` / `Perdidos: 0` / `Taxa de conversão: —` is also the more informative reading for a period-scoped KPI — a real "zero wins this period" answer, not an absence of data to render.
- Fixed two placeholder comments in `DashboardClient.tsx` (written during 04-03) that said "Desempenho por vendedor" and "Prospecção por produto"/"Prospecção por categoria" would be "wired in plan 04-04" — both actually belong to `04-05-PLAN.md` per its own frontmatter (`files_modified: DesempenhoVendedorChart.tsx, ProspeccaoChart.tsx`). Left uncorrected, this stale pointer would have misled a future context read of this file.

## Deviations from Plan

None - plan executed exactly as written, aside from the pre-existing placeholder-comment correction documented above (Rule 1 — a real, if harmless, doc-comment inaccuracy inherited from 04-03, not new work this plan introduced).

## Issues Encountered
None. `npx tsc --noEmit`, `npx eslint`, and `npm run build` were all clean on the first attempt for both tasks.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The dashboard now shows a real, period-reactive win/loss/conversion KPI row for both roles, RLS-scoped with zero client-side filtering
- `DashboardClient`'s `periodo` value is now live and ready for 04-05's "Desempenho por vendedor" (Supervisor-only) and "Prospecção por produto"/"Prospecção por categoria" blocks to consume the same way
- No blockers carried forward

---
*Phase: 04-dashboard-gerencial*
*Completed: 2026-07-19*

## Self-Check: PASSED

Both files found on disk (`components/dashboard/GanhosPerdidosCards.tsx`, `components/dashboard/DashboardClient.tsx`), `.planning/phases/04-dashboard-gerencial/04-04-SUMMARY.md` found; both task commit hashes (`dc545fa`, `251e43d`) found in git history.
