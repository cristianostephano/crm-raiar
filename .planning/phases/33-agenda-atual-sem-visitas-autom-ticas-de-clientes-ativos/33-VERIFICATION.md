---
phase: 33-agenda-atual-sem-visitas-autom-ticas-de-clientes-ativos
verified: 2026-10-04T21:15:00Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Abrir o Preview da Vercel da branch staging e entrar como Vendedor. Conferir a Agenda (Lista e Calendario em Mes)."
    expected: "Nenhum item 'Visita' pendente e nenhuma caixinha 'Sem dia fixo definido'. Prospeccao em Atrasado/Hoje/Proximos dias. O numero ao lado de 'Agenda' no menu e igual ao total da Lista. Visitas ja concluidas continuam nos dias passados do Calendario."
    why_human: "Aparencia da tela e o numero do menu so se veem num navegador. A prova no banco ja passou (testes ao vivo verdes)."
  - test: "Ainda no Preview, entrar como Supervisor, escolher 'Todos os vendedores' e abrir a ficha de um cliente ativo."
    expected: "O numero do menu bate com a Lista. Na ficha, frequencia de visita e dia fixo continuam visiveis e editaveis com os mesmos valores. A Agenda 2 esta igual a antes."
    why_human: "Conferencia visual/UX. O dono pode dispensar; a prova automatica cobre os mesmos criterios."
---

# Phase 33: Agenda Atual sem Visitas Automaticas de Clientes Ativos - Relatorio de Verificacao

**Objetivo da fase:** Enquanto o piloto roda, a Agenda atual passa a mostrar so o que vem da prospeccao. Clientes ativos ("ganho") deixam de aparecer la sozinhos por frequencia de visita ou dia fixo, sem apagar nenhum dado do cadastro, para dar para voltar atras.
**Verificado:** 2026-10-04
**Status:** human_needed (so a conferencia visual no Preview; nenhuma falha encontrada)
**Re-verificacao:** Nao, verificacao inicial

## Resultado em linguagem simples

O objetivo foi alcancado. A leitura da Agenda no banco agora devolve so as tarefas de prospeccao, a caixinha "Sem dia fixo definido" saiu da tela, e nada foi apagado. O que sobra e so conferir o visual num navegador, e o dono pode dispensar.

## Goal Achievement - Observable Truths

Base de comparacao: `5476c7045c4442dc4d6f95d1960d151743d4b1ce`.

| # | Verdade (criterio do ROADMAP) | Status | Evidencia |
|---|-------------------------------|--------|-----------|
| 1 | Lista, Calendario (pendentes) e contador do menu sem visita pendente de cliente ativo, e os tres concordam | VERIFICADO | A migration 0049 recria `agenda_do_vendedor()` so com a metade de prospeccao. Bloco da funcao conferido com `diff` contra a 0036 (linhas 334-367 mais `order by 8, 4;` e `$$;`): identico. `getAgenda` e `getAgendaPendentesCount` leem a mesma RPC. Teste ao vivo `sem-visita-global` e `contador-igual-lista` verdes. A funcao esta aplicada no banco real (`sem-visita-global` so passa com a 0049 aplicada). |
| 2 | Prospeccao igual a hoje (datas, ordem, destaque de atraso, conclusao, contador) | VERIFICADO | Metade de prospeccao byte a byte igual a da 0036, inclusive o filtro `<> 'encerrado'` e `order by 8, 4`. Ao vivo: `prospeccao-mesma-ordem-e-colunas` verde. `agenda-list`, calendario, `app-sidebar-agenda`, `sem-dia-fixo` e demais testes da tela: 77 verdes sem edicao de logica. |
| 3 | Agenda nao cobra mais frequencia/dia fixo (secao "Sem dia fixo definido" some) | VERIFICADO | `components/agenda/AgendaList.tsx` sem import, estado, efeito, filtro nem JSX de `AgendaSemDiaFixo`. `grep` em `app/`, `components/`, `lib/` mostra que nenhum arquivo de tela importa mais `AgendaSemDiaFixo` ou `getClientesSemDiaFixo`; so ficam o componente, a query e a action dormentes. `agenda-list.test.tsx` prova que a acao nao e chamada. |
| 4 | Frequencia e dia fixo visiveis/editaveis na ficha; nada apagado; visitas podem voltar | VERIFICADO | Nenhuma migration alterada; `ClienteDetailSheet`, `app/actions/clientes.ts` (so comentario) e funcoes de escrita intactos. Ao vivo: `ficha-mantem-frequencia`, `reativar-mantem-visita-guardada` e `Bloco F mover_card_funil semeia a primeira visita` verdes. 0049 sem nenhum comando de escrita. Rollback pronto. |
| 5 | O que ja foi feito continua registrado (visitas concluidas no Diario/historico) | VERIFICADO | `agenda_concluidos_do_vendedor` e o Diario nao foram tocados (nenhuma migration alterada). Ao vivo: `concluir-visita-silencioso` verde (concluir cria a proxima escondida e vai para o historico). |

