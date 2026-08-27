# Roadmap: CRM Raiar — Acompanhamento de Vendas

## Overview

O CRM Raiar nasce de dentro para fora: primeiro a fundação de login e permissões, depois o cadastro de clientes PJ e o funil kanban, as telas de administração das listas editáveis, e o dashboard gerencial (v1.0 MVP). Em seguida, com o CRM já em uso no dia a dia, o marco v1.1 adicionou importação em massa de clientes via planilha (restrita ao Supervisor) e exportação da lista de clientes. O marco v1.2 deu ao Supervisor mais controle sobre a equipe (desativar membros), mais visibilidade sobre onde o funil trava (análises por etapa e por vendedor) e deixou os filtros de localização mais confiáveis (Estado/Cidade estruturados). O marco v1.3 abriu a segunda frente do CRM: além da prospecção (levar o cliente até a 1ª venda), o sistema passou a cuidar também do pós-venda — clientes "ganho" entram numa rotina de visitas recorrentes, com uma Agenda única unificando tarefas de prospecção e visitas, conclusão com resumo e diário do cliente, e planilhas para operar em escala. O marco v1.4 fechou uma lacuna de dados desse pós-venda: CNPJ passou a ser exigido no momento em que um cliente vira "ganho" — travado no banco, não só na tela — com grandfathering dos clientes antigos e planilhas de regularização em massa.

O marco v1.5 deu à Agenda uma segunda forma de visualização — um calendário de dia/semana/mês, navegável, mostrando também o que já foi concluído em datas passadas — ao lado da lista original, e passou a aceitar que a conclusão de um item não pressuponha visita presencial, com um motivo categorizado numa 6ª lista editável pelo Supervisor.

O marco v1.6 separou as duas portas de importação em massa que conviviam numa só: uma nova planilha "Importar Clientes Ativos" cria clientes já em status "ganho" exigindo todos os dados (menos a frequência de visita), enquanto "Importar clientes" foi renomeada para "Importar Clientes em Prospecção" e passou a exigir só Nome Fantasia + Responsável. A trava de "ganho" cresceu para também exigir razão social e endereço completo (grandfathering dos clientes antigos, mesmo padrão do CNPJ na v1.4), as duas planilhas avulsas "Importar CNPJ" e "Importar frequências" saíram do menu por terem ficado redundantes, e a recorrência de visita ganhou um dia fixo (dia da semana para semanal/quinzenal, semana do mês para mensal) — com a Agenda lembrando o vendedor de definir esse dia fixo para quem ainda não tem.

