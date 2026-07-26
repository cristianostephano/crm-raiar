# Roadmap: CRM Raiar — Acompanhamento de Vendas

## Overview

O CRM Raiar nasce de dentro para fora: primeiro a fundação de login e permissões, depois o cadastro de clientes PJ e o funil kanban, as telas de administração das listas editáveis, e o dashboard gerencial (v1.0 MVP). Em seguida, com o CRM já em uso no dia a dia, o marco v1.1 adicionou importação em massa de clientes via planilha (restrita ao Supervisor) e exportação da lista de clientes. O marco atual, v1.2, dá ao Supervisor mais controle sobre a equipe (desativar membros), mais visibilidade sobre onde o funil trava (análises por etapa e por vendedor) e deixa os filtros de localização mais confiáveis (Estado/Cidade estruturados).

Detalhes completos de cada marco arquivado estão em `.planning/milestones/`.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-20)
- ✅ **v1.1 Importação e Exportação de Clientes** — Phases 5-7 (shipped 2026-07-25) — see `.planning/milestones/v1.1-ROADMAP.md`
- 🚧 **v1.2 Gestão de Equipe, Análises de Funil e Filtros** — Phases 8-12 (planning started 2026-07-25)

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

### 🚧 v1.2 Gestão de Equipe, Análises de Funil e Filtros (Phases 8-12) — IN PROGRESS

- [x] **Phase 8: Rolagem por Coluna no Kanban** - Cada coluna do kanban ganha altura fixa e rolagem própria, evitando a página infinita quando há muitos clientes. (completed 2026-07-26)
- [ ] **Phase 9: Filtros de Estado e Cidade Estruturados** - Estado (27 siglas) e Cidade (lista IBGE dependente do Estado) viram listas estruturadas em cadastro, edição, filtro e importação.
- [ ] **Phase 10: Desativação de Membro da Equipe** - Supervisor desativa um membro transferindo antes os clientes em andamento, com trava contra desativar o último Supervisor.
- [ ] **Phase 11: Funil de Conversão Detalhado** - Dashboard ganha o funil de conversão por etapa (negócios, avanço%, perdidos, tempo médio) e a média de dias até ganhar/perder.
- [ ] **Phase 12: Comparativo por Vendedor** - Supervisor vê uma tabela comparando os vendedores ativos (conversão, negócios iniciados/ganhos, ciclo médio).

## Phase Details

### Phase 8: Rolagem por Coluna no Kanban

**Goal**: Deixar o kanban usável com muitos clientes — cada coluna rola por dentro em vez de esticar a página inteira.
**Depends on**: Nada (independente; pode rodar cedo e em paralelo com a Fase 9)
**Requirements**: KAN-01, KAN-02
**Success Criteria** (what must be TRUE):

  1. Cada coluna do kanban tem altura fixa e rola por dentro quando tem muitos clientes, sem esticar a página inteira.
  2. Todas as colunas têm a mesma altura, estejam cheias ou vazias.
  3. O cabeçalho de cada coluna (título + contagem de clientes) continua visível enquanto a lista de cards rola.
  4. Arrastar e soltar cards entre colunas continua funcionando normalmente com a rolagem ativa.

**Plans**: 1/1 plans complete

- [x] 08-01-PLAN.md — Altura fixa + scroll interno por coluna, header fixo, fade condicional e measuring do dnd-kit (KAN-01, KAN-02)

**UI hint**: yes

### Phase 9: Filtros de Estado e Cidade Estruturados

**Goal**: Tornar Estado e Cidade listas estruturadas e confiáveis em todo lugar que aparecem (cadastro, edição, filtro e importação).
**Depends on**: Nada (independente; pode rodar em paralelo com a Fase 8)
**Requirements**: LOC-01, LOC-02, LOC-03, LOC-04
**Success Criteria** (what must be TRUE):

  1. Estado é escolhido de uma lista fixa das 27 siglas de UF (SP, RJ...) em cadastro, edição, filtro e importação — não é mais texto livre.
  2. Cidade é escolhida de uma lista oficial de municípios (IBGE, previamente carregada), filtrada pelo Estado selecionado; trocar de Estado troca a lista de cidades disponíveis.
  3. No filtro de clientes, o campo Estado aparece antes do campo Cidade.
  4. Clientes cadastrados antes, com Estado escrito por extenso ou de forma inconsistente, aparecem normalizados para a sigla correta, sem perder dados nem travar o acesso ao registro.

**Plans**: 6 plans (3 waves) — 2/6 complete (Wave 1 done)

