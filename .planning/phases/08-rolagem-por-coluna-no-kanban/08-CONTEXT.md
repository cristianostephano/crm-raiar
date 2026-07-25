# Phase 8: Rolagem por Coluna no Kanban - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Cada uma das 7 colunas do kanban de clientes ganha altura fixa e rolagem própria, independente da quantidade de clientes que tem dentro — hoje uma coluna cheia estica a página inteira, o que vira um problema real com 200-300 clientes numa etapa só. Todas as colunas têm a mesma altura, cheias ou vazias. Puramente frontend/CSS — sem mudança de dado ou schema.

</domain>

<decisions>
## Implementation Decisions

### Altura das colunas
- **D-01:** Todas as colunas têm a mesma altura fixa (decidido no discovery do marco v1.2, antes desta fase) — nunca encolhem pro tamanho do conteúdo.
- **D-02:** A altura acompanha o espaço disponível na tela (mais alto em telas grandes, menos em telas pequenas), mas nunca fica menor que um mínimo razoável que ainda mostre os cards direito — não é um valor fixo em pixels único pra qualquer tamanho de janela.

### Indicador de rolagem
- **D-03:** Além da barra de rolagem nativa, colunas com mais conteúdo do que cabe na tela mostram um indicador visual extra sutil (ex: sombra/fade na borda de baixo) avisando que tem mais clientes pra rolar.

### Claude's Discretion
- Valor exato do mínimo de altura e da fórmula de cálculo do "espaço disponível na tela" (ex: `calc(100vh - altura do header/toolbar)`).
- Implementação exata do indicador de sombra/fade (CSS puro vs. um pequeno componente).
- Configuração do dnd-kit necessária pra manter o auto-scroll do drag funcionando corretamente dentro de colunas com scroll interno (ver Pitfalls research).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pesquisa do marco (v1.2)
- `.planning/research/PITFALLS.md` (seção "Milestone Addendum: v1.2") — pitfall sobre dnd-kit + colunas com scroll fixo precisando de configuração explícita (`measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}`), não só CSS
- `.planning/research/STACK.md` (seção "Milestone Addendum: v1.2") — confirma que a rolagem por coluna é só Tailwind CSS (overflow-y-auto + limite de altura), sem biblioteca nova
- `.planning/research/ARCHITECTURE.md` (seção "v1.2 Additions") — confirma que este item é puramente frontend, sem implicação de backend/dados

### Requisitos e roadmap
- `.planning/REQUIREMENTS.md` — KAN-01, KAN-02
- `.planning/ROADMAP.md` (Phase 8) — objetivo e critérios de sucesso já aprovados

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/clientes/KanbanBoard.tsx` — componente único que renderiza as 7 colunas, em DUAS variantes que precisam da mesma mudança: a variante `dragDisabled` (linhas ~637-675, quando busca/filtro/ordenação diferente de "recentes" está ativa) e a variante normal com `DndContext` (linhas ~677-726). Ambas compartilham a mesma estrutura de coluna: `<div className="flex w-[280px] shrink-0 flex-col gap-2">` com um header (`bg-secondary` com título + contagem) e o corpo da lista de cards.
- O container externo já tem `overflow-x-auto` (`<div className="flex flex-1 gap-4 overflow-x-auto pb-2">`) para rolagem horizontal entre colunas — a nova rolagem vertical por coluna precisa coexistir com essa rolagem horizontal existente, sem conflito.

### Established Patterns
- `DroppableColumn` (linhas 206-219) já separa o corpo da coluna do header — bom ponto de inserção pro `overflow-y-auto` + altura fixa, sem afetar o header que deve continuar visível fora da área que rola.
- `ETAPAS`/`ETAPA_KEYS` (`lib/funil/etapas.ts`) continuam sendo a fonte única da lista/ordem de etapas — não mexe nisso.

### Integration Points
- Mudança isolada dentro de `KanbanBoard.tsx` — não afeta `ClienteCard.tsx`, `moverCard()`, nem nenhuma query/RPC.

</code_context>

<specifics>
## Specific Ideas

Referência visual original que motivou esta fase: screenshot do próprio kanban atual mostrando uma coluna com 4+ clientes esticando a tela enquanto colunas vizinhas ficavam vazias — sem lista/arquivo específico anexado além dessa observação direta do dono do projeto durante o discovery do marco.

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — discussão ficou dentro do escopo da fase (rolagem por coluna; os outros itens do marco v1.2 são fases separadas).

### Reviewed Todos (not folded)
Nenhum todo pendente encontrado para esta fase.

</deferred>

---

*Phase: 8-Rolagem por Coluna no Kanban*
*Context gathered: 2026-07-25*
