# Phase 12: Comparativo por Vendedor - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning

<domain>
## Phase Boundary

O Dashboard ganha uma tabela nova, visível só para o Supervisor, comparando os vendedores ativos lado a lado: taxa de conversão, negócios iniciados, negócios ganhos, e ciclo médio em dias. Vendedores desativados não aparecem na lista de comparação, mas seus números históricos (clientes ganhos/perdidos já atribuídos a eles) continuam intactos e contando normalmente nos totais gerais do sistema — só a lista de "quem aparece na tabela" é filtrada por `ativo = true`.

</domain>

<decisions>
## Implementation Decisions

### Base de "negócios iniciados"
- **D-01:** Conta todos os clientes que já foram atribuídos a esse vendedor desde sempre (histórico completo), não só os do período filtrado.

### Janela de tempo da tabela
- **D-02:** A tabela inteira (todas as 4 métricas) mostra o histórico completo, sem filtro de período — mesma decisão já tomada na Fase 11 para o funil detalhado e a média de dias até ganho/perdido. Não segue o filtro de período que o gráfico "Desempenho por vendedor" (já existente) usa hoje — este é um comportamento NOVO e diferente do gráfico existente, e ambos continuam coexistindo (o gráfico existente não é alterado por esta fase).

### Fórmula de "taxa de conversão"
- **D-03:** `ganhos / (ganhos + perdidos)` — mede eficácia de fechamento entre negócios já decididos, ignorando os que ainda estão em andamento. Mesma fórmula já usada em `lib/dashboard/periodo.ts`'s `taxaConversao()` para os cards de Ganhos/Perdidos existentes — reaproveitar essa função, não reinventar.

### Claude's Discretion
- Ordem das linhas na tabela (alfabético por nome, ou por desempenho) — decisão de UX sem impacto funcional, delegada ao UI-SPEC.
- Nome e assinatura exata da nova RPC (uma RPC nova dedicada, ou extensão de `dashboard_desempenho_vendedor()` existente) — decisão técnica, ver Canonical References.
- Exata forma de filtrar vendedores ativos na lista (LEFT JOIN + WHERE `ativo = true` na lista de linhas, mantendo a agregação histórica completa de `clientes`/`historico` sem truncar por essa condição) — já mapeado em pesquisa preliminar, não precisa voltar ao usuário.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` — VEND-01
- `.planning/ROADMAP.md` (Fase 12) — objetivo e critérios de sucesso já aprovados
- `.planning/PROJECT.md` — confirma que "Valor em R$ / ticket médio" está fora de escopo (o comparativo não rastreia valor monetário)

### Código existente (dashboard)
- `supabase/migrations/0003_dashboard_aggregates.sql` — `dashboard_desempenho_vendedor(p_inicio, p_fim)` já agrupa por `c.responsavel` e reaproveita o CTE de dedup do último evento de status (`ultimo_status_change`); hoje devolve só `ganho`/`perdido` por vendedor, dentro de um período — precisa virar uma versão sem parâmetros de período, com `negocios_iniciados` e `ciclo_medio_dias` adicionados, e uma lista de vendedores filtrada por `ativo = true`.
- `supabase/migrations/0009_dashboard_funil_detalhado.sql` — `dashboard_tempo_ate_fechamento()` já tem o CTE reconstruindo "dias de `clientes.criado_em` até ganho/perdido", hoje agrupado por `status`; a base para "ciclo médio em dias" por vendedor é trocar `group by u.status_evento` por `group by c.responsavel` (ou remover o split ganho/perdido, dependendo de como o Claude decidir agregar — discretion).
- `lib/dashboard/periodo.ts` — `taxaConversao(ganho, perdido)` já existe, retorna `null` (nunca `NaN`) quando ambos são 0; reaproveitar esta função, não recalcular a fórmula na RPC nem duplicar client-side.
- `components/dashboard/DesempenhoVendedorChart.tsx` — precedente de gate Supervisor-only: nenhuma checagem de papel na própria RPC (é `security invoker`, sem `security definer`), o gate é feito só no Server Component (`isSupervisor` prop) + RLS já escopando `clientes` automaticamente para um Vendedor. A nova RPC desta fase deve seguir o mesmo padrão — sem guard SQL novo.
- `components/dashboard/FunilDetalhadoTable.tsx` (Fase 11) — padrão de tabela a reaproveitar: shadcn `Table`, `FetchState` (loading/error/ready), `Skeleton`, retry, formatadores com `—` para nulo, nunca `0,0%` fabricado.
- `lib/equipe/membros.ts` — não é reaproveitável diretamente (filtra uma lista de pessoas para picker, não agrega histórico), mas é a referência mais próxima de "filtrar por `ativo = true`" já existente no código.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `taxaConversao()` em `lib/dashboard/periodo.ts` já implementa exatamente a fórmula da D-03 — reaproveitar, não duplicar.
- O padrão "RPC sem parâmetro de período + Server Component decide visibilidade via prop `isSupervisor`" já está validado duas vezes (dashboard original + Fase 11) — esta fase é a terceira aplicação do mesmo padrão.

### Established Patterns
- Nenhuma RPC de dashboard usa `security definer` — todas dependem de RLS pra escopar `clientes`/`historico` automaticamente. A nova RPC desta fase deve seguir a mesma regra.
- Nenhuma RPC de dashboard hoje filtra por `profiles.ativo` — esta fase introduz o primeiro caso disso, e precisa ser cuidadoso pra filtrar SÓ a lista de linhas (vendedores exibidos), nunca os dados históricos agregados (clientes/historico de um vendedor desativado continuam contando nos totais gerais do sistema, só não aparecem como uma linha própria nesta tabela específica).

### Integration Points
- Nova seção entra em `components/dashboard/DashboardClient.tsx`, visível só quando `isSupervisor` é true — mesma lógica condicional que já esconde `DesempenhoVendedorChart` de um Vendedor.

</code_context>

<specifics>
## Specific Ideas

Referência visual original: durante a discussão do marco v1.2, o usuário compartilhou um print de outro CRM mostrando uma tabela comparativa por vendedor (conversão, negócios iniciados/ganhos, ciclo médio) como inspiração — essa é a origem direta desta fase (VEND-01).

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.

### Reviewed Todos (not folded)
Nenhum todo pendente encontrado para esta fase.

</deferred>

---

*Phase: 12-Comparativo por Vendedor*
*Context gathered: 2026-07-28*
