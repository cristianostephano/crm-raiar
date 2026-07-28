---
phase: 11
slug: funil-de-convers-o-detalhado
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-27
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/dashboard/funil-detalhado.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15-30 seconds (integration tests hit local/live Supabase RLS, mirrors existing dashboard test cost) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/dashboard/funil-detalhado.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|--------------------|-------------|--------|
| 11-01-xx | 01 | 1 | FNL-01 | `dashboard_funil_detalhado()` returns 7 rows (every etapa, even 0-count), `avancou_pct`/`perdidos_pct` computed against the "ever entered" denominator | integration | `npx vitest run tests/dashboard/funil-detalhado.test.ts -t "quantidade"` | ❌ W0 | ⬜ pending |
| 11-01-xx | 01 | 1 | FNL-01 | A client still `em_andamento` and never advanced counts as NOT advanced, using `now()` as provisional exit for dwell-time | integration | `npx vitest run tests/dashboard/funil-detalhado.test.ts -t "ainda parado"` | ❌ W0 | ⬜ pending |
| 11-01-xx | 01 | 1 | FNL-01 | A client marked `perdido` while in stage N is attributed to stage N's `perdidos_count`, and stops accruing dwell time after the loss event | integration | `npx vitest run tests/dashboard/funil-detalhado.test.ts -t "perdido"` | ❌ W0 | ⬜ pending |
| 11-01-xx | 01 | 1 | FNL-01 (D-03) | A stage with an artificially long average dwell time (relative to the other 6) is flagged `gargalo = true`; a normal stage is not | integration | `npx vitest run tests/dashboard/funil-detalhado.test.ts -t "gargalo"` | ❌ W0 | ⬜ pending |
| 11-0x-xx | — | — | FNL-02 | `dashboard_tempo_ate_fechamento()` returns separate `ganho`/`perdido` averages, each from `clientes.criado_em` to the respective closing event | integration | `npx vitest run tests/dashboard/funil-detalhado.test.ts -t "fechamento"` | ❌ W0 | ⬜ pending |
| 11-0x-xx | — | — | FNL-03 | Vendedor B's calls to both new RPCs never reflect Vendedor A's clientes; Supervisor's calls see everyone | integration (RLS negative case) | `npx vitest run tests/dashboard/rls-dashboard.test.ts` | ⚠️ extend existing file | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact Task IDs filled in once the planner assigns them — the Req/Test/Command mapping above is locked from RESEARCH.md and must not drift.*

---

## Wave 0 Requirements

- [ ] `tests/dashboard/funil-detalhado.test.ts` — new file, covers all FNL-01/FNL-02 behavior cases above (quantidade/avançou/perdidos/tempo-médio/gargalo/fechamento)
- [ ] Extend `tests/dashboard/rls-dashboard.test.ts` — add both new RPC names to its existing cross-vendedor + supervisor-sees-all assertions (FNL-03), following its established pattern exactly — do NOT create a new file for this
- [ ] Framework install: none — Vitest, `serviceClient()`/`signInAs()` test helpers, and `SEED_ACCOUNTS` already exist and are directly reusable

---

## Manual-Only Verifications

*None — every phase behavior (RPC correctness, dwell-time reconstruction, gargalo flagging, RLS visibility split) has an automated integration-test path per the map above.*

The one thing this phase's VERIFICATION.md should still expect a personal live-browser check for is purely visual/UX confirmation (does the table render legibly, does the Gargalo badge look right, does the empty/error/loading state actually appear correctly in a real browser) — but that is standard UI-phase practice for every frontend phase in this project, not a gap unique to this phase's data logic.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (built inline in Plan 11-01: tests written RED in Task 1, driven GREEN in Task 3 — TDD-in-plan pattern, no separate Wave 0 split needed)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (2026-07-27, per gsd-plan-checker's Nyquist Dimension 8 PASS)