**Pontuacao:** 5/5 verdades verificadas. 0 itens "presente mas comportamento nao provado": o comportamento de leitura foi provado contra o banco real.

## Verificacoes independentes pedidas

| # | Verificacao | Resultado |
|---|-------------|-----------|
| 1 | `git diff --name-status` em `supabase/migrations` desde a base | Uma unica linha: `A supabase/migrations/0049_agenda_atual_so_prospeccao.sql`. Nenhuma migration antiga alterada. Arquivos fora de `.planning/` alterados desde a base: exatamente 15, todos previstos nos planos. |
| 2a | 0049 mantem assinatura e 10 colunas da 0036 | Sim: `origem, item_id, cliente_id, razao_social, responsavel, responsavel_nome, titulo, data, frequencia_visita, proxima_data_sugerida`, `language sql stable`, sem sobrecarga. `diff` do bloco da funcao com a 0036 mostra so a metade de visitas removida. A 0036 e a ultima definicao anterior (0014, 0015, 0026, 0036 sao as unicas que definem a funcao). |
| 2b | 0049 so com a metade de prospeccao, sem escrita nem elevacao | `grep -i` por insert/update/delete/drop/alter/grant/revoke/security definer/truncate/mover_card_funil/concluir_visita/agenda2: zero ocorrencias. So um comentario de cabecalho e o `create or replace function`. Sem `\r`. |
| 2c | Rollback igual ao corpo da 0036 | `diff` das linhas 334-391 da 0036 contra o bloco do rollback: sem diferenca. Arquivo em `supabase/rollbacks/` (fora de `migrations`), cabecalho "NAO APLICAR". |
| 3 | Testes ao vivo e estrutural | `agenda-sem-visitas-automaticas` (6 casos de L1-L6), `encerrados-rpc`, `dia-fixo-visita`, `agenda-sem-visitas-migracao` (7 casos) e `tests/agenda2/migracao-agenda2.test.ts`: 5 arquivos, 78 testes passados, 0 ignorados. Rodados por mim neste ciclo contra o banco real. Casos ao vivo sem `console.log`. |
| 4 | Funcoes de escrita, `components/agenda2`, `lib/agenda2` intactos | Nenhuma migration antiga alterada (inclui as que definem `mover_card_funil` e `concluir_visita`: 0002, 0013, 0015, 0018, 0022, 0025, 0026, 0036). `git diff --name-only` desde a base para `components/agenda2`, `lib/agenda2`, `tests/agenda2`, `AgendaSemDiaFixo.tsx`, `lib/supabase/queries/agenda.ts`, `app/actions/agenda.ts`, `lib/agenda/itens.ts`, `sem-dia-fixo.test.tsx`, `frequencia-visita.test.ts`: vazio. |
| 5 | AgendaList sem a secao; dormentes sem edicao | Confirmado (ver verdade 3). Os cinco arquivos dormentes aparecem sem alteracao no diff. |
| 6 | Textos falsos corrigidos | Vazio da Agenda agora diz "Nenhuma tarefa de prospeccao pendente no momento."; `AtivoImportSummary` manda definir a frequencia na ficha; vazio de `/clientes` nao promete mais ganhos na Agenda. `app/actions/clientes.ts` e `lib/importacao/typesAtivo.ts`: so comentarios. Busca textual por promessas restantes nao achou nenhuma em texto de tela. |

Outras verificacoes: `npx tsc --noEmit` sem erros; sem marcadores TBD/FIXME/XXX nos arquivos alterados; nenhuma linha real do banco foi impressa por mim.

## Artefatos Necessarios

