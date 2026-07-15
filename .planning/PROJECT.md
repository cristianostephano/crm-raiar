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

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Vendedor cadastra cliente PJ com mínimo obrigatório (razão social, endereço, responsável) e completa os demais dados depois, conforme a negociação avança
- [ ] Cliente PJ tem: razão social, endereço (CEP, rua, número, complemento), categoria, contato, telefone, email, responsável, produtos consumidos, número de lojas (opcional)
- [ ] Vendedor visualiza e movimenta no funil (kanban de 7 etapas) apenas os próprios clientes (responsavel = usuário logado)
- [ ] Supervisor visualiza e movimenta no funil todos os clientes, de todos os vendedores
- [ ] Vendedor pode editar os próprios clientes; apagar cliente é restrito ao supervisor
- [ ] Supervisor pode cadastrar um cliente e atribuir a um vendedor específico — campo responsável é sempre obrigatório, em qualquer fluxo de cadastro
- [ ] Card no funil tem status_acompanhamento: em andamento, perdido, ou ganho (ganho só é possível na etapa "1ª venda concluída")
- [ ] Ao marcar um card como perdido, é obrigatório registrar o motivo (lista de motivos editável pelo supervisor)
- [ ] Card tem observação (texto livre) e tarefas (lista editável pelo supervisor), cada tarefa com sua própria data de conclusão
- [ ] Cards parados/atrasados ficam visualmente destacados no kanban ao abrir a tela (sem envio de notificação ativa)
- [ ] Supervisor faz CRUD de 4 listas editáveis: categoria do cliente, produtos consumidos, tipos de tarefa, motivos de perda
- [ ] Autenticação via Supabase Auth com dois papéis (Supervisor, Vendedor); cadastro de usuário com email, nome, sobrenome, senha, celular
- [ ] Dashboard gerencial: clientes por etapa do funil, ganhos x perdidos, desempenho por vendedor, taxa de conversão, prospecções por produto e por categoria
- [ ] Vendedor vê uma versão do dashboard só com os próprios números; supervisor vê os números de todo o time

### Out of Scope

- Notificações ativas (email, push) de tarefas atrasadas — destaque visual no kanban já resolve o problema de esquecimento no MVP, sem custo/complexidade de um serviço de notificação
- Colunas do funil editáveis por permissão — as 7 etapas ficam fixas no código no MVP, pra reduzir complexidade e validar a ideia primeiro
- Tela de importação de planilha de clientes — a migração da base do CRM pago atual é feita uma única vez, fora da interface, não precisa virar uma funcionalidade permanente do sistema
- App mobile nativo — web responsivo é suficiente para o MVP
- Integração contínua (sync/API) com o CRM pago atual — o objetivo é substituí-lo, não integrar com ele

## Context

- **Motivação**: hoje a empresa paga por um CRM externo com custo elevado, e o time de vendas não preenche direito — telas com muitos campos e esquecimento de atualizar o funil são as duas causas apontadas pelo usuário.
- **Origem do mapeamento de domínio**: existe um wireframe (Excalidraw) do fluxo de vendas atual, já documentado em `CLAUDE.md` — usuários/papéis, cliente PJ, funil de 7 etapas e os 3 enums editáveis originais (categoria, produtos consumidos, tipos de tarefa). O motivo de perda (4º enum editável) surgiu durante esta conversa de inicialização.
- **Migração de dados**: existe uma base de clientes no CRM pago atual que precisa ser trazida para o sistema novo. É uma migração única — feita diretamente no banco a partir de uma exportação, sem exigir uma tela de importação no produto.
- **Perfil do usuário**: quem pilota o projeto não programa. Explicações devem evitar jargão técnico, focar em sintomas observáveis, e mudanças grandes precisam de um plano em linguagem simples antes de qualquer implementação.

## Constraints

- **Custo**: free tier do Supabase (Postgres + Auth + Storage) + Vercel — objetivo é validar a ideia com custo zero de infraestrutura antes de investir em escala
- **Stack**: Next.js (React/TypeScript) + Supabase — fixado em `CLAUDE.md`, não muda sem discutir antes
- **Autorização**: sempre via Supabase Auth + RLS; nenhuma lógica de permissão "feita à mão" no frontend ou em backend próprio
- **Usuário não-técnico**: decisões técnicas precisam ser explicadas em 1-2 frases sem jargão; mudanças grandes exigem plano prévio em linguagem simples

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cadastro de cliente com mínimo obrigatório (razão social + endereço + responsável) | Reduzir a fricção que hoje trava o preenchimento no CRM pago | — Pending |
| Motivo de perda vira uma lista editável pelo supervisor (não texto livre) | Precisa ser agregável no dashboard gerencial | — Pending |
| Colunas do funil fixas no MVP | Menos complexidade pra validar a ideia primeiro | — Pending |
| Sem notificações ativas no MVP, só destaque visual no kanban | Resolve o esquecimento de atualização sem custo/complexidade de um serviço de notificação | — Pending |
| Migração de dados do CRM atual é única e feita fora da UI | Evita construir uma funcionalidade de importação permanente que não será reaproveitada | — Pending |
| Dashboard gerencial entra no MVP, não fica para depois | Critério de sucesso do usuário inclui informação gerencial completa antes de migrar de vez para o novo sistema | — Pending |
| Vendedor edita os próprios clientes; apagar fica restrito ao supervisor | Confirmado explicitamente pelo usuário, resolve a dúvida em aberto sobre permissões de vendedor | — Pending |

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
*Last updated: 2026-07-14 after initialization*
