---
phase: 27
slug: corre-es-do-primeiro-uso-card-filtrado-e-agenda
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-25
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (existing project setup, no change needed) |
| **Config file** | `vitest.config.ts` (environment: `node` by default, `jsdom` for `tests/**/*.test.tsx` via `environmentMatchGlobs`) |
| **Quick run command** | `npx vitest run tests/clientes/nome-exibicao.test.ts tests/agenda/agenda-list.test.tsx tests/clientes/cliente-card-setas-etapa.test.tsx` |
| **Full suite command** | `npm test` (serialized against a real Supabase project — slower than a typical Vitest suite; known `signInWithPassword` rate-limit caveat documented in STATE.md, not expected to trigger for this phase's pure-function/render tests) |
| **Estimated runtime** | ~10-20 seconds for the quick run |

---

## Sampling Rate

- **After every task commit:** Run the quick run command against touched test files
- **After every plan wave:** Run `npm test` (full suite) — with the rate-limit caveat noted above
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 27-01-W0 | 01 | 0 | AGD-15 | — | N/A | fixture update | `npx vitest run tests/agenda/agenda-list.test.tsx` | ❌ W0 (fixtures need `nomeFantasia`) | ⬜ pending |
| 27-01-01 | 01 | 1 | AGD-15 | — | N/A | unit (mapper) | new target — `lib/supabase/queries/agenda.ts` mapper | ❌ W0 | ⬜ pending |
| 27-01-02 | 01 | 1 | AGD-15 | — | N/A | render | `npx vitest run tests/agenda/` | ✅ existing file to extend | ⬜ pending |
| 27-02-01 | 02 | 1 | KAN-03 | — | N/A | human-verify (diagnosis) | manual — see live-diagnosis script in RESEARCH.md | — | ⬜ pending |
| 27-02-02 | 02 | 2 | KAN-03 | — | N/A | TBD (depends on diagnosis) | TBD | ❌ W0 (cannot exist before diagnosis) | ⬜ pending |
| 27-02-03 | 02 | 2 | KAN-03 (regression) | — | N/A | unit/render | `npx vitest run tests/clientes/cliente-card-setas-etapa.test.tsx` | ✅ existing, passes today | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/agenda/agenda-list.test.tsx` — add `nomeFantasia` to every existing `ClienteSemDiaFixo` fixture (compile-time forced once the type changes) + at least one new case exercising the fallback (razão social present / null+Nome Fantasia present / both null)
- [ ] New render-level test for `AgendaSemDiaFixo.tsx`'s name-fallback behavior (jsdom, mirrors `tests/clientes/cliente-card-setas-etapa.test.tsx`'s pattern)
- [ ] KAN-03's test cannot be written until the live diagnosis (task 27-02-01) identifies what's actually different — expected, not an oversight; the plan must sequence the diagnosis task strictly before any KAN-03 code-change or test-writing task

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Root cause of the Kanban filtered-card compression | KAN-03 | Two independent full-code-read passes (Discuss-phase + Research) found no code path that explains the reported symptom in the current source tree — requires a live authenticated session in a real browser (neither the orchestrator nor any subagent has one) | 10-step DevTools diagnostic script, verbatim in `27-RESEARCH.md` under "KAN-03 — mandatory live-diagnosis script" — project owner runs it on the `staging` preview and reports back computed widths, whether the missing text exists in the HTML, and whether the bug survives a hard-reload / private window |
| Filtered card visually identical to unfiltered card, on a real phone/tablet | KAN-03 | Visual/touch confirmation on the actual device class the sales team uses — not reproducible in jsdom | Open `/clientes` on a phone/tablet, apply the vendor filter, compare against an unfiltered card side by side |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies — **KAN-03's fix task is the deliberate exception, gated behind the human-verify diagnosis task per this phase's confirmed research finding**
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter (pending planner's task breakdown)

**Approval:** pending