Detalhes completos de cada marco arquivado estão em `.planning/milestones/`.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-20)
- ✅ **v1.1 Importação e Exportação de Clientes** — Phases 5-7 (shipped 2026-07-25) — see `.planning/milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Gestão de Equipe, Análises de Funil e Filtros** — Phases 8-12 (shipped 2026-08-06) — see `.planning/milestones/v1.2-ROADMAP.md`
- ✅ **v1.3 Agenda do Vendedor** — Phases 13-17 (shipped 2026-08-10) — see `.planning/milestones/v1.3-ROADMAP.md`
- ✅ **v1.4 CNPJ Obrigatório no Ganho** — Phases 18-19 (shipped 2026-08-14) — see `.planning/milestones/v1.4-ROADMAP.md`
- ✅ **v1.5 Calendário na Agenda e Conclusão Remota** — Phases 20-22 (shipped 2026-08-19) — see `.planning/milestones/v1.5-ROADMAP.md`
- ✅ **v1.6 Importação de Clientes Ativos e Prospecção Separadas** — Phases 23-26 (shipped 2026-08-27) — see `.planning/milestones/v1.6-ROADMAP.md`

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

<details>
<summary>✅ v1.3 Agenda do Vendedor (Phases 13-17) — SHIPPED 2026-08-10</summary>

- [x] Phase 13: Cliente Ativo e Frequência de Visita — Ao marcar um card como "ganho" o vendedor já define a frequência de visita, e essa frequência fica editável depois na ficha do cliente. (completed 2026-08-07)
- [x] Phase 14: Agenda Unificada — Nova tela "Agenda" no topo do menu, juntando tarefas de prospecção e visitas pendentes numa lista só, ordenada por urgência. (completed 2026-08-08)
- [x] Phase 15: Conclusão com Resumo e Próxima Visita — Concluir um item da agenda exige um resumo curto; ao concluir uma visita o sistema sugere a próxima data e o vendedor confirma ou ajusta. (completed 2026-08-09)
- [x] Phase 16: Ficha do Cliente Ativo — Campos e Diário — A ficha do cliente ganha Nome Fantasia, CNPJ, frequência de pedidos e o diário de visitas/tarefas concluídas. (completed 2026-08-09)
- [x] Phase 17: Planilhas — Frequência em Massa e Exportação do Diário — Supervisor define a frequência de visita de vários clientes de uma vez por planilha, e o diário pode ser exportado. (completed 2026-08-10)

Full phase details, decisions, and tech debt: `.planning/milestones/v1.3-ROADMAP.md`

</details>

<details>
<summary>✅ v1.4 CNPJ Obrigatório no Ganho (Phases 18-19) — SHIPPED 2026-08-14</summary>

- [x] Phase 18: CNPJ Obrigatório no Ganho — Ao mover um card para "ganho" o sistema passa a exigir CNPJ preenchido, travado no RPC `mover_card_funil` — clientes já "ganho" sem CNPJ continuam funcionando normalmente. (completed 2026-08-11)
- [x] Phase 19: Planilhas de CNPJ e Nome Fantasia — A planilha "Importar clientes" ganha CNPJ e Nome Fantasia como colunas opcionais, e uma nova planilha "CNPJ em massa" regulariza em lote os clientes já "ganho" sem CNPJ. (completed 2026-08-14)

Full phase details, decisions, and tech debt: `.planning/milestones/v1.4-ROADMAP.md`

</details>

<details>
<summary>✅ v1.5 Calendário na Agenda e Conclusão Remota (Phases 20-22) — SHIPPED 2026-08-19</summary>

- [x] Phase 20: Calendário da Agenda — Mês, Semana e Dia — A tela da Agenda ganha um segundo modo de visualização: um calendário de dia/semana/mês sobre os mesmos itens da Lista, com navegação de data, botão "Hoje" e o mesmo filtro por vendedor. (completed 2026-08-18)
- [x] Phase 21: Calendário — O Que Já Foi Feito em Datas Passadas — Navegar para uma data passada no calendário passa a mostrar também os itens já concluídos naquele dia, não só o que ficou pendente. (completed 2026-08-19)
- [x] Phase 22: Conclusão Remota com Motivo — Concluir um item da Agenda deixa de pressupor visita presencial: o vendedor marca "não foi presencial", escolhe um motivo de uma 6ª lista editável pelo Supervisor, e a conclusão segue valendo como conclusão normal. (completed 2026-08-19)

Full phase details, decisions, and tech debt: `.planning/milestones/v1.5-ROADMAP.md`

</details>

<details>
<summary>✅ v1.6 Importação de Clientes Ativos e Prospecção Separadas (Phases 23-26) — SHIPPED 2026-08-27</summary>

- [x] Phase 23: Razão Social Opcional e Trava do Ganho Ampliada — `razao_social` vira opcional no banco e a trava de "ganho" cresce para também exigir razão social + endereço completo, com grandfathering dos clientes antigos. (completed 2026-08-26)
- [x] Phase 24: Dia Fixo na Recorrência de Visita — Definir frequência semanal/quinzenal/mensal de um cliente ativo passa a incluir um dia fixo, a próxima visita sugerida mira esse dia, e a Agenda lembra o vendedor de quem ainda não o definiu. (completed 2026-08-26)
- [x] Phase 25: Importação de Clientes Ativos — Nova planilha "Importar Clientes Ativos" cria clientes já em status "ganho", exigindo todos os dados (menos frequência de visita), com revisão linha a linha e detecção de duplicado. (completed 2026-08-27)
- [x] Phase 26: Importação de Clientes em Prospecção e Limpeza de Menu — "Importar clientes" é renomeada e relaxada para "Importar Clientes em Prospecção" (só Nome Fantasia + Responsável obrigatórios), e as planilhas avulsas "Importar CNPJ"/"Importar frequências" saem do menu. (completed 2026-08-27)

Full phase details, decisions, and tech debt: `.planning/milestones/v1.6-ROADMAP.md`

</details>

## Next Milestone

Planejamento ainda não iniciado — rode `/gsd-new-milestone` para começar.
