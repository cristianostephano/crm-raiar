---
phase: 06-importa-o-upload-mapeamento-e-revis-o
verified: 2026-07-24T12:41:44Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 6: Importação — Upload, Mapeamento e Revisão Verification Report

**Phase Goal:** O Supervisor prepara uma importação de ponta a ponta antes de qualquer gravação: baixa um modelo de planilha, envia o arquivo (.xlsx/.csv), diz qual coluna do arquivo corresponde a qual campo do sistema (incluindo qual coluna define o vendedor responsável de cada cliente), e vê uma tela de revisão que classifica cada linha como OK, erro ou possível duplicado. Nada é criado nesta fase.

**Verified:** 2026-07-24T12:41:44Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, Phase 6)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Só o Supervisor acessa a tela de importação; Vendedor não vê o link nem consegue abrir a tela, e a restrição é aplicada pelo sistema | ✓ VERIFIED | Server Component guard in `app/(app)/clientes/importar/page.tsx` (lines 14-33): `redirect("/login")` if unauthenticated, `redirect("/")` if `callerProfile?.role !== "supervisor"`, checked BEFORE any render. Menu link lives only in `AppSidebar.tsx`'s `ADMIN_SECTION` (line 59-66), only mounted when `role === "supervisor"` (line 87-90). Both halves independently proven: `tests/e2e/importar-guard.spec.ts` (Playwright, redirect assertion) + `tests/importacao/AppSidebar.test.tsx` (2 tests: shows for supervisor, hides for vendedor) — both pass. Server Action `validarLoteImportacao` also re-checks `is_supervisor` server-side before any data read (`app/actions/importacao.ts` lines 61-71), so even a Vendedor who bypassed the UI/route guard cannot pull data through the Server Action. |
| 2 | Supervisor baixa um modelo de planilha (vazio + linha de exemplo) com exatamente as colunas esperadas | ✓ VERIFIED | `lib/importacao/modelo.ts#buildModeloImportacao` derives header row directly from `SYSTEM_FIELDS` labels (never able to drift) + exactly one example row. Unit-tested in `tests/importacao/modelo.test.ts` (4/4 pass: header order matches SYSTEM_FIELDS, exactly 1 example row, no funnel-stage column, all example values non-empty). Wired to UI via `ImportWizard.tsx#handleBaixarModelo` (Blob + `<a download>`, client-side, no Route Handler) — coordinator manually confirmed the downloaded .xlsx opens with correct columns + example row (06-04-SUMMARY.md Human Verification, step 2). |
| 3 | Depois de enviar a planilha, Supervisor associa cada coluna a um campo do sistema (incl. vendedor responsável) e pode marcar "não importar" | ✓ VERIFIED | `lib/importacao/mapping.ts` — `suggestMapping`/`applyMapping`/`requiredFieldsFaltando` pure and unit-tested (9/9 tests pass), including "vendedor"/"responsavel" header → `responsavel` field (IMP-04). `ColumnMappingTable.tsx` renders one row per file column with a `Select` offering every `SYSTEM_FIELD` + "Não importar esta coluna" always last. `ImportWizard.tsx` Step 2 blocks "Continuar" while `requiredFieldsFaltando(mapping).length > 0`, showing the inline warning text per missing field. Coordinator-verified end-to-end with a real pt-BR CSV (06-04-SUMMARY.md: "automatic column mapping correctly matched all 14 columns"). |
| 4 | Tela de revisão mostra cada linha como OK / erro / possível duplicado, sem bloquear/mesclar automaticamente | ✓ VERIFIED | `app/actions/importacao.ts#validarLoteImportacao` orchestrates `annotarLinha` (ok/erro) + `findDuplicates` (dedupe) with erro > duplicado > ok precedence (lines 118-145). `ImportPreviewTable.tsx` renders per-row status badge + reason + colored left border (`statusBorderClass`), the summary line via `summaryCounts`, and exposes "Importar mesmo assim"/"Pular" (default "Pular", row-keyed independent state) only on `duplicado` rows — `erro` rows show no action. Unit-tested: `dedupe.test.ts` (7/7), `annotarLinha.test.ts` (12/12), `preview.test.ts` (3/3). Coordinator-verified with a real 5-row fixture producing exactly "1 OK · 2 com erro · 2 possíveis duplicados" with the correct reasons and independent per-row toggles (06-04-SUMMARY.md Human Verification, steps 4-5). |
| 5 | Nenhum cliente é criado nesta etapa — é apenas pré-visualização | ✓ VERIFIED | `grep -rn -E "\.insert\(|\.update\(|\.rpc\(|\.upsert\(|\.delete\(" lib/importacao/ lib/validations/importacao.ts app/actions/importacao.ts components/importacao/` returns **zero matches** — no write call exists anywhere in this phase's code. `ImportWizard.tsx`'s "Confirmar importação" `onClick` is an explicit empty function with a comment tying the real write to Fase 7's `confirmarLoteImportacao`. Coordinator confirmed clicking it fires no network request and `/clientes` gains zero new clientes (06-04-SUMMARY.md Human Verification, step 5). |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| IMP-02 | 06-01, 06-03 | Modelo de planilha para download | ✓ SATISFIED | `buildModeloImportacao` (unit-tested) + wired download button, coordinator-confirmed |
| IMP-03 | 06-04 | Mapeamento de colunas + "não importar" | ✓ SATISFIED | `mapping.ts` (unit-tested) + `ColumnMappingTable.tsx`, coordinator-confirmed |
| IMP-04 | 06-01, 06-02, 06-04 | Coluna do vendedor responsável | ✓ SATISFIED | `SYSTEM_FIELDS.responsavel` (required) + `suggestMapping` alias "vendedor"→responsavel + `annotarLinha`'s `findVendedor` (email or normalized name match), all unit-tested |
| IMP-05 | 06-01, 06-02 | Validação de linha com regras mínimas do cadastro | ✓ SATISFIED | `createImportRowSchema` mirrors `createClienteSchema`'s 7 required fields exactly; `annotarLinha` unit-tested (12 tests) covering all missing-field cases |
| IMP-07 | 06-02, 06-04 | Sinalização de possíveis duplicados, decisão do supervisor | ✓ SATISFIED | `dedupe.ts#normalizeRazaoSocial`/`findDuplicates` (7 unit tests, incl. batch-internal D-03 case) + `ImportPreviewTable`'s per-row Importar/Pular (default Pular), never mass-action |
| IMP-08 | 06-04 | Tela de revisão com status OK/erro/duplicado + resumo | ✓ SATISFIED | `ImportPreviewTable.tsx` + `preview.ts#summaryCounts`/`statusBorderClass` (unit-tested), coordinator-confirmed exact counts on a real fixture |
| IMP-10 | 06-02, 06-03 | Importação restrita ao Supervisor | ✓ SATISFIED | Route guard (page.tsx redirect) + hidden menu link (AppSidebar) + Server Action app-layer gate (`validarLoteImportacao`'s `is_supervisor` check before any read) + RLS-scoped dedup read proven by `tests/importacao/rls-dedup-read.test.ts` (Vendedor A never sees Vendedor B's razão social; Supervisor sees both) |

