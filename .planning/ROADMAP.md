# Roadmap: CRM Raiar — Acompanhamento de Vendas

## Overview

O CRM Raiar nasce de dentro para fora: primeiro a fundação de login e permissões (sem ela, nenhuma regra de "vendedor só vê os próprios clientes" pode existir de verdade), depois o cadastro de clientes PJ e o funil kanban juntos numa fase só (a pedido do dono do projeto, pra já ver o produto completo — cadastro + colunas do funil — funcionando mais cedo), depois as telas de administração das listas editáveis (categoria, produtos, tipos de tarefa, motivos de perda), e por último o dashboard gerencial, que é uma camada de leitura sobre tudo que as fases anteriores já produziram. Cada fase entrega uma fatia completa e usável — o time consegue fazer algo novo de ponta a ponta ao final de cada uma, não apenas uma camada técnica invisível.

**Marco v1.1 (Importação e Exportação):** com o CRM já em uso no dia a dia, o próximo passo é tirar do caminho o cadastro manual um-a-um para grandes volumes. O time recebe planilhas de clientes/leads com frequência (parceiros, feiras), então a importação vira uma tela permanente restrita ao Supervisor; e todo usuário passa a poder exportar a lista que já enxerga. As três fases novas (5, 6, 7) seguem a ordem de menor risco: exportar primeiro (reaproveita leitura + RLS já existentes, sem RPC nova), depois preparar/revisar a importação (upload, mapeamento de colunas e revisão linha a linha, sem gravar), e por fim confirmar/gravar (nova RPC de inserção em lote).

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Autenticação e Papéis** - Usuários fazem login via Supabase Auth e o sistema distingue Supervisor de Vendedor em toda a base de dados (RLS).
- [x] **Phase 2: Cadastro e Funil de Vendas** - Vendedores e supervisores cadastram, editam e encontram clientes PJ, e movem os clientes pelas 7 etapas do funil kanban, com o mínimo de fricção possível. (completed 2026-07-17)
- [x] **Phase 3: Administração de Listas Editáveis** - Supervisor mantém categorias, produtos, tipos de tarefa e motivos de perda sem depender de alteração de código. (completed 2026-07-18)
- [x] **Phase 4: Dashboard Gerencial** - Supervisor e vendedores acompanham os números do funil, cada um na medida da própria visão. (completed 2026-07-19)

**🚧 Marco v1.1 — Importação e Exportação de Clientes (Fases 5-7):**

- [x] **Phase 5: Exportação de Clientes** - Vendedor e Supervisor baixam como planilha a lista de clientes que já enxergam na tela, respeitando papel (próprios x todos) e os filtros aplicados. (completed 2026-07-22)
- [x] **Phase 6: Importação — Upload, Mapeamento e Revisão** - Supervisor envia uma planilha, mapeia as colunas para os campos do sistema e revê linha a linha (OK / erro / possível duplicado) — sem gravar nada ainda. (completed 2026-07-24)
- [ ] **Phase 7: Importação — Confirmação e Gravação** - Supervisor confirma e os clientes válidos entram de uma vez na etapa "Aguardando contato", sem uma linha ruim travar o lote.

## Phase Details

### Phase 1: Autenticação e Papéis

**Goal**: Todo usuário do time consegue se cadastrar e entrar no sistema com segurança, e a distinção entre Supervisor e Vendedor já está em vigor no banco de dados (via RLS) — a base de autorização que toda fase seguinte depende para existir.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):

  1. Usuário se cadastra informando email, nome, sobrenome, senha e celular, e consegue fazer login com email e senha logo em seguida.
  2. Usuário permanece logado entre acessos — não precisa entrar com a senha toda vez que abre o sistema.
  3. O sistema reconhece se o usuário logado é Supervisor ou Vendedor e reflete esse papel na interface (ex: menu ou perfil), aplicando permissões diferentes de acordo.
  4. Um Vendedor não consegue, nem manipulando a URL ou a API diretamente, acessar ou alterar dados de outro usuário — a regra é aplicada pelo banco de dados (RLS), não só escondida na tela.

