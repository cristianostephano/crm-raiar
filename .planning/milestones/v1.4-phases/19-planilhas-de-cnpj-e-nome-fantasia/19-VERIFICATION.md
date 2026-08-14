---
phase: 19-planilhas-de-cnpj-e-nome-fantasia
verified: 2026-08-14T11:00:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 19: Planilhas de CNPJ e Nome Fantasia Verification Report

**Phase Goal:** Dar ao Supervisor dois caminhos de planilha para o CNPJ: trazer CNPJ e Nome Fantasia junto com clientes novos na importação, e regularizar em massa o CNPJ de clientes que já são "ganho" hoje.
**Verified:** 2026-08-14T11:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Na planilha "Importar clientes", o Supervisor consegue mapear uma coluna para CNPJ (opcional) e o valor é gravado no cliente novo criado | ✓ VERIFIED | `supabase/migrations/0019_importar_clientes_lote_cnpj_nome_fantasia.sql` adds `cnpj text`/`nome_fantasia text` to the `jsonb_to_recordset`, insert-column list, and selected-values list. Live in production (`npx supabase migration list` shows `0019` remote=local). `SYSTEM_FIELDS` in `lib/importacao/types.ts` has `cnpj` (opcional) inserted after `razaoSocial`. Chain traced end-to-end: `annotarLinha.ts` resolves `cnpj: string \| null`, `confirmar.ts`'s `toRpcClienteRow` maps it to `cnpj` (snake_case matches RPC). Real DB test `tests/importacao/rls-importar-lote.test.ts#cnpjfantasia` re-reads the created row from the database and asserts `cnpj`/`nome_fantasia` are persisted — ran live, 9/9 pass. |
| 2 | Na mesma planilha, o Supervisor consegue mapear uma coluna para Nome Fantasia (opcional) e o valor é gravado no cliente novo criado | ✓ VERIFIED | Same migration/chain as #1, `nomeFantasia` field, `nome_fantasia` RPC key. Proven by the same `cnpjfantasia` integration test (ran live, passed). |
| 3 | O Supervisor sobe uma nova planilha "CNPJ em massa" (Razão Social + CNPJ) e o sistema grava o CNPJ nos clientes já "ganho" correspondentes, casando por nome | ✓ VERIFIED | `atualizar_cnpj_lote` (migration 0020, live in production) does a single set-based `UPDATE clientes ... WHERE clientes.id = atualizacoes.id AND clientes.status_acompanhamento = 'ganho'`. Name-matching happens in `lib/importacao/annotarLinhaCnpj.ts` via `normalizeRazaoSocial` (the project's single normalization function) against a `Map<string, ClienteCnpjLookup[]>` index built once per batch. Full UI wizard (`CnpjImportWizard.tsx`) → `validarLoteCnpj`/`confirmarLoteCnpj` (`app/actions/importacaoCnpj.ts`) → `atualizar_cnpj_lote` RPC. Real DB integration test `tests/importacao/rls-cnpj-lote.test.ts` (12/12 passing live) proves `supervisor`/`sobrescreve` cases write CNPJ to multiple "ganho" clients in one call, confirmed by re-reading the DB. |
| 4 | Quando o nome normalizado da planilha bate em mais de um cliente (nome ambíguo), a linha vira erro e nenhum CNPJ é gravado no cliente errado | ✓ VERIFIED | `annotarLinhaCnpj.ts`'s index stores a LIST per normalized key; `encontrados.length > 1` produces status "erro", `CLIENTE_AMBIGUO_REASON`, `clienteId: null`, `clienteEncontradoRazaoSocial: null` — verified by reading the actual source, not just the plan's script output. Unit test `tests/importacao/annotarLinhaCnpj.test.ts#ambiguo` asserts all three (erro status, ambiguity reason present, `clienteId` null) with two fabricated clients that collide on normalized name ("Comercial Ambigua Ltda"/"Comercial Ambigua S/A") — ran live, passed. `atualizar_cnpj_lote` only ever receives already-resolved `id uuid` (never razão social), so an ambiguous row structurally cannot reach the write path (`planConfirmacaoCnpj` requires `clienteId` to build a carga entry). UI: `CnpjPreviewTable.tsx` renders the ambiguity reason in a separate "Cliente encontrado" column sourced from the DB, not the spreadsheet cell — proven by `tests/importacao/cnpj-preview-table.test.tsx#ambiguo`. Human checkpoint (19-04 Task 3) exercised a real ambiguous-name pair in the browser and the owner approved ("funcionou ok"). |
| 5 | A planilha de CNPJ em massa é estruturalmente incapaz de criar um cliente novo — só atualiza clientes existentes com status "ganho" | ✓ VERIFIED | Read `supabase/migrations/0020_atualizar_cnpj_lote.sql` directly: the entire function body contains exactly one SQL statement (`update clientes ... returning ...`) — zero `insert` statements anywhere in the file. The `status_acompanhamento = 'ganho'` clause is the literal WHERE condition. Confirmed by `tests/importacao/rls-cnpj-lote.test.ts#naocria` (client count identical before/after a batch containing only a nonexistent id) and `#naoganho` (an em-andamento client in the same batch is untouched) — both ran live against the real DB and passed. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0019_importar_clientes_lote_cnpj_nome_fantasia.sql` | recreates `importar_clientes_lote` with `cnpj`/`nome_fantasia` | ✓ VERIFIED | Read in full. Not `SECURITY DEFINER`. Preserves the two-sequential-statement RLS fix from 0006. Live in production. |
| `supabase/migrations/0020_atualizar_cnpj_lote.sql` | new RPC `atualizar_cnpj_lote` | ✓ VERIFIED | Read in full. Exactly 1 `update`, 0 `insert`. Not `SECURITY DEFINER`. Guard `is_supervisor()`. Live in production. |
| `lib/importacao/types.ts` | `cnpj`/`nomeFantasia` in `SYSTEM_FIELDS` (16 fields, 7 required unchanged) | ✓ VERIFIED | Read in full — matches. |
| `lib/importacao/modelo.ts` | 2 new example values | ✓ VERIFIED | Read in full — `EXAMPLE_VALUES` map is total over `SYSTEM_FIELDS` keys, compiler-enforced. |
| `lib/importacao/mapping.ts` | header aliases for the two new keys | ✓ VERIFIED | Read in full — `fantasia -> nomeFantasia` alias; other variants match by normalized label directly. |
| `lib/importacao/annotarLinha.ts` | `cnpj`/`nomeFantasia` on `ResolvedRow`, sanitized, no error reason | ✓ VERIFIED | Read in full — trimmed, null-when-empty, no new reason added. |
| `lib/importacao/confirmar.ts` | `cnpj`/`nome_fantasia` on `RpcClienteRow` | ✓ VERIFIED | Read in full — `toRpcClienteRow` maps both, snake_case keys matching migration 0019. |
| `lib/importacao/typesCnpj.ts` | third vocabulary, 2 required fields | ✓ VERIFIED | Read in full — reuses `SystemFieldDefinition<K>`, no new mapping function. |
| `lib/importacao/annotarLinhaCnpj.ts` | pure annotation, list-per-key index, ambiguity detection | ✓ VERIFIED | Read in full — `Map<string, ClienteCnpjLookup[]>`, `encontrados.length > 1` check, 5 distinct reason constants, no CNPJ format check. |
| `lib/importacao/confirmarCnpj.ts` | carga planning + reconciliation | ✓ VERIFIED | Read in full — reuses `PuladaGroup` (type-only import) and `fundirGruposDeMotivos` from the Fase-17 module, doesn't duplicate either. |
| `app/actions/importacaoCnpj.ts` | 2 Server Actions, read-only validation, 1 RPC call | ✓ VERIFIED | Read in full — `"use server"`, session+role check before any read in both actions, `validarLoteCnpj` performs no writes, `confirmarLoteCnpj` calls `.rpc("atualizar_cnpj_lote", ...)` exactly once (no loop), `revalidatePath("/clientes")`. |
| `components/importacao/CnpjPreviewTable.tsx` | 5-column review table, DB-sourced "cliente encontrado" | ✓ VERIFIED | Read in full — no Ação column, no per-row decision state, reuses `statusBorderClass`/`summaryCounts` from `lib/importacao/preview.ts` unmodified. |
| `components/importacao/CnpjImportSummary.tsx` | post-write summary, derived puladas count | ✓ VERIFIED | Read in full — `puladas.reduce(...)`, not a separate prop. |
| `components/importacao/CnpjImportWizard.tsx` | 3-step wizard, single-fire confirm, remap resets review | ✓ VERIFIED | Read in full — `setConfirming(true)` set synchronously before the `confirmarLoteCnpj` call; `handleContinueFromMapping` calls `setValidatedRows(null)` before advancing to step 3. |
| `app/(app)/clientes/importar-cnpj/page.tsx` | Supervisor-only route, double redirect | ✓ VERIFIED | Read in full — `redirect("/login")` when no session, `redirect("/")` when `role !== "supervisor"`. Compiles into the Next.js build (`npx next build` lists `/clientes/importar-cnpj` as a route). |
| `components/layout/AppSidebar.tsx` | "Importar CNPJ" menu entry, distinct icon | ✓ VERIFIED | Read in full — entry placed after "Importar frequências" in `ADMIN_SECTION`, `FileDigit` icon (distinct from `FileUp`/`RefreshCw`/others already imported). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| Import wizard cell (CNPJ/Nome Fantasia) | `clientes` row | `annotarLinha` → `confirmar.toRpcClienteRow` → `importar_clientes_lote` RPC (migration 0019) | ✓ WIRED | Traced source-to-source; proven live by `rls-importar-lote.test.ts#cnpjfantasia` re-reading the DB row. |
| "CNPJ em massa" spreadsheet row | `atualizar_cnpj_lote` carga | `annotarLinhaCnpj` (resolves `clienteId`) → `planConfirmacaoCnpj` (builds `{id, cnpj}`) → `confirmarLoteCnpj` (single `.rpc()` call) | ✓ WIRED | Traced source-to-source; proven live by `rls-cnpj-lote.test.ts` (all 7 required case names present and passing). |
| Ambiguous name detection | UI review table | `annotarLinhaCnpj`'s `Map<string, Cliente[]>` list-per-key → `ValidatedRowCnpj.reasons` → `CnpjPreviewTable`'s "Status" column | ✓ WIRED | Proven by `annotarLinhaCnpj.test.ts#ambiguo` (unit) + `cnpj-preview-table.test.tsx#ambiguo` (render) + human checkpoint (browser, real ambiguous pair, approved). |
| `atualizar_cnpj_lote` | RLS on `clientes` | Not `SECURITY DEFINER` — runs as caller | ✓ WIRED | Confirmed by direct read of migration 0020 (no `security definer` keyword) and by the existing `"vendedor edita os proprios clientes, supervisor edita todos"` UPDATE policy in migration 0002. `vendedor`/`anonimo` integration test cases pass live. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| IMP-01 | 19-01, 19-02 | Planilha "Importar clientes" ganha CNPJ opcional | ✓ SATISFIED | See Truth #1 above. |
| IMP-02 | 19-01, 19-02 | Planilha "Importar clientes" ganha Nome Fantasia opcional | ✓ SATISFIED | See Truth #2 above. |
| IMP-03 | 19-01, 19-03, 19-04 | Planilha "CNPJ em massa": casamento por nome, nome ambíguo vira erro, incapaz de criar cliente | ✓ SATISFIED | See Truths #3, #4, #5 above. |

No orphaned requirements — REQUIREMENTS.md maps only IMP-01/02/03 to Phase 19, all three claimed and covered.

### Anti-Patterns Found

Scanned all files modified in this phase (migrations, `lib/importacao/*Cnpj*.ts`, `app/actions/importacaoCnpj.ts`, `components/importacao/Cnpj*.tsx`, `app/(app)/clientes/importar-cnpj/page.tsx`, `components/layout/AppSidebar.tsx`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`, empty-return stubs, and hardcoded-empty state.

None found. No debt markers, no stub returns, no placeholder text. Comments referencing "ok"/"erro" (never "duplicado") are intentional design notes explaining why the third status value never occurs in this flow, not incomplete work.

### Security Posture Check (SECURITY DEFINER exception count)

Directly grepped all migrations for `security definer` function declarations (not comment mentions). Confirmed callable-RPC exceptions unchanged at 4: `is_supervisor()` (0001, redeclared identically in 0008), `desativar_membro_equipe()` (0008), `reativar_membro_equipe()` (0008), `cidades_com_clientes_por_estado()` (0012). Separately, 4 audit-trail trigger functions (`handle_new_user`, `clientes_after_update_historico`, `tarefas_before_update_historico`, `visitas_after_update_historico`) are also `SECURITY DEFINER` by design (append-only `historico` audit trail, not RPC-callable data-mutation exceptions) — pre-existing, untouched by this phase.

Both new functions from this phase — `importar_clientes_lote` (0019) and `atualizar_cnpj_lote` (0020) — were read in full and contain **no** `security definer` clause. The count of documented RPC-callable exceptions is unchanged at exactly 4, not 5, matching the phase's explicit constraint and STATE.md's Deferred Items entry.

### Behavioral Spot-Checks / Live Verification

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Migrations 0019/0020 live in production | `npx supabase migration list` | Both show `remote` = `local` (`0019`/`0020`) | ✓ PASS |
| TypeScript compiles | `npx tsc --noEmit` | Clean | ✓ PASS |
| ESLint on touched modules | `npx eslint lib/importacao app/actions components/importacao components/layout/AppSidebar.tsx "app/(app)/clientes/importar-cnpj/page.tsx"` | Clean | ✓ PASS |
| Next.js build compiles the new route | `npx next build` | Succeeds, `/clientes/importar-cnpj` listed as a route | ✓ PASS |
| Unit test suites (14 files, pure/render) | `npx vitest run tests/importacao/{cnpj-vocabulario,annotarLinhaCnpj,confirmarCnpj,cnpj-preview-table,cnpj-import-summary,AppSidebar,mapping,modelo,column-mapping-table,annotarLinha,confirmar,preview,dedupe,frequencia-vocabulario}.test.{ts,tsx}` | 116/116 tests passed | ✓ PASS |
| Live integration: `atualizar_cnpj_lote` against real Supabase project | `npx vitest run tests/importacao/rls-cnpj-lote.test.ts` | 12/12 passed | ✓ PASS |
| Live integration: `importar_clientes_lote` (incl. `cnpjfantasia` case) against real Supabase project | `npx vitest run tests/importacao/rls-importar-lote.test.ts` | 9/9 passed | ✓ PASS |
| No CNPJ format/digit validation anywhere | `grep -riE "regex|regexp|digito.?verificador|isValidCnpj|validarCnpj"` across `**/*cnpj*` files, plus manual read of `lib/validations/cliente.ts` | No matches; `lib/validations/cliente.ts` comment explicitly states "a validação de CNPJ está explicitamente fora de escopo do projeto" | ✓ PASS |

### Human Verification Required

None outstanding for this verification pass. The phase's own plan (19-04 Task 3) already ran a blocking human-verify checkpoint covering the full 10-step browser flow, including a real ambiguous-name pair, and the project owner approved it ("funcionou ok") before the SUMMARY was written — this was re-confirmed above by reading the actual test/source evidence rather than trusting the SUMMARY narrative alone.

### Gaps Summary

None. All 5 ROADMAP success criteria are independently verified against the actual codebase (migrations read in full and confirmed live in production; application-layer source files read in full; tests read and re-run live, not just trusted from SUMMARY claims). No stubs, no orphaned wiring, no format validation smuggled in, no new SECURITY DEFINER exception, no regressions in the sibling frequência/importar-clientes flows (their test suites also pass).

---

*Verified: 2026-08-14T11:00:00Z*
*Verifier: Claude (gsd-verifier)*