No orphaned requirements — REQUIREMENTS.md maps exactly IMP-02, IMP-03, IMP-04, IMP-05, IMP-07, IMP-08, IMP-10 to Phase 6, matching the full set implemented here (IMP-01, IMP-06, IMP-09 correctly deferred to Phase 7 — the write phase).

### Required Artifacts (three-level check: exists / substantive / wired)

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `lib/importacao/types.ts` | SYSTEM_FIELDS vocabulary | ✓ VERIFIED | 14 fields, 7 required (razaoSocial, cep, rua, numero, cidade, estado, responsavel), no funnel-stage column. Reused by modelo.ts, annotarLinha.ts, mapping.ts, ColumnMappingTable.tsx |
| `lib/importacao/parseArquivo.ts` | Client-side .xlsx/.csv parser | ✓ VERIFIED | validateUploadFile + parseArquivo, both unit-tested (8 tests), wired into FileDropzone/ImportWizard |
| `lib/importacao/modelo.ts` | IMP-02 model generator | ✓ VERIFIED | buildModeloImportacao, unit-tested (4 tests), wired into ImportWizard's download button |
| `lib/importacao/dedupe.ts` | Duplicate detection engine | ✓ VERIFIED | normalizeRazaoSocial + findDuplicates, unit-tested (7 tests), wired into validarLoteImportacao |
| `lib/validations/importacao.ts` | Row schema (IMP-05) | ✓ VERIFIED | createImportRowSchema mirrors createClienteSchema's 7 required fields, wired into annotarLinha |
| `lib/importacao/annotarLinha.ts` | Per-row validation (IMP-04/IMP-05/D-02) | ✓ VERIFIED | annotarLinha, unit-tested (12 tests), wired into validarLoteImportacao |
| `app/actions/importacao.ts` | validarLoteImportacao Server Action | ✓ VERIFIED | IMP-10 gate + read-only orchestration, zero write calls confirmed via grep, wired into ImportWizard Step 3 |
| `app/(app)/clientes/importar/page.tsx` | Supervisor-only route | ✓ VERIFIED | Server Component guard, wired into Next.js App Router (confirmed in build output as route `ƒ /clientes/importar`) |
| `components/layout/AppSidebar.tsx` | Menu link (ADMIN_SECTION) | ✓ VERIFIED | "Importar clientes" link, role-gated, unit-tested (2 tests) |
| `components/importacao/FileDropzone.tsx` | Upload UI | ✓ VERIFIED | Drag/drop + native input, validateUploadFile-backed, unit-tested (2 tests) |
| `components/importacao/ImportWizard.tsx` | 3-step wizard shell | ✓ VERIFIED | All 3 steps fully wired (upload→mapping→review), no dead placeholders remain |
| `lib/importacao/mapping.ts` | Column mapping engine (IMP-03/IMP-04) | ✓ VERIFIED | suggestMapping/applyMapping/requiredFieldsFaltando, unit-tested (9 tests) |
| `components/importacao/ColumnMappingTable.tsx` | Mapping grid UI | ✓ VERIFIED | Controlled Select-per-column grid, coordinator-confirmed |
| `lib/importacao/preview.ts` | Review helpers (IMP-08) | ✓ VERIFIED | summaryCounts/statusBorderClass, unit-tested (3 tests) |
| `components/importacao/ImportPreviewTable.tsx` | Review screen (IMP-07/IMP-08) | ✓ VERIFIED | Paginated table, per-row status/reason/decision, coordinator-confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `parseArquivo.ts`/`modelo.ts` | `@e965/xlsx` | `type: "array"` (browser-safe) | ✓ WIRED | Confirmed by source inspection — never uses `type: "buffer"` (Node-only, reserved for server export) |
| `ImportWizard.tsx` | `validarLoteImportacao` (Server Action) | direct call in `useEffect` on step 3 entry | ✓ WIRED | Result rendered via `ImportPreviewTable`; error path shows generic banner |
| `ColumnMappingTable.tsx` | `ImportWizard.tsx` state | fully controlled props (mapping/onMappingChange) | ✓ WIRED | Mapping state lives in ImportWizard, survives step navigation (confirmed by source) |
| `annotarLinha.ts` | `sanitizeCell` (from `lib/clientes/exportacao.ts`) | import + call before resolution | ✓ WIRED | Every cell value sanitized before entering `resolved`, closing CSV-injection hole on import side (A4), unit-tested |
| `validarLoteImportacao` | RLS-scoped `clientes`/`profiles` reads | `supabase.from(...).select(...)` with no manual `responsavel` filter | ✓ WIRED | Confirmed by source + proven by `tests/importacao/rls-dedup-read.test.ts` (Vendedor A excluded, Supervisor sees all) |
| `AppSidebar.tsx` ADMIN_SECTION | role gate | `role === "supervisor"` conditional section array | ✓ WIRED | Unit-tested (AppSidebar.test.tsx, 2/2 pass) |
| `page.tsx` guard | `ImportWizard` render | conditional `redirect()` before component render | ✓ WIRED | E2E-tested via Playwright (both directions: Vendedor redirected, Supervisor sees wizard) |

