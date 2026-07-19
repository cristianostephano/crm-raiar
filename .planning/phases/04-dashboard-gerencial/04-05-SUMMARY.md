---
phase: 04-dashboard-gerencial
plan: 05
subsystem: ui
tags: [nextjs, recharts, dashboard, rls, dataviz]

# Dependency graph
requires:
  - phase: 04-dashboard-gerencial (plan 01)
    provides: "app/actions/dashboard.ts getDesempenhoVendedorAction/getProspeccaoPorProdutoAction/getProspeccaoPorCategoriaAction, RLS-scoped dashboard_* RPCs"
  - phase: 04-dashboard-gerencial (plan 04)
    provides: "DashboardClient's resolved périodo state (useMemo(resolvePeriodo)), the fetch-effect/loading/empty/error card pattern"
provides:
  - "components/dashboard/DesempenhoVendedorChart.tsx — Supervisor-only horizontal-bar chart, ganhos por vendedor sorted descending"
  - "components/dashboard/ProspeccaoChart.tsx — reusable horizontal-bar chart, instantiated for produto and categoria"
  - "DashboardClient.tsx now renders all four dashboard block groups (etapa snapshot, KPI row, desempenho, prospecção)"
  - "Complete, human-verified Dashboard Gerencial screen for both Supervisor and Vendedor roles"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ProspeccaoChart is a single component parameterized by title/caption/período/Server Action, instantiated twice (produto, categoria) instead of two near-identical files"
    - "Variable-row-count horizontal-bar sizing: content height grows uncapped (min 280px, +40px/row) inside a wrapper capped at max-height 480px with overflow-y-auto, so a long vendedor/produto/categoria list scrolls internally instead of pushing the rest of the dashboard off-screen"
    - "DesempenhoVendedorChart/ProspeccaoChart perform no role check of their own — Supervisor-only visibility is a single isSupervisor conditional in DashboardClient, mirroring layout.tsx's nav-link pattern; the real authorization boundary stays server-side RLS on the underlying RPCs"

key-files:
  created:
    - components/dashboard/DesempenhoVendedorChart.tsx
    - components/dashboard/ProspeccaoChart.tsx
  modified:
    - components/dashboard/DashboardClient.tsx
    - components/dashboard/PeriodoFilter.tsx
    - components/dashboard/ClientesPorEtapaChart.tsx

key-decisions:
  - "DesempenhoVendedorChart and ProspeccaoChart are separate components (not one component powering both), since their data shapes differ (ganho count vs. produto/categoria total) — the plan only required ProspeccaoChart itself to be reusable across produto/categoria, which it is"
  - "Chart sizing implemented as an uncapped-height ChartContainer inside a max-height:480px overflow-y-auto wrapper, rather than capping ChartContainer's own height — this is what makes the 'internal vertical scroll past 480px' requirement actually scroll the chart content instead of just squeezing Recharts' auto-fit layout"
  - "Two real bugs found and fixed during the human checkpoint verification (not part of this plan's own new code, but surfaced by exercising it): PeriodoFilter's Select was missing the base-ui `items` prop (same root cause as a Phase 2 ClienteDetailSheet bug), so it displayed the raw preset enum value instead of the pt-BR label after selection; ClientesPorEtapaChart's X axis was silently dropping 2 of 7 etapa labels to Recharts' automatic collision handling, fixed with `interval={0}` + angled labels + more axis height"

requirements-completed: [DSH-03, DSH-05, DSH-07]

