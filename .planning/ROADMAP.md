# Roadmap: CRM Raiar — Acompanhamento de Vendas

## Overview

O CRM Raiar nasce de dentro para fora: primeiro a fundação de login e permissões (sem ela, nenhuma regra de "vendedor só vê os próprios clientes" pode existir de verdade), depois o cadastro de clientes PJ (a entidade em torno da qual tudo gira — um card do funil É um cliente), em seguida o funil kanban em si (o motivo do projeto existir), depois as telas de administração das listas editáveis (categoria, produtos, tipos de tarefa, motivos de perda), e por último o dashboard gerencial, que é uma camada de leitura sobre tudo que as fases anteriores já produziram. Cada fase entrega uma fatia completa e usável — o time consegue fazer algo novo de ponta a ponta ao final de cada uma, não apenas uma camada técnica invisível.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Autenticação e Papéis** - Usuários fazem login via Supabase Auth e o sistema distingue Supervisor de Vendedor em toda a base de dados (RLS).
- [ ] **Phase 2: Cadastro e Gestão de Clientes PJ** - Vendedores e supervisores cadastram, editam e encontram clientes PJ com o mínimo de fricção possível.
- [ ] **Phase 3: Funil de Vendas (Kanban)** - O time move clientes pelas 7 etapas do funil, com tarefas, observações, motivo de perda e histórico automático.
- [ ] **Phase 4: Administração de Listas Editáveis** - Supervisor mantém categorias, produtos, tipos de tarefa e motivos de perda sem depender de alteração de código.
- [ ] **Phase 5: Dashboard Gerencial** - Supervisor e vendedores acompanham os números do funil, cada um na medida da própria visão.

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

**Plans**: 1/5 plans executed

- [x] 01-01-PLAN.md
- [ ] 01-02-PLAN.md
- [ ] 01-03-PLAN.md
- [ ] 01-04-PLAN.md
- [ ] 01-05-PLAN.md

**UI hint**: yes

### Phase 2: Cadastro e Gestão de Clientes PJ

**Goal**: Vendedores conseguem cadastrar um cliente PJ em segundos com o mínimo de campos obrigatórios e completar o resto depois, enquanto o Supervisor enxerga e organiza a carteira inteira do time — resolvendo a fricção de preenchimento que motivou trocar de CRM.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07
**Success Criteria** (what must be TRUE):

  1. Vendedor cadastra um cliente novo informando só razão social, endereço e responsável, e o registro é salvo mesmo com os outros campos em branco.
  2. Vendedor completa depois, a qualquer momento, os campos restantes do cliente (categoria, contato, telefone, email, produtos consumidos, número de lojas).
  3. Vendedor só vê e só edita os próprios clientes (responsável = usuário logado); apagar um cliente é uma ação restrita ao Supervisor.
  4. Supervisor vê, edita e apaga todos os clientes de todos os vendedores, e consegue cadastrar um cliente já atribuindo o vendedor responsável.
  5. Qualquer usuário encontra um cliente rapidamente usando busca por texto livre (razão social) e filtros (vendedor, categoria, produto), mesmo com a lista completa do time carregada.

**Plans**: TBD
**UI hint**: yes

### Phase 3: Funil de Vendas (Kanban)

**Goal**: O time trabalha o dia a dia de vendas movendo clientes pelas 7 etapas do funil, registrando tarefas e observações, com as regras de negócio (ganho só na etapa final, motivo obrigatório em perda) garantidas pelo sistema — não só pela tela — e com visibilidade imediata do que está parado.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: FUN-01, FUN-02, FUN-03, FUN-04, FUN-05, FUN-06, FUN-07, FUN-08, FUN-09, FUN-10
**Success Criteria** (what must be TRUE):

  1. Cada cliente aparece como um card no kanban de 7 etapas fixas; Vendedor move os próprios cards entre etapas e Supervisor move o card de qualquer vendedor.
  2. Um card só pode ser marcado como "ganho" quando está na etapa "1ª venda concluída" — em qualquer outra etapa essa opção fica indisponível, mesmo tentando pela API diretamente.
  3. Ao marcar um card como "perdido", o sistema exige que um motivo de perda seja escolhido antes de salvar a mudança.
  4. Cada card tem uma observação em texto livre e uma lista de tarefas (cada uma com sua data de conclusão), e cards parados ou atrasados aparecem visualmente destacados assim que a tela do kanban é aberta.
  5. Cada cliente tem um histórico visível de mudanças (etapa, status, tarefas concluídas) com data e hora, gerado automaticamente sem esforço manual.

**Plans**: TBD
**UI hint**: yes

### Phase 4: Administração de Listas Editáveis

**Goal**: O Supervisor mantém as quatro listas que alimentam cadastro de clientes e funil (categoria, produtos consumidos, tipos de tarefa, motivos de perda) direto pela interface, sem precisar pedir uma alteração de código a cada novo valor.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: ADM-01, ADM-02, ADM-03, ADM-04
**Success Criteria** (what must be TRUE):

  1. Supervisor cadastra, edita e remove categorias de cliente, e a mudança aparece imediatamente onde categoria é usada (cadastro de cliente, filtros).
  2. Supervisor cadastra, edita e remove produtos consumidos, refletido nos cadastros de cliente e nos filtros da lista.
  3. Supervisor cadastra, edita e remove tipos de tarefa, refletido na criação de tarefas dentro dos cards do funil.
  4. Supervisor cadastra, edita e remove motivos de perda, refletido na tela de marcar um card como perdido.
  5. Vendedor não consegue acessar nenhuma dessas telas de administração — a restrição é aplicada pelo sistema (RLS/permissão), não só ocultada do menu.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Dashboard Gerencial

**Goal**: Supervisor e Vendedores enxergam a saúde do funil em números — cada um na medida da própria visão — dando ao Supervisor a informação gerencial que faltava para cancelar o CRM pago atual.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: DSH-01, DSH-02, DSH-03, DSH-04, DSH-05, DSH-06, DSH-07
**Success Criteria** (what must be TRUE):

  1. Dashboard mostra quantos clientes estão em cada etapa do funil.
  2. Dashboard mostra ganhos x perdidos num período e a taxa de conversão correspondente.
  3. Dashboard mostra o desempenho de cada vendedor, visível para quem tem permissão de ver o time inteiro.
  4. Dashboard mostra prospecções agrupadas por produto e por categoria.
  5. Vendedor abre o dashboard e vê só os próprios números; Supervisor abre o mesmo dashboard e vê os números de todo o time.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Autenticação e Papéis | 1/5 | In Progress|  |
| 2. Cadastro e Gestão de Clientes PJ | 0/TBD | Not started | - |
| 3. Funil de Vendas (Kanban) | 0/TBD | Not started | - |
| 4. Administração de Listas Editáveis | 0/TBD | Not started | - |
| 5. Dashboard Gerencial | 0/TBD | Not started | - |
