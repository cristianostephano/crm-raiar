---
phase: 20-calend-rio-da-agenda-m-s-semana-e-dia
plan: 03
subsystem: ui
tags: [date-fns, calendar-grid, month-view, tailwind, react, accessibility]

# Dependency graph
requires:
  - phase: 20-calend-rio-da-agenda-m-s-semana-e-dia (plan 01)
    provides: "diasDaGradeDoMes, rotulosDosDiasDaSemana, itensDoDia, dividirCelula, bucketDoItem, MAX_ITENS_NA_CELULA — the pure calendar-layer contract"
provides:
  - "components/agenda/AgendaCalendarioMes.tsx — 7-column/6-row month grid with day cells, item chips, and a +N mais overflow indicator"
affects: [20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two independently-named booleans per grid cell (noMesVisivel, ehHoje) so 'belongs to visible month' and 'is today' can never collapse into a single style path (Pitfall 9 guard)"
    - "dividirCelula called exactly once per cell — visiveis and excedente are destructured from the same result object, never two separate slice/length calculations (Pitfall 10 guard)"
    - "Chip color resolved in two cn() steps: origin pair (background/text/border-l) first, atraso accent (border-l-destructive) applied last so it overwrites only the border-l color, never the origin icon/text"
    - "Chips carry no click handler, role, or tabIndex of their own — click bubbles to the cell's own handler, which is the only interactive target in a day cell"

key-files:
  created:
    - "components/agenda/AgendaCalendarioMes.tsx"
    - "tests/agenda/agenda-calendario-mes.test.tsx"
  modified: []

key-decisions:
  - "MonthDayCell renders only the day number in Task 1 (no items), with itensDoDia already wired for the accessible label's item count — Task 2 then reuses that same itens array for dividirCelula, so the single-computation guarantee spans both tasks instead of being retrofitted"
  - "Chip container has no truncation-breaking children: the razão social sits in its own <span className='min-w-0 flex-1 truncate'> so ellipsis works inside a flex row without an explicit width"

requirements-completed: [AGD-09, AGD-12]

coverage:
  - id: D1
    description: "Month grid header derives its 7 labels from rotulosDosDiasDaSemana (Monday-first), and the body derives its cells from diasDaGradeDoMes — no hand-written weekday list or date arithmetic in the component"
    requirement: "AGD-09"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#cabeçalho mostra os 7 rótulos de segunda a domingo, começando em Seg"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#agosto de 2026 renderiza 42 células (6 semanas completas)"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#um mês de 5 semanas renderiza o número correspondente de células"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each cell caps visible items at 3 and shows a '+N mais' indicator whose count is derived from the same dividirCelula call as the visible chips, including the sketch's exact 7-item/+4-mais reference case"
    requirement: "AGD-09"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#um dia com 7 itens mostra 3 chips e o indicador +4 mais (caso de referência do esboço)"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#um dia com exatamente 3 itens mostra 3 chips e nenhum indicador de excedente"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#Pitfall 10: estreitar o agrupamento (simulando o filtro de vendedor) muda chips e excedente de forma coerente"
        status: pass
    human_judgment: false
  - id: D3
    description: "Clicking anywhere in a cell (including the +N mais indicator and on top of a chip) fires onSelecionarDia with that cell's date, even for other-month cells; the cell is keyboard-reachable (role=button, Enter/space) with an accessible label carrying the date and item count"
    requirement: "AGD-09"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#clicar numa célula dispara onSelecionarDia com a data certa, inclusive em célula de mês vizinho"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#clicar no indicador +N mais dispara a mesma seleção de dia que a célula"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#chips não têm papel de botão nem índice de tabulação próprio"
        status: pass
    human_judgment: false
  - id: D4
    description: "Chips reproduce AgendaItemRow's origin language (gray/clipboard for prospecção, blue/repeat for visita), and an atrasado item's red border-l accent is applied on top of — never instead of — the origin color, including at the visible/hidden boundary of an other-month cell (Pitfall 9)"
    requirement: "AGD-12"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#chip de prospecção é cinza e chip de visita é azul — mesma linguagem visual da Lista (AGD-12)"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#chip de item atrasado ganha o acento vermelho na borda sem apagar o ícone de origem"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#Pitfall 9: item atrasado em célula de mês vizinho mantém o acento vermelho legível mesmo com a célula esmaecida"
        status: pass
    human_judgment: false
  - id: D5
    description: "Today's cell highlight is derived purely from the received now prop (isSameDay), never the real clock; other-month fading is derived from isSameMonth against referencia — the two booleans are computed and applied independently"
    requirement: "AGD-09"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#a célula de hoje é destacada, derivada do now recebido"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#célula fora do mês visível é esmaecida"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-08-17
status: complete
---

# Phase 20 Plan 03: Month calendar view (grid, chips, overflow, atraso accent) Summary

**`AgendaCalendarioMes.tsx` — the 7-column/up-to-6-row month grid, with day cells capped at 3 item chips + a "+N mais" indicator, the prospecção/visita chip language reused from `AgendaItemRow`, and the atraso red accent proven to survive the other-month-cell fade — closing the three critical Pitfalls (8, 9, 10) this plan was isolated to test.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 (each split into RED test commit + GREEN implementation commit, per `tdd="true"`)
- **Files modified:** 2 (`components/agenda/AgendaCalendarioMes.tsx`, `tests/agenda/agenda-calendario-mes.test.tsx`), both new

## Accomplishments

- Month grid header and body both derive from `lib/agenda/itens.ts`'s pure functions (`rotulosDosDiasDaSemana`, `diasDaGradeDoMes`) — no hand-written weekday list, no local `startOfWeek`/`eachDayOfInterval` arithmetic, proven against the August 2026 (42-cell) and February 2026 (35-cell) cases.
- Each day cell carries two independently-named, independently-applied booleans (`noMesVisivel`, `ehHoje`) — closing Pitfall 9 from the first commit, not as an afterthought: an other-month cell fades its background/day-number, and today's cell gets the filled circle, with no shared boolean that could accidentally couple the two.
- `dividirCelula(itens, MAX_ITENS_NA_CELULA)` is called exactly once per cell; the visible chips and the "+N mais" count are destructured from that single result — proven against the sketch's exact reference case (a 7-item day renders 3 chips + "+4 mais") and against a Pitfall 10 regression test that narrows the day's item list (simulating a Supervisor's vendedor filter) and confirms both the chips and the overflow count change together and stay consistent.
- Chips reuse `AgendaItemRow`'s origin language (`ClipboardCheck`/gray for prospecção, `Repeat`/blue for visita) at reduced scale, with the atraso red `border-l-destructive` accent composed on top via `cn()`'s conflict resolution — proven not to erase the origin icon, and proven to stay legible even inside a faded other-month cell (Pitfall 9's cross-cutting case with the overflow logic).
- The entire cell (including the "+N mais" text) is the single click/keyboard target — `role="button"`, `tabIndex`, Enter/space handling, and an accessible label carrying the full weekday+date and item count. Chips themselves have no `onClick`, `role`, or `tabIndex` — a click on a chip bubbles to the cell's own handler.
- Today's highlight and month-membership faithfully derive from the `now`/`referencia` props received, never the real clock or local date math.

## Task Commits

Both tasks used `tdd="true"` (RED test commit → GREEN implementation commit):

1. **Task 1: Casca da grade — 7 colunas, células de dia, mês vizinho e destaque de hoje**
   - `6efb115` (test) — failing tests for the header/body grid, 42/35-cell cases, other-month/today state, click/keyboard, accessible label
   - `0671511` (feat) — grid shell implementation; 9/9 tests green
2. **Task 2: Chips por dia, indicador "+N mais" e acento de atraso dentro da célula**
   - `00e1109` (test) — failing tests for 0/1/3/7-item chip cases, the sketch's "+4 mais" reference, origin coloring, atraso accent, Pitfall 9 boundary case, Pitfall 10 narrowed-grouping case
   - `adf471d` (feat) — chip rendering, overflow indicator, atraso accent; 20/20 tests green

**Plan metadata:** committed separately below (docs commit).

## Files Created/Modified

- `components/agenda/AgendaCalendarioMes.tsx` — new client component: month grid header/body, `MonthDayCell` (grid cell with the two independent style booleans), `MonthItemChip` (origin color + atraso accent chip).
- `tests/agenda/agenda-calendario-mes.test.tsx` — new test file: 20 test cases across grid structure, cell state, chips/overflow, and the two Pitfall regressions.

## Decisions Made

- `MonthDayCell` was deliberately structured so Task 1 already wires `itensDoDia` and computes `itens.length` for the accessible label, even though it renders no chips yet — Task 2 then reuses that exact same `itens` array as the input to `dividirCelula`, so the "chips and count come from one computation" guarantee spans the whole component's history, not just the final commit.
- Chip text truncation uses `min-w-0 flex-1 truncate` on the inner `<span>` rather than any fixed width, so ellipsis works correctly inside the chip's flex row regardless of the cell's actual rendered width.
- Weekday-label test assertions target the unaccented `Sab` (not `Sáb`) form, matching the date-fns `EEEEEE` narrow-token output already documented in the 20-01 SUMMARY — kept consistent with that established behavior rather than re-deriving it.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria and the plan-level `<verification>` block (vitest for this file plus `agenda-item-row.test.tsx`/`agenda-list.test.tsx`/`itens.test.ts` unedited, `tsc --noEmit`, `eslint`, exactly 2 new files) pass.

## Issues Encountered

None. One test-authoring correction during Task 1 RED→GREEN: the accessible-label test initially expected a capitalized weekday name ("Sexta") and a `startsWith` match that collided with July 31 (also a Friday); fixed to match the actual lowercase date-fns output and to disambiguate by date substring instead of weekday alone — caught before the GREEN commit, no component behavior changed.

## User Setup Required

None — no external service configuration required. Pure presentational component, no database, no migration, no schema-push (per plan's `<important_notes>`).

## Next Phase Readiness

- Plan 20-04 (navigation bar / view wiring) can compose `AgendaCalendarioMes` directly against the published interface (`referencia`, `porData`, `onSelecionarDia`, `now`) alongside the already-built `AgendaCalendarioDia`/`AgendaCalendarioSemana` from plan 20-02, opening the day-list dialog on `onSelecionarDia`.
- No blockers. The three critical research risks this plan was isolated to cover — column desync between month/week (Pitfall 8), other-month fade swallowing an atrasado accent (Pitfall 9), and the "+N" count diverging from the vendedor filter (Pitfall 10) — are each closed and pinned by a dedicated test case.

---
*Phase: 20-calend-rio-da-agenda-m-s-semana-e-dia*
*Completed: 2026-08-17*

## Self-Check: PASSED

- FOUND: components/agenda/AgendaCalendarioMes.tsx
- FOUND: tests/agenda/agenda-calendario-mes.test.tsx
- FOUND: .planning/phases/20-calend-rio-da-agenda-m-s-semana-e-dia/20-03-SUMMARY.md
- FOUND commit: 6efb115 (test, Task 1)
- FOUND commit: 0671511 (feat, Task 1)
- FOUND commit: 00e1109 (test, Task 2)
- FOUND commit: adf471d (feat, Task 2)
