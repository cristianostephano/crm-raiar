---
phase: 04-dashboard-gerencial
plan: 03
subsystem: ui
tags: [nextjs, recharts, dashboard, server-components, rls]

# Dependency graph
requires:
  - phase: 04-dashboard-gerencial (plan 01)
    provides: "app/actions/dashboard.ts Server Action wrappers + RLS-scoped dashboard_* RPCs, lib/dashboard/periodo.ts (resolvePeriodo/PeriodoPreset)"
  - phase: 04-dashboard-gerencial (plan 02)
    provides: "components/ui/chart.tsx (ChartContainer/ChartTooltip), components/ui/skeleton.tsx, --chart-1 blue CSS variable"
provides:
  - "app/(app)/dashboard/page.tsx — protected /dashboard route reading profile.role, passing isSupervisor into DashboardClient"
  - "\"Dashboard\" nav link in app/(app)/layout.tsx, visible to both roles, /clientes unchanged as the landing route"
  - "components/dashboard/DashboardClient.tsx — client orchestrator holding período preset/custom-range state, hosting chart-block slots"
  - "components/dashboard/PeriodoFilter.tsx — preset Select (4 options) + Popover/Calendar mode=\"range\" custom picker, committed only on Aplicar"
  - "components/dashboard/ClientesPorEtapaChart.tsx — first live dashboard metric (DSH-01), vertical BarChart with loading/empty/error states"
