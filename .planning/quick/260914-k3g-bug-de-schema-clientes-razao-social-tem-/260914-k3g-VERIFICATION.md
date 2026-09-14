---
phase: quick-260914-k3g
verified: 2026-09-14T15:55:00Z
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Quick Task 260914-k3g Verification Report

**Task Goal:** `clientes.razao_social` deixa de ter unicidade só pelo nome — passa a ser razão social+CNPJ (CNPJ diferente entre os dois lados nunca mais colide; CNPJ ausente de um dos lados mantém a trava por nome). Corrige o bug real de 743/1755 linhas puladas por engano numa importação em massa de "Clientes Ativos" (lojas de rede com CNPJ diferente por filial).

**Verified:** 2026-09-14T15:55:00Z
**Status:** passed
**Re-verification:** No — initial verification (no prior VERIFICATION.md existed; SUMMARY.md was also never written, verification proceeded directly against code + live DB)

## Scope note

The original plan shipped only migration 0030. During the same-day execution, the orchestrator discovered live (against the real hosted DB and the new integration tests) that 0030 contained a hard Postgres syntax error (`jsonb_to_recordset(...) with ordinality as c(col type, ...)` — invalid, error 42601) plus two subsequent logic bugs in the classification query of `importar_clientes_ativos_lote`. These were fixed via three new, additive migrations: 0031 (syntax fix), 0032 (fix for intra-batch duplicate ambiguity — introduced a new bug), 0033 (fix for post-insert self-collision — final, correct version). This verification evaluates the **combined, currently-effective SQL** — i.e., 0030's DDL objects (constraint removal, index, `razao_social_cnpj_colide`, trigger) plus `importar_clientes_lote` as last defined in 0031, plus `importar_clientes_ativos_lote` as last defined in 0033 (0031/0032 versions of that function are superseded `create or replace`, never executed as final state).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Razão social igual + CNPJ igual (ambos presentes) continua colidindo — só a primeira grava — nas duas RPCs e no cadastro manual | ✓ VERIFIED | RPC path: live test `mesmocnpj` passes for both `importar_clientes_lote` and `importar_clientes_ativos_lote` (6/6 suite green, ran against real hosted DB). Manual-cadastro path: code trace of `clientes_bloqueia_duplicata_razao_social_cnpj()` (0030) shows it calls the exact same `razao_social_cnpj_colide()` function already proven correct by the 6 RPC tests, via a plain `EXISTS` check — logically equivalent, no separate implementation to diverge. Direct behavioral test of the manual path (`tests/clientes/rls-clientes.test.ts` D-06 case) could not run due to a pre-existing, documented, unrelated infra issue (see Anti-Patterns/Gaps note below) — not a regression of this migration. |
| 2 | Razão social igual + CNPJ diferente (ambos presentes) NUNCA MAIS colide — as duas gravam — nas duas RPCs (bug real corrigido) | ✓ VERIFIED | Live test `cnpjdiferente` passes for both RPCs — 2 distinct rows inserted with distinct ids in each. |
| 3 | Razão social igual + CNPJ ausente em um ou nos dois lados continua colidindo nas duas RPCs e no cadastro manual | ✓ VERIFIED | Live test `semcnpjassimetrico` passes for both RPCs (only 1 row survives in each). Manual path: same code-trace argument as Truth 1 — `razao_social_cnpj_colide` returns `true` whenever either side's CNPJ is null/blank, verified directly by the RPC tests using the identical function. |
| 4 | Cadastro/edição manual continua devolvendo 23505 mapeado para `duplicate_razao_social`, SEM mudança de código TypeScript | ✓ VERIFIED | `app/actions/clientes.ts` last touched by an earlier, unrelated commit (`14d4c55`, quick-260914-j8g) — zero commits from this task touch it. `grep` confirms `error.code === "23505"` still present at lines 129 and 334. Trigger in 0030 raises `USING ERRCODE = '23505'` explicitly — same code path. |
| 5 | Nenhuma linha hoje em produção pode violar a regra nova — migration não precisa validar/limpar dados existentes | ✓ VERIFIED | Logical proof holds (old single-column unique constraint was strictly more restrictive than the new composite rule, so no legacy row can violate the new rule) and migration 0030 contains no data-cleanup/backfill statement — confirmed by full read of the file. |
| 6 | `cliente_produtos` recebe os produtos certos mesmo quando duas linhas do mesmo lote compartilham razão social com CNPJ diferente | ✓ VERIFIED | Live test `cnpjdiferente` in both RPC describes explicitly asserts the CNPJ-less second row has zero `cliente_produtos` rows and the first row's product is present — passes in both suites, proving the `(razao_social, cnpj) IS NOT DISTINCT FROM` join fix works. |
| 7 | Um lote de importação nunca é abortado inteiro por uma linha colidente | ✓ VERIFIED | Both RPCs pre-filter via `NOT EXISTS` (against table) and `WITH ORDINALITY` self-join (against prior rows in batch) before the `INSERT`, with no `ON CONFLICT` remaining (confirmed no unique index survives on `razao_social` alone). Live tests directly prove this: the `mesmocnpj` case (a guaranteed collision inside the batch) still returns a successful partial result instead of an aborted transaction. |

