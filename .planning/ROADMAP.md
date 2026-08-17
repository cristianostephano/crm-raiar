# Roadmap: CRM Raiar — Acompanhamento de Vendas

## Overview

O CRM Raiar nasce de dentro para fora: primeiro a fundação de login e permissões, depois o cadastro de clientes PJ e o funil kanban, as telas de administração das listas editáveis, e o dashboard gerencial (v1.0 MVP). Em seguida, com o CRM já em uso no dia a dia, o marco v1.1 adicionou importação em massa de clientes via planilha (restrita ao Supervisor) e exportação da lista de clientes. O marco v1.2 deu ao Supervisor mais controle sobre a equipe (desativar membros), mais visibilidade sobre onde o funil trava (análises por etapa e por vendedor) e deixou os filtros de localização mais confiáveis (Estado/Cidade estruturados). O marco v1.3 abriu a segunda frente do CRM: além da prospecção (levar o cliente até a 1ª venda), o sistema passou a cuidar também do pós-venda — clientes "ganho" entram numa rotina de visitas recorrentes, com uma Agenda única unificando tarefas de prospecção e visitas, conclusão com resumo e diário do cliente, e planilhas para operar em escala. O marco v1.4 fechou uma lacuna de dados desse pós-venda: CNPJ passou a ser exigido no momento em que um cliente vira "ganho" — travado no banco, não só na tela — com grandfathering dos clientes antigos e planilhas de regularização em massa.

O marco atual, v1.5, trabalha em cima da Agenda que a v1.3 criou, em duas frentes independentes: **(a)** a Agenda ganha uma segunda forma de olhar para os mesmos itens — um calendário de dia/semana/mês, com navegação de data, seguindo o esboço já aprovado pelo dono do projeto (sketch 003, Variante A), e passando a mostrar também o que já foi concluído quando se navega para datas passadas; e **(b)** concluir um item deixa de pressupor visita presencial — o vendedor pode marcar que não foi presencial e escolher o motivo de uma 6ª lista editável pelo Supervisor, sem perder nada do que a conclusão normal já faz (diário do cliente, sugestão da próxima visita).

