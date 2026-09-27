# Roadmap: CRM Raiar — Acompanhamento de Vendas

## Overview

O CRM Raiar nasce de dentro para fora: primeiro a fundação de login e permissões, depois o cadastro de clientes PJ e o funil kanban, as telas de administração das listas editáveis, e o dashboard gerencial (v1.0 MVP). Em seguida, com o CRM já em uso no dia a dia, o marco v1.1 adicionou importação em massa de clientes via planilha (restrita ao Supervisor) e exportação da lista de clientes. O marco v1.2 deu ao Supervisor mais controle sobre a equipe (desativar membros), mais visibilidade sobre onde o funil trava (análises por etapa e por vendedor) e deixou os filtros de localização mais confiáveis (Estado/Cidade estruturados). O marco v1.3 abriu a segunda frente do CRM: além da prospecção (levar o cliente até a 1ª venda), o sistema passou a cuidar também do pós-venda — clientes "ganho" entram numa rotina de visitas recorrentes, com uma Agenda única unificando tarefas de prospecção e visitas, conclusão com resumo e diário do cliente, e planilhas para operar em escala. O marco v1.4 fechou uma lacuna de dados desse pós-venda: CNPJ passou a ser exigido no momento em que um cliente vira "ganho" — travado no banco, não só na tela — com grandfathering dos clientes antigos e planilhas de regularização em massa.

O marco v1.5 deu à Agenda uma segunda forma de visualização — um calendário de dia/semana/mês, navegável, mostrando também o que já foi concluído em datas passadas — ao lado da lista original, e passou a aceitar que a conclusão de um item não pressuponha visita presencial, com um motivo categorizado numa 6ª lista editável pelo Supervisor.

O marco v1.6 separou as duas portas de importação em massa que conviviam numa só: uma nova planilha "Importar Clientes Ativos" cria clientes já em status "ganho" exigindo todos os dados (menos a frequência de visita), enquanto "Importar clientes" foi renomeada para "Importar Clientes em Prospecção" e passou a exigir só Nome Fantasia + Responsável. A trava de "ganho" cresceu para também exigir razão social e endereço completo (grandfathering dos clientes antigos, mesmo padrão do CNPJ na v1.4), as duas planilhas avulsas "Importar CNPJ" e "Importar frequências" saíram do menu por terem ficado redundantes, e a recorrência de visita ganhou um dia fixo (dia da semana para semanal/quinzenal, semana do mês para mensal) — com a Agenda lembrando o vendedor de definir esse dia fixo para quem ainda não tem.

O marco atual, v1.7, nasce do primeiro uso real do sistema pelo time de vendas: corrige dois defeitos de tela que o time encontrou (card do Kanban comprimido ao filtrar por vendedor, e nome errado na seção "Sem dia fixo definido" da Agenda), fecha as duas pontas soltas do ciclo de vida do cliente — cliente "perdido" sai do funil e ganha uma tela própria com reabertura de um toque, e cliente ativo que parou de comprar pode ser encerrado (com motivo) e reativado depois — e dá ao Supervisor uma medida de aderência de uso por vendedor no Dashboard, guardando o mínimo possível sobre cada pessoa.