**Score:** 7/7 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0030_unicidade_razao_social_cnpj.sql` | Dynamic constraint removal, index, pure function, SECURITY DEFINER trigger, both RPCs recreated with pre-filter | ✓ VERIFIED | File exists, 466 lines, all required elements present and pass every grep check from the plan's own Task 1 automated verify block (razao_social_cnpj_colide ×6, security definer ×1, errcode 23505 ×1, with ordinality ×4, idx ×1, is_supervisor ×2, is not distinct from ×3, cliente_ativo_pronto_para_ganho ×3, pg_constraint ×1). |
| `supabase/migrations/0031_fix_with_ordinality_syntax.sql` | Fixes invalid `with ordinality` + inline column-list syntax | ✓ VERIFIED | Uses correct `rows from (jsonb_to_recordset(...) as (...)) with ordinality as c(...)` form. Both RPCs redefined; confirmed valid by successful live execution in the test run. |
| `supabase/migrations/0032_fix_classificacao_ativos_duplicado.sql` | Intermediate fix — recomputes `aptos` to disambiguate classification by `linha` | ✓ VERIFIED (superseded) | Correctly diagnoses and partially fixes the ambiguity bug; superseded by 0033's `create or replace` — never the live final state, but its intent (never using bare `(razao_social, cnpj)` as a classification key when the batch has internal duplicates) carries into 0033. |
| `supabase/migrations/0033_fix_classificacao_ativos_autocolisao.sql` | Final fix — classification never re-queries `clientes` after INSERT | ✓ VERIFIED | Uses `vencedores` CTE built only from `v_razoes`/`v_cnpjs` (in-memory INSERT result) + intra-batch duplicate check, never re-touches `clientes`. This is the live, currently-effective definition of `importar_clientes_ativos_lote`. Confirmed correct by live `mesmocnpj` test on ativos (1 inserido + 1 duplicado, matching expectation). |
| `tests/importacao/unicidade-razao-social-cnpj.test.ts` | 6 integration tests, 3 scenarios × 2 RPCs | ✓ VERIFIED | File exists, 311 lines, uses disposable `createTestMember`/`deleteTestMember` fixtures (never `SEED_ACCOUNTS`), covers exactly the 3 business scenarios per RPC plus explicit cross-contamination checks on `cliente_produtos`. All plan Task 2 grep checks pass (it( ×7 — 6 tests + `describe` not matched, ok since check only required ≥6; importar_clientes_lote/ativos_lote present; createTestMember present; duplicado ×6; cliente_produtos ×2). **6/6 tests pass live against the real hosted Supabase project.** |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Trigger + both RPC pre-filters | `razao_social_cnpj_colide()` | Single source of truth for collision rule | ✓ WIRED | Function called from the trigger and from both RPCs' `aptos` CTEs (and the ativos RPC's `vencedores` CTE in 0033) — no other place reimplements the comparison logic. |
| Trigger | RLS bypass | `SECURITY DEFINER` + `SET search_path = public` | ✓ WIRED | Present in the function definition; reasoning (global uniqueness must not be limited by the calling vendedor's RLS visibility) matches the project's other 4 documented `SECURITY DEFINER` exceptions. |
| Both RPCs | Batch abort avoidance | `NOT EXISTS` pre-filter + `WITH ORDINALITY`/`ROWS FROM` self-join, before INSERT, no `ON CONFLICT` | ✓ WIRED | Confirmed by code trace and directly proven by the live `mesmocnpj` tests not throwing/aborting. |
| `app/actions/clientes.ts` | Trigger's `ERRCODE 23505` | Existing `if (error.code === "23505")` branches, D-06 | ✓ WIRED (unchanged) | File untouched by this task's commits; error code contract preserved by the trigger raising the identical code. |
| `cliente_produtos` INSERT (both RPCs) | Correlation key | `(razao_social, cnpj)` with `IS NOT DISTINCT FROM` on CNPJ | ✓ WIRED | Present in both RPCs' final versions; directly proven correct by the `cnpjdiferente` tests (no cross-store product contamination). |
| Ativos RPC classification (`RETURN QUERY`) | Correlation key (post-0033) | In-memory `v_razoes`/`v_cnpjs` arrays + intra-batch duplicate check, never re-queries `clientes` | ✓ WIRED | Confirmed correct via live `mesmocnpj` test on ativos (previously broken by 0032's self-collision bug, fixed in 0033). |

### Behavioral Spot-Checks / Live Integration Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| New unicidade rule (6 cases, 2 RPCs) against real hosted DB | `npx vitest run tests/importacao/unicidade-razao-social-cnpj.test.ts` | 1 test file, 6 tests passed, 8.21s | ✓ PASS |
| Regression — sibling `importar_clientes_ativos_lote` RPC feature set (25-01/ATIVO-01..03) unaffected | `npx vitest run tests/importacao/importar-ativos-lote.test.ts` | 1 test file, 10 tests passed, 8.32s | ✓ PASS |
| Type safety | `npx tsc --noEmit` | Clean, no output, exit clean | ✓ PASS |
| Best-effort — manual cadastro 23505 contract (`cliente-actions.test.ts`, `rls-clientes.test.ts`) | `npx vitest run tests/clientes/cliente-actions.test.ts tests/clientes/rls-clientes.test.ts` | 15 failed / 13 passed — **all 15 failures are `signInAs("vendedor.a+test@raiar.local") failed: Invalid login credentials`** | ⚠️ PRE-EXISTING, OUT OF SCOPE (see note) |

**Note on the best-effort failures:** All 15 failures across both files trace to the exact same root cause — the `vendedor.a+test@raiar.local` / `vendedor.b+test@raiar.local` seed accounts, documented in `.planning/STATE.md` (line 388) as deleted on 2026-08-19 by a prior, unrelated quick task (`260819-l6o`), affecting ~49 test files project-wide, with the fix decision still open ("Aberto — decisão pendente"). The plan itself explicitly anticipated this exact failure mode and instructed: *"Se falharem com 'Invalid login credentials', é o problema pré-existente e conhecido, não uma regressão desta migration — registrar isso na SUMMARY sem tentar corrigir (fora de escopo)."* This verification confirms that instruction was followed correctly — none of the 15 failures are related to SQL logic, the trigger, or the new collision rule; they never get past authentication.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `supabase/migrations/0031_fix_with_ordinality_syntax.sql` | 21 | Grep match for `TODO` | ℹ️ Info (false positive) | Matches the Portuguese word "**TODO** o resto de cada função é copiado byte-a-byte..." (= "ALL the rest...", not an English TODO debt marker). No actual `TODO`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` debt markers exist in any of the 4 migrations or the new test file when read in context. |

