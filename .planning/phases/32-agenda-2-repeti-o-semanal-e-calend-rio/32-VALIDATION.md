---
phase: 32
slug: agenda-2-repeti-o-semanal-e-calend-rio
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-02
---

# Phase 32 — Validation Strategy

> Contrato de validação por fase. A tabela detalhada de requisito → teste está em `32-RESEARCH.md` (seção "Validation Architecture"); este arquivo resume o essencial e é atualizado pelo planner com Task/Plan/Wave.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.10` + Testing Library (`*.test.ts` em node; `*.test.tsx` em jsdom) |
| **Config file** | `vitest.config.ts` (`fileParallelism: false`) |
| **Quick run command** | `npx vitest run tests/agenda2` |
| **Full suite command** | `npm test` (atenção: falhas antigas de contas semente apagadas são pré-existentes e não contam) |
| **Estimated runtime** | ~120 segundos (pasta agenda2) |

## Sampling Rate

- **After every task commit:** `npx vitest run tests/agenda2`
- **After every plan wave:** `npx vitest run tests/agenda2 tests/agenda tests/layout`
- **Before `/gsd-verify-work`:** pasta agenda2 + agenda + layout verdes, `npx tsc --noEmit`, `npm run lint`, `npm run build`
- **Max feedback latency:** 120 segundos

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| AGD2-02 | Datas semanais (mesmo dia da semana, N visitas no total, D-31) | unit | `npx vitest run tests/agenda2/repeticao.test.ts` | ❌ W0 | ⬜ pending |
| AGD2-02 | Schema de criação 0/4/8/12 + regra "hoje em diante" (D-23) | unit | `npx vitest run tests/agenda2/validacao-agenda2.test.ts` | ⚠️ estender | ⬜ pending |
| AGD2-02 | Server Action: um único insert em lote, dono da sessão | unit (mock) | `npx vitest run tests/agenda2/agenda2-actions.test.ts` | ⚠️ estender | ⬜ pending |
| AGD2-02 | Lote real no banco: tudo-ou-nada, RLS por linha | integration | `npx vitest run tests/agenda2/rls-agenda2-repeticao.test.ts` | ❌ W0 | ⬜ pending |
| AGD2-02 | Formulário: seletor só ao criar, padrão "Não repetir" | component | `npx vitest run tests/agenda2/agenda2-item-form.test.tsx` | ⚠️ estender | ⬜ pending |
| AGD2-08 | Funções puras do calendário | unit | `npx vitest run tests/agenda2/itens.test.ts` | ⚠️ estender | ⬜ pending |
| AGD2-08 | Query por período | unit (mock) | `npx vitest run tests/agenda2/agenda2-periodo-query.test.ts` | ❌ W0 | ⬜ pending |
| AGD2-08 | Calendário (container, mês, semana, dia, toolbar, integração) | component | `npx vitest run tests/agenda2/agenda2-calendario*.test.tsx tests/agenda2/agenda2-list.test.tsx` | ❌ W0 | ⬜ pending |
| Critério 5 | Agenda atual sem nenhuma mudança | structural | `git diff --stat <base>..HEAD -- components/agenda lib/agenda app/actions/agenda.ts lib/supabase/queries/agenda.ts tests/agenda supabase/migrations` (vazio) | ❌ W0 | ⬜ pending |

## Wave 0 Requirements

- [ ] `tests/agenda2/repeticao.test.ts`
- [ ] `tests/agenda2/rls-agenda2-repeticao.test.ts` (fixtures descartáveis, máx. 2 logins por arquivo, nomes sem 8+ dígitos seguidos)
- [ ] `tests/agenda2/agenda2-periodo-query.test.ts`
- [ ] `tests/agenda2/agenda2-calendario{,-dia,-mes,-semana,-toolbar,-integracao}.test.tsx`
- [ ] Ajuste das asserções de insert (objeto → array) em `tests/agenda2/agenda2-actions.test.ts`
- [ ] Nenhum framework novo

## Manual-Only Verifications

Nenhuma obrigatória; conferência visual no navegador recomendada ao final (o dono pode optar por pular, como na Fase 31).

## Validation Sign-Off

- [ ] Todas as tarefas têm verificação automática ou dependência de Wave 0
- [ ] Sem 3 tarefas seguidas sem teste automático
- [ ] `nyquist_compliant: true` ao final

**Approval:** pending
