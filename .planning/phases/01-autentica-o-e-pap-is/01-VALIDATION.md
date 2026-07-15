---
phase: 1
slug: autentica-o-e-pap-is
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (integration) + Playwright (e2e) — project-wide standard per `.planning/research/STACK.md`, not yet installed |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && npx playwright test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run && npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green, plus the manual real-email-invite check below
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-xx | 01 | 0 | — | — | Test infra installed and runnable | setup | `npx vitest run` | ❌ W0 | ⬜ pending |
| 01-xx-xx | TBD | TBD | AUTH-01 | — | Login with valid email/senha succeeds; invalid credentials rejected | integration | `npx vitest run tests/auth/login.test.ts` | ❌ W0 | ⬜ pending |
| 01-xx-xx | TBD | TBD | AUTH-02 | T-elevation-of-privilege | Supervisor invites a Vendedor; account created with correct role/fields; non-Supervisor calling invite Edge Function is rejected (403) | integration | `npx vitest run tests/auth/invite.test.ts` | ❌ W0 | ⬜ pending |
| 01-xx-xx | TBD | TBD | AUTH-03 | T-rls-leak | `is_supervisor()` correctly distinguishes roles; a Vendedor cannot see/alter another Vendedor's restricted `profiles` row | integration (authenticated as each role, not service-role) | `npx vitest run tests/auth/rls-roles.test.ts` | ❌ W0 | ⬜ pending |
| 01-xx-xx | TBD | TBD | AUTH-04 | — | Session persists across a simulated new request (cookie round-trip through middleware) | e2e | `npx playwright test tests/e2e/session-persistence.spec.ts` | ❌ W0 | ⬜ pending |

*Task IDs finalized once PLAN.md files are written by the planner.*

---

## Wave 0 Requirements

- [ ] Install Vitest + Testing Library + Playwright (`npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @playwright/test && npx playwright install`)
- [ ] `tests/auth/` directory + shared test helper that authenticates as a seeded test user (Supervisor, Vendedor A, Vendedor B) against a local Supabase instance (`supabase start`)
- [ ] Seed script/migration creating the two Vendedor test accounts + the first real Supervisor (D-03 — email confirmed with the user during implementation)
- [ ] Supabase CLI local dev stack (`supabase init`, `supabase start`) — tests must run against real RLS policies, not mocks, per `.claude/CLAUDE.md`'s testing philosophy

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real invite e-mail is sent and received, link works end-to-end | AUTH-02 | Requires a real mailbox and Supabase project outbound email config — cannot be simulated locally | Supervisor invites a real test address; confirm the email arrives and the "definir senha" link successfully logs the account in |
| Password reset e-mail round-trip | AUTH-01 (recuperação de senha, D-08) | Same as above — depends on real outbound email delivery | Trigger "esqueci minha senha" for a real test account; confirm the reset link arrives and works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
