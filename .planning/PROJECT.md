# CRM Raiar — Acompanhamento de Vendas

## What This Is

Um CRM de acompanhamento de vendas (funil/kanban) para substituir um CRM pago de custo elevado. Vendedores cadastram e trabalham clientes PJ ao longo de um funil de 7 etapas, do primeiro contato até a primeira venda concluída; um supervisor acompanha todos os clientes do time, tem um dashboard gerencial, e pode importar clientes em massa via planilha ou exportar a lista que enxerga. Construído com custo zero de infraestrutura, pra validar a ideia antes de qualquer investimento em escala.

## Core Value

O time de vendas precisa conseguir preencher e manter o funil atualizado com o mínimo de fricção possível — cadastro rápido, poucos campos obrigatórios, e visibilidade clara do que está parado ou atrasado — porque hoje o preenchimento no CRM pago é ruim (telas longas, esquecimento) e isso é o motivo real de trocar de ferramenta.

## Business Context

- **Customer**: equipe interna de vendas (vendedores + supervisor) — uso interno, não é um produto vendido a terceiros
- **Revenue model**: nenhum — o retorno é econômico (deixar de pagar pelo CRM atual)
- **Success metric**: time passa a usar o funil no dia a dia e o sistema cobre as necessidades gerenciais (incluindo dashboard) a ponto de o CRM pago poder ser cancelado
- **Strategy notes**: —

## Current State

**Shipped:** v1.0 MVP (Autenticação, Cadastro + Funil, Administração de Listas, Dashboard Gerencial) e v1.1 Importação e Exportação de Clientes (2026-07-25).

O CRM está em uso — login/papéis, cadastro e funil kanban completos, dashboard gerencial, e agora o supervisor consegue trazer clientes em massa via planilha (com revisão de erros/duplicados antes de gravar) e qualquer usuário exporta a lista de clientes que já enxerga.

## Next Milestone Goals

Ainda não definido — rodar `/gsd-new-milestone` para levantar o próximo conjunto de necessidades.

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
- ✓ Supervisor importa clientes em massa via planilha (Excel/CSV), com tela de mapear colunas pros campos do sistema — v1.1
- ✓ Sistema mostra erros e possíveis duplicados por linha antes de confirmar a importação, e revalida duplicados de novo no momento de gravar — v1.1
- ✓ Um lote de importação nunca é travado por uma linha ruim: linhas válidas são gravadas mesmo se outras tiverem erro ou forem puladas — v1.1
- ✓ Cliente importado sempre entra na etapa "Aguardando contato" do funil — v1.1
- ✓ Vendedor exporta a lista dos próprios clientes; Supervisor exporta a lista de todos os clientes, respeitando os mesmos filtros da tela — v1.1

### Active

(Nenhum ainda — próximo marco não definido, rodar `/gsd-new-milestone`)

### Out of Scope

- Notificações ativas (email, push) de tarefas atrasadas — destaque visual no kanban já resolve o problema de esquecimento, sem custo/complexidade de um serviço de notificação
- Colunas do funil editáveis por permissão — as 7 etapas ficam fixas no código, pra reduzir complexidade
- App mobile nativo — web responsivo é suficiente
- Integração contínua (sync/API) com o CRM pago atual — o objetivo é substituí-lo, não integrar com ele
- Importação em massa pelo Vendedor — restrita ao Supervisor, decisão explícita do dono do projeto, confirmada e implementada em v1.1
- Validação de CNPJ na importação — adiado para uma v2 se vier a ser necessário (v1.1 valida só os campos mínimos de cadastro)
- Lembrar o mapeamento de colunas entre importações — cada planilha é mapeada do zero por enquanto (v1.1); útil se o volume de importações recorrentes crescer
- Importação como atualização de cliente existente — v1.1 só cria clientes novos; atualizar em massa fica para uma versão futura, se necessário

## Context

