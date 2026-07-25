---
phase: 07-importa-o-confirma-o-e-grava-o
plan: 03
subsystem: import-confirm
tags: [react, next-js, server-action, ui, kanban]

# Dependency graph
requires:
  - phase: 07-02
    provides: "confirmarLoteImportacao(linhas, decisions) Server Action — { importados, puladas } result shape"
  - phase: 06-importa-o-upload-mapeamento-e-revis-o
    provides: "ImportWizard (3-step shell) and ImportPreviewTable (per-row review + decisions state)"
provides:
  - "ImportPreviewTable as a controlled component (decisions/onDecisionChange props)"
  - "components/importacao/ImportSummary.tsx — the D-01 post-confirmation summary screen"
  - "ImportWizard wired end-to-end: real write path from 'Confirmar importação' through to the summary screen"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lifted-state controlled component: ImportPreviewTable no longer owns its own decisions state; the parent (ImportWizard) owns and resets it, mirroring how mappedRows/validatedRows are already owned at the wizard level."
    - "Top-level confirmResult !== null render branch (ImportWizard) fully replaces the step body and hides the step indicator — same top-level-branch shape already used for step 1/2/3, extended with a 4th terminal state."
    - "ImportSummary is pure presentational (no fetch effect), unlike its GanhosPerdidosCards analog — the confirm result already exists synchronously in the parent by the time it renders."

key-files:
  created:
    - components/importacao/ImportSummary.tsx
    - tests/importacao/import-summary.test.tsx
  modified:
    - components/importacao/ImportPreviewTable.tsx
    - components/importacao/ImportWizard.tsx

key-decisions:
  - "ImportSummary computes its own 'Linhas puladas' tile count via puladas.reduce((sum, p) => sum + p.quantidade, 0) rather than taking a separate puladasCount prop — keeps the component's public surface to exactly the two inputs 07-02's result shape naturally provides (importadosCount, puladas), with no derived value the caller has to compute."
  - "Stat tile numbers use the project's locked 20px display size (text-xl leading-[1.2]), explicitly NOT GanhosPerdidosCards' 36px waiver, per 07-UI-SPEC.md's Typography section."

requirements-completed: [IMP-01, IMP-06, IMP-09]

coverage:
  - id: D1
    description: "ImportPreviewTable's per-row Importar/Pular decisions are lifted out into ImportWizard as a controlled decisions/onDecisionChange prop pair, reset alongside validatedRows"
    requirement: "IMP-01"
    verification:
      - kind: unit
        ref: "tests/importacao/preview.test.ts (unaffected, still passing against the refactored table)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ImportSummary renders the two stat tiles (Clientes importados / Linhas puladas, green-600/amber-500 borders, CircleCheck/TriangleAlert icons, text-xl counts via Intl.NumberFormat pt-BR) and a reason-grouped breakdown only when puladas.length > 0"
    requirement: "IMP-06"
    verification:
      - kind: unit
        ref: "tests/importacao/import-summary.test.tsx#ImportSummary > renders both stat tiles, the count, and the reason-grouped breakdown when there are puladas / omits the breakdown heading entirely when puladas is empty"
        status: pass
    human_judgment: false
  - id: D3
    description: "ImportWizard's 'Confirmar importação' button calls confirmarLoteImportacao(validatedRows, decisions), disables and relabels to 'Importando clientes…' while in flight, shows the CONFIRM_ERROR banner on failure, and swaps in <ImportSummary/> (step indicator hidden) on success"
    requirement: "IMP-01"
    verification:
      - kind: static
        ref: "components/importacao/ImportWizard.tsx — npx tsc --noEmit and npx eslint both clean; manual read confirms disabled={!validatedRows || confirming}, CONFIRM_ERROR banner, confirmResult !== null branch before the step===1/2/3 chain"
        status: pass
    human_judgment: false
  - id: D4
    description: "End-to-end real bulk import: valid rows land at 'Aguardando contato' (IMP-09), a bad row (missing responsável) and a skipped duplicate do not block or corrupt the batch (IMP-06), and the summary counts/reasons are accurate"
    requirement: "IMP-09"
    verification:
      - kind: manual_procedural
        ref: "07-03-PLAN.md Task 3 how-to-verify, performed by the project coordinator against the live dev server/Supabase project — approved"
        status: pass
    human_judgment: true
    rationale: "First real database write of the milestone (v1.1) — the plan explicitly gates this behind a human checkpoint importing a real spreadsheet through the browser, not an automated test, since it exercises the live Supabase project end-to-end."

# Metrics
duration: ~10min (Tasks 1-2 automated work; Task 3 verified externally by the coordinator)
completed: 2026-07-24
status: complete
---

# Phase 7 Plan 3: Confirm Wiring, Summary Screen, and Human Verification Summary

**Wired ImportWizard's "Confirmar importação" button to the real `confirmarLoteImportacao` write path, added the `ImportSummary` D-01 post-confirmation screen, and got human sign-off on a real bulk import against the live Supabase project — completing Phase 7 and the v1.1 milestone's only write phase.**

## Performance

- **Duration:** ~10 min (Tasks 1-2 automated implementation); Task 3 was a human checkpoint verified externally by the project coordinator in the browser
- **Started:** 2026-07-24T23:23:59Z (first automated verification run)
- **Completed:** 2026-07-24T23:27:31Z (last task commit); checkpoint approved shortly after
- **Tasks:** 3 (2 `type="auto"` + 1 `type="checkpoint:human-verify"`, all complete)
- **Files modified:** 4 (1 new component, 1 new test, 2 modified components)

