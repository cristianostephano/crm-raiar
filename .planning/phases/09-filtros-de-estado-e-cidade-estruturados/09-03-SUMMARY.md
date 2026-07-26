---
phase: 09-filtros-de-estado-e-cidade-estruturados
plan: 03
subsystem: ui
tags: [typescript, zod, react-hook-form, base-ui, combobox, vitest, tdd]

# Dependency graph
requires: ["09-01", "09-02"]
provides:
  - "lib/validations/cliente.ts: estado: z.enum(UFS) in createClienteSchema and updateClienteSchema"
  - "components/clientes/EstadoCidadeFields.tsx: shared Estado->Cidade cascade component (Select over UFS + Combobox over cidades_por_estado RPC)"
affects: [09-04, 09-05, 09-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reusable react-hook-form field-group component generic over a shared field-shape constraint (EstadoCidadeFormShape), consumable by both CreateClienteInput and UpdateClienteInput without duplicating cascade wiring"
    - "Cascading RPC-driven Combobox: useEffect keyed on the watched Estado value, cancelled-guard cleanup, disabled-until-parent-chosen"

key-files:
  created:
    - components/clientes/EstadoCidadeFields.tsx
    - tests/clientes/estado-cidade-fields.test.tsx
  modified:
    - lib/validations/cliente.ts
    - tests/clientes/cliente-actions.test.ts
    - components/clientes/ClienteQuickCreateForm.tsx
    - components/clientes/ClienteDetailSheet.tsx

key-decisions:
  - "estado uses z.enum(UFS, { message }) directly (no .refine/.superRefine) in both schemas, per 09-PATTERNS.md — z.enum stays a plain ZodEnum and doesn't turn into ZodEffects, so @hookform/resolvers' generic inference against zod v4 stays intact (same reasoning already documented for why responsavel avoids per-field .refine())"
  - "cidade stays z.string().min(1, ...) in the Zod layer — only the error copy changed to match UI-SPEC's Copywriting Contract ('Selecione uma cidade válida.'); DB-dependent cidade-belongs-to-estado validity is deferred to 09-06's Server Action re-validation, per 09-PATTERNS.md"
  - "EstadoCidadeFields is generic over TFieldValues extends FieldValues & { complemento?: string; cidade: string; estado: string } rather than hardcoded to CreateClienteInput/UpdateClienteInput, so the one component serves both forms without a union-type hack; field-path literals are cast via Path<TFieldValues>/PathValue<TFieldValues, ...> since TS can't structurally prove membership for an open generic"
  - "Rule 3 auto-fix: enum-narrowing estado from string to Uf broke two files NOT in this plan's scope (ClienteQuickCreateForm.tsx's defaultValues, ClienteDetailSheet.tsx's defaultValues + toFormValues) — applied the minimal 'as Uf' cast with inline comments at exactly those 3 spots to keep npx tsc --noEmit clean, without redoing the Input->EstadoCidadeFields swap those two files need (that swap is 09-05's scope)"

patterns-established:
  - "Shared cascade field-group components live under components/clientes/ and take (control, watch, setValue) from the consuming form's useForm() rather than owning their own form instance — keeps a single react-hook-form registration per screen"

requirements-completed: [LOC-01, LOC-02]

coverage:
  - id: D1
    description: "createClienteSchema and updateClienteSchema both validate estado with z.enum(UFS) (message 'Selecione um estado válido.'), rejecting any value outside the 27 siglas"
    requirement: "LOC-01"
    verification:
      - kind: unit
        ref: "tests/clientes/cliente-actions.test.ts#createClienteSchema/updateClienteSchema accept 'SP' and all 27 UFs, reject 'São Paulo' and 'XX' with an issue on path ['estado']"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (clean, project-wide)"
        status: pass
    human_judgment: false
  - id: D2
    description: "EstadoCidadeFields shared component (Estado Select over UFS + Cidade Combobox over cidades_por_estado) usable by both forms"
    requirement: "LOC-01/LOC-02"
    verification:
      - kind: unit
        ref: "tests/clientes/estado-cidade-fields.test.tsx#renders Estado and Cidade labels"
        status: pass
      - kind: other
        ref: "grep: EstadoCidadeFields.tsx uses cidades_por_estado + disabled"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cidade is disabled until an Estado is chosen; changing Estado resets Cidade and reloads that UF's municipality list (D-02)"
    requirement: "LOC-02/D-02"
    verification:
      - kind: unit
        ref: "tests/clientes/estado-cidade-fields.test.tsx#starts Cidade disabled with the 'Escolha o Estado primeiro' placeholder until Estado is chosen"
        status: pass
      - kind: unit
        ref: "tests/clientes/estado-cidade-fields.test.tsx#never calls the mocked cidades_por_estado RPC while no Estado is selected"
        status: pass
      - kind: human
        ref: "Full Estado-change -> Cidade-reset interaction (Base UI Select/Combobox popup open+select) deferred to /gsd-verify-work manual pass, per plan's own jsdom-instability escape hatch"
        status: pending
    human_judgment: true

duration: ~35min
completed: 2026-07-26
status: complete
---

# Phase 9 Plan 3: Estado z.enum(UFS) Schema + EstadoCidadeFields Cascade Component Summary

**Zod schemas for cliente creation/edit now validate `estado` against the fixed 27-UF enum, and a new shared `EstadoCidadeFields` component encapsulates the Estado→Cidade cascade (Select over `UFS` + RPC-driven searchable Combobox, disabled-until-Estado, reset-on-change) — ready for the cadastro/edição forms to consume in plan 09-05.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed (Task 1 was TDD: test → feat; Task 2 built component + test together)
- **Files modified:** 2 created, 4 modified

## Accomplishments

- `lib/validations/cliente.ts`: `estado: z.enum(UFS, { message: "Selecione um estado válido." })` in both `createClienteSchema` and `updateClienteSchema`; `cidade`'s message updated to `"Selecione uma cidade válida."` to match the UI-SPEC Copywriting Contract (its Zod type stays `z.string().min(1, ...)` — DB-dependent city-belongs-to-state validity is 09-06's job)
- `tests/clientes/cliente-actions.test.ts`: extended `createClienteSchema` describe block + added an analogous `updateClienteSchema` describe block, covering: accepts `'SP'`, accepts all 27 UFs (looped), rejects a full state name (`'São Paulo'`), rejects an invalid sigla (`'XX'`) — 8 new test cases total
- `components/clientes/EstadoCidadeFields.tsx`: new shared Client Component rendering the full `grid grid-cols-3 gap-3` Complemento/Cidade/Estado row — Estado is a required `Select` over `UFS` (no sentinel), Cidade is a `Combobox` populated from `createClient().rpc("cidades_por_estado", { p_uf: estado })`, `disabled={!estado}`, placeholder cycles through "Escolha o Estado primeiro" / "Selecione a cidade" / "Buscar cidade..." (open state), and picking a new Estado calls `setValue("cidade", "")` to reset the cascade (D-02)
- `tests/clientes/estado-cidade-fields.test.tsx`: `createClient()` mocked via `vi.mock`; proves both field labels render, Cidade starts disabled with the D-02 placeholder, the RPC is never called before an Estado is chosen, and the mocked wiring never throws

