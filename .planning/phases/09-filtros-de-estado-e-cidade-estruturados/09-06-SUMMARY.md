---
phase: 09-filtros-de-estado-e-cidade-estruturados
plan: 06
subsystem: api
tags: [supabase, server-actions, validation, zod, importacao, rls]

requires:
  - phase: 09-01
    provides: "tabela cidades (seed IBGE) + RPC cidades_por_estado(p_uf)"
  - phase: 09-02
    provides: "lib/clientes/ufs.ts (UFS, type Uf)"
  - phase: 09-03
    provides: "z.enum(UFS) em createClienteSchema/updateClienteSchema"
provides:
  - "lib/clientes/cidadeValida.ts: cidadeValida/cidadeCanonica pure helpers, reused by annotarLinha and the Server Actions"
  - "annotarLinha.ts valida Estado (UFS) e Cidade (tabela cidades) e normaliza resolved.estado/resolved.cidade"
  - "validarLoteImportacao popula AnnotarLinhaLookups.cidades a partir de um select nome, uf from cidades"
  - "createCliente/updateCliente re-validam server-side que Cidade pertence a cidades_por_estado(estado) antes de gravar"
affects: [09-04, 09-05, phase-10-if-any-further-import-or-cliente-work]

tech-stack:
  added: []
  patterns:
    - "Server Action re-validates DB-dependent membership (cidade ∈ cidades_por_estado(estado)) that Zod alone cannot express, mirroring the project's existing 'never trust client input' convention"
    - "Pure validation helpers (cidadeValida/cidadeCanonica) shared between a batch-import pure function and Server Actions, same shape as lib/importacao/dedupe.ts's normalizeRazaoSocial reuse"

key-files:
  created:
    - lib/clientes/cidadeValida.ts
    - tests/clientes/cidade-valida.test.ts
  modified:
    - lib/importacao/annotarLinha.ts
    - tests/importacao/annotarLinha.test.ts
    - app/actions/importacao.ts
    - app/actions/clientes.ts

key-decisions:
  - "cidadeValida/cidadeCanonica live in lib/clientes/cidadeValida.ts as pure, Supabase-free functions so both annotarLinha (pure) and the Server Actions (DB-backed) can share the exact membership logic without duplicating it"
  - "annotarLinha's Estado/Cidade checks are additive to the existing required-field check (createImportRowSchema) — a blank Estado/Cidade still only produces the existing 'Endereço não informado' reason, never a duplicate reason"
  - "resolved.estado normalizes to uppercase UF only when it is a valid UFS member (else preserved as-is, row already flagged erro); resolved.cidade normalizes to the canonical IBGE nome only when cidadeCanonica finds a match"
  - "createCliente/updateCliente reuse the existing validation error code ('validation') for an invalid Cidade — no new error code needed, matching how the UI already surfaces Zod validation failures"

patterns-established:
  - "Any future Server Action writing estado/cidade to clientes must call cidades_por_estado + cidadeValida before insert/update, same as createCliente/updateCliente here"

requirements-completed: [LOC-01, LOC-02]

