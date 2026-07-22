# CRM Raiar — Acompanhamento de Vendas

## What This Is

Um CRM de acompanhamento de vendas (funil/kanban) para substituir um CRM pago de custo elevado. Vendedores cadastram e trabalham clientes PJ ao longo de um funil de 7 etapas, do primeiro contato até a primeira venda concluída; um supervisor acompanha todos os clientes do time e tem um dashboard gerencial. MVP construído com custo zero de infraestrutura, pra validar a ideia antes de qualquer investimento em escala.

## Core Value

O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado — porque hoje o preenchimento no CRM pago é ruim (telas longas, esquecimento) e isso é o motivo real de trocar de ferramenta.

## Business Context

- **Customer**: equipe interna de vendas (vendedores + supervisor) — uso interno, não é um produto vendido a terceiros
- **Revenue model**: nenhum — o retorno é econômico (deixar de pagar pelo CRM atual)
- **Success metric**: time passa a usar o funil no dia a dia e o sistema cobre as necessidades gerenciais (incluindo dashboard) a ponto de o CRM pago poder ser cancelado
- **Strategy notes**: —

## Current Milestone: v1.1 Importação e Exportação de Clientes

**Goal:** Dar ao supervisor uma forma de trazer clientes em massa via planilha e exportar a lista de clientes, sem depender mais de cadastro manual um a um pra grandes volumes.

**Target features:**
- Importação de clientes via planilha (Excel/CSV), recorrente, restrita ao Supervisor
- Tela de mapear colunas da planilha pros campos do sistema
- Mostrar erros/duplicados antes de confirmar a importação
- Cliente importado sempre entra na etapa "Aguardando contato"
- Exportação da lista de clientes (Vendedor exporta só os próprios, Supervisor exporta todos)

## Requirements

### Validated

- ✓ Vendedor cadastra cliente PJ com mínimo obrigatório (razão social, endereço, responsável) e completa os demais dados depois — v1.0
- ✓ Cliente PJ tem: razão social, endereço (CEP, rua, número, complemento), categoria, contato, telefone, email, responsável, produtos consumidos, número de lojas (opcional) — v1.0
- ✓ Vendedor visualiza e movimenta no funil (kanban de 7 etapas) apenas os próprios clientes — v1.0
- ✓ Supervisor visualiza e movimenta no funil todos os clientes, de todos os vendedores — v1.0
- ✓ Vendedor pode editar os próprios clientes; apagar cliente é restrito ao supervisor — v1.0
- ✓ Supervisor pode cadastrar um cliente e atribuir a um vendedor específico — v1.0
- ✓ Card no funil tem status_acompanhamento: em andamento, perdido, ou ganho — v1.0
- ✓ Ao marcar um card como perdido, é obrigatório registrar o motivo (lista de motivos editável pelo supervisor) — v1.0
- ✓ Card tem observação (texto livre) e tarefas (lista editável pelo supervisor), cada tarefa com sua própria data de conclusão — v1.0
- ✓ Cards parados/atrasados ficam visualmente destacados no kanban ao abrir a tela — v1.0
- ✓ Histórico automático de mudanças por cliente (etapa, status, tarefas concluídas) — v1.0
- ✓ Busca e filtro na lista de clientes (por vendedor, categoria, produto, texto livre por razão social) — v1.0
- ✓ Supervisor faz CRUD de 4 listas editáveis: categoria do cliente, produtos consumidos, tipos de tarefa, motivos de perda — v1.0
- ✓ Autenticação via Supabase Auth com dois papéis (Supervisor, Vendedor) — v1.0
- ✓ Dashboard gerencial: clientes por etapa do funil, ganhos x perdidos, desempenho por vendedor, taxa de conversão, prospecções por produto e por categoria — v1.0
- ✓ Vendedor vê uma versão do dashboard só com os próprios números; supervisor vê os números de todo o time — v1.0

### Active

- [ ] Supervisor importa clientes em massa via planilha (Excel/CSV), com tela de mapeamento de colunas
- [ ] Sistema mostra erros e duplicados antes de confirmar a importação
- [ ] Cliente importado sempre entra na etapa "Aguardando contato" do funil
- [ ] Vendedor exporta a lista dos próprios clientes; Supervisor exporta a lista de todos os clientes

### Out of Scope

- Notificações ativas (email, push) de tarefas atrasadas — destaque visual no kanban já resolve o problema de esquecimento, sem custo/complexidade de um serviço de notificação
- Colunas do funil editáveis por permissão — as 7 etapas ficam fixas no código, pra reduzir complexidade
- App mobile nativo — web responsivo é suficiente
- Integração contínua (sync/API) com o CRM pago atual — o objetivo é substituí-lo, não integrar com ele
- Importação em massa pelo Vendedor — restrita ao Supervisor nesta versão, decisão explícita do dono do projeto

