---
phase: 02-cadastro-e-gest-o-de-clientes-pj
plan: 03
subsystem: frontend
tags: [next-js, react-server-components, shadcn, kanban]

# Dependency graph
requires:
  - phase: 02-cadastro-e-gest-o-de-clientes-pj/02-02
    provides: getClientesAgrupadosPorEtapa (RLS-scoped read), /clientes page shell, ClienteQuickCreateForm
provides:
  - ClienteCard (components/clientes/ClienteCard.tsx) — compact presentational kanban card with its complete forward-looking prop contract (showResponsavel, incompleto, isOverdue, overdueTooltip, onOpen, dragHandleProps)
  - KanbanBoard (components/clientes/KanbanBoard.tsx) — 7 fixed columns derived from ETAPAS, static (no drag yet)
  - getClientesAgrupadosPorEtapa() now returns categoria_nome/responsavel_nome via to-one embeds
affects: [02-04, 02-05, 02-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PostgREST to-one embed syntax (`categorias(nome)`, `profiles(nome, sobrenome)`) used directly in a `.select()` string, since both FKs live on `clientes` itself and are unambiguous — no `!fkey` hint needed, no separate lookup query"
    - "ClienteCard's prop contract is locked in this plan: `incompleto`/`isOverdue`/`overdueTooltip`/`onOpen`/`dragHandleProps` all exist now as inert/optional props, so 02-04 (drag)/02-05 (incompleto+overdue data)/02-06 (detail sheet) only ever pass new prop values, never restructure the component"

key-files:
  created:
    - components/clientes/ClienteCard.tsx
    - components/clientes/KanbanBoard.tsx
  modified:
    - lib/supabase/queries/clientes.ts
    - app/(app)/clientes/page.tsx

key-decisions:
  - "Quick-action icon row (phone/WhatsApp/calendar) from the UI-SPEC's screen-level notes was NOT built in this plan — the plan's Task 1 action description and acceptance criteria only require razão social, categoria badge, responsável line, Incompleto badge slot, and overdue slot; the icon row has no wiring target yet (telefone links) and is left for a later plan to avoid building dead UI"
  - "isOverdue's TriangleAlert icon uses a native `aria-label` (no tooltip primitive) since `components/ui/tooltip.tsx` isn't installed yet and this plan's isOverdue is always false (data lands in 02-04) — no functional loss, revisit when overdue data is wired"

requirements-completed: [FUN-01, CLI-04]

coverage:
  - id: D1
    description: "Opening /clientes shows the 7 fixed funnel stages as columns in order, each client rendered as a compact card in its current stage's column"
    requirement: "FUN-01"
    verification:
      - kind: other
        ref: "Source assertion: KanbanBoard.tsx maps over ETAPAS (lib/funil/etapas.ts) — no hardcoded stage array in the component. npm run build succeeded, /clientes route listed."
        status: pass
    human_judgment: false
  - id: D2
    description: "Each card shows razão social prominently (16px/600, truncate 1 line) and its categoria at a glance without opening the client"
    requirement: "D-03/D-04"
    verification:
      - kind: other
        ref: "Source assertion: ClienteCard.tsx CardTitle uses `text-base font-semibold` (16px/600) with `truncate`; categoria rendered as `Badge variant=\"outline\"`."
        status: pass
    human_judgment: false
  - id: D3
    description: "A Supervisor's cards also show the responsável's name; a Vendedor's cards omit it"
    requirement: "CLI-04"
    verification:
      - kind: other
        ref: "Source assertion: KanbanBoard passes showResponsavel = (callerRole === 'supervisor') into every ClienteCard; ClienteCard only renders the responsavelNome line when showResponsavel is true."
        status: pass
    human_judgment: false
  - id: D4
    description: "No --primary/text-primary/bg-primary class on the categoria or status badge"
    verification:
      - kind: other
        ref: "Source assertion: grep for \"primary\" in ClienteCard.tsx only matches a doc comment, no className usage."
        status: pass
    human_judgment: false
  - id: D5
    description: "npx tsc --noEmit, npm run lint, and npm run build all pass"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (clean), npm run lint (zero issues in files this plan touched — all reported issues pre-existing in unrelated .claude/ tooling scripts), npm run build (Compiled successfully, /clientes route listed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "End-to-end manual verification: 7 columns in funnel order with correct Portuguese labels, new client in 'Aguardando contato', empty columns read 'Nenhum cliente nesta etapa', board scrolls horizontally on a narrow window, Supervisor sees responsável name / Vendedor does not"
    human_judgment: true
    verification:
      - kind: manual
        ref: "Deferred to end-of-phase human verification per config.json's human_verify_mode: end-of-phase (this plan's <human-check> is explicitly batched)"
        status: pending

duration: ~15min
completed: 2026-07-17
status: complete
---

# Phase 2 Plan 3: Kanban Board (7 Fixed Columns) Summary

**Turned the 02-02 interim grouped list into the real compact kanban board — `KanbanBoard` renders the 7 fixed funil stages as columns (derived from `ETAPAS`, never hardcoded), each holding compact `ClienteCard`s whose prop contract is locked in now so 02-04/02-05/02-06 add drag, incompleto/overdue data, and click-to-open by passing props, not by restructuring the component.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-17
- **Tasks:** 2/2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `components/clientes/ClienteCard.tsx`: compact, presentational kanban card. Renders razão social as a 16px/600 truncated Card title, categoria as a neutral/outline `Badge` (never blue), and — only when `showResponsavel` is true — the responsável name at 14px/400 muted-foreground. Reserves a top-right `Incompleto` badge slot and a 4px amber left border + `TriangleAlert` slot for the overdue highlight, both inert (rendered from `incompleto`/`isOverdue` props that default to `false` until 02-04/02-05 wire real data). Exposes `onOpen` (click/keyboard-activatable, `role="button"`) and `dragHandleProps` (spread onto the card root) as the forward hooks for 02-06 and 02-04 respectively.
- `lib/supabase/queries/clientes.ts`: `getClientesAgrupadosPorEtapa()` now selects `categorias(nome)` and `profiles(nome, sobrenome)` as to-one PostgREST embeds (both FKs live on `clientes` itself, so no `!fkey` disambiguation hint is needed) and flattens them into `categoria_nome`/`responsavel_nome` on `ClienteListItem` — one query serves the card's full display needs.
- `components/clientes/KanbanBoard.tsx`: maps over `ETAPAS` (single source of truth shared with the `etapa_funil` Postgres enum) to render 7 columns, each 280px min-width with a `--secondary` header (etapa label, Heading 20px/600, + neutral count `Badge`), 16px gap between columns, 8px gap between cards, horizontally scrollable as a set. Per-column empty state: "Nenhum cliente nesta etapa". Passes `showResponsavel = (callerRole === 'supervisor')` down to every card.
- `app/(app)/clientes/page.tsx`: now renders `KanbanBoard` in place of the 02-02 interim grouped list, keeping the "Clientes" heading, "Novo cliente" trigger, and the whole-board zero-clientes empty state ("Nenhum cliente cadastrado ainda...").

## Task Commits

Each task was committed atomically:

1. **Task 1: ClienteCard (compact, presentational, full prop contract)** - `55a3ede` (feat)
2. **Task 2: KanbanBoard (7 fixed columns) wired into /clientes** - `1406fb2` (feat)

## Files Created/Modified

- `components/clientes/ClienteCard.tsx` - compact kanban card, full forward prop contract
- `components/clientes/KanbanBoard.tsx` - 7-column board derived from `ETAPAS`
- `lib/supabase/queries/clientes.ts` - `getClientesAgrupadosPorEtapa()` now joins categoria/responsável names
- `app/(app)/clientes/page.tsx` - renders `KanbanBoard` instead of the interim list

## Decisions Made

- The UI-SPEC's screen-level "quick-action icon row" (phone/WhatsApp/calendar shortcuts) was not built in this plan — Task 1's action description and acceptance criteria scope the card to razão social, categoria badge, responsável line, and the Incompleto/overdue slots only. Building the icon row now (with no `tel:`/`wa.me` wiring target yet) would be dead UI; left for whichever later plan owns those quick actions.
- `isOverdue`'s `TriangleAlert` uses a plain `aria-label` instead of a `Tooltip` primitive, since `components/ui/tooltip.tsx` isn't installed yet and `isOverdue` is always `false` in this plan (02-04 populates it). Revisit once overdue data and the tooltip requirement are actually wired.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ClienteCard`'s prop contract (`showResponsavel`, `incompleto`, `isOverdue`, `overdueTooltip`, `onOpen`, `dragHandleProps`) is complete — 02-04 (drag-and-drop), 02-05 (incompleto/overdue data), and 02-06 (detail sheet click-to-open) can all build on top of it by passing new prop values.
- `KanbanBoard` is a plain, non-interactive layout — 02-04 wraps it with dnd-kit's `DndContext`/`useDraggable`/`useDroppable` without needing to change the column-derivation logic.
- End-to-end manual verification (7-column funnel order/labels, empty-column copy, horizontal scroll on narrow viewport, Supervisor-vs-Vendedor responsável line) is deferred to end-of-phase batch verification per `config.json`'s `human_verify_mode: end-of-phase` — not a blocker for continuing to 02-04.

---
*Phase: 02-cadastro-e-gest-o-de-clientes-pj*
*Completed: 2026-07-17*

## Self-Check: PASSED

All 4 created/modified files verified present on disk (`components/clientes/ClienteCard.tsx`, `components/clientes/KanbanBoard.tsx`, `lib/supabase/queries/clientes.ts`, `app/(app)/clientes/page.tsx`); both task commit hashes (`55a3ede`, `1406fb2`) confirmed present in `git log`.