## Task Commits

Each task was committed atomically (Task 1 followed TDD RED -> GREEN):

1. **Task 1 RED: failing tests for estado z.enum(UFS)** - `642ef53` (test)
2. **Task 1 GREEN: estado becomes z.enum(UFS) in both schemas + Rule 3 compile fix** - `5468818` (feat)
3. **Task 2: EstadoCidadeFields shared cascade component + test** - `5818764` (feat)

**Plan metadata:** commit created after this summary (see below)

## Files Created/Modified

- `lib/validations/cliente.ts` - `estado` narrowed from free-text to `z.enum(UFS)` in both schemas; `cidade` error copy aligned to UI-SPEC
- `tests/clientes/cliente-actions.test.ts` - 8 new unit tests (4 for createClienteSchema, 4 for updateClienteSchema) covering the estado enum contract
- `components/clientes/EstadoCidadeFields.tsx` - new shared Estado→Cidade cascade component
- `tests/clientes/estado-cidade-fields.test.tsx` - new behavior test (createClient mocked)
- `components/clientes/ClienteQuickCreateForm.tsx` - minimal Rule 3 compile fix (`estado: "" as Uf` in `defaultValues`, with inline comment); no structural/UI change
- `components/clientes/ClienteDetailSheet.tsx` - minimal Rule 3 compile fix (`estado: "" as Uf` in `defaultValues`, `estado: cliente.estado as Uf` in `toFormValues`, with inline comments referencing D-01/UI-SPEC §5); no structural/UI change

## Decisions Made

