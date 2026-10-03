---
phase: 33
slug: agenda-atual-sem-visitas-automaticas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-03
---

# Phase 33 — Validation Strategy

> Fonte: 33-RESEARCH.md (Validation Architecture). O planner acrescenta Plan/Task/Wave.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 (`environment: node`; `tests/**/*.test.tsx` em jsdom; `fileParallelism: false`) |
| Config file | `vitest.config.ts` (carrega `.env.local`) |
| Quick run command | `npx vitest run tests/agenda/agenda-list.test.tsx tests/agenda/agenda-sem-visitas-migracao.test.ts tests/importacao/ativo-import-summary.test.tsx` |
| Full suite command | `npx vitest run` — ATENÇÃO: ~49 arquivos vermelhos por `SEED_ACCOUNTS` apagadas (STATE.md, Deferred Items); o portão da fase é a LISTA abaixo, não a suite inteira |

Baseline verificado nesta pesquisa (2026-10-03): 10 arquivos / 161 testes VERDES — `agenda-list.test.tsx`, `sem-dia-fixo.test.tsx`, `itens.test.ts`, `clientes-sem-dia-fixo-query.test.ts`, `ativo-import-summary.test.tsx`, `app-sidebar-agenda.test.tsx`, `agenda-calendario-integracao.test.tsx`, `migracao-agenda2.test.ts`, `agenda-item-row.test.tsx`, `concluir-item-dialog.test.tsx` (≈61 s).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGD-16 (crit. 1) | 0049 só tem prospecção, mesma assinatura/colunas, sem `drop`, sem elevação | estrutural (fs) | `npx vitest run tests/agenda/agenda-sem-visitas-migracao.test.ts` | ❌ Wave 0 |
| AGD-16 (crit. 1) | Nenhuma linha `origem='visita'` na RPC; ganho com visita vencida não aparece; contador = lista | ao vivo | `npx vitest run tests/agenda/agenda-sem-visitas-automaticas.test.ts` | ❌ Wave 0 (VERMELHO até aplicar) |
| AGD-16 (crit. 2) | Prospecção idêntica (ordem, colunas, atraso, conclusão com resumo, contador) | estrutural + ao vivo L3/L4 + tela inalterada | idem + `npx vitest run tests/agenda/agenda-list.test.tsx tests/agenda/agenda-item-row.test.tsx tests/agenda/concluir-item-dialog.test.tsx tests/agenda/itens.test.ts` | parte ❌ (novos), parte ✅ |
| AGD-16 (crit. 3) | "Sem dia fixo" não aparece e a ação nem é chamada | tela (jsdom) | `npx vitest run tests/agenda/agenda-list.test.tsx` | ✅ (caso "aviso de dia fixo" muda de propósito) |
| AGD-16 (crit. 4) | Frequência/dia fixo seguem na ficha; nada apagado; ganho ainda exige frequência | ao vivo (existentes, sem edição) | `npx vitest run tests/clientes/dia-fixo-visita.test.ts tests/funil/encerrados-rpc.test.ts` + L2/L5 | ✅ |
| AGD-16 (crit. 5) | Visita concluída segue no calendário (histórico) e no Diário | ao vivo L5 | ver L5 | ❌ Wave 0 |
| (regressão) | Inventário de 11 funções com elevação inalterado | estrutural existente | `npx vitest run tests/agenda2/migracao-agenda2.test.ts` | ✅ sem edição |
| (regressão) | Selo do menu continua vindo de `getAgendaPendentesCount` | tela | `npx vitest run tests/agenda/app-sidebar-agenda.test.tsx tests/agenda2/app-layout-contagem.test.tsx` | ✅ sem edição |

