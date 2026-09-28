---
phase: 28
slug: relat-rio-de-perdidos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-25
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (`vitest.config.ts`, `node` env for `*.test.ts`, `jsdom` for `*.test.tsx`) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/clientes/prospeccao.test.ts tests/funil/perdidos-rpc.test.ts` |
| **Full suite command** | `npm test` (known Supabase Auth `signInWithPassword` rate-limit caveat, per STATE.md Phase 13-01) |
| **Estimated runtime** | ~15-30s for the quick run (integration tests hit real Supabase) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command against touched test files
- **After every plan wave:** Run `npm test` (full suite), same rate-limit caveat as always
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-01-W0 | 01 | 0 | PERD-01 | — | N/A | unit update | `npx vitest run tests/clientes/prospeccao.test.ts` | ✅ existing, needs updates for Set-based behavior | ⬜ pending |
| 28-01-01 | 01 | 1 | PERD-01, D-07 | T-28-01 | RPC never security definer | integration | `npx vitest run tests/clientes/prospeccao.test.ts` | ❌ W0 | ⬜ pending |
| 28-02-01 | 02 | 1 | PERD-02, PERD-04 | T-28-03 | No contato/telefone/email columns selected | integration | `npx vitest run tests/funil/perdidos-rpc.test.ts` | ❌ W0 — new file | ⬜ pending |
| 28-02-02 | 02 | 1 | PERD-03 | T-28-01 | RLS cross-vendedor negative case | integration | `npx vitest run tests/funil/perdidos-rpc.test.ts` | ❌ W0 | ⬜ pending |
| 28-03-01 | 03 | 2 | PERD-05 | T-28-02 | Reopen scoped by RLS pre-check | integration | `npx vitest run tests/funil/perdidos-rpc.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/funil/perdidos-rpc.test.ts` (or `tests/clientes/perdidos-rpc.test.ts`) — new file covering PERD-02/03/04/05, mirrors `tests/dashboard/rls-dashboard.test.ts` + `tests/dashboard/prospeccao.test.ts` shape
- [ ] `tests/clientes/prospeccao.test.ts` — update existing 5 assertions for the D-06 Set-based behavior
- [ ] Confirm whether an export-regression test already exists before writing a new one for "perdidos still export" (D-07)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual layout of the new "Perdidos" screen on phone/tablet | PERD-02 | Visual/touch confirmation on real device class | Open the new menu item on a phone/tablet, confirm the list is readable and the "Reabrir" button is easy to tap |
| End-to-end reopen flow as a real Vendedor session | PERD-05 | Confirms the reopened client reappears correctly in the Kanban at the right stage, in the real browser | Mark a test client perdido, reopen from the new screen, confirm it reappears in the Kanban at its original etapa |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (pending planner's task breakdown)

**Approval:** pending
