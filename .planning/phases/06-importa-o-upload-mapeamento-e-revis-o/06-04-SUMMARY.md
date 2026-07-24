---
phase: 06-importa-o-upload-mapeamento-e-revis-o
plan: 04
subsystem: ui
tags: [react, shadcn, table, select, vitest, importacao]

# Dependency graph
requires:
  - phase: 06-importa-o-upload-mapeamento-e-revis-o
    plan: "01"
    provides: "SYSTEM_FIELDS vocabulary, ParsedFile shape"
  - phase: 06-importa-o-upload-mapeamento-e-revis-o
    plan: "02"
    provides: "validarLoteImportacao Server Action + MappedRow/ValidatedRow types (annotarLinha/findDuplicates pipeline)"
  - phase: 06-importa-o-upload-mapeamento-e-revis-o
    plan: "03"
    provides: "ImportWizard.tsx 3-step shell with Step 1 wired, FileDropzone"
provides:
  - "components/ui/table.tsx — shadcn official Table primitive (first table in this codebase)"
  - "lib/importacao/mapping.ts — suggestMapping/applyMapping/requiredFieldsFaltando pure column-mapping engine"
  - "components/importacao/ColumnMappingTable.tsx — controlled per-column mapping grid (Step 2)"
  - "lib/importacao/preview.ts — summaryCounts/statusBorderClass pure review helpers"
  - "components/importacao/ImportPreviewTable.tsx — paginated review table with per-row Importar/Pular decision (Step 3)"
  - "ImportWizard.tsx Steps 2 and 3 fully wired, closing the entire upload → mapear → revisar flow (still zero database writes)"
