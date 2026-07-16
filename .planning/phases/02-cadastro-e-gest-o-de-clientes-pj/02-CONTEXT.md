# Phase 2: Cadastro e Funil de Vendas - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Vendedores cadastram clientes PJ com o mínimo de campos obrigatórios e completam o resto depois; encontram clientes na lista via busca e filtros; movem cada cliente pelas 7 etapas do funil kanban, com as regras de negócio (ganho só na etapa final, motivo obrigatório em perda) garantidas pelo sistema. Supervisor enxerga e organiza a carteira inteira do time. Esta fase nasceu da fusão da antiga Fase 2 (Cadastro) com a antiga Fase 3 (Funil/Kanban) — decisão do dono do projeto durante esta discussão, registrada em `.planning/ROADMAP.md` (Roadmap Evolution em `.planning/STATE.md`).

</domain>

<decisions>
## Implementation Decisions

### Cadastro e edição incremental
- **D-01:** Não existe tela separada de "pendências". É um filtro/aba dentro da própria lista de clientes ("Incompletos"); clicar num cliente ali abre a mesma tela de edição normal de qualquer cliente.
- **D-02:** Clientes com campos opcionais em branco (categoria, contato, telefone, email, produtos consumidos, número de lojas) ficam com um selo visual de "cadastro incompleto" na lista.

### Lista de clientes (visual)
- **D-03:** Lista em cards compactos (não tabela tradicional) — referência visual fornecida pelo usuário (kanban do CRM atual): nome da empresa em destaque, ícones de ação rápida, alertas visuais. Vários clientes visíveis por tela.
- **D-04:** Cada card/linha mostra pelo menos razão social e categoria de relance, sem precisar abrir o cliente.
- **D-05:** A fase entrega os clientes já organizados em colunas por etapa do funil (7 etapas fixas), não uma lista plana — a fusão com o antigo Phase 3 foi justamente para entregar isso já aqui.

### Duplicidade
- **D-06:** Razão social é única em toda a base de clientes (não só por vendedor) — o sistema bloqueia o cadastro se já existir uma razão social igual, cadastrada por qualquer vendedor.

### Busca e filtro
- **D-07:** A busca (campo de texto) filtra apenas por razão social.
- **D-08:** Filtros disponíveis (separados da busca por texto): vendedor/responsável, categoria, produto consumido, cidade, estado.
- **D-09:** O filtro por vendedor/responsável só aparece para o Supervisor (Vendedor já só vê os próprios clientes, não precisa desse filtro).
- **D-10:** "Canal de venda" mencionado pelo usuário é sinônimo de "categoria" (FS/Varejo tradicional/Auto serviço) — já confirmado como o mesmo campo desde a inicialização do projeto, não é um campo novo.
- **D-11 (extensão de campo):** O endereço do cliente passa a incluir campos próprios de **cidade** e **estado** (além de CEP, rua, número, complemento já definidos), especificamente para viabilizar os filtros de cidade/estado.

### Claude's Discretion
- Layout exato dos cards (dentro do design system shadcn/ui + Tailwind v4 já estabelecido na Fase 1, cor de destaque azul).
- Onde exatamente o botão "Filtros" fica na tela e como o painel de filtros se abre (dropdown, drawer lateral, etc) — inspirado na referência visual do usuário, mas sem replicar pixel a pixel.
- Textos de erro e mensagens de feedback (ex: mensagem de bloqueio de duplicidade).
- Estrutura exata de dados por trás do funil (tabela de "cards" separada vs. campos na tabela de clientes) — decisão técnica de implementação, cabe à pesquisa/planejamento.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Convenções de backend (RLS/RPC/Edge Functions)
- `.claude/Skills/Supabase-conventions/SKILL.md` — como estruturar RLS, RPC e Edge Functions neste projeto; obrigatório para qualquer lógica de permissão (vendedor só edita os próprios clientes, apagar restrito a supervisor) e para as regras de negócio do funil (ganho só na etapa final, motivo obrigatório em perda)

### Stack e convenções já estabelecidas na Fase 1
- `.claude/CLAUDE.md` §Technology Stack — `@dnd-kit` para drag-and-drop do kanban, `react-hook-form` + `zod` para formulários, `@tanstack/react-table` se necessário pra lista, shadcn/ui como design system
- `.planning/phases/01-autentica-o-e-pap-is/01-UI-SPEC.md` — paleta de cores (azul como único destaque), tipografia, espaçamento já travados na Fase 1; esta fase deve seguir o mesmo contrato, não recriar do zero
- `.planning/phases/01-autentica-o-e-pap-is/01-03-SUMMARY.md`, `01-04-SUMMARY.md` — convenções de rotas protegidas `(app)/`, padrão de formulário com Server Actions + Edge Function quando necessário, RLS com `is_supervisor()`

### Pesquisa de domínio (inicialização do projeto)
- `.planning/research/ARCHITECTURE.md` — padrão de modelagem de dados sugerido para cliente/card do funil
- `.planning/research/FEATURES.md` — análise de "1 cliente = 1 posição ativa no funil" vs. reentrada no funil para vendas repetidas (decisão de modelagem a resolver na pesquisa/planejamento desta fase)
- `.planning/research/PITFALLS.md` — riscos de RLS já mapeados, aplicáveis a qualquer tabela nova (clientes, cards)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/*` (button, card, form, input, label, select, badge) — já instalados via shadcn/ui na Fase 1, reutilizáveis para os formulários de cliente
- `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts` — clientes Supabase já configurados
- `components/auth/InviteUserForm.tsx` — padrão de formulário com `react-hook-form` + `zod` + Select controlado a reaproveitar para o formulário de cadastro/edição de cliente (inclusive o bug de Select controlado-desde-o-início já resolvido lá, D-05 da Fase 1)
- `app/(app)/layout.tsx` — layout protegido com navegação e badge de papel, ponto de integração para adicionar o link "Clientes"/"Funil" no menu

### Established Patterns
- Rotas protegidas ficam em `app/(app)/*`, com guard de autenticação e RLS como camada real de segurança (nunca esconder só na UI)
- RLS usa `is_supervisor()` `SECURITY DEFINER` para diferenciar Supervisor de Vendedor sem recursão

### Integration Points
- Depende da Fase 1 (autenticação, papéis, RLS) já completa — usuários (Supervisor/Vendedor) e a distinção de papel já existem no banco

</code_context>

<specifics>
## Specific Ideas

- Referência visual do usuário: cards compactos por cliente com ícones de ação rápida (telefone, WhatsApp, agenda), alertas visuais para pendências, barra de busca + botão "Filtros" no topo — do CRM pago atual que está sendo substituído. Usar como inspiração de densidade de informação e usabilidade, não copiar pixel a pixel.
- O usuário deixou claro que quer ver o produto "completo" (cadastro + funil) funcionando mais cedo — motivo da fusão de fases.

</specifics>

<deferred>
## Deferred Ideas

- Nenhuma nova ideia de escopo surgiu além do que já estava no REQUIREMENTS.md (CLI-* e FUN-*) — a fusão de fases foi uma decisão de sequenciamento, não uma expansão de escopo.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Cadastro e Funil de Vendas*
*Context gathered: 2026-07-16*