| Artefato | Esperado | Status | Detalhes |
|----------|----------|--------|----------|
| `supabase/migrations/0049_agenda_atual_so_prospeccao.sql` | funcao so com prospeccao | VERIFICADO | Substantivo, aplicado (provado ao vivo) |
| `supabase/rollbacks/0049_volta_agenda_do_vendedor.sql` | volta atras nao aplicada | VERIFICADO | Igual a 0036, fora de `migrations` |
| `tests/agenda/agenda-sem-visitas-migracao.test.ts` | prova estrutural | VERIFICADO | 7 casos verdes |
| `tests/agenda/agenda-sem-visitas-automaticas.test.ts` | prova ao vivo L1-L6 | VERIFICADO | 6 casos verdes |
| `components/agenda/AgendaList.tsx` | sem segunda leitura nem secao | VERIFICADO | Fiacao removida, `getAgendaAction` segue unica leitura |

## Key Links

| De | Para | Via | Status |
|----|------|-----|--------|
| 0049 | `getAgenda` / `getAgendaPendentesCount` | mesma RPC `agenda_do_vendedor` | LIGADO (contador e Lista caem juntos, teste ao vivo) |
| `AgendaList` | `getAgendaAction` | unica leitura da tela | LIGADO |
| `AgendaList` | `AgendaSemDiaFixo` | nenhuma importacao (dormente) | DESLIGADO de proposito (D-32) |

## Cobertura de Requisitos

| Requisito | Plano | Descricao | Status | Evidencia |
|-----------|-------|-----------|--------|-----------|
| AGD-16 | 33-01, 33-02, 33-03, 33-04 (todos declaram) | Cliente ganho deixa de entrar automaticamente na Agenda atual; campos continuam no cadastro; prospeccao inalterada | SATISFEITO | Verdades 1-5. `REQUIREMENTS.md` marca `[x]` e "Phase 33 / Complete". Sem requisitos orfaos: so o AGD-16 aponta para a Fase 33. |

## Anti-Patterns

Nenhum encontrado nos 15 arquivos alterados (sem TBD/FIXME/XXX, sem stubs; a remocao em `AgendaList` e intencional e documentada em comentario).

## Avisos (nao bloqueiam)

- `tests/clientes/frequencia-visita.test.ts` (oraculo da trava de ganho, D-35) falha hoje com "Invalid login credentials" para as contas semente (apagadas em 2026-08-19). O arquivo nao foi tocado pela fase e a falha nao depende do codigo. A mesma trava e coberta pelo caso `ganho-sem-frequencia-continua-bloqueado` em `encerrados-rpc`, que passou. O mesmo vale para `agenda-rpc` e `concluir-rpc`, editados no 33-02 mas nao executaveis sem as contas semente.
- Estado de implantacao: `origin/staging` (`c78c937`) ja tem a tela dos planos 33-01 a 33-03; `origin/master` (`2cc912b`) ainda nao recebeu a fase. O banco ja esta com a 0049 (compartilhado). Pelo Fluxo de Deploy do CLAUDE.md, a conferencia do Preview vem antes de enviar para `master`.
- Pendencias do dono registradas no 33-04-SUMMARY: prazo de guarda das visitas escondidas (LGPD), texto de apoio do dia fixo na ficha, limpeza do conjunto dormente se a Agenda 2 ficar, decisao sobre contas semente. Nenhuma coleta de dado novo nesta fase.

## Verificacao Humana Necessaria

O dono pode dispensar estes dois itens; a prova automatica contra o banco real ja cobre os mesmos criterios.

### 1. Agenda no Preview como Vendedor

**Teste:** abrir o Preview da Vercel da `staging`, entrar como Vendedor, ver Lista e Calendario em Mes.
**Esperado:** sem itens "Visita" pendentes, sem a caixinha "Sem dia fixo definido", numero do menu igual ao total da Lista, visitas concluidas ainda nos dias passados.
**Por que humano:** numero do menu e aparencia so se veem no navegador.

### 2. Supervisor e ficha do cliente ativo

**Teste:** como Supervisor em "Todos os vendedores", comparar o numero do menu com a Lista; abrir a ficha de um cliente ativo; abrir a Agenda 2.
**Esperado:** numeros batem; frequencia e dia fixo visiveis e editaveis; Agenda 2 igual a antes.
**Por que humano:** conferencia visual.

## Resumo de Lacunas

Nenhuma lacuna. Nenhum item falhou.

---

_Verificado: 2026-10-04_
_Verificador: Claude (gsd-verifier)_