Detalhes completos de cada marco arquivado estão em `.planning/milestones/`.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-20)
- ✅ **v1.1 Importação e Exportação de Clientes** — Phases 5-7 (shipped 2026-07-25) — see `.planning/milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Gestão de Equipe, Análises de Funil e Filtros** — Phases 8-12 (shipped 2026-08-06) — see `.planning/milestones/v1.2-ROADMAP.md`
- ✅ **v1.3 Agenda do Vendedor** — Phases 13-17 (shipped 2026-08-10) — see `.planning/milestones/v1.3-ROADMAP.md`
- ✅ **v1.4 CNPJ Obrigatório no Ganho** — Phases 18-19 (shipped 2026-08-14) — see `.planning/milestones/v1.4-ROADMAP.md`
- ✅ **v1.5 Calendário na Agenda e Conclusão Remota** — Phases 20-22 (shipped 2026-08-19) — see `.planning/milestones/v1.5-ROADMAP.md`
- ✅ **v1.6 Importação de Clientes Ativos e Prospecção Separadas** — Phases 23-26 (shipped 2026-08-27) — see `.planning/milestones/v1.6-ROADMAP.md`
- 🚧 **v1.7 Ajustes Pós-Teste com o Time de Vendas** — Phases 27-30 (planning started 2026-09-25)

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

### 🚧 v1.7 Ajustes Pós-Teste com o Time de Vendas (Phases 27-30) — IN PROGRESS

**Milestone Goal:** Corrigir problemas reais encontrados no primeiro uso do sistema pelo time de vendas, fechar uma lacuna do ciclo de vida do cliente (perdidos e ativos que encerram), e dar ao Supervisor uma forma de medir se o time está usando a ferramenta como deveria.

- [ ] **Phase 27: Correções do Primeiro Uso — Card Filtrado e Agenda** - O card do Kanban fica idêntico com ou sem filtro de vendedor, e a seção "Sem dia fixo definido" da Agenda passa a mostrar o nome do cliente junto do vendedor.
- [x] **Phase 28: Relatório de Perdidos** - Cliente "Perdido" sai das 7 colunas do funil e ganha uma tela própria (motivo, data, vendedor), com filtro por período, visibilidade por papel e botão "Reabrir" de um toque. (completed 2026-09-26)
- [x] **Phase 29: Encerrar Cliente Ativo** - Vendedor encerra um cliente ativo que parou de comprar (com motivo obrigatório), o cliente sai da rotina da Agenda mantendo histórico e diário, e pode ser reativado depois. (completed 2026-09-27)
- [ ] **Phase 30: Aderência de Uso no Dashboard** - Supervisor vê, na tabela comparativa por vendedor, o % de dias úteis com uso real do sistema nas últimas 4 semanas, com o registro de uso guardando só o mínimo sobre cada pessoa.

## Phase Details

### Phase 27: Correções do Primeiro Uso — Card Filtrado e Agenda

**Goal**: Os dois defeitos de tela que o time de vendas encontrou no primeiro uso deixam de acontecer — o card do Kanban mostra as mesmas informações com ou sem filtro de vendedor, e a seção "Sem dia fixo definido" da Agenda deixa claro de qual cliente cada linha fala.
**Depends on**: Nada dentro do marco. As duas correções são pequenas, isoladas e sem arquivo em comum entre si nem com as Fases 28-30 — ordenadas primeiro porque o time já esbarra nelas no uso diário e não dependem de nada novo.
**Requirements**: KAN-03, AGD-15
**Success Criteria** (what must be TRUE):

  1. Com o filtro de vendedor ligado no Kanban, cada card mostra categoria, vendedor, cidade/estado e os ícones, exatamente como o mesmo card aparece sem filtro.
  2. Nomes de cliente no card filtrado não ficam cortados — o card tem a mesma largura e quebra de linha do card sem filtro.
  3. O card sem filtro continua exatamente como está hoje, e no card filtrado as setas de voltar/avançar etapa continuam funcionando (nenhuma regressão do que a quick task 260921-n0a entregou).
  4. Na seção "Sem dia fixo definido" da Agenda, cada linha mostra o nome do cliente junto do nome do vendedor responsável — inclusive para cliente sem razão social, que aparece pelo Nome Fantasia (mesma regra de nome exibido já usada no card e na ficha).

**Plans**: 3 plans

Plans:

- [ ] 27-01-PLAN.md — AGD-15: nome_fantasia da consulta até a linha "Sem dia fixo definido", título via nomeExibicaoCliente() (onda 1, autônomo)
- [ ] 27-02-PLAN.md — KAN-03: diagnóstico ao vivo pelo dono do projeto (checkpoint bloqueante) e registro do resultado, sem mudar código (onda 1)
- [ ] 27-03-PLAN.md — KAN-03: correção condicional ao diagnóstico — div simples no StaticClienteCard + teste de paridade + guarda das setas (onda 2, depende do 27-02)

**UI hint**: yes

### Phase 28: Relatório de Perdidos

**Goal**: Cliente perdido para de ocupar espaço no funil de prospecção e passa a ter uma tela própria, onde cada vendedor vê os seus perdidos (o Supervisor vê os de todos), filtra por período e reabre com um toque o cliente que voltou a ter chance.
**Depends on**: Nada tecnicamente dentro do marco (independente da Fase 27). Espelha a regra "ganho sai do Kanban" já em produção (quick task 260915-ls7): a regra única de `lib/funil/prospeccao.ts` passa de um status só ("ganho") para um conjunto ("ganho" + "perdido"), e a mesma armadilha de exportação que a 260915-ls7 resolveu com `escopoTudo` precisa ser respeitada aqui.
**Requirements**: PERD-01, PERD-02, PERD-03, PERD-04, PERD-05
**Success Criteria** (what must be TRUE):

  1. Ao marcar um cliente como "Perdido" (com motivo, como já acontece hoje), o card some das 7 colunas do Kanban — e "Exportar todos" continua trazendo os clientes perdidos na planilha, sem a contagem cair em silêncio.
  2. Vendedor e Supervisor abrem uma tela "Perdidos" pelo menu e veem, para cada cliente perdido, o nome do cliente, o motivo da perda, a data em que foi marcado como perdido e o vendedor responsável — sem expor dados de contato da pessoa do cliente (esses continuam só na ficha).
  3. Vendedor vê na tela de Perdidos só os próprios clientes; Supervisor vê os de todo o time — e um vendedor não consegue ver perdidos de outro vendedor nem acessando os dados diretamente (regra garantida pelo RLS, não só pela tela).
  4. Ao escolher um período, a lista mostra só os clientes marcados como perdidos dentro dele.
  5. Um toque em "Reabrir" numa linha tira o cliente da lista de Perdidos e o devolve ao Kanban com status "Em andamento", e a reabertura fica registrada no histórico do cliente.

**Notas para o Discuss**: (a) em qual etapa do funil o cliente reaberto reaparece — a mesma em que foi perdido, ou "Aguardando contato"; (b) o que acontece ao reabrir um perdido cujo vendedor responsável foi desativado (a regra da v1.2 deixa perdidos com o vendedor desativado — reabrir criaria um cliente "em andamento" sem dono ativo); (c) de onde vem a "data em que foi marcado como perdido" (o `historico` já registra a troca de status com data — confirmar se basta ou se vale uma coluna própria).
**Plans**: 4/4 plans complete

Plans:

- [x] 28-01-PLAN.md — PERD-02..05 (banco): migration 0034 com a leitura `clientes_perdidos` (invoker, data da perda pelo histórico, 7 colunas sem contato) + 11 testes de integração + aprovação do dono antes do `db push` (onda 1, checkpoint bloqueante)
- [x] 28-02-PLAN.md — PERD-01: `lib/funil/prospeccao.ts` vira conjunto ganho+perdido, Kanban usa o filtro de lista, prova ao vivo da sintaxe, guarda de regressão da exportação (D-07) e texto de Kanban vazio (onda 1, autônomo)
- [x] 28-03-PLAN.md — camada de dados da tela: regras puras de período/busca, leitor paginado e Server Action com validação (onda 2, depende do 28-01)
- [x] 28-04-PLAN.md — tela `/perdidos`, linha com Reabrir de um toque via `marcarStatus`, filtro de período, busca e item "Perdidos" no menu sem contador (onda 3, depende de 28-02 e 28-03)

**UI hint**: yes

### Phase 29: Encerrar Cliente Ativo

**Goal**: Cliente ativo que parou de comprar pode ser encerrado pelo próprio vendedor, com motivo, e sai da rotina da Agenda sem perder nada do histórico — e pode ser reativado depois, voltando à rotina normal de visitas.
**Depends on**: Fase 28 (dependência leve, de padrão e de sequência): mesmo formato de mudança — um status que tira o cliente de uma visão de rotina, uma lista própria onde ele continua achável, e um caminho de volta. A Fase 28 muda a regra única de "fora da prospecção" (`lib/funil/prospeccao.ts`) e as mesmas travas de status em `clientes`/`mover_card_funil`; fazer as duas em sequência evita duas fases mexendo na mesma regra de status ao mesmo tempo, e a tela de Perdidos vira o modelo natural de onde os encerrados são encontrados para reativação.
**Requirements**: ENCR-01, ENCR-02, ENCR-03, ENCR-04, ENCR-05
**Success Criteria** (what must be TRUE):

  1. Vendedor encerra um dos próprios clientes ativos pela ficha, sem precisar do Supervisor, e o sistema não deixa concluir o encerramento sem um motivo — um vendedor nunca consegue encerrar cliente de outro vendedor.
  2. Cliente encerrado some da rotina da Agenda — Lista, Calendário (itens pendentes), seção "Sem dia fixo definido" e contador do menu — e nenhuma visita nova é sugerida para ele.
  3. O histórico e o diário do cliente encerrado continuam intactos e consultáveis, e o próprio encerramento fica registrado no histórico.
  4. Vendedor encontra os próprios clientes encerrados (o Supervisor, os de todo o time) num lugar próprio e reativa um deles; o cliente volta a aparecer na rotina normal da Agenda, com visitas voltando a ser sugeridas.
  5. Cliente encerrado nunca reaparece nas 7 colunas do Kanban de prospecção, e os números históricos do Dashboard (negócios ganhos, ciclo médio) não mudam por um cliente ter sido encerrado depois de ganho.

**Notas para o Discuss**: (a) o motivo é uma lista editável pelo Supervisor (7ª lista, mesmo padrão de motivo de perda e de conclusão remota — recomendado, porque agrega no relatório e evita texto livre com informação pessoal sensível) ou texto livre; (b) onde os encerrados são listados para reativação — os requisitos não dizem, e hoje cliente "ganho" só é achável pela Agenda (desde a quick task 260915-ls7), então um encerrado fora da Agenda ficaria inalcançável sem uma tela/aba própria (recomendado espelhar a tela de Perdidos da Fase 28); (c) reativar é uma transição de volta para "ganho" — as travas de ganho (CNPJ, razão social, endereço completo, frequência) disparam na transição, então um cliente antigo com grandfathering seria bloqueado ao reativar se nada for feito; decidir se a reativação passa pelas travas ou não; (d) ao reativar, a próxima visita é sugerida a partir da frequência/dia fixo que o cliente já tinha, ou pedida de novo ao vendedor.
**Plans**: 7 plans

Plans:

- [x] 29-01-PLAN.md — ENCR-01..05 (banco): migration 0035 (só o valor 'encerrado' do enum) + 0036 (7ª lista `motivos_encerramento` com RLS, `motivo_encerramento_id`, 2 CHECKs, `mover_card_funil` de 8 parâmetros com guards de encerrar e reativação sem frequência, `agenda_do_vendedor` sem encerrados, leitura `clientes_encerrados`) + 25 testes de integração (onda 1)
- [x] 29-02-PLAN.md — critério 5: migration 0037 recria as 5 funções de ganho do Dashboard para encerrar/reativar não mudarem números históricos + teste de integração (onda 1)
- [x] 29-03-PLAN.md — aprovação do dono (checkpoint bloqueante) e aplicação de 0035 → 0036 → 0037 em produção (manual via SQL Editor), 27 testes de integração verdes (onda 2)
- [x] 29-04-PLAN.md — tipo `StatusAcompanhamento` + rótulo de exportação, Kanban exclui encerrado (`prospeccao.ts` 2→3), `marcarStatus` com pré-checagens de encerrar, motivo, frequência efetiva (Reativar de um toque) e revalidação da Agenda (onda 3)
- [x] 29-05-PLAN.md — camada de dados da tela Encerrados (regras puras, leitor paginado, Server Actions, catálogo de motivos) + aba "Motivos de encerramento" em Configurações (onda 2)
- [x] 29-06-PLAN.md — ficha: opção "Encerrado" no Select de Status (desabilitada fora de Ganho), `EncerramentoMotivoDialog` e recarga da Agenda após troca de status (onda 4)
- [x] 29-07-PLAN.md — tela `/encerrados` com período, busca e Reativar de um toque via `marcarStatus`, item "Encerrados" no menu sem contador (onda 3)

**UI hint**: yes

### Phase 30: Aderência de Uso no Dashboard

**Goal**: O Supervisor passa a enxergar, na tabela comparativa por vendedor do Dashboard, quanto cada vendedor de fato usa o sistema — o % de dias úteis com uso nas últimas 4 semanas — com o registro de uso guardando o mínimo possível sobre cada pessoa.
**Depends on**: Fase 29 (dependência leve): as ações novas de reabrir perdido (Fase 28) e encerrar/reativar cliente (Fase 29) entram na conta de "ação real no funil". É a fase tecnicamente mais nova do marco — precisa de um registro de uso diário que hoje não existe (ver notas).
**Requirements**: ADER-01, ADER-02, ADER-03
**Success Criteria** (what must be TRUE):

  1. Na tabela comparativa por vendedor do Dashboard, o Supervisor vê uma coluna nova com o % de aderência de uso de cada vendedor; nem a coluna nem os dados por trás dela aparecem para um Vendedor.
  2. Um dia conta como "usado" quando o vendedor entra no sistema OU faz uma ação real — mover etapa, concluir tarefa ou visita, cadastrar ou editar cliente — bastando uma dessas coisas no dia.
  3. O % é a média dos últimos 28 dias: dias usados divididos pelos dias úteis do período; enquanto a janela ainda não está completa desde que a medição começou, o Dashboard deixa isso claro em vez de mostrar um % artificialmente baixo.
  4. O registro de uso guarda só quem e qual dia — sem horário, IP, aparelho ou localização — e um vendedor não consegue ler o registro de outro, nem inflar o próprio registrando dias em que não usou (o dia é carimbado pelo servidor).

**Notas para o Discuss/pesquisa**: (a) hoje o sistema não guarda histórico de acesso — só o último login, dentro do Supabase Auth — então a parte "entrou no sistema" da métrica só começa a contar a partir do dia em que esta fase for para produção; mover/concluir já têm data e autor no `historico` e podem contar retroativamente, mas cadastro e edição de cliente NÃO ficam registrados no `historico` hoje (o gatilho só grava troca de etapa/status e conclusões) e também precisam de registro novo; (b) com a sessão persistente do app, o vendedor quase nunca "faz login" de novo — ele só abre o sistema já logado; recomendado interpretar "login" como "abriu o sistema naquele dia" (senão a métrica subestima quem usa todo dia); (c) "dias úteis" = segunda a sexta, com ou sem feriados; como tratar vendedor admitido ou desativado no meio da janela; (d) LGPD: registro de uso de funcionário é dado pessoal — confirmar prazo de guarda (só o necessário para a janela de 28 dias, com descarte do resto) e a comunicação ao time de que o uso é medido. Se o dono quiser a métrica completa já no dia do lançamento, a alternativa é antecipar só a captura de acesso diário (quick task ou reordenar esta fase para logo depois da Fase 27).
**Plans**: 4/6 plans executed

Plans:

- [x] 30-01-PLAN.md — ADER-01..03 (banco): migration 0038 (`acessos_diarios` de 2 colunas + RLS de 3 policies + `registrar_acesso_diario()` com descarte de 35 dias) + 0039 (`profiles.desativado_em`/`reativado_em` + as 2 RPCs de equipe recriadas com o carimbo) + 22 testes de integração (onda 1)
- [x] 30-02-PLAN.md — ADER-01..03 (banco): migration 0040 com a leitura `dashboard_aderencia_uso()` (28 dias corridos, seg-sex, união acesso+histórico, proporção por admissão/lacuna, `coletando_desde`, zero linhas para não-Supervisor) + 18 testes de integração (onda 1)
- [ ] 30-03-PLAN.md — aprovação do dono com alerta de LGPD (checkpoint bloqueante), aplicação manual 0038 → 0039 → 0040 pelo SQL Editor e 40 testes de integração verdes (onda 2)
- [x] 30-04-PLAN.md — ADER-02: registro do dia no middleware (cookie por dia e por conta, nunca bloqueia) e em cadastrar/editar cliente e editar frequência, com testes de dublê (onda 1, autônomo)
- [x] 30-05-PLAN.md — camada de dados: regras puras de exibição (percentual, "N de M dias úteis", "Coletando dados desde"), leitor `getAderenciaUso()` e junção tolerante a falha na ação do comparativo (onda 2, depende do 30-02)
- [ ] 30-06-PLAN.md — coluna "Aderência de uso" na tabela comparativa do Supervisor + casos de tela (onda 3, depende do 30-05)

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 27 → 28 → 29 → 30

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 27. Correções do Primeiro Uso — Card Filtrado e Agenda | v1.7 | 0/TBD | Not started | - |
| 28. Relatório de Perdidos | v1.7 | 4/4 | Complete   | 2026-09-26 |
| 29. Encerrar Cliente Ativo | v1.7 | 0/TBD | Not started | - |
| 30. Aderência de Uso no Dashboard | v1.7 | 4/6 | In Progress|  |
