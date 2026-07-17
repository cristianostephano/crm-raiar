---
phase: 02-cadastro-e-gest-o-de-clientes-pj
plan: 05
subsystem: ui
tags: [react, shadcn, base-ui, search, filters, kanban]

# Dependency graph
requires:
  - phase: 02-cadastro-e-gest-o-de-clientes-pj/02-03
    provides: "ClienteCard (full forward-looking prop contract), KanbanBoard (static 7-column layout)"
  - phase: 02-cadastro-e-gest-o-de-clientes-pj/02-04
    provides: "Interactive drag-and-drop KanbanBoard, lib/funil/staleness.ts (diasParado), getClientesAgrupadosPorEtapa() returning posicao/etapa_alterada_em/isOverdue"
provides:
  - "isClienteIncompleto() pure predicate (lib/supabase/queries/clientes.ts) + precomputed ClienteListItem.incompleto, shared by the Incompleto badge and the Incompletos tab"
  - "ClienteToolbar + FiltersPopover: razão-social-only search (D-07), categoria/produto/cidade/estado/vendedor filters (D-08/D-09), Ordenar por sort menu, Todos/Incompletos tabs (D-01)"
  - "ClienteCard quick-action icon row (tel:/wa.me links, disabled-not-hidden when telefone is blank, D-03)"
affects: [02-06, 02-07]

# Tech tracking
tech-stack:
  added: ["shadcn tabs/popover/dropdown-menu/checkbox (base-ui primitives, no new npm dependency)"]
  patterns:
    - "Search/filter/sort/tab state lives in KanbanBoard (the client board already holding the RLS-scoped `grouped` set) and is applied via useMemo — no re-query on any interaction (Pitfall 7); filter option lists (categoria/produto/estado/vendedor) are derived from that same loaded set, not a separate lookup query"
    - "FiltersPopover holds its own draft state, resynced from the applied filters every time it opens; only 'Aplicar filtros'/'Limpar filtros' (footer, inside the popover) commit changes back to KanbanBoard — matches the UI-SPEC's 'buttons live inside the popover only' contract"
    - "isClienteIncompleto() is computed once per row inside getClientesAgrupadosPorEtapa() and stored as ClienteListItem.incompleto — both the card's 'Incompleto' badge and the Incompletos tab filter read this single precomputed field, so they can never disagree"
    - "Dragging is disabled (StaticClienteCard, no dnd-kit wrapper) whenever the rendered card order could differ from `grouped`'s own posicao-ascending order — i.e. search/filtros/Incompletos narrowing the visible set, or a non-'Mais recentes' sort re-ordering it. Re-enabled automatically once Todos + Mais recentes + no filters is restored, so computeNovaPosicao's neighbor math is never computed against a hidden or reordered neighbor"

key-files:
  created:
    - components/clientes/ClienteToolbar.tsx
    - components/clientes/FiltersPopover.tsx
    - components/ui/tabs.tsx
    - components/ui/popover.tsx
    - components/ui/dropdown-menu.tsx
    - components/ui/checkbox.tsx
    - tests/clientes/incompleto.test.ts
  modified:
    - lib/supabase/queries/clientes.ts
    - components/clientes/KanbanBoard.tsx
    - components/clientes/ClienteCard.tsx

key-decisions:
  - "isClienteIncompleto lives in lib/supabase/queries/clientes.ts (colocated with ClienteListItem), not a new module, per the plan's own files_modified list for Task 1 — precomputed once per row as ClienteListItem.incompleto rather than recomputed by each caller"
  - "Filter option lists (categoria/produto/estado/vendedor) are derived in-memory from the already-loaded card set instead of a separate categorias/produtos_consumidos lookup query — matches the plan's own Task 1 wording ('the query returns... the fields needed for filtering') and keeps filtering fully local (Pitfall 7)"
  - "'Ordenar por' semantics (not specified beyond the 3 copy labels): 'Mais recentes' = the board's natural drag-managed order (no re-sort); 'Razão social (A-Z)' = alphabetical; 'Parado há mais tempo' = descending diasParado(), reusing the exact function the FUN-09 highlight already uses"
  - "Drag is disabled whenever search/filters/Incompletos/a non-default sort is active (StaticClienteCard fallback) — not explicitly required by the plan, but necessary to prevent computeNovaPosicao (from 02-04) computing a fractional midpoint against the wrong neighbor once the visible column no longer matches `grouped`'s true posicao-ordered array. Re-enables automatically once Todos + Mais recentes + no filters/search is restored"
  - "Quick-action CalendarClock/'schedule' icon has no standalone destination yet (no tarefa quick-add exists before 02-06's detail sheet) — wired to call the same `onOpen` prop the card already exposes, so it does something meaningful the moment 02-06 passes `onOpen`, and renders disabled/muted (not hidden) today since no caller passes `onOpen` yet. Avoids both a fake dead link and re-litigating 02-03's 'no dead UI' decision"
  - "WhatsApp link assumes a Brazilian phone number stored without country code and prepends '55' (https://wa.me/55{digits}) — telefone is free text with no format validation yet, so this is a best-effort convention pending a phone-formatting pass"

