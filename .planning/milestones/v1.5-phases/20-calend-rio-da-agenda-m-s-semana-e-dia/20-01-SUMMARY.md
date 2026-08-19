---
phase: 20-calend-rio-da-agenda-m-s-semana-e-dia
plan: 01
subsystem: agenda
tags: [date-fns, calendar-grid, pure-functions, ptBR, timezone-safety]

# Dependency graph
requires: []
provides:
  - "lib/agenda/itens.ts extended with the full calendar-layer contract: INICIO_DA_SEMANA/MAX_ITENS_NA_CELULA constants, CalendarioModo/AgendaVisao types, and 9 pure functions (diasDaGradeDoMes, diasDaSemana, rotulosDosDiasDaSemana, navegarData, rotuloDoPeriodo, chaveDoDia, agruparPorData, itensDoDia, dividirCelula)"
  - "Single shared week-start authority (Monday) consumed identically by month/week/day views, closing Pitfall 8"
  - "Timezone-safe day-bucketing (string-key comparison, never Date conversion of item.data), closing Pitfall 7"
affects: [20-02, 20-03, 20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Calendar arithmetic lives in the same pure module that already owns section-grouping (lib/agenda/itens.ts), never a second file, to keep one authority over 'how agenda items are organized'"
    - "date-fns/locale ptBR imported at module scope for pt-BR labels; format() with EEEEEE/MMMM/EEEE tokens instead of hand-written weekday/month name arrays"
    - "Cell-to-item placement always compares item.data (string) against chaveDoDia() output (string) — never parseISO/new Date on the item's date field"

key-files:
  created: []
  modified:
    - "lib/agenda/itens.ts"
    - "tests/agenda/itens.test.ts"

key-decisions:
  - "Month label follows the literal plan action spec ('nome do mes' + 'de' + ano -> 'Agosto de 2026'), not the sketch's year-less 'Agosto 2026' — the plan's <conflitos_resolvidos> already settled that the sketch's header is layout contract, not exact copy"
  - "Short weekday labels use the date-fns EEEEEE (narrow) token, which the installed pt-BR locale renders as unaccented 3-letter abbreviations (seg/ter/qua/qui/sex/sab/dom); capitalized via a single internal helper shared by rotulosDosDiasDaSemana and all three rotuloDoPeriodo branches"
  - "chaveDoDia formats a Date object's LOCAL calendar components (format(dia, 'yyyy-MM-dd')), never a UTC/ISO string conversion — matches how diasDaGradeDoMes/diasDaSemana already produce local Date objects with no timezone component"

requirements-completed: [AGD-08, AGD-09, AGD-10, AGD-11]

coverage:
  - id: D1
    description: "Single INICIO_DA_SEMANA (Monday) constant drives diasDaGradeDoMes and diasDaSemana so month/week/day views can never disagree on which column a date falls in"
    requirement: "AGD-08"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#diasDaGradeDoMes / #diasDaSemana / #INICIO_DA_SEMANA"
        status: pass
    human_judgment: false
  - id: D2
    description: "navegarData advances/retreats exactly one day, one week, or one month per mode, with the January-31-into-February clamp pinned"
    requirement: "AGD-08"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#navegarData"
        status: pass
    human_judgment: false
  - id: D3
    description: "rotuloDoPeriodo returns pt-BR period labels for all three modes (month, week same-month, week cross-month, day)"
    requirement: "AGD-08"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#rotuloDoPeriodo"
        status: pass
    human_judgment: false
  - id: D4
    description: "diasDaGradeDoMes returns complete Monday-to-Sunday weeks (always a multiple of 7) covering the full month, verified against the August 2026 42-cell case and the June-2026-starts-on-Monday edge case"
    requirement: "AGD-09"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#diasDaGradeDoMes"
        status: pass
    human_judgment: false
  - id: D5
    description: "dividirCelula splits a cell's items into visible (capped at MAX_ITENS_NA_CELULA=3 by default) and a derived overflow count, covering empty/under/at/over the cap and an explicit custom cap"
    requirement: "AGD-09"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#dividirCelula"
        status: pass
    human_judgment: false
  - id: D6
    description: "itensDoDia always returns a list (never undefined) for any day, sourced from a pre-computed agruparPorData grouping"
    requirement: "AGD-11"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#itensDoDia"
        status: pass
    human_judgment: false
  - id: D7
    description: "agruparPorData groups by the item's raw date string as the map key (never converting to a Date object), proven against the month-boundary and year-boundary timezone regressions and cross-checked against bucketDoItem's 'hoje' classification for the same date"
    requirement: "AGD-11"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#agruparPorData"
        status: pass
    human_judgment: false
  - id: D8
    description: "diasDaSemana returns exactly 7 Monday-to-Sunday days, including when the reference date itself falls on a Sunday"
    requirement: "AGD-10"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#diasDaSemana"
        status: pass
    human_judgment: false
  - id: D9
    description: "The 4 pre-existing functions (bucketDoItem, agruparAgenda, filtrarPorVendedor, vendedoresDaAgenda) keep identical signature/behavior — all their original test cases pass unedited"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#bucketDoItem / #agruparAgenda / #filtrarPorVendedor / #vendedoresDaAgenda"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-17
status: complete
---

# Phase 20 Plan 01: Calendar pure-function layer (grid, navigation, day-bucketing) Summary

**`lib/agenda/itens.ts` extended with 9 pure calendar functions (Monday-start grid for month/week, pt-BR navigation labels, and timezone-safe string-key day grouping) — the single contract that plans 20-02 through 20-05 build the actual calendar UI against.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 (each split into RED test commit + GREEN implementation commit, per `tdd="true"`)
- **Files modified:** 2 (`lib/agenda/itens.ts`, `tests/agenda/itens.test.ts`)

## Accomplishments

- Published `INICIO_DA_SEMANA` (Monday) as the single source of truth for week start, consumed by both `diasDaGradeDoMes` and `diasDaSemana` — closes Pitfall 8 (date-fns does not derive week-start from locale).
- `diasDaGradeDoMes` produces complete 7-day-multiple month grids (proven: August 2026 = 42 cells, 27/07→06/09; a month starting exactly on Monday has no leading empty week).
- `diasDaSemana` / `rotulosDosDiasDaSemana` / `navegarData` / `rotuloDoPeriodo` cover the three calendar modes' navigation and pt-BR labeling, including the Sunday-reference edge case and the January-31→February clamp behavior.
- `chaveDoDia` / `agruparPorData` / `itensDoDia` implement day-bucketing using the item's raw ISO date string as the map key — verbatim, never converted to a `Date` object — closing Pitfall 7 (the timezone bug this project already hit once with `bucketDoItem`). Proven against month-boundary and year-boundary regressions and cross-checked against `bucketDoItem`'s "hoje" classification.
- `dividirCelula` derives the "+N mais" overflow count from the same slice that produces the visible items, so the count can never disagree with what the cell renders. Uses `MAX_ITENS_NA_CELULA` (3) as its default, overridable.

## Task Commits

Both tasks used `tdd="true"` (RED test commit → GREEN implementation commit):

1. **Task 1: Constants, tipos, grade de mês/semana, navegação e rótulos de período**
   - `5121d01` (test) — failing tests for `diasDaGradeDoMes`, `diasDaSemana`, `rotulosDosDiasDaSemana`, `navegarData`, `rotuloDoPeriodo`, `INICIO_DA_SEMANA`
   - `5a75605` (feat) — implementation; all 31 tests green
2. **Task 2: Agrupamento por dia e repartição de célula ("+N mais")**
   - `2b95d68` (test) — failing tests for `chaveDoDia`, `agruparPorData`, `itensDoDia`, `dividirCelula`
   - `b9a14f0` (feat) — implementation; all 46 tests green

**Plan metadata:** committed separately below (docs commit).

## Files Created/Modified

- `lib/agenda/itens.ts` — added the calendar layer: 2 constants, 2 types, 9 functions, appended after the 4 pre-existing functions (which are untouched).
- `tests/agenda/itens.test.ts` — added 32 new test cases across 11 `describe` blocks, appended after the existing cases (which are untouched and still pass).

## Decisions Made

- Month label follows the plan action's literal spec ("nome do mês" + "de" + ano → **"Agosto de 2026"**), not the sketch's year-less "Agosto 2026" header — the plan's `<conflitos_resolvidos>` block already resolved that the sketch's header is layout contract only, not exact copy.
- Short weekday labels use date-fns' `EEEEEE` (narrow) format token. The installed pt-BR locale renders this as unaccented 3-letter abbreviations (`seg`, `ter`, `qua`, `qui`, `sex`, `sab`, `dom`); a single internal `capitalizarPrimeiraLetra` helper (not exported) capitalizes these and is reused across `rotulosDosDiasDaSemana` and all three `rotuloDoPeriodo` branches, as the plan's action text requested.
- `chaveDoDia` formats a `Date` object's **local** calendar components (`format(dia, "yyyy-MM-dd")`) rather than any UTC-based conversion — consistent with `diasDaGradeDoMes`/`diasDaSemana` already producing local `Date` objects with no timezone component, and consistent with the plan's explicit instruction that this bridge only goes object→text, never text→object.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria and the plan-level `<verification>` block (vitest, `tsc --noEmit`, `eslint`, no `next/*`/`@/lib/supabase/*` import, exactly 2 files changed) pass.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Pure-function library only, no database, no migration, no schema-push (per plan's `<important_notes>`).

## Next Phase Readiness

- Plans 20-02 (dia/semana), 20-03 (mês), 20-04 (barra de navegação), and 20-05 (fiação/toggle) can now be written directly against the published interface contract (`INICIO_DA_SEMANA`, `MAX_ITENS_NA_CELULA`, `CalendarioModo`, `AgendaVisao`, and the 9 functions) without reimplementing any grid/navigation/grouping logic.
- No blockers. The two critical research risks for Phase 20 (Pitfall 7 — timezone-safe item-to-cell placement, and Pitfall 8 — single week-start authority) are both closed and proven in isolation before any component exists.

---
*Phase: 20-calend-rio-da-agenda-m-s-semana-e-dia*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: lib/agenda/itens.ts
- FOUND: tests/agenda/itens.test.ts
- FOUND: .planning/phases/20-calend-rio-da-agenda-m-s-semana-e-dia/20-01-SUMMARY.md
- FOUND commit: 5121d01 (test, Task 1)
- FOUND commit: 5a75605 (feat, Task 1)
- FOUND commit: 2b95d68 (test, Task 2)
- FOUND commit: b9a14f0 (feat, Task 2)
