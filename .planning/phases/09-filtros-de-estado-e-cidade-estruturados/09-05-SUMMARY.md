---
phase: 09-filtros-de-estado-e-cidade-estruturados
plan: 05
subsystem: ui
tags: [react-hook-form, base-ui, select, combobox, cliente-forms]

# Dependency graph
requires:
  - phase: 09-filtros-de-estado-e-cidade-estruturados (plan 03)
    provides: "EstadoCidadeFields shared component (Select de UF + Combobox de cidade em cascata) and z.enum(UFS) schema"
provides:
  - "ClienteQuickCreateForm.tsx (cadastro rapido) using structured Estado/Cidade selectors instead of free-text Inputs"
  - "ClienteDetailSheet.tsx (edicao) using the same structured selectors, with legacy out-of-UFS estado values rendering/editing without custom UI"
affects: [09-06, filtros-de-estado-e-cidade-estruturados]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Form field row replacement: swap an inline grid-cols-3 FormField block for a single shared component that owns the whole row"
    - "Select items prop for pre-selected-on-mount values (Base UI Select.Value label resolution before first popup open)"

key-files:
  created: []
  modified:
    - components/clientes/ClienteQuickCreateForm.tsx
    - components/clientes/ClienteDetailSheet.tsx

key-decisions:
  - "Left the two pre-existing 'as Uf' type-narrowing casts in defaultValues/toFormValues untouched, per plan's explicit instruction not to touch defaultValues -- those casts exist because Zod's z.enum(UFS) narrows the field type to Uf and there is no valid empty-string Uf, which is a type-level fact unrelated to the Input-to-Select UI swap this plan performs"
  - "Passed estadoItems={UFS.map(uf => ({value: uf, label: uf}))} in ClienteDetailSheet only (not in the create form), matching the existing items-prop convention already used by this Sheet's other pre-selected Selects (Responsavel/Categoria/Status), since the create form's Estado field always starts unselected and never hits that codepath"

requirements-completed: [LOC-01, LOC-02]

coverage:
  - id: D1
    description: "ClienteQuickCreateForm (cadastro rapido) renders EstadoCidadeFields (Select de UF + Combobox de cidade em cascata) instead of free-text Cidade/Estado Inputs, with Complemento unchanged as first column"
    requirement: "LOC-01"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (components/clientes/ClienteQuickCreateForm.tsx)"
        status: pass
      - kind: other
        ref: "node -e grep check: EstadoCidadeFields used, no FormField name=cidade/estado wrapping an Input"
        status: pass
    human_judgment: true
    rationale: "Visual/functional verification of the cascade (choosing a UF, searching a city, layout parity) is deferred to /gsd-verify-work per this plan's VALIDATION.md Manual-Only note -- automated checks only prove the component swap compiles and no stale free-text Input remains."
  - id: D2
    description: "ClienteDetailSheet (edicao) renders EstadoCidadeFields with estadoItems so the pre-selected Estado value resolves its label on Sheet open; a legacy out-of-UFS estado value renders/edits without any custom warning UI (UI-SPEC section 5)"
    requirement: "LOC-02"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (components/clientes/ClienteDetailSheet.tsx)"
        status: pass
      - kind: other
        ref: "node -e grep check: EstadoCidadeFields used, no FormField name=cidade/estado wrapping an Input"
        status: pass
    human_judgment: true
    rationale: "Legacy-value fallback behavior and cascade UX with a large-dataset state (SP) require opening the Sheet against real/seeded data -- deferred to /gsd-verify-work per this plan's VALIDATION.md Manual-Only note."

# Metrics
duration: 20min
completed: 2026-07-26
status: complete
---

# Phase 9 Plan 5: Structured Estado/Cidade Fields in Cliente Forms Summary

**ClienteQuickCreateForm and ClienteDetailSheet both consume the shared EstadoCidadeFields component (Select de UF + cascading Combobox de Cidade) instead of duplicating free-text Estado/Cidade Inputs.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments
- `ClienteQuickCreateForm.tsx` (cadastro rapido): the `grid grid-cols-3 gap-3` Complemento/Cidade/Estado row now renders `<EstadoCidadeFields control={form.control} watch={form.watch} setValue={form.setValue} />` in place of the two free-text `Input`s, keeping Complemento as the first column and the row's layout/column-count/order unchanged.
- `ClienteDetailSheet.tsx` (edicao): the same row swap, plus `estadoItems={UFS.map((uf) => ({ value: uf, label: uf }))}` passed to `EstadoCidadeFields` so the Estado `Select` resolves the pre-selected UF's label as soon as the Sheet opens (same `items` convention this file already uses for its Responsavel/Categoria/Status Selects, per the file's own header comment on why every pre-selected Select here needs an `items` lookup).
- A legacy `cliente.estado` value outside the 27-UF enum (old/dirty data, `chk_estado_valido` staying `NOT VALID` for those rows) now falls back silently via the Select's native "value not in items" behavior -- no custom warning UI was added, matching UI-SPEC section 5's explicit "no blocking UI" requirement.
- Both forms no longer duplicate the Estado/Cidade cascade logic -- it lives exclusively in `EstadoCidadeFields.tsx` (09-03).

