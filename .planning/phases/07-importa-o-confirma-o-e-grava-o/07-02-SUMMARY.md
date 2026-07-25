---
phase: 07-importa-o-confirma-o-e-grava-o
plan: 02
subsystem: import-confirm
tags: [server-action, tdd, plpgsql-rpc-caller, dedupe]

# Dependency graph
requires:
  - phase: 07-01
    provides: "importar_clientes_lote(p_clientes jsonb) RPC — live on the Supabase project, returns { razao_social, id, status }[] for actually-inserted rows"
  - phase: 06-importa-o-upload-mapeamento-e-revis-o
    provides: "validarLoteImportacao's ValidatedRow shape/is_supervisor gate discipline, lib/importacao/dedupe.ts's normalizeRazaoSocial/findDuplicates, ImportPreviewTable's per-row Importar/Pular decisions shape"
provides:
  - "lib/importacao/confirmar.ts — pure planConfirmacao/reconcileImportados accounting helper, unit-tested (8 cases)"
  - "confirmarLoteImportacao Server Action in app/actions/importacao.ts — the confirm-time write orchestration"
affects: [07-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Confirm-time accounting kept in a pure helper (lib/importacao/confirmar.ts) separate from the Server Action, mirroring dedupe.ts/annotarLinha.ts's dependency-light discipline — testable without .env.local or a live request scope."
    - "Two duplicate-related PuladaGroup reasons share the exact same motivo string across two independent code paths (planConfirmacao's D-02 pre-check and reconcileImportados' RPC ON CONFLICT race backstop) — a mergePuladas helper in the Server Action sums quantidade for matching motivo instead of emitting two separate breakdown lines for what the Supervisor experiences as the same story."

key-files:
  created:
    - lib/importacao/confirmar.ts
    - tests/importacao/confirmar.test.ts
  modified:
    - app/actions/importacao.ts

key-decisions:
  - "planConfirmacao classifies rows in one pass (erro/duplicado-pular/duplicado-importar/ok), then re-runs findDuplicates ONLY over 'ok' candidates (never explicit 'importar' overrides) for D-02 — an explicit supervisor override is never re-excluded by the confirm-time revalidation."
  - "puladasCount tracks distinct skipped ROW indices (a Set), not the sum of puladas group quantidades, because an erro row can contribute to multiple reason groups (e.g. missing razão social AND endereço) but must only count once toward rowsToInsert.length + puladasCount == linhas.length."
  - "reconcileImportados folds the RPC's actual returned razao_social set back into importados/puladas, reusing the exact same 'Duplicado encontrado ao confirmar — não existia no momento da revisão' reason string as D-02's own pre-check — from the Supervisor's perspective a row that survived planConfirmacao's check but still lost the RPC's ON CONFLICT race tells the identical story."

requirements-completed: [IMP-01, IMP-06]

coverage:
  - id: D1
    description: "planConfirmacao includes an 'ok' row with no new duplicate and maps ResolvedRow to the RPC's exact snake_case RpcClienteRow shape"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "tests/importacao/confirmar.test.ts#planConfirmacao > includes an 'ok' row with no new duplicate, mapping resolved fields to snake_case RPC keys"
        status: pass
    human_judgment: false
  - id: D2
    description: "planConfirmacao excludes erro rows, grouping every reason string, and excludes duplicado-pular rows, so one bad row never blocks the batch"
    requirement: "IMP-06"
    verification:
      - kind: unit
        ref: "tests/importacao/confirmar.test.ts#planConfirmacao > excludes an 'erro' row / excludes a 'duplicado' row with decision 'pular'"
        status: pass
    human_judgment: false
  - id: D3
    description: "A duplicado row with decision 'importar' is included (supervisor override), even though D-02's re-check would otherwise flag it"
    verification:
      - kind: unit
        ref: "tests/importacao/confirmar.test.ts#planConfirmacao > includes a 'duplicado' row with decision 'importar' (supervisor override; D-02 does not re-exclude it)"
        status: pass
    human_judgment: false
  - id: D4
    description: "An 'ok' row that newly matches existentesRazaoSocial at confirm time is excluded under the distinct D-02 reason string"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "tests/importacao/confirmar.test.ts#planConfirmacao > excludes an 'ok' row that newly matches existentesRazaoSocial at confirm time (D-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "rowsToInsert.length + puladasCount always equals the input length across a mixed batch"
    verification:
      - kind: unit
        ref: "tests/importacao/confirmar.test.ts#planConfirmacao > keeps rowsToInsert.length + puladasCount equal to the input length across a mixed batch"
        status: pass
    human_judgment: false
  - id: D6
    description: "reconcileImportados reports RPC-returned rows as importados and RPC-race-skipped rows under the confirm-time duplicate reason"
    verification:
      - kind: unit
        ref: "tests/importacao/confirmar.test.ts#reconcileImportados"
        status: pass
    human_judgment: false
  - id: D7
    description: "confirmarLoteImportacao Supervisor-gates before any read, re-dedups via planConfirmacao, calls the RPC exactly once, reconciles the result, and never persists skipped rows"
    requirement: "IMP-06"
    verification:
      - kind: static
        ref: "app/actions/importacao.ts — npx tsc --noEmit && npx eslint app/actions/importacao.ts both clean; manual read confirms single supabase.rpc('importar_clientes_lote', ...) call, no loop, no table write for puladas"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-07-24
status: complete
---

# Phase 7 Plan 2: Confirm-time Write Orchestration Summary

**Pure `planConfirmacao`/`reconcileImportados` accounting helper (8 unit tests, RED-then-GREEN) plus `confirmarLoteImportacao` Server Action — Supervisor-gated, D-02 confirm-time re-dedup, single `importar_clientes_lote` RPC call, `{ importados, puladas }` result with zero persistence of skipped rows.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-24T23:14Z
- **Completed:** 2026-07-24T23:39Z
- **Tasks:** 2 (Task 1 `tdd="true"`, Task 2 `type="auto"`)
- **Files modified:** 3 (2 new: `lib/importacao/confirmar.ts`, `tests/importacao/confirmar.test.ts`; 1 modified: `app/actions/importacao.ts`)

## Accomplishments
- `lib/importacao/confirmar.ts` — a pure, dependency-light module (no Supabase import, no `use server`/`use client`) that decides exactly which reviewed rows become the RPC's insert set and groups every excluded row under the exact 07-UI-SPEC.md reason vocabulary
- `planConfirmacao` proves all 5 classification rules (ok/erro/duplicado-pular/duplicado-importar-override/D-02-new-duplicate) plus the row-accounting invariant (`rowsToInsert.length + puladasCount == linhas.length`) via unit tests, following the TDD RED→GREEN cycle
- `reconcileImportados` folds the RPC's actual returned rows back into an honest importados/puladas split, covering the rare `ON CONFLICT DO NOTHING` race between confirm-time revalidation and the actual insert
- `confirmarLoteImportacao` added to `app/actions/importacao.ts`: Supervisor-gated (mirrors `validarLoteImportacao`'s discipline verbatim), calls `importar_clientes_lote` exactly once, `revalidatePath("/clientes")` on success, never persists skipped rows anywhere (D-03)

## Task Commits

1. **Task 1 (TDD RED): Write failing test for confirm-time accounting helper** - `c83686d` (test)
2. **Task 1 (TDD GREEN): Implement lib/importacao/confirmar.ts** - `135ae2f` (feat)
3. **Task 2: Add confirmarLoteImportacao Server Action** - `baa08fd` (feat)

**Plan metadata:** pending (this commit)

## TDD Gate Compliance

Gate sequence verified in git log: `test(07-02): add failing test...` (`c83686d`) precedes `feat(07-02): implement confirm-time accounting helper` (`135ae2f`). RED confirmed via `npx vitest run tests/importacao/confirmar.test.ts` failing with "Cannot find module" before implementation existed; GREEN confirmed with all 8 tests passing after implementation. No REFACTOR commit was needed — the first implementation passed cleanly with no cleanup required.

## Files Created/Modified
- `lib/importacao/confirmar.ts` - `planConfirmacao`/`reconcileImportados`/`RpcClienteRow`/`PuladaGroup`, pure accounting helper
- `tests/importacao/confirmar.test.ts` - 8 unit tests covering the plan's full behavior block (ok/erro/duplicado-pular/duplicado-importar/D-02-new-duplicate/row-accounting-invariant/reconcile-happy-path/reconcile-race-backstop)
- `app/actions/importacao.ts` - added `confirmarLoteImportacao`, `ConfirmarLoteErrorCode`, `ConfirmarLoteResult`, and a local `mergePuladas` helper (not exported — Server Action-internal reconciliation of `planConfirmacao`'s puladas with `reconcileImportados`' puladasExtra when both use the same D-02 reason string)

## Decisions Made
- Followed the plan's exact function signatures and body order (`planConfirmacao(linhas, decisions, existentesRazaoSocial)`, `reconcileImportados(rowsToInsert, returnedRazoes)`, the 8-step `confirmarLoteImportacao` body order) — no deviation from the plan's architecture.
- Added one function not explicitly named in the plan text: `mergePuladas` inside `app/actions/importacao.ts`. The plan's step 7 says "merge `puladasExtra` into `puladas`" without specifying collision handling; since both `planConfirmacao`'s D-02 group and `reconcileImportados`' race-backstop group use the identical motivo string ("Duplicado encontrado ao confirmar — não existia no momento da revisão"), a naive array concatenation would produce two separate breakdown lines with the same label instead of one combined count. `mergePuladas` sums `quantidade` for matching `motivo` strings — this is a direct, in-scope implementation of the plan's own instruction, not a new capability.

## Deviations from Plan

None - plan executed exactly as written. `mergePuladas` (see Decisions Made) is an implementation detail of the plan's already-specified step 7, not a scope change.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This plan only added application-layer code that calls the already-live `importar_clientes_lote` RPC (07-01); no new migrations, no new environment variables, no new secrets.

## Next Phase Readiness
- `confirmarLoteImportacao(linhas, decisions)` is ready for 07-03 to wire from `ImportWizard.tsx`'s "Confirmar importação" button — `decisions` is the per-row Importar/Pular map the review table (`ImportPreviewTable.tsx`) already tracks in component state per `06-PATTERNS.md`.
- The `{ importados: { razaoSocial }[]; puladas: PuladaGroup[] }` result shape matches exactly what `07-PATTERNS.md`'s `ImportSummary.tsx` design expects: `importados.length` for the "Clientes importados" tile, `puladas.reduce((sum, p) => sum + p.quantidade, 0)` for the "Linhas puladas" tile count, and `puladas` itself for the breakdown list (each `{ motivo, quantidade }` renders as "{motivo} — {quantidade} linha(s)" per the Copywriting Contract).
- No blockers for 07-03.

---
*Phase: 07-importa-o-confirma-o-e-grava-o*
*Completed: 2026-07-24*

## Self-Check: PASSED

- FOUND: lib/importacao/confirmar.ts
- FOUND: tests/importacao/confirmar.test.ts
- FOUND: app/actions/importacao.ts
- FOUND: .planning/phases/07-importa-o-confirma-o-e-grava-o/07-02-SUMMARY.md
- FOUND commit: c83686d
- FOUND commit: 135ae2f
- FOUND commit: baa08fd
