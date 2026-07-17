---
phase: 02-cadastro-e-gest-o-de-clientes-pj
plan: 04
subsystem: ui
tags: [dnd-kit, kanban, date-fns, funil, server-actions, supabase-rpc]

# Dependency graph
requires:
  - phase: 02-cadastro-e-gest-o-de-clientes-pj/02-03
    provides: "KanbanBoard (static 7-column layout), ClienteCard with its full forward-looking prop contract (dragHandleProps/isOverdue/overdueTooltip inert slots)"
  - phase: 02-cadastro-e-gest-o-de-clientes-pj/02-01
    provides: "mover_card_funil RPC, clientes.posicao/etapa_alterada_em columns, chk_ganho_somente_etapa_final CHECK constraint"
provides:
  - "Interactive kanban: cards drag (mouse/touch/keyboard) between the 7 funil stages, persisted via moverCard() over mover_card_funil, with optimistic update + rollback-on-error"
  - "lib/funil/staleness.ts — diasParado/isParado/tarefaAtrasada/staleReason pure functions, unit-tested, feeding the FUN-09 amber highlight"
  - "getClientesAgrupadosPorEtapa() now also returns posicao (for drop midpoint math), etapa_alterada_em, and precomputed isOverdue/overdue_tooltip per cliente"
affects: [02-05, 02-06, 02-07]

# Tech tracking
tech-stack:
  added: ["@dnd-kit/core@6.3.1", "@dnd-kit/sortable@10.0.0", "@dnd-kit/utilities@3.2.2", "date-fns@4.4.0", "shadcn tooltip (@base-ui/react tooltip primitive)"]
  patterns:
    - "Kanban columns are BOTH a dnd-kit useDroppable target (id = etapa key, catches drops on empty column space) AND wrap a SortableContext of card ids (useSortable per card) — the same dual-droppable pattern as dnd-kit's official multi-container example, needed because a single container-only or item-only droppable can't resolve both 'drop on empty column' and 'drop between/onto cards'"
    - "Fractional position math lives in the client (computeNovaPosicao: midpoint of neighbor `posicao` values, or now-epoch at an empty target) — the RPC just writes whatever numeric value it's given, so the single-row-write guarantee (Pitfall 5) depends on the caller never renumbering siblings, not on server-side logic"
    - "moverCard's own pre-check SELECT (fetching status_acompanhamento to guard the ganho edge case) is intentionally scoped by the exact same RLS policy as the UPDATE it's about to trigger — a non-owned clienteId returns no row and the action fails closed BEFORE calling the RPC, which is also how T-02-13 (cross-vendedor move) is mitigated, with no extra code"
    - "Staleness (FUN-09) is computed server-side once per row at fetch time (in getClientesAgrupadosPorEtapa) AND recomputed client-side after an optimistic drag (KanbanBoard resets etapa_alterada_em to now() on a real stage change, mirroring the DB trigger) — keeps the highlight from showing stale data mid-session without a refetch"

key-files:
  created:
    - app/actions/funil.ts
    - lib/funil/staleness.ts
    - tests/clientes/staleness.test.ts
    - components/ui/tooltip.tsx
  modified:
    - components/clientes/KanbanBoard.tsx
    - components/clientes/ClienteCard.tsx
    - lib/supabase/queries/clientes.ts
    - app/layout.tsx

key-decisions:
  - "No toast/notification library was installed — the plan's copy calls the drag success/error feedback a 'toast', but Task 1's own install list only covers dnd-kit + date-fns + shadcn tooltip (no sonner or similar). Built a small self-contained transient banner (local useState + setTimeout, role=status/alert) inside KanbanBoard instead of adding an unapproved new npm dependency mid-task — consistent with the project's zero-new-dependency-without-discussion rule and the existing 02-02 pattern (inline role=alert message, no toast library there either)."
  - "computeNovaPosicao is deliberately simple (fixed +/-1 offsets when there's no neighbor on one side) rather than a general-purpose fractional-indexing library — sufficient for a single sales team's pipeline size; if positions ever get too tight after many reorders, a rebalance migration (flagged in research/PITFALLS.md) is the documented escape hatch, not a library swap."
  - "posicao and etapa_alterada_em (previously server-only columns) are now also selected and typed on ClienteListItem — needed client-side for the drop midpoint math and the staleness recompute-after-drag; not listed in the plan's frontmatter files_modified but required by the plan's own Task 1/Task 2 action text, so added as an in-scope extension of lib/supabase/queries/clientes.ts rather than a new file."