Detalhes completos de cada marco arquivado estão em `.planning/milestones/`.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-20)
- ✅ **v1.1 Importação e Exportação de Clientes** — Phases 5-7 (shipped 2026-07-25) — see `.planning/milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Gestão de Equipe, Análises de Funil e Filtros** — Phases 8-12 (shipped 2026-08-06) — see `.planning/milestones/v1.2-ROADMAP.md`
- ✅ **v1.3 Agenda do Vendedor** — Phases 13-17 (shipped 2026-08-10) — see `.planning/milestones/v1.3-ROADMAP.md`
- ✅ **v1.4 CNPJ Obrigatório no Ganho** — Phases 18-19 (shipped 2026-08-14) — see `.planning/milestones/v1.4-ROADMAP.md`
- 🚧 **v1.5 Calendário na Agenda e Conclusão Remota** — Phases 20-22 (planning started 2026-08-17)

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

### 🚧 v1.5 Calendário na Agenda e Conclusão Remota (Phases 20-22) — IN PROGRESS

- [ ] **Phase 20: Calendário da Agenda — Mês, Semana e Dia** - A tela da Agenda ganha um segundo modo de visualização: um calendário de dia/semana/mês sobre os mesmos itens da Lista, com navegação de data, botão "Hoje" e o mesmo filtro por vendedor.
- [ ] **Phase 21: Calendário — O Que Já Foi Feito em Datas Passadas** - Navegar para uma data passada no calendário passa a mostrar também os itens já concluídos naquele dia, não só o que ficou pendente.
- [ ] **Phase 22: Conclusão Remota com Motivo** - Concluir um item da Agenda deixa de pressupor visita presencial: o vendedor marca "não foi presencial", escolhe um motivo de uma 6ª lista editável pelo Supervisor, e a conclusão segue valendo como conclusão normal.

## Phase Details

### Phase 20: Calendário da Agenda — Mês, Semana e Dia

**Goal**: O vendedor consegue olhar a própria Agenda como calendário (dia/semana/mês) além da lista que já existe, navegando por datas, sem perder nenhuma das informações que a Lista já dá.
**Depends on**: Nada dentro do marco (primeira fase da v1.5). Estende a tela `/agenda` e o `AgendaItem`/`lib/agenda/itens.ts` já existentes desde a Fase 14. Ordenada primeiro de propósito: esta fase reorganiza quem é o dono da busca/filtro/diálogo dentro de `AgendaList.tsx` (hoje o mesmo componente busca, filtra e renderiza), e é mais barato a Fase 22 encaixar a conclusão remota já na estrutura nova do que ter que mudar a mesma fiação duas vezes.
**Requirements**: AGD-07, AGD-08, AGD-09, AGD-10, AGD-11, AGD-12, AGD-14
**Success Criteria** (what must be TRUE):

  1. Na tela da Agenda o usuário alterna entre Lista e Calendário com um clique, e a Lista continua se comportando exatamente como hoje (mesmas seções Atrasado/Hoje/Próximos, mesmo botão de concluir).
  2. No Calendário o usuário escolhe entre mês, semana e dia, avança/volta a data e retorna ao presente pelo botão "Hoje"; a semana sempre começa na segunda-feira, igual nas três visões.
  3. Na visão de mês cada dia mostra até 3 itens e um contador "+N" quando há mais, e clicar no dia abre a lista completa daquele dia; na visão de semana os itens aparecem em 7 colunas (uma por dia); na visão de dia aparecem no mesmo card já usado na Lista.
  4. Todo item no calendário mantém a mesma sinalização visual da Lista — Prospecção em cinza, Ativo/Visita em azul — e um item atrasado continua legível como atrasado mesmo caindo numa célula de mês vizinho na borda da grade.
  5. O Supervisor filtra o calendário por vendedor igual já filtra a Lista, e as contagens/chips de cada dia acompanham o filtro (nunca mostram um número de "todos" enquanto a grade mostra só um vendedor).

**Plans**: TBD
**UI hint**: yes

**Notas para o planejamento** (não são requisitos, são travas já decididas):

- Visual segue o esboço aprovado `.planning/sketches/003-agenda-calendario/index.html`, Variante A (barra de ferramentas simples, sem mini-calendário lateral). O sketch é o contrato visual desta fase.
- Zero dependência npm nova (confirmado na pesquisa de stack): grade montada à mão com `date-fns` + CSS Grid + primitivos shadcn/ui já instalados. `react-day-picker` (já instalado) **não** deve ser estendido para a visão de mês.
- O "primeiro dia da semana" (segunda-feira) precisa ser uma constante única compartilhada pelas três visões — `startOfWeek`/`endOfWeek` do date-fns não derivam isso do locale, então dois lugares com literais diferentes fazem mês e semana discordarem.
- Data de item sempre lida com `parseISO`, nunca `new Date(string)` — mesma regra já documentada em `bucketDoItem`.
- Só visualização: sem arrastar item entre dias, sem grade de horários (itens da Agenda nunca tiveram hora do dia).
- Esta fase continua lendo o mesmo conjunto de itens pendentes que a Lista já busca; a leitura por período com histórico é escopo da Fase 21 — mas o dono da busca deve ficar num único ponto, para a Fase 21 acrescentar a segunda fonte sem reescrever a navegação.

### Phase 21: Calendário — O Que Já Foi Feito em Datas Passadas

**Goal**: Navegar para uma data passada no calendário mostra também o que já foi concluído naquele dia — o calendário vira um registro do que aconteceu, não só do que está em aberto.
**Depends on**: Fase 20 (a grade, a navegação de data e o filtro por vendedor precisam existir antes de ganharem a dimensão histórica).
**Requirements**: AGD-13
**Success Criteria** (what must be TRUE):

  1. Navegando para um mês, semana ou dia no passado, o vendedor vê os itens que já concluiu naquele dia, além dos pendentes que ficaram para trás — um dia com trabalho feito nunca mais aparece vazio.
  2. Item já concluído é visualmente distinto do pendente e não oferece a ação de concluir de novo.
  3. A Lista da Agenda continua mostrando só itens pendentes — nenhuma mudança de comportamento nela nem na contagem do selo do menu.
  4. O vendedor vê só o próprio histórico e o Supervisor vê o de todo o time, com o mesmo filtro por vendedor do calendário — a mesma regra de visibilidade que já vale na Lista.
  5. Navegar entre meses continua imediato, sem baixar o histórico inteiro do vendedor de uma vez.

**Plans**: TBD
**UI hint**: yes

**Notas para o planejamento** (não são requisitos, são travas já decididas):

- ⚠️ **Correção de pesquisa desatualizada**: `STACK.md` e `ARCHITECTURE.md` foram escritos ANTES de o AGD-13 ser travado no Discuss e ambos concluem "o calendário não precisa de mudança nenhuma no banco". Essa conclusão está **errada** para o AGD-13. `agenda_do_vendedor()` filtra `t.concluida = false` / `v.data_realizada is null` — item concluído desaparece do resultado. Esta fase precisa de trabalho próprio de migration/RPC.
- A leitura nova deve ser **limitada por período** (o intervalo visível na tela), justamente para não trazer anos de histórico de uma vez. O caminho de menor risco é uma leitura NOVA e complementar (itens concluídos de um intervalo de datas) somada no navegador ao conjunto de pendentes que a Fase 20 já busca — assim `agenda_do_vendedor()` e a Lista ficam intocados. A forma exata (RPC nova x variante com parâmetros de data) é decisão do planejamento da fase.
- Continua valendo a regra absoluta do projeto: RPC `SECURITY INVOKER`, RLS como única fronteira de autorização. O marco inteiro deve terminar com exatamente as mesmas 4 exceções `SECURITY DEFINER` documentadas de hoje.
- Cálculo de data que afeta correção de dado fica no Postgres; no navegador, `parseISO` para exibição.

### Phase 22: Conclusão Remota com Motivo

**Goal**: O vendedor consegue registrar que um item da Agenda foi concluído sem visita presencial, escolhendo o motivo de uma lista mantida pelo Supervisor, sem perder nada do que a conclusão normal já faz.
**Depends on**: Nada tecnicamente (mexe em arquivos praticamente disjuntos dos das Fases 20/21 — migrations novas, `ConcluirItemDialog.tsx`, `listas.ts`/`ConfiguracoesTabs.tsx`). Ordenada depois da Fase 20 só para encaixar a fiação do diálogo de conclusão uma única vez, já na estrutura reorganizada de `AgendaList.tsx`.
**Requirements**: CONC-02, CONC-03, CONC-04, CONC-05
**Success Criteria** (what must be TRUE):

  1. Ao concluir uma tarefa de prospecção **ou** uma visita de cliente ativo, o vendedor pode marcar que não foi presencial e escolher um motivo; o resumo continua obrigatório nos dois casos (motivo é a categoria, resumo é o texto livre).
  2. O Supervisor cadastra, renomeia e desativa os "Motivos de conclusão remota" numa 6ª aba de Configurações, no mesmo formato das outras cinco listas — e o Vendedor (não só o Supervisor) vê essa lista preenchida no diálogo de conclusão.
  3. Uma conclusão remota vale como conclusão normal: o item sai da Agenda, entra no diário do cliente, e sendo visita de cliente ativo o sistema continua sugerindo a próxima data pela frequência, exatamente como numa conclusão presencial.
  4. No Diário do cliente, a entrada de uma conclusão remota mostra o motivo em texto legível junto do resumo — nunca um código interno, nunca genérico.

**Plans**: TBD
**UI hint**: yes

**Notas para o planejamento** (não são requisitos, são travas já decididas):

- Nova tabela `motivos_conclusao_remota` copiando a forma de `motivos_perda`/`frequencias_pedido`, mais uma coluna FK nullable em `tarefas` **e** em `visitas`. Sem coluna booleana `remoto` separada: "FK preenchida" já é o sinal de "foi remoto", mesmo padrão de `motivo_perda_id`.
- ⚠️ A policy de **SELECT** da nova tabela precisa ser aberta a qualquer usuário autenticado, não restrita ao Supervisor. A migration 0016 documenta esse exato modo de falha silenciosa já ocorrido neste projeto (dropdown permanentemente vazio para o Vendedor, sem erro nenhum). Verificação obrigatória com uma conta de Vendedor, não só de Supervisor.
- `concluir_tarefa_prospeccao` **e** `concluir_visita` precisam ser estendidas **juntas**, na mesma migration, com o parâmetro novo `default null` no fim da assinatura — e usando o padrão do projeto de `drop function if exists` antes do `create function` (nunca `create or replace` com contagem de parâmetros diferente; ver migration 0018). Os testes antigos de agenda devem passar **sem edição** depois da migration.
- O bloco que calcula a próxima visita dentro de `concluir_visita` **não** deve ganhar nenhum `if` novo por causa do motivo — ele já funciona igual para os dois caminhos por construção, e mexer nele arrisca quebrar a sugestão de próxima data.
- CONC-05 exige mexer nos dois gatilhos de histórico (`tarefas_before_update_historico` / `visitas_after_update_historico`) para resolverem a FK em texto legível antes de gravar. **Não há precedente disso no projeto** (o motivo de perda nunca faz isso) — é lógica nova de gatilho, não cópia. O texto gravado no `historico` é um retrato congelado: renomear o motivo depois não reescreve o diário antigo, mesmo padrão já travado para `frequencias_pedido`.
- Registrar a 6ª lista exige três lugares: a migration, a união `ListaTabela` em `app/actions/listas.ts` e uma aba nova em `ConfiguracoesTabs.tsx` (com `keepMounted`, obrigatório neste arquivo). O TypeScript só pega a segunda sozinho.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 20. Calendário da Agenda — Mês, Semana e Dia | 0/TBD | Not started | - |
| 21. Calendário — O Que Já Foi Feito em Datas Passadas | 0/TBD | Not started | - |
| 22. Conclusão Remota com Motivo | 0/TBD | Not started | - |
