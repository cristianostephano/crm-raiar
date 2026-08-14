# Roadmap: CRM Raiar — Acompanhamento de Vendas

## Overview

O CRM Raiar nasce de dentro para fora: primeiro a fundação de login e permissões, depois o cadastro de clientes PJ e o funil kanban, as telas de administração das listas editáveis, e o dashboard gerencial (v1.0 MVP). Em seguida, com o CRM já em uso no dia a dia, o marco v1.1 adicionou importação em massa de clientes via planilha (restrita ao Supervisor) e exportação da lista de clientes. O marco v1.2 deu ao Supervisor mais controle sobre a equipe (desativar membros), mais visibilidade sobre onde o funil trava (análises por etapa e por vendedor) e deixou os filtros de localização mais confiáveis (Estado/Cidade estruturados). O marco v1.3 abriu a segunda frente do CRM: além da prospecção (levar o cliente até a 1ª venda), o sistema passou a cuidar também do pós-venda — clientes "ganho" entram numa rotina de visitas recorrentes, com uma Agenda única unificando tarefas de prospecção e visitas, conclusão com resumo e diário do cliente, e planilhas para operar em escala. O marco atual, v1.4, fecha uma lacuna de dados desse pós-venda: CNPJ passa a ser exigido no momento em que um cliente vira "ganho" — travado no banco, não só na tela — com os clientes que já são "ganho" sem CNPJ seguindo intocados (grandfathering, mesmo padrão já usado para frequência de visita na Fase 13) e um caminho de planilha para regularizar em massa quem já está nessa situação hoje.