requirements-completed: [FUN-02, FUN-03, FUN-09]

coverage:
  - id: D1
    description: "A Vendedor drags one of their own cards to another stage and it persists after refresh; a Supervisor can drag any vendedor's card"
    requirement: "FUN-02"
    verification:
      - kind: other
        ref: "Source assertion: moverCard() calls supabase.rpc('mover_card_funil', ...) — no raw .from('clientes').update() for stage moves. RLS on the clientes UPDATE (from 02-01) is the real scoping boundary; the action's pre-check SELECT shares that same policy."
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: drag as Vendedor A (own card) and as Supervisor (another vendedor's card), confirm persistence after refresh"
        status: unknown
    human_judgment: true
    rationale: "Requires a live login as Vendedor A and Supervisor against real RLS — deferred to config.json's human_verify_mode: end-of-phase batch, per this project's established pattern (see 02-03-SUMMARY.md)."
  - id: D2
    description: "Keyboard and touch drag both work, not mouse-only"
    requirement: "FUN-03"
    verification:
      - kind: other
        ref: "Source assertion: KanbanBoard's useSensors registers PointerSensor, TouchSensor, and KeyboardSensor (with sortableKeyboardCoordinates) — not pointer-only."
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: focus a card and drive a keyboard-only move; attempt a touch drag on a touch device/emulator"
        status: unknown
    human_judgment: true
    rationale: "Real assistive-input ergonomics need a human driving an actual keyboard/touch session, deferred to end-of-phase batch."
  - id: D3
    description: "Dropping a card writes exactly one row (fractional posicao midpoint), never a renumber cascade"
    verification:
      - kind: other
        ref: "Source assertion: KanbanBoard's handleDragEnd computes a single novaPosicao via computeNovaPosicao(before, after) and calls moverCard once per drop — no loop reassigning sibling posicao values."
        status: pass
    human_judgment: false
  - id: D4
    description: "Dragging a 'ganho' card out of the final stage is rejected with a friendly message and the card rolls back"
    requirement: "FUN-05 (backstop)"
    verification:
      - kind: other
        ref: "Source assertion: moverCard returns { error: { code: 'ganho_travado' } } when status_acompanhamento === 'ganho' and novaEtapa !== 'primeira_venda', before calling the RPC; KanbanBoard's handleDragEnd reverts grouped state to previousGrouped on any error."
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: seed/find a ganho card in the final stage and attempt to drag it to another column"
        status: unknown
    human_judgment: true
    rationale: "Needs a real ganho-status card and a live drag attempt to observe the rollback + message end-to-end; deferred to end-of-phase batch."
  - id: D5
    description: "A stalled (>=7 days, no stage change) or overdue-task card shows the amber highlight immediately on load, with the task-overdue tooltip copy taking precedence when both conditions apply"
    requirement: "FUN-09"
    verification:
      - kind: unit
        ref: "tests/clientes/staleness.test.ts — 13/13 passing, covers isParado at/around DIAS_PARADO_ALERTA=7, tarefaAtrasada (overdue/due-today/completed/no-due-date), and staleReason's task-wins-over-parado precedence"
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: open the board with a seeded stalled/overdue card, confirm the amber border + icon + tooltip copy render with no hover needed to reveal them"
        status: unknown
    human_judgment: true
    rationale: "Visual highlight placement/contrast and tooltip-on-hover behavior need a human looking at the rendered board; deferred to end-of-phase batch."
  - id: D6
    description: "npx tsc --noEmit, npm run lint, and npm run build all pass"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (clean), npm run lint (zero issues in files this plan touched — all reported issues pre-existing in unrelated .claude/ tooling scripts), npm run build (Compiled successfully, /clientes route listed)"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-07-17
status: complete
---

# Phase 2 Plan 4: Interactive Kanban Drag + Stalled/Overdue Highlight Summary

**Cards now drag between the 7 funil stages (mouse/touch/keyboard) via dnd-kit, persisted through the `mover_card_funil` RPC with optimistic update + rollback, and stalled/overdue cards light up an amber highlight on load using pure date-fns logic in `lib/funil/staleness.ts`.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-17
- **Tasks:** 2/2 (Task 0's package-legitimacy checkpoint approved by the project owner before install)
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- **Drag-and-drop kanban (FUN-02/FUN-03):** `KanbanBoard` is now a Client Component wrapped in a dnd-kit `DndContext` with `PointerSensor` + `TouchSensor` + `KeyboardSensor` (Pitfall 6 — not mouse-only). Each column is a `useDroppable` target; each card is a `useSortable` item using the `dragHandleProps` slot 02-03 already reserved on `ClienteCard`. Dropping a card optimistically reorders local state, computes a single fractional `posicao` (midpoint of the target column's neighbors, or now-epoch if the target is empty — Pitfall 5, never a renumber cascade), and calls the new `moverCard()` Server Action.
- **`app/actions/funil.ts`:** `moverCard(clienteId, novaEtapa, novaPosicao)` calls `supabase.rpc('mover_card_funil', ...)` — never a raw UPDATE. Its pre-check `SELECT status_acompanhamento` (needed to guard the "ganho" edge case) is scoped by the same RLS policy as the underlying UPDATE, so a Vendedor's attempt to move a non-owned card fails closed with `cliente_nao_encontrado` before the RPC is ever called (T-02-13, no extra code needed beyond the guard already required for FUN-05). Dragging a `ganho` card out of `primeira_venda` returns `ganho_travado` with a friendly message instead of letting the DB `CHECK` constraint throw (T-02-14) — the constraint remains the real backstop.
- **Stalled/overdue highlight (FUN-09):** `lib/funil/staleness.ts` exports pure, unit-tested functions — `diasParado`, `isParado` (threshold `DIAS_PARADO_ALERTA = 7`, Claude's discretion per the plan), `tarefaAtrasada`, and `staleReason` (task-overdue copy wins over stage-stalled copy when both apply, per the UI-SPEC copywriting contract). `getClientesAgrupadosPorEtapa()` now also selects `etapa_alterada_em` and each cliente's open `tarefas` (tipo + `data_conclusao`), computing `isOverdue`/`overdue_tooltip` once per row so the highlight is visible on first render, no interaction needed. `ClienteCard`'s `TriangleAlert` is now wrapped in the shadcn `Tooltip` (installed this plan) instead of a plain `aria-label`.
- **Consistency after a drag:** when a card's stage actually changes, `KanbanBoard` resets its local `etapa_alterada_em` to "now" (mirroring the `clientes_before_update` trigger from 02-01) and recomputes `staleReason` client-side, so the "parado" highlight doesn't show stale data mid-session while an overdue open tarefa still keeps the highlight on regardless of the stage move.

## Task Commits

Each task was committed atomically (Task 2 followed the RED → GREEN TDD gate sequence):

1. **Task 1: dnd-kit drag + moverCard RPC** - `e68a2ee` (feat)
2. **Task 2 (RED): failing staleness test** - `5df609f` (test)
3. **Task 2 (GREEN): staleness implementation + wiring** - `7288b7b` (feat)

## Files Created/Modified

- `app/actions/funil.ts` - `moverCard()` Server Action over `mover_card_funil`
- `lib/funil/staleness.ts` - `diasParado`/`isParado`/`tarefaAtrasada`/`staleReason`/`DIAS_PARADO_ALERTA`
- `tests/clientes/staleness.test.ts` - 13 unit tests (threshold edges, task precedence, completed-task exclusion)
- `components/ui/tooltip.tsx` - shadcn tooltip primitive (installed via CLI)
- `components/clientes/KanbanBoard.tsx` - DndContext, droppable columns, sortable/draggable cards, optimistic move + rollback, transient toast banner
- `components/clientes/ClienteCard.tsx` - overdue `TriangleAlert` now wrapped in `Tooltip`/`TooltipTrigger`/`TooltipContent`
- `lib/supabase/queries/clientes.ts` - selects/returns `posicao`, `etapa_alterada_em`, open `tarefas`, precomputed `isOverdue`/`overdue_tooltip`
- `app/layout.tsx` - wraps the app in `TooltipProvider`

## Decisions Made

- No toast library installed — built a small local transient banner in `KanbanBoard` instead of adding `sonner`/similar mid-task without a legitimacy checkpoint of its own (see key-decisions above for full rationale).
- `computeNovaPosicao` uses simple ±1 offsets at column edges rather than a general fractional-indexing library — sufficient at this scale; a rebalance migration is the documented escape hatch if positions ever get too tight.
- Extended `lib/supabase/queries/clientes.ts` (not listed in the plan's frontmatter `files_modified`) to select `posicao`/`etapa_alterada_em`/open `tarefas` — required by the plan's own Task 1/Task 2 action text to compute the drop midpoint and the staleness highlight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `posicao` to the client-facing query/type so the drop midpoint could be computed**
- **Found during:** Task 1
- **Issue:** `ClienteListItem`/`getClientesAgrupadosPorEtapa()` didn't select or expose `posicao`, but the drag handler cannot compute a fractional midpoint without the real neighbor position values.
- **Fix:** Added `posicao` to the select string, `ClienteRow`, and `ClienteListItem`.
- **Files modified:** `lib/supabase/queries/clientes.ts`
- **Verification:** `npx tsc --noEmit` clean; `npm run build` succeeds.
- **Committed in:** `e68a2ee` (Task 1 commit)

**2. [Rule 3 - Blocking] Added `etapa_alterada_em` + open `tarefas` embed for the staleness query**
- **Found during:** Task 2
- **Issue:** Task 2's action explicitly requires fetching each cliente's open tarefas and stage-change timestamp to compute `staleReason`, but neither was in the existing select.
- **Fix:** Added `etapa_alterada_em` and a `tarefas(concluida, data_conclusao, tipos_tarefa(nome))` embed to the query, filtered to open tarefas in the mapping loop, and computed `isOverdue`/`overdue_tooltip` once per row.
- **Files modified:** `lib/supabase/queries/clientes.ts`
- **Verification:** `tests/clientes/staleness.test.ts` 13/13 pass; `npm run build` succeeds.
- **Committed in:** `7288b7b` (Task 2 GREEN commit)

**3. [Rule 2 - Missing Critical] Built a minimal local toast instead of skipping user feedback on move success/failure**
- **Found during:** Task 1
- **Issue:** The plan repeatedly calls for a "toast" on drag success/error, but Task 1's install list has no toast/notification library and none exists in the codebase yet.
- **Fix:** Added a small `useState`-backed transient banner (`role="status"`/`"alert"`, auto-dismiss after 4s) inside `KanbanBoard`, rather than silently dropping the feedback requirement or installing an unapproved new dependency mid-task.
- **Files modified:** `components/clientes/KanbanBoard.tsx`
- **Verification:** Manual code review; renders the exact copy from the UI-SPEC ("Card movido para \"{etapa}\".") on success, the action's error message on failure.
- **Committed in:** `e68a2ee` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing-critical)
**Impact on plan:** All three were necessary to fulfill the plan's own stated task behavior (fractional-position math, staleness data, and user-visible move feedback) without introducing an unapproved dependency or an architectural change. No scope creep beyond what Task 1/Task 2 already asked for.

## Issues Encountered

None — Task 0's [BLOCKING-HUMAN] package-legitimacy checkpoint (dnd-kit ×3 + date-fns) was surfaced per protocol, approved by the project owner, and install proceeded normally. No genuine @dnd-kit API unknowns blocked progress; the multi-container droppable-column + sortable-card pattern matched the dnd-kit official "multiple containers" example referenced in `research/PITFALLS.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `moverCard()` and the drag/optimistic-rollback pattern are reusable as-is by later plans that also mutate `clientes` from the client (e.g. 02-07's status/perdido transitions can follow the same pre-check-then-RPC shape).
- `isOverdue`/`overdue_tooltip` are now real, precomputed data (no longer always-`false` placeholders) — 02-05's "Incompleto" badge work and 02-06's detail sheet can rely on `ClienteListItem` carrying both without recomputing.
- End-to-end manual verification (drag as Vendedor/Supervisor incl. keyboard/touch, ganho-lock rollback, overdue highlight rendering) is deferred to the end-of-phase human-check batch per `config.json`'s `human_verify_mode: end-of-phase` — not a blocker for continuing to 02-05/02-06/02-07.
- Known limitation, not a blocker: `dragHandleProps`' keyboard listeners (spread last onto `ClienteCard`) now take precedence over the card's own `onKeyDown` (Enter/Space → `onOpen`). Since `onOpen` isn't wired by any caller yet (02-06 builds the detail sheet), this has no current effect, but 02-06 should verify Enter/Space still opens the sheet once both concerns are live together — a non-drag "open" affordance (e.g. a double-click or an explicit open icon) may be worth considering if keyboard conflicts surface then.

---
*Phase: 02-cadastro-e-gest-o-de-clientes-pj*
*Completed: 2026-07-17*

## Self-Check: PASSED

All 8 created/modified files verified present on disk (`app/actions/funil.ts`, `lib/funil/staleness.ts`, `tests/clientes/staleness.test.ts`, `components/ui/tooltip.tsx`, `components/clientes/KanbanBoard.tsx`, `components/clientes/ClienteCard.tsx`, `lib/supabase/queries/clientes.ts`, `app/layout.tsx`); all three task commit hashes (`e68a2ee`, `5df609f`, `7288b7b`) confirmed present in `git log`.