affects: [04-04, 04-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dashboard metric components own their own fetch-on-mount effect (setState synchronously inside useEffect with an eslint-disable-next-line react-hooks/set-state-in-effect comment, mirroring EditableListTab's precedent) plus a `cancelled` guard and a `reloadKey` bump for the \"Tentar novamente\" retry button"
    - "DashboardClient holds raw período inputs (preset/customRange) but does not compute resolvePeriodo() until a period-filtered child actually needs it — avoids a dead unused variable ahead of 04-04/04-05"

key-files:
  created:
    - app/(app)/dashboard/page.tsx
    - components/dashboard/DashboardClient.tsx
    - components/dashboard/PeriodoFilter.tsx
    - components/dashboard/ClientesPorEtapaChart.tsx
  modified:
    - app/(app)/layout.tsx

key-decisions:
  - "DashboardClient does not call resolvePeriodo() yet — ClientesPorEtapaChart is the only wired metric and is explicitly period-independent (D-08); computing an unused periodo value would leave a dead variable ahead of 04-04's KPI/desempenho blocks, which are the first real consumers"
  - "PeriodoFilter's Select commits every preset choice immediately to the parent (including \"Personalizado\", which only reveals the range popover) — only the custom range itself waits for an explicit \"Aplicar período\" click, per D-01's stated UX"

requirements-completed: [DSH-01, DSH-06, DSH-07]

coverage:
  - id: D1
    description: "\"Dashboard\" nav link visible to both roles in app/(app)/layout.tsx, placed before the Supervisor-only links; /clientes remains the landing route"
    requirement: "DSH-06"
    verification:
      - kind: other
        ref: "grep -q 'href=\"/dashboard\"' 'app/(app)/layout.tsx' (pass); app/(app)/page.tsx untouched by this plan's commits (git diff --stat confirmed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "/dashboard Server Component reads profile.role and passes isSupervisor into DashboardClient without client-side role re-derivation"
    requirement: "DSH-07"
    verification:
      - kind: other
        ref: "npx tsc --noEmit && npm run build (both clean, /dashboard listed as a dynamic route)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PeriodoFilter offers the 4 preset labels in order and only commits a custom range via \"Aplicar período\", never a half-selected range"
    requirement: "DSH-01"
    verification: []
    human_judgment: true
    rationale: "Interactive Select/Popover/Calendar behavior needs a human (or Playwright) to click through; no automated test exists yet for this UI-only wiring plan, matching this project's established precedent for pure UI-orchestration plans (e.g. 04-02 shipped no new tests either)."
  - id: D4
    description: "ClientesPorEtapaChart renders a live-snapshot vertical BarChart via getClientesPorEtapaAction, x-axis labels sourced from lib/funil/etapas.ts ETAPAS (no second label map), with distinct loading/empty/error states"
    requirement: "DSH-01"
    verification:
      - kind: other
        ref: "grep -q 'h-\\[280px\\]' components/dashboard/ClientesPorEtapaChart.tsx && grep -q 'from \"@/lib/funil/etapas\"' components/dashboard/ClientesPorEtapaChart.tsx (both pass); npx tsc --noEmit && npm run build (clean)"
        status: pass
    human_judgment: true
    rationale: "Visual chart rendering, the 3 distinct UI states, and the RLS-scoped counts (Vendedor vs Supervisor) need a human sign-off against a real logged-in session; the underlying RPC's RLS-isolation guarantee is already proven by tests/dashboard/rls-dashboard.test.ts (04-01), so this deliverable is UI-rendering-only judgment, not a re-proof of the data boundary."

# Metrics
duration: ~25min
completed: 2026-07-19
status: complete
---

# Phase 4 Plan 3: Dashboard Screen Spine + Clientes Por Etapa Chart Summary

**Stood up the protected `/dashboard` route with a role-aware header, a "Dashboard" nav link for both roles, a preset+custom period filter, and the first live RLS-scoped metric — a "Clientes por etapa do funil" vertical bar chart — wired end-to-end through the 04-01 Server Action.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-19T03:05:00Z (approx.)
- **Completed:** 2026-07-19T03:30:00Z (approx.)
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `/dashboard` is now a real, navigable, protected screen: a "Dashboard" link sits in `app/(app)/layout.tsx`'s nav for both Supervisor and Vendedor, placed before the Supervisor-only links — the kanban (`/clientes`) is unchanged as the post-login landing route (D-03)
- `DashboardClient` (Client Component orchestrator) renders the page-level "Dashboard" heading with the exact role-aware subtitle from the UI-SPEC's Copywriting Contract ("Números da equipe" / "Seus números de vendas"), and hosts labeled placeholder slots for the KPI row, "Desempenho por vendedor", and "Prospecção" blocks landing in 04-04/04-05
- `PeriodoFilter` offers the 4 presets in order (Últimos 30 dias / Este mês / Este ano / Personalizado); the 3 simple presets apply immediately, "Personalizado" reveals a Popover+Calendar `mode="range"` picker (same composition already used twice in `ClienteDetailSheet.tsx`) that only commits to the parent on an explicit "Aplicar período" click — a half-selected range never becomes the applied período
- `ClientesPorEtapaChart` is the first real metric on screen (DSH-01): a vertical `BarChart` inside `ChartContainer` (`h-[280px] w-full`, `accessibilityLayer`), x-axis labels sourced from `lib/funil/etapas.ts`'s `ETAPAS` (no second hardcoded etapa→label map), single `--chart-1` blue bar fill, with its own Skeleton-loading, "Nenhum cliente cadastrado ainda." empty state, and an inline error+"Tentar novamente" retry state that never blanks the rest of the page
- The chart's data path has zero client-side role/responsavel filtering — it renders whatever `getClientesPorEtapaAction()` returns, which is already RLS-scoped server-side by the 04-01 `dashboard_clientes_por_etapa()` SECURITY INVOKER function (T-04-04 threat mitigation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Route, nav link, orchestrator + period filter** - `9d0cd4c` (feat)
2. **Task 2: Clientes por etapa chart (DSH-01) wired end-to-end** - `6912a46` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `app/(app)/dashboard/page.tsx` - Server Component: auth-guard-adjacent role read, renders `DashboardClient isSupervisor={...}`
- `app/(app)/layout.tsx` - adds the "Dashboard" `<Link>` immediately after "Clientes", before the Supervisor-only links
- `components/dashboard/DashboardClient.tsx` - holds `preset`/`customRange` state, renders heading/subtitle/`PeriodoFilter`, hosts `ClientesPorEtapaChart` plus labeled placeholder comments for 04-04/04-05's blocks
- `components/dashboard/PeriodoFilter.tsx` - `Select` (4 presets) + `Popover`/`Calendar mode="range"` custom-range picker with Aplicar/Cancelar footer
- `components/dashboard/ClientesPorEtapaChart.tsx` - fetches via `getClientesPorEtapaAction()`, renders the vertical bar chart with loading/empty/error states

## Decisions Made
- `DashboardClient` intentionally does NOT call `resolvePeriodo()` yet — the only metric wired in this plan (`ClientesPorEtapaChart`) is explicitly period-independent per D-08, so computing a resolved `{inicio, fim}` with no consumer would be dead code (and trips `@typescript-eslint/no-unused-vars`, confirmed via `npx eslint`). `preset`/`customRange` raw state remains, ready for `resolvePeriodo()` to be added the moment 04-04 wires its first period-filtered child.
- `PeriodoFilter`'s Select commits every preset choice immediately to the parent — including "Personalizado", which only reveals the range Popover, never applies a période by itself. Only the committed custom range (via "Aplicar período") changes the effective filter. This matches D-01's literal wording ("presets aplicam imediatamente; range personalizado precisa de Aplicar") more precisely than deferring the Select's own commit.
- `ClientesPorEtapaChart`'s fetch-on-mount effect follows `EditableListTab.tsx`'s established pattern exactly (`setState` synchronously inside `useEffect` with an `eslint-disable-next-line react-hooks/set-state-in-effect` justifying comment, a `cancelled` guard for unmount-safety, and — new here — a `reloadKey` counter bumped by the "Tentar novamente" button to re-run the effect) rather than a `useCallback`-wrapped loader, since the callback-based version tripped the same `react-hooks/set-state-in-effect` ESLint error the project's own precedent already solved.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `useCallback`-wrapped fetch loader tripped `react-hooks/set-state-in-effect` ESLint error**
- **Found during:** Task 2 (`ClientesPorEtapaChart` implementation), running `npx eslint` before commit
- **Issue:** The initial implementation called a memoized `load()` function from inside `useEffect`, which synchronously calls `setState({status: "loading"})` — the React ESLint plugin flags this as "calling setState() directly within an effect" because the setState call isn't textually inside the effect body itself.
- **Fix:** Restructured to match `components/configuracoes/EditableListTab.tsx`'s already-established pattern: the synchronous `setState({status: "loading"})` call now lives directly in the effect body (with a justifying `eslint-disable-next-line react-hooks/set-state-in-effect` comment, mirroring `EditableListTab.tsx`'s own comment), a `cancelled` flag guards the async `.then()` callback, and a `reloadKey` state number (bumped by the "Tentar novamente" button) is the effect's dependency instead of a recreated callback reference.
- **Files modified:** `components/dashboard/ClientesPorEtapaChart.tsx`
- **Verification:** `npx eslint components/dashboard/ClientesPorEtapaChart.tsx` — 0 problems; `npx tsc --noEmit` and `npm run build` both clean.
- **Committed in:** `6912a46` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix — a real ESLint error caught before commit, not a runtime bug)
**Impact on plan:** No scope creep; the fix aligns the new component with an already-established project pattern instead of introducing a novel one.

## Issues Encountered
None beyond the ESLint fix documented above. `npm run build` succeeded on the first attempt after both task commits, registering `/dashboard` as a dynamic (`ƒ`) route alongside the existing `/clientes`, `/configuracoes`, `/equipe` routes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/dashboard` is live, navigable, and shows a real RLS-scoped chart for both roles — the "first visible slice" goal for this wave is met
- `DashboardClient`'s labeled placeholder comments mark exactly where 04-04 (KPI row + "Desempenho por vendedor") and 04-05 (Prospecção charts) plug in; `preset`/`customRange` state is already in place for those plans to consume via `resolvePeriodo()`
- `PeriodoFilter`'s committed-range contract (`{from: Date; to: Date}`, only updated via `onCustomRangeApply`) is stable and ready to be threaded into period-filtered Server Action calls
- No blockers carried forward

---
*Phase: 04-dashboard-gerencial*
*Completed: 2026-07-19*

## Self-Check: PASSED

All 6 files found on disk (page.tsx, DashboardClient.tsx, PeriodoFilter.tsx, ClientesPorEtapaChart.tsx, layout.tsx, SUMMARY.md); both task commit hashes (`9d0cd4c`, `6912a46`) found in git history.
