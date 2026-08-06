# Roadmap: CRM Raiar — Acompanhamento de Vendas

## Overview

O CRM Raiar nasce de dentro para fora: primeiro a fundação de login e permissões, depois o cadastro de clientes PJ e o funil kanban, as telas de administração das listas editáveis, e o dashboard gerencial (v1.0 MVP). Em seguida, com o CRM já em uso no dia a dia, o marco v1.1 adicionou importação em massa de clientes via planilha (restrita ao Supervisor) e exportação da lista de clientes. O marco v1.2 deu ao Supervisor mais controle sobre a equipe (desativar membros), mais visibilidade sobre onde o funil trava (análises por etapa e por vendedor) e deixou os filtros de localização mais confiáveis (Estado/Cidade estruturados).

Detalhes completos de cada marco arquivado estão em `.planning/milestones/`.

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-07-20)
- ✅ **v1.1 Importação e Exportação de Clientes** — Phases 5-7 (shipped 2026-07-25) — see `.planning/milestones/v1.1-ROADMAP.md`
- ✅ **v1.2 Gestão de Equipe, Análises de Funil e Filtros** — Phases 8-12 (shipped 2026-08-06) — see `.planning/milestones/v1.2-ROADMAP.md`

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
| 9. Filtros de Estado e Cidade Estruturados | v1.2 | 6/6 | Complete | 2026-07-26 |
| 10. Desativação de Membro da Equipe | v1.2 | 6/6 | Complete   | 2026-08-03 |
| 11. Funil de Conversão Detalhado | v1.2 | 5/5 | Complete   | 2026-07-28 |
| 12. Comparativo por Vendedor | v1.2 | 4/4 | Complete   | 2026-08-05 |
</content>
</invoke>
