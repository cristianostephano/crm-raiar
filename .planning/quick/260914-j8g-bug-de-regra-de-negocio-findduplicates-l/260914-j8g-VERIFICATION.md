---
phase: quick-260914-j8g
verified: 2026-09-14T14:25:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Quick Task 260914-j8g: Corrigir falso positivo de dedupe por filiais (CNPJ) — Verification Report

**Task Goal:** `findDuplicates` (lib/importacao/dedupe.ts) deixa de marcar como duplicado quando o CNPJ é diferente entre os dois lados (ambos presentes) — mesmo com nome igual. Quando um dos lados não tem CNPJ, mantém o comportamento antigo (só nome). Threading do CNPJ propagado por existentes.ts, confirmar.ts (planConfirmacao) e as duas Server Actions de importação (importacao.ts, importacaoAtivos.ts).

**Verified:** 2026-09-14
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Nome igual + CNPJ diferente (ambos presentes) NUNCA marca "Possível duplicado" — lote-contra-banco e lote-contra-lote — em Prospecção e Ativos | ✓ VERIFIED | `dedupe.ts:139-147` `cnpjDivergente` returns `true` only when both sides non-empty and different; used as `.find()` filter at lines 234-236 (batch-vs-DB) and 251-253 (batch-vs-batch) to skip incompatible candidates/anchors. Tests `(b1)` (dedupe.test.ts:187-201, batch-vs-existentes, Carrefour) and `(b2)` (lines 203-221, batch-vs-batch, Outback) both pass, asserting `result.has(0)`/`result.has(1)` is `false`. |
| 2 | Nome igual + MESMO CNPJ (pontuação diferente) continua marcado duplicado | ✓ VERIFIED | Tests `(a1)` (line 163), `(a2)` (line 175), and `(f)` (line 276, punctuation-vs-digits) all pass, asserting the row is still flagged. |
| 3 | Nome igual + QUALQUER lado sem CNPJ (nulo/indefinido/espaço) continua marcado duplicado | ✓ VERIFIED | `cnpjDivergente` returns `false` (not divergent) when either normalized side is empty (line 145). Tests `(c1)` DB-side null (line 223) and `(c2)` batch-side whitespace-only (line 234) both pass, asserting the row is still flagged. |
| 4 | Nome diferente nunca marca duplicado, independente do CNPJ | ✓ VERIFIED | Name-key lookup (`chaveDeComparacao`) happens before any CNPJ check — different names never share a map key. Test `(d)` (dedupe.test.ts:244) passes: different names + same CNPJ → not flagged. |
| 5 | A mesma regra de CNPJ vale tanto na revisão (validarLoteImportacao/validarLoteAtivos) quanto na revalidação de confirmar (D-02, planConfirmacao) | ✓ VERIFIED | `confirmar.ts:124-187`: `planConfirmacao` accepts `existentesCnpj`/`existentesNomesFantasiaCnpj` (5th/6th params), threads `c.resolved.cnpj` into `batchForDedupe`, and passes both CNPJ arrays into the same `findDuplicates` call used by the review screens. Test at `confirmar.test.ts:273-294` proves a name-matching but CNPJ-diverging "ok" row is no longer excluded at confirm time. |
| 6 | Quando o banco tem duas filiais com mesmo nome/CNPJs diferentes, uma linha do lote só é marcada duplicada da filial cujo CNPJ bate — nunca das duas, nem de nenhuma se não bater | ✓ VERIFIED | `existentesByKey` changed from `Map<string, string>` to `Map<string, CandidatoExistente[]>` (dedupe.ts:192-206); lookup uses `.find()` to pick the one candidate whose CNPJ is compatible. Test `(e)` (dedupe.test.ts:254-274) proves both the "matches the second filial" and "matches neither" cases. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/importacao/dedupe.ts` | `findDuplicates` CNPJ-aware, `DedupeBatchItem.cnpj` field | ✓ VERIFIED | Field added (line 90), two new private helpers (`normalizeCnpjParaComparacao`, `cnpjDivergente`), signature extended with `existentesCnpj`/`existentesNomesFantasiaCnpj` optional params defaulting to `[]`, internal maps converted to per-key candidate lists. |
| `lib/importacao/existentes.ts` | `nomesExistentesParaDedupe` extracts CNPJ index-aligned | ✓ VERIFIED | `ExistenteRow.cnpj?`, `NomesExistentesParaDedupe.razoesSociaisCnpj`/`nomesFantasiaCnpj` added; pushed inside the same conditional block as the corresponding name (lines 77-87), preserving index alignment. |
| `lib/importacao/confirmar.ts` | `planConfirmacao` applies CNPJ rule at D-02 | ✓ VERIFIED | New optional params (lines 129-130), `cnpj: c.resolved.cnpj` added to `batchForDedupe` (line 174), both CNPJ arrays forwarded to `findDuplicates` (lines 185-186). |
| `app/actions/importacao.ts` | 2 reads (validar/confirmar) bring + thread CNPJ | ✓ VERIFIED | Selects `"razao_social, nome_fantasia, cnpj"` (lines 105, 282); both destructure `razoesSociaisCnpj`/`nomesFantasiaCnpj`; both thread into `findDuplicates`/`planConfirmacao` calls. |
| `app/actions/importacaoAtivos.ts` | 2 reads (validar/confirmar) bring + thread CNPJ | ✓ VERIFIED | Selects `"razao_social, cnpj"` (lines 96, 223); both destructure `razoesSociaisCnpj`; threaded into `findDuplicates(batchForDedupe, existentes, [], existentesCnpj)` and `planConfirmacao(linhas, decisoes, existentesRazaoSocial, [], existentesCnpj)`. |
| `tests/importacao/dedupe.test.ts` | Covers scenarios (a)-(f) | ✓ VERIFIED | 10 new tests present, all named/commented per scenario letter, all passing. |
| `tests/importacao/existentes.test.ts` | Covers CNPJ extraction + null tolerance | ✓ VERIFIED | 2 new tests + updated empty-read assertion, all passing. |
| `tests/importacao/confirmar.test.ts` | Covers D-02 CNPJ rule | ✓ VERIFIED | 1 new test present and passing; pre-existing D-02 test (no-CNPJ-passed case) still passes unmodified. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `DedupeBatchItem.cnpj` | `ResolvedRow.cnpj` (annotarLinha.ts/annotarLinhaAtivo.ts) | `batchForDedupe` mapping in both Server Actions | ✓ WIRED | `annotarLinha.ts` and `annotarLinhaAtivo.ts` both produce `resolved.cnpj` (confirmed present); both Server Actions map `cnpj: annotatedRow.resolved.cnpj` into `batchForDedupe`, no new parsing introduced. |
| `existentesCnpj`/`existentesNomesFantasiaCnpj` | index-parallel `existentes`/`existentesNomesFantasia` | same conditional block in `nomesExistentesParaDedupe` | ✓ WIRED | Verified by code read (existentes.ts:76-88) and by test `existentes.test.ts:78-95` proving alignment survives independent filtering. |
| `planConfirmacao`'s D-02 `findDuplicates` call | same CNPJ rule as `validarLoteImportacao`/`validarLoteAtivos` | shared `findDuplicates` function, same param positions | ✓ WIRED | Both call sites pass CNPJ arrays into the identical exported `findDuplicates`; confirmed both Server Actions' validar+confirmar paths thread CNPJ (4 total reads). |
| `.select(...)` cnpj column | RLS SELECT policy on `clientes` | same table/policy already used for razao_social/nome_fantasia | ✓ WIRED (by inspection) | Column-level addition to an already row-scoped SELECT; consistent with existing pattern for nome_fantasia added in a prior phase. No new policy required (RLS is row-level, per CLAUDE.md/threat model in PLAN.md). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| dedupe/existentes/confirmar unit suites | `npx vitest run tests/importacao/dedupe.test.ts tests/importacao/existentes.test.ts tests/importacao/confirmar.test.ts` | 3 files, 44/44 tests passed | ✓ PASS |
| Type check across whole repo (proves 2 Server Actions compile with new params) | `npx tsc --noEmit` | exit 0, no errors | ✓ PASS |
| Lint on all 8 touched files | `npx eslint lib/importacao/dedupe.ts lib/importacao/existentes.ts lib/importacao/confirmar.ts app/actions/importacao.ts app/actions/importacaoAtivos.ts tests/importacao/dedupe.test.ts tests/importacao/existentes.test.ts tests/importacao/confirmar.test.ts` | exit 0, no errors | ✓ PASS |
| Related integration suites (preview/ativos-lote/confirmarAtivo/ativo-preview-table) | `npx vitest run tests/importacao/preview.test.ts tests/importacao/importar-ativos-lote.test.ts tests/importacao/confirmarAtivo.test.ts tests/importacao/ativo-preview-table.test.tsx` | 4 files, 27/27 tests passed | ✓ PASS |
| Commits referenced in SUMMARY.md actually exist | `git cat-file -e <hash>` for all 5 hashes | all 5 resolved | ✓ PASS |

Full unsanitized `npx vitest run` (whole workspace) was intentionally NOT re-run here — the plan's own `<verification>` section documents that `rls-*.test.ts`/`signInAs` suites require a live local Supabase instance and are a pre-existing environment condition unrelated to this fix; re-running the full suite would add no new evidence beyond the scoped runs above.

### Requirements Coverage

Quick task — no ROADMAP.md phase/REQUIREMENTS.md entry applies. Single requirement `QUICK-260914-j8g` declared in PLAN.md frontmatter, satisfied by all 6 truths above.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` (case-insensitive) across the 5 modified production files returned only false positives from Portuguese words ("todos", "método", "todo índice") — no actual debt markers, no empty-implementation stubs, no hardcoded-empty-data patterns in the new/changed code paths.

### Human Verification Required

None. All must-haves are pure-function logic covered by passing unit tests; the two Server Actions cannot be exercised by Vitest directly (documented, pre-existing constraint — same as `rls-dedup-read.test.ts`), but their wiring was verified by full type-check + the pure layers they call being fully tested, plus 27 passing integration tests exercising the surrounding preview/confirm flows.

### Gaps Summary

None. All 6 must-have truths, all 8 required artifacts, and all 4 key links verified directly against the code — not inferred from SUMMARY.md claims. 44/44 new/updated unit tests pass, 27/27 related integration tests pass, `tsc --noEmit` and `eslint` are clean, and all 5 commits referenced in SUMMARY.md exist in git history.

---

*Verified: 2026-09-14*
*Verifier: Claude (gsd-verifier)*