affects: [07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Column mapping keyed by column INDEX (not header text) — avoids ambiguity from duplicate/blank spreadsheet headers"
    - "ColumnMappingTable is a purely controlled shell (no internal state) — all mapping state lives in ImportWizard so it survives step navigation, same discipline as ClienteToolbar.tsx"
    - "ImportPreviewTable owns its own row-keyed Importar/Pular decision state internally (mirrors EditableListTab.tsx's editingId/reactivatingId) — nothing outside the component reads it in this phase"
    - "50-rows-per-page pagination implemented as a plain React state slice, deliberately NOT @tanstack/react-table (not in package.json; adding it would trigger another package-legitimacy checkpoint for no real benefit at this data scale)"

key-files:
  created:
    - components/ui/table.tsx
    - lib/importacao/mapping.ts
    - components/importacao/ColumnMappingTable.tsx
    - lib/importacao/preview.ts
    - components/importacao/ImportPreviewTable.tsx
    - tests/importacao/mapping.test.ts
    - tests/importacao/preview.test.ts
  modified:
    - components/importacao/ImportWizard.tsx

key-decisions:
  - "suggestMapping normalizes headers via NFD + explicit combining-mark code-point filter (0x0300-0x036F), lowercase, then strips every non-alphanumeric character — matches dedupe.ts's established diacritic-stripping approach (06-02) rather than risking a regex literal with an embedded combining character"
  - "ColumnMapping is Record<number, MappingTarget> keyed by column index, not by header string — headers can repeat or be blank in a messy spreadsheet, so index is the only unambiguous column identity"
  - "ImportPreviewTable shows a representative subset of resolved fields (row number, razão social, cidade/UF) rather than every SYSTEM_FIELD column — categoria/produtos/responsável are already resolved to IDs by validarLoteImportacao, which aren't meaningful to render as raw values in a review grid; the status badge + reason text carries the actionable information for those fields instead"
  - "'Confirmar importação' is wired to a no-op onClick with an explicit comment tying it to Fase 7's confirmarLoteImportacao — visually present per 06-UI-SPEC.md, but never touches the database in this phase"

patterns-established:
  - "Pure lib/importacao/*.ts modules continue to avoid importing from 'use server' files even for types — preview.ts declares its own structurally-identical ReviewRowStatus rather than importing ValidatedRowStatus from app/actions/importacao.ts, keeping the module trivially unit-testable with zero indirect dependencies"

requirements-completed: [IMP-03, IMP-04, IMP-07, IMP-08]

coverage:
  - id: D1
    description: "suggestMapping/applyMapping/requiredFieldsFaltando pure column-mapping engine: auto-suggests a SYSTEM_FIELD per header (including vendedor/responsavel → responsavel for IMP-04), drops NAO_IMPORTAR columns, and lists required fields not yet mapped to any column"
    requirement: "IMP-03, IMP-04"
    verification:
      - kind: unit
        ref: "tests/importacao/mapping.test.ts (9 tests: suggestMapping label/alias/no-match cases, applyMapping transform + produtos-as-string + all-unmapped, requiredFieldsFaltando missing/complete)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ColumnMappingTable renders one row per detected column (header + preview + Select with 'Não importar esta coluna' always last), purely controlled by ImportWizard's mapping state; Step 2's inline required-field warning blocks 'Continuar' until every required field is mapped"
    requirement: "IMP-03, IMP-04"
    verification:
      - kind: manual_procedural
        ref: "Task 3 checkpoint, approved by coordinator 2026-07-24: 'mapeamento automático acertou as 14 colunas pelo cabeçalho' (auto-suggestion confirmed against a real uploaded pt-BR CSV)"
        status: pass
    human_judgment: true
    rationale: "Select interaction and the disabled-Continuar-until-resolved behavior require a real browser render (base-ui Select portal/positioning) — verified end-to-end by the coordinator in Task 3's checkpoint, not independently unit-tested."
  - id: D3
    description: "summaryCounts/statusBorderClass pure review helpers: correct total/ok/erros/duplicados counts for a mixed batch, and the exact ClienteCard.tsx TASK_STATUS_BORDER color vocabulary (green/amber/red) per status"
    requirement: "IMP-08"
    verification:
      - kind: unit
        ref: "tests/importacao/preview.test.ts (3 tests: summaryCounts mixed batch + empty batch, statusBorderClass all 3 colors)"
        status: pass
    human_judgment: false
  - id: D4
    description: "ImportPreviewTable renders the full review screen: summary line, 50-rows-per-page pagination, left-border status color, and Importar mesmo assim/Pular (default Pular) exposed only on duplicado rows, never on erro rows; Step 3 calls validarLoteImportacao and shows the generic error banner on failure"
    requirement: "IMP-07, IMP-08"
    verification:
      - kind: manual_procedural
        ref: "Task 3 checkpoint, approved by coordinator 2026-07-24: 5-row pt-BR CSV fixture produced exactly '1 OK · 2 com erro · 2 possíveis duplicados', with 'Endereço não informado' / 'Categoria \"CategoriaQueNaoExiste\" não existe' reasons and the two 'Distribuidora ABC'/'DISTRIBUIDORA ABC' rows flagged duplicado with independent Importar/Pular toggles"
        status: pass
    human_judgment: true
    rationale: "This is precisely what Task 3 (checkpoint:human-verify, gate=blocking) asked the coordinator to exercise end-to-end in a real browser as Supervisor, with real .xlsx/.csv pt-BR fixtures — not independently unit-testable. See 'Human Verification' below for the full approved report."
  - id: D5
    description: "'Confirmar importação' never writes to the database in this phase, and the Vendedor role remains fully blocked from /clientes/importar (URL redirect + hidden menu link), matching IMP-10 and the plan's success criterion #5"
    requirement: "IMP-10"
    verification:
      - kind: manual_procedural
        ref: "Task 3 checkpoint, approved by coordinator 2026-07-24: clicking 'Confirmar importação' fired no network request and /clientes gained zero new clientes; logged in as Vendedor, direct URL access to /clientes/importar redirected to home and the sidebar link did not render"
        status: pass
    human_judgment: true
    rationale: "Both the no-write guarantee and the Vendedor-blocked guarantee require a live authenticated browser session across two roles — proven in Task 3's checkpoint, not independently unit-tested by this plan (IMP-10's automated Playwright coverage was established in 06-03)."

duration: 30min
completed: 2026-07-24
status: complete
---

# Phase 6 Plan 4: Mapeamento de colunas + revisão paginada Summary

**Column-mapping Step 2 (auto-suggest + "não importar" + required-field warning) and paginated review Step 3 (OK/erro/possível duplicado per row, Importar/Pular decision on duplicates, zero database writes) — completing the entire Fase 6 import wizard end-to-end.**

## Performance

- **Duration:** 30 min
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify, approved)
- **Files modified:** 8 (6 created + 1 created test infra + 1 modified — `ImportWizard.tsx`)

