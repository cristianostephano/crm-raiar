---
phase: 09-filtros-de-estado-e-cidade-estruturados
plan: 02
subsystem: ui
tags: [typescript, zod, shadcn, base-ui, combobox, vitest, tdd]

# Dependency graph
requires: []
provides:
  - "lib/clientes/ufs.ts: `UFS` as-const array of the 27 Brazilian UF siglas + `type Uf`"
  - "lib/clientes/normalizarEstado.ts: pure normalization function (LOC-04)"
  - "components/ui/combobox.tsx + components/ui/input-group.tsx: shadcn base-nova (Base UI) searchable combobox primitive"
affects: [09-03, 09-04, 09-05, 09-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure, dependency-free normalization function extracted alongside its constant, mirroring lib/importacao/dedupe.ts's normalizeRazaoSocial precedent"
    - "shadcn component installed via CLI file-copy (not npm), matching the project's existing components/ui/select.tsx provenance"

key-files:
  created:
    - lib/clientes/ufs.ts
    - lib/clientes/normalizarEstado.ts
    - tests/clientes/estado-normalizacao.test.ts
    - components/ui/combobox.tsx
    - components/ui/input-group.tsx
  modified: []

key-decisions:
  - "normalizarEstado's nome->sigla map lives in lib/clientes/normalizarEstado.ts itself (not imported from elsewhere) since it's the conceptual source-of-truth the 09-01 migration's backfill SQL mirrors, per PATTERNS.md"
  - "Left the shadcn CLI-generated combobox.tsx/input-group.tsx untouched — visual-parity tokens (h-8, rounded-lg, border-input, bg-transparent, disabled:opacity-50, bg-popover, shadow-md, ring-1 ring-foreground/10) are already present, just distributed across InputGroup+Input instead of a single button trigger (Combobox is a text-input widget by nature, unlike Select's button trigger)"

patterns-established:
  - "Pattern: pure frontend constants (`as const` arrays) that feed both a Zod z.enum and UI pickers live under lib/clientes/"

requirements-completed: [LOC-01, LOC-02, LOC-04]

coverage:
  - id: D1
    description: "UFS constant: as-const array of exactly the 27 Brazilian UF siglas, importable by Zod/forms/filter (LOC-01)"
    requirement: "LOC-01"
    verification:
      - kind: unit
        ref: "tests/clientes/estado-normalizacao.test.ts#UFS has exactly 27 siglas, includes known UFs, and has no duplicates"
        status: pass
      - kind: unit
        ref: "tests/clientes/estado-normalizacao.test.ts#UFS does not contain an invalid sigla"
        status: pass
    human_judgment: false
  - id: D2
    description: "normalizarEstado pure function maps direct siglas and full state names (accent/case-insensitive) to the correct UF, with a non-blocking fallback for unrecognized values (LOC-04)"
    requirement: "LOC-04"
    verification:
      - kind: unit
        ref: "tests/clientes/estado-normalizacao.test.ts#normalizarEstado maps a direct sigla, case/whitespace-insensitive, to the upper sigla"
        status: pass
      - kind: unit
        ref: "tests/clientes/estado-normalizacao.test.ts#normalizarEstado maps a full state name (accent/case-insensitive, LOC-04) to the correct sigla"
        status: pass
      - kind: unit
        ref: "tests/clientes/estado-normalizacao.test.ts#normalizarEstado falls back to trim+upper for an unrecognized value, without throwing (D-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "shadcn base combobox (Base UI, base-nova preset) available in components/ui/, zero new npm dependency, visual parity with Select"
    requirement: "LOC-02"
    verification:
      - kind: unit
        ref: "node -e verify script (plan 09-02 Task 2 <verify> block): combobox.tsx exists, imports @base-ui/react, @base-ui/react already in package.json"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit (clean)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-26
status: complete
---

# Phase 9 Plan 2: UFS Constant, normalizarEstado, and shadcn Combobox Summary

**Pure, database-independent frontend building blocks (UFS constant, normalizarEstado, shadcn Combobox primitive) that Phase 9's Waves 2-3 consumers depend on — zero DB/migration files touched, runs in parallel with plan 09-01.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed (Task 1 was TDD: test → feat)
- **Files modified:** 5 created, 0 modified

## Accomplishments
- `lib/clientes/ufs.ts`: `UFS` (`as const`, 27 UF siglas, alphabetical) + `type Uf`, ready to feed `z.enum(UFS)` in 09-03
- `lib/clientes/normalizarEstado.ts`: pure function (no I/O, no Supabase, no "use client"/"use server") mapping direct siglas and full state names (accent/case-insensitive) to the correct UF, with a non-blocking `trim().toUpperCase()` fallback for unrecognized values (D-01) — mirrors `lib/importacao/dedupe.ts`'s `normalizeRazaoSocial` precedent, and its internal nome→sigla map is the source-of-truth the 09-01 migration's backfill SQL mirrors
- `tests/clientes/estado-normalizacao.test.ts`: 5 unit tests covering the UFS contract (27 items, no duplicates, no invalid sigla) and normalizarEstado's 3 behavior cases
- `components/ui/combobox.tsx` + `components/ui/input-group.tsx`: installed via `npx shadcn@latest add combobox` (file copy onto the base-nova/Base UI preset already configured in `components.json`) — zero new npm dependency; `@base-ui/react` was already installed and in production use by `components/ui/select.tsx`

## Task Commits

Each task was committed atomically (Task 1 followed TDD RED -> GREEN):

1. **Task 1 RED: failing test for UFS + normalizarEstado** - `2b660df` (test)
2. **Task 1 GREEN: implement UFS + normalizarEstado** - `66131f3` (feat)
3. **Task 2: shadcn combobox base component** - `a76fb55` (feat)

**Plan metadata:** commit created after this summary (see below)

## Files Created/Modified
- `lib/clientes/ufs.ts` - `UFS` as-const array (27 siglas) + `type Uf`
- `lib/clientes/normalizarEstado.ts` - pure Estado normalization function + internal nome→sigla map
- `tests/clientes/estado-normalizacao.test.ts` - unit tests for both of the above
- `components/ui/combobox.tsx` - shadcn base-nova Combobox primitive (Base UI)
- `components/ui/input-group.tsx` - combobox's own file-copy dependency

## Decisions Made
- The nome→sigla map inside `normalizarEstado.ts` is treated as the conceptual source-of-truth that the 09-01 migration's backfill `UPDATE` statement mirrors (per 09-PATTERNS.md) — kept as a private `Record<string, Uf>` inside the module, not exported, since no other consumer needs the raw map (only the function's behavior).
- Left the shadcn-CLI-generated `combobox.tsx`/`input-group.tsx` unmodified: the plan's visual-parity checklist (h-8, text-sm, rounded-lg, border-input, bg-transparent, disabled:opacity-50, bg-popover, shadow-md, ring-1 ring-foreground/10) is already satisfied — just structured differently than `SelectTrigger` (a single button) because a Combobox trigger is inherently a text-input widget (`InputGroup` wrapping `Input`), not a button. No CLI-output divergence needed correcting.

