---
phase: 12
slug: comparativo-por-vendedor
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` (existing, no changes needed — `fileParallelism: false` already set from Phase 11) |
| **Quick run command** | `npx vitest run tests/dashboard/comparativo-vendedor.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15-30 seconds (integration tests hit live Supabase RLS, matches existing dashboard test cost) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/dashboard/comparativo-vendedor.test.ts tests/dashboard/rls-dashboard.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|--------------------|-------------|--------|
| 12-01-xx | 01 | 1 | VEND-01 | `dashboard_comparativo_vendedor()` lists only active vendedores (`role='vendedor' and ativo=true`) | integration (live Supabase, RLS) | `npx vitest run tests/dashboard/comparativo-vendedor.test.ts -t "ativo"` | ❌ W0 | ⬜ pending |
| 12-01-xx | 01 | 1 | VEND-01 | A deactivated vendedor disappears from this RPC's row list, but their historical ganho/perdido counts remain unchanged in `dashboard_ganhos_perdidos` | integration | `npx vitest run tests/dashboard/comparativo-vendedor.test.ts -t "desativado"` | ❌ W0 | ⬜ pending |
| 12-01-xx | 01 | 1 | VEND-01 | `negocios_iniciados` counts ALL-time clientes ever assigned, unaffected by any period filter (D-01/D-02) | integration | `npx vitest run tests/dashboard/comparativo-vendedor.test.ts -t "iniciados"` | ❌ W0 | ⬜ pending |
| 12-01-xx | 01 | 1 | VEND-01 | Ciclo médio em dias counts GANHO-ONLY closings (D-04), never perdido | integration | `npx vitest run tests/dashboard/comparativo-vendedor.test.ts -t "ciclo"` | ❌ W0 | ⬜ pending |
| 12-01-xx | 01 | 1 | VEND-01 | RPC is SECURITY INVOKER (no `security definer`); Vendedor B's call never reflects Vendedor A's data | integration (RLS negative case) | `npx vitest run tests/dashboard/rls-dashboard.test.ts` (extend existing file) | ⚠️ extend existing file | ⬜ pending |
| 12-0x-xx | — | — | VEND-01 | `taxaConversao(ganho, perdido)` reused unchanged (D-03), returns `null` (never `NaN`) when both are 0 | unit (pure function) | `npx vitest run tests/dashboard/comparativo-vendedor.test.ts -t "conversao"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact Task IDs filled in once the planner assigns them — the Req/Test/Command mapping above is locked from RESEARCH.md and must not drift.*

---

## Wave 0 Requirements

- [ ] `tests/dashboard/comparativo-vendedor.test.ts` — new file, covers all VEND-01 behavior cases above (ativo filtering, deactivated-vendedor exclusion + historical preservation, all-time negócios iniciados, ganho-only ciclo médio, taxaConversao reuse) — use `createTestMember`/`deleteTestMember` disposable-fixture pattern (Phase 10), not the shared seed accounts, for deterministic counts
- [ ] Extend `tests/dashboard/rls-dashboard.test.ts` — add `dashboard_comparativo_vendedor` to its existing cross-vendedor before/after `Promise.all` arrays (VEND-01's RLS isolation), mirroring exactly how Phase 11's two RPCs were added — do NOT create a new file for this
- [ ] Framework install: none — Vitest, `createTestMember`/`deleteTestMember`, `serviceClient()`/`signInAs()`, and `SEED_ACCOUNTS` already exist and are directly reusable

---

## Manual-Only Verifications

*None — every phase behavior (RPC filtering, ganho-only ciclo médio, all-time counting, RLS isolation, taxaConversao reuse) has an automated integration/unit-test path per the map above.*

The one thing this phase's VERIFICATION.md should still expect a personal live-browser check for is purely visual/UX confirmation (does the table render legibly for the Supervisor, does it stay hidden for a Vendedor, does the empty/error/loading state actually appear correctly in a real browser, do the numbers look plausible against real data) — standard UI-phase practice for every frontend phase in this project, not a gap unique to this phase's data logic.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (2026-07-28)
