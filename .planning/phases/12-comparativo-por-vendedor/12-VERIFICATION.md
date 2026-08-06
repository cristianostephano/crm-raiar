---
phase: 12-comparativo-por-vendedor
verified: 2026-08-05T00:00:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 12: Comparativo por Vendedor Verification Report

**Phase Goal:** Dar ao Supervisor uma tabela lado a lado comparando o desempenho dos vendedores ativos.
**Verified:** 2026-08-05
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Supervisor vê tabela com taxa de conversão, negócios iniciados, negócios ganhos e ciclo médio em dias por vendedor ativo (ROADMAP SC1) | ✓ VERIFIED | `dashboard_comparativo_vendedor()` RPC live in production (`npx supabase migration list` confirms local=0011/remote=0011 both present, independently re-run during this verification, not just SUMMARY claim). `components/dashboard/ComparativoVendedorTable.tsx` renders the 5 columns in the exact required order (Vendedor, Taxa de conversão, Negócios iniciados, Negócios ganhos, Ciclo médio (dias)), wired to `getComparativoVendedorAction()` → `getComparativoVendedor()` → RPC. `taxaConversao()` reused (not reimplemented) per D-03, `formatConversao` correctly multiplies by 100 (`0.625 → "62,5%"`), verified by both a structural check and a render test. |
| 2 | Tabela visível só para Supervisor; Vendedor não a acessa (ROADMAP SC2) | ✓ VERIFIED | `components/dashboard/DashboardClient.tsx` line 90: `{isSupervisor ? <ComparativoVendedorTable /> : null}` — zero props, same pattern as pre-existing `DesempenhoVendedorChart` gate. Backed by RLS as the real authorization boundary: `tests/dashboard/rls-dashboard.test.ts` "dashboard_comparativo_vendedor never leaks another vendedor's real numbers to Vendedor B (VEND-01)" — re-run in isolation during this verification, 9/9 passed. Human-verified live in browser: Vendedor account confirmed section absent from page entirely (12-04-SUMMARY.md D4). |
| 3 | Vendedor desativado não aparece na lista de ativos, mas números históricos (ganhos/perdidos já atribuídos) continuam contando (ROADMAP SC3) | ✓ VERIFIED | Migration structurally isolates the filter: `ativo = true` appears exactly once (re-counted directly against the live file during this verification: `grep -c "ativo = true"` → 1, `grep -c "p.ativo"` → 1), confined to the `vendedores_ativos` CTE; the `agregados` CTE aggregates over unfiltered `clientes`. Test `"vendedor desativado desaparece desta lista, mas os totais de dashboard_ganhos_perdidos ficam inalterados (VEND-01)"` re-run in isolation during this verification (part of the 17/17 pass in `comparativo-vendedor.test.ts`) — asserts the row disappears from this RPC while `dashboard_ganhos_perdidos()` totals stay byte-identical before/after deactivation. |
| 4 | `negocios_iniciados` conta histórico completo, sem recorte de período (D-01/D-02) | ✓ VERIFIED | `agregados` CTE uses `count(*)` with no date filter, no RPC parameter (`p_inicio`/`p_fim` structurally absent). Test backdates a cliente 200 days and confirms it still counts (`comparativo-vendedor.test.ts`, "negocios_iniciados conta todos os clientes..."). |
| 5 | `ciclo_medio_dias` é ganho-only (D-04); NULL (não 0) quando não há ganho | ✓ VERIFIED | `avg(...) filter (where f.status_evento = 'ganho')` in the migration; reader preserves `null` (checks `=== null` before `Number()` in `lib/supabase/queries/dashboard.ts`); component renders em-dash for null via `formatDias`. Test asserts ciclo médio ≈10 days (ganho) not ≈20/30 days (perdido would pull it up), and that a vendedor with zero ganhos gets `null`. |
| 6 | Taxa de conversão nunca é calculada no SQL (D-03) — calculada uma vez, em TS, via `taxaConversao()` reutilizada | ✓ VERIFIED | Migration has zero `taxa_conversao` column (structural check + direct grep). `lib/supabase/queries/dashboard.ts` imports and calls `taxaConversao(ganho, perdido)` from `lib/dashboard/periodo.ts` — exactly one import of that module. Component's `formatConversao` multiplies by 100 only at format time. Test explicitly asserts no key in the raw RPC row contains "conversao". |
| 7 | Seção nova fica no grupo "histórico completo" (não misturada com o grupo filtrado por período) | ✓ VERIFIED | `DashboardClient.tsx`: `<ComparativoVendedorTable />` sits between `<TempoAteFechamentoCards />` and `<GanhosPerdidosCards inicio=... fim=...>`; `<DesempenhoVendedorChart inicio={periodo.inicio} fim={periodo.fim} />` confirmed unchanged, still period-filtered. Human-verified live: switching period filter left the table's numbers byte-for-byte unchanged. |
| 8 | Migration aplicada em produção com aprovação humana prévia; suíte de testes relevante verde | ✓ VERIFIED | `npx supabase migration list` (re-run independently during this verification) confirms migration 0011 applied to the remote/hosted project. `npx tsc --noEmit` clean (re-run). `npx eslint` on all phase files clean (re-run; only an expected "no config for .sql" warning, no code errors). All three phase test files re-run in isolation during this verification: `comparativo-vendedor.test.ts` (17 tests) + `comparativo-vendedor-table.test.tsx` (bundled in the same 17) + `rls-dashboard.test.ts` (9 tests) — all green, 26 total, matching 12-04-SUMMARY.md's claim exactly. |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0011_dashboard_comparativo_vendedor.sql` | New additive migration, `dashboard_comparativo_vendedor()` RPC | ✓ VERIFIED | Exists, single `create or replace function`, no `security definer`, no DDL beyond the function. Applied to hosted project (confirmed via `migration list`). |
| `dashboard_comparativo_vendedor()` (RPC) | Zero-arg, `language sql stable`, invoker, returns 6 columns | ✓ VERIFIED | Confirmed in migration body; matches type signature consumed by `getComparativoVendedor()`. |
| `tests/dashboard/comparativo-vendedor.test.ts` | New integration test (ativo/desativado/iniciados/ciclo/conversao) | ✓ VERIFIED | 5 `it()` blocks present, all pass live against hosted Supabase (re-run, 17/17 combined with table test). |
| `tests/dashboard/rls-dashboard.test.ts` | Extended (not duplicated) with cross-vendedor isolation for the new RPC | ✓ VERIFIED | `dashboard_comparativo_vendedor` referenced 8 times across before/after arrays + dedicated `it()` block; re-run, 9/9 pass. |
| `ComparativoVendedorRow`, `getComparativoVendedor()` | Typed reader in `lib/supabase/queries/dashboard.ts` | ✓ VERIFIED | Present, correctly normalizes `bigint`-as-string via `Number()`, preserves `null` on `cicloMedioDias` before `Number()`, computes `taxaConversao` via reuse. |
| `GetComparativoVendedorResult`, `getComparativoVendedorAction()` | No-arg Server Action in `app/actions/dashboard.ts` | ✓ VERIFIED | Present, guards session, returns `{data}|{error}` union, reuses standard error strings verbatim. |
| `components/dashboard/ComparativoVendedorTable.tsx` | Client Component, 5-column table, own loading/error/empty states | ✓ VERIFIED | Present, matches UI-SPEC copy/structure exactly (checked against file directly, not just SUMMARY). |
| `tests/dashboard/comparativo-vendedor-table.test.tsx` | Render test with mocked action | ✓ VERIFIED | Present, covers row order, percent conversion, zero-vs-null distinction, empty/error states. |
| `components/dashboard/DashboardClient.tsx` (edited) | Mounts new table, Supervisor-gated, zero props, correct position | ✓ VERIFIED | Confirmed directly in file: import present, `{isSupervisor ? <ComparativoVendedorTable /> : null}` between `TempoAteFechamentoCards` and `GanhosPerdidosCards`, `DesempenhoVendedorChart` untouched. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ComparativoVendedorTable.tsx` | `getComparativoVendedorAction()` | direct import + call in `useEffect` | WIRED | Confirmed in file; response drives `FetchState`. |
| `getComparativoVendedorAction()` | `getComparativoVendedor()` | import from `lib/supabase/queries/dashboard` | WIRED | Confirmed; try/catch wraps the call, converts to `{data}|{error}`. |
| `getComparativoVendedor()` | `dashboard_comparativo_vendedor()` RPC | `supabase.rpc(...)` | WIRED | Confirmed; RPC live in production (`migration list`). |
| `getComparativoVendedor()` | `taxaConversao()` (`lib/dashboard/periodo.ts`) | import + call with normalized `ganho`/`perdido` | WIRED | Exactly 1 import, called (not reimplemented) — verified directly. |
| `DashboardClient.tsx` | `ComparativoVendedorTable` | conditional mount `isSupervisor ? ... : null` | WIRED | Confirmed at line 90; correct position relative to whole-history vs period-filtered groups. |
| `vendedores_ativos` CTE | `agregados` CTE | deliberately NOT joined/filtered by `ativo` | WIRED (by omission) | Confirmed: `ativo = true` occurs exactly once, only in `vendedores_ativos`; `agregados` aggregates unconditionally over `clientes`. |

### Behavioral Spot-Checks / Test Re-runs (performed independently during this verification, not taken from SUMMARY)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| RPC applied to hosted project | `npx supabase migration list` | `{"local":"0011","remote":"0011",...}` | ✓ PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | no output | ✓ PASS |
| Lint clean on phase files | `npx eslint <8 phase files>` | 0 errors (1 expected "no config" warning on .sql) | ✓ PASS |
| Backend + reader integration tests | `npx vitest run tests/dashboard/comparativo-vendedor.test.ts tests/dashboard/comparativo-vendedor-table.test.tsx` | 2 files, 17 tests passed | ✓ PASS |
| RLS cross-vendedor isolation (incl. new RPC) | `npx vitest run tests/dashboard/rls-dashboard.test.ts` | 1 file, 9 tests passed | ✓ PASS |
| No pre-existing migration edited | `git diff HEAD~7 -- supabase/migrations/` (only new file, no diffs to 0001-0010) | clean | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/placeholder) in phase files | grep across all 8 phase files | 0 real hits (2 false positives from Portuguese "todo" = "all") | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VEND-01 | 12-01, 12-02, 12-03, 12-04 | Dashboard mostra tabela comparando vendedores ativos (conversão, iniciados, ganhos, ciclo médio), visível só ao Supervisor | ✓ SATISFIED | End-to-end wiring confirmed from migration through UI, all automated tests green (re-run), human-verified live in browser (12-04-SUMMARY.md D4, project owner approved). |

Note: `.planning/REQUIREMENTS.md` still shows VEND-01 as `[ ]`/"Pending" and `.planning/STATE.md` shows a stale "executing / Plan 1 of 4" snapshot from mid-phase. `.planning/ROADMAP.md` (the authoritative phase-completion record) already marks Phase 12 `[x]` complete. This is a documentation-sync gap in the planning artifacts, not a code gap — it does not affect goal achievement and should be picked up by the ship/complete-milestone workflow, but is noted here for housekeeping.

### Anti-Patterns Found

None. No `security definer`, no debt markers, no client-side re-filtering/re-sorting of RPC-owned row lists, no hardcoded empty stubs. All formatters correctly distinguish "real zero" (counts) from "undefined" (ratios/averages, em-dash).

### Human Verification Required

None outstanding. Both manual-only items for this phase were already personally completed by the project owner, with detailed transcripts recorded in the plan SUMMARYs:

1. **Migration safety review (12-01 Task 2 checkpoint)** — project owner personally read the full migration SQL and verified all 5 safety properties (single function, no security definer, `ativo = true` appears exactly once inside `vendedores_ativos` only, ganho-only ciclo médio via filter clause, COALESCE-to-zero vs NULL-preserved distinction) before approving the `supabase db push`. Resolution recorded in `12-01-SUMMARY.md`.
2. **Final live-browser milestone gate (12-04 Task 2 checkpoint)** — project owner logged in as Supervisor and confirmed table position, exact caption, exact 5-column order, the "Ciclo médio (dias)" tooltip's exact aria-label text, that changing the period filter left every number in this table unchanged, and that logging in as a Vendedor made the entire section disappear (confirmed absent from page text, not just visually hidden). Resolution recorded in `12-04-SUMMARY.md` (D4, "Approved").

Both resolutions are treated as closed per this verification's task instructions — the human-only checks in this phase's own `12-VALIDATION.md` were already exhaustively covered by automated tests, and these two checkpoints were the only genuinely manual items, both signed off.

### Gaps Summary

No gaps. All 3 ROADMAP success criteria, all `must_haves` truths across the 4 plans, all key links, and all requirements are verified directly against the live codebase and the hosted Supabase project (not merely inferred from SUMMARY.md claims): migration applied and structurally sound, reader/action layer correctly normalizes data and reuses `taxaConversao()`, UI component renders the correct columns/copy/states, DashboardClient wiring places the section in the correct group and gates it by role, and all automated tests (26 total across the three phase-relevant suites) pass when re-run independently in this verification session.

---

_Verified: 2026-08-05_
_Verifier: Claude (gsd-verifier)_