Detalhes completos de cada marco arquivado estão em `.planning/milestones/`.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-20)
- ✅ **v1.1 Importação e Exportação de Clientes** — Phases 5-7 (shipped 2026-07-25) — see `.planning/milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Gestão de Equipe, Análises de Funil e Filtros** — Phases 8-12 (shipped 2026-08-06) — see `.planning/milestones/v1.2-ROADMAP.md`
- ✅ **v1.3 Agenda do Vendedor** — Phases 13-17 (shipped 2026-08-10) — see `.planning/milestones/v1.3-ROADMAP.md`
- 🚧 **v1.4 CNPJ Obrigatório no Ganho** — Phases 18-19 (planning started 2026-08-10)

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

### 🚧 v1.4 CNPJ Obrigatório no Ganho (Phases 18-19) — IN PROGRESS

- [x] **Phase 18: CNPJ Obrigatório no Ganho** - Ao mover um card para "ganho" o sistema passa a exigir CNPJ preenchido, travado no RPC `mover_card_funil` — clientes já "ganho" sem CNPJ continuam funcionando normalmente. (completed 2026-08-11)
- [x] **Phase 19: Planilhas de CNPJ e Nome Fantasia** - A planilha "Importar clientes" ganha CNPJ e Nome Fantasia como colunas opcionais, e uma nova planilha "CNPJ em massa" regulariza em lote os clientes já "ganho" sem CNPJ. (completed 2026-08-14)

## Phase Details

### Phase 18: CNPJ Obrigatório no Ganho

**Goal**: A partir do momento em que um cliente vira "ganho", o sistema exige CNPJ preenchido — validado no banco, não só na tela — sem afetar clientes já "ganho" sem CNPJ nem o cadastro rápido anterior ao "ganho".
**Depends on**: Nada dentro do marco (primeira fase da v1.4) — estende o `mover_card_funil` e o `lib/validations/cliente.ts` já existentes desde a Fase 13, mesmo padrão usado para tornar a frequência de visita obrigatória no "ganho" (VIS-01/VIS-04)
**Requirements**: CNPJ-01, CNPJ-02
**Success Criteria** (what must be TRUE):

  1. Ao tentar mover um card para "ganho" sem CNPJ preenchido, o sistema bloqueia a ação com uma mensagem clara — e a trava vale mesmo se alguém tentar contornar a validação da tela, porque o próprio RPC recusa a chamada.
  2. Preenchendo o CNPJ antes de mover o card, a mudança para "ganho" acontece normalmente (fluxo feliz continua funcionando sem fricção extra).
  3. Um cliente que já é "ganho" sem CNPJ (cadastrado antes desta trava) continua acessível normalmente na Agenda, na ficha e no diário, sem nenhum bloqueio ou erro.
  4. Antes do "ganho" — no cadastro rápido e na edição normal do cliente — o CNPJ continua opcional, sem nenhuma mudança de comportamento.

**Plans**: 2/2 plans complete

Plans:

- [x] 18-01-PLAN.md — Migration que recria `mover_card_funil` com o 7º parâmetro `p_cnpj` e o guard de CNPJ-obrigatório condicionado à TRANSIÇÃO para ganho (grandfathering do CNPJ-02, zero mudança de schema), mais os testes de integração contra o banco real — com checkpoint humano antes do push em produção
- [x] 18-02-PLAN.md — Campo CNPJ no `GanhoFrequenciaDialog` já existente, `marcarStatus` levando o valor até `p_cnpj` na mesma chamada da frequência, e a sincronização na ficha que impede o salvamento seguinte de apagar o CNPJ — com verificação humana no navegador

**UI hint**: yes

### Phase 19: Planilhas de CNPJ e Nome Fantasia

**Goal**: Dar ao Supervisor dois caminhos de planilha para o CNPJ: trazer CNPJ e Nome Fantasia junto com clientes novos na importação, e regularizar em massa o CNPJ de clientes que já são "ganho" hoje.
**Depends on**: Fase 18 não é pré-requisito técnico (a coluna `cnpj` já existe desde a Fase 13), mas a Fase 19 é ordenada depois porque a planilha "CNPJ em massa" é o caminho de regularização direto para o que a Fase 18 passa a exigir; IMP-01/IMP-02 reaproveitam o wizard "Importar clientes" já existente (Fases 6-7) e IMP-03 espelha o padrão de planilha em massa da Fase 17 (`atualizar_frequencia_visita_lote`)
**Requirements**: IMP-01, IMP-02, IMP-03
**Success Criteria** (what must be TRUE):

  1. Na planilha "Importar clientes", o Supervisor consegue mapear uma coluna para CNPJ (campo opcional) e o valor é gravado no cliente novo criado.
  2. Na mesma planilha, o Supervisor consegue mapear uma coluna para Nome Fantasia (campo opcional) e o valor é gravado no cliente novo criado.
  3. O Supervisor sobe uma nova planilha "CNPJ em massa" (Razão Social + CNPJ) e o sistema grava o CNPJ nos clientes já "ganho" correspondentes, casando por nome.
  4. Quando o nome normalizado da planilha bate em mais de um cliente (nome ambíguo), a linha vira erro e nenhum CNPJ é gravado no cliente errado.
  5. A planilha de CNPJ em massa é estruturalmente incapaz de criar um cliente novo — só atualiza clientes existentes com status "ganho".

**Plans**: 4/4 plans complete

Plans:

- [x] 19-01-PLAN.md — Camada de banco das duas planilhas, num único push de produção: `importar_clientes_lote` recriada aceitando e gravando `cnpj`/`nome_fantasia` (hoje ela descarta essas chaves em silêncio) e a função nova `atualizar_cnpj_lote` no molde de `atualizar_frequencia_visita_lote` (Fase 17) — mais os testes de integração contra o banco real, com checkpoint humano antes do push
- [x] 19-02-PLAN.md — CNPJ e Nome Fantasia atravessando a cadeia inteira do assistente "Importar clientes" já existente: vocabulário de campos, modelo baixável, apelidos de cabeçalho, resolução da linha e carga da chamada em lote — com testes unitários em cada elo
- [x] 19-03-PLAN.md — Camada sem tela da planilha "CNPJ em massa": terceiro vocabulário de campos, modelo baixável, anotação por linha com casamento por nome normalizado e recusa de nome ambíguo (a correção já provada na Fase 17), planejamento da carga/reconciliação e as duas ações de servidor
- [x] 19-04-PLAN.md — Tela da planilha "CNPJ em massa": assistente de três passos, tabela de revisão que mostra o cliente encontrado no banco antes de gravar, resumo pós-gravação, rota exclusiva de Supervisor e entrada no menu — com verificação humana no navegador incluindo o caso de nome ambíguo

**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 18. CNPJ Obrigatório no Ganho | 2/2 | Complete   | 2026-08-11 |
| 19. Planilhas de CNPJ e Nome Fantasia | 4/4 | Complete   | 2026-08-14 |