## Context

- **Motivação**: hoje a empresa paga por um CRM externo com custo elevado, e o time de vendas não preenche direito — telas com muitos campos e esquecimento de atualizar o funil são as duas causas apontadas pelo usuário.
- **Origem do mapeamento de domínio**: existe um wireframe (Excalidraw) do fluxo de vendas atual, já documentado em `CLAUDE.md` — usuários/papéis, cliente PJ, funil de 7 etapas e os 3 enums editáveis originais (categoria, produtos consumidos, tipos de tarefa). O motivo de perda (4º enum editável) surgiu durante esta conversa de inicialização.
- **Migração de dados**: existe uma base de clientes no CRM pago atual que precisa ser trazida para o sistema novo. Na v1.0 isso foi tratado como migração única, fora da UI — na v1.1 essa decisão foi revista: o time recebe planilhas de clientes/leads com frequência (parceiros, feiras), então a importação vira uma tela permanente do sistema, restrita ao Supervisor.
- **Perfil do usuário**: quem pilota o projeto não programa. Explicações devem evitar jargão técnico, focar em sintomas observáveis, e mudanças grandes precisam de um plano em linguagem simples antes de qualquer implementação.

## Constraints

- **Custo**: free tier do Supabase (Postgres + Auth + Storage) + Vercel — objetivo é validar a ideia com custo zero de infraestrutura antes de investir em escala
- **Stack**: Next.js (React/TypeScript) + Supabase — fixado em `CLAUDE.md`, não muda sem discutir antes
- **Autorização**: sempre via Supabase Auth + RLS; nenhuma lógica de permissão "feita à mão" no frontend ou em backend próprio
- **Usuário não-técnico**: decisões técnicas precisam ser explicadas em 1-2 frases sem jargão; mudanças grandes exigem plano prévio em linguagem simples

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cadastro de cliente com mínimo obrigatório (razão social + endereço + responsável) | Reduzir a fricção que hoje trava o preenchimento no CRM pago | ✓ Good |
| Motivo de perda vira uma lista editável pelo supervisor (não texto livre) | Precisa ser agregável no dashboard gerencial | ✓ Good |
| Colunas do funil fixas no MVP | Menos complexidade pra validar a ideia primeiro | ✓ Good |
| Sem notificações ativas no MVP, só destaque visual no kanban | Resolve o esquecimento de atualização sem custo/complexidade de um serviço de notificação | ✓ Good |
| Dashboard gerencial entra no MVP, não fica para depois | Critério de sucesso do usuário inclui informação gerencial completa antes de migrar de vez para o novo sistema | ✓ Good |
| Vendedor edita os próprios clientes; apagar fica restrito ao supervisor | Confirmado explicitamente pelo usuário, resolve a dúvida em aberto sobre permissões de vendedor | ✓ Good |
| Migração de dados do CRM atual passa a ser recorrente via tela de importação (revisão da decisão de v1.0) | O time continua recebendo listas de clientes/leads em planilha (não é só uma migração única); precisa virar funcionalidade permanente | — Pending |
| Importação em massa restrita ao Supervisor | Decisão explícita do dono do projeto — Vendedor não tem acesso a essa função | — Pending |
| Cliente importado sempre entra em "Aguardando contato" | Simplicidade: planilha não precisa de coluna de etapa, todo cliente novo começa do zero no funil | — Pending |
| Exportação segue a mesma regra de visibilidade (RLS) do funil | Reaproveita a autorização já existente, sem lógica de permissão nova | — Pending |

## Evolution

Este documento evolui nas transições de fase e nos marcos do projeto.

**Após cada transição de fase** (via `/gsd-transition`):
1. Requisitos invalidados? → Mover para Out of Scope com o motivo
2. Requisitos validados? → Mover para Validated com a referência da fase
3. Novos requisitos surgiram? → Adicionar em Active
4. Decisões a registrar? → Adicionar em Key Decisions
5. "What This Is" ainda está correto? → Atualizar se a realidade mudou

**Após cada marco** (via `/gsd-complete-milestone`):
1. Revisão completa de todas as seções
2. Core Value ainda é a prioridade certa?
3. Business Context ainda reflete a realidade (customer, success metric)?
4. Auditar Out of Scope — os motivos ainda são válidos?
5. Atualizar Context com o estado atual (usuários, feedback, métricas)

---
*Last updated: 2026-07-22 after starting milestone v1.1*
