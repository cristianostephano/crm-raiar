---
phase: 260722-hpe
plan: 01
subsystem: ui
tags: [react, nextjs, tailwind, kanban, vitest]

requires: []
provides:
  - "Light-red 'Incompleto' badge (destructive badge variant) on kanban cards"
  - "Wrapping (non-truncated) kanban column headers, both drag-enabled and drag-disabled render branches"
  - "taskStatus() pure function classifying a cliente's open tasks into none/on_time/late"
  - "Always-visible 3-color kanban card left border driven by taskStatus"
affects: [clientes, kanban, funil]

tech-stack:
  added: []
  patterns:
    - "Card left-border color is a lookup table keyed off a TaskStatus union, computed once in toCardData() and threaded through ClienteCardData so every render branch (Draggable/Static) shares one source of truth"

key-files:
  created: []
  modified:
    - components/clientes/ClienteCard.tsx
    - components/clientes/KanbanBoard.tsx
    - lib/funil/staleness.ts
    - tests/clientes/staleness.test.ts

key-decisions:
  - "Reused the existing destructive Badge variant (bg-destructive/10 text-destructive) for the Incompleto badge instead of introducing a new token"
  - "taskStatus() reuses tarefaAtrasada() rather than reimplementing overdue math, so the new left border and the pre-existing TriangleAlert tooltip can never disagree on what counts as 'atrasado'"
  - "Column header font size reduced from text-xl to text-base (with leading-tight) to make two-line wrapping fit comfortably inside the fixed 280px column width"

patterns-established:
  - "Pure classification functions in lib/funil/staleness.ts stay the single source of truth for any date/task-derived visual signal on a kanban card"

requirements-completed: [POLISH-01, POLISH-02, POLISH-03]

coverage:
  - id: D1
    description: "Incompleto badge renders light-red via the destructive Badge variant"
    requirement: POLISH-01
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (type-level: Badge variant prop is a literal union, destructive is valid)"
        status: pass
    human_judgment: true
    rationale: "Pure visual/color-perception change with no unit-testable behavior; needs a human to eyeball the actual light-red rendering in the browser (Task 4 checkpoint)."
  - id: D2
    description: "Long kanban column titles wrap onto two lines instead of being truncated with an ellipsis, in both the drag-enabled and drag-disabled render branches"
    requirement: POLISH-02
    verification: []
    human_judgment: true
    rationale: "Pure CSS/layout change (Tailwind classes only); correctness is only observable by looking at a long title actually wrapping in the 280px column at the real viewport (Task 4 checkpoint)."
  - id: D3
    description: "taskStatus() pure function classifies open tasks into none/on_time/late and reuses tarefaAtrasada"
    requirement: POLISH-03
    verification:
      - kind: unit
        ref: "tests/clientes/staleness.test.ts#taskStatus"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every kanban card renders an always-visible 3-color left border (green/amber/red) driven by taskStatus, with the pre-existing TriangleAlert tooltip left unchanged as a separate signal"
    requirement: POLISH-03
    verification:
      - kind: unit
        ref: "tests/clientes/staleness.test.ts#taskStatus (proves the underlying classification; wiring into ClienteCard/KanbanBoard confirmed by npx tsc --noEmit)"
        status: pass
    human_judgment: true
    rationale: "The border's actual on-screen color per card, and confirmation the old isOverdue-only amber border is fully gone, requires visual verification in the browser across cards with different task states (Task 4 checkpoint)."

duration: 25min
completed: 2026-07-22
status: complete
---

# Quick Task 260722-hpe: Kanban Card Polish (badge, wrapping titles, 3-color border) Summary

**Light-red Incompleto badge, wrapping (non-truncated) column headers, and a new `taskStatus()`-driven 3-color kanban card left border (green/amber/red).**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-22T12:53:00Z (approx, first tsc run)
- **Completed:** 2026-07-22T15:55:59Z
- **Tasks:** 3 of 4 completed (Task 4 is a `checkpoint:human-verify` — pending, see below)
- **Files modified:** 4

## Accomplishments

- "Incompleto" badge now uses the `destructive` variant (light-red, `bg-destructive/10 text-destructive`) instead of the neutral `outline` treatment.
- Kanban column headers (both the drag-disabled and DndContext render branches) no longer truncate with an ellipsis: the `<h2>` dropped `truncate`/`text-xl` for `text-base leading-tight font-semibold`, and the header row switched to `items-start` so the count badge stays pinned to the top-right when a title wraps to two lines.
- New `taskStatus()` pure function in `lib/funil/staleness.ts` classifies a cliente's open tasks into `"none" | "on_time" | "late"`, reusing the existing `tarefaAtrasada()` for the overdue check. `ClienteCardData` now carries `taskStatus`, and the `Card` root's left border is keyed off it via a lookup table (`green-500` / `amber-500` / `red-500`), replacing the old `isOverdue`-only amber border. `KanbanBoard.toCardData()` computes it once from `cliente.tarefas_abertas`, so both `DraggableClienteCard` and `StaticClienteCard` get the border with no per-branch prop change. The pre-existing `isOverdue` prop and `TriangleAlert` tooltip block are untouched — they remain the separate "parado/atrasado" reason indicator.

## Task Commits

Each task was committed atomically:

1. **Task 1: Light-red "Incompleto" badge** - `82b52c1` (feat)
2. **Task 2: Wrap long column titles instead of truncating** - `ad758bc` (feat)
3. **Task 3: Always-visible 3-color task-status left border** - `ba2c5a0` (test, RED) → `0f2b7d2` (feat, GREEN)

**Plan metadata:** not yet committed (SUMMARY.md is intentionally left uncommitted per the orchestrator's worktree-cleanup handoff — see Deviations).

_TDD note: Task 3 followed the RED → GREEN cycle. `ba2c5a0` added the four failing `taskStatus` test cases (confirmed failing with `TypeError: taskStatus is not a function` before implementation); `0f2b7d2` implemented `taskStatus()` plus the `ClienteCard`/`KanbanBoard` wiring and all 17 tests in `staleness.test.ts` (13 pre-existing + 4 new) passed. No REFACTOR commit was needed — the implementation matched the minimal shape on first pass._

## TDD Gate Compliance

- RED gate: `ba2c5a0 test(260722-hpe-03): add failing tests for taskStatus` — confirmed failing (`taskStatus is not a function`) before any implementation.
- GREEN gate: `0f2b7d2 feat(260722-hpe-03): always-visible 3-color task-status card border` — all 17 tests in `tests/clientes/staleness.test.ts` pass after this commit.
- REFACTOR gate: not needed/not present — implementation was minimal and correct on first pass.

## Files Created/Modified

- `components/clientes/ClienteCard.tsx` - Incompleto badge variant `outline` → `destructive`; added `taskStatus: TaskStatus` to `ClienteCardData`; `Card` root left border now keyed off `cliente.taskStatus` via a `TASK_STATUS_BORDER` lookup (green/amber/red), replacing the old `isOverdue`-only amber border; `isOverdue`/TriangleAlert tooltip unchanged.
- `components/clientes/KanbanBoard.tsx` - Both column-header blocks (`dragDisabled` branch and `DndContext` branch) switched `items-center` → `items-start` and the `<h2>` from `truncate text-xl font-semibold` → `text-base leading-tight font-semibold`; imported `taskStatus` from `lib/funil/staleness`; `toCardData()` now sets `taskStatus: taskStatus(cliente.tarefas_abertas)`.
- `lib/funil/staleness.ts` - Added exported `TaskStatus` union type and `taskStatus()` pure function (none/on_time/late), colocated right after `tarefaAtrasada`.
- `tests/clientes/staleness.test.ts` - Added a `describe("taskStatus")` block with 4 cases: empty array → `"none"`, one on-time open task → `"on_time"`, one overdue open task → `"late"`, mixed on-time+overdue → `"late"`.

## Decisions Made

- Reused the existing `destructive` Badge variant for the Incompleto badge rather than introducing a new color token — it already resolves to the requested light-red treatment and is one of the three variants the UI-SPEC allows on this card.
- Reduced the column header font from `text-xl` to `text-base` (with `leading-tight`) so a two-line-wrapped long title fits comfortably inside the fixed 280px column width without visually dominating the column.

## Deviations from Plan

None - plan executed exactly as written for Tasks 1-3.

**Note on SUMMARY.md handling:** per this quick task's execution constraints, this SUMMARY.md is being left as an uncommitted/untracked file in the worktree (not committed by this agent) so the orchestrator can commit it after the worktree cleanup merge, avoiding a dirty-working-tree block on that merge.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Tasks 1-3 are code-complete: `npx vitest run tests/clientes/staleness.test.ts` (17/17 pass), `npx tsc --noEmit` (clean), `npx eslint components/clientes/ClienteCard.tsx components/clientes/KanbanBoard.tsx lib/funil/staleness.ts tests/clientes/staleness.test.ts` (clean), and `npm run build` (succeeds) were all run and pass.
- **Task 4 (`checkpoint:human-verify`, gate="blocking") is still pending** — it requires the coordinator to visually verify, in the running browser, both as Supervisor and as Vendedor:
  1. The Incompleto badge renders light-red (not a plain outline).
  2. The long column title "Aguardando aprovação final do cliente/comitê" (and any other long title) wraps onto two lines with no ellipsis, with the count badge sitting top-right.
  3. Left borders read correctly across cards: green (on-time open task) / amber (overdue open task) / red (no open task scheduled) — visible on every card, not just "problem" ones.
  4. The pre-existing "parado/atrasado" TriangleAlert tooltip still appears where it did before.
- This executor did not self-approve Task 4 and made no claim of visual/browser verification — that confirmation is explicitly reserved for the coordinator per the plan's `resume-signal`.

---
*Phase: 260722-hpe*
*Completed: 2026-07-22*

## Self-Check: PASSED

- FOUND: components/clientes/ClienteCard.tsx
- FOUND: components/clientes/KanbanBoard.tsx
- FOUND: lib/funil/staleness.ts
- FOUND: tests/clientes/staleness.test.ts
- FOUND: .planning/quick/260722-hpe-kanban-card-polish-light-red-incompleto-/260722-hpe-SUMMARY.md
- FOUND commit: 82b52c1 (Task 1)
- FOUND commit: ad758bc (Task 2)
- FOUND commit: ba2c5a0 (Task 3 RED)
- FOUND commit: 0f2b7d2 (Task 3 GREEN)
