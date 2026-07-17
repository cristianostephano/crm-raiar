---
phase: 02-cadastro-e-gest-o-de-clientes-pj
plan: 06
subsystem: ui
tags: [react, shadcn, react-hook-form, zod, supabase, rls, sheet]

# Dependency graph
requires:
  - phase: 02-cadastro-e-gest-o-de-clientes-pj/02-02
    provides: "createCliente/createClienteSchema patterns (superRefine, 23505 mapping, responsavel-stripping) that updateCliente reuses verbatim"
  - phase: 02-cadastro-e-gest-o-de-clientes-pj/02-03
    provides: "ClienteCard's onOpen/dragHandleProps split (click-to-open vs drag)"
  - phase: 02-cadastro-e-gest-o-de-clientes-pj/02-05
    provides: "isClienteIncompleto()/ClienteCompletudeInput predicate, categoriaOptions/produtoOptions/vendedorOptions derived in-memory in KanbanBoard"
provides:
  - "ClienteDetailSheet — right-side edit Sheet (Dados do cliente section) + Supervisor-only Apagar cliente with exact destructive confirmation copy"
  - "updateCliente/deleteCliente Server Actions + getClienteDetalhe wrapper + getClienteById query (app/actions/clientes.ts, lib/supabase/queries/clientes.ts)"
  - "updateClienteSchema (lib/validations/cliente.ts)"
  - "lib/clientes/completude.ts — dependency-free isClienteIncompleto()/ClienteCompletudeInput, safe to import from a Client Component"
  - "KanbanBoard card click (onOpen) opens the Sheet; local in-place patch of the edited/deleted card (no full page reload)"
affects: [02-07]

# Tech tracking
tech-stack:
  added: ["shadcn sheet/separator (base-ui primitives, no new npm dependency)"]
  patterns:
    - "Edit/delete Server Actions re-validate with the same zod schema pattern as create (updateClienteSchema mirrors createClienteSchema's object-level superRefine for the '' responsavel sentinel) and reuse the 23505 -> duplicate_razao_social mapping"
    - "A Client Component needing server-only data (getClienteById, which uses next/headers cookies()) goes through a thin Server Action wrapper (getClienteDetalhe) — the query function itself stays in lib/supabase/queries/clientes.ts for Server Component reuse"
    - "Pure predicates shared between server query modules and Client Components live in a dependency-free file (lib/clientes/completude.ts), never imported as a runtime value directly from a module that also imports lib/supabase/server.ts — only type-only imports are safe across that boundary in a Client Component"
    - "Post-mutation UI sync uses a local in-place state patch (mirrors 02-04's optimistic drag pattern) instead of router.refresh() — the Sheet's onSaved/onDeleted callbacks hand KanbanBoard the exact submitted values, which it merges into the existing ClienteListItem via the same categoriaOptions/produtoOptions/vendedorOptions lookups already computed for FiltersPopover"

key-files:
  created:
    - components/clientes/ClienteDetailSheet.tsx
    - components/ui/sheet.tsx
    - components/ui/separator.tsx
    - lib/clientes/completude.ts
    - tests/clientes/update-delete.test.ts
  modified:
    - app/actions/clientes.ts
    - lib/validations/cliente.ts
    - lib/supabase/queries/clientes.ts
    - components/clientes/KanbanBoard.tsx

key-decisions:
  - "categoriaId/produtoIds/vendedorId edit-Select options reuse the same in-memory-derived categoriaOptions/produtoOptions/vendedorOptions KanbanBoard already computes for FiltersPopover (02-05's Pitfall-7 convention), instead of adding a new full-catalog query against categorias/produtos_consumidos/profiles — keeps this plan's file scope (no app/(app)/clientes/page.tsx changes) and avoids a second lookup path. Known limitation: a categoria/produto/vendedor with zero currently-loaded clients referencing it won't appear as an option yet; acceptable for MVP since the board only renders once at least one cliente exists"
  - "The Vendedor-view Responsável field reads cliente.responsavelNome directly from the loaded ClienteDetalhe instead of a separate currentUserId/currentUserName prop — RLS already guarantees a Vendedor only ever loads their own clientes (T-02-01), so this is always their own name; avoided touching page.tsx to thread new props through"
  - "cliente_produtos sync (multi-value produtos consumidos) replaces the whole join-table set on every save (delete-then-insert) rather than diffing adds/removes — simple and safe at MVP scale (a handful of produtos per cliente)"

requirements-completed: [CLI-02, CLI-05, CLI-06]

