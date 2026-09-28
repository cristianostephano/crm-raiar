---
phase: 31
slug: agenda-2-visitas-manuais-na-lista
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-28
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` (unit/component/integração-RLS) + Playwright `^1.61.1` (E2E, não exigido nesta fase) |
| **Config file** | `vitest.config.ts` (raiz do projeto) |
| **Quick run command** | `npx vitest run tests/agenda2` |
| **Full suite command** | `npm test` (= `vitest run`, suíte completa) |
| **Estimated runtime** | ~90 segundos (suíte completa, mesma ordem de grandeza das suítes de RLS existentes) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/agenda2` (+ `tests/agenda/app-sidebar-agenda.test.tsx` quando a tarefa tocar o menu)
- **After every plan wave:** Run `npm test` (suíte completa — a suíte de RLS cria/apaga registros via `serviceClient()` contra um Supabase real, mesmo padrão já usado no projeto)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 segundos

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | AGD2-01 | RLS insert (dono define vendedor_id no servidor) | Vendedor cria item manual | integration + component | `npx vitest run tests/agenda2/rls-agenda2.test.ts tests/agenda2/agenda2-item-form.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AGD2-03 | RLS update owner-only | Vendedor edita item próprio | integration | `npx vitest run tests/agenda2/rls-agenda2.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AGD2-04 | RLS delete owner-only | Vendedor apaga item próprio | integration | `npx vitest run tests/agenda2/rls-agenda2.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AGD2-05 | — | Concluir/desmarcar, riscado visível | component | `npx vitest run tests/agenda2/agenda2-item-row.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AGD2-06 | — | Item "Agenda 2" no menu, contador, ordem D-15 | component | `npx vitest run tests/agenda/app-sidebar-agenda.test.tsx tests/layout` | ⚠️ existe, precisa ajuste | ⬜ pending |
| TBD | TBD | TBD | AGD2-07 | RLS cross-vendedor (Supervisor só leitura, D-16) | Supervisor vê time + filtra; vendedor só vê os próprios | integration + component | `npx vitest run tests/agenda2/rls-agenda2.test.ts tests/agenda2/agenda2-list.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task/Plan/Wave IDs ficam `TBD` até o planner atribuir — esta tabela é o contrato de cobertura, não o plano em si.*

---

## Wave 0 Requirements

- [ ] `tests/agenda2/rls-agenda2.test.ts` — cobre AGD2-01/03/04/07, espelhando `tests/clientes/rls-clientes.test.ts` (usa `SEED_ACCOUNTS`, `signInAs`, `serviceClient()` de `tests/helpers/supabase-test-clients.ts` — já existentes, nenhum helper novo necessário). Deve cobrir explicitamente: Supervisor consegue SELECT mas NÃO INSERT/UPDATE/DELETE (D-16); vendedor não acessa item de outro vendedor mesmo direto no banco.
- [ ] `tests/agenda2/agenda2-item-row.test.tsx` — cobre AGD2-05 (line-through ao concluir, volta ao desmarcar), espelhando `tests/agenda/agenda-item-row.test.tsx`
- [ ] `tests/agenda2/agenda2-list.test.tsx` — cobre agrupamento Atrasado/Hoje/Próximos (D-01/D-02/D-03) e filtro por vendedor (AGD2-07/D-17/D-18), espelhando `tests/agenda/agenda-list.test.tsx`
- [ ] `tests/agenda2/itens.test.ts` — cobre o agrupamento local + reuso de `bucketDoItem` (de `lib/agenda/itens.ts`), espelhando `tests/agenda/itens.test.ts`
- [ ] Ajuste em `tests/agenda/app-sidebar-agenda.test.tsx` e siblings (`app-sidebar-perdidos.test.tsx`, `app-sidebar-encerrados.test.tsx`, `layout/app-sidebar-visual.test.tsx`) — nova ordem D-15 (Agenda → Agenda 2 → Clientes → Perdidos → Encerrados → Dashboard)
- [ ] Nenhum framework novo a instalar — Vitest + `@testing-library/react` (jsdom) já cobrem tudo.

---

## Manual-Only Verifications

*None — All phase behaviors have automated verification (RLS via integration tests contra Supabase real, UI via component tests).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