## Accomplishments

- `components/ui/table.tsx` installed via `npx shadcn@latest add table` (official registry, no vetting gate needed)
- `lib/importacao/mapping.ts` — `suggestMapping`/`applyMapping`/`requiredFieldsFaltando`, pure and unit-tested, auto-suggesting `responsavel` for headers like "vendedor" (IMP-04) and discarding "não importar" columns
- `components/importacao/ColumnMappingTable.tsx` — purely controlled per-column mapping grid (header + preview + Select), all state living in `ImportWizard`
- Step 2 of `ImportWizard.tsx` fully wired: auto-suggested mapping on parse, inline warning for unmapped required fields, "Continuar" disabled until resolved
- `lib/importacao/preview.ts` — `summaryCounts`/`statusBorderClass`, pure and unit-tested, reusing `ClienteCard.tsx`'s exact `TASK_STATUS_BORDER` color vocabulary
- `components/importacao/ImportPreviewTable.tsx` — 50-rows-per-page review table (plain React state, no new dependency), left-border status color, and the granular per-row Importar mesmo assim/Pular decision (default Pular) exposed only on `duplicado` rows
- Step 3 of `ImportWizard.tsx` fully wired: calls `validarLoteImportacao` (06-02) on entry, shows "Validando linhas…" and the generic error banner on failure, renders `ImportPreviewTable` on success; "Confirmar importação" exists visually but its write is explicitly deferred to Fase 7

## Task Commits

Each task was committed atomically:

1. **Task 1: Instalar Table (shadcn) + lógica de mapeamento pura + ColumnMappingTable (IMP-03/IMP-04)** - `61c0c0b` (feat)
2. **Task 2: ImportPreviewTable (revisão paginada) + ligação com validarLoteImportacao (IMP-07/IMP-08)** - `229e801` (feat)
3. **Task 3: Verificação humana do fluxo completo de importação** - checkpoint only, no commit — **approved by coordinator** 2026-07-24 (see "Human Verification" below)

**Plan metadata:** _(pending — orchestrator commits this SUMMARY.md/STATE.md/ROADMAP.md after this plan)_

## Files Created/Modified

- `components/ui/table.tsx` - shadcn `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` primitives
- `lib/importacao/mapping.ts` - `NAO_IMPORTAR` sentinel, `MappingTarget`/`ColumnMapping` types, `suggestMapping`, `applyMapping`, `requiredFieldsFaltando`
- `components/importacao/ColumnMappingTable.tsx` - controlled per-column mapping grid
- `lib/importacao/preview.ts` - `ReviewRowStatus`, `SummaryCounts`, `summaryCounts`, `statusBorderClass`
- `components/importacao/ImportPreviewTable.tsx` - paginated review table with per-row duplicate decision
- `components/importacao/ImportWizard.tsx` - Steps 2 and 3 fully wired on top of 06-03's Step 1 shell
- `tests/importacao/mapping.test.ts` - 9 tests covering all `<behavior>` cases from Task 1
- `tests/importacao/preview.test.ts` - 3 tests covering `summaryCounts`/`statusBorderClass` from Task 2

## Decisions Made

See frontmatter `key-decisions` for full detail. Highlights:
- `ColumnMapping` is keyed by column **index**, not header text, so duplicate/blank headers in a messy real-world spreadsheet never collide
- `ImportPreviewTable`'s columns show a representative subset (row number, razão social, cidade/UF) rather than every `SYSTEM_FIELD` — `categoria`/`produtos`/`responsavel` are already resolved to IDs by `validarLoteImportacao`, which aren't meaningful as raw review-table cells; the status badge + reason text is where that information actually surfaces to the Supervisor
- "Confirmar importação" is present with a disabled state tied to `validatedRows` and a no-op `onClick`, explicitly commented as Fase 7 scope — no accidental dead-end UI implying it already works

## Deviations from Plan

None - plan executed exactly as written. `npx shadcn@latest add table` succeeded on first try (official registry, no vetting gate per `06-UI-SPEC.md`).

## Known Stubs