**Plans**: 4/5 plans executed (01-05 code complete, Task 4 manual email-verification checkpoint deferred at owner's request — see 01-05-SUMMARY.md "Open Item: Task 4")

- [x] 01-01-PLAN.md
- [x] 01-02-PLAN.md
- [x] 01-03-PLAN.md
- [x] 01-04-PLAN.md
- [ ] 01-05-PLAN.md (Tasks 1-3 done; Task 4 deferred, not approved)

**UI hint**: yes

### Phase 2: Cadastro e Funil de Vendas

**Goal**: Vendedores conseguem cadastrar um cliente PJ em segundos com o mínimo de campos obrigatórios, completar o resto depois, e mover cada cliente pelas 7 etapas do funil kanban no dia a dia de vendas, enquanto o Supervisor enxerga e organiza a carteira inteira do time — resolvendo a fricção de preenchimento que motivou trocar de CRM e entregando o produto completo (cadastro + funil) numa fatia só, a pedido do dono do projeto.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07, FUN-01, FUN-02, FUN-03, FUN-04, FUN-05, FUN-06, FUN-07, FUN-08, FUN-09, FUN-10
**Success Criteria** (what must be TRUE):

  1. Vendedor cadastra um cliente novo informando só razão social, endereço e responsável, e o registro é salvo mesmo com os outros campos em branco.
  2. Vendedor completa depois, a qualquer momento, os campos restantes do cliente (categoria, contato, telefone, email, produtos consumidos, número de lojas), com um filtro "incompletos" na lista principal e um selo visual indicando cadastro incompleto.
  3. Vendedor só vê e só edita os próprios clientes (responsável = usuário logado); apagar um cliente é uma ação restrita ao Supervisor.
  4. Supervisor vê, edita e apaga todos os clientes de todos os vendedores, e consegue cadastrar um cliente já atribuindo o vendedor responsável.
  5. Qualquer usuário encontra um cliente rapidamente usando busca por texto livre (razão social) e filtros (vendedor, categoria, produto), mesmo com a lista completa do time carregada.
  6. Cada cliente aparece como um card no kanban de 7 etapas fixas; Vendedor move os próprios cards entre etapas e Supervisor move o card de qualquer vendedor.
  7. Um card só pode ser marcado como "ganho" quando está na etapa "1ª venda concluída" — em qualquer outra etapa essa opção fica indisponível, mesmo tentando pela API diretamente.
  8. Ao marcar um card como "perdido", o sistema exige que um motivo de perda seja escolhido antes de salvar a mudança.
  9. Cada card tem uma observação em texto livre e uma lista de tarefas (cada uma com sua data de conclusão), e cards parados ou atrasados aparecem visualmente destacados assim que a tela do kanban é aberta.
  10. Cada cliente tem um histórico visível de mudanças (etapa, status, tarefas concluídas) com data e hora, gerado automaticamente sem esforço manual.

**Plans**: 7/7 plans complete
**Wave 1**

- [x] 02-01-PLAN.md — Data model foundation: clientes + editable-list tables + funil, RLS + business-rule CHECK constraints (test-proven), migration pushed

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Cadastro rápido: quick-create dialog + createCliente action + /clientes page + nav link

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Kanban board render: 7 fixed columns + compact ClienteCard

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — Kanban drag-and-drop (dnd-kit) + mover card via RPC + stalled/overdue highlight

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-05-PLAN.md — Busca, filtros, abas Todos/Incompletos + card badge/quick-actions

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 02-06-PLAN.md — Detail Sheet (Dados do cliente): edição + apagar (supervisor-only)

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 02-07-PLAN.md — Detail Sheet (Funil): status, observação, tarefas, histórico + modal de perda

**UI hint**: yes

### Phase 3: Administração de Listas Editáveis

**Goal**: O Supervisor mantém as quatro listas que alimentam cadastro de clientes e funil (categoria, produtos consumidos, tipos de tarefa, motivos de perda) direto pela interface, sem precisar pedir uma alteração de código a cada novo valor.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: ADM-01, ADM-02, ADM-03, ADM-04
**Success Criteria** (what must be TRUE):

  1. Supervisor cadastra, edita e remove categorias de cliente, e a mudança aparece imediatamente onde categoria é usada (cadastro de cliente, filtros).
  2. Supervisor cadastra, edita e remove produtos consumidos, refletido nos cadastros de cliente e nos filtros da lista.
  3. Supervisor cadastra, edita e remove tipos de tarefa, refletido na criação de tarefas dentro dos cards do funil.
  4. Supervisor cadastra, edita e remove motivos de perda, refletido na tela de marcar um card como perdido.
  5. Vendedor não consegue acessar nenhuma dessas telas de administração — a restrição é aplicada pelo sistema (RLS/permissão), não só ocultada do menu.

**Plans**: 3/3 plans complete

**Wave 1**

- [x] 03-01-PLAN.md — Espinha: rota Configurações protegida (Supervisor-only) + abas + aba Categoria com "Adicionar" + Server Actions/validação + teste de contrato RLS das 4 tabelas (ADM-01)

**Wave 2** *(blocked on Wave 1)*

- [x] 03-02-PLAN.md — CRUD completo na aba Categoria: editar inline (D-04), desativar/reativar soft-delete (D-03), toggle "Mostrar inativos" + Switch (ADM-01)

**Wave 3** *(blocked on Wave 2)*

- [x] 03-03-PLAN.md — Ligar as outras 3 abas (Produtos/Tipos de tarefa/Motivos de perda) reusando o componente + checkpoint humano de reflexo downstream (ADM-02, ADM-03, ADM-04)

**Nota de schema:** nenhuma migração criada — a constraint `unique(nome)` e as políticas RLS de escrita Supervisor-only já existiam nas 4 tabelas desde a migração 0002 (Fase 2).

**UI hint**: yes

### Phase 4: Dashboard Gerencial

**Goal**: Supervisor e Vendedores enxergam a saúde do funil em números — cada um na medida da própria visão — dando ao Supervisor a informação gerencial que faltava para cancelar o CRM pago atual.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: DSH-01, DSH-02, DSH-03, DSH-04, DSH-05, DSH-06, DSH-07
**Success Criteria** (what must be TRUE):

  1. Dashboard mostra quantos clientes estão em cada etapa do funil.
  2. Dashboard mostra ganhos x perdidos num período e a taxa de conversão correspondente.
  3. Dashboard mostra o desempenho de cada vendedor, visível para quem tem permissão de ver o time inteiro.
  4. Dashboard mostra prospecções agrupadas por produto e por categoria.
  5. Vendedor abre o dashboard e vê só os próprios números; Supervisor abre o mesmo dashboard e vê os números de todo o time.

**Plans**: 5/5 plans complete

**Wave 1** *(parallel — no file overlap)*

- [x] 04-01-PLAN.md — Backend: 5 SECURITY-INVOKER aggregate SQL functions (`0003_dashboard_aggregates.sql`) + query/action layer + período util + full behavior/RLS test suite + [BLOCKING] `supabase db push` (DSH-01..07)
- [x] 04-02-PLAN.md — Instala o componente Chart do shadcn (recharts) atrás de checkpoint humano de legitimidade + override `--chart-1` para o azul `--primary` (DSH-01, DSH-03, DSH-05)

**Wave 2** *(blocked on Wave 1)*

- [x] 04-03-PLAN.md — Tela `/dashboard` + link no menu (D-03) + orquestrador + filtro de período (D-01) + gráfico "Clientes por etapa" (D-04/D-08) (DSH-01, DSH-06, DSH-07)

**Wave 3** *(blocked on Wave 2)*

- [x] 04-04-PLAN.md — KPIs em destaque: Ganhos / Perdidos / Taxa de conversão, reagindo ao período (D-05/D-02) (DSH-02, DSH-04)

**Wave 4** *(blocked on Wave 3)*

- [x] 04-05-PLAN.md — "Desempenho por vendedor" (barras horizontais, só Supervisor, D-06/D-10) + "Prospecção por produto/categoria" (D-09) + checkpoint humano final (DSH-03, DSH-05, DSH-07)

**UI hint**: yes

---

**🚧 Marco v1.1 — Importação e Exportação de Clientes (Fases 5-7)**

Continuação da numeração do v1.0 (que terminou na Fase 4). Ordem baseada em risco: exportação primeiro (reaproveita leitura + RLS já existentes, sem RPC nova), depois a preparação da importação (upload, mapeamento e revisão, sem gravar nada), e por fim a confirmação/gravação (nova RPC de inserção em lote — o único caminho de escrita, onde ficam os riscos de timeout serverless e importação parcial).

### Phase 5: Exportação de Clientes

**Goal**: Qualquer usuário do time consegue baixar, como planilha, exatamente a lista de clientes que já enxerga na tela — respeitando papel (Vendedor exporta só os próprios, Supervisor exporta todos) e os filtros aplicados — reaproveitando as mesmas regras de visibilidade (RLS) que já existem, sem nenhuma lógica de permissão nova. É a fase de menor risco do marco: leitura pura, sem RPC nem escrita.
**Depends on**: Phase 2 (lista de clientes, filtros e RLS de v1.0 já entregues)
**Requirements**: EXP-01, EXP-02, EXP-03
**Success Criteria** (what must be TRUE):

  1. Um Vendedor clica em "Exportar" na lista de clientes e recebe um arquivo (.csv/.xlsx) contendo apenas os próprios clientes.
  2. Um Supervisor clica em "Exportar" e recebe um arquivo contendo os clientes de todos os vendedores.
  3. Quando há filtros aplicados na tela (categoria, vendedor, produto, texto livre por razão social), o arquivo exportado contém somente os clientes que correspondem a esses filtros — não a base inteira.
  4. O arquivo abre corretamente em Excel/planilha (uma coluna por campo do cliente, uma linha por cliente) e nenhum valor de célula é interpretado como fórmula ao abrir (proteção contra CSV injection).

**Plans**: 2/2 plans complete

**Wave 1**

- [x] 05-01-PLAN.md — Camada de dados: query RLS-scoped `getClientesParaExportacao` + helper `.xlsx` (`@e965/xlsx`, atrás de checkpoint humano de legitimidade) com proteção contra formula injection (EXP-01, EXP-02, EXP-03)

**Wave 2** *(blocked on Wave 1)*

- [x] 05-02-PLAN.md — Route Handler `POST /api/clientes/exportar` + botão "Exportar" (envia os ids já filtrados na tela) + checkpoint humano do download real (EXP-01, EXP-02, EXP-03)

### Phase 6: Importação — Upload, Mapeamento e Revisão

**Goal**: O Supervisor prepara uma importação de ponta a ponta antes de qualquer gravação: baixa um modelo de planilha, envia o arquivo (.xlsx/.csv), diz qual coluna do arquivo corresponde a qual campo do sistema (incluindo qual coluna define o vendedor responsável de cada cliente), e vê uma tela de revisão que classifica cada linha como OK, erro ou possível duplicado. Nada é criado nesta fase — é só pré-visualização, o que a torna testável de forma independente e sem risco para os dados existentes.
**Depends on**: Phase 2 (reaproveita as regras mínimas de cadastro — razão social, endereço, responsável — e a base de clientes/vendedores para validar e detectar duplicados)
**Requirements**: IMP-02, IMP-03, IMP-04, IMP-05, IMP-07, IMP-08, IMP-10
**Success Criteria** (what must be TRUE):

  1. Só o Supervisor acessa a tela de importação; um Vendedor não vê essa opção nem consegue abrir a tela, e a restrição é aplicada pelo sistema (não apenas escondida do menu).
  2. O Supervisor baixa um modelo de planilha (uma versão vazia + uma linha de exemplo) com exatamente as colunas que o sistema espera.
  3. Depois de enviar a planilha, o Supervisor associa cada coluna do arquivo a um campo do sistema — incluindo a coluna que define o vendedor responsável — e pode marcar colunas como "não importar".
  4. A tela de revisão mostra cada linha com um status claro: OK, erro (faltando razão social, endereço ou responsável) ou possível duplicado (mesma razão social de um cliente já existente), sem bloquear nem mesclar automaticamente — a decisão fica com o Supervisor.
  5. Nenhum cliente é criado nesta etapa — é apenas pré-visualização; nada é gravado até a confirmação da fase seguinte.

**Plans**: 4 plans

**Wave 1**

- [ ] 06-01-PLAN.md — Motor de leitura client-side (.xlsx/.csv, BOM/delimitador pt-BR) + modelo de planilha (IMP-02) + vocabulário de campos, com checkpoint de legitimidade do papaparse

**Wave 2** *(parallel — no file overlap)*

- [ ] 06-02-PLAN.md — Validação read-only: dedupe (IMP-07), schema/anotação de linha (IMP-04/IMP-05, D-02) e Server Action validarLoteImportacao com portão Supervisor-only (IMP-10)
- [ ] 06-03-PLAN.md — Rota Supervisor-only /clientes/importar + link no menu + passo 1 do wizard (baixar modelo + upload + parse) (IMP-02, IMP-10)

**Wave 3** *(blocked on 06-02 + 06-03)*

- [ ] 06-04-PLAN.md — Mapeamento de colunas (IMP-03/IMP-04) + tela de revisão OK/erro/duplicado paginada (IMP-07/IMP-08) + checkpoint humano do fluxo completo

**UI hint**: yes

### Phase 7: Importação — Confirmação e Gravação

**Goal**: O Supervisor confirma a importação revisada e os clientes das linhas válidas entram no sistema de uma só vez, cada um já na etapa "Aguardando contato" do funil, sem que uma linha com erro (ou um duplicado que ele optou por pular) trave o restante do lote. É a única fase de escrita do marco, onde vive a nova RPC de inserção em lote.
**Depends on**: Phase 6
**Requirements**: IMP-01, IMP-06, IMP-09
**Success Criteria** (what must be TRUE):

  1. Ao confirmar a revisão, os clientes das linhas válidas da planilha (.xlsx/.csv) são criados de uma só vez — o Supervisor completa uma importação em massa sem cadastrar um a um.
  2. Linhas marcadas como erro — e duplicados que o Supervisor escolheu não importar — ficam de fora, enquanto todas as demais linhas válidas são importadas normalmente; uma linha ruim não cancela o lote inteiro.
  3. Todo cliente importado aparece no funil já na etapa "Aguardando contato".
  4. Ao final, o Supervisor vê um resumo de quantos clientes foram importados e quantas linhas foram ignoradas (com o motivo).

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Autenticação e Papéis | 4/5 | Blocked (01-05 Task 4 manual verification deferred) |  |
| 2. Cadastro e Funil de Vendas | 7/7 | Complete   | 2026-07-17 |
| 3. Administração de Listas Editáveis | 3/3 | Complete   | 2026-07-18 |
| 4. Dashboard Gerencial | 5/5 | Complete   | 2026-07-19 |
| 5. Exportação de Clientes | 2/2 | Complete   | 2026-07-22 |
| 6. Importação — Upload, Mapeamento e Revisão | 4/4 | Complete   | 2026-07-24 |
| 7. Importação — Confirmação e Gravação | 0/TBD | Not started | - |
