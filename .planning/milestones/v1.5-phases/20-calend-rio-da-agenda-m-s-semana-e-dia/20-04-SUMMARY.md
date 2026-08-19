---
phase: 20-calend-rio-da-agenda-m-s-semana-e-dia
plan: 04
subsystem: ui
tags: [react, date-fns, calendar-ui, presentational-composition, ptBR, dialog]

# Dependency graph
requires:
  - phase: 20-calend-rio-da-agenda-m-s-semana-e-dia (plan 01)
    provides: "lib/agenda/itens.ts calendar-layer contract (agruparPorData, itensDoDia, navegarData, rotuloDoPeriodo, CalendarioModo/AgendaVisao)"
  - phase: 20-calend-rio-da-agenda-m-s-semana-e-dia (plan 02)
    provides: "AgendaCalendarioDia (reused verbatim as both the day view and the month-grid day-dialog body)"
  - phase: 20-calend-rio-da-agenda-m-s-semana-e-dia (plan 03)
    provides: "AgendaCalendarioMes (day-cell click emits onSelecionarDia, consumed here to open the dialog)"
provides:
  - "components/agenda/AgendaCalendarioToolbar.tsx — Variante A toolbar: 4-option view switch, date-nav (anterior/próximo/Hoje), legend, all conditional on a nullable rotulo"
  - "components/agenda/AgendaCalendario.tsx — composition root owning reference date + dialog-day state, single agruparPorData computation, and the month-day dialog"