## Task Commits

1. **Task 1: ClienteQuickCreateForm usa EstadoCidadeFields no lugar dos Inputs de Cidade/Estado** - `75ce0b8` (feat)
2. **Task 2: ClienteDetailSheet usa EstadoCidadeFields; valor legado de Estado renderiza/edita normalmente** - `f9e2473` (feat)

_No TDD tasks in this plan -- both are `type="auto"` UI wiring tasks._

## Files Created/Modified
- `components/clientes/ClienteQuickCreateForm.tsx` - Cidade/Estado free-text Inputs replaced by `<EstadoCidadeFields>`; added the component import; no other fields (razaoSocial/cep/numero/rua/responsavel) touched.
- `components/clientes/ClienteDetailSheet.tsx` - Same replacement, plus `estadoItems` prop wired from `UFS`; `UFS` value import added alongside the existing `Uf` type import; Funil section, delete flow, and all other fields untouched.

## Decisions Made
- Left the pre-existing `as Uf` casts in both files' `defaultValues`/`toFormValues` untouched. The plan's Task 1/Task 2 `<action>` explicitly said "não mexer em defaultValues" (create form) and only described `toFormValues`'s legacy-estado comment in the context of *why* an `items` prop is needed on the edit Sheet's Select -- it did not ask for the cast itself to be removed. These casts exist because `estado: z.enum(UFS)` narrows the RHF field type to `Uf`, and there is no valid empty-string `Uf` value (create form's initial `""`) nor a compile-time guarantee that a legacy DB string is a valid `Uf` (edit Sheet's `cliente.estado`) -- both are type-level facts independent of whether the field renders as an `Input` or a `Select`, so removing them would either break the build (create form) or reintroduce an unsound `any`-adjacent workaround (edit Sheet). No functional behavior depends on removing them.
- Passed `estadoItems` only in `ClienteDetailSheet.tsx`, not in `ClienteQuickCreateForm.tsx`. The create form's Estado field always starts unselected (`""`), so Base UI's Select never needs to resolve a label for a value it doesn't have registered `SelectItem`s for yet on first mount -- it only needs `items` when a value is pre-selected before the popup has ever opened, which is exactly the edit Sheet's situation (mirrors this file's own documented rationale for why Responsavel/Categoria/Status Selects here all pass `items`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None specific to this plan's file changes. `npx vitest run` reports the same pre-existing 166 failed / 134 passed split before and after both task commits -- every failure is `Error: Missing required environment variable "NEXT_PUBLIC_SUPABASE_URL"` from `tests/helpers/supabase-test-clients.ts`, an environment condition (no `.env.local` / local Supabase instance in this worktree) unrelated to and unaffected by either of this plan's two component edits. Confirmed out of scope per the deviation rules' Scope Boundary (pre-existing failures in unrelated setup, not caused by this plan's changes) and left untouched; logged here rather than in a separate `deferred-items.md` since it's an environment gap, not a code defect to defer.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- LOC-01/LOC-02's UI-facing requirement is now fully wired: both cliente forms use the structured Estado Select + cascading Cidade Combobox, with zero duplication of the cascade logic.
- Server-side re-validation (Zod `z.enum(UFS)` already lands via 09-03's schema change; the DB-dependent "cidade belongs to cidades_por_estado(estado)" check in the Server Actions) is explicitly out of this plan's scope and is 09-06's job, per this plan's own threat register (T-09-05).
- Manual/visual verification of the cascade (choosing a UF, searching among ~645 SP municipalities, legacy-value Sheet-open behavior) is deferred to `/gsd-verify-work` per VALIDATION.md's Manual-Only designation -- nothing here blocks that step.

---
*Phase: 09-filtros-de-estado-e-cidade-estruturados*
*Completed: 2026-07-26*

## Self-Check: PASSED

- FOUND: components/clientes/ClienteQuickCreateForm.tsx
- FOUND: components/clientes/ClienteDetailSheet.tsx
- FOUND: .planning/phases/09-filtros-de-estado-e-cidade-estruturados/09-05-SUMMARY.md
- FOUND: commit 75ce0b8
- FOUND: commit f9e2473
