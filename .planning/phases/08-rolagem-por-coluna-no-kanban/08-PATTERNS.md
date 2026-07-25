# Phase 8: Rolagem por Coluna no Kanban - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 1 (existing file, modified in place — no new files)
**Analogs found:** 1 / 1 (self-analog: the same file, both render branches mirror each other)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `components/clientes/KanbanBoard.tsx` | component (Client Component, layout/interaction change only — no new data flow) | CRUD-adjacent drag/drop (existing `onDragEnd` → `moverCard()` RPC), unaffected by this phase | `components/clientes/KanbanBoard.tsx` itself — the `dragDisabled` static branch (~L637-675) and the `DndContext` branch (~L677-726) are each other's analog; both need the identical structural change | exact (self-analog, no external file to copy from) |

There is no separate/new file to create. No other component in the codebase has a scroll-fade indicator or a `useDroppable` + fixed-height + `overflow-y-auto` combination to borrow from — the scroll-fade `onScroll`/`scrollHeight` pattern (UI-SPEC §3) is genuinely new to this codebase. Grep for `onScroll|scrollHeight|scrollTop` across `components/` returned no matches, and `MeasuringStrategy` appears nowhere in source yet (only in the planning docs).

## Pattern Assignments

### `components/clientes/KanbanBoard.tsx` (component, drag/drop + scroll)

**Analog:** itself — the two existing render branches are the pattern to replicate the change into, and the file's own established conventions (below) are what any new code must match.

**Imports pattern** (lines 3-20, current):
```typescript
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
```
Per UI-SPEC §4, add `MeasuringStrategy` to the existing `@dnd-kit/core` import (do not create a second import statement for the same module):
```typescript
import {
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
```

**Existing droppable-boundary pattern to extend** (`DroppableColumn`, lines 206-219):
```typescript
function DroppableColumn({
  etapaKey,
  children,
}: {
  etapaKey: EtapaKey
  children: ReactNode
}) {
  const { setNodeRef } = useDroppable({ id: etapaKey })
  return (
    <div ref={setNodeRef} className="flex min-h-10 flex-col gap-2">
      {children}
    </div>
  )
}
```
This is the exact insertion point named in CONTEXT.md's "Established Patterns" — `setNodeRef` currently sits on a plain `min-h-10` flex div with no fixed height and no internal scroll. Per UI-SPEC §2/§4, `setNodeRef` must move to (or stay on) the **outer** fixed-height container (`h-[calc(100vh-300px)] min-h-[360px]`), while a **new inner** `min-h-0 flex-1 overflow-y-auto` div (which does NOT carry `setNodeRef`) wraps `children`. The fade indicator (a third, absolutely-positioned sibling, `aria-hidden`, `pointer-events-none`) lives inside the same outer container, alongside the scrolling inner div — not inside it.

**Both render branches need the identical structural change** — this is the core "shared pattern" of this phase:

