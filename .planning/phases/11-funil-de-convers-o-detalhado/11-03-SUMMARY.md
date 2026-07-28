---
phase: 11-funil-de-convers-o-detalhado
plan: 03
subsystem: ui
tags: [nextjs, react, client-component, table, dashboard, tailwind]

requires:
  - phase: 11-funil-de-convers-o-detalhado
    provides: getFunilDetalhadoAction() Server Action and FunilDetalhadoRow type (plan 02)
provides:
  - FunilDetalhadoTable Client Component (new dashboard section, FNL-01/D-01/D-03)
  - tests/dashboard/funil-detalhado-table.test.tsx render test suite
affects: [11-05-dashboard-client-wiring]

tech-stack:
  added: []
  patterns:
    - "Fetch-on-mount Client Component with independent FetchState/reloadKey, reused verbatim from ClientesPorEtapaChart"
    - "Always render all 7 ETAPAS via a Map-indexed merge, never re-sorted by column value"
    - "Boolean gargalo flag renders as a dual, never-color-only signal: border-l-4 border-l-amber-500 row border + Badge with TriangleAlert + text"

key-files:
  created:
    - components/dashboard/FunilDetalhadoTable.tsx
    - tests/dashboard/funil-detalhado-table.test.tsx
  modified: []

key-decisions:
  - "Followed 11-UI-SPEC.md's Copywriting Contract and 11-PATTERNS.md's worked-example code verbatim (Card shell, fetch scaffold, formatters, gargalo badge) rather than re-deriving shapes independently"
  - "Used CircleHelp (not TriangleAlert) for the Quantidade column's info tooltip icon, matching the plan action's explicit instruction to distinguish the neutral info affordance from the amber warning icon reused for Gargalo"

requirements-completed: [FNL-01]

coverage:
  - id: D1
    description: "FunilDetalhadoTable renders a new Card section with 5 columns (Etapa, Quantidade, % Avançou, Perdidos, Tempo médio parado), one row per etapa, always in ETAPAS' fixed order, never re-sorted by column value"
    requirement: "FNL-01"
    verification:
      - kind: unit
        ref: "tests/dashboard/funil-detalhado-table.test.tsx#renderiza as 7 etapas na ordem fixa"
        status: pass
    human_judgment: false
  - id: D2
    description: "Gargalo (D-03) rows get a dual non-color-only signal: border-l-4 border-l-amber-500 on the row AND a Badge with TriangleAlert + 'Gargalo' text in the Tempo médio cell; non-flagged rows have neither"
    requirement: "FNL-01"
    verification:
      - kind: unit
        ref: "tests/dashboard/funil-detalhado-table.test.tsx#marca a linha de gargalo com borda e badge"
        status: pass
    human_judgment: false
  - id: D3
    description: "Null values render the em dash, never a fabricated 0,0%/0,0 dias; Perdidos formats as 'N (P%)' or bare '0' when perdidosCount is zero and quantidade is nonzero"
    requirement: "FNL-01"
    verification:
      - kind: unit
        ref: "tests/dashboard/funil-detalhado-table.test.tsx#usa travessao para valor nulo"
        status: pass
      - kind: unit
        ref: "tests/dashboard/funil-detalhado-table.test.tsx#formata perdidos com contagem e taxa"
        status: pass
    human_judgment: false
  - id: D4
    description: "Component owns independent loading/error/empty states (h-[320px] skeleton, retry button, 'Nenhum cliente cadastrado ainda.' when total quantidade across all 7 rows is 0) so a failure never blanks the rest of the dashboard"
    requirement: "FNL-01"
    verification:
      - kind: unit
        ref: "tests/dashboard/funil-detalhado-table.test.tsx#mostra o estado vazio quando ninguem passou por nenhuma etapa"
        status: pass
      - kind: unit
        ref: "tests/dashboard/funil-detalhado-table.test.tsx#mostra o estado de erro com botao de nova tentativa"
        status: pass
    human_judgment: false
  - id: D5
    description: "Component takes no role prop, reads no role, and has no isSupervisor branching — FNL-03 visibility is entirely delegated to the RLS-scoped RPC"
    verification:
      - kind: other
        ref: "Task 1 structural verify script: throws if isSupervisor appears in non-comment code or if the component signature accepts any props"
        status: pass
    human_judgment: false

duration: ~5min
completed: 2026-07-28
status: complete
---

# Phase 11 Plan 3: Funil de Conversão Detalhado Summary