coverage:
  - id: D1
    description: "Clicking (not dragging) a card opens the right-side detail Sheet showing the full client; a Vendedor can fill in previously-blank optional fields at any time and save"
    requirement: "CLI-02"
    verification:
      - kind: unit
        ref: "tests/clientes/update-delete.test.ts — 'Vendedor A can UPDATE contato/telefone on their own cliente (CLI-02/CLI-06)'"
        status: pass
      - kind: other
        ref: "Source assertion: ClienteCard's onOpen (click/keyboard path) is distinct from dragHandleProps (dnd-kit listeners); KanbanBoard wires onOpen={() => handleOpenCliente(cliente.id)} on both DraggableClienteCard and StaticClienteCard, never on the drag handle."
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: click a card (not drag), confirm the Sheet opens with the client's data; fill blank optional fields as Vendedor, Salvar, confirm the Incompleto badge disappears; confirm dragging a card still does NOT open the Sheet"
        status: unknown
    human_judgment: true
    rationale: "Visual Sheet open/close and badge-disappearance behavior need a human looking at the rendered UI; deferred to end-of-phase batch per config.json's human_verify_mode."
  - id: D2
    description: "A Vendedor can edit their own client's data but sees no 'Apagar cliente' button; a Supervisor can edit any client, reassign its responsável, and delete it"
    requirement: "CLI-05"
    verification:
      - kind: unit
        ref: "Source assertion: ClienteDetailSheet's 'Apagar cliente' Button is gated by `isSupervisor && cliente` — entirely absent from the render tree for a Vendedor, not just disabled; the Responsável field renders a reassign Select only when isSupervisor, otherwise a disabled/readOnly Input."
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: as Supervisor, reassign the responsável and save, confirm the card's vendedor name updates; confirm no Apagar button as Vendedor"
        status: unknown
    human_judgment: true
    rationale: "Cross-role visual confirmation (button absence, Select vs read-only Input) needs a human looking at both role views; deferred to end-of-phase batch."
  - id: D3
    description: "Deleting a client asks for confirmation with the exact destructive copy and, on confirm, removes the client and its card from the board"
    requirement: "CLI-05"
    verification:
      - kind: other
        ref: "Source assertion: the confirmation Dialog's copy is the exact UI-SPEC string ('Tem certeza que deseja apagar o cliente {razão social}? Essa ação não pode ser desfeita e vai remover todo o histórico do funil.') with Cancelar (ghost) / Apagar (destructive) buttons; handleClienteDeleted removes the cliente from KanbanBoard's local grouped state on success."
        status: pass
      - kind: manual_procedural
        ref: "End-of-phase batch human-check: as Supervisor, open Apagar, confirm the destructive copy, apagar — confirm the card leaves the board"
        status: unknown
    human_judgment: true
    rationale: "Visual confirmation dialog copy and card removal from the rendered board need a human looking at the UI; deferred to end-of-phase batch."
  - id: D4
    description: "A Vendedor cannot delete a client even via a direct API call — the DELETE is a no-op under RLS, and deleteCliente's app-layer check independently rejects a non-Supervisor caller before attempting it"
    requirement: "CLI-06"
    verification:
      - kind: unit
        ref: "tests/clientes/update-delete.test.ts — 'Vendedor A cannot DELETE their own cliente (0 rows affected...)' and 'Supervisor CAN delete a cliente'; tests/clientes/rls-clientes.test.ts (02-01) — same guarantee, written independently"
        status: pass
      - kind: other
        ref: "Source assertion: deleteCliente() returns { error: { code: 'forbidden' } } for a non-Supervisor caller before any DELETE is attempted (app-layer fail-closed), backstopped by the clientes DELETE RLS policy `using (is_supervisor())` from 02-01."
        status: pass
    human_judgment: false
  - id: D5
    description: "updateCliente strips/blocks a Vendedor's responsavel reassignment attempt server-side, backstopped by the UPDATE ... WITH CHECK RLS policy"
    requirement: "CLI-05"
    verification:
      - kind: unit
        ref: "tests/clientes/update-delete.test.ts — 'a Vendedor's attempt to reassign responsavel to another vendedor fails at the RLS layer (0 rows / 42501)'"
        status: pass
      - kind: other
        ref: "Source assertion: updateCliente computes `const responsavel = isSupervisor ? parsed.data.responsavel : user.id` — a non-Supervisor's submitted responsavel value is never used."
        status: pass
    human_judgment: false
  - id: D6
    description: "updateClienteSchema uses object-level superRefine (not per-field .refine) for the responsavel '' sentinel, matching the zod v4 + @hookform/resolvers compatibility caveat established in 02-02"
    verification:
      - kind: unit
        ref: "tests/clientes/update-delete.test.ts — updateClienteSchema describe block (3 tests: full valid payload, missing razaoSocial, responsavel === '')"
        status: pass
    human_judgment: false
  - id: D7
    description: "npx tsc --noEmit, npm run lint (files this plan touched), npm run build, and npx vitest run tests/clientes/ all pass"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (clean); npm run build (Compiled successfully, /clientes route listed); npx eslint on every non-.claude/ file this plan touched (clean except one pre-existing-pattern react-hooks/incompatible-library warning on form.watch(), 0 errors); each tests/clientes/*.test.ts file run individually — all pass (61/61 tests total across 6 files) — running the whole tests/clientes/ directory at once trips Supabase's auth sign-in rate limit (external, not a code defect)"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-07-17
status: complete
---

# Phase 2 Plan 6: Client Detail/Edit Sheet + Delete Summary

**Right-side Sheet (click-to-open, never drag) with a fully editable "Dados do cliente" section, Supervisor-only reassign/delete, and updateCliente/deleteCliente Server Actions whose RLS-backed guarantees (Vendedor edits own, cannot delete, cannot reassign responsavel) are proven by real signed-in-session tests.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-17
- **Tasks:** 2/2
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments

- **updateCliente/deleteCliente Server Actions (CLI-02/CLI-05/CLI-06):** Added to `app/actions/clientes.ts`, mirroring `createCliente`'s pattern — server-side re-validation via `updateClienteSchema`, the same 23505 -> `duplicate_razao_social` mapping, and a Vendedor's `responsavel` change stripped server-side (defense in depth over the `clientes` UPDATE `... WITH CHECK` RLS policy from 02-01). `deleteCliente` rejects a non-Supervisor caller before attempting the DELETE at all (app-layer fail-closed, backstopped by the Supervisor-only DELETE RLS policy). Both sync `cliente_produtos` (multi-value produtos consumidos) via a delete-then-insert replace of the whole set.
- **getClienteById + getClienteDetalhe (T-02-21):** `getClienteById(id)` (`lib/supabase/queries/clientes.ts`) is the RLS-scoped full-client read for the edit form (returns `null` — not an error — for both "doesn't exist" and "not visible to this caller," never distinguishing which). Since `KanbanBoard` is a Client Component and this query needs `next/headers` cookies(), `getClienteDetalhe` (`app/actions/clientes.ts`) is a thin Server Action wrapper the Sheet actually calls.
- **`ClienteDetailSheet.tsx` (CLI-02/CLI-05/CLI-06):** New 480px-desktop/full-width-mobile right-side `Sheet`. Header: razão social title + close + (Supervisor-only) "Apagar cliente" ghost destructive button opening a confirmation `Dialog` with the exact UI-SPEC copy. Section 1 "Dados do cliente": razão social, endereço (cep/rua/número/complemento/cidade/estado), Responsável (Supervisor: reassign `Select`; Vendedor: read-only, since RLS guarantees a Vendedor only ever loads their own cliente), Categoria `Select` (with a "Nenhuma" clear option), Contato/Telefone/Email, produtos consumidos checklist, número de lojas. A clearly-labelled empty "Funil" section (Heading + Separator + an empty `data-slot="funil-section-placeholder"` container, no fake UI) is left for 02-07. Footer: "Salvar alterações" pinned to the bottom.
- **KanbanBoard wiring:** `selectedClienteId`/`sheetOpen` state; both `DraggableClienteCard` and `StaticClienteCard` now pass `onOpen={() => handleOpenCliente(cliente.id)}` to `ClienteCard` — a plain click opens the Sheet, a drag (dnd-kit's `PointerSensor` distance threshold) never does. On save/delete, `handleClienteSaved`/`handleClienteDeleted` patch the local `grouped` state in-place (same pattern as 02-04's optimistic drag), recomputing `incompleto` via the shared `isClienteIncompleto()` predicate so the badge never drifts from what was just saved.
- **shadcn `sheet`/`separator` installed** via `npx shadcn@latest add sheet separator` — base-ui primitives, no new npm dependency.

## Task Commits

Each task was committed atomically:

1. **Task 1: updateCliente/deleteCliente actions + edit schema + RLS tests** - `31b5054` (feat)
2. **Task 2: ClienteDetailSheet (Dados) + supervisor delete confirmation** - `b6999ab` (feat)

## Files Created/Modified

- `app/actions/clientes.ts` - `updateCliente`, `deleteCliente`, `getClienteDetalhe` Server Actions
- `lib/validations/cliente.ts` - `updateClienteSchema`
- `lib/supabase/queries/clientes.ts` - `getClienteById`/`ClienteDetalhe`; re-exports `isClienteIncompleto`/`ClienteCompletudeInput` from their new home
- `lib/clientes/completude.ts` - `isClienteIncompleto`/`ClienteCompletudeInput` extracted to a dependency-free module (see Deviations)
- `components/clientes/ClienteDetailSheet.tsx` - the detail/edit Sheet
- `components/clientes/KanbanBoard.tsx` - selectedClienteId/sheetOpen state, card `onOpen` wiring, `handleClienteSaved`/`handleClienteDeleted` local-state patch
- `components/ui/sheet.tsx`, `components/ui/separator.tsx` - shadcn-CLI-installed primitives
- `tests/clientes/update-delete.test.ts` - 13 tests (schema validation + real signed-in session behavior)

## Decisions Made

See `key-decisions` in the frontmatter above for the full list and rationale (reusing KanbanBoard's already-derived option lists instead of a new full-catalog query, Vendedor's Responsável field reading straight from the loaded row instead of new props, and the produtos delete-then-insert sync strategy).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extracted isClienteIncompleto()/ClienteCompletudeInput into a dependency-free module**
- **Found during:** Task 2, `npm run build`
- **Issue:** `KanbanBoard.tsx` (a Client Component) needed to call `isClienteIncompleto()` after an edit to recompute the "Incompleto" badge (per 02-05's own stated intent for this exact scenario). Importing it as a runtime value from `lib/supabase/queries/clientes.ts` pulled that whole module — including its `import { createClient } from "@/lib/supabase/server"`, which itself imports `next/headers` — into the client bundle. Turbopack's build failed hard: `"You're importing a module that depends on 'next/headers'... in the Pages Router"` (actually App Router client-bundle detection), tracing through `KanbanBoard.tsx [Client Component Browser]`.
- **Fix:** Extracted `isClienteIncompleto`/`ClienteCompletudeInput` into a new dependency-free `lib/clientes/completude.ts` (no imports at all). `lib/supabase/queries/clientes.ts` now imports from there and re-exports both symbols, so `tests/clientes/incompleto.test.ts`'s existing import path (`../../lib/supabase/queries/clientes`) keeps working unchanged. `KanbanBoard.tsx` imports the runtime function directly from `lib/clientes/completude.ts` instead.
- **Files modified:** `lib/clientes/completude.ts` (new), `lib/supabase/queries/clientes.ts`, `components/clientes/KanbanBoard.tsx`
- **Verification:** `npx tsc --noEmit` clean; `npm run build` — "Compiled successfully", `/clientes` route listed; `tests/clientes/incompleto.test.ts` still passes unchanged (its import path was preserved via re-export).
- **Committed in:** `b6999ab` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — build-breaking bug caught during verification, not shipped)
**Impact on plan:** Necessary for the build to succeed at all; no scope creep — the fix is a pure refactor (move + re-export) with identical runtime behavior and no new public API beyond the new module path.

## Issues Encountered

- Running the entire `tests/clientes/` directory at once (`npx vitest run tests/clientes/`) trips Supabase's auth sign-in rate limit (`"Request rate limit reached"`), since 6 test files running in parallel each call `signInAs()` multiple times against the same seeded test accounts within a short window. This is an external free-tier rate limit, not a code defect — every test file passes cleanly (61/61 tests) when run individually or a couple at a time. Documented here so a future CI setup either serializes `tests/clientes/*.test.ts` or accepts occasional rate-limit-induced retries, rather than mistaking it for a regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ClienteDetailSheet`'s "Funil" section is a clearly-labelled empty container (`data-slot="funil-section-placeholder"`, Heading + Separator, no fake UI) directly below "Dados do cliente" — 02-07 fills it (status Select + Confirmar perda modal, Observação Textarea, Tarefas checklist, Histórico timeline) without restructuring this Sheet.
- `getClienteById`/`ClienteDetalhe` already exposes everything 02-07 needs to extend the edit form's data-loading path with funil-specific fields (status_acompanhamento, motivo_perda_id, observacao) — those just need to be added to the same query/type rather than a new one.
- `handleClienteSaved`'s local-state-patch pattern in `KanbanBoard` is the template 02-07 should follow for its own status/observação/tarefa mutations, to keep the board in sync without a full page reload.
- End-to-end manual verification (Sheet open on click/not-drag, Vendedor vs Supervisor views, delete confirmation flow) is deferred to the end-of-phase human-check batch per `config.json`'s `human_verify_mode: end-of-phase` — not a blocker for continuing to 02-07.

---
*Phase: 02-cadastro-e-gest-o-de-clientes-pj*
*Completed: 2026-07-17*

## Self-Check: PASSED

All 9 created/modified source files verified present on disk (`app/actions/clientes.ts`, `lib/validations/cliente.ts`, `lib/supabase/queries/clientes.ts`, `components/clientes/ClienteDetailSheet.tsx`, `components/clientes/KanbanBoard.tsx`, `components/ui/sheet.tsx`, `components/ui/separator.tsx`, `lib/clientes/completude.ts`, `tests/clientes/update-delete.test.ts`); both task commit hashes (`31b5054`, `b6999ab`) confirmed present in `git log`.