requirements-completed: [CLI-07, CLI-02]

coverage:
  - id: D1
    description: "Typing part of a razão social in the search box narrows the board to matching cards only, filtering by razão social alone (not contato/email)"
    requirement: "CLI-07"
    verification:
      - kind: unit
        ref: "Source assertion: KanbanBoard's filteredGrouped only tests cliente.razao_social.toLowerCase().includes(normalizedSearch) — no other field is read for the search filter."
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: type part of a razão social, confirm only matching cards remain"
        status: unknown
    human_judgment: true
    rationale: "Requires visually confirming the live-filtered board narrows correctly; deferred to end-of-phase batch per config.json's human_verify_mode."
  - id: D2
    description: "The Filtros popover narrows the board by categoria/produto/cidade/estado, and (Supervisor only) vendedor/responsável; a blue dot appears on the Filtros button when >=1 filter is active; Limpar filtros resets it"
    requirement: "CLI-07"
    verification:
      - kind: unit
        ref: "Source assertion: FiltersPopover's isSupervisor prop gates the vendedor Select's rendering entirely (not just disables it); contarFiltrosAtivos() drives the blue dot; clienteAtendeFiltros() ANDs every active dimension."
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: apply a categoria filter as Supervisor and as Vendedor, confirm the vendedor filter only appears for Supervisor, confirm the blue dot and Limpar filtros behavior"
        status: unknown
    human_judgment: true
    rationale: "Visual dot placement and cross-role popover contents need a human looking at the rendered UI as both roles; deferred to end-of-phase batch."
  - id: D3
    description: "A 'Todos'/'Incompletos' tab switches the board to only clients missing an optional field, without navigating away; those cards show a neutral 'Incompleto' badge; the empty state reads the UI-SPEC copy when nothing is incomplete"
    requirement: "CLI-02"
    verification:
      - kind: unit
        ref: "tests/clientes/incompleto.test.ts — 6/6 passing (all-blank, all-filled, missing-only-produtos, missing-only-categoria, numero_de_lojas=0 treated as filled, empty-string treated as blank)"
        status: pass
      - kind: other
        ref: "Source assertion: KanbanBoard's Incompletos tab filter (cliente.incompleto) and ClienteCard's badge (incompleto prop) both read the same precomputed ClienteListItem.incompleto field from isClienteIncompleto() — they cannot disagree by construction."
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: switch to Incompletos, confirm only incomplete cards show with the badge, and the friendly empty-state copy when none are incomplete"
        status: unknown
    human_judgment: true
    rationale: "Visual badge placement and empty-state rendering need a human looking at the rendered board; the underlying predicate is fully unit-tested. Deferred to end-of-phase batch."
  - id: D4
    description: "Each card shows phone/WhatsApp/schedule quick-action icons; when telefone is blank the icons render disabled (muted, not clickable) rather than disappearing, so the card layout never shifts"
    verification:
      - kind: other
        ref: "Source assertion: QuickActionIcon/QuickActionButton render a non-interactive `<span aria-hidden>` (same size-11 box) when there is no href/action, never omitting the element from the row."
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: confirm a card with no telefone shows the phone/WhatsApp icons visibly greyed out, not missing, and tapping them does nothing"
        status: unknown
    human_judgment: true
    rationale: "Visual muted-vs-hidden state needs a human looking at the rendered card; deferred to end-of-phase batch."
  - id: D5
    description: "npx tsc --noEmit, npm run lint (files this plan touched), and npm run build all pass"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (clean); npx eslint on every file this plan touched (clean — the project-wide `npm run lint` has pre-existing failures only in unrelated .claude/ tooling scripts, same caveat noted in 02-03/02-04's SUMMARYs); npm run build (Compiled successfully, /clientes route listed)"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-07-17
status: complete
---

# Phase 2 Plan 5: Client List Toolbar (Search/Filters/Sort/Incompletos) Summary

**Full-team board is now searchable by razão social, filterable by categoria/produto/cidade/estado (+ vendedor for Supervisor), sortable, and has a working "Incompletos" tab backed by a single shared `isClienteIncompleto()` predicate — plus a tel:/wa.me quick-action row completing the card anatomy.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-07-17
- **Tasks:** 2/2
- **Files modified:** 11 (7 created, 4 modified — including the 4 shadcn-CLI-generated `components/ui/*` primitives)

## Accomplishments

- **`isClienteIncompleto()` (D-02, CLI-02):** Added to `lib/supabase/queries/clientes.ts`, colocated with `ClienteListItem`. Returns true when ANY of categoria_id/contato/telefone/email/numero_de_lojas/produtos is blank (an explicit `0` for número de lojas counts as filled; an empty string does not). `getClientesAgrupadosPorEtapa()` now also joins `cliente_produtos(produto_id, produtos_consumidos(nome))` and precomputes `incompleto` once per row, so the badge and the Incompletos tab can never disagree — they read the exact same field.
- **`ClienteToolbar` + `FiltersPopover` (D-07/D-08/D-09/D-01):** New toolbar above the board — icon-prefixed search Input ("Buscar por razão social...", razão-social-only per D-07), a "Filtros" outline button (blue dot when ≥1 filter active) opening `FiltersPopover` (categoria Select, produto consumido Checkbox multi-select, cidade Input, estado Select, and — gated on `isSupervisor` — a vendedor/responsável Select, D-09), an "Ordenar por" DropdownMenu (Mais recentes/Razão social A-Z/Parado há mais tempo), and shadcn `Tabs` for Todos/Incompletos (D-01). All installed via `npx shadcn@latest add tabs popover dropdown-menu checkbox` — base-ui primitives, no new npm dependency (package.json unchanged).
- **In-memory filtering (Pitfall 7):** `KanbanBoard` now owns all search/filter/sort/tab state and derives both the filter option lists (categoria/produto/estado/vendedor — unique values from the already-loaded card set) and the filtered/sorted per-column lists via `useMemo`. No filter interaction ever calls `getClientesAgrupadosPorEtapa()` again.
- **Drag safety under filtering:** Added `StaticClienteCard` (no dnd-kit wrapper) used whenever the visible card order could diverge from `grouped`'s true posicao-ascending order (any active search/filter/Incompletos tab, or a non-"Mais recentes" sort) — prevents 02-04's `computeNovaPosicao` from computing a fractional midpoint against a hidden or reordered neighbor. Drag re-enables automatically once Todos + Mais recentes + no filters is restored.
- **Card quick-actions (D-03):** `ClienteCard` gained a `tel:`/WhatsApp (`https://wa.me/55{digits}`)/schedule icon row, each a 44px-touch-target ghost icon; when `telefone` is blank every icon renders as a disabled/muted `<span>` (never removed from the DOM), so card layout never shifts. The schedule/`CalendarClock` icon calls the card's existing `onOpen` prop (currently unwired by any caller — 02-06 will pass it) instead of linking nowhere.

## Task Commits

Each task was committed atomically:

1. **Task 1: isClienteIncompleto predicate + filter query fields** - `3e832ae` (feat)
2. **Task 2: Toolbar (search/filters/sort/tabs) + card badge/quick-actions** - `3437324` (feat)

## Files Created/Modified

- `lib/supabase/queries/clientes.ts` - `isClienteIncompleto()`, `ClienteCompletudeInput`, `produtos` + `incompleto` on `ClienteListItem`, `cliente_produtos` embed in the select
- `tests/clientes/incompleto.test.ts` - 6 unit tests for the D-02 predicate
- `components/clientes/ClienteToolbar.tsx` - search Input, Filtros trigger, Ordenar por menu, Todos/Incompletos Tabs
- `components/clientes/FiltersPopover.tsx` - categoria/produto/cidade/estado/vendedor filters, draft state + Aplicar/Limpar footer
- `components/clientes/KanbanBoard.tsx` - search/filter/sort/tab state, filter option derivation, filtered/sorted rendering, StaticClienteCard drag-safety fallback
- `components/clientes/ClienteCard.tsx` - quick-action icon row (Phone/MessageCircle/CalendarClock), `telefone` added to `ClienteCardData`
- `components/ui/tabs.tsx`, `components/ui/popover.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/checkbox.tsx` - shadcn-CLI-installed primitives

## Decisions Made

See `key-decisions` in the frontmatter above for the full list and rationale (predicate colocation, filter-option derivation from the loaded set, Ordenar por semantics, drag-disable-while-filtered/sorted, CalendarClock wired to `onOpen`, WhatsApp country-code assumption).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Disabled drag-and-drop while search/filters/Incompletos/a non-default sort is active**
- **Found during:** Task 2
- **Issue:** The plan doesn't mention drag+filter interaction, but 02-04's `computeNovaPosicao` computes a fractional midpoint from the *visually adjacent* cards in the rendered column. Once search/filters/the Incompletos tab hide some cards, or a non-"Mais recentes" sort reorders them, those visual neighbors are no longer the same as the neighbors in `grouped`'s true posicao-ascending array — dragging in that state would silently write a card's `posicao` relative to the wrong neighbor.
- **Fix:** Added `StaticClienteCard` (plain `ClienteCard`, no dnd-kit `useSortable`/`DndContext`) rendered instead of the draggable path whenever `dragDisabled` (search/filtros/Incompletos active, or `sortBy !== "recentes"`) is true. Drag automatically re-enables once Todos + Mais recentes + no filters/search is restored.
- **Files modified:** `components/clientes/KanbanBoard.tsx`
- **Verification:** `npx tsc --noEmit` clean; `npm run build` succeeds; source assertion — `DndContext`/`SortableContext` only wrap the board when `dragDisabled` is false.
- **Committed in:** `3437324` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (missing critical — correctness/data-integrity gap the plan didn't anticipate)
**Impact on plan:** Necessary to prevent a real (if narrow) card-ordering bug the plan's own Task 2 scope would have otherwise introduced. No scope creep beyond what dragging safely under the new filtering feature requires.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ClienteCard`'s `onOpen` prop now has a second caller path (the schedule quick-action icon) in addition to the card body's own click/keyboard handler — 02-06 wiring `onOpen` to open the detail `Sheet` will make both affordances work identically with no further changes to `ClienteCard`.
- `isClienteIncompleto()` and `ClienteCompletudeInput` are exported and reusable — 02-06's detail-sheet save flow can call the same predicate after an edit to keep the badge/tab correct without duplicating the D-02 rule.
- `ClienteListItem.produtos` (id+nome pairs) is now available end-to-end — 02-06's detail sheet can render/edit the produtos consumidos multi-select against the same shape FiltersPopover already consumes.
- End-to-end manual verification (search narrowing, Filtros popover cross-role behavior, Incompletos tab + empty states, disabled-not-hidden quick actions) is deferred to the end-of-phase human-check batch per `config.json`'s `human_verify_mode: end-of-phase` — not a blocker for continuing to 02-06/02-07.

---
*Phase: 02-cadastro-e-gest-o-de-clientes-pj*
*Completed: 2026-07-17*

## Self-Check: PASSED

All 10 created/modified files verified present on disk (`components/clientes/ClienteToolbar.tsx`, `components/clientes/FiltersPopover.tsx`, `components/ui/tabs.tsx`, `components/ui/popover.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/checkbox.tsx`, `tests/clientes/incompleto.test.ts`, `lib/supabase/queries/clientes.ts`, `components/clientes/KanbanBoard.tsx`, `components/clientes/ClienteCard.tsx`); both task commit hashes (`3e832ae`, `3437324`) confirmed present in `git log`.