coverage:
  - id: D1
    description: "DesempenhoVendedorChart renders a horizontal-bar chart (layout=\"vertical\"), one bar per vendedor plotting their ganho count for the selected period, sorted descending so the top performer reads first; rendered only for the Supervisor (isSupervisor conditional in DashboardClient), entirely absent — not blank/disabled — for a Vendedor"
    requirement: "DSH-03"
    verification:
      - kind: other
        ref: "grep -q 'layout=\"vertical\"' components/dashboard/DesempenhoVendedorChart.tsx (pass); grep -q 'isSupervisor' + 'DesempenhoVendedorChart' co-located in DashboardClient.tsx (pass); npx tsc --noEmit && npm run build (clean)"
        status: pass
      - kind: manual_procedural
        ref: "Human checkpoint (coordinator, browser): logged in as vendedor.a+test@raiar.local — 'Desempenho por vendedor' block absent from the DOM entirely, subtitle correctly reads 'Seus números de vendas'"
        status: pass
    human_judgment: true
    rationale: "The Supervisor-only visual gating and the sort-descending bar order need a human to confirm against a real logged-in session for both roles; the underlying RLS scoping is already proven server-side by tests/dashboard/rls-dashboard.test.ts (04-01), so this deliverable is UI-wiring/visual judgment, not a re-proof of the data boundary."
  - id: D2
    description: "ProspeccaoChart is a single reusable horizontal-bar component (title/caption/período/action props) instantiated twice in DashboardClient — 'Prospecção por produto' and 'Prospecção por categoria' — both counting clientes cadastrados by criado_em within the selected period, shown to both roles in a 2-column grid (stacked on mobile)"
    requirement: "DSH-05"
    verification:
      - kind: other
        ref: "grep -q 'layout=\"vertical\"' components/dashboard/ProspeccaoChart.tsx (pass); grep -q 'ProspeccaoChart' components/dashboard/DashboardClient.tsx (2 instantiations, produto+categoria titles/actions); npx tsc --noEmit && npm run build (clean)"
        status: pass
      - kind: manual_procedural
        ref: "Human checkpoint (coordinator, browser): both charts render for Supervisor and Vendedor, react to the período filter (30 dias -> Este ano), numbers change per the server refetch logs"
        status: pass
    human_judgment: true
    rationale: "Visual chart rendering and the actual période-driven refetch behavior need a human click-through against a real session; the underlying dashboard_prospeccao_por_produto/_categoria RPCs are already unit/integration-tested in 04-01."
  - id: D3
    description: "A human verified the complete dashboard end-to-end as both roles: all four block groups render for the Supervisor, the desempenho block is absent for the Vendedor, the period filter drives every filtered block while the etapa snapshot stays put (D-08), and pt-BR number formatting (dot thousands, comma decimals, em dash for taxa de conversão with no data) is correct"
    requirement: "DSH-07"
    verification:
      - kind: manual_procedural
        ref: "Human checkpoint (coordinator, browser) — full 5-point verification: (1) /clientes still the landing screen and kanban intact; (2) all Supervisor blocks render including the D-08 'not period-filtered' etapa caption; (3) période change (30 dias -> Este ano) correctly refetches KPI/desempenho/prospecção while etapa chart stays static; (4) Vendedor login shows 'Desempenho por vendedor' fully absent from the DOM, subtitle 'Seus números de vendas', numbers scoped to own clientes; (5) pt-BR formatting confirmed, em dash on zero-data taxa de conversão"
        status: pass
    human_judgment: true
    rationale: "Full-screen, cross-role, visual/functional sign-off is inherently a human judgment call — this is the plan's dedicated checkpoint:human-verify gate, and was performed directly by the project coordinator in the browser rather than delegated."

# Metrics
duration: ~30min
completed: 2026-07-19
status: complete
---

# Phase 4 Plan 5: Desempenho por Vendedor + Prospecção Summary

**Completed the Dashboard Gerencial with a Supervisor-only "Desempenho por vendedor" horizontal-bar chart and a reusable "Prospecção por produto"/"Prospecção por categoria" chart component, both period-reactive and RLS-scoped — closing out all 7 dashboard requirements and the full 32-requirement v1 milestone after a human-verified sign-off on both roles.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-19T03:25:25Z (approx., immediately after 04-04)
- **Completed:** 2026-07-19T03:52:03Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 5 (2 created, 3 modified — including 2 files fixed during checkpoint verification)