coverage:
  - id: D1
    description: "cidadeValida/cidadeCanonica pure helpers correctly determine cidade-estado membership and canonical nome, case/acento/trim-insensitive"
    requirement: "LOC-02"
    verification:
      - kind: unit
        ref: "tests/clientes/cidade-valida.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "annotarLinha rejects an invalid Estado (not one of the 27 UFs) with the exact Copywriting Contract reason"
    requirement: "LOC-01"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinha.test.ts#flags an estado that is not one of the 27 UF siglas (LOC-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "annotarLinha rejects a Cidade that does not belong to the chosen Estado, checked against the cidades lookup"
    requirement: "LOC-02"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinha.test.ts#flags a cidade that does not belong to the chosen estado (LOC-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "annotarLinha normalizes resolved.estado to uppercase UF and resolved.cidade to the canonical IBGE nome for a valid row"
    requirement: "LOC-01"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinha.test.ts#resolves estado to uppercase UF and cidade to the canonical IBGE nome (LOC-01/LOC-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "validarLoteImportacao populates AnnotarLinhaLookups.cidades from a narrow select(nome, uf) on the cidades table, without touching confirmarLoteImportacao or the is_supervisor gate"
    verification:
      - kind: other
        ref: "node -e grep check confirming supabase.from(\"cidades\").select(\"nome, uf\") and cidades passed into AnnotarLinhaLookups"
        status: pass
    human_judgment: false
  - id: D6
    description: "createCliente and updateCliente re-validate server-side that the submitted Cidade belongs to cidades_por_estado(estado) before insert/update, returning { error: { code: \"validation\" } } when it doesn't"
    requirement: "LOC-02"
    verification:
      - kind: other
        ref: "node -e grep check confirming cidades_por_estado + cidadeValida called in both createCliente and updateCliente"
        status: pass
      - kind: manual_procedural
        ref: "createCliente/updateCliente cannot be invoked directly from Vitest (next/headers cookies require a live Next.js request scope) — same documented limitation as tests/clientes/cliente-actions.test.ts; behavior is proven by the cidadeValida unit tests (D1) + the cidades_por_estado RPC integration test (09-01) + this grep check"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-26
status: complete
---

# Phase 9 Plan 6: Server-side Estado/Cidade validation backstop Summary

**Pure `cidadeValida`/`cidadeCanonica` helpers now back both the spreadsheet-import validation (`annotarLinha`) and the `createCliente`/`updateCliente` Server Actions, closing the gap where a crafted request could still submit a Cidade that doesn't belong to the chosen Estado.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-26T19:25:00-03:00 (approx, first commit 19:25:49)
- **Completed:** 2026-07-26T19:34:00-03:00 (last commit 19:33:47)
- **Tasks:** 3 completed
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- New pure module `lib/clientes/cidadeValida.ts` exporting `cidadeValida` (membership check) and `cidadeCanonica` (canonical IBGE nome lookup), reusing `normalizeRazaoSocial` for case/acento/trim-insensitive comparison — same reusable-pure-function convention as `lib/importacao/dedupe.ts`.
- `annotarLinha` now validates a spreadsheet row's Estado against `UFS` and Cidade against the new `cidades` lookup, pushing the exact Copywriting Contract reasons (`Estado "..." não é uma sigla de UF válida` / `Cidade "..." não encontrada para o estado ...`), and normalizes `resolved.estado` (uppercase UF) + `resolved.cidade` (canonical IBGE nome) so Fase 7's bulk-insert RPC never violates `chk_estado_valido`.
- `validarLoteImportacao` populates the new `AnnotarLinhaLookups.cidades` field with a single narrow `select(nome, uf)` per batch, alongside the existing vendedores/categorias/produtos lookups — `confirmarLoteImportacao` and the `is_supervisor` gate are untouched.
- `createCliente` and `updateCliente` both call `cidades_por_estado(estado)` and re-check `cidadeValida` before every insert/update, returning `{ error: { code: "validation" } }` on a mismatch — closing the T-09-09 threat (a crafted direct call bypassing the client Combobox).

## Task Commits

Each task was committed atomically (Task 1 used TDD RED → GREEN for the pure helper, then an additive GREEN commit for annotarLinha):

1. **Task 1a: cidadeValida/cidadeCanonica (RED)** - `358ec4e` (test)
2. **Task 1b: cidadeValida/cidadeCanonica (GREEN)** - `528097a` (feat)
3. **Task 1c: annotarLinha Estado/Cidade validation + normalization** - `e7e7386` (feat, includes extended test file)
4. **Task 2: validarLoteImportacao populates cidades lookup** - `403c701` (feat)
5. **Task 3: createCliente/updateCliente re-validate Cidade** - `d84c535` (feat)

_Note: Task 1 followed RED → GREEN for the new pure module; the annotarLinha extension (part B/C of Task 1) was additive to already-passing existing tests, verified RED (new assertions failing) before the implementation commit._

