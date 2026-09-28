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
| 31-01-T1/T2, 31-03-T3, 31-07-T1/T2 | 31-01, 31-03, 31-07 | 1, 2, 3 | AGD2-01 | T-31-03, T-31-18, T-31-31 — RLS insert (dono define vendedor_id no servidor) | Vendedor cria item manual | integration + component | `npx vitest run tests/agenda2/rls-agenda2.test.ts tests/agenda2/agenda2-item-form.test.tsx` | ❌ W0 (criado em 31-01 / 31-07) | ⬜ pending |
| 31-01-T2, 31-03-T3, 31-04-T2 | 31-01, 31-03, 31-04 | 1, 2 | AGD2-03 | T-31-01, T-31-23 — RLS update owner-only | Vendedor edita item próprio | integration + unit | `npx vitest run tests/agenda2/rls-agenda2.test.ts tests/agenda2/agenda2-actions.test.ts` | ❌ W0 (criado em 31-01 / 31-04) | ⬜ pending |
| 31-01-T2, 31-03-T3, 31-05-T2 | 31-01, 31-03, 31-05 | 1, 2 | AGD2-04 | T-31-01, T-31-25 — RLS delete owner-only | Vendedor apaga item próprio (com confirmação) | integration + component | `npx vitest run tests/agenda2/rls-agenda2.test.ts tests/agenda2/agenda2-apagar-dialog.test.tsx` | ❌ W0 (criado em 31-01 / 31-05) | ⬜ pending |
| 31-02-T1, 31-05-T1 | 31-02, 31-05 | 1, 2 | AGD2-05 | — | Concluir/desmarcar, riscado visível | unit + component | `npx vitest run tests/agenda2/itens.test.ts tests/agenda2/agenda2-item-row.test.tsx` | ❌ W0 (criado em 31-02 / 31-05) | ⬜ pending |
| 31-04-T1, 31-06-T1/T2/T3 | 31-04, 31-06 | 2, 3 | AGD2-06 | T-31-19, T-31-27 — contagem filtrada por dono, falha isolada | Item "Agenda 2" no menu, contador, ordem D-15 | unit + component | `npx vitest run tests/agenda2/agenda2-query.test.ts tests/agenda2/app-sidebar-agenda2.test.tsx tests/agenda2/app-layout-contagem.test.tsx tests/agenda/app-sidebar-agenda.test.tsx tests/layout` | ⚠️ existe (ajuste em 31-06) + novos | ⬜ pending |
| 31-01-T2, 31-03-T3, 31-08-T1 | 31-01, 31-03, 31-08 | 1, 2, 4 | AGD2-07 | T-31-01, T-31-02, T-31-33 — RLS cross-vendedor (Supervisor só leitura, D-16) | Supervisor vê time + filtra; vendedor só vê os próprios | integration + component | `npx vitest run tests/agenda2/rls-agenda2.test.ts tests/agenda2/agenda2-list.test.tsx` | ❌ W0 (criado em 31-01 / 31-08) | ⬜ pending |
| 31-01-T1 | 31-01 | 1 | (nota g ROADMAP, LGPD) | T-31-05, T-31-07 — colunas mínimas, sem elevação de privilégio | Forma da migration 0048 | structural | `npx vitest run tests/agenda2/migracao-agenda2.test.ts` | ❌ W0 (criado em 31-01) | ⬜ pending |
| 31-02-T2, 31-04-T1 | 31-02, 31-04 | 1, 2 | AGD2-01/03 (LGPD) | T-31-10, T-31-11 — schema descarta campos extras, recusa documento | Validação compartilhada + sincronia com a 0048 | unit | `npx vitest run tests/agenda2/validacao-agenda2.test.ts tests/agenda2/limites-sincronizados.test.ts` | ❌ W0 (criado em 31-02 / 31-04) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task/Plan/Wave IDs ficam `TBD` até o planner atribuir — esta tabela é o contrato de cobertura, não o plano em si.*

---

## Wave 0 Requirements

- [ ] `tests/agenda2/rls-agenda2.test.ts` — cobre AGD2-01/03/04/07, espelhando `tests/funil/encerrados-rpc.test.ts` (usa `createTestMember`/`deleteTestMember`, `signInAs`, `serviceClient()` de `tests/helpers/supabase-test-clients.ts` — já existentes, nenhum helper novo necessário; **nota do planejamento:** as contas semente `SEED_ACCOUNTS` foram apagadas em 2026-08-19 (STATE.md) e NÃO podem ser usadas — só fixtures descartáveis, no máximo 2 logins por arquivo). Deve cobrir explicitamente: Supervisor consegue SELECT mas NÃO INSERT/UPDATE/DELETE (D-16); vendedor não acessa item de outro vendedor mesmo direto no banco.
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