## Accomplishments
- `DesempenhoVendedorChart` — a Client Component horizontal-bar chart (`layout="vertical"` per RESEARCH.md Pattern 4), one bar per vendedor plotting their ganho count for the selected period (D-10), sorted descending client-side so the top performer always reads first; assumes it is only ever mounted for a Supervisor and performs no role check of its own — `getDesempenhoVendedor` is independently RLS-scoped server-side (T-04-07/T-04-08)
- `ProspeccaoChart` — a single reusable horizontal-bar component taking `title`/`caption`/`inicio`/`fim`/`action` props, instantiated twice in `DashboardClient` for "Prospecção por produto" (`getProspeccaoPorProdutoAction`) and "Prospecção por categoria" (`getProspeccaoPorCategoriaAction`), avoiding two near-identical files
- Both new charts implement the UI-SPEC's variable-row-count sizing rule: an uncapped-height `ChartContainer` (min 280px, +40px per row) sits inside a `max-height: 480px` `overflow-y-auto` wrapper, so long vendedor/produto/categoria lists scroll internally instead of growing the page unbounded
- Both own independent loading (`Skeleton`)/empty ("Nenhum dado no período selecionado.")/error+retry states, mirroring `ClientesPorEtapaChart`/`GanhosPerdidosCards`' established fetch-effect pattern — a failure in one chart never blanks the rest of the dashboard
- `DashboardClient` now renders the full 4-block dashboard: etapa snapshot (D-08, unaffected by période), KPI row, `DesempenhoVendedorChart` gated behind a single `isSupervisor` conditional (D-07, mirroring `app/(app)/layout.tsx`'s existing nav-link pattern), and a 2-column (stacked on mobile) grid of the two `ProspeccaoChart` instances
- A human (the project coordinator) performed the plan's `checkpoint:human-verify` gate directly in the browser against the dev server, covering all 5 required verification points for both Supervisor and Vendedor, and approved the phase for closure
- During that verification, 2 real pre-existing bugs were found and fixed (commit `0da3d13`, already on the branch before this SUMMARY was written): `PeriodoFilter`'s `Select` was missing the base-ui `items` prop (displaying the raw preset enum value instead of its pt-BR label after selection — same root cause as a Phase 2 `ClienteDetailSheet` bug); `ClientesPorEtapaChart`'s X axis was silently dropping 2 of 7 etapa labels to Recharts' automatic collision handling, fixed with `interval={0}` + angled labels + additional axis height

## Task Commits

Each task was committed atomically:

1. **Task 1: Desempenho por vendedor + reusable Prospecção horizontal-bar charts (DSH-03, DSH-05)** - `5e67cfe` (feat)
2. **Task 2: Wire desempenho (Supervisor-only) + prospecção grid into DashboardClient** - `72ef044` (feat)
3. **Task 3 [BLOCKING]: Human verification of the full dashboard (both roles)** - approved by the coordinator directly in the browser; 2 bugs found and fixed in `0da3d13` (fix) during verification

**Plan metadata:** (this commit)

## Files Created/Modified
- `components/dashboard/DesempenhoVendedorChart.tsx` - new: Supervisor-only horizontal-bar chart, ganhos por vendedor sorted descending
- `components/dashboard/ProspeccaoChart.tsx` - new: reusable horizontal-bar chart, instantiated for produto and categoria
- `components/dashboard/DashboardClient.tsx` - now renders all 4 dashboard block groups; desempenho gated by `isSupervisor`
- `components/dashboard/PeriodoFilter.tsx` - fixed during checkpoint verification: `Select` now receives `items={PRESET_OPTIONS}` so it renders the pt-BR label, not the raw enum value
- `components/dashboard/ClientesPorEtapaChart.tsx` - fixed during checkpoint verification: X axis now forces all 7 etapa labels visible (`interval={0}`, angled, taller axis) instead of silently dropping colliding ones

## Decisions Made
- `DesempenhoVendedorChart` and `ProspeccaoChart` stayed as two separate components rather than one shared implementation — their data shapes differ (a single `ganho` count per vendedor vs. a `total` count per produto/categoria) and the plan's reuse requirement was scoped explicitly to `ProspeccaoChart` serving both produto and categoria, which it does via its `action` prop
- Chart sizing is implemented as an uncapped-height `ChartContainer` wrapped in a `max-height: 480px` `overflow-y-auto` div, rather than capping `ChartContainer` itself — this is what makes rows past the cap actually scroll instead of Recharts silently auto-fitting (and cramming) all bars into a fixed height
- The two bugs found during the human checkpoint (`PeriodoFilter` label display, `ClientesPorEtapaChart` axis label collision) were fixed directly by the coordinator (commit `0da3d13`) rather than deferred — both are Rule 1 (bug) fixes to files this plan's checkpoint exercised, not new plan scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PeriodoFilter Select displayed the raw preset enum value instead of its pt-BR label**
- **Found during:** Task 3 (human checkpoint verification — changing the período filter)
- **Issue:** `<Select>` was missing the base-ui `items` prop, so after selecting a preset (e.g. "Este ano") the trigger displayed the raw value `"este_ano"` instead of the pt-BR label — the exact same root cause already fixed once before in `ClienteDetailSheet` (Phase 2).
- **Fix:** Moved `items={PRESET_OPTIONS}` onto the `<Select>` root.
- **Files modified:** `components/dashboard/PeriodoFilter.tsx`
- **Verification:** `npx tsc --noEmit`, `npx eslint`, `npm run build` all clean; confirmed visually by the coordinator in the browser after the fix.
- **Committed in:** `0da3d13`

**2. [Rule 1 - Bug] ClientesPorEtapaChart silently dropped 2 of 7 etapa X-axis labels**
- **Found during:** Task 3 (human checkpoint verification — reviewing the etapa chart)
- **Issue:** Recharts' default X-axis label collision handling silently hid the 2 longest of the 7 etapa labels, with no visible error — a real instance of RESEARCH.md's own documented Pitfall 3 class of issue (chart renders with no explicit error, but content is missing).
- **Fix:** Set `interval={0}` (force every tick to render), `angle={-40}` + `textAnchor="end"` (angled labels avoid horizontal overlap), and increased `height`/container height to fit the angled labels.
- **Files modified:** `components/dashboard/ClientesPorEtapaChart.tsx`
- **Verification:** `npx tsc --noEmit`, `npx eslint`, `npm run build` all clean; confirmed visually by the coordinator (all 7 etapa labels legible).
- **Committed in:** `0da3d13`

---

**Total deviations:** 2 auto-fixed (2 bug fixes, both found via the plan's own human-verify checkpoint against files this plan's charts render alongside)
**Impact on plan:** Both fixes are necessary correctness fixes surfaced by actually exercising the completed dashboard — no scope creep, no architectural change. Neither file is one this plan created; both were touched only because the checkpoint step (mandated by the plan) is what caught the bugs.

## Issues Encountered
None beyond the two checkpoint-discovered bugs documented above. `npx tsc --noEmit`, `npx eslint`, and `npm run build` were all clean for every task's changes, both before and after the checkpoint fixes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 7 DSH requirements (DSH-01 through DSH-07) are complete and human-verified for both Supervisor and Vendedor roles
- This closes Phase 4 (Dashboard Gerencial) — the final phase of the v1 milestone — completing all 32 v1 requirements
- No blockers carried forward from this plan. Pre-existing open items (01-05 Task 4 deferred email round-trip verification) remain tracked separately in STATE.md, unaffected by this plan

---
*Phase: 04-dashboard-gerencial*
*Completed: 2026-07-19*

## Self-Check: PASSED

All 6 files found on disk (`DesempenhoVendedorChart.tsx`, `ProspeccaoChart.tsx`, `DashboardClient.tsx`, `PeriodoFilter.tsx`, `ClientesPorEtapaChart.tsx`, this SUMMARY); all 3 commit hashes (`5e67cfe`, `72ef044`, `0da3d13`) found in git history.
