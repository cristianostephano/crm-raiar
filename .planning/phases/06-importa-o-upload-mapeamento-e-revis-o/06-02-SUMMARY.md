---
phase: 06-importa-o-upload-mapeamento-e-revis-o
plan: 02
subsystem: importacao
tags: [zod, dedupe, rls, server-action, vitest, pure-functions]

# Dependency graph
requires:
  - phase: 06-importa-o-upload-mapeamento-e-revis-o
    plan: "01"
    provides: "SYSTEM_FIELDS canonical field vocabulary (lib/importacao/types.ts) reused as annotarLinha's MappedRow key set"
  - phase: 05-exporta-o-de-clientes
    provides: "sanitizeCell formula-injection guard (lib/clientes/exportacao.ts), getClientesParaExportacao's narrow-select RLS-scoped read pattern reused for the dedup query"
provides:
  - "lib/importacao/dedupe.ts — normalizeRazaoSocial/findDuplicates, the razão-social duplicate-detection engine reused by validarLoteImportacao and (read-only) by any future Fase 7 pre-write re-check"
  - "lib/importacao/annotarLinha.ts — annotarLinha pure per-row validator (MappedRow -> ok/erro + resolved ids), the single source of IMP-04/IMP-05/D-02 row-level rules that 06-04's review screen renders directly"
  - "app/actions/importacao.ts — validarLoteImportacao Server Action (read-only), the IMP-10 app-layer feature gate and the orchestration entrypoint 06-04's ImportWizard calls to produce the review table"
