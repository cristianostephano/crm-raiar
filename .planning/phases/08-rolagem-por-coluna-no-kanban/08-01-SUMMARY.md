---
phase: 08-rolagem-por-coluna-no-kanban
plan: 01
subsystem: ui
tags: [react, nextjs, tailwind, dnd-kit, kanban, scroll]

# Dependency graph
requires:
  - phase: 02-cadastro-e-funil-de-vendas
    provides: KanbanBoard.tsx with DndContext, useDroppable/useSortable drag-and-drop, dragDisabled static branch
provides:
  - "ScrollColumnShell: reusable presentational Client Component for fixed-height, internally-scrolling containers"
  - "Both KanbanBoard.tsx render branches (dragDisabled static + DndContext draggable) now share identical fixed-height/scroll/fade structure"
  - "MeasuringStrategy.Always wired into DndContext for correct auto-scroll/collision detection with internally-scrolling droppables"
affects: [kanban, clientes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Droppable boundary (fixed-height outer container, setNodeRef) kept structurally separate from the scrollable inner list (overflow-y-auto), per dnd-kit Pitfall 12"
    - "Conditional scroll-fade indicator via scrollHeight/scrollTop/clientHeight check + ResizeObserver, guarded for jsdom (no ResizeObserver) and ssr"

key-files:
  created:
    - components/clientes/ScrollColumnShell.tsx
    - tests/clientes/kanban-scroll-column.test.tsx
  modified:
    - components/clientes/KanbanBoard.tsx

key-decisions:
  - "Column height formula calc(100vh-300px) min-h-[360px] confirmed correct against the real dev server (tested at two viewport heights, including the 360px floor)"
  - "Live physical drag-and-drop verification was NOT possible in this session (browser pane rendering limitation); approval was based on live DOM-level checks (height/scroll/fade/header) plus code-level review of setNodeRef placement and MeasuringStrategy.Always — flagged as a residual gap, not a passed manual drag test"

requirements-completed: [KAN-01, KAN-02]

coverage:
  - id: D1
    description: "Each of the 7 kanban columns gets a fixed, viewport-relative height (calc(100vh-300px), floor 360px) with its own internal vertical scroll instead of stretching the page"
    requirement: "KAN-01"
    verification:
      - kind: unit
        ref: "tests/clientes/kanban-scroll-column.test.tsx#renders a fixed-height outer container with children inside a scrollable inner div"
        status: pass
      - kind: manual_procedural
        ref: "Coordinator live DOM inspection: taller column scrollHeight (916px) > clientHeight (420px); page does not stretch"
        status: pass
    human_judgment: false
  - id: D2
    description: "All 7 columns share the same height regardless of card count (0, 1, or many cards) — height class never depends on clientes.length"
    requirement: "KAN-02"
    verification:
      - kind: unit
        ref: "tests/clientes/kanban-scroll-column.test.tsx#renders a fixed-height outer container with children inside a scrollable inner div"
        status: pass
      - kind: manual_procedural
        ref: "Coordinator live DOM inspection: identical height (420px, then 360px floor after resize) across 0/1/6-card columns"
        status: pass
    human_judgment: false
  - id: D3
    description: "Column header (title + count badge) stays visible outside the scrolling container while only the card list scrolls"
    verification:
      - kind: manual_procedural
        ref: "Coordinator live DOM inspection: header confirmed via previousElementSibling, outside the scroll container"
        status: pass
    human_judgment: false
  - id: D4
    description: "Subtle bottom scroll-fade indicator appears only when there is content below the fold and disappears at the end of scroll"
    verification:
      - kind: unit
        ref: "tests/clientes/kanban-scroll-column.test.tsx#renders a conditional fade sibling outside the scroll div, hidden by default in jsdom"
        status: pass
      - kind: manual_procedural
        ref: "Coordinator live DOM inspection: opacity-100 at top of scrollable column, flips to opacity-0 after scrollTop = scrollHeight"
        status: pass
    human_judgment: false
  - id: D5
    description: "Drag-and-drop between columns keeps working correctly with auto-scroll during drag (measuring Always + setNodeRef on the outer container, not the inner scroll div)"
    verification:
      - kind: other
        ref: "Grep sanity: MeasuringStrategy.Always present once on DndContext; setNodeRef passed as ScrollColumnShell's droppableRef on the outer fixed-height container (not the overflow-y-auto div) in DroppableColumn"
        status: pass
    human_judgment: true
    rationale: "A literal mouse-driven drag-to-bottom-with-auto-scroll interaction could not be exercised live in this session — the browser pane wasn't compositing/rendering visually (screenshot/computer-tool clicks failed with 'pane not displayed'), and a synthetic PointerEvent-based drag simulation did not trigger dnd-kit's internal sensor/drag state (a known limitation of synthetic pointer events against dnd-kit sensors, not evidence of a bug). The coordinator approved based on live DOM verification of everything else (D1-D4) plus code-level confirmation that the two things Pitfall 12 identifies as necessary for correct auto-scroll (measuring strategy + droppable/scroll separation) are both present. This is flagged as a residual gap for the coordinator to spot-check with a real mouse drag next time they're in the app normally."

# Metrics
duration: ~30min active execution (Tasks 1-2) + human verification checkpoint (Task 3)
completed: 2026-07-26
status: complete
---

# Phase 8 Plan 1: Rolagem por Coluna no Kanban Summary

**Each of the 7 kanban columns now has a fixed viewport-relative height (calc(100vh-300px), 360px floor) with its own internal scroll, a fixed header, and a conditional bottom fade, via a new reusable ScrollColumnShell component wired into both KanbanBoard.tsx render branches with dnd-kit's MeasuringStrategy.Always for correct drag auto-scroll.**

## Performance

- **Duration:** ~30 min active execution (Tasks 1-2, TDD); Task 3 was a blocking human-verify checkpoint completed separately by the coordinator
- **Started:** 2026-07-25T20:12:42Z
- **Completed:** 2026-07-26T01:14:24Z (includes checkpoint wait time)
- **Tasks:** 3/3 (Task 1 TDD red+green, Task 2 auto, Task 3 checkpoint:human-verify — approved)
- **Files modified:** 3 (1 created component, 1 created test, 1 modified component)

## Accomplishments
- New `ScrollColumnShell` presentational Client Component: fixed-height outer container (`h-[calc(100vh-300px)] min-h-[360px]`), single scrollable inner div (`min-h-0 flex-1 overflow-y-auto`), and a conditional bottom fade (`from-background`, `pointer-events-none`, `aria-hidden`) driven by a `scrollHeight - scrollTop - clientHeight > 1` check plus `ResizeObserver`.
- Both `KanbanBoard.tsx` render branches (the `dragDisabled` static branch and the `DndContext`-wrapped draggable branch) now render identical fixed-height, internally-scrolling columns — column height never depends on `clientes.length` (KAN-02).
- `DroppableColumn` moved `useDroppable`'s `setNodeRef` onto `ScrollColumnShell`'s outer fixed-height container (via the new `droppableRef` prop), keeping the droppable boundary structurally separate from the scrolling inner div, per `research/PITFALLS.md` Pitfall 12.
- `DndContext` gained `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` so dnd-kit re-measures droppable rects as a column auto-scrolls during a drag, instead of using a stale rect from drag start.
- Coordinator personally verified live in the browser (Supervisor login, real dev server, DOM-level inspection): equal column heights across all card counts including the 360px floor at a smaller viewport, genuine `scrollHeight > clientHeight` on a full column with no page-level stretch, no phantom scroll on empty/short columns, fade toggling `opacity-100`↔`opacity-0` correctly, and the header living outside the scroll container.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing structural contract test for ScrollColumnShell** - `1f8cd51` (test)
2. **Task 1 (GREEN): Implement ScrollColumnShell fixed-height scroll column** - `fb53f6b` (feat)
3. **Task 2: Wire ScrollColumnShell into both KanbanBoard render branches** - `1ac2d2a` (feat)
4. **Task 3: Human verification checkpoint** - approved by coordinator (no code commit; verification-only task)

**Plan metadata:** (this commit) `docs(08-01): complete rolagem por coluna no kanban plan`

_Note: Task 1 is TDD — two commits (test → feat), no refactor commit needed since the implementation matched the test contract on the first pass._

## Files Created/Modified
- `components/clientes/ScrollColumnShell.tsx` - Fixed-height, internally-scrolling column shell with conditional bottom fade; presentational only, no `@dnd-kit`/server-action imports so it stays independently testable
- `tests/clientes/kanban-scroll-column.test.tsx` - Structural contract test (outer container classes, single `overflow-y-auto` element with `min-h-0 flex-1`, fade sibling positioning and default-hidden state in jsdom)
- `components/clientes/KanbanBoard.tsx` - `MeasuringStrategy` added to the existing `@dnd-kit/core` import; `DroppableColumn` refactored to render `ScrollColumnShell` with `setNodeRef` on the outer container and a new `cardCount` prop; `dragDisabled` static branch's card-list wrapper replaced with `ScrollColumnShell`; `DndContext` gained the `measuring` prop

## Decisions Made
- Kept the UI-SPEC's exact class-string literals verbatim (`relative flex h-[calc(100vh-300px)] min-h-[360px] flex-col` on the outer container; `min-h-0 flex-1 overflow-y-auto flex flex-col gap-2` on the inner scroll div) rather than reordering utility classes, since no Tailwind class-sorting tool is configured in this repo to enforce a canonical order.
- `calc(100vh-300px)` was calibrated in the UI-SPEC against the current toolbar/header chrome and confirmed correct live by the coordinator at two different viewport heights (including the 360px floor engaging correctly) — no adjustment needed.

## Deviations from Plan

None - plan executed exactly as written. `DroppableColumn`'s signature gained a `cardCount` prop and the `dragDisabled` branch's wrapper div was replaced with `ScrollColumnShell`, both explicitly specified in the plan's Task 2 action steps.

## Issues Encountered

**Live drag-and-drop verification could not be performed with a literal mouse drag in this session.** The coordinator's browser pane was not compositing/rendering visually during the Task 3 checkpoint (screenshot and computer-tool clicks failed with "pane not displayed"), and a synthetic `PointerEvent`-based drag simulation did not trigger dnd-kit's internal sensor/drag state — a known limitation of synthetic pointer events against dnd-kit's sensor system, not evidence of a bug in this implementation. The coordinator approved the plan based on:
1. Live DOM-level verification of everything else (equal heights, real scroll/no-scroll per column, fade toggling correctly, header outside the scroll container).
2. Code-level confirmation that the two structural requirements Pitfall 12 identifies for correct dnd-kit auto-scroll are both present: `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` on `DndContext`, and `setNodeRef` living on `ScrollColumnShell`'s outer fixed-height container rather than the inner `overflow-y-auto` scroll div.

This is recorded above as `D5` with `human_judgment: true` and flagged as a residual gap — **the coordinator should spot-check an actual mouse drag-to-bottom-with-auto-scroll the next time they're in the app under normal conditions**, rather than treating this as a fully passed manual test.

**Worktree cleanup mid-execution:** This plan was dispatched with `isolation="worktree"`. Tasks 1-2 were executed and committed inside the isolated worktree (`worktree-agent-ae0a3fa1d8d9ae52c`, commits `1f8cd51`/`fb53f6b`/`1ac2d2a`). Between the Task 3 checkpoint being returned and the coordinator's approval, that worktree was merged into `master` and removed by the orchestrator's normal wave-cleanup flow — all three commits are present in `master`'s history unchanged. This SUMMARY and the remaining plan-completion steps (Task 3 close-out, STATE/ROADMAP/REQUIREMENTS updates, final metadata commit) were completed directly on `master` in the main checkout, per this plan's own "Worktree note" instruction to fall back to the current branch if no worktree materializes/persists.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 8 (KAN-01, KAN-02) is complete and requirements marked done in REQUIREMENTS.md.
- Phase 9 (Filtros Estado/Cidade, LOC) is independent of this phase per the v1.2 roadmap and can proceed in parallel.
- Residual gap: a real mouse-driven drag-to-bottom-with-auto-scroll test on `/clientes` is still recommended as a normal-use spot-check (see Issues Encountered / D5 above) — not a blocker, since the code-level structural requirements are in place and everything else was live-verified.

---
*Phase: 08-rolagem-por-coluna-no-kanban*
*Completed: 2026-07-26*