### Data-Flow Trace (Level 4)

Not applicable in the traditional dashboard-aggregate sense — this phase is entirely client-parsed/user-input driven (no server-rendered aggregate data to trace for hollowness). The one server-side read path (`validarLoteImportacao`'s lookups) was traced above under Key Links and confirmed RLS-scoped, non-static (real Supabase queries, not hardcoded empty returns).

### Behavioral Spot-Checks / Automated Test Suite

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full `tests/importacao` suite | `npx vitest run tests/importacao` | 9 test files, 54 tests, all pass | ✓ PASS |
| No DB writes anywhere in phase 6 code | `grep -rn -E "\.insert\(\|\.update\(\|\.rpc\(\|\.upsert\(\|\.delete\(" lib/importacao/ lib/validations/importacao.ts app/actions/importacao.ts components/importacao/` | zero matches | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK) in phase 6 code | `grep -rn -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` over phase 6 files | zero matches | ✓ PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | no output (clean) | ✓ PASS |
| Production build succeeds | `npm run build` | Compiled successfully; `/clientes/importar` listed as a dynamic route | ✓ PASS |

**Note on `tests/importacao/rls-dedup-read.test.ts` (live-Supabase-dependent):** This test file signs in against the live Supabase test project (not a mock). Running the full `tests/importacao` suite once (as requested) passes cleanly every time it was run in this verification pass (confirmed 3 separate full-suite runs, 54/54 each). However, re-running *this single file in isolation* several times back-to-back within a short window intermittently timed out on `signInWithPassword` (5s default Vitest timeout) — this is the same pre-existing environmental flake already documented in `06-01-SUMMARY.md` ("Supabase Auth Request rate limit reached against the live test project") and `06-03-SUMMARY.md` ("intermittently fails the second login attempt... same rate-limit issue"), triggered here by my own repeated reruns exhausting Supabase Auth's login rate limit, not a defect in this phase's code. This is an ℹ️ INFO-level finding, not a blocker — the requested command (`npx vitest run tests/importacao`) passes consistently under normal (single) invocation.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `components/importacao/ImportWizard.tsx` | 49 | Doc-comment says "Steps 2 and 3 ... are structural placeholders for 06-04 to fill in" | ℹ️ Info | Stale documentation only — 06-04 has since filled in both steps completely (confirmed by source read); the comment describes the state as of 06-03's completion and was not updated after 06-04. Zero functional impact; not a stub in the actual behavior. |

