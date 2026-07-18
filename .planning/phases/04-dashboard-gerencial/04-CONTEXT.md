# Phase 4: Dashboard Gerencial - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Supervisor e Vendedor enxergam a saúde do funil em números, cada um na medida da própria visão: clientes por etapa, ganhos x perdidos, taxa de conversão, desempenho por vendedor (só Supervisor), prospecção por produto e por categoria. É uma camada de leitura sobre os dados já produzidos pelas Fases 2 e 3 — não cria tabelas novas, só agrega o que já existe (`clientes`, `historico`, `cliente_produtos`).

</domain>

<decisions>
## Implementation Decisions

### Período de análise
- **D-01:** O dashboard tem um filtro de período (ex: últimos 30 dias / este mês / este ano / personalizado) — não mostra só o acumulado total sem opção de filtrar.
- **D-02:** Para métricas de "ganhos x perdidos" e "taxa de conversão", o período filtra pela **data da mudança de status** (quando o card virou ganho/perdido — via `historico` ou `etapa_alterada_em`/campo equivalente), não pela data de cadastro do cliente.

### Localização
- **D-03:** O Dashboard fica num item de menu separado ("Dashboard"). O funil (kanban) continua sendo a tela inicial ao logar — não muda o fluxo padrão de uso diário.

### Visualização por métrica
- **D-04:** "Clientes por etapa do funil" — gráfico de barras (uma barra por etapa).
- **D-05:** "Ganhos x perdidos" e "taxa de conversão" — números em destaque (grandes, diretos), não gráfico de pizza/rosca.
- **D-06:** "Prospecção por produto e por categoria" e "desempenho por vendedor" — barras horizontais (uma barra por produto/categoria/vendedor).

### Escopo por papel (já confirmado no PROJECT.md/REQUIREMENTS.md, reafirmado aqui)
- **D-07:** Vendedor vê uma versão do dashboard só com os próprios números (não vê desempenho por vendedor, já que só existe ele mesmo na visão dele). Supervisor vê o dashboard completo, com todos os vendedores.

### Claude's Discretion
- Biblioteca de gráficos: usar Recharts via o componente Chart do shadcn/ui, já definido em `.claude/CLAUDE.md`.
- Layout exato da tela (ordem dos blocos, grid responsivo).
- Opções exatas do filtro de período (ex: presets exatos oferecidos) e o componente de seleção de data personalizada.
- Onde e como computar os agregados (view/RPC no Postgres vs. client-side) — decisão técnica de implementação.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stack e convenções já estabelecidas
- `.claude/CLAUDE.md` §Technology Stack — Recharts via shadcn/ui Chart component; "Compute aggregates with Postgres views or RPC functions... not client-side reduction over a full client list — keeps egress low against the 5GB/month free-tier cap"
- `.planning/phases/01-autentica-o-e-pap-is/01-04-SUMMARY.md` — padrão de tela protegida, navegação
- `.planning/phases/02-cadastro-e-gest-o-de-clientes-pj/02-01-SUMMARY.md` — estrutura de `clientes`, `historico`, `cliente_produtos`, `etapa_alterada_em`
- `.planning/phases/03-administra-o-de-listas-edit-veis/*-SUMMARY.md` — estrutura das 4 listas editáveis (categoria, produtos, motivos de perda) usadas nos agregados

### Convenções de backend
- `.claude/Skills/Supabase-conventions/SKILL.md` — quando usar RPC/view para agregados no Postgres

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/supabase/queries/clientes.ts` — já tem queries de leitura sobre `clientes`/`historico`; base para novos agregados
- `app/(app)/layout.tsx` — nav já protegida, adicionar item "Dashboard"
- shadcn/ui components já instalados (card, tabs, select, etc.) — reaproveitar para filtro de período e cards de métrica

### Established Patterns
- RLS com `is_supervisor()` já diferencia Vendedor de Supervisor — aplicar aos agregados (Vendedor só agrega os próprios clientes)
- `historico` (Fase 2) já registra mudanças de etapa/status com timestamp — base pra filtrar por data de mudança de status

### Integration Points
- Depende de Fases 2 e 3 completas (dados de clientes, funil e listas editáveis já existem e têm volume real de teste)

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual específica fornecida para esta fase.

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Dashboard Gerencial*
*Context gathered: 2026-07-18*