**`FunilDetalhadoTable` Client Component — a new 7-row, 5-column dashboard table (Etapa/Quantidade/% Avançou/Perdidos/Tempo médio parado) with a dual color+icon+text bottleneck highlight, built entirely from already-installed shadcn primitives.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-28T16:23:08Z
- **Completed:** 2026-07-28T16:28:04Z
- **Tasks:** 2/2
- **Files modified:** 2 (both new)

## Accomplishments
- `components/dashboard/FunilDetalhadoTable.tsx` created: a Client Component fetching via `getFunilDetalhadoAction()` on mount, with the same `FetchState`/`reloadKey` scaffold as `ClientesPorEtapaChart`
- Table always renders all 7 `ETAPAS` in their fixed array order via a `Map`-indexed merge — no `.sort(` anywhere in the file
- D-03's bottleneck highlight implemented as a dual, never-color-only signal: `border-l-4 border-l-amber-500` on the row AND a `Badge` with `TriangleAlert` + "Gargalo" text in the Tempo médio cell
- Null-safe formatters for `% Avançou`/`Tempo médio parado` (em dash, never "0,0%"/"0,0 dias") and a dedicated `Perdidos` formatter producing `"3 (12,5%)"` or bare `"0"`
- Quantidade column carries an info-icon (`CircleHelp`) tooltip clarifying the historical "ever entered this stage" semantic, disambiguating it from the live snapshot chart above
- Independent loading (`h-[320px]` skeleton), error (retry button, exact reused copy), and empty (`"Nenhum cliente cadastrado ainda."`) states
- `tests/dashboard/funil-detalhado-table.test.tsx` created with 6 render tests covering all of the above, all mocking `getFunilDetalhadoAction` and rendering inside `TooltipProvider`
- Zero new shadcn components, zero new npm dependencies, zero role-based branching

## Task Commits

1. **Task 1: Criar components/dashboard/FunilDetalhadoTable.tsx** - `879ee55` (feat)
2. **Task 2: Criar o teste de render tests/dashboard/funil-detalhado-table.test.tsx** - `2585bbe` (test)

## Files Created/Modified
- `components/dashboard/FunilDetalhadoTable.tsx` - new Client Component: Card shell, fetch-on-mount scaffold, 7-row table with 5 columns, gargalo dual-signal highlight, null-safe formatters
- `tests/dashboard/funil-detalhado-table.test.tsx` - new render test suite: fixed row order, gargalo marking, null em-dash rendering, Perdidos formatting, empty state, error state

## Decisions Made
- Followed `11-UI-SPEC.md`'s Copywriting Contract and `11-PATTERNS.md`'s worked-example code verbatim for the Card shell, fetch scaffold, formatters, and gargalo badge — no re-derivation from scratch
- Used `CircleHelp` (not `TriangleAlert`) for the Quantidade column's info tooltip icon per the plan action's explicit instruction, keeping it visually distinct from the amber `TriangleAlert` reserved for the Gargalo warning

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria (exact Copywriting Contract strings, fixed row order, dual gargalo signal, em-dash null handling, `h-[320px]` heights, no role/period branching) were met on the first implementation pass; `npx tsc --noEmit`, `npx eslint` on both new files, the plan's structural verify script, and `npx vitest run tests/dashboard/funil-detalhado-table.test.tsx` all passed clean.

## Issues Encountered

None. This plan builds a component-level render test only (mocked Server Action, no live Supabase sign-in), so the shared test-project `signInWithPassword` rate-limit issue flagged in `11-01-SUMMARY.md`/`11-02-SUMMARY.md` did not apply here.

## User Setup Required

None - no external service configuration required. The component consumes an existing Server Action from plan 02; no new environment variables or dashboard configuration needed.

## Next Phase Readiness

- `FunilDetalhadoTable` is ready to be imported and placed into `DashboardClient.tsx` by plan 05, immediately after `ClientesPorEtapaChart` and before `GanhosPerdidosCards`, per `11-UI-SPEC.md` §3 and `11-PATTERNS.md`'s placement notes.
- No props are required when wiring it in — it is a zero-argument component.
- Full end-to-end phase verification (this component rendering live inside the real dashboard against both Vendedor and Supervisor sessions) is out of this plan's scope and belongs to plan 05's wiring + the phase's overall verification pass.

---
*Phase: 11-funil-de-convers-o-detalhado*
*Completed: 2026-07-28*

## Self-Check: PASSED

- FOUND: components/dashboard/FunilDetalhadoTable.tsx
- FOUND: tests/dashboard/funil-detalhado-table.test.tsx
- FOUND: .planning/phases/11-funil-de-convers-o-detalhado/11-03-SUMMARY.md
- FOUND commit: 879ee55 (Task 1)
- FOUND commit: 2585bbe (Task 2)
