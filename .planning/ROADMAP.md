# Roadmap: CRM Raiar — Acompanhamento de Vendas

## Overview

O CRM Raiar nasce de dentro para fora: primeiro a fundação de login e permissões, depois o cadastro de clientes PJ e o funil kanban, as telas de administração das listas editáveis, e o dashboard gerencial (v1.0 MVP). Em seguida, com o CRM já em uso no dia a dia, o marco v1.1 adicionou importação em massa de clientes via planilha (restrita ao Supervisor) e exportação da lista de clientes. O marco v1.2 deu ao Supervisor mais controle sobre a equipe (desativar membros), mais visibilidade sobre onde o funil trava (análises por etapa e por vendedor) e deixou os filtros de localização mais confiáveis (Estado/Cidade estruturados).

O marco atual, v1.3, abre a segunda frente do CRM: até aqui o sistema só cuidava da **prospecção** (levar o cliente até a 1ª venda). Agora ele passa a cuidar também do **pós-venda** — clientes que viraram "ganho" entram numa rotina de visitas recorrentes, e tudo o que o vendedor precisa fazer (tarefas de prospecção + visitas de pós-venda) aparece numa Agenda única, ordenada por urgência.

Detalhes completos de cada marco arquivado estão em `.planning/milestones/`.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-20)
- ✅ **v1.1 Importação e Exportação de Clientes** — Phases 5-7 (shipped 2026-07-25) — see `.planning/milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Gestão de Equipe, Análises de Funil e Filtros** — Phases 8-12 (shipped 2026-08-06) — see `.planning/milestones/v1.2-ROADMAP.md`
- 🚧 **v1.3 Agenda do Vendedor** — Phases 13-17 (planning started 2026-08-07)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-07-20</summary>

- [x] Phase 1: Autenticação e Papéis — Usuários fazem login via Supabase Auth e o sistema distingue Supervisor de Vendedor em toda a base de dados (RLS). (completed 2026-07-20)
- [x] Phase 2: Cadastro e Funil de Vendas — Vendedores e supervisores cadastram, editam e encontram clientes PJ, e movem os clientes pelas 7 etapas do funil kanban, com o mínimo de fricção possível. (completed 2026-07-17)
- [x] Phase 3: Administração de Listas Editáveis — Supervisor mantém categorias, produtos, tipos de tarefa e motivos de perda sem depender de alteração de código. (completed 2026-07-18)
- [x] Phase 4: Dashboard Gerencial — Supervisor e vendedores acompanham os números do funil, cada um na medida da própria visão. (completed 2026-07-19)

**Note:** the on-disk phase directories (`01-*` through `04-*`) for this milestone were cleared before a formal `/gsd-complete-milestone` archive ran — full SUMMARY.md history for these phases is only available in git history prior to that cleanup, not in `.planning/milestones/`. The shipped code has been in production use since; this is a documentation gap only, not a functionality gap.

</details>

<details>
<summary>✅ v1.1 Importação e Exportação de Clientes (Phases 5-7) — SHIPPED 2026-07-25</summary>

- [x] Phase 5: Exportação de Clientes — Vendedor e Supervisor baixam como planilha a lista de clientes que já enxergam na tela, respeitando papel (próprios x todos) e os filtros aplicados. (completed 2026-07-22)
- [x] Phase 6: Importação — Upload, Mapeamento e Revisão — Supervisor envia uma planilha, mapeia as colunas para os campos do sistema e revê linha a linha (OK / erro / possível duplicado) — sem gravar nada ainda. (completed 2026-07-24)
- [x] Phase 7: Importação — Confirmação e Gravação — Supervisor confirma e os clientes válidos entram de uma vez na etapa "Aguardando contato", sem uma linha ruim travar o lote. (completed 2026-07-25)

Full phase details, decisions, and tech debt: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Gestão de Equipe, Análises de Funil e Filtros (Phases 8-12) — SHIPPED 2026-08-06</summary>

- [x] Phase 8: Rolagem por Coluna no Kanban — Cada coluna do kanban ganha altura fixa e rolagem própria, evitando a página infinita quando há muitos clientes. (completed 2026-07-26)
- [x] Phase 9: Filtros de Estado e Cidade Estruturados — Estado (27 siglas) e Cidade (lista IBGE dependente do Estado) viram listas estruturadas em cadastro, edição, filtro e importação. (completed 2026-07-26)
- [x] Phase 10: Desativação de Membro da Equipe — Supervisor desativa um membro transferindo antes os clientes em andamento, com trava contra desativar o último Supervisor. (completed 2026-08-03)
- [x] Phase 11: Funil de Conversão Detalhado — Dashboard ganha o funil de conversão por etapa (negócios, avanço%, perdidos, tempo médio) e a média de dias até ganhar/perder. (completed 2026-07-28)
- [x] Phase 12: Comparativo por Vendedor — Supervisor vê uma tabela comparando os vendedores ativos (conversão, negócios iniciados/ganhos, ciclo médio). (completed 2026-08-05)

Full phase details, decisions, and tech debt: `.planning/milestones/v1.2-ROADMAP.md`

</details>

### 🚧 v1.3 Agenda do Vendedor (Phases 13-17) — IN PROGRESS

- [ ] **Phase 13: Cliente Ativo e Frequência de Visita** - Ao marcar um card como "ganho" o vendedor já define a frequência de visita, e essa frequência fica editável depois na ficha do cliente.
- [ ] **Phase 14: Agenda Unificada** - Nova tela "Agenda" no topo do menu, juntando tarefas de prospecção e visitas pendentes numa lista só, ordenada por urgência.
- [ ] **Phase 15: Conclusão com Resumo e Próxima Visita** - Concluir um item da agenda exige um resumo curto; ao concluir uma visita o sistema sugere a próxima data e o vendedor confirma ou ajusta.
- [ ] **Phase 16: Ficha do Cliente Ativo — Campos e Diário** - A ficha do cliente ganha Nome Fantasia, CNPJ, frequência de pedidos e o diário de visitas/tarefas concluídas.
- [ ] **Phase 17: Planilhas — Frequência em Massa e Exportação do Diário** - Supervisor define a frequência de visita de vários clientes de uma vez por planilha, e o diário pode ser exportado.

## Phase Details

### Phase 13: Cliente Ativo e Frequência de Visita

**Goal**: Fazer o momento "cliente virou ganho" iniciar a rotina de pós-venda — a frequência de visita é definida ali mesmo, junto com a mudança de status, e pode ser trocada ou cancelada depois sem nunca dessincronizar.
**Depends on**: Nada dentro do marco (primeira fase da v1.3) — apoia-se no funil e no `mover_card_funil` já existentes
**Requirements**: VIS-01, VIS-02, VIS-04, ATV-03
**Success Criteria** (what must be TRUE):

  1. Ao mover um card para "ganho", o sistema pede a frequência de visita (semanal / quinzenal / mensal / nenhuma) antes de aceitar a mudança — do mesmo jeito que já exige o motivo quando o card é marcado como perdido.
  2. Escolhida uma frequência diferente de "nenhuma", a primeira visita já nasce agendada para aquele cliente; com "nenhuma", nenhuma visita é criada.
  3. A frequência de visita pode ser trocada ou cancelada a qualquer momento na ficha do cliente, e existe um valor só — mexer nele pela ficha ou pela agenda leva sempre ao mesmo lugar, nunca a dois números diferentes.
  4. Clientes que já estavam "ganho" antes desta versão aparecem sem frequência definida, e continuam funcionando normalmente até alguém definir uma — o sistema não supõe nenhuma cadência por conta própria.

**Plans**: TBD
**UI hint**: yes

**Notas para o planejamento** (da research, `.planning/research/ARCHITECTURE.md`):

- É a fase de fundação de dados do marco: colunas novas em `clientes` (`nome_fantasia`, `cnpj`, `frequencia_pedidos`, `frequencia_visita`), tabela nova `visitas` (irmã de `tarefas`, RLS espelhando o mesmo padrão de gate pelo pai `clientes`), e `mover_card_funil` estendido com `p_frequencia_visita` obrigatório quando `p_novo_status = 'ganho'`.
- Colunas novas entram como **nullable** — um `NOT NULL`/`CHECK` cego quebraria a migration contra as linhas "ganho" que já existem em produção (Pitfall 3). A exigência é imposta no guard do RPC, não no schema.
- "Ativo" já foi resolvido no Discuss com o dono do projeto: é sinônimo de `status_acompanhamento = 'ganho'`. Não reabrir.
- `frequencia_visita` é um valor só, guardado uma vez em `clientes` — ATV-03 e VIS-01/VIS-02 são a mesma coluna vista de dois lugares.

### Phase 14: Agenda Unificada

**Goal**: Dar ao vendedor uma tela única que responde "o que eu preciso fazer hoje?", juntando as duas frentes (prospecção e pós-venda) numa lista só ordenada por urgência.
**Depends on**: Fase 13 (a tabela `visitas` precisa existir para a agenda ter o que unir)
**Requirements**: AGD-01, AGD-02, AGD-03, AGD-04, AGD-05, AGD-06

**Success Criteria** (what must be TRUE):

  1. Um item "Agenda" aparece no topo do menu principal, acima de "Clientes", mostrando a contagem de itens pendentes (ex.: "Agenda (5)").
  2. A Agenda mostra tarefas de prospecção e visitas de pós-venda numa lista só, ordenada atrasado → hoje → próximos dias, com cada item identificado pelo cliente e pela origem (prospecção ou visita).
  3. Itens atrasados ficam destacados visualmente, no mesmo padrão já usado para os cards parados/atrasados do kanban.
  4. Vendedor vê só a própria agenda; Supervisor vê a agenda de todo o time e consegue filtrar por vendedor.

**Plans**: TBD
**UI hint**: yes

**Notas para o planejamento** (da research):

- Fase de leitura pura — nenhuma escrita nova. A agenda é uma RPC nova `agenda_do_vendedor()`, `language sql stable`, **SECURITY INVOKER por omissão** (`UNION ALL` de `tarefas` pendentes + `visitas` pendentes, com uma coluna `origem` discriminando as duas), seguindo exatamente o precedente de `dashboard_funil_detalhado` / `dashboard_comparativo_vendedor`.
- AGD-04 (vendedor vê o próprio, supervisor vê tudo) sai de graça do RLS das tabelas de base — não escrever nenhuma checagem de papel dentro da função (Anti-Pattern do `ARCHITECTURE.md`).
- Não montar a lista com duas queries do `supabase-js` e um merge no cliente: duplica a lógica de ordenação/atraso e gasta dois round trips (Pitfall 5).

### Phase 15: Conclusão com Resumo e Próxima Visita

**Goal**: Fechar o ciclo da agenda — concluir um item sempre deixa um registro do que aconteceu, e concluir uma visita já engatilha a próxima com a data confirmada pelo vendedor.
**Depends on**: Fase 13 (tabela `visitas` e a frequência) e Fase 14 (a conclusão é disparada de dentro da Agenda)
**Requirements**: CONC-01, VIS-03

**Success Criteria** (what must be TRUE):

  1. Ao concluir uma tarefa de prospecção ou uma visita, o vendedor precisa escrever um resumo curto (1-2 frases) antes de a conclusão ser aceita — sem resumo, o sistema não conclui.
  2. Ao concluir uma visita, o sistema já mostra uma sugestão de próxima data calculada a partir da frequência do cliente; o vendedor confirma ou muda a data antes de gravar — nada é agendado em silêncio.
  3. Depois de confirmar, o item concluído sai da lista de pendentes e a próxima visita aparece na Agenda com a data confirmada.
  4. Cliente com frequência "nenhuma" conclui a visita normalmente e nenhuma próxima visita é criada.
  5. O resumo escrito na conclusão fica gravado no histórico daquele cliente, com data e autor.

**Plans**: TBD
**UI hint**: yes

**Notas para o planejamento** (da research — **fase de maior risco do marco**):

- **Pitfall 1 (mais alto risco novo do codebase):** este é o primeiro cálculo de data feito no servidor neste projeto. A sugestão de próxima data deve ser calculada no Postgres (`data + interval '1 month'` etc.), com a data guardada como `date` puro (nunca `timestamptz`); no cliente, se precisar pré-visualizar, usar `parseISO` do `date-fns`, **nunca** `new Date(stringDaData)` — isso reintroduz o bug de meia-noite-UTC e mostra o dia anterior no fuso de São Paulo. Teste obrigatório: `mensal` a partir de 31/jan tem que cair em 28/fev (e 29/fev em ano bissexto).
- **Pitfall 2:** concluir uma visita é uma escrita em 3 tabelas (fechar a visita atual + gravar o `historico` + criar a próxima visita). Tem que ser **uma RPC atômica** `SECURITY INVOKER` (padrão `mover_card_funil`), nunca três chamadas seguidas do cliente.
- O `resumo` entra como coluna nova nullable direto em `tarefas`/`visitas`, e chega no `historico` pelo **trigger** `SECURITY DEFINER` que já existe (recriado via `create or replace` num arquivo de migration novo). Não criar uma 4ª RPC `SECURITY DEFINER`, e **jamais** abrir uma policy de INSERT em `historico` — se isso aparecer num diff, é sinal de parar e revisar.
- Limite do resumo: texto curto, ~280-500 caracteres (decisão do dono do projeto), obrigatório.
- Um só componente de diálogo de conclusão, parametrizado pela origem, atende as duas frentes.

### Phase 16: Ficha do Cliente Ativo — Campos e Diário

**Goal**: Fazer a ficha do cliente refletir a vida dele depois da venda — os dados que só passam a fazer sentido quando ele vira ativo, e o diário do que já foi feito com ele.
**Depends on**: Fase 13 (as colunas novas de cliente) e Fase 15 (os resumos de conclusão que alimentam o diário)
**Requirements**: ATV-01, ATV-02, DIAR-01

**Success Criteria** (what must be TRUE):

  1. Cliente com status "ganho" aceita e exibe Nome Fantasia e CNPJ na ficha, e o cadastro rápido de um cliente novo continua sem pedir nenhum dos dois.
  2. Cliente com status "ganho" aceita uma frequência de pedidos, apresentada como informação de apoio — sem gerar alerta, cobrança ou item de agenda.
  3. A ficha do cliente mostra um diário das visitas e tarefas já concluídas, cada entrada com resumo, data e autor, da mais recente para a mais antiga.
  4. Vendedor vê o diário só dos próprios clientes; Supervisor vê o de qualquer cliente do time.

**Plans**: TBD
**UI hint**: yes

**Notas para o planejamento** (da research):

- Fase concentrada no `ClienteDetailSheet.tsx` (campos condicionais + seção nova de diário). Os campos novos não exigem migration nova — as colunas vêm da Fase 13.
- `frequencia_pedidos` é puramente informativo (ATV-02): não vira visita, não vira alerta, não entra na Agenda.
- Débito conhecido nesse arquivo: existe um `eslint-disable` documentado em `ClienteDetailSheet.tsx` (~linha 227) no efeito de reset — não piorar; se der para resolver junto, ótimo, mas não é escopo obrigatório desta fase.

### Phase 17: Planilhas — Frequência em Massa e Exportação do Diário

**Goal**: Resolver o gargalo de escala do marco — não obrigar o Supervisor a abrir cliente por cliente para definir cadência, e permitir levar o diário para fora do sistema.
**Depends on**: Fase 13 (coluna `frequencia_visita`) e Fase 15 (os registros de conclusão que a exportação leva)
**Requirements**: IMP-01, IMP-02

**Success Criteria** (what must be TRUE):

  1. Supervisor envia uma planilha e define a frequência de visita de vários clientes "ganho" de uma vez, percorrendo o mesmo fluxo já conhecido da importação de clientes (enviar → mapear colunas → revisar → confirmar).
  2. Na revisão, cada linha mostra se o cliente foi encontrado e se está apto (status "ganho"), e as linhas problemáticas ficam sinalizadas antes de qualquer gravação.
  3. Ao confirmar, só a frequência de visita de clientes que já existem é alterada — nenhum cliente novo é criado por esse fluxo.
  4. Uma linha ruim não trava o lote: as linhas válidas são gravadas mesmo assim, e o resumo final diz quantas entraram e quantas foram puladas.
  5. Vendedor e Supervisor exportam o histórico de visitas/tarefas concluídas como planilha, respeitando a mesma regra de visibilidade da exportação de clientes (próprios x todos).

**Plans**: TBD
**UI hint**: yes

**Notas para o planejamento** (da research):

- IMP-01 **reaproveita o padrão de tela** da importação da v1.1 (enviar → mapear → revisar → confirmar), mas é um fluxo materialmente diferente do `importar_clientes_lote`: ele **atualiza um campo de clientes existentes**, não cria clientes. RPC nova, própria, com guard explícito de `is_supervisor()` (mesmo padrão não-`SECURITY DEFINER` do `importar_clientes_lote`).
- A regra "uma linha ruim nunca trava o lote" e a gravação set-based (não loop linha a linha, por causa do limite de ~10s do Vercel Hobby) valem igual aqui.
- IMP-02 reaproveita o caminho de exportação da Fase 5 (`getClientesParaExportacao` / rota de exportação), apenas com outra consulta de origem — cuidado com CSV injection nos resumos de texto livre, o mesmo risco já tratado na exportação de clientes (Pitfall A4 da v1.1).

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|-----------------|--------|-----------|
| 1. Autenticação e Papéis | v1.0 | 5/5 | Complete | 2026-07-20 |
| 2. Cadastro e Funil de Vendas | v1.0 | 7/7 | Complete | 2026-07-17 |
| 3. Administração de Listas Editáveis | v1.0 | — | Complete | 2026-07-18 |
| 4. Dashboard Gerencial | v1.0 | — | Complete | 2026-07-19 |
| 5. Exportação de Clientes | v1.1 | 2/2 | Complete | 2026-07-22 |
| 6. Importação — Upload, Mapeamento e Revisão | v1.1 | 4/4 | Complete | 2026-07-24 |
| 7. Importação — Confirmação e Gravação | v1.1 | 3/3 | Complete | 2026-07-25 |
| 8. Rolagem por Coluna no Kanban | v1.2 | 1/1 | Complete | 2026-07-26 |
| 9. Filtros de Estado e Cidade Estruturados | v1.2 | 6/6 | Complete | 2026-07-26 |
| 10. Desativação de Membro da Equipe | v1.2 | 6/6 | Complete | 2026-08-03 |
| 11. Funil de Conversão Detalhado | v1.2 | 5/5 | Complete | 2026-07-28 |
| 12. Comparativo por Vendedor | v1.2 | 4/4 | Complete | 2026-08-05 |
| 13. Cliente Ativo e Frequência de Visita | v1.3 | 0/? | Not started | - |
| 14. Agenda Unificada | v1.3 | 0/? | Not started | - |
| 15. Conclusão com Resumo e Próxima Visita | v1.3 | 0/? | Not started | - |
| 16. Ficha do Cliente Ativo — Campos e Diário | v1.3 | 0/? | Not started | - |
| 17. Planilhas — Frequência em Massa e Exportação do Diário | v1.3 | 0/? | Not started | - |