### Quais testes MUDAM de propósito x quais PASSAM SEM EDIÇÃO
**Mudam de propósito (todos no mesmo plano da migration, ficam VERMELHOS até aplicar quando ao vivo):**
- `tests/funil/encerrados-rpc.test.ts` — casos `agenda-some` e `reativar-volta-agenda` (roda hoje, `createTestMember`).
- `tests/clientes/dia-fixo-visita.test.ts` — "Bloco F - agenda_do_vendedor mira o dia fixo ..." (roda hoje, só `serviceClient`).
- `tests/agenda/agenda-rpc.test.ts` — casos `origem`, `cliente`, `ordem` (não executável hoje: sementes).
- `tests/agenda/concluir-rpc.test.ts` — casos `visita` (linha 376) e `sugerida` (não executável hoje).
- `tests/agenda/agenda-list.test.tsx` — caso "aviso de dia fixo (AGENDA-01)": passa a afirmar que a seção NÃO aparece mesmo que a ação devolvesse clientes, e que `getClientesSemDiaFixoAction` não é chamada. Também remover do arquivo o `mockedSemDiaFixo` e a entrada do `vi.mock` (limpeza; as demais ~10 casos seguem verdes sem edição de lógica — incluindo os de `origem: "visita"`, porque a tela mantém o ramo de visita).
- `tests/importacao/ativo-import-summary.test.tsx` — caso `conclusaoaviso` (linhas 77-82), se o texto de `AtivoImportSummary` for corrigido (Open Question 1).

**Passam SEM EDIÇÃO (oráculo de regressão):**
- Tela/unitário (rodam hoje): `tests/agenda/agenda-item-row.test.tsx`, `concluir-item-dialog.test.tsx`, `itens.test.ts`, `agenda-calendario*.test.tsx` (7 arquivos, incluindo `agenda-calendario-integracao.test.tsx`, cujo `vi.mock` ainda lista `getClientesSemDiaFixoAction` — inofensivo, deixar), `app-sidebar-agenda.test.tsx`, `tests/agenda2/app-layout-contagem.test.tsx`, `sem-dia-fixo.test.tsx` e `clientes-sem-dia-fixo-query.test.ts` (componente/consulta dormentes continuam testados), `tests/agenda2/migracao-agenda2.test.ts`.
- Ao vivo que rodam hoje e devem continuar verdes: `dia-fixo-visita.test.ts` (Blocos A-E e o Bloco F de `mover_card_funil` — prova D-34 "visita continua sendo criada"), `encerrados-rpc.test.ts` demais casos, em especial `ganho-sem-frequencia-continua-bloqueado` (prova D-35 sem tocar na trava) e `reativar-semeia-visita`.
- Dependentes de sementes (hoje vermelhos, não editar): `tests/clientes/frequencia-visita.test.ts` (oráculo declarado da trava de ganho, D-35 — nem uma linha), `tests/agenda/rls-agenda.test.ts`, `agenda-concluidos-rpc.test.ts`, `rls-conclusao.test.ts`, `conclusao-remota-rpc.test.ts`, `proxima-data.test.ts` (função pura, sem agenda_do_vendedor real).

### Sampling Rate
- **Per task commit:** o comando rápido acima (≈30 s).
- **Per wave merge:** lista do baseline (10 arquivos) + `agenda-sem-visitas-migracao.test.ts`.
- **Phase gate (após o dono aplicar a 0049):** lista do baseline + `agenda-sem-visitas-automaticas.test.ts` + `dia-fixo-visita.test.ts` + `encerrados-rpc.test.ts` + `agenda2/migracao-agenda2.test.ts` verdes, e verificação do link de preview da `staging` antes de `master`. NÃO exigir a suite inteira (vermelha por sementes, pré-existente).

### Wave 0 Gaps
- [ ] `tests/agenda/agenda-sem-visitas-migracao.test.ts` — estrutural (0049 + arquivo de volta).
- [ ] `tests/agenda/agenda-sem-visitas-automaticas.test.ts` — ao vivo (L1-L5), 1 login, 1 fixture, nomes inventados SEM sequência de 8+ dígitos corridos (precaução herdada da Fase 31; clientes aceitam, mas manter a disciplina), nunca imprimir leitura, limpar clientes antes de `deleteTestMember`.
- [ ] Framework: nenhuma instalação.

## Validation Sign-Off

- [ ] Todas as tarefas têm verificação automática ou dependência de Wave 0
- [ ] `nyquist_compliant: true` ao final

**Approval:** pending