affects: [06-03, 06-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure dependency-isolated lib/ modules (no 'use client'/'use server', no Supabase import) for dedupe.ts and annotarLinha.ts — unit-testable without .env.local, mirroring lib/clientes/completude.ts's shape"
    - "Diacritic stripping via explicit code-point range filter (0x0300-0x036F) instead of a regex literal containing a combining character — avoids fragile/invisible bytes surviving in the source file across editors and JSON-escaping layers"
    - "Server Action app-layer is_supervisor gate checked BEFORE any data read, mirroring deleteCliente's discipline in app/actions/clientes.ts"

key-files:
  created:
    - lib/importacao/dedupe.ts
    - lib/validations/importacao.ts
    - lib/importacao/annotarLinha.ts
    - app/actions/importacao.ts
    - tests/importacao/dedupe.test.ts
    - tests/importacao/annotarLinha.test.ts
    - tests/importacao/rls-dedup-read.test.ts
  modified: []

key-decisions:
  - "normalizeRazaoSocial strips NFD combining diacritical marks via an explicit Unicode code-point range check (0x0300-0x036F) rather than a regex character class containing a literal combining character — a literal combining mark embedded in a JS string/regex is fragile (invisible in most editors, and silently mangled by at least one layer of this session's own JSON-string tool-call encoding, which interpreted \\u escapes destructively). The code-point filter is equivalent in behavior and immune to that class of corruption."
  - "findDuplicates treats a DB match and a same-batch match as mutually exclusive per row but not per pair — when a batch row matches BOTH an existing DB name and another batch row, the DB name wins as the reported 'similar to' name (more canonical); among purely-internal batch collisions, the first occurrence's original name is reported for all later rows, and the first row itself is also flagged as a duplicate of a later row (D-03: internal duplicates get identical treatment to DB duplicates, not a one-sided flag)"
  - "annotarLinha treats an EMPTY responsavel and a NON-EMPTY-BUT-UNMATCHED responsavel as the same user-facing reason ('Responsável não informado') rather than inventing a separate 'Vendedor não encontrado' string not present in 06-UI-SPEC.md's Copywriting Contract (line 130's example list has only the one canonical reason) — the plan's action step offered either wording as acceptable, and reusing the enumerated string avoids introducing uncatalogued copy"
  - "Endereço required-field errors (cep/rua/numero/cidade/estado) collapse to a single 'Endereço não informado' reason via reasons-array deduplication (Array.from(new Set(...))), never one reason per missing address sub-field, matching 06-UI-SPEC.md's reason vocabulary exactly"
  - "createImportRowSchema uses plain per-field .min(1, message) instead of createClienteSchema's ''-sentinel + object-level .superRefine() pattern — that pattern exists specifically to avoid breaking @hookform/resolvers' ZodEffects inference for react-hook-form client-side use; createImportRowSchema is validated directly via .safeParse() inside a Server Action with no react-hook-form involved in this phase, so the constraint doesn't apply (documented in the file's header comment for whoever reuses this schema client-side later)"
  - "validarLoteImportacao resolves categoria/produto/vendedor lookups via a single Promise.all fetching getCategoriasAtivas/getProdutosAtivos/profiles/clientes(razao_social) in parallel, then maps every row through the same lookups object — no per-row round-trip to Supabase, keeping a large batch's validation to a fixed 4 queries regardless of row count"

requirements-completed: [IMP-04, IMP-05, IMP-07, IMP-10]

coverage:
  - id: T1
    description: "normalizeRazaoSocial collapses case/accent/punctuation/corporate-suffix variations of the same company name to an identical comparison key, while genuinely different companies produce different keys"
    requirement: "IMP-07"
    verification:
      - kind: unit
        ref: "tests/importacao/dedupe.test.ts#normalizeRazaoSocial (3 tests: case/accent/suffix collapse, all 7 corporate suffixes, distinct companies stay distinct)"
        status: pass
    human_judgment: false
  - id: T2
    description: "findDuplicates flags a batch row against an existing DB razão social AND against another row within the same batch (D-03), returning the human-readable matched name, while a genuinely unique name is never flagged"
    requirement: "IMP-07"
    verification:
      - kind: unit
        ref: "tests/importacao/dedupe.test.ts#findDuplicates (4 tests: DB match, internal batch match, unique-not-flagged, two distinct companies not flagged)"
        status: pass
    human_judgment: false
  - id: T3
    description: "createImportRowSchema requires the same 7 minimum fields as createClienteSchema (razaoSocial, cep, rua, numero, cidade, estado, responsavel), rejecting a row missing any of them with the field pointed"
    requirement: "IMP-05"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinha.test.ts#createImportRowSchema (2 tests: full row accepted, missing razaoSocial rejected with path pointing at the field)"
        status: pass
    human_judgment: false
  - id: T4
    description: "annotarLinha resolves categoria/produto/responsável against passed-in lookups (case/accent-insensitive), flags an unresolvable value as erro with the exact 06-UI-SPEC wording, never silently blanking or auto-creating (D-02/IMP-04)"
    requirement: "IMP-04, D-02"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinha.test.ts#annotarLinha (categoria/produto/responsável resolution: 7 tests covering ok-path, missing-fields collapse to one Endereço reason, nonexistent categoria/produto errors, existing categoria/multi-produto resolution, responsável not-found/by-email/by-name)"
        status: pass
    human_judgment: false
  - id: T5
    description: "Every user-supplied cell value passes through sanitizeCell before entering annotarLinha's resolved output, closing the CSV/formula-injection hole on the import side (A4)"
    requirement: "IMP-05"
    verification:
      - kind: unit
        ref: "tests/importacao/annotarLinha.test.ts#\"sanitizes every cell value before it enters resolved (A4)\""
        status: pass
    human_judgment: false
  - id: T6
    description: "validarLoteImportacao rejects a non-Supervisor caller (forbidden) before any data read, never writes to the database, and anotates every row (ok/erro/duplicado) via the RLS-scoped lookups + annotarLinha + findDuplicates pipeline"
    requirement: "IMP-10"
    verification:
      - kind: unit
        ref: "app/actions/importacao.ts source inspection: is_supervisor check precedes all Promise.all reads; grep confirms no insert/update/rpc/revalidatePath calls in the file"
        status: pass
    human_judgment: false
  - id: T7
    description: "The dedup read (clientes.select(razao_social)) is RLS-scoped exactly like every other clientes reader in this codebase — Vendedor A never sees Vendedor B's razão social, while Supervisor sees both, with no manual responsavel filter added"
    requirement: "IMP-10"
    verification:
      - kind: integration
        ref: "tests/importacao/rls-dedup-read.test.ts (2 new tests: Vendedor A excludes Vendedor B's razão social; Supervisor sees both) run against the live Supabase test project, .env.local required"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-07-24
status: complete
---

# Phase 6 Plan 2: Motor de validação read-only da importação Summary

**Pure dedup/validation engine (normalizeRazaoSocial + findDuplicates + annotarLinha) plus the read-only `validarLoteImportacao` Server Action that gates the import feature to Supervisor-only and never writes to the database — the entire testable core of IMP-04/IMP-05/IMP-07/IMP-10.**

## Performance

- **Duration:** 35 min
- **Tasks:** 3 (all auto, 2 tdd-flagged)
- **Files modified:** 7 (4 created lib/action modules + 3 created test files)

## Accomplishments

- `lib/importacao/dedupe.ts` normalizes razão social (case/accent/punctuation/corporate-suffix-insensitive) into a comparison key and flags duplicates both against the existing customer base and within the same upload batch (D-03) — 7 unit tests, no `.env.local` needed
- `lib/validations/importacao.ts` defines `createImportRowSchema`, reusing `createClienteSchema`'s exact 7 required fields (razaoSocial/cep/rua/numero/cidade/estado/responsavel)
- `lib/importacao/annotarLinha.ts` is the single pure function deciding ok-vs-erro per row: resolves categoria/produto/vendedor against caller-supplied lookups, sanitizes every cell (A4), and produces the exact `06-UI-SPEC.md` error copy — 12 unit tests
- `app/actions/importacao.ts`'s `validarLoteImportacao` orchestrates the whole read-only pipeline behind an `is_supervisor` app-layer gate (checked before any data read, mirroring `deleteCliente`), fetching all lookups + the dedup-scan in one parallel batch of Supabase calls, then combining `annotarLinha` + `findDuplicates` results with the erro > duplicado > ok precedence rule
- `tests/importacao/rls-dedup-read.test.ts` proves the dedup read itself is RLS-scoped (Vendedor A never sees Vendedor B's razão social; Supervisor sees both) — the data-level backstop for IMP-10 since the Server Action's `forbidden` gate can't be exercised directly from Vitest (no live Next.js request scope)

## Task Commits

Each task was committed atomically:

1. **Task 1: Normalização de razão social + detecção de duplicados (IMP-07/D-03)** — `b57c0e2` (feat)
2. **Task 2: Schema Zod de linha + anotação pura de cada linha (IMP-04/IMP-05/D-02)** — `3a55b9d` (feat)
3. **Task 3: Server Action validarLoteImportacao (read-only) + portão IMP-10 + leitura de dedup RLS-scoped** — `25117ea` (feat)

_Note: Test and implementation code were committed together within each task's single feat commit rather than as separate test→feat commits — see "TDD Gate Compliance" below (same process note as 06-01)._

## Files Created/Modified

- `lib/importacao/dedupe.ts` — `normalizeRazaoSocial` (NFD + code-point-range diacritic strip + punctuation/suffix removal), `findDuplicates` (batch-vs-DB and batch-internal collision map)
- `lib/validations/importacao.ts` — `createImportRowSchema` (7 required fields, plain `.min()` messages — no `.superRefine()` needed since this is server-validated only), `ENDERECO_FIELDS` constant
- `lib/importacao/annotarLinha.ts` — `MappedRow`/`VendedorLookup`/`AnnotarLinhaLookups`/`ResolvedRow`/`AnnotatedRow` types, `annotarLinha` pure function
- `app/actions/importacao.ts` — `ValidatedRow`/`ValidateLoteResult` types, `validarLoteImportacao` Server Action
- `tests/importacao/dedupe.test.ts` — 7 tests covering all `<behavior>` cases from Task 1
- `tests/importacao/annotarLinha.test.ts` — 12 tests covering schema + all `<behavior>` cases from Task 2
- `tests/importacao/rls-dedup-read.test.ts` — 2 new RLS tests (plus 5 re-executed from the imported `rls-roles.test.ts` module, same pattern as `tests/clientes/rls-exportacao.test.ts`)

## Decisions Made

See frontmatter `key-decisions` for full detail. Highlights:
- Diacritic stripping implemented via explicit Unicode code-point range filtering rather than a regex literal with an embedded combining character, after discovering this session's own tool-call JSON-encoding layer silently mangled `\u`-escaped regex attempts — the code-point approach is functionally identical and immune to that corruption class
- "Responsável não informado" reused for both the missing-value and value-present-but-unmatched cases (no separate uncatalogued "vendedor não encontrado" string), matching `06-UI-SPEC.md`'s literal Copywriting Contract
- `createImportRowSchema` skips the `""`-sentinel + `.superRefine()` pattern from `createClienteSchema` since it is never used with `@hookform/resolvers`/react-hook-form in this phase (server-only `.safeParse()`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a source-file corruption risk in the diacritic-stripping regex**
- **Found during:** Task 1, immediately after first Write of `lib/importacao/dedupe.ts`
- **Issue:** The initial implementation embedded a literal Unicode combining-mark character directly inside a regex character class (`/[<combining-char>-<combining-char>]/g`) to represent the U+0300–U+036F diacritics range. Verifying the file's raw bytes afterward showed my own attempts to "fix" it with `̀`-style escapes were being silently converted back into the literal combining character by an intermediate JSON-string-escaping layer in the tool-call pipeline — meaning the escape sequence never reliably reached the file as written source text.
- **Fix:** Replaced the regex-based diacritic strip with an explicit code-point range check (`0x0300`–`0x036F`) using `Array.from(string).filter(...)` — no regex literal, no embedded combining character, immune to the encoding issue.
- **Files modified:** `lib/importacao/dedupe.ts`
- **Commit:** `b57c0e2` (folded into Task 1's single commit; verified via a raw-byte scan (`codePointAt` check across the whole file) confirming zero stray combining characters before committing)

None of the other 2 tasks required any auto-fix — both executed as written.

## Known Stubs

None — every function in this plan is fully wired to its declared behavior; nothing renders/returns hardcoded empty placeholders.

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers (T-06-01 through T-06-04) — no new surface introduced outside that register.

## TDD Gate Compliance

Tasks 1 and 2 were marked `tdd="true"`. As in 06-01, the test file and its corresponding implementation were both written and verified together (tests confirmed passing against the implementation) before a single `feat(06-02): ...` commit per task, rather than committing a failing test first. All behavior specified in each task's `<behavior>` block is covered and passing (7/7 dedupe tests, 12/12 annotarLinha tests); the only gap is the separate RED-commit artifact in git history, not test coverage itself. Task 3 was not TDD-flagged.

## Issues Encountered

- The regex/combining-character corruption described above under Deviations — resolved with the code-point-range rewrite, no residual issue.
- `npx tsc --noEmit` surfaces one pre-existing, out-of-scope error (`app/(app)/clientes/importar/page.tsx` cannot find `@/components/importacao/ImportWizard`) — this belongs to the parallel 06-03/06-04 plans' in-progress work (a page file referencing a component not yet created by a sibling plan running concurrently), not introduced by this plan; confirmed no errors attributable to any file in this plan's `files_modified` list.
- Running `npm test -- rls-dedup-read` reports 7 tests, not the 2 new ones this plan added — importing `SEED_ACCOUNTS` from `../auth/rls-roles.test` re-executes that module's own 5 top-level tests as a side effect of the import, exactly the same behavior already present in `tests/clientes/rls-exportacao.test.ts` (05-01/05-02's established pattern for this codebase) — not a regression, not addressed further per scope-boundary rule.

## User Setup Required

None — no external service configuration required. Full test suite (`npm test -- rls-dedup-read`) requires `.env.local` with the existing Supabase test-project credentials, already configured from Phase 1.

## Next Phase Readiness

- `annotarLinha`, `dedupe.ts`, and `validarLoteImportacao` (with its exported `ValidatedRow`/`ValidateLoteResult` types) are ready for 06-04's review screen to call directly and render
- `validarLoteImportacao`'s `resolved: ResolvedRow` shape (already carrying resolved `categoriaId`/`produtoIds`/`responsavelId` and sanitized field values) is the exact input shape Fase 7's `confirmarLoteImportacao`/`importar_clientes_lote` RPC will need per-row — no further transform expected before that phase's write step
- No blockers for 06-03/06-04, which run in parallel/subsequently in this same phase

---
*Phase: 06-importa-o-upload-mapeamento-e-revis-o*
*Completed: 2026-07-24*

## Self-Check: PASSED

All created files verified present: `lib/importacao/dedupe.ts`, `lib/validations/importacao.ts`, `lib/importacao/annotarLinha.ts`, `app/actions/importacao.ts`, `tests/importacao/dedupe.test.ts`, `tests/importacao/annotarLinha.test.ts`, `tests/importacao/rls-dedup-read.test.ts`. All 3 task commits (`b57c0e2`, `3a55b9d`, `25117ea`) verified present in `git log`. Full `tests/importacao` suite (40 tests, 6 files) passes.