- Kept `estado: z.enum(UFS)` un-refined (no `.superRefine`/`.refine`), per 09-PATTERNS.md's explicit warning that chaining `.refine()` onto a field turns it into `ZodEffects` and breaks `@hookform/resolvers`' generic inference against zod v4 — the same class of bug already documented in this file for `responsavel`.
- `EstadoCidadeFields` takes `control`/`watch`/`setValue` from the consumer's own `useForm()` (not an internal form instance), generic over `TFieldValues extends FieldValues & { complemento?: string; cidade: string; estado: string }` — lets the same component serve `CreateClienteInput` and `UpdateClienteInput` without a union-type special case. Field-path literals (`"cidade"`, `"estado"`, `"complemento"`) are cast via `Path<TFieldValues>` since TypeScript can't structurally prove key membership for an open generic parameter, even though the generic constraint guarantees it at the call site.
- Combobox placeholder cycles through three states by tracking the Combobox's own `onOpenChange` in local state (`cidadeOpen`), reproducing UI-SPEC's distinct "disabled" / "enabled, closed" / "enabled, open (searching)" placeholder copy using the single input-based Combobox primitive (Base UI's Combobox doesn't have a separate closed-trigger + open-search-box pair the way `Select` does).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking compile issue caused by this task's schema change] `estado: z.enum(UFS)` broke ClienteQuickCreateForm.tsx and ClienteDetailSheet.tsx**
- **Found during:** Task 1, running `npx tsc --noEmit` per the task's own acceptance criteria.
- **Issue:** Narrowing `estado`'s Zod type from `z.string()` to `z.enum(UFS)` (type `Uf`, a 27-way string literal union) made `ClienteQuickCreateForm.tsx`'s `defaultValues: CreateClienteInput = { ..., estado: "" }` and `ClienteDetailSheet.tsx`'s equivalent `defaultValues` + its `toFormValues()` helper (which assigns `cliente.estado: string` — a legacy DB value that can be outside the 27-UF enum per D-01/UI-SPEC §5 — to `UpdateClienteInput.estado: Uf`) fail to type-check. Neither file is in 09-03's `files_modified` list; both are explicitly 09-05's scope (dropping in `EstadoCidadeFields` to replace their `Input`-based cidade/estado block).
- **Fix:** Applied the minimal `as Uf` cast at exactly the 3 break points (both `defaultValues.estado: "" as Uf`, and `toFormValues`'s `estado: cliente.estado as Uf`), each with an inline comment explaining the cast and pointing to 09-05 for the real structural fix. No other line in either file was touched — the `Input`-based cidade/estado UI in both forms is untouched, exactly as 09-03's scope intends.
- **Files modified:** `components/clientes/ClienteQuickCreateForm.tsx`, `components/clientes/ClienteDetailSheet.tsx`
- **Commit:** `5468818`

## Known Stubs

None — no hardcoded empty/placeholder data introduced. The Rule 3 casts above are type-level bridges only; both forms' actual rendered UI (still `Input`-based for cidade/estado) is unchanged and will be replaced by `EstadoCidadeFields` in 09-05.

## Issues Encountered

Running the full `tests/clientes/cliente-actions.test.ts` file (beyond just the schema-focused tests this plan targets) surfaces 7 pre-existing failures, all `Missing required environment variable "NEXT_PUBLIC_SUPABASE_URL"` — these are RLS/Server-Action integration tests requiring a live Supabase project via `.env.local`, which isn't present in this worktree's execution environment (same class of gap already documented in 09-02-SUMMARY.md). Unrelated to this plan's scope; the schema-focused subset (11 tests) and the new component test file (4 tests) both pass cleanly, as does `npx tsc --noEmit` project-wide.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `estado: z.enum(UFS)` is live in both cliente schemas — 09-06's Server Action re-validation and 09-04's importação validation can rely on the same enum.
- `EstadoCidadeFields` is ready for 09-05 to drop into `ClienteQuickCreateForm.tsx` and `ClienteDetailSheet.tsx` in place of their existing `Input`-based cidade/estado block (the Rule 3 casts documented above mark exactly where that swap needs to happen).
- No blockers for downstream waves from this plan.

## Self-Check: PASSED

All 2 created files confirmed present on disk (`components/clientes/EstadoCidadeFields.tsx`, `tests/clientes/estado-cidade-fields.test.tsx`). All 3 task commits confirmed in `git log` (`642ef53`, `5468818`, `5818764`).

---
*Phase: 09-filtros-de-estado-e-cidade-estruturados*
*Completed: 2026-07-26*