- [x] 09-01-PLAN.md — Fundação de dados: migration cidades (seed IBGE) + RPC cidades_por_estado + constraint chk_estado_valido + push em produção [wave 1]
- [x] 09-02-PLAN.md — Primitivos de frontend: constante UFS + normalizarEstado (LOC-04) + componente base combobox [wave 1]
- [ ] 09-03-PLAN.md — Schema Zod (estado: z.enum(UFS)) + componente compartilhado EstadoCidadeFields (cascata Estado→Cidade) [wave 2]
- [ ] 09-04-PLAN.md — Filtro: Estado antes de Cidade (LOC-03) + Combobox de Cidade + exact-match + remoção de estadoOptions [wave 2]
- [ ] 09-05-PLAN.md — Formulários de cadastro e edição usam EstadoCidadeFields [wave 3]
- [ ] 09-06-PLAN.md — Validação server-side: importação (annotarLinha) + re-validação em createCliente/updateCliente [wave 3]

**UI hint**: yes

### Phase 10: Desativação de Membro da Equipe

**Goal**: Permitir que o Supervisor remova (desative) um membro da equipe com segurança, transferindo antes os clientes em andamento e sem nunca ficar sem Supervisor.
**Depends on**: Nada funcionalmente — mas precede a Fase 12 (a coluna `profiles.ativo` que esta fase cria é o que sustenta a lista de "vendedores ativos" do comparativo)
**Requirements**: EQP-01, EQP-02, EQP-03, EQP-04
**Success Criteria** (what must be TRUE):

  1. O Supervisor desativa um vendedor escolhendo, antes de confirmar, um substituto que herda os clientes em andamento desse vendedor.
  2. O sistema impede desativar o último Supervisor ativo, explicando o motivo em vez de deixar o sistema sem gestor.
  3. Um membro desativado não consegue mais entrar no sistema, mas o nome dele e o histórico antigo continuam visíveis e intactos.
  4. Clientes já ganhos ou perdidos do vendedor desativado continuam atribuídos a ele (contam nos números históricos); só os clientes em andamento são transferidos ao substituto.

**Plans**: TBD
**UI hint**: yes

### Phase 11: Funil de Conversão Detalhado

**Goal**: Dar ao dashboard visibilidade de onde o funil trava — métricas de conversão e de tempo por etapa — respeitando a mesma regra de visão por papel.
**Depends on**: Nada funcionalmente — estabelece a lógica de reconstrução de duração (a partir do `historico`) que a Fase 12 reutiliza para o ciclo médio
**Requirements**: FNL-01, FNL-02, FNL-03
**Success Criteria** (what must be TRUE):

  1. O dashboard mostra, por etapa do funil: quantidade de clientes, % que avançou para a próxima etapa, quantos foram perdidos ali (contagem e taxa) e tempo médio parado na etapa.
  2. O tempo médio por etapa inclui os clientes que ainda estão parados nela agora (usando o momento atual como saída provisória) — de propósito, para revelar cards travados, não como erro.
  3. O dashboard mostra a média de dias entre entrada no funil e "ganho", separada da média de dias até "perdido".
  4. Vendedor vê o funil detalhado só com os próprios clientes; Supervisor vê o de todo o time — mesma regra de visibilidade do dashboard atual.

**Plans**: TBD
**UI hint**: yes

### Phase 12: Comparativo por Vendedor

**Goal**: Dar ao Supervisor uma tabela lado a lado comparando o desempenho dos vendedores ativos.
**Depends on**: Fase 10 (coluna `profiles.ativo` que define quem é vendedor ativo) e Fase 11 (lógica de reconstrução de duração para o ciclo médio em dias)
**Requirements**: VEND-01
**Success Criteria** (what must be TRUE):

  1. O Supervisor vê uma tabela comparando os vendedores ativos: taxa de conversão, negócios iniciados, negócios ganhos e ciclo médio em dias.
  2. A tabela é visível só para o Supervisor; o Vendedor não a acessa.
  3. Vendedores desativados não aparecem na lista de comparação de ativos, mas seus números históricos continuam contando onde já contavam (clientes ganhos/perdidos atribuídos a eles).

**Plans**: TBD
**UI hint**: yes

### 📋 Next Milestone (Not Planned)

Agenda do vendedor (prospecção + pós-venda) — capturada como seed (`.planning/seeds/SEED-001-agenda-do-vendedor.md`), vai puxar automaticamente na próxima `/gsd-new-milestone` depois que v1.2 fechar.

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
| 8. Rolagem por Coluna no Kanban | v1.2 | 1/1 | Complete   | 2026-07-26 |
| 9. Filtros de Estado e Cidade Estruturados | v1.2 | 2/6 | In progress | - |
| 10. Desativação de Membro da Equipe | v1.2 | 0/? | Not started | - |
| 11. Funil de Conversão Detalhado | v1.2 | 0/? | Not started | - |
| 12. Comparativo por Vendedor | v1.2 | 0/? | Not started | - |
</content>
</invoke>
