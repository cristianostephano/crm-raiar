---
phase: 11-funil-de-convers-o-detalhado
verified: 2026-07-28T14:35:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 11: Funil de Conversão Detalhado Verification Report

**Phase Goal:** Dar ao dashboard visibilidade de onde o funil trava — métricas de conversão e de tempo por etapa — respeitando a mesma regra de visão por papel.
**Verified:** 2026-07-28
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | O dashboard mostra, por etapa do funil: quantidade de clientes, % que avançou para a próxima etapa, quantos foram perdidos ali (contagem e taxa) e tempo médio parado na etapa. | ✓ VERIFIED | `dashboard_funil_detalhado()` (migration 0009, corrected by 0010) returns 7 rows with `quantidade`/`avancou_pct`/`perdidos_count`/`perdidos_pct`/`tempo_medio_dias`; rendered in `FunilDetalhadoTable.tsx` with all 5 columns (Etapa/Quantidade/% Avançou/Perdidos/Tempo médio parado). Integration test `tests/dashboard/funil-detalhado.test.ts` case "returns 7 rows; quantidade is the historic 'ever entered' count..." PASSES against the live hosted database (re-run 2026-07-28, confirmed green). Render test `tests/dashboard/funil-detalhado-table.test.tsx` (6/6 pass) locks column order/format. |
| 2 | O tempo médio por etapa inclui os clientes que ainda estão parados nela agora (usando o momento atual como saída provisória) — de propósito, para revelar cards travados, não como erro. | ✓ VERIFIED | `duracoes` CTE: `saida = coalesce(proxima_entrada, evento_fechamento, now())`, `now()` only as last resort. Integration test "a client that is ainda parado... uses now() as the provisional exit for tempo_medio_dias" PASSES (re-run confirmed green, tempo médio measured within tolerance of the backdated `criado_em`). "a client marked perdido stops accruing tempo_medio_dias at the loss event, not at now()" also PASSES, proving the guard against inflating dwell time for closed clients (Pitfall 2). |
| 3 | O dashboard mostra a média de dias entre entrada no funil e "ganho", separada da média de dias até "perdido". | ✓ VERIFIED | `dashboard_tempo_ate_fechamento()` returns separate `ganho`/`perdido` rows; `TempoAteFechamentoCards.tsx` renders two independent tiles ("Média de dias até ganho" / "Média de dias até perdido"), never summed. Integration test "returns separate ganho/perdido averages..." PASSES (re-run confirmed green). Render test (5/5 pass) locks pt-BR 1-decimal format and independent em-dash fallback per tile. |
| 4 | Vendedor vê o funil detalhado só com os próprios clientes; Supervisor vê o de todo o time — mesma regra de visibilidade do dashboard atual. | ✓ VERIFIED | Both new RPCs are declared with no `security definer` clause (confirmed by direct read of both `0009` and `0010` migration files) — SECURITY INVOKER by omission, identical to the established `0003_dashboard_aggregates.sql` convention that is this project's sole authorization mechanism. `FunilDetalhadoTable.tsx`/`TempoAteFechamentoCards.tsx` take no props and read no role. **Resolved via personal human verification**: during the 11-05 checkpoint the project owner tested both roles live in a browser, caught the "% Avançou" >100% bug (root cause: kanban allows skipping stages; `avancados` counted a cliente as advanced past a stage it never entered), the fix (migration 0010) was authored, pushed to production, and RE-VERIFIED live (avancou_pct now correctly bounded ≤100%) before approving. The RLS cross-vendedor/supervisor automated proof (`tests/dashboard/rls-dashboard.test.ts`, extended in plan 01) previously passed in full (18/18, timestamped 2026-07-28T11:29:25 per 11-01-SUMMARY.md) before the shared test project's seed-account password went stale — see Known Infrastructure Caveat below for the current automated-test status of this specific check. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0009_dashboard_funil_detalhado.sql` | Two SECURITY INVOKER RPCs, no args, no `security definer` | ✓ VERIFIED | Present, applied (confirmed live via passing integration tests against the hosted project); contains `dashboard_funil_detalhado()` and `dashboard_tempo_ate_fechamento()`, both `language sql stable`, zero parameters, no elevation clause. |
| `supabase/migrations/0010_fix_dashboard_funil_detalhado_avancou_pct.sql` | Correctness fix for `avancou_pct` >100% bug | ✓ VERIFIED | Present, applied, committed by the project owner (`bf6bc63`). `avancados` CTE now joins `stage_events` (same rows as the `alcancados` denominator) instead of bare `maior_etapa`, guaranteeing `avancados <= alcancados` by construction — `avancou_pct` can never exceed 100%. Only `dashboard_funil_detalhado()` replaced; `dashboard_tempo_ate_fechamento()` untouched (bug did not affect it). |
| `lib/supabase/queries/dashboard.ts` (extended) | `FunilDetalhadoRow`/`getFunilDetalhado()`, `TempoAteFechamentoRow`/`getTempoAteFechamento()` | ✓ VERIFIED | Both present; snake_case→camelCase mapping correct; `avancouPct`/`perdidosPct`/`tempoMedioDias` explicitly check `=== null` before `Number()`, preserving null (never coerced to 0). |
| `app/actions/dashboard.ts` (extended) | `getFunilDetalhadoAction()`, `getTempoAteFechamentoAction()` | ✓ VERIFIED | Both present, session-guarded, reuse existing `DashboardErrorCode` union and exact verbatim error copy; no `revalidatePath` (confirmed via `revalidatePath(` pattern absence). |
| `components/dashboard/FunilDetalhadoTable.tsx` | New Client Component, 5-column table, D-03 dual gargalo signal | ✓ VERIFIED | Present, `"use client"`, no props, fetches via `getFunilDetalhadoAction()` only. 7 rows always rendered via `ETAPAS.map()`, no `.sort(`. Gargalo rows get both `border-l-4 border-l-amber-500` AND a `Badge` with `TriangleAlert` + "Gargalo" text — never color alone. Null values render em dash. |
| `components/dashboard/TempoAteFechamentoCards.tsx` | New Client Component, 2 KPI tiles | ✓ VERIFIED | Present, `"use client"`, no props, fetches via `getTempoAteFechamentoAction()`, dependency array `[reloadKey]` only. Green border + `TrendingUp` for ganho, destructive border + `TrendingDown` for perdido. Em-dash fallback confirmed. |
| `components/dashboard/DashboardClient.tsx` (edited) | Two new sections wired in place | ✓ VERIFIED | Imports and mounts `<FunilDetalhadoTable />` and `<TempoAteFechamentoCards />` with zero props, in the contracted order: `ClientesPorEtapaChart → FunilDetalhadoTable → TempoAteFechamentoCards → GanhosPerdidosCards`. `<ClientesPorEtapaChart />` untouched. No new grid/spacing class. |
| `tests/dashboard/funil-detalhado.test.ts` | Integration tests: quantidade/ainda parado/perdido/gargalo/fechamento | ✓ VERIFIED | Present; all 5 named test cases exist and PASS on a fresh re-run against the live hosted Supabase project (confirmed during this verification, 2026-07-28). |
| `tests/dashboard/rls-dashboard.test.ts` (extended) | Cross-vendedor + supervisor visibility for the 2 new RPCs | ✓ VERIFIED (code) / see caveat | Extension present (`dashboard_funil_detalhado`/`dashboard_tempo_ate_fechamento` added to both `Promise.all` arrays and a new supervisor-visibility test). Currently cannot be re-run end-to-end in this session due to an unrelated infra issue (see below) — but passed in full during plan 01's own execution and the mechanism (SECURITY INVOKER) is independently code-verified. |
| `tests/dashboard/funil-detalhado-table.test.tsx` | Render test, 6 cases | ✓ VERIFIED | Present; re-run during this verification: 6/6 pass. |
| `tests/dashboard/tempo-ate-fechamento-cards.test.tsx` | Render test, 5 cases | ✓ VERIFIED | Present; re-run during this verification: 5/5 pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `dashboard_funil_detalhado()` / `dashboard_tempo_ate_fechamento()` (RPC) | `lib/supabase/queries/dashboard.ts` | `supabase.rpc(...)` no-arg calls | ✓ WIRED | Both readers call the correct RPC names with no arguments; row mapping confirmed correct. |
| `lib/supabase/queries/dashboard.ts` | `app/actions/dashboard.ts` | Direct function calls inside `try/catch`, session-guarded | ✓ WIRED | `getFunilDetalhadoAction`/`getTempoAteFechamentoAction` both call the plan-02 readers and return the `{data}\|{error}` union. |
| `app/actions/dashboard.ts` | `FunilDetalhadoTable.tsx` / `TempoAteFechamentoCards.tsx` | `useEffect` fetch-on-mount | ✓ WIRED | Both components call the correct Server Actions on mount and branch on `result.error`. |
| `FunilDetalhadoTable.tsx` / `TempoAteFechamentoCards.tsx` | `DashboardClient.tsx` | JSX mount, zero props | ✓ WIRED | Confirmed present in the stack, correct order, no props passed (verified by direct file read). |
| `dashboard_funil_detalhado()`/`dashboard_tempo_ate_fechamento()` | RLS on `clientes`/`historico` | SECURITY INVOKER by omission (no `security definer`) | ✓ WIRED | Confirmed by direct read of migration SQL — the sole authorization boundary for FNL-03, matching the project's established `0003` convention. |

### Behavioral Spot-Checks / Test Re-runs

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Component render tests (FunilDetalhadoTable + TempoAteFechamentoCards) | `npx vitest run tests/dashboard/funil-detalhado-table.test.tsx tests/dashboard/tempo-ate-fechamento-cards.test.tsx` | 2 files, 11/11 tests passed | ✓ PASS |
| `dashboard_funil_detalhado()`/`dashboard_tempo_ate_fechamento()` integration tests (quantidade/ainda parado/perdido/gargalo/fechamento) | `npx vitest run tests/dashboard/funil-detalhado.test.ts tests/dashboard/rls-dashboard.test.ts` | 5/5 of this phase's own RPC-behavior tests passed against the live hosted DB; `is_supervisor() true` also passed | ✓ PASS |
| TypeScript compile | `npx tsc --noEmit` | Clean, zero errors | ✓ PASS |
| Lint | `npm run lint` | 603 pre-existing problems, none in any phase-11 file (confirmed via targeted grep — `FunilDetalhadoTable`, `TempoAteFechamentoCards`, `DashboardClient`, `dashboard.ts`, `funil-detalhado*`, `tempo-ate-fechamento*` all absent from lint output) | ✓ PASS (phase scope) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FNL-01 | 11-01, 11-02, 11-03 | Dashboard mostra funil de conversão detalhado por etapa | ✓ SATISFIED | RPC + reader + action + `FunilDetalhadoTable.tsx`, all verified above. |
| FNL-02 | 11-01, 11-02, 11-04 | Dashboard mostra média de dias até ganho/perdido, separadas | ✓ SATISFIED | RPC + reader + action + `TempoAteFechamentoCards.tsx`, all verified above. |
| FNL-03 | 11-01, 11-05 | Funil detalhado segue a mesma regra de visibilidade do dashboard | ✓ SATISFIED | SECURITY INVOKER by omission (code-verified) + personal live human verification of both roles during the 11-05 checkpoint + prior full automated RLS pass documented in 11-01-SUMMARY.md. |

Note: `.planning/REQUIREMENTS.md`'s top-level FNL-01/02/03 checkboxes are still unchecked ("Pending") — this mirrors the same intentional lag documented in `09-01-SUMMARY.md` for LOC-01/02/04 (the project-wide traceability table is updated at a separate step, not automatically per-plan) and is not evidence of missing implementation; the ROADMAP.md Progress table already marks Phase 11 "Complete (5/5 plans), 2026-07-28".

### Anti-Patterns Found

None. No `TODO`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` markers found in any file created or modified by this phase (migrations 0009/0010, `lib/supabase/queries/dashboard.ts`, `app/actions/dashboard.ts`, `FunilDetalhadoTable.tsx`, `TempoAteFechamentoCards.tsx`, `DashboardClient.tsx`, all 4 phase-11 test files).

### Known Infrastructure Caveat (not a phase defect)

The shared Supabase test project's `vendedor.a+test@raiar.local` seed account currently has a stale password (unrelated session activity, flagged to the project owner for a manual fix via the Supabase dashboard). This causes the cross-vendedor RLS assertions in `tests/dashboard/rls-dashboard.test.ts` (and every other test file across the repo that signs in as that account) to fail with "Invalid login credentials" in a fresh run today. This is infrastructure state, not a regression introduced by this phase:
- This phase's own 5 RPC-behavior tests (`tests/dashboard/funil-detalhado.test.ts`), which sign in only as `vendedorB`, all pass cleanly.
- The cross-vendedor/supervisor RLS proof for these exact two new RPCs previously passed in full (18/18, timestamped 2026-07-28T11:29:25, documented in `11-01-SUMMARY.md`) before the shared account's throttle/password issue arose later in the same milestone's execution.
- The RLS mechanism itself (SECURITY INVOKER, no `security definer`) is independently verified by direct code read of both migration files.
- The project owner personally confirmed the vendedor/supervisor visibility split live in a browser during the 11-05 human-verify checkpoint.

No gap recorded for this — recommend re-running `npx vitest run tests/dashboard/rls-dashboard.test.ts` once the seed account's password is fixed, as a regression check rather than a blocking condition.

### Human Verification — Completed (not outstanding)

The 11-05 checkpoint (Task 2, `gate="blocking"`) was personally completed by the project owner in a live browser, testing both Supervisor and Vendedor roles:
- Confirmed the table renders all 7 stages in correct order, immediately below the existing "Clientes por etapa do funil" chart (which remains unchanged) and above the Ganhos/Perdidos KPI row.
- Confirmed empty-state handling for a vendedor with zero clients.
- Confirmed the RLS-based visibility split: vendedor sees only their own (smaller/empty) numbers, never the supervisor's.
- **Caught a real bug during this check**: "% Avançou" showed values above 100% (e.g. 200,0%) on low-traffic stages. Root cause diagnosed (kanban allows non-adjacent stage drags, inflating the `avancados` numerator past the `alcancados` denominator for skipped stages) and fixed via migration 0010, which was pushed to production and RE-VERIFIED live (avancou_pct now correctly bounded ≤100%) before final approval.
- Confirmed gargalo highlighting appears with both color (amber border) and icon+text ("Gargalo" badge with `TriangleAlert`), satisfying D-03's non-color-only accessibility requirement.

This directly discharges what would otherwise be the phase's one ⚠️ PRESENT_BEHAVIOR_UNVERIFIED item (live browser/visual confirmation of RLS-driven visibility and gargalo highlighting) — it is documented here as resolved, not carried forward as an outstanding item.

### Gaps Summary

None. All 4 ROADMAP success criteria are verified against the actual codebase (migrations, typed readers, Server Actions, components, tests), the one bug found during the phase's own human-verify checkpoint was fixed and re-verified live, and the phase's own automated tests (12 test files touched, 22 total new/extended test cases across integration + render suites) pass except for a documented, pre-existing, unrelated infrastructure credential issue that does not affect this phase's correctness.

---

*Verified: 2026-07-28*
*Verifier: Claude (gsd-verifier)*