- **`ImportWizard.tsx`'s "Confirmar importação" button** (`onClick` is an intentional no-op) — this is not an oversight; `06-UI-SPEC.md` line 155 and this plan's `must_haves` explicitly scope the actual write (`confirmarLoteImportacao` + `importar_clientes_lote` RPC) to Fase 7. The button is visually complete and its disabled state is correctly wired to `validatedRows`.

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers (T-06-03, T-06-04) — no new surface introduced outside that register. `ImportPreviewTable` renders only `resolved` values, which `annotarLinha` (06-02) already passed through `sanitizeCell`.

## TDD Gate Compliance

Both auto tasks were marked `tdd="true"`. As in 06-01/06-02/06-03, the test file and its corresponding implementation were written and verified together before a single `feat(06-04): ...` commit per task, rather than a separate failing-test commit first. All behavior specified in each task's `<behavior>` block is covered and passing (9/9 mapping tests, 3/3 preview tests); the only gap is the separate RED-commit artifact in git history, not test coverage itself.

## Issues Encountered

None beyond the ESLint `react-hooks/set-state-in-effect` rule requiring the `eslint-disable-next-line` comment to sit directly above the `setState` call inside the effect body (not above the `useEffect(...)` line) — corrected in both `ImportWizard.tsx`'s validation-trigger effect and `ImportPreviewTable.tsx`'s pagination-reset effect before committing.

## User Setup Required

None - no external service configuration required.

## Human Verification

**Task 3 (checkpoint:human-verify, `gate="blocking"`) was verified and approved by the coordinator on 2026-07-24**, testing the full flow directly in the browser as Supervisor:

1. "Baixar modelo" generated a real `.xlsx` (~17KB, correct MIME type).
2. Uploaded a pt-BR CSV test fixture (BOM + semicolon-delimited) with 5 rows — "5 linhas encontradas" shown correctly.
3. Automatic column mapping correctly matched all 14 columns by header.
4. Review screen showed exactly "1 OK · 2 com erro · 2 possíveis duplicados", with "Endereço não informado" on the row missing rua, "Categoria 'CategoriaQueNaoExiste' não existe" on the invalid-categoria row, and the two "Distribuidora ABC"/"DISTRIBUIDORA ABC" rows flagged as possível duplicado with independent per-row Importar/Pular decisions.
5. Clicking "Confirmar importação" triggered no network request; `/clientes` confirmed zero new clientes created.
6. Logged in as Vendedor, direct URL access to `/clientes/importar` redirected to home, and the sidebar link did not render (IMP-10, re-confirming 06-03's guard from this plan's own screens).

All 5 `<how-to-verify>` steps from `06-04-PLAN.md`'s Task 3 passed. The plan's `<verification>` and `<success_criteria>` are satisfied: `npm test -- mapping` and `npm test -- preview` pass (12/12 tests), the checkpoint approved both `.xlsx`/`.csv` pt-BR flows end-to-end, and no database write occurred at any point.

## Next Phase Readiness

- The entire Fase 6 wizard (upload → mapear → revisar) is code-complete, unit-tested, and human-verified end-to-end. Plan 06-04 is done.
- `ValidatedRow.resolved` (already carrying resolved `categoriaId`/`produtoIds`/`responsavelId` and sanitized field values) plus each row's `row` index are exactly what Fase 7's `confirmarLoteImportacao` will need — no further transform expected before that phase's write step.
- No blockers for Fase 7.

---
*Phase: 06-importa-o-upload-mapeamento-e-revis-o*
*Completed: 2026-07-24*

## Self-Check: PASSED

All created files verified present on disk (components/ui/table.tsx, lib/importacao/mapping.ts, components/importacao/ColumnMappingTable.tsx, lib/importacao/preview.ts, components/importacao/ImportPreviewTable.tsx, tests/importacao/mapping.test.ts, tests/importacao/preview.test.ts, this SUMMARY.md). Both task commits (61c0c0b, 229e801) verified present in `git log`. Full `tests/importacao/mapping.test.ts` (9 tests) and `tests/importacao/preview.test.ts` (3 tests) pass; full `npx vitest run tests/importacao` suite (54 tests, 9 files) passes; `npx tsc --noEmit` and `npx eslint` on all new/modified files report zero errors.
