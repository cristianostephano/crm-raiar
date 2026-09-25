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
| 27-01-01 | 01 | 1 | AGD-15 | T-27-01, T-27-03 | consulta segue com a sessão do usuário (RLS), fixtures fictícios | unit (query + mapper, mock de `@/lib/supabase/server`) + fixture update | `npx vitest run tests/agenda/clientes-sem-dia-fixo-query.test.ts tests/agenda/sem-dia-fixo.test.tsx tests/agenda/itens.test.ts tests/agenda/agenda-list.test.tsx && npx tsc --noEmit` | ❌ criado na própria tarefa (TDD: RED → GREEN) | ⬜ pending |
| 27-01-02 | 01 | 1 | AGD-15 | T-27-02 | nome renderizado só como texto/atributo escapado | render (jsdom) | `npx vitest run tests/agenda/sem-dia-fixo.test.tsx tests/agenda/agenda-list.test.tsx tests/agenda/itens.test.ts tests/agenda/clientes-sem-dia-fixo-query.test.ts tests/clientes/nome-exibicao.test.ts && npx tsc --noEmit` | ✅ arquivo existente estendido | ⬜ pending |
| 27-02-01 | 02 | 1 | KAN-03 | T-27-04 | prints só na conversa, telefones recortados | checkpoint:human-action (diagnóstico ao vivo) | automático só a guarda de "nenhum código mudou": `test -z "$(git status --porcelain -- components lib app tests)"` | — | ⬜ pending |
| 27-02-02 | 02 | 1 | KAN-03 | T-27-05 | resultado único e legível por comando | registro + linha de base da regressão | `grep -cE "^Resultado do diagnóstico KAN-03: H1-(CONFIRMADO\|COMPATIVEL\|CONTRADITO)$" 27-02-SUMMARY.md && npx vitest run tests/clientes/cliente-card-setas-etapa.test.tsx` | ✅ teste existente | ⬜ pending |
| 27-03-01 | 03 | 2 | KAN-03 | T-27-07, T-27-09, T-27-10 | portão do diagnóstico; arrastar continua desligado com filtro | render (jsdom) — paridade de estrutura e conteúdo, card filtrado vs. sem filtro | `npx vitest run tests/clientes/kanban-card-filtrado.test.tsx tests/clientes/cliente-card-setas-etapa.test.tsx tests/clientes/kanban-scroll-column.test.tsx && npx tsc --noEmit` | ❌ criado na própria tarefa (TDD: Caso 2 falha antes da correção) | ⬜ pending |
| 27-03-02 | 03 | 2 | KAN-03 (regressão, critério 3) | T-27-08 | setas intactas | unit/render + lint | `npx vitest run tests/clientes/cliente-card-setas-etapa.test.tsx tests/clientes/kanban-card-filtrado.test.tsx tests/clientes/kanban-scroll-column.test.tsx tests/clientes/filters-popover.test.tsx ... && npx eslint ... && npx tsc --noEmit` | ✅ existente, passa hoje | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Fixtures `ClienteSemDiaFixo` recebem `nomeFantasia: null` (exigido pelo compilador após a mudança de tipo) — são TRÊS pontos, não os ~6 que a pesquisa listou: `buildCliente` em `tests/agenda/sem-dia-fixo.test.tsx`, `clienteSemDiaFixo` em `tests/agenda/itens.test.ts` e o único objeto literal em `tests/agenda/agenda-list.test.tsx` (linhas 356-362; os demais objetos desse arquivo são `AgendaItem`). Tarefa 27-01-01.
- [ ] Teste novo da consulta `tests/agenda/clientes-sem-dia-fixo-query.test.ts` (select pede `nome_fantasia`, mapeamento repassa cru) — Tarefa 27-01-01.
- [ ] Casos novos de tela para a queda de nome no teste JÁ EXISTENTE `tests/agenda/sem-dia-fixo.test.tsx` (a pesquisa não o citou; ele já renderiza `AgendaSemDiaFixo` em jsdom) — Tarefa 27-01-02.
- [ ] Teste de paridade `tests/clientes/kanban-card-filtrado.test.tsx` — só é escrito DEPOIS do diagnóstico (27-02) e só se o resultado não contradisser H1; sequenciamento garantido por `depends_on: ["27-02"]` e pelo portão da Tarefa 27-03-01.

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