## Accomplishments
- `ImportPreviewTable` is now a controlled component: its per-row Importar/Pular `decisions` state moved up into `ImportWizard`, which owns it and resets it alongside `validatedRows` whenever a fresh batch is mapped or the file is removed
- New `components/importacao/ImportSummary.tsx` (D-01): "Importação concluída" screen with two stat tiles (green-600 "Clientes importados" / amber-500 "Linhas puladas", `CircleCheck`/`TriangleAlert` icons, `text-xl` counts formatted via `Intl.NumberFormat("pt-BR")` — the locked 20px display size, not `GanhosPerdidosCards`' 36px Dashboard-only waiver), a reason-grouped breakdown rendered only when `puladas.length > 0`, and "Ver clientes"/"Importar outra planilha" buttons
- `ImportWizard`'s "Confirmar importação" button now calls `confirmarLoteImportacao(validatedRows, decisions)`, disables and relabels to "Importando clientes…" while in flight, shows a `CONFIRM_ERROR` banner on failure, and on success replaces the wizard body with `<ImportSummary/>` while hiding the numbered step indicator — "Ver clientes" pushes `/clientes`, "Importar outra planilha" resets the whole wizard to Step 1
- **Human verification (Task 3) — approved.** The project coordinator personally imported a real test spreadsheet (2 valid rows, 1 row missing responsável, 1 row duplicating an existing cliente) against the live dev server as the real Supervisor account. Every expectation in the plan's `how-to-verify` was confirmed: review screen showed 2 OK / 1 Erro / 1 Possível duplicado; the summary showed "Clientes importados: 2", "Linhas puladas: 2" with the exact "Responsável não informado — 1 linha" / "Possível duplicado (pulado na revisão) — 1 linha" breakdown; "Ver clientes" showed both new clientes at "Aguardando contato" (count 4→6, confirming IMP-09); the bad row and skipped duplicate created no clientes (confirming IMP-06)

## Task Commits

Each task was committed atomically:

1. **Task 1: Lift the per-row Importar/Pular decisions from ImportPreviewTable to ImportWizard** - `616a499` (refactor)
2. **Task 2: ImportSummary component + wire confirm action and summary step in ImportWizard** - `6d52c7a` (feat)
3. **Task 3: Human verification of the full bulk-import write path (real file)** - checkpoint, no code commit — approved by the project coordinator directly against the live dev server/Supabase project

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `components/importacao/ImportPreviewTable.tsx` - `decisions`/`onDecisionChange` are now props; the internal `useState` for decisions was removed
- `components/importacao/ImportWizard.tsx` - owns `decisions`, `confirming`/`confirmError`/`confirmResult` state; `handleConfirmar`/`handleImportarOutra`; the wired "Confirmar importação" button; the `confirmResult !== null` top-level render branch
- `components/importacao/ImportSummary.tsx` - new D-01 post-confirmation summary screen, pure presentational
- `tests/importacao/import-summary.test.tsx` - render test: both tiles + breakdown line when `puladas` is non-empty, breakdown heading absent when `puladas` is empty

## Decisions Made
- `ImportSummary` derives `puladasCount` internally from `puladas.reduce(...)` rather than accepting it as a separate prop from the caller — keeps the component's props limited to exactly what 07-02's `{ importados, puladas }` result shape naturally offers.
- Kept `ImportPreviewTable`'s `decisions`/`onDecisionChange` prop types as plain inline `Record<number, "importar" | "pular">` / function signatures rather than exporting a shared `Decisions` type from either file, avoiding a circular type import between `ImportWizard.tsx` and `ImportPreviewTable.tsx`.

## Deviations from Plan

None - plan executed exactly as written for Tasks 1-2. Task 3 (human checkpoint) was completed by the project coordinator exactly per the plan's `how-to-verify` steps.

## Issues Encountered

A full `npm test` run hit Supabase Auth's free-tier rate limit (`Request rate limit reached`) partway through, since the suite signs in ~130+ times back-to-back across every RLS test file — this affected unrelated test files (e.g. `tests/clientes/rls-exportacao.test.ts`, `tests/clientes/update-delete.test.ts`) as well as this phase's own `tests/importacao/rls-importar-lote.test.ts`/`rls-dedup-read.test.ts`, confirming it is a global environmental limit, not a regression from this plan's changes. Verified by re-running the phase's own RLS suites in isolation after a short cooldown — both passed cleanly (15/15). Both of Task 1/2's explicit plan verification commands (`npx tsc --noEmit`, `npx vitest run tests/importacao/preview.test.ts`, `npx vitest run tests/importacao/import-summary.test.tsx`) passed on every run with no rate-limit interference.

## User Setup Required

None - no new external service configuration required. This plan only wires existing application code (`confirmarLoteImportacao`, live since 07-02) into the UI; no new migrations, environment variables, or secrets.

## Next Phase Readiness

- Phase 7 is complete — this closes the v1.1 milestone's only write phase. The Supervisor can now upload a spreadsheet, review it, confirm the import, and see an accurate "X importados / Y puladas" summary, with imported clientes landing in the funil at "Aguardando contato".
- No blockers. The known Supabase Auth free-tier rate limit (documented above) is a pre-existing operational characteristic of running the full test suite in one shot, not something this plan introduced or needs to fix — running the phase-relevant suites individually (or with a short cooldown) is the workaround already in use.

---
*Phase: 07-importa-o-confirma-o-e-grava-o*
*Completed: 2026-07-24*

## Self-Check: PASSED

- FOUND: components/importacao/ImportSummary.tsx
- FOUND: components/importacao/ImportPreviewTable.tsx
- FOUND: components/importacao/ImportWizard.tsx
- FOUND: tests/importacao/import-summary.test.tsx
- FOUND: .planning/phases/07-importa-o-confirma-o-e-grava-o/07-03-SUMMARY.md
- FOUND commit: 616a499
- FOUND commit: 6d52c7a