## Deviations from Plan

None - plan executed exactly as written. The CLI installed `combobox.tsx` importing from `@base-ui/react` (the package root) rather than the `@base-ui/react/combobox` subpath mentioned in the plan's prose — this is the same npm package, no new dependency, and matches the plan's own verification script (`grep`s for `@base-ui/react`, not the subpath), so no fallback/hand-write was needed.

## Issues Encountered

Running the broader `tests/clientes tests/importacao` suite (beyond this plan's own new test file) surfaces 70 pre-existing failures, all `Missing required environment variable "NEXT_PUBLIC_SUPABASE_URL"` — these are integration tests requiring a local Supabase instance / `.env.local`, which is not configured in this execution environment. This is unrelated to this plan's scope (LOC-01/02/04, zero DB files touched, per the plan's own frontmatter `files_modified` list) and pre-dates this plan's changes. `tests/clientes/estado-normalizacao.test.ts` itself passes in isolation and within the full run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `UFS`, `normalizarEstado`, and the `Combobox`/`InputGroup` primitives are ready for 09-03 (Zod schema `z.enum(UFS)`) and 09-04/09-05 (form/filter wiring against `cidades_por_estado`).
- No blockers for downstream waves from this plan.

## Self-Check: PASSED

All 5 created files confirmed present on disk (`lib/clientes/ufs.ts`, `lib/clientes/normalizarEstado.ts`, `tests/clientes/estado-normalizacao.test.ts`, `components/ui/combobox.tsx`, `components/ui/input-group.tsx`). All 3 task commits confirmed in `git log` (`2b660df`, `66131f3`, `a76fb55`).

---
*Phase: 09-filtros-de-estado-e-cidade-estruturados*
*Completed: 2026-07-26*