## Files Created/Modified
- `lib/clientes/cidadeValida.ts` - Pure `cidadeValida`/`cidadeCanonica` helpers (no Supabase import)
- `tests/clientes/cidade-valida.test.ts` - Unit tests for the pure helpers (6 tests)
- `lib/importacao/annotarLinha.ts` - Adds `CidadeLookup` type, extends `AnnotarLinhaLookups` with `cidades`, validates+normalizes Estado/Cidade
- `tests/importacao/annotarLinha.test.ts` - Extended with `cidades` in fabricated lookups + 3 new test cases
- `app/actions/importacao.ts` - `validarLoteImportacao` reads `cidades` (select nome, uf) once per batch and populates the lookup
- `app/actions/clientes.ts` - `createCliente`/`updateCliente` re-validate Cidade via `cidades_por_estado` + `cidadeValida` before write

## Decisions Made
- Kept `cidadeValida`/`cidadeCanonica` fully pure (no Supabase, no "use client"/"use server") so the exact same logic is unit-testable without a DB and directly reusable from both a pure batch-validation function (`annotarLinha`) and DB-backed Server Actions.
- Reused the existing `"validation"` error code in `createCliente`/`updateCliente` for an invalid Cidade rather than introducing a new error code — the UI already has a generic path for this code, and the plan explicitly called for this reuse.
- Per the plan's own test guidance, `createCliente`/`updateCliente` behavior is proven indirectly (unit tests on `cidadeValida` + the RPC's own 09-01 integration test + a grep-based structural check), since these Server Actions cannot be invoked directly under Vitest (they need a live Next.js request scope for `next/headers` cookies) — this is a pre-existing, already-documented limitation (see `tests/clientes/cliente-actions.test.ts`'s own header comment), not something this plan needed to solve.

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched their `<action>` specs; no architectural changes, no new dependencies, no scope expansion beyond what was planned.

## Issues Encountered

None specific to this plan's code. The full `npx vitest run` (project-wide) reports pre-existing failures unrelated to this plan's files: every failure traces back to `Missing required environment variable "NEXT_PUBLIC_SUPABASE_URL"` — this worktree has no `.env.local` / local Supabase instance configured, so every RLS/integration test requiring `signInAs`/`serviceClient` fails regardless of what this plan changed. Confirmed this is pre-existing and not a regression by running only the touched-area test files with `npx vitest run tests/clientes/cidade-valida.test.ts tests/importacao/annotarLinha.test.ts` (21/21 pass) and the pure-schema subset of `tests/clientes/cliente-actions.test.ts` (17/17 pass, only the Supabase-instance-requiring tests in that same file fail with the identical pre-existing env error). `npx tsc --noEmit` is clean.

## User Setup Required

None - no external service configuration required. (The pre-existing `.env.local`/local Supabase setup needed for the full integration test suite to run in this worktree is unrelated to this plan and outside its scope.)

## Next Phase Readiness
- LOC-01/LOC-02 are now closed on every server surface: forms (09-03/09-04), filter (09-05), spreadsheet import (`annotarLinha`/`validarLoteImportacao`), and `createCliente`/`updateCliente` all validate Estado/Cidade against the same structured `UFS`/`cidades` source.
- No blockers for the rest of Phase 9 or downstream phases. This plan (09-06) is the last of Wave 3 (`depends_on: ["09-01", "09-02", "09-03"]`) and ran in parallel with 09-05 without touching any shared files.

---
*Phase: 09-filtros-de-estado-e-cidade-estruturados*
*Completed: 2026-07-26*

## Self-Check: PASSED

All created/modified files confirmed present (`lib/clientes/cidadeValida.ts`, `tests/clientes/cidade-valida.test.ts`, `lib/importacao/annotarLinha.ts`, `tests/importacao/annotarLinha.test.ts`, `app/actions/importacao.ts`, `app/actions/clientes.ts`). All 5 task commit hashes (`358ec4e`, `528097a`, `e7e7386`, `403c701`, `d84c535`) confirmed present in `git log --oneline -10`.
