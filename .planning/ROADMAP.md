# Roadmap: CRM Raiar — Acompanhamento de Vendas

## Overview

O CRM Raiar nasce de dentro para fora: primeiro a fundação de login e permissões, depois o cadastro de clientes PJ e o funil kanban, as telas de administração das listas editáveis, e o dashboard gerencial (v1.0 MVP). Em seguida, com o CRM já em uso no dia a dia, o marco v1.1 adicionou importação em massa de clientes via planilha (restrita ao Supervisor) e exportação da lista de clientes. O marco v1.2 deu ao Supervisor mais controle sobre a equipe (desativar membros), mais visibilidade sobre onde o funil trava (análises por etapa e por vendedor) e deixou os filtros de localização mais confiáveis (Estado/Cidade estruturados). O marco v1.3 abriu a segunda frente do CRM: além da prospecção (levar o cliente até a 1ª venda), o sistema passou a cuidar também do pós-venda — clientes "ganho" entram numa rotina de visitas recorrentes, com uma Agenda única unificando tarefas de prospecção e visitas, conclusão com resumo e diário do cliente, e planilhas para operar em escala. O marco v1.4 fechou uma lacuna de dados desse pós-venda: CNPJ passou a ser exigido no momento em que um cliente vira "ganho" — travado no banco, não só na tela — com grandfathering dos clientes antigos e planilhas de regularização em massa.

O marco v1.5 deu à Agenda uma segunda forma de visualização — um calendário de dia/semana/mês, navegável, mostrando também o que já foi concluído em datas passadas — ao lado da lista original, e passou a aceitar que a conclusão de um item não pressuponha visita presencial, com um motivo categorizado numa 6ª lista editável pelo Supervisor.

O marco v1.6 separou as duas portas de importação em massa que conviviam numa só: uma nova planilha "Importar Clientes Ativos" cria clientes já em status "ganho" exigindo todos os dados (menos a frequência de visita), enquanto "Importar clientes" foi renomeada para "Importar Clientes em Prospecção" e passou a exigir só Nome Fantasia + Responsável. A trava de "ganho" cresceu para também exigir razão social e endereço completo (grandfathering dos clientes antigos, mesmo padrão do CNPJ na v1.4), as duas planilhas avulsas "Importar CNPJ" e "Importar frequências" saíram do menu por terem ficado redundantes, e a recorrência de visita ganhou um dia fixo (dia da semana para semanal/quinzenal, semana do mês para mensal) — com a Agenda lembrando o vendedor de definir esse dia fixo para quem ainda não tem.

O marco v1.7 nasceu do primeiro uso real do sistema pelo time de vendas: corrigiu dois defeitos de tela que o time encontrou (card do Kanban comprimido ao filtrar por vendedor, e nome errado na seção "Sem dia fixo definido" da Agenda), fechou as duas pontas soltas do ciclo de vida do cliente — cliente "perdido" sai do funil e ganha uma tela própria com reabertura de um toque, e cliente ativo que parou de comprar pode ser encerrado (com motivo) e reativado depois — e deu ao Supervisor uma medida de aderência de uso por vendedor no Dashboard, guardando o mínimo possível sobre cada pessoa.

O marco v1.8 é um piloto deliberado: cria uma segunda agenda ("Agenda 2"), em paralelo à atual, onde o vendedor anota à mão quem vai visitar em cada dia (nome do cliente + bairro + data, com opção de repetir por algumas semanas), vista em lista e em calendário. Para a comparação ser justa, a Agenda atual deixa de puxar sozinha as visitas dos clientes ativos por frequência/dia fixo — sem apagar nenhum dado do cadastro — e as duas agendas convivem até o dono decidir qual fica de verdade no sistema.

