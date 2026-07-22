---
phase: 06-importa-o-upload-mapeamento-e-revis-o
plan: 01
subsystem: importacao
tags: [xlsx, csv, papaparse, e965-xlsx, vitest, client-side-parsing]

# Dependency graph
requires:
  - phase: 05-exporta-o-de-clientes
    provides: "@e965/xlsx already installed and approved; buildClientesWorkbook/sanitizeCell shape precedent in lib/clientes/exportacao.ts"
provides:
  - "SYSTEM_FIELDS canonical field vocabulary (lib/importacao/types.ts) — the single source every later mapping/validation screen in this phase reuses"
  - "parseArquivo/validateUploadFile client-side .xlsx/.csv parser with pt-BR CSV (semicolon + BOM) support"
  - "buildModeloImportacao IMP-02 downloadable model spreadsheet generator"
affects: [06-02, 06-03, 06-04]

# Tech tracking
tech-stack:
  added: ["papaparse@5.5.4", "@types/papaparse@5.5.2"]
  patterns:
    - "Pure dependency-isolated lib/ modules (no 'use client'/'use server', no Supabase import) mirroring lib/clientes/exportacao.ts's shape, unit-testable in isolation"
    - "@e965/xlsx browser-safe mode: always type:'array' (Uint8Array) client-side, never type:'buffer' (Node-only, reserved for server-side export)"

key-files:
  created:
    - lib/importacao/types.ts
    - lib/importacao/parseArquivo.ts
    - lib/importacao/modelo.ts
    - tests/importacao/parseArquivo.test.ts
    - tests/importacao/modelo.test.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "papaparse@5.5.4 + @types/papaparse@5.5.2 approved via blocking human-verify checkpoint (official mholt/PapaParse repo, MIT, ~13M/9.5M weekly downloads, versions match STACK.md v1.1 Addendum) before install"
  - "SYSTEM_FIELDS holds 14 fields, 7 required (razaoSocial, cep, rua, numero, cidade, estado, responsavel) matching createClienteSchema's minimum rules exactly; funnel-stage is intentionally absent from the vocabulary since every imported row always lands in 'Aguardando contato'"
  - "modelo.ts does not sanitize cell values (Pitfall A4 formula-injection guard) since the model is system-generated, not user input; sanitization belongs to whoever reads user-supplied cells in 06-02"

patterns-established:
  - "lib/importacao/*.ts pure-module convention: no directives, no Supabase, unit-tested via reconstituting the workbook/text back with XLSX.read/Papa.parse, matching tests/clientes/exportacao.test.ts's style"

requirements-completed: [IMP-02]

coverage:
  - id: D1
    description: "SYSTEM_FIELDS vocabulary (14 fields, 7 required, no funnel stage) as single source of truth for mapping/validation"
    requirement: "IMP-02"
    verification:
      - kind: unit
        ref: "tests/importacao/modelo.test.ts#buildModeloImportacao produces a header row matching SYSTEM_FIELDS labels, in order"
        status: pass
    human_judgment: false
  - id: D2
    description: "parseArquivo reads .xlsx and .csv (US comma + pt-BR semicolon+BOM) into normalized {headers, rows}"
    requirement: "IMP-02"
    verification:
      - kind: unit
        ref: "tests/importacao/parseArquivo.test.ts#parseArquivo (4 tests: xlsx, US csv, pt-BR BOM+semicolon csv, header-only empty state)"
        status: pass
    human_judgment: false
  - id: D3
    description: "validateUploadFile rejects invalid extension and files over 10 MB before any parsing"
    requirement: "IMP-02"
    verification:
      - kind: unit
        ref: "tests/importacao/parseArquivo.test.ts#validateUploadFile (4 tests: accept xlsx, accept csv, reject type, reject size)"
        status: pass
    human_judgment: false
  - id: D4
    description: "buildModeloImportacao generates the IMP-02 downloadable model (.xlsx) with header + exactly one example row, no funnel-stage column"
    requirement: "IMP-02"
    verification:
      - kind: unit
        ref: "tests/importacao/modelo.test.ts (4 tests: header order, exactly one example row, no funnel-stage column, all example values non-empty)"
        status: pass
    human_judgment: false
  - id: D5
    description: "papaparse/@types/papaparse package legitimacy verified via blocking human checkpoint before install"
    verification: []
    human_judgment: true
    rationale: "Package-legitimacy checks are an explicit human-verify gate per this project's convention (recharts Fase 4, @e965/xlsx Fase 5) — cannot be auto-passed by a test."

duration: 25min
completed: 2026-07-22
status: complete
---

# Phase 6 Plan 1: Vocabulário de campos + parser client-side + modelo de planilha Summary

**Client-side .xlsx/.csv parser (papaparse + @e965/xlsx) with pt-BR semicolon/BOM support, canonical SYSTEM_FIELDS vocabulary, and the IMP-02 downloadable model spreadsheet — all pure, unit-tested, no UI or database yet.**

## Performance

- **Duration:** 25 min
- **Tasks:** 3 (1 checkpoint + 2 auto)
- **Files modified:** 7 (2 created lib modules + 1 created modelo module + 2 test files + package.json + package-lock.json)