affects: [20-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Toolbar stays mounted across all visao values (including lista) — rotulo=null is the signal to hide date-nav/legend, not a separate conditional render path in the parent"
    - "AgendaVisao/CalendarioModo string literals double as both the runtime value AND the mechanical verify-script anchor for view labels (e.g. `valor: \"mes\"` literal satisfies the label-presence check even though the human-facing rotulo is accented \"Mês\")"
    - "Single useMemo(() => agruparPorData(itens), [itens]) at the composition root — both AgendaCalendarioMes and AgendaCalendarioSemana receive the exact same Map reference, never a per-view recomputation"
    - "Day-dialog reuses AgendaCalendarioDia verbatim as its body (3rd usage site in the file: import + day-mode render + dialog render) — closes the D-05 chain from card to day-list to day-dialog with zero new item-listing code"

key-files:
  created:
    - "components/agenda/AgendaCalendarioToolbar.tsx"
    - "components/agenda/AgendaCalendario.tsx"
    - "tests/agenda/agenda-calendario-toolbar.test.tsx"
    - "tests/agenda/agenda-calendario.test.tsx"
  modified: []

key-decisions:
  - "visao/onVisaoChange stay as props on AgendaCalendario, never local state — the plan's interface_context requires this so plan 20-05 can add the Lista/Calendário toggle without AgendaCalendario absorbing that control"
  - "The day-mode header (h2, inside AgendaCalendario) and the toolbar's date-nav label both render the same rotulo text simultaneously by design — they're two different UI elements (nav-label vs section-header) that happen to show identical text in day mode; tests scope with getByRole('heading', ...) to disambiguate rather than treating it as a bug"
  - "Dialog's open state is derived purely from diaDialogo !== null (no separate boolean pair like AgendaList's concluirItem/concluirDialogOpen) — simpler because this dialog has no exit animation state to preserve across close, unlike ConcluirItemDialog which needs the item to persist through its close transition"

requirements-completed: [AGD-08, AGD-09, AGD-11]

coverage:
  - id: D1
    description: "AgendaCalendarioToolbar renders 4 view buttons in order Lista/Dia/Semana/Mês from a local constant, active button announces selection via aria-pressed, and clicking a button fires onVisaoChange with that view's value"
    requirement: "AGD-08"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-toolbar.test.tsx#renderiza os quatro botões de visão na ordem Lista, Dia, Semana, Mês / o botão da visão ativa anuncia seleção de forma acessível, os demais não / clicar num botão de visão dispara onVisaoChange com o valor daquela visão"
        status: pass
    human_judgment: false
  - id: D2
    description: "With rotulo=null (Lista view) the toolbar hides date-nav and legend but keeps the view switch visible; with a rotulo, the anterior/próximo/Hoje buttons and legend all appear, each with its own accessible label, and each nav button fires only its own callback"
    requirement: "AGD-08"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-toolbar.test.tsx#com rótulo nulo (visão de Lista), navegação e legenda não aparecem, mas o seletor continua visível / com rótulo, aparecem o rótulo do período, os botões de navegação e o botão Hoje / cada botão de navegação dispara só o seu próprio retorno de chamada / a legenda mostra as três marcas — prospecção, visita e atrasado"
        status: pass
    human_judgment: false
  - id: D3
    description: "AgendaCalendario renders the toolbar always (including in Lista, with no grid underneath), the correct grid per mode (mes/semana/dia), and the day-mode header showing the full-text date above the day list"
    requirement: "AGD-08"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario.test.tsx#visão lista: renderiza só a barra de ferramentas, sem grade nenhuma / visão mês: mostra o rótulo do mês e a grade de mês (42 células em agosto de 2026) / visão semana: mostra o rótulo da semana e as 7 colunas / visão dia: mostra o cabeçalho com a data por extenso e a lista do dia"
        status: pass
    human_judgment: false
  - id: D4
    description: "Anterior/próximo move the reference date by exactly one month/week/day depending on the active mode (via navegarData), and Hoje resets the reference back to the received now after navigating away; switching visao preserves the reference date instead of resetting it"
    requirement: "AGD-08"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario.test.tsx#avançar/voltar no modo mês movem o rótulo um mês por vez / avançar no modo semana move o rótulo uma semana / avançar no modo dia move o rótulo um dia / clicar em Hoje devolve a referência para a data de now depois de navegar para longe / trocar de visão preserva a data de referência"
        status: pass
    human_judgment: false
  - id: D5
    description: "The date-grouping (agruparPorData) is computed once and the identical Map feeds both the month and week views for the same underlying itens — proven by the same item appearing in both views without a second AgendaCalendario mount recomputing anything"
    requirement: "AGD-11"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario.test.tsx#o mesmo agrupamento alimenta a visão de mês e a de semana para o mesmo dia"
        status: pass
    human_judgment: false
  - id: D6
    description: "Clicking a month-grid day cell opens a dialog whose title is that day's full-text date and whose body is the full item list for that day (or the day view's own empty-day message when there are none) — using the exact same AgendaCalendarioDia component as the day view, never a second item-listing component; closing the dialog removes it from the DOM"
    requirement: "AGD-09"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario.test.tsx#clicar num dia da grade de mês abre o diálogo com o título e a lista daquele dia / o diálogo de um dia sem itens mostra a mensagem de dia vazio / fechar o diálogo o remove"
        status: pass
    human_judgment: false
  - id: D7
    description: "Concluir and abrir fired from inside the day dialog reach onConcluirItem/onOpenCliente with the exact item/clienteId; clicking a week-view chip also reaches onOpenCliente with the correct clienteId — the container never calls a server action itself"
    requirement: "AGD-11"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario.test.tsx#concluir um item de dentro do diálogo dispara onConcluirItem com o item certo / abrir um item de dentro do diálogo dispara onOpenCliente com o identificador certo / clicar num cartão da semana dispara onOpenCliente com o identificador certo"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-08-17
status: complete
---

# Phase 20 Plan 04: Calendar toolbar and composition container (view-switch, nav, day dialog) Summary

**`AgendaCalendarioToolbar` (Variante A: 4-option view switch + date-nav + Hoje + legend) and `AgendaCalendario` (the composition root owning reference date, a single `agruparPorData` computation, and the month-day dialog that reuses the day view verbatim) — the calendar is now a navigable whole outside the screen, with only the Lista wiring left for plan 20-05.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 (each split into RED test commit + GREEN implementation commit, per `tdd="true"`)
- **Files modified:** 4 (all new — 2 components, 2 test files)

## Accomplishments

- `AgendaCalendarioToolbar` renders the Variante A layout from the approved sketch: a 4-button segmented view switch (Lista/Dia/Semana/Mês, iterated from a local constant, active state via `aria-pressed`), date-nav (anterior/próximo/Hoje, each with its own accessible label) and the 3-mark legend — all gated behind a nullable `rotulo` prop so the same component serves both the Lista (switch only) and every calendar mode (full toolbar).
- `AgendaCalendario` composes the three already-built views (`AgendaCalendarioDia`/`Semana`/`Mes`) behind a single reference-date state and a single `useMemo(() => agruparPorData(itens), [itens])` — the same `Map` object feeds both the month grid and the week grid, closing the Pitfall-10 risk the threat model flagged (T-20-11).
- Navigation steps come exclusively from `navegarData`/`rotuloDoPeriodo` (plan 20-01's pure module) — one day/week/month per click depending on the active mode, and "Hoje" always resets to the received `now`, proven after navigating three months away.
- Switching `visao` (a prop, not local state — owned by the future 20-05 screen) preserves the reference date: moving to September in month mode and then switching to day mode still shows a September day, not a reset to `now`.
- Clicking a month-grid day cell opens a dialog whose title is that day's full-text date (`rotuloDoPeriodo(dia, "dia")`) and whose body is **the same `AgendaCalendarioDia` component** used for the day view and the day mode's own section — the D-05 reuse chain (card → day-list → day-dialog) now has zero duplicate item-listing code anywhere in the calendar. An empty day shows the day view's own dashed-border empty state, not a second copy of that message.
- Concluir/abrir fired from inside the dialog, and clicking a week-view chip, all reach the container's `onConcluirItem`/`onOpenCliente` props with the exact item/clienteId — the container itself imports no Server Action and reads no data (mechanically enforced by both tasks' `<verify>` scripts).

## Task Commits

Both tasks used `tdd="true"` (RED test commit → GREEN implementation commit):

1. **Task 1: Barra de ferramentas — seletor de visão, navegação de data, botão Hoje e legenda**
   - `23e60b3` (test) — failing tests for `AgendaCalendarioToolbar`
   - `21a80a7` (feat) — implementation; 7/7 tests green
2. **Task 2: Contêiner do calendário — data de referência, agrupamento único, troca de visão e diálogo do dia**
   - `d66e9d3` (test) — failing tests for `AgendaCalendario`
   - `3660202` (feat) — implementation; 16/16 tests green

**Plan metadata:** committed separately below (docs commit).

## Files Created/Modified

- `components/agenda/AgendaCalendarioToolbar.tsx` — presentational toolbar: 4-option segmented view switch, conditional date-nav + legend block, no local state.
- `components/agenda/AgendaCalendario.tsx` — composition root: owns `referencia`/`diaDialogo` state, computes `porData` once via `useMemo`, renders the toolbar + the mode-appropriate view + the month-day dialog.
- `tests/agenda/agenda-calendario-toolbar.test.tsx` — 7 test cases covering button order, active-state announcement, callback routing, rotulo-null gating, and legend content.
- `tests/agenda/agenda-calendario.test.tsx` — 16 test cases covering per-mode rendering, nav step correctness per mode, Hoje reset, view-switch preserving `referencia`, single-agrupamento consistency across mes/semana, and the full day-dialog lifecycle (open/empty/close/concluir/abrir) plus week-chip click routing.

## Decisions Made

- `visao`/`onVisaoChange` remain props on `AgendaCalendario`, never local state — required by the plan's published interface contract so plan 20-05 can own the Lista/Calendário toggle without `AgendaCalendario` absorbing that control.
- The day-mode section header (an `<h2>` inside `AgendaCalendario`) intentionally shows the same text as the toolbar's date-nav label when in day mode — they're two distinct elements serving different purposes (compact nav label vs. section header above the list), not a duplicate-rendering bug. Test assertions use `getByRole("heading", ...)` to disambiguate rather than avoiding the overlap.
- The day dialog's open state derives purely from `diaDialogo !== null`, with no separate open/closed boolean — simpler than `ConcluirItemDialog`'s two-state pattern because this dialog has no exit-animation content that needs to survive past `open` flipping to `false`.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria, both tasks' mechanical `<verify>` scripts (client-component check, label/color/state checks, banned-import checks, `useMemo`/`Dialog` presence checks, `AgendaCalendarioDia` triple-reuse check), and the plan-level `<verification>` block (all five calendar test files green together — 59 tests; `AgendaList.tsx`/`AgendaItemRow.tsx`/`ConcluirItemDialog.tsx` untouched; `git diff --stat` shows exactly the four declared new files) pass.

## Issues Encountered

Three of my own test assertions initially failed with "multiple elements found" — in day mode, both the toolbar's date-nav label and the day view's own `<h2>` header render the identical `rotuloDoPeriodo` text by design (see Decisions Made). Fixed by scoping those three assertions to `getByRole("heading", ...)` instead of the ambiguous `getByText(...)`; no component behavior changed, this was a test-authoring correction caught before the GREEN commit.

## User Setup Required

None — no external service configuration required. Purely presentational/composition components, no database, no migration, no schema-push.

## Next Phase Readiness

- Plan 20-05 can now wire `AgendaCalendario` directly into `AgendaList.tsx` alongside a Lista/Calendário toggle: pass the already-filtered `itens`, `showResponsavel`, and the existing `handleOpenCliente`/`handleOpenConcluir` callbacks straight through as `onOpenCliente`/`onConcluirItem`, own `visao` as a new piece of screen state, and render `AgendaCalendario` instead of (or alongside) the current section-grouped list when the toggle is set to any calendar mode.
- No blockers. `AgendaList.tsx`, `AgendaItemRow.tsx`, and `ConcluirItemDialog.tsx` remain completely untouched, exactly as this plan's `<verification>` block required — the fiação in 20-05 starts from a clean, already-proven calendar unit.

---
*Phase: 20-calend-rio-da-agenda-m-s-semana-e-dia*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: components/agenda/AgendaCalendarioToolbar.tsx
- FOUND: components/agenda/AgendaCalendario.tsx
- FOUND: tests/agenda/agenda-calendario-toolbar.test.tsx
- FOUND: tests/agenda/agenda-calendario.test.tsx
- FOUND: .planning/phases/20-calend-rio-da-agenda-m-s-semana-e-dia/20-04-SUMMARY.md
- FOUND commit: 23e60b3 (test, Task 1)
- FOUND commit: 21a80a7 (feat, Task 1)
- FOUND commit: d66e9d3 (test, Task 2)
- FOUND commit: 3660202 (feat, Task 2)
