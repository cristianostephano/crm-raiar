# Phase 5: Exportação de Clientes - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Qualquer usuário (Vendedor ou Supervisor) baixa, como arquivo Excel, exatamente a lista de clientes que já enxerga na tela naquele momento — respeitando o papel (RLS: Vendedor só os próprios, Supervisor todos) e qualquer busca/filtro aplicado. É leitura pura: nenhuma tabela nova, nenhuma RPC de escrita, reaproveita as regras de visibilidade já existentes do funil/lista de clientes (v1.0).

</domain>

<decisions>
## Implementation Decisions

### Formato do arquivo
- **D-01:** Exportação gera apenas Excel (.xlsx) — não CSV, não opção dupla. Motivo: evita a confusão de separador vírgula/ponto-e-vírgula do Excel em português, mais amigável pro usuário não-técnico.

### Colunas exportadas
- **D-02:** O arquivo traz tanto os dados de cadastro (razão social, endereço, categoria, contato, telefone, email, produtos consumidos, número de lojas, responsável) quanto os dados do funil: etapa atual, status_acompanhamento (em andamento/ganho/perdido), e observação.
- **D-03:** Não existe caso de "etapa ausente" a tratar na exportação — todo cliente já existente sempre tem uma etapa preenchida (é a mesma coluna que sustenta o card do kanban, não pode ser nula). A regra "cliente sem etapa vai para Aguardando contato" já está coberta por IMP-09 (fase 7, importação), não por esta fase.

### Botão de exportar
- **D-04:** Botão "Exportar" fica no topo da tela de lista de clientes, ao lado de "Novo cliente".
- **D-05:** A exportação reflete TUDO que está aplicado na tela no momento do clique: busca por texto livre, filtros de categoria/vendedor/produto, e a aba ativa (Todos ou Incompletos) — não é a base inteira ignorando o que o usuário filtrou.

### Claude's Discretion
- Nome do arquivo baixado (ex: `clientes_2026-07-22.xlsx` ou similar) — Claude decide um padrão razoável.
- Ordem exata das colunas no arquivo e formatação (largura de coluna, cabeçalho em negrito, etc.) — dentro do razoável, sem exigir aprovação prévia.
- Onde no código a geração do arquivo acontece (Route Handler vs. outro mecanismo) — decisão técnica de implementação, cabe à pesquisa/planejamento.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pesquisa desta fase (v1.1)
- `.planning/research/SUMMARY.md` — síntese das 4 pesquisas do marco v1.1, com a ordem de fases sugerida (Export → Import preview → Import commit) e os principais riscos
- `.planning/research/ARCHITECTURE.md` (seção "v1.1 Additions") — recomenda um Route Handler dedicado (`GET /api/clientes/exportar`) para a exportação, já que Server Actions não conseguem controlar headers HTTP como `Content-Disposition` necessários pra forçar o download
- `.planning/research/STACK.md` (seção "v1.1 Addendum") — biblioteca recomendada para gerar .xlsx (`@e965/xlsx`, mirror mantido do SheetJS — o pacote `xlsx` puro do npm está desatualizado e tem CVEs conhecidas)
- `.planning/research/PITFALLS.md` (seção "Milestone Addendum: v1.1") — inclui proteção contra CSV/formula injection ao exportar campos de texto livre (razão social, contato, observação)

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` — EXP-01, EXP-02, EXP-03 (seção "Export (Exportação de Clientes)")
- `.planning/ROADMAP.md` (Phase 5) — objetivo e critérios de sucesso já aprovados

### Estrutura de dados existente (v1.0)
- `lib/supabase/queries/clientes.ts` — já tem a query de leitura de clientes com busca/filtros e RLS aplicada; a exportação deve reaproveitar essa mesma lógica de filtragem, não duplicar

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/supabase/queries/clientes.ts` — query de listagem de clientes já filtra por busca/categoria/vendedor/produto e já respeita RLS (Vendedor só os próprios, Supervisor todos); a exportação deve chamar essa mesma função/lógica com os mesmos parâmetros de filtro que a tela usa, ao invés de escrever uma query nova
- `components/clientes/ClienteToolbar.tsx` — já tem a barra de busca/filtros/abas (Todos/Incompletos) onde o botão "Exportar" deve ser adicionado, ao lado do já existente "Novo cliente"

### Established Patterns
- RLS via `is_supervisor()` já diferencia Vendedor de Supervisor em toda leitura de `clientes` — a exportação não precisa de nenhuma lógica de permissão nova, só reaproveitar a mesma query autenticada
- Fase 4 (Dashboard) já estabeleceu o padrão de proteger rotas via o guard em `app/(app)/layout.tsx` — qualquer rota nova de exportação roda dentro dessa mesma área autenticada

### Integration Points
- Novo Route Handler (ex: `app/api/clientes/exportar/route.ts`) que recebe os mesmos parâmetros de busca/filtro da URL da tela, roda a query já existente com RLS, gera o .xlsx e retorna como download
- Botão "Exportar" em `ClienteToolbar.tsx` (ou onde a barra de busca/filtros vive hoje) que monta a URL desse Route Handler com os filtros/aba/busca atuais e dispara o download

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual específica — é uma ação de download (botão + arquivo), não uma tela nova.

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase (só exportação; importação é fases 6 e 7).

### Reviewed Todos (not folded)
Nenhum todo pendente encontrado para esta fase.

</deferred>

---

*Phase: 5-Exportação de Clientes*
*Context gathered: 2026-07-22*