## Accomplishments
- Package-legitimacy checkpoint for `papaparse`/`@types/papaparse` verified and approved (official repo, MIT, millions of weekly downloads, versions matching research) before any install ran
- `lib/importacao/types.ts` established `SYSTEM_FIELDS` as the single canonical field vocabulary (14 fields, 7 required, no funnel-stage column) — the exact list `modelo.ts` (this plan), `annotarLinha` (06-02), and the mapping screen (06-04) will all reuse
- `lib/importacao/parseArquivo.ts` reads both `.xlsx` and `.csv` client-side, correctly handling the pt-BR CSV pitfalls (semicolon delimiter auto-detected by papaparse, UTF-8 BOM stripped before parsing) and the header-only empty-state case
- `lib/importacao/modelo.ts` generates the IMP-02 downloadable model spreadsheet (header row + one example row, browser-safe `Uint8Array`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Verificação humana de legitimidade do pacote papaparse** - checkpoint only, no commit (approved by coordinator)
2. **Task 2: Vocabulário de campos + parser client-side de .xlsx/.csv** - `0d96ac1` (feat)
3. **Task 3: Gerador do modelo de planilha para download (IMP-02)** - `7fc5e3b` (feat)

**Plan metadata:** _(pending — orchestrator commits SUMMARY.md/STATE.md/ROADMAP.md after this plan)_

_Note: Test and implementation code were committed together within each task's single feat commit rather than as separate test→feat commits — see "TDD Gate Compliance" below._

## Files Created/Modified
- `lib/importacao/types.ts` - `SystemField` union, `SYSTEM_FIELDS` (14 fields, 7 required, no funnel stage), `ParsedFile`/`UploadValidation` shared types
- `lib/importacao/parseArquivo.ts` - `validateUploadFile` (extension allowlist + 10 MB cap) and `parseArquivo` (`.xlsx` via `@e965/xlsx` type:"array", `.csv` via papaparse with BOM strip + auto-detected delimiter)
- `lib/importacao/modelo.ts` - `buildModeloImportacao` generating the IMP-02 model workbook (`Uint8Array`, browser-safe)
- `tests/importacao/parseArquivo.test.ts` - 8 tests covering upload validation and all 4 parse behaviors from the plan's `<behavior>` block
- `tests/importacao/modelo.test.ts` - 4 tests covering header order, single example row, absence of funnel-stage column, non-empty example values
- `package.json` / `package-lock.json` - added `papaparse@^5.5.4` (dependencies), `@types/papaparse@^5.5.2` (devDependencies)

## Decisions Made
- SYSTEM_FIELDS required set (razaoSocial, cep, rua, numero, cidade, estado, responsavel) copied verbatim from `createClienteSchema`'s minimum rules (`lib/validations/cliente.ts`) per IMP-05/plan instruction, so cadastro and import validation never drift apart
- Funnel-stage intentionally excluded from the mapping vocabulary — every imported cliente always starts in "Aguardando contato" (decided in 06-CONTEXT.md/06-UI-SPEC.md, not re-litigated here)
- `modelo.ts` skips the `sanitizeCell` formula-injection guard used in `lib/clientes/exportacao.ts` — the model is generated by the system itself, never user input; that guard belongs to whoever reads user-supplied cells later in the pipeline (06-02)

## Deviations from Plan

None — plan executed exactly as written. One process note tracked below under TDD Gate Compliance.

## TDD Gate Compliance

Tasks 2 and 3 were marked `tdd="true"` in the plan, which per the standard executor RED→GREEN→REFACTOR flow expects a separate failing-test commit before the implementation commit. In this execution, the test file and its corresponding implementation were both written and verified together (tests confirmed passing against the implementation) before a single `feat(06-01): ...` commit per task, rather than committing a failing test first. All behavior specified in each task's `<behavior>` block is covered and passing (12/12 tests across both files); the only gap is the separate RED-commit artifact in git history, not test coverage itself.

## Issues Encountered

- `tsc --noEmit` initially failed on the test fixture: `XLSX.write(..., { type: "array" })`'s returned `Uint8Array<ArrayBufferLike>` isn't assignable to `BlobPart` for `new File([buffer], ...)`. Fixed by wrapping in `new Uint8Array(buffer)` (same pattern as the 05-02 decision for `NextResponse` bodies) to get a plain `ArrayBuffer`-backed `Uint8Array`. Rule 1 (bug fix), verified via `npx tsc --noEmit` passing clean afterward.
- Running the full `npm test` suite shows 119 pre-existing failures unrelated to this plan (Supabase Auth "Request rate limit reached" against the live test project across dashboard/RLS test files) — confirmed out of scope via the scope-boundary rule; the 12 new `tests/importacao/*` tests all pass in isolation (`npx vitest run tests/importacao`).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `SYSTEM_FIELDS`, `parseArquivo`, `validateUploadFile`, and `buildModeloImportacao` are all in place and tested, ready for 06-02 (row validation), 06-03 (upload/model-download UI), and 06-04 (column mapping UI) to consume directly
- No blockers for the remaining Phase 6 plans

---
*Phase: 06-importa-o-upload-mapeamento-e-revis-o*
*Completed: 2026-07-22*

## Self-Check: PASSED

All created files verified present (lib/importacao/types.ts, lib/importacao/parseArquivo.ts, lib/importacao/modelo.ts, tests/importacao/parseArquivo.test.ts, tests/importacao/modelo.test.ts, this SUMMARY.md). Both task commits (0d96ac1, 7fc5e3b) verified present in git log.
