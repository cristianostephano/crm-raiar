---
phase: 10
slug: desativa-o-de-membro-da-equipe
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-27
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (installed, `"test": "vitest run"` in `package.json`) |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run tests/equipe` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15-30 seconds (integration tests hit local Supabase RLS, mirrors `tests/importacao/rls-importar-lote.test.ts` cost) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/equipe`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-xx | 01 | 1 | EQP-01 | V4 Access Control | Supervisor deactivates a member; replacement inherits `em_andamento` clientes only | integration | `npx vitest run tests/equipe/reassignment.test.ts -t "reassigns em_andamento"` | ❌ W0 | ⬜ pending |
| 10-01-xx | 01 | 1 | EQP-04 | V4 Access Control | ganho/perdido clientes keep original `responsavel` after deactivation | integration | `npx vitest run tests/equipe/reassignment.test.ts -t "preserves closed"` | ❌ W0 | ⬜ pending |
| 10-01-xx | 01 | 1 | EQP-02 | Elevation of Privilege (TOCTOU) | Last active Supervisor cannot be deactivated, incl. concurrently (`FOR UPDATE` lock) | integration | `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "last supervisor"` | ❌ W0 | ⬜ pending |
| 10-01-xx | 01 | 1 | EQP-02 | Denial of Service (self-lockout) | Supervisor cannot deactivate own account (D-01), independent of last-supervisor guard | integration | `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "self"` | ❌ W0 | ⬜ pending |
| 10-01-xx | 01 | 1 | EQP-03 | V3 Session Management | Deactivated member's `is_supervisor()`/RLS access rejected on next request | integration, mirrors `tests/auth/rls-roles.test.ts` | `npx vitest run tests/equipe/rls-desativar-membro.test.ts -t "is_supervisor"` | ❌ W0 | ⬜ pending |
| 10-0x-xx | — | — | EQP-03 (manual) | V2 Authentication | Real Auth-ban blocks a fresh login attempt on the hosted project (Assumption A2) | manual-only — Auth Admin API side effects aren't safely repeatable/automatable against the live free-tier project without a dedicated disposable test user each run | manual: attempt login as a just-deactivated test account | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact Task IDs filled in once the planner assigns them — the Req/Test/Command mapping above is locked from RESEARCH.md and must not drift.*

---

## Wave 0 Requirements

- [ ] `tests/equipe/rls-desativar-membro.test.ts` — stubs for EQP-02, EQP-03 (last-supervisor guard, self-deactivation guard, post-deactivation `is_supervisor()`/RLS rejection)
- [ ] `tests/equipe/reassignment.test.ts` — stubs for EQP-01, EQP-04 (em_andamento reassignment, ganho/perdido preservation)
- [ ] A second active-Supervisor test fixture helper (extends `tests/helpers/supabase-test-clients.ts`) — needed by the last-supervisor concurrency test in `rls-desativar-membro.test.ts`
- [ ] Framework install: none — Vitest already installed and configured project-wide

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Auth Admin API `ban_duration` blocks a fresh login attempt | EQP-03 | Auth Admin API side effects (banning a real `auth.users` row) aren't safely repeatable/automatable against the live free-tier Supabase project without provisioning a disposable test user per run — deferred to the phase's personal live-browser verification checkpoint, same discipline as Phase 9's Estado-cascade manual check | 1. Deactivate a test Vendedor via the UI. 2. Attempt to log in as that Vendedor with their known test password. 3. Confirm login is rejected (not just RLS-blocked after login — the login attempt itself must fail). |
| `ban_duration: "none"` correctly unbans on Reativar (Assumption A1/A2, tagged `[ASSUMED]` in RESEARCH.md) | EQP-02/reactivation | Same live-Auth-API constraint as above; also resolves the tagged assumption about the exact unban value/format | 1. Reactivate the previously-deactivated test Vendedor via the UI. 2. Attempt to log in again with the same credentials. 3. Confirm login now succeeds. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
