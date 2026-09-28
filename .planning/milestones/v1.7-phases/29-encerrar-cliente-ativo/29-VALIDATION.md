---
phase: 29
slug: encerrar-cliente-ativo
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-26
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (já configurado; `tests/funil/` já existe desde a Fase 28) |
| **Config file** | `vitest.config.ts` (existente, sem mudança necessária) |
| **Quick run command** | `npx vitest run tests/funil/encerrados-rpc.test.ts tests/funil/reativar-guard.test.ts` |
| **Full suite command** | `npx vitest run tests/funil/` (mesma pasta usada por Perdidos — inclui o arquivo de integração real) |
| **Estimated runtime** | ~30-45s (integração contra Supabase real) |

---

## Sampling Rate

- **Per task commit:** `npx vitest run tests/funil/<arquivo-da-tarefa>`
- **Per plan wave:** `npx vitest run tests/funil/` completo
- **Phase gate:** Suite completa verde + `npx tsc --noEmit` + `npx eslint` antes de `/gsd-verify-work`

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | ENCR-01..05 | T-29-01, T-29-02, T-29-04, T-29-06 | 0035 só com o ALTER TYPE; 0036 sem elevação de privilégio nem campo de contato | structural (node) | script do bloco verify da Tarefa 1 do 29-01 | ❌ criado no plano | ⬜ pending |
| 29-01-02 | 01 | 1 | ENCR-01..05 | T-29-01, T-29-03, T-29-05, T-29-07 | RLS, guards, Agenda, reativar (com/sem frequência) | integration (RED até 29-03) | `npx vitest run tests/funil/encerrados-rpc.test.ts` | ❌ criado no plano | ⬜ pending |
| 29-02-01 | 02 | 1 | ENCR-03, ENCR-05 | T-29-10, T-29-11 | 5 funções dashboard sem elevação, mesma assinatura | structural (node) | script do bloco verify da Tarefa 1 do 29-02 | ❌ criado no plano | ⬜ pending |
| 29-02-02 | 02 | 1 | ENCR-03, ENCR-05 | T-29-11, T-29-12 | encerrar/reativar não mudam números do Dashboard | integration (RED até 29-03) | `npx vitest run tests/dashboard/encerrado-preserva-historico.test.ts` | ❌ criado no plano | ⬜ pending |
| 29-03-02 | 03 | 2 | ENCR-01..05 | T-29-14, T-29-15, T-29-16 | aplicação aprovada, na ordem; migrations antigas intocadas | integration (GREEN) | `npx vitest run tests/funil/encerrados-rpc.test.ts tests/dashboard/encerrado-preserva-historico.test.ts` | ✅ após 29-01/29-02 | ⬜ pending |
| 29-04-01 | 04 | 3 | ENCR-01 | — | rótulo "Encerrado" na exportação | unit | `npx vitest run tests/clientes/exportacao-status-encerrado.test.ts` | ❌ criado no plano | ⬜ pending |
| 29-04-02 | 04 | 3 | ENCR-03 | T-29-20, T-29-21 | encerrado fora das 7 colunas | unit + integration (live) | `npx vitest run tests/clientes/prospeccao.test.ts tests/clientes/kanban-sem-perdidos.test.ts tests/clientes/filtro-prospeccao-postgrest.test.ts` | ✅ (atualizados) | ⬜ pending |
| 29-04-03 | 04 | 3 | ENCR-01, ENCR-02, ENCR-04, ENCR-05 | T-29-18, T-29-19 | frequência efetiva, pré-checagens de encerrar | unit (mock) | `npx vitest run tests/funil/reativar-guard.test.ts` | ❌ criado no plano | ⬜ pending |
| 29-05-01 | 05 | 2 | ENCR-05 | T-29-23 | período/validação/busca | unit | `npx vitest run tests/funil/encerrados-lista.test.ts` | ❌ criado no plano | ⬜ pending |
| 29-05-02 | 05 | 2 | ENCR-02, ENCR-04, ENCR-05 | T-29-24, T-29-25 | sem checagem de papel; 7 campos | unit (mock) | `npx vitest run tests/funil/encerrados-query.test.ts` | ❌ criado no plano | ⬜ pending |
| 29-05-03 | 05 | 2 | ENCR-02 | T-29-26 | 7ª aba de Configurações | render | `npx vitest run tests/configuracoes/configuracoes-tabs.test.tsx` | ✅ (atualizado) | ⬜ pending |
| 29-06-01 | 06 | 4 | ENCR-02 | T-29-28 | diálogo de motivo obrigatório | render | `npx vitest run tests/clientes/encerramento-motivo-dialog.test.tsx` | ❌ criado no plano | ⬜ pending |
| 29-06-02 | 06 | 4 | ENCR-01, ENCR-03, ENCR-04 | T-29-29 | opção Encerrado + recarga da Agenda | render | `npx vitest run tests/clientes/cliente-detail-sheet-encerrar.test.tsx` | ❌ criado no plano | ⬜ pending |
| 29-07-01 | 07 | 3 | ENCR-05 | T-29-32 | linha + filtro | render | `npx vitest run tests/funil/encerrados-item-row.test.tsx tests/funil/encerrados-periodo-filter.test.tsx` | ❌ criado no plano | ⬜ pending |
| 29-07-02 | 07 | 3 | ENCR-04, ENCR-05 | T-29-34, T-29-36 | lista + Reativar de um toque | render | `npx vitest run tests/funil/encerrados-list.test.tsx` | ❌ criado no plano | ⬜ pending |
| 29-07-03 | 07 | 3 | ENCR-05 | T-29-35 | menu sem contador | render | `npx vitest run tests/funil/app-sidebar-encerrados.test.tsx` | ❌ criado no plano | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/funil/encerrados-rpc.test.ts` — novo, molde `tests/funil/perdidos-rpc.test.ts`, cobrindo ENCR-01/02/03/04
- [ ] `tests/funil/reativar-guard.test.ts` — novo, cobre especificamente o Pitfall 1 (frequência efetiva) achado pela pesquisa
- [ ] Demais arquivos de teste da camada de dados e da tela seguem os moldes 1:1 já usados pela Fase 28 — nenhuma infraestrutura de teste nova necessária (`tests/helpers/supabase-test-clients.ts` já cobre fixtures descartáveis)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reativar um cliente encerrado sem frequência de visita (caso comum: todo ativo importado nasce sem frequência, migration 0027) | ENCR-05 | Coberto automaticamente no banco (`reativar-sem-frequencia-restaura`, 29-01) e na ação (`reativar-sem-frequencia-restaura`, 29-04); a checagem manual confirma o efeito visível | No link de teste da staging, encerrar e reativar um ativo importado sem frequência — ele deve voltar como "Ganho" e reaparecer em "Sem dia fixo definido" (decisão do planejamento, 29-01 conflitos_resolvidos 1, confirmada pelo dono no checkpoint do 29-03) |
| Visual da tela "Encerrados" em celular/tablet | ENCR-01/02 | Confirmação visual/toque em dispositivo real | Abrir o novo item de menu, conferir leitura e toque do botão "Reativar" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify ou dependência de Wave 0
- [ ] Sampling continuity: nenhum bloco de 3 tarefas seguidas sem verificação automatizada
- [ ] Wave 0 cobre todas as referências MISSING
- [ ] Sem flags de watch-mode
- [ ] Latência de feedback < 45s
- [ ] `nyquist_compliant: true` no frontmatter (pendente da distribuição de tarefas do planner)

**Approval:** pending