Detalhes completos de cada marco arquivado estão em `.planning/milestones/`.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-20)
- ✅ **v1.1 Importação e Exportação de Clientes** — Phases 5-7 (shipped 2026-07-25) — see `.planning/milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Gestão de Equipe, Análises de Funil e Filtros** — Phases 8-12 (shipped 2026-08-06) — see `.planning/milestones/v1.2-ROADMAP.md`
- ✅ **v1.3 Agenda do Vendedor** — Phases 13-17 (shipped 2026-08-10) — see `.planning/milestones/v1.3-ROADMAP.md`
- ✅ **v1.4 CNPJ Obrigatório no Ganho** — Phases 18-19 (shipped 2026-08-14) — see `.planning/milestones/v1.4-ROADMAP.md`
- ✅ **v1.5 Calendário na Agenda e Conclusão Remota** — Phases 20-22 (shipped 2026-08-19) — see `.planning/milestones/v1.5-ROADMAP.md`
- ✅ **v1.6 Importação de Clientes Ativos e Prospecção Separadas** — Phases 23-26 (shipped 2026-08-27) — see `.planning/milestones/v1.6-ROADMAP.md`
- ✅ **v1.7 Ajustes Pós-Teste com o Time de Vendas** — Phases 27-30 (shipped 2026-09-28) — see `.planning/milestones/v1.7-ROADMAP.md`
- 🚧 **v1.8 Agenda 2 (Piloto de Visitas Manuais)** — Phases 31-33 (in progress)

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

<details>
<summary>✅ v1.7 Ajustes Pós-Teste com o Time de Vendas (Phases 27-30) — SHIPPED 2026-09-28</summary>

- [x] Phase 27: Correções do Primeiro Uso — Card Filtrado e Agenda — O card do Kanban fica idêntico com ou sem filtro de vendedor, e a seção "Sem dia fixo definido" da Agenda passa a mostrar o nome do cliente junto do vendedor. (completed 2026-09-28)
- [x] Phase 28: Relatório de Perdidos — Cliente "Perdido" sai das 7 colunas do funil e ganha uma tela própria (motivo, data, vendedor), com filtro por período, visibilidade por papel e botão "Reabrir" de um toque. (completed 2026-09-26)
- [x] Phase 29: Encerrar Cliente Ativo — Vendedor encerra um cliente ativo que parou de comprar (com motivo obrigatório), o cliente sai da rotina da Agenda mantendo histórico e diário, e pode ser reativado depois. (completed 2026-09-27)
- [x] Phase 30: Aderência de Uso no Dashboard — Supervisor vê, na tabela comparativa por vendedor, o % de dias úteis com uso real do sistema nas últimas 4 semanas, com o registro de uso guardando só o mínimo sobre cada pessoa. (completed 2026-09-27)

Full phase details, decisions, and tech debt: `.planning/milestones/v1.7-ROADMAP.md`

</details>

### 🚧 v1.8 Agenda 2 (Piloto de Visitas Manuais) (Phases 31-33) — IN PROGRESS

**Milestone Goal:** Criar uma segunda agenda, em paralelo à atual, onde o vendedor inclui manualmente quem visitar em cada dia (só clientes ativos/ganho) — para comparar com o modelo automático de hoje (frequência + dia fixo) e decidir qual fica de verdade no sistema.

- [x] **Phase 31: Agenda 2 — Visitas Manuais na Lista** - Nova tela "Agenda 2" no menu, logo abaixo de "Agenda", onde o vendedor anota à mão quem vai visitar em cada dia (nome + bairro + data), corrige, apaga e marca como feito; o Supervisor vê a Agenda 2 de todo o time, com filtro por vendedor. (completed 2026-10-01)
- [ ] **Phase 32: Agenda 2 — Repetição Semanal e Calendário** - O vendedor cria um item já repetido por 4, 8 ou 12 semanas de uma vez, e vê a Agenda 2 também em calendário de dia/semana/mês, com a mesma navegação da Agenda atual.
- [ ] **Phase 33: Agenda Atual sem Visitas Automáticas de Clientes Ativos** - Durante o piloto, a Agenda atual deixa de puxar sozinha as visitas dos clientes ativos por frequência/dia fixo — a prospecção continua igual e nenhum dado do cadastro é apagado.

## Phase Details

### Phase 31: Agenda 2 — Visitas Manuais na Lista

**Goal**: O vendedor passa a ter uma segunda agenda, própria e manual, onde anota quem vai visitar em cada dia (nome do cliente + bairro + data), corrige ou apaga o que anotou e marca o que já fez — e o Supervisor acompanha a Agenda 2 de todo o time, filtrando por vendedor. A Agenda atual não muda em nada nesta fase.
**Depends on**: Nada dentro do marco (primeira fase). É funcionalidade nova e paralela — tabela nova, regras de acesso novas, tela nova e item de menu novo — sem tocar em `agenda_do_vendedor()`, na tela `/agenda` nem em nenhuma regra do funil.
**Requirements**: AGD2-01, AGD2-03, AGD2-04, AGD2-05, AGD2-06, AGD2-07
**Success Criteria** (what must be TRUE):

  1. No menu principal aparece "Agenda 2" logo abaixo de "Agenda"; ao abrir, o vendedor adiciona um item informando o nome do cliente (texto livre, sem precisar escolher um cliente cadastrado), o bairro e a data, e o item aparece na lista daquele dia.
  2. O vendedor corrige o nome, o bairro ou a data de um item que ele mesmo criou, e apaga um item que ele mesmo criou — a lista mostra a mudança na hora.
  3. Ao marcar um item como concluído, ele continua visível na lista do dia, riscado — sem pedir resumo nem motivo (a Agenda 2 é deliberadamente mais leve que a atual).
  4. O vendedor vê só os próprios itens e nunca consegue ver, alterar ou apagar item de outro vendedor, nem acessando os dados diretamente (garantido pelas regras do banco, não só pela tela); o Supervisor vê os itens de todo o time e filtra por vendedor, do mesmo jeito que já faz na Agenda atual.
  5. A Agenda atual continua exatamente como hoje — as mesmas tarefas de prospecção e visitas, o mesmo contador no menu — e nenhum item da Agenda 2 aparece nela.

**Notas para o Discuss** (inclui alerta de LGPD — privacidade por design e por padrão):
(a) **LGPD — que dado pessoal este item guarda:** cada item junta um nome digitado livremente (que pode ser o nome de uma pessoa, no caso de cliente MEI ou do contato), um bairro, uma data e o vendedor dono. Isso é dado pessoal do cliente e também do funcionário, porque revela a rotina de deslocamento de um vendedor dia a dia. Privacidade por design, aplicada por padrão: guardar só os campos já escopados (nome, bairro, data, concluído, dono, carimbos de criação/alteração) — sem telefone, endereço completo, observação livre ou localização; limite de tamanho nos dois textos; uma dica curta na tela orientando a usar o Nome Fantasia (evita nome completo de pessoa e números parecidos com documento — mesmo achado da quick task 260928-fqk, em que um padrão assim foi mascarado pela proteção de dados do computador de um usuário); dono sempre definido pelo servidor, nunca enviado pela tela; sem exportação da Agenda 2 neste marco.
(b) **LGPD — prazo de guarda do piloto:** decidir com o dono o que acontece com os itens quando ele escolher qual agenda fica (por exemplo: apagar tudo se a Agenda 2 for descartada) e se itens antigos são descartados sozinhos depois de um tempo (mesmo espírito do descarte de 35 dias do registro de uso da v1.7).
(c) **Supervisor:** AGD2-07 diz que o Supervisor "vê" — recomendado só leitura para ele (menor privilégio: alterar/apagar fica só com o dono do item). Confirmar também se o Supervisor pode criar itens para si mesmo ou para um vendedor (não está nos requisitos).
(d) **Formato da Lista:** agrupada por dia (AGD2-05 fala em "lista do dia") ou em Atrasado/Hoje/Próximos como a Agenda atual? Item pendente com data passada fica destacado como atrasado? Um item concluído pode ser desmarcado?
(e) **Contador no menu:** "Agenda 2" mostra o número de pendentes (como "Agenda") ou fica sem contador (como "Perdidos"/"Encerrados")? Os testes de menu existentes que conferem a ordem dos itens vão precisar incluir a posição nova.
(f) **Vendedor desativado:** itens da Agenda 2 não são clientes e não entram na transferência da v1.2 — ficam com o vendedor desativado, visíveis ao Supervisor. Confirmar que está bom assim.
(g) **Regras técnicas do projeto:** tabela nova com RLS ligada e regras de acesso explícitas no mesmo arquivo de migration; nenhuma exceção `SECURITY DEFINER` nova (o projeto continua com 6); aprovação do dono antes de aplicar a migration em produção, como nas fases anteriores; zero dependência nova.
**Plans**: 8/8 plans complete

Plans:
**Wave 1**

- [x] 31-01-PLAN.md — Migration 0048 (tabela agenda2_itens + RLS dono-escreve/Supervisor-só-lê + carimbos) + testes estruturais e de RLS (vermelhos até o 31-03)
- [x] 31-02-PLAN.md — Funções puras da Lista (seções, visibilidade, filtro, duplicado) + schema Zod compartilhado (TDD)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 31-03-PLAN.md — [BLOCKING] Aprovação do dono (alerta LGPD) + aplicação manual da 0048 no SQL Editor + RLS verde
- [x] 31-04-PLAN.md — Leitura da Lista, contagem do menu e seis Server Actions (sem RPC)
- [x] 31-05-PLAN.md — Linha do item (riscado/editável/somente leitura) + confirmação de apagar

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 31-06-PLAN.md — Item "Agenda 2" no menu com selo/bolinha + ajuste dos testes de ordem (D-15)
- [x] 31-07-PLAN.md — Formulário de criar/editar com aviso de duplicado e dica de LGPD

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 31-08-PLAN.md — Tela /agenda-2 (Lista + visão do Supervisor) + verificação final (Agenda atual intocada)

**UI hint**: yes

### Phase 32: Agenda 2 — Repetição Semanal e Calendário

**Goal**: O vendedor planeja as próximas semanas da Agenda 2 de uma vez — cria um item já repetido por 4, 8 ou 12 semanas — e enxerga a Agenda 2 também em calendário de dia, semana e mês, com a mesma navegação que já conhece da Agenda atual.
**Depends on**: Fase 31 (a tabela, as regras de acesso e a tela da Agenda 2 já precisam existir). Mexe num componente já em produção e usado todo dia (o calendário da Agenda atual), por isso o calendário da Agenda atual precisa sair desta fase idêntico ao de hoje.
**Requirements**: AGD2-02, AGD2-08
**Success Criteria** (what must be TRUE):

  1. Ao criar um item, o vendedor escolhe entre não repetir ou repetir por 4, 8 ou 12 semanas, e o sistema cria de uma vez uma ocorrência por semana, sempre no mesmo dia da semana da data escolhida — nunca num dia deslocado.
  2. Cada ocorrência repetida é independente: editar, concluir ou apagar uma delas não muda nenhuma das outras.
  3. A Agenda 2 alterna entre Lista e Calendário (dia/semana/mês), com setas de navegação, botão "Hoje" e semana começando na segunda-feira — mesmo visual e comportamento do calendário da Agenda atual — e os itens concluídos aparecem riscados também no calendário.
  4. O Supervisor filtra o calendário da Agenda 2 por vendedor, do mesmo jeito que já filtra a Lista.
  5. O calendário da Agenda atual continua idêntico ao de hoje: não mostra nenhum item da Agenda 2 e não perde nada do que já mostrava, inclusive o que já foi concluído em datas passadas.

**Notas para o Discuss/pesquisa**:
(a) **Decisão travada pelo dono: copiar a tela, não compartilhar o componente.** Em vez de tornar `AgendaCalendario.tsx` configurável (fonte de histórico opcional, desenho do item trocável), a Agenda 2 ganha sua PRÓPRIA cópia do componente de calendário (ex: `AgendaCalendario2.tsx`), adaptada para os campos simples da Agenda 2 (nome livre + bairro, sem ficha nem janela de conclusão com resumo). Mesmo padrão já usado neste projeto entre "Perdidos" e "Encerrados" (Fases 28/29 — sibling modules, nunca abstração compartilhada prematura): zero risco de regressão na Agenda atual, ao custo de algum código parecido nos dois lugares. `components/agenda/AgendaCalendario.tsx` e seus testes (`agenda-list.test.tsx`, calendário das Fases 20/21) permanecem INTOCADOS. A Agenda 2 tem uma fonte só (pendentes e concluídos na mesma tabela), então a cópia é mais simples que o original, não precisa da segunda leitura de histórico.
(b) **Repetição, tudo ou nada:** todas as ocorrências gravadas numa única operação — nunca metade das semanas criada por uma falha de rede no meio. Datas calculadas sem o bug de fuso já conhecido do projeto (nunca `new Date(texto)` no navegador; somar semanas sobre data pura).
(c) **Gravação direta, não função do banco:** na v1.7 a regra de acesso (RLS) não foi aplicada corretamente a uma gravação feita de dentro de uma função chamada pela API (ver migration 0047). Uma gravação direta de várias linhas numa só chamada já é atômica e fica protegida pela RLS normal — preferir esse caminho.
(d) **Vínculo entre ocorrências:** o dono não pediu "apagar todas as próximas" — confirmar se vale guardar um identificador de série só para uso futuro ou não guardar nada (menos dado = mais simples, e alinhado à minimização da LGPD).
(e) **Volume:** o calendário da Agenda 2 deve buscar só o período visível, não todos os itens de todos os vendedores de uma vez (mesmo cuidado da Fase 21 com o free tier).
**Plans**: 2/7 plans executed

Plans:
**Wave 1**

- [x] 32-01-PLAN.md — Base pura da repetição (lista 0/4/8/12, datas semanais N no total, regra "hoje em diante") + schema de criação separado da edição
- [x] 32-02-PLAN.md — Funções puras do calendário da Agenda 2 (cópias tipadas) + leitura por período com concluídos (getAgenda2Periodo)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 32-03-PLAN.md — Server Actions: criar em lote único tudo-ou-nada + getAgenda2PeriodoAction + teste de integração real (atomicidade, RLS por linha, independência)
- [ ] 32-04-PLAN.md — Barra, Dia, Mês e Semana copiados para a Agenda 2 (riscado, sem ícone de repetição)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 32-05-PLAN.md — Campo "Repetir" no formulário (só ao criar, padrão "Não repetir", D-23/D-25) + recarga em falha
- [ ] 32-06-PLAN.md — Contêiner Agenda2Calendario (período visível, recarga sem piscar, filtro do Supervisor, diálogo do dia com ações)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 32-07-PLAN.md — Agenda2List com Lista + Calendário + verificação final (Agenda atual intocada por guarda git)

**UI hint**: yes

### Phase 33: Agenda Atual sem Visitas Automáticas de Clientes Ativos

**Goal**: Enquanto o piloto roda, a Agenda atual passa a mostrar só o que vem da prospecção — clientes ativos ("ganho") deixam de aparecer lá sozinhos por frequência de visita ou dia fixo — sem apagar nenhum dado do cadastro do cliente, para que dê para voltar atrás se o dono decidir que a Agenda atual é a que fica.
**Depends on**: Fases 31 e 32 (dependência de produto, não técnica). Os arquivos são praticamente disjuntos dos das Fases 31-32, mas esta mudança vai por último de propósito: se chegasse à produção antes da Agenda 2, o time ficaria dias sem nenhum lugar para planejar as visitas dos clientes ativos. Mesmo raciocínio da v1.6 (Fase 26): o caminho antigo só sai depois que o substituto está provado em produção. Isolada numa fase pequena própria porque mexe numa leitura já em produção e usada todo dia (`agenda_do_vendedor()`), longe do trabalho novo das Fases 31-32 — mesmo padrão da Fase 27 da v1.7.
**Requirements**: AGD-16
**Success Criteria** (what must be TRUE):

  1. Na Agenda atual — Lista, Calendário e contador do menu — não aparece mais nenhuma visita pendente de cliente ativo gerada por frequência ou dia fixo, e os três sempre concordam entre si.
  2. As tarefas de prospecção continuam aparecendo na Agenda atual exatamente como hoje — mesmas datas, mesma ordem, mesmo destaque de atraso, mesma conclusão com resumo — e contam no contador do menu como antes.
  3. A Agenda atual deixa de cobrar o vendedor para definir frequência ou dia fixo de clientes ativos (a seção "Sem dia fixo definido" não aparece mais durante o piloto).
  4. Frequência de visita e dia fixo continuam visíveis e editáveis na ficha do cliente ativo, com os mesmos valores de antes, e nada é apagado — se o dono decidir manter a Agenda atual, as visitas podem voltar a aparecer sem ninguém redigitar nada.
  5. O que já foi feito continua registrado: visitas já concluídas seguem no Diário de cada cliente, como hoje.

**Notas para o Discuss** (a mudança é maior do que "tirar uma condição de uma consulta"):
(a) **Por onde o cliente ativo entra hoje na Agenda atual — são dois caminhos de leitura:** (1) a metade "visitas" de `agenda_do_vendedor()` (migration 0036, a versão mais recente) — a mesma leitura alimenta a Lista, os pendentes do Calendário e o contador do menu (`getAgendaPendentesCount()`), então mudar ali cobre os três de uma vez, sem eles discordarem; (2) a seção "Sem dia fixo definido" (`getClientesSemDiaFixo()` em `lib/supabase/queries/agenda.ts` + `components/agenda/AgendaSemDiaFixo.tsx`, fiada em `AgendaList.tsx`), que lista clientes ativos justamente por falta de frequência/dia fixo. O critério 3 assume que esta seção sai também — confirmar com o dono.
(b) **Histórico de visitas no calendário:** o calendário mostra visitas já concluídas em datas passadas (`agenda_concluidos_do_vendedor()`, Fase 21). Recomendado manter (é o que foi feito, não uma entrada automática) — confirmar.
(c) **As visitas continuam sendo criadas no banco?** Hoje `mover_card_funil` cria a primeira visita ao marcar ganho (com frequência) e `concluir_visita` cria a próxima. Esconder só a leitura deixa essas criações acontecendo em silêncio: visitas invisíveis acumulando, que reapareceriam todas atrasadas se o piloto for revertido. A alternativa (parar de criar durante o piloto) mexe em `mover_card_funil`, a função mais crítica do funil. Nenhuma visita já existente deve ser apagada em nenhum dos dois caminhos.
(d) **A caixinha de "ganho" continua exigindo frequência de visita** — a trava está no banco (`mover_card_funil`, "Frequência de visita é obrigatória ao marcar um cliente como ganho"). Durante o piloto o vendedor seria obrigado a escolher uma frequência que não alimenta mais nada, o que vai contra a mínima fricção. O requisito diz que os campos continuam existindo, não diz se a caixinha continua pedindo. Manter como está é o menor risco; afrouxar exige mexer na trava de ganho (com os testes da v1.3/v1.4/v1.6 e o grandfathering) — decidir com o dono.
(e) **Tarefas de prospecção de cliente já ganho:** a metade de prospecção de `agenda_do_vendedor()` não muda (requisito explícito), então uma tarefa pendente de um cliente ganho continua aparecendo.
(f) **Reversível e sem sobrecarga:** mudança numa migration nova (nunca editando uma antiga), com as mesmas colunas de retorno de `agenda_do_vendedor()` (só o corpo muda, sem criar sobrecarga ambígua) e o corpo original registrado para uma migration de volta, caso o dono escolha a Agenda atual.
(g) **Testes:** os testes existentes que esperam visitas na Agenda atual vão mudar de propósito — separá-los dos testes de prospecção, que devem passar sem edição (oráculo de regressão).
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 31 → 32 → 33

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 31. Agenda 2 — Visitas Manuais na Lista | v1.8 | 8/8 | Complete    | 2026-10-01 |
| 32. Agenda 2 — Repetição Semanal e Calendário | v1.8 | 2/7 | In Progress|  |
| 33. Agenda Atual sem Visitas Automáticas de Clientes Ativos | v1.8 | 0/TBD | Not started | - |

*Marcos v1.0–v1.7 arquivados em `.planning/milestones/`.*