No blocker or warning-level anti-patterns found. No unreferenced debt markers. No hardcoded-empty stub renders in dynamic-data paths.

### Requirements Coverage (traceability note)

`.planning/REQUIREMENTS.md` still shows IMP-03/IMP-04/IMP-05/IMP-07/IMP-08 as "Pending" in its traceability table (checkbox unchecked) — this is expected pre-ship state; the ship/complete-phase workflow updates these check-marks after this VERIFICATION.md is accepted, not before.

### Human Verification Required

None. All must-haves are verified through source inspection, passing automated unit/integration tests, and previously-completed coordinator browser verification (already documented and accepted in 06-04-SUMMARY.md's "Human Verification" section, per the task instructions not to repeat the manual browser pass).

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria for Phase 6 are verified against actual, wired, tested code:

- IMP-10 (Supervisor-only) is enforced at three independent layers: route guard (redirect), menu visibility (hidden link), and the Server Action's own `is_supervisor` app-layer gate before any data read — not merely UI-hidden.
- Zero database writes exist anywhere in this phase's code (`grep` across every phase-6 file for insert/update/rpc/upsert/delete returns nothing); the "Confirmar importação" button is a documented, intentional no-op reserved for Phase 7.
- The duplicate-detection (dedupe.ts) and error-annotation (annotarLinha.ts) logic is wired end-to-end: `ImportWizard` → `validarLoteImportacao` (Server Action) → `annotarLinha` + `findDuplicates` → `ImportPreviewTable`, not left as unused/orphaned pure functions — confirmed by tracing every function from definition through to its caller and finally into the rendered UI.
- 54/54 automated tests pass (`npx vitest run tests/importacao`), `npx tsc --noEmit` is clean, and `npm run build` succeeds with `/clientes/importar` correctly listed as a route.

---

_Verified: 2026-07-24T12:41:44Z_
_Verifier: Claude (gsd-verifier)_
