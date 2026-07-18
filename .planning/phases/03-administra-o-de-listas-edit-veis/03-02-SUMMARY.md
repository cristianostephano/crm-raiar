---
phase: 03-administra-o-de-listas-edit-veis
plan: 02
subsystem: ui
tags: [nextjs, server-actions, supabase, rls, shadcn-switch, shadcn-dialog]

requires:
  - phase: 03-administra-o-de-listas-edit-veis
    provides: "getListaValores/createListaValor Server Actions and EditableListTab list+add UI from plan 03-01, reused/extended here"
provides:
  - "updateListaValor + setListaValorAtivo Server Actions (Supervisor-only, soft-delete via `ativo`, never DELETE)"
  - "EditableListTab fully editable: edit-in-place (D-04), deactivate/reactivate (D-03), 'Mostrar inativos' Switch"
  - "components/ui/switch.tsx (shadcn official registry, no new npm runtime dependency)"
affects: ["03-03-outras-3-abas"]

tech-stack:
  added: []
  patterns:
    - "Soft-delete write actions on the 4 lookup tables use `.update({ ativo })` exclusively — a DELETE RLS policy exists as migration-0002 residue but is never invoked, guaranteeing D-03 (nothing is ever lost, cliente references stay valid)"
    - "Row-level inline-edit state (editingId/editingNome/editSubmitting/editError) lives in the same component as the list, following PerdaMotivoDialog's local-state + try/catch-free async handler shape (errors returned as a Result union, not thrown)"

key-files:
  created:
    - components/ui/switch.tsx
  modified:
    - app/actions/listas.ts
    - components/configuracoes/EditableListTab.tsx

key-decisions:
  - "Row-level edit/deactivate errors render inline (under the edit Input, or inside the deactivate Dialog) rather than in the shared top-level formError/successMessage banner — the error is only actionable in that specific context (retry the rename, or dismiss the dialog), matching the existing PerdaMotivoDialog pattern of a dialog owning its own submitError"
  - "Reactivate (Eye) has no confirmation dialog — only deactivate does — since D-03 explicitly treats reactivation as the low-friction reversal path, matching the plan's action spec verbatim"
  - "Deactivate confirm button uses variant='secondary', never variant='destructive' — D-03/UI-SPEC Color contract reserves red exclusively for irreversible actions, and deactivating a lookup value is reversible"

patterns-established:
  - "Supervisor-only write actions (create/update/setAtivo) on the 4 lookup tables all share the identical auth+forbidden-check preamble, differing only in the final `.update()`/`.insert()` call and its error-code mapping"

requirements-completed: [ADM-01]

coverage:
  - id: D1
    description: "Supervisor clicks the pencil on a Categoria row, edits the name inline, and saves (Enter or Check) — the name updates without deactivating/recreating the row (D-04)"
    requirement: "ADM-01"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (type-level contract for updateListaValor + EditableListTab edit state)"
        status: pass
      - kind: manual_procedural
        ref: "No browser-driving tool available to this executor; `next build` succeeded and the /configuracoes route still renders (ƒ dynamic)"
        status: unknown
    human_judgment: true
    rationale: "No jsdom/React Testing Library infra exists in this project (vitest.config.ts environment is \"node\", include pattern is tests/**/*.test.ts only) and no browser tool was available to this executor to drive the actual edit-in-place flow visually — tsc/build/lint confirm it compiles, but the interactive rename needs human/UAT confirmation, same posture as 03-01's D1"
  - id: D2
    description: "Supervisor clicks EyeOff, confirms the low-friction deactivate dialog, and the value disappears from new-cadastro dropdowns without anything being deleted from the database (D-03)"
    requirement: "ADM-01"
    verification:
      - kind: unit
        ref: "grep confirms no `.delete(` call and no `Trash2` import anywhere in app/actions/listas.ts or components/configuracoes/EditableListTab.tsx"
        status: pass
      - kind: manual_procedural
        ref: "No browser-driving tool available to this executor to visually confirm the dialog copy/behavior end-to-end"
        status: unknown
    human_judgment: true
    rationale: "Same lack of component-test infra as D1 — the grep proves the soft-delete code-shape guarantee statically, but the dialog's actual open/confirm/close UX needs human/UAT confirmation"
  - id: D3
    description: "Toggling 'Mostrar inativos' reveals deactivated values with an 'Inativo' badge and lets the Supervisor reactivate them via Eye"
    requirement: "ADM-01"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (Switch/showInactive filter, Badge outline variant, reactivate handler type-check)"
        status: pass
      - kind: manual_procedural
        ref: "No browser-driving tool available to this executor to visually confirm the toggle/badge/reactivate flow"
        status: unknown
    human_judgment: true
    rationale: "Same lack of component-test infra as D1/D2 — recommend a manual pass or /gsd-verify-work before signing off ADM-01's full UI slice"

duration: ~20min
completed: 2026-07-18
status: complete
---

# Phase 3 Plan 2: Editar, Desativar, Reativar (Categoria) Summary