No blockers found. No stub patterns, no empty implementations, no hardcoded empty data feeding into rendering/output paths (not applicable — this phase is pure SQL + integration tests, no UI).

### Migration History Integrity

Confirmed via `git show --stat` on all 3 commits of this task (`bc257c6`, `b3c7a81`, `999195d`): each commit **only adds new files** (0030 in one commit, 0031/0032/0033 together in a follow-up commit) — zero lines touched in any pre-existing migration file. `git log --follow` on `0002_clientes_and_funil.sql` and `0027_importar_clientes_ativos_lote.sql` shows no commits from this task modifying them. Requirement "nenhuma migration já aplicada antes de 0030 foi editada" — confirmed.

### Requirements Coverage

Not applicable — this is a quick task (no `.planning/REQUIREMENTS.md` entry structure for quick tasks; confirmed no `QUICK-260914-k3g` ID exists in that file, consistent with how other quick tasks in this project are tracked only via `STATE.md`'s quick-task table).

### Human Verification Required

None required to consider this task's own scope complete. One informational item worth the project owner's awareness (not blocking, not new):

- **Pre-existing test infra gap (not caused by this task):** `tests/clientes/cliente-actions.test.ts` and `tests/clientes/rls-clientes.test.ts` cannot currently prove the manual-cadastro 23505 contract end-to-end because the seed test accounts they depend on were deleted on 2026-08-19 (documented, open decision in STATE.md). This task's code trace shows the manual path is logically sound (same shared function, same error code), but a live behavioral confirmation of that specific path remains blocked until the project decides how to recreate/replace those seed accounts — unrelated to migrations 0030-0033.

### Gaps Summary

No gaps found within the scope of this task. All 7 must-have truths, all 5 key links, and the migration-immutability constraint are verified either by live test execution against the real hosted Supabase project or by direct code trace of shared, already-tested logic. The 3 additional migrations (0031, 0032, 0033) discovered and fixed during execution are themselves fully verified as correct in their final combined state — proven by the fact that the 6 new integration tests and the 10 sibling regression tests both pass live, which would be impossible if any residual syntax or classification bug remained.

---

_Verified: 2026-09-14T15:55:00Z_
_Verifier: Claude (gsd-verifier)_
