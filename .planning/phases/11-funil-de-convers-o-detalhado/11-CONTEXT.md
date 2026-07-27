# Phase 11: Funil de Conversão Detalhado - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

O Dashboard ganha uma tabela por etapa do funil (quantidade de clientes, % que avançou pra próxima etapa, quantos foram perdidos ali — número e taxa —, e tempo médio parado na etapa, incluindo quem ainda está parado agora) e a média de dias entre entrada no funil e "ganho"/"perdido" (separadas). Segue a mesma regra de visibilidade do dashboard atual: vendedor vê só os próprios números, supervisor vê os de todo o time. Não inclui filtro de período (fica pra quando for pedido, já registrado em PROJECT.md Out of Scope).

</domain>

<decisions>
## Implementation Decisions

### Formato da visualização
- **D-01:** Tabela (uma linha por etapa), não gráfico de funil. Colunas: quantidade de clientes, % avançou, perdidos (número e %), tempo médio parado. Essa tabela é uma seção NOVA, adicional ao gráfico simples "clientes por etapa" já existente no dashboard (`ClientesPorEtapaChart`) — não substitui nada.

### Cálculo do "% que avançou"
- **D-02:** O percentual inclui quem ainda está parado na etapa: dos clientes que já passaram por ela (incluindo os parados nela agora), quantos % já avançaram para a próxima. Quem está parado conta como "ainda não avançou" no denominador do cálculo — não é excluído.

### Destaque de gargalo
- **D-03:** A tabela destaca visualmente (cor de alerta) etapas cujo tempo médio parado está bem acima da média das outras etapas do funil — cálculo relativo/comparativo entre as 7 etapas, não um número fixo de dias. Mesmo espírito do destaque que já existe para cards individuais parados no kanban, mas aplicado à etapa inteira.

### Claude's Discretion
- Exata fórmula estatística do "bem acima da média" (ex: quanto acima da média das demais etapas conta como gargalo — desvio padrão, múltiplo da média, etc.) — decisão técnica de threshold, não precisa voltar ao usuário.
- Estrutura exata da(s) RPC(s) Postgres para os cálculos (uma RPC por métrica, ou uma RPC única que devolve tudo) — seguir o padrão não-security-definer já estabelecido em `0003_dashboard_aggregates.sql`.
- Como reconstruir "tempo parado por etapa" e "dias até ganho/perdido" a partir das linhas de `historico` (não existe coluna dedicada de "duração por etapa" — só `clientes.etapa_alterada_em`, que rastreia apenas a etapa atual, não o histórico completo).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` — FNL-01, FNL-02, FNL-03
- `.planning/ROADMAP.md` (Fase 11) — objetivo e critérios de sucesso já aprovados, incluindo a regra explícita de que o tempo médio por etapa DEVE incluir clientes ainda parados nela (usando o momento atual como saída provisória, de propósito — não é bug)
- `.planning/PROJECT.md` — Out of Scope confirma que filtro de período não entra nesta fase

### Código existente (dashboard)
- `supabase/migrations/0003_dashboard_aggregates.sql` — padrão das RPCs de dashboard existentes (`dashboard_clientes_por_etapa`, `dashboard_ganhos_perdidos`, `dashboard_desempenho_vendedor`, `dashboard_prospeccao_por_produto/categoria`), todas `language sql stable` SEM `security definer` — rodam como invoker pra herdar a RLS de `clientes`/`historico` automaticamente. As novas RPCs desta fase devem seguir o mesmo padrão.
- `supabase/migrations/0002_clientes_and_funil.sql` — tabela `historico(id, cliente_id, tipo, descricao, autor_id, criado_em)`, populada só por triggers `security definer` (`tipo='etapa'` a cada mudança de etapa, `tipo='status_acompanhamento'` a cada mudança de status); enum `etapa_funil` com as 7 etapas em ordem fixa; `chk_ganho_somente_etapa_final` (só pode virar "ganho" na última etapa)
- `lib/funil/etapas.ts` — lista/ordem canônica das 7 etapas (`aguardando_contato` → `conversa_comprador` → `aguardando_data_reuniao` → `aguardando_feedback` → `aguardando_aprovacao` → `em_cadastro_produto` → `primeira_venda`)
- `lib/supabase/queries/dashboard.ts` e `app/actions/dashboard.ts` — padrão de wrapper tipado + Server Action com union `{data}|{error}`, a reaproveitar para as novas métricas
- `components/dashboard/ClientesPorEtapaChart.tsx` — padrão de componente de dashboard (shadcn `ChartContainer`, estados loading/error/empty com "Tentar novamente", fetch via `useEffect` chamando Server Action) — referência de estilo/estrutura para o novo componente de tabela, embora este não seja um gráfico
- `tests/dashboard/rls-dashboard.test.ts` — prova que a visibilidade vendedor/supervisor já é garantida via RLS; a fase 11 deve manter essa mesma prova para as novas RPCs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Todas as RPCs de dashboard existentes já rodam como invoker (não `security definer`) — a RLS de `clientes`/`historico` já resolve a visibilidade vendedor/supervisor automaticamente, sem precisar de parâmetro extra ou lógica de permissão nova (FNL-03 é satisfeito de graça reaproveitando o mesmo padrão).
- `is_supervisor()` (helper já existente) é o único ponto que decide o papel; nenhuma lógica de permissão nova precisa ser escrita nesta fase.

### Established Patterns
- Toda métrica nova de dashboard vira uma RPC Postgres `language sql stable`, sem `security definer`, chamada via wrapper tipado em `lib/supabase/queries/dashboard.ts` e exposta por uma Server Action em `app/actions/dashboard.ts` retornando `{data}|{error}`.
- `historico` é a única fonte de verdade pra reconstruir duração — `clientes.etapa_alterada_em` só guarda o início da etapa ATUAL, não o histórico completo (já documentado como Pitfall 1 nos comentários do `0003`).

### Integration Points
- Nova seção (tabela) entra em `components/dashboard/DashboardClient.tsx`, ao lado dos blocos já existentes — não precisa reestruturar a tela.

</code_context>

<specifics>
## Specific Ideas

A pergunta original que deu origem a esta fase: "o Projeto marca uma data de início e uma data fim para conseguirmos fazer análise de quanto tempo em média demora o avanço do nosso funil?" — confirma que o foco é tempo médio de avanço por etapa e tempo até ganho/perdido, não um filtro de período configurável (isso já foi descartado em PROJECT.md).

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase.

### Reviewed Todos (not folded)
Nenhum todo pendente encontrado para esta fase.

</deferred>

---

*Phase: 11-Funil de Conversão Detalhado*
*Context gathered: 2026-07-27*