*Static/`dragDisabled` branch* (lines 637-675) — column body currently:
```typescript
<div className="flex min-h-10 flex-col gap-2">
  {clientes.length === 0 ? (
    <p className="px-1 text-sm text-muted-foreground">
      Nenhum cliente nesta etapa
    </p>
  ) : (
    clientes.map((cliente) => (
      <StaticClienteCard ... />
    ))
  )}
</div>
```
This branch has no `useDroppable`/`setNodeRef` at all (it's the non-draggable variant) — it only needs UI-SPEC §1/§2/§3 (fixed height, inner scroll div, fade), not §4 (no dnd-kit config applies here per UI-SPEC line 155: "the `dragDisabled` static branch needs §1–§3 only, no dnd-kit changes").

*`DndContext`/draggable branch* (lines 677-726) — column body currently routes through `DroppableColumn` (above) wrapped in `SortableContext`. This branch needs §1-§4: the `DroppableColumn` component's own JSX changes (moving `setNodeRef`, adding the inner scroll div and fade sibling), plus the `<DndContext ...>` opening tag (line 677-682) gains the `measuring` prop per UI-SPEC §4:
```typescript
<DndContext
  id="clientes-kanban"
  sensors={sensors}
  collisionDetection={closestCenter}
  measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
  onDragEnd={handleDragEnd}
>
```

**Empty-state pattern to preserve unchanged** (both branches, identical text):
```typescript
<p className="px-1 text-sm text-muted-foreground">
  Nenhum cliente nesta etapa
</p>
```
Per UI-SPEC §5, this renders inside the new inner scrollable div exactly as today — no conditional height shrink for empty columns (`clientes.length === 0` must NOT affect the outer container's height class).

**Column header pattern to preserve unchanged (must stay OUTSIDE the new scroll container)** (both branches, identical):
```typescript
<div className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2">
  <h2 className="text-base leading-tight font-semibold">
    {etapa.label}
  </h2>
  <Badge variant="outline" className="shrink-0">
    {clientes.length}
  </Badge>
</div>
```

**Error handling:** No new error paths in this phase — the existing `moverCard()` rollback-on-error flow (lines 404-488, `handleDragEnd`) and `showToast("error", ...)` helper (lines 349-352) are unaffected and must not be touched.

**Testing:** No existing test file found for `KanbanBoard.tsx` in the repo (`Glob` for `**/KanbanBoard*.test.*` / `**/*.spec.*` under `components/clientes` — none present). This phase is pure CSS/layout + one dnd-kit prop; per CLAUDE.md's "toda funcionalidade nova precisa de teste automatizado," treat the manual drag-and-drop verification steps in UI-SPEC §4 ("drag a card from top to bottom...") as the acceptance check, and prefer a lightweight Playwright/E2E check (matching the project's stated E2E use for drag-and-drop, per `.claude/CLAUDE.md`'s testing tools table) over a Vitest unit test, since the behavior under test (scroll + drag interaction) is DOM/layout-dependent.

---

## Shared Patterns

### Fixed-height droppable boundary + inner scroll (D-01/D-02, UI-SPEC §1-§2)
**Source:** New pattern, no existing analog — defined precisely in UI-SPEC.md §1-§2 (exact class strings given verbatim there: `h-[calc(100vh-300px)] min-h-[360px]` on the outer container, `min-h-0 flex-1 overflow-y-auto flex flex-col gap-2` on the inner).
**Apply to:** Both the `dragDisabled` branch (lines 637-675) and the `DndContext` branch (lines 677-726) — identically, per UI-SPEC's explicit instruction that "both render branches ... must receive the identical structural change."

### Scroll-fade indicator (D-03, UI-SPEC §3)
**Source:** New pattern, no existing analog in codebase. Exact markup given in UI-SPEC.md §3: `absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none transition-opacity duration-150 ease-out aria-hidden="true"`, toggled via `opacity-100`/`opacity-0` based on a `scrollHeight - scrollTop - clientHeight > 1` check on the inner scroll div (via `onScroll` + a mount/card-count-change check).
**Apply to:** Both branches — same conditional-visibility logic, same `from-background` color (never `from-secondary`/primary).

### dnd-kit measuring config for scroll-during-drag (Pitfall 12, UI-SPEC §4)
**Source:** New pattern, no existing analog — `MeasuringStrategy.Always` is not used anywhere in the codebase yet. Full detail and rationale in `.planning/research/PITFALLS.md` ("Milestone Addendum: v1.2") and UI-SPEC.md §4.
**Apply to:** Only the `DndContext` branch (lines 677-726) — the `<DndContext>` opening tag and the `DroppableColumn` component's `setNodeRef` placement.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Scroll-fade indicator sub-pattern within `KanbanBoard.tsx` | UI affordance (decorative) | event-driven (scroll listener) | No component in the codebase currently listens to `onScroll`/reads `scrollHeight`/`scrollTop`/`clientHeight` — grep across `components/` returned zero matches. UI-SPEC.md §3 is the authoritative source instead of a codebase analog. |
| `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` dnd-kit config | dnd-kit configuration | N/A | Not used anywhere in the repo yet; `.planning/research/PITFALLS.md` (Milestone Addendum v1.2, Pitfall 12) and UI-SPEC.md §4 are the sources of truth. |

## Metadata

**Analog search scope:** `components/` (Grep for `onScroll|scrollHeight|scrollTop`), whole repo (Grep for `MeasuringStrategy`), full read of `components/clientes/KanbanBoard.tsx` (756 lines, single pass).
**Files scanned:** 1 target file (full read) + 2 codebase-wide greps (no hits) + `.planning/research/PITFALLS.md` and `08-UI-SPEC.md` referenced as authoritative sources where no codebase analog exists.
**Pattern extraction date:** 2026-07-25
