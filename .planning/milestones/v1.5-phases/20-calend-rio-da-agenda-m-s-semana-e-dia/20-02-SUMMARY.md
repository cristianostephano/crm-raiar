---
phase: 20-calend-rio-da-agenda-m-s-semana-e-dia
plan: 02
subsystem: ui
tags: [react, date-fns, calendar-ui, presentational-components, ptBR]

# Dependency graph
requires:
  - phase: 20-calend-rio-da-agenda-m-s-semana-e-dia
    provides: "lib/agenda/itens.ts calendar-layer contract (diasDaSemana, itensDoDia, bucketDoItem, INICIO_DA_SEMANA) from plan 20-01"
provides:
  - "components/agenda/AgendaCalendarioDia.tsx — presentational day view, reuses AgendaItemRow verbatim (D-05), no title rendering (composer-supplied)"
  - "components/agenda/AgendaCalendarioSemana.tsx — presentational 7-column week view with reduced item chips carrying the same origem icon/color language as the Lista"
affects: [20-03, 20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Calendar views stay purely presentational: props in, callbacks out, zero data fetch, zero Server Action import — same posture as AgendaItemRow/AgendaList"
    - "Lateness is never recomputed locally: both new components call bucketDoItem(item.data, now) from lib/agenda/itens.ts, the single authority, mirroring how AgendaList already derives it per section"
    - "cn()'s tailwind-merge ordering used deliberately: origem border-color class first, atraso border-color class last, so the destructive accent overrides only the color channel of border-l-4 without touching thickness (D-10)"

key-files:
  created:
    - "components/agenda/AgendaCalendarioDia.tsx"
    - "components/agenda/AgendaCalendarioSemana.tsx"
    - "tests/agenda/agenda-calendario-dia.test.tsx"
    - "tests/agenda/agenda-calendario-semana.test.tsx"
  modified: []

key-decisions:
  - "AgendaCalendarioDia renders no day title — the plan's composition note is honored so the exact same component serves both the day view and the month-view day dialog (20-04) without a mode flag"
  - "Week view's day-of-week header labels reuse rotulosDosDiasDaSemana() (exported by 20-01) instead of formatting locally, zipped by index against diasDaSemana(referencia) — both are Monday-start and weekday-name-only, so the zip is safe regardless of which specific week is shown"
  - "Week item chip drops the Concluir button on purpose (documented in the component's header comment) — D-07 forbids new interactions; conclusion stays reachable via the day view and the day dialog"

requirements-completed: [AGD-10, AGD-11, AGD-12]

coverage:
  - id: D1
    description: "AgendaCalendarioDia renders one card per item (in received order) using AgendaItemRow verbatim — same badge, same Concluir button, same late-border styling — with lateness derived from bucketDoItem(item.data, now), never a local date comparison"
    requirement: "AGD-11"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-dia.test.tsx#renderiza um cartão por item / cada cartão é o componente de linha existente / atrasado: item com data anterior ao now recebe a borda de atraso"
        status: pass
    human_judgment: false
  - id: D2
    description: "AgendaCalendarioDia shows a dashed-border empty-day message (no emoji) when itens is empty, and forwards showResponsavel unchanged to each row"
    requirement: "AGD-11"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-dia.test.tsx#lista vazia: mostra a mensagem de dia vazio e nenhum cartão / showResponsavel é repassado sem alteração ao cartão"
        status: pass
    human_judgment: false
  - id: D3
    description: "AgendaCalendarioDia's onOpen/onConcluir callbacks fire with the correct item, and clicking Concluir never also triggers onOpen"
    requirement: "AGD-11"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-dia.test.tsx#clicar no corpo do cartão chama onOpen com o item correto / clicar em Concluir chama onConcluir com o item correto e NÃO chama onOpen"
        status: pass
    human_judgment: false
  - id: D4
    description: "AgendaCalendarioSemana renders exactly 7 Monday-to-Sunday columns derived from diasDaSemana(referencia), and a Sunday reference produces the identical 7-day set as the Monday before it"
    requirement: "AGD-10"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-semana.test.tsx#renderiza exatamente 7 colunas / referência num domingo produz a mesma semana que a referência na segunda anterior"
        status: pass
    human_judgment: false
  - id: D5
    description: "Each week column pulls its items from itensDoDia(porData, dia) with no cap, today's column is visually highlighted, and an empty column shows a dash marker"
    requirement: "AGD-10"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-semana.test.tsx#os itens do dia vêm do agrupamento recebido, sem teto de quantidade / a coluna de hoje é destacada / coluna sem itens mostra um marcador de vazio"
        status: pass
    human_judgment: false
  - id: D6
    description: "Week item chips use the same two icons/colors as AgendaItemRow (ClipboardCheck+muted for prospecção, Repeat+primary for visita), and a late visita chip gains the destructive border accent while the Repeat icon (origem signal) stays visible — proving the accent is additive, not a replacement"
    requirement: "AGD-12"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-semana.test.tsx#item de prospecção tem borda cinza (muted); item de visita tem borda azul (primary) / item atrasado ganha acento vermelho na borda sem apagar a informação de origem"
        status: pass
    human_judgment: false
  - id: D7
    description: "Clicking a week chip fires onOpenItem with the correct item; no drag-and-drop, no hour grid, no column-header interaction exists anywhere in the file (mechanically verified — no dnd-kit/draggable reference)"
    requirement: "AGD-10"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-semana.test.tsx#clicar num cartão dispara onOpenItem com o item correto"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-08-17
status: complete
---

# Phase 20 Plan 02: AgendaCalendarioDia and AgendaCalendarioSemana Summary

**Two new presentational components — a day list that reuses `AgendaItemRow` verbatim (D-05) and a 7-column week grid with reduced item chips carrying the Lista's exact prospecção/visita icon-and-color language, both driven by `bucketDoItem` as the single lateness authority.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (each split into RED test commit + GREEN implementation commit, per `tdd="true"`)
- **Files modified:** 4 (all new — 2 components, 2 test files)

## Accomplishments

- `AgendaCalendarioDia` renders a day's items with zero new card markup — it composes `AgendaItemRow` directly, so the badge, the Concluir button, and the late-border treatment are byte-identical to the Lista (D-05). It deliberately renders no day title, since it's reused as the content of the month-view day dialog in plan 20-04.
- `AgendaCalendarioSemana` renders 7 Monday-to-Sunday columns sourced from `diasDaSemana` (never local date arithmetic), proven identical whether the reference date is a Sunday or the Monday before it — the exact edge case the research flagged as delicate (Pitfall 8).
- Both components derive lateness exclusively from `bucketDoItem(item.data, now)` — no `differenceInCalendarDays`/`isBefore`/`isAfter` appears in either file, mechanically enforced by the plan's verify script.
- The week item chip is a deliberate reduction of the Lista's card: same two icons (`ClipboardCheck`/`Repeat`) and the same muted/primary color split, minus the Concluir button (documented as intentional — D-07 forbids new interactions in this phase).
- The late-item border accent is composed with `cn()` so the destructive color class is applied *last*, overriding only the border color of `border-l-4` — proven in a test with a late `visita` item, whose `Repeat` icon (origem signal) remains visible alongside the red accent (D-10).
- No raw sketch color values were copied — every color is a project design-system token (`text-muted-foreground`, `border-l-primary`, `border-l-destructive`, `bg-primary/10`, etc.), mechanically checked by the verify script's hex-color scan.

## Task Commits

Both tasks used `tdd="true"` (RED test commit → GREEN implementation commit):

1. **Task 1: Visão de dia — lista de um dia reusando o cartão da Lista**
   - `7bf6128` (test) — failing tests for `AgendaCalendarioDia`
   - `23ddc27` (feat) — implementation; all behavior-block cases green
2. **Task 2: Visão de semana — 7 colunas com cartões pequenos**
   - `4081c06` (test) — failing tests for `AgendaCalendarioSemana`
   - `c9c84b1` (feat) — implementation; all behavior-block cases green

**Plan metadata:** committed separately below (docs commit).

## Files Created/Modified

- `components/agenda/AgendaCalendarioDia.tsx` — day-list view; maps `itens` to `AgendaItemRow`, derives `atrasado` via `bucketDoItem`, shows a dashed-border empty state when `itens` is empty.
- `components/agenda/AgendaCalendarioSemana.tsx` — 7-column CSS grid view; derives columns from `diasDaSemana`, items per column from `itensDoDia`, headers from `rotulosDosDiasDaSemana`; internal `WeekItemChip` renders the reduced card.
- `tests/agenda/agenda-calendario-dia.test.tsx` — 7 test cases covering ordering, card reuse (badge + Concluir button), lateness, callback routing (open vs. concluir, no cross-triggering), empty state, and `showResponsavel` pass-through.
- `tests/agenda/agenda-calendario-semana.test.tsx` — 9 test cases covering the 7-column grid, the Sunday-vs-Monday-reference equivalence, uncapped item rendering, chip content, origem color/icon, the late-item accent-preserves-origem case, today highlighting, empty-column marker, and click routing.

## Decisions Made

- `AgendaCalendarioDia` never renders a day title — per the plan's interface contract, the composer (plan 20-04) supplies the title in both places it reuses this component (own day view header, and the month-grid's day dialog title).
- Week column headers reuse `rotulosDosDiasDaSemana()` (already exported by plan 20-01) instead of formatting weekday abbreviations locally, zipped by index against `diasDaSemana(referencia)` — both functions are Monday-start and weekday-name-only, so the zip stays correct for any reference week.
- The week item chip intentionally omits the Concluir button. This is documented in the component's header comment as the D-07-mandated reduction: no new interaction is introduced in the calendar views, conclusion stays reachable through the day view and the day dialog that 20-04 will open.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria, the plan-level `<verification>` block (vitest, `tsc --noEmit`, `eslint`, four new files, existing tests untouched and passing), and the mechanical checks embedded in each task's `<verify>` block pass.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Purely presentational components, no database, no migration, no schema-push.

## Next Phase Readiness

- Plans 20-03 (mês), 20-04 (barra de navegação / composição), and 20-05 (fiação/toggle) can now consume `AgendaCalendarioDia` and `AgendaCalendarioSemana` directly against the published prop contract without reimplementing any card, grid, or lateness logic.
- `AgendaCalendarioDia`'s no-title design is specifically what unblocks 20-04's day-dialog reuse — confirmed by this plan's own test suite exercising the component standalone.
- No blockers.

---
*Phase: 20-calend-rio-da-agenda-m-s-semana-e-dia*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: components/agenda/AgendaCalendarioDia.tsx
- FOUND: components/agenda/AgendaCalendarioSemana.tsx
- FOUND: tests/agenda/agenda-calendario-dia.test.tsx
- FOUND: tests/agenda/agenda-calendario-semana.test.tsx
- FOUND: .planning/phases/20-calend-rio-da-agenda-m-s-semana-e-dia/20-02-SUMMARY.md
- FOUND commit: 7bf6128 (test, Task 1)
- FOUND commit: 23ddc27 (feat, Task 1)
- FOUND commit: 4081c06 (test, Task 2)
- FOUND commit: c9c84b1 (feat, Task 2)