- **Motivação**: hoje a empresa paga por um CRM externo com custo elevado, e o time de vendas não preenche direito — telas com muitos campos e esquecimento de atualizar o funil são as duas causas apontadas pelo usuário.
- **Origem do mapeamento de domínio**: existe um wireframe (Excalidraw) do fluxo de vendas atual, já documentado em `CLAUDE.md` — usuários/papéis, cliente PJ, funil de 7 etapas e os 3 enums editáveis originais (categoria, produtos consumidos, tipos de tarefa). O motivo de perda (4º enum editável) surgiu durante esta conversa de inicialização.
- **Migração de dados**: existe uma base de clientes no CRM pago atual que precisa ser trazida para o sistema novo. Na v1.0 isso foi tratado como migração única, fora da UI — na v1.1 essa decisão foi revista e implementada: o time recebe planilhas de clientes/leads com frequência (parceiros, feiras), e a importação agora é uma tela permanente do sistema, restrita ao Supervisor.
- **Perfil do usuário**: quem pilota o projeto não programa. Explicações devem evitar jargão técnico, focar em sintomas observáveis, e mudanças grandes precisam de um plano em linguagem simples antes de qualquer implementação.
- **Estado do código pós-v1.1**: Next.js 16 (App Router) + Supabase (Postgres/Auth/RLS), sem backend Node separado. `@e965/xlsx` (leitura/escrita de planilha, alternativa segura ao pacote `xlsx` vulnerável) e `papaparse` (CSV) adicionados em v1.1. Toda escrita de importação passa por uma única RPC (`importar_clientes_lote`) não-security-definer com guard explícito de Supervisor, seguindo o mesmo padrão das RPCs anteriores (`mover_card_funil`).
- **Débito técnico conhecido**: nenhum item bloqueante identificado ao fechar v1.1. Ideias adiadas para uma v2 (se o uso real pedir): validar CNPJ na importação, lembrar o mapeamento de colunas entre planilhas recorrentes, e permitir que a importação também atualize clientes já existentes (hoje só cria novos).

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
| Migração de dados do CRM atual passa a ser recorrente via tela de importação (revisão da decisão de v1.0) | O time continua recebendo listas de clientes/leads em planilha (não é só uma migração única); precisa virar funcionalidade permanente | ✓ Good |
| Importação em massa restrita ao Supervisor | Decisão explícita do dono do projeto — Vendedor não tem acesso a essa função | ✓ Good |
| Cliente importado sempre entra em "Aguardando contato" | Simplicidade: planilha não precisa de coluna de etapa, todo cliente novo começa do zero no funil | ✓ Good |
| Exportação segue a mesma regra de visibilidade (RLS) do funil | Reaproveita a autorização já existente, sem lógica de permissão nova | ✓ Good |
| Revisão antes de gravar: planilha é mapeada e cada linha classificada (OK/erro/duplicado) antes de qualquer escrita no banco | Dá ao supervisor uma chance de corrigir a planilha ou decidir pular linhas problemáticas antes do lote virar clientes de verdade | ✓ Good |
| Duplicado é revalidado de novo no momento de confirmar (não confia só na checagem da revisão) | Cobre o caso raro de outro cadastro parecido ter entrado no intervalo entre revisão e confirmação | ✓ Good |
| Linha pulada (erro ou duplicado não importado) não deixa registro permanente no sistema — só aparece no resumo daquela operação | Evita uma tabela nova só pra isso; a planilha original já é o registro, com o supervisor | ✓ Good |
| Gravação em lote via inserção set-based (`INSERT ... ON CONFLICT DO NOTHING`), não um loop linha a linha | Necessário pelo limite de ~10s de execução do Vercel Hobby; garante que uma linha ruim nunca trava o lote inteiro | ✓ Good |
| RPC de importação segue o padrão de `mover_card_funil`: não-security-definer, guard explícito de `is_supervisor()` | Mantém a regra "toda autorização passa pelo RLS" (`CLAUDE.md`), sem lógica de permissão paralela dentro da função | ✓ Good |

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
*Last updated: 2026-07-25 after v1.1 milestone*
