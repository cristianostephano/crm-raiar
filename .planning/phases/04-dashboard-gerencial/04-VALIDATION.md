---
phase: 4
slug: dashboard-gerencial
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (already configured project-wide) |
| **Config file** | `vitest.config.ts` — `include: ["tests/**/*.test.ts"]`, loads `.env`/`.env.local` |
| **Quick run command** | `npx vitest run tests/dashboard/ -t "<test name>"` |
| **Full suite command** | `npx vitest run tests/dashboard/` (batched separately from other `tests/**` dirs — shared Supabase free-tier auth rate limit, same constraint documented since Phase 2) |
| **Estimated runtime** | ~20-30 seconds |

---

## Sampling Rate

- **After every task commit:** targeted test file(s) for that task
- **After every plan wave:** `npx vitest run tests/dashboard/`
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus `npx tsc --noEmit` and `npm run build`

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-xx-xx | TBD | TBD | DSH-01 | — | `dashboard_clientes_por_etapa()` returns correct per-etapa counts (live snapshot, not period-filtered per D-08) | integration | `npx vitest run tests/dashboard/clientes-por-etapa.test.ts` | ❌ W0 | ⬜ pending |
| 04-xx-xx | TBD | TBD | DSH-02/04 | T-info-disclosure | `dashboard_ganhos_perdidos()` counts status-change events inside period via `historico`, not `etapa_alterada_em`; no double-counting reopened cards; conversão = ganho/(ganho+perdido) | integration | `npx vitest run tests/dashboard/ganhos-perdidos.test.ts`, `.../conversao.test.ts` | ❌ W0 | ⬜ pending |
| 04-xx-xx | TBD | TBD | DSH-03 | T-info-disclosure | `dashboard_desempenho_vendedor()` groups ganho/perdido/conversão by `responsavel` (D-10) | integration | `npx vitest run tests/dashboard/desempenho-vendedor.test.ts` | ❌ W0 | ⬜ pending |
| 04-xx-xx | TBD | TBD | DSH-05 | — | `dashboard_prospeccao_por_produto`/`_categoria` grouped counts, filtered by client cadastro date (D-09) | integration | `npx vitest run tests/dashboard/prospeccao.test.ts` | ❌ W0 | ⬜ pending |
| 04-xx-xx | TBD | TBD | DSH-06/07 | T-info-disclosure | Vendedor B never sees Vendedor A's rows via any dashboard RPC; Supervisor sees all | integration (RLS) | `npx vitest run tests/dashboard/rls-dashboard.test.ts` | ❌ W0 | ⬜ pending |

*Task IDs finalized once PLAN.md files are written by the planner.*

---

## Wave 0 Requirements

- [ ] `tests/dashboard/clientes-por-etapa.test.ts`
- [ ] `tests/dashboard/ganhos-perdidos.test.ts` (includes the reopened-card double-counting edge case)
- [ ] `tests/dashboard/conversao.test.ts`
- [ ] `tests/dashboard/desempenho-vendedor.test.ts`
- [ ] `tests/dashboard/prospeccao.test.ts`
- [ ] `tests/dashboard/rls-dashboard.test.ts` (follows the `signInAs()` pattern from `tests/clientes/rls-clientes.test.ts`)
- [ ] `lib/dashboard/periodo.test.ts` — pure unit test of period-preset math, no Supabase needed
- [ ] Framework install: none needed — Vitest already configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Charts render correctly and are readable | DSH-01/02/03/05 | Visual judgment (bar chart legibility, number prominence) not automatable | Open /dashboard as Supervisor and Vendedor, confirm charts render with real data and look correct |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