**EditableListTab is now a full CRUD list — edit-in-place, low-friction deactivate/reactivate soft-delete, and a "Mostrar inativos" Switch — closing ADM-01 for the Categoria tab, backed by two new Supervisor-only Server Actions that only ever `.update()`, never `.delete()`.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-18T00:26:00Z (approx, per session continuity in STATE.md)
- **Completed:** 2026-07-18T00:46:07Z
- **Tasks:** 2/2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Added `updateListaValor` (renames a lookup row in place — D-04 — mapping Postgres' 23505 unique-violation to `duplicate_nome` and a 0-row result to `not_found`) and `setListaValorAtivo` (the soft-delete toggle — D-03 — an `.update({ ativo })` that is NEVER a `.delete()`, so a cliente already referencing a deactivated value keeps working) to `app/actions/listas.ts`, both Supervisor-only via the same defense-in-depth check used by `createListaValor`.
- Installed `components/ui/switch.tsx` from the official shadcn registry — confirmed zero new npm runtime dependency (`package.json`'s `dependencies` block is unchanged; the component is built on the already-installed `@base-ui/react`).
- Extended `EditableListTab` into a fully editable list: pencil-triggered inline edit (Input + Check/X, Enter-to-save/Escape-to-cancel), an `EyeOff`-triggered low-friction `Dialog` for deactivation (secondary/neutral confirm button, never `destructive`), a direct `Eye` reactivate action with no dialog, and a "Mostrar inativos" `Switch` (OFF by default) that reveals inactive rows with an outline "Inativo" `Badge` — completing ADM-01 for the Categoria tab and leaving the component ready for 03-03's other 3 tabs with no rework expected.

## Task Commits

Each task was committed atomically:

1. **Task 1: Instalar Switch + Server Actions de editar e (des)ativar** - `6998390` (feat)
2. **Task 2: EditableListTab — edição inline, diálogo de desativação, reativação e "Mostrar inativos"** - `93700d2` (feat)

**Plan metadata:** _pending final commit (see below)_

## Files Created/Modified
- `components/ui/switch.tsx` - shadcn official registry Switch component (built on `@base-ui/react`, no new npm dependency).
- `app/actions/listas.ts` - Added `updateListaValor` (rename, 23505 → `duplicate_nome`, 0-rows → `not_found`) and `setListaValorAtivo` (soft-delete toggle, `.update({ ativo })` only).
- `components/configuracoes/EditableListTab.tsx` - Added `editingId`/`editingNome` inline-edit state, deactivate confirmation `Dialog`, direct reactivate action, and `showInactive` Switch-driven filter with an "Inativo" `Badge` on inactive rows.

## Decisions Made
- Row-scoped errors (duplicate-name on edit, generic failure on deactivate) render inline in their own context — under the edit `Input` for rename, inside the `Dialog` for deactivate — rather than reusing the shared top banner, since these errors are only actionable right where they appear (matches `PerdaMotivoDialog`'s own-dialog-owns-its-error precedent).
- Reactivate intentionally has no confirmation dialog (only deactivate does) — this was explicit in the plan's own action spec, not a shortcut: D-03 treats "come back" as the deliberately low-friction direction.
- The deactivate dialog's confirm button uses `variant="secondary"`, never `variant="destructive"` — reflected directly from the UI-SPEC's Color contract, since deactivating a lookup value is reversible and red would overstate the risk.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

Task 2 was marked `tdd="true"` and includes a `<behavior>` block, but — same as 03-01's Task 3 — its own `<verify>`/`<acceptance_criteria>` specify only `npx tsc --noEmit`, with no test file named and no RED/GREEN gate defined. This project's `vitest.config.ts` still runs with `environment: "node"` and only includes `tests/**/*.test.ts` — there is no jsdom/React Testing Library component-test infrastructure to author a RED test against (confirmed unchanged since 03-01). Introducing that infrastructure is out of this plan's scope (a Rule 4 architectural decision, not auto-fixable mid-task). Task 2 was executed as a standard auto task instead: implemented directly, verified via `tsc --noEmit`, `eslint`, and `next build` (all clean). No RED/GREEN/REFACTOR commits exist for Task 2 as a result — flagged here per the TDD Gate Compliance instruction rather than silently proceeding.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `updateListaValor`/`setListaValorAtivo` and the extended `EditableListTab` (edit/deactivate/reactivate/toggle) are ready for 03-03 to wire the remaining 3 `TabsTrigger`/`TabsContent` pairs (Produtos consumidos, Tipos de tarefa, Motivos de perda) directly, with no rework expected — the component is already fully generic over `tabela`/`inputPlaceholder`/`pluralAtivoLabel`.
- Same open item as 03-01: the interactive edit/deactivate/reactivate/toggle flows have not been visually/manually confirmed in a running browser by this executor (no browser-driving tool was available). Recommend a manual pass (or `/gsd-verify-work`) covering all three coverage items (D1/D2/D3 above) before considering ADM-01's Categoria-tab UI slice fully signed off.

---
*Phase: 03-administra-o-de-listas-edit-veis*
*Completed: 2026-07-18*

## Self-Check: PASSED

All 3 claimed files confirmed present on disk (`components/ui/switch.tsx`, `app/actions/listas.ts`, `components/configuracoes/EditableListTab.tsx`); both task commit hashes (`6998390`, `93700d2`) confirmed present in git history.
