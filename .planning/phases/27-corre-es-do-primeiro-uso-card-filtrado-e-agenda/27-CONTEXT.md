# Phase 27: Correções do Primeiro Uso — Card Filtrado e Agenda - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Duas correções pequenas e isoladas encontradas quando o time de vendas testou o sistema pela primeira vez:

1. **KAN-03** — o card do Kanban perde informação (categoria, vendedor, cidade/estado, ícones) e corta nomes quando o filtro de vendedor está ativo. Deve ficar idêntico ao card sem filtro.
2. **AGD-15** — a seção "Sem dia fixo definido" da Agenda mostra só o nome do vendedor; o nome do cliente está ausente.

Sem arquivo em comum entre as duas, e sem dependência do resto do marco.

</domain>

<decisions>
## Implementation Decisions

### AGD-15 — causa raiz já confirmada por leitura de código
- **D-01:** `components/agenda/AgendaSemDiaFixo.tsx` (linha 77) renderiza `{cliente.razaoSocial}` diretamente como título, em vez de usar `nomeExibicaoCliente(razaoSocial, nomeFantasia)` — a mesma função que `ClienteCard.tsx` e `ClienteDetailSheet.tsx` já usam para cair no Nome Fantasia quando a razão social é nula (padrão fixado na Fase 26 do marco v1.6, PROSP-02). Quando a razão social vem nula (comum em clientes importados só com Nome Fantasia), o título fica vazio e só o nome do vendedor (`responsavelNome`) sobra visível — exatamente o sintoma relatado.
- **D-02:** A correção é reaproveitar `nomeExibicaoCliente()` — igual ao resto do sistema já faz — nunca inventar uma segunda regra de fallback de nome.
- **D-03:** O nome do vendedor deve continuar aparecendo do lado do nome do cliente (não sumir) — confirmado pelo dono do projeto: ele (atuando como Supervisor) precisa saber de quem é a agenda. Isso já é o comportamento atual (`showResponsavel && cliente.responsavelNome`) — não precisa de mudança nessa parte, só a linha do título precisa ser corrigida.
- **D-04 (dependência técnica encontrada):** `getClientesSemDiaFixo()` (`lib/supabase/queries/agenda.ts`) hoje só faz `select` de `razao_social`, não de `nome_fantasia` — o tipo `ClienteSemDiaFixo`/`ClienteSemDiaFixoRow` não tem esse campo. Precisa: (a) adicionar `nome_fantasia` ao `select`, (b) adicionar `nomeFantasia` ao tipo e ao mapeamento da row, (c) só então trocar a linha 77 de `AgendaSemDiaFixo.tsx` para usar `nomeExibicaoCliente()`.

### KAN-03 — causa raiz NÃO encontrada por leitura de código; confirmado como bug real e persistente pelo dono do projeto
- **D-05:** Leitura cuidadosa de `KanbanBoard.tsx` (branches `dragDisabled`/`DndContext`, ambos usam a mesma classe de largura de coluna `w-[280px] shrink-0`) e de `ClienteCard.tsx` (categoria/vendedor/cidade/ícones são renderizados incondicionalmente, sem nenhuma classe de ocultação responsiva `hidden`/`sm:hidden` em lugar nenhum do componente) não revelou nenhum caminho de código que explique a compressão relatada nas fotos. Pelo código como está hoje, o card filtrado DEVERIA já aparecer idêntico ao sem filtro.
- **D-06:** O dono do projeto confirmou explicitamente que o bug é real e persistente (não é cache do navegador — já teria acontecido de novo mesmo após recarregar). **A pesquisa/planejamento desta fase PRECISA reproduzir o bug ao vivo (navegador real, sessão autenticada, filtro de vendedor aplicado) antes de propor qualquer correção** — não há uma linha de código óbvia para "consertar" só de leitura estática. Hipóteses a testar durante a reprodução, nenhuma delas confirmada: (a) alguma extensão/config específica do navegador do usuário; (b) um estado de tela diferente do suposto (ex: viewport realmente estreito coincidindo com o teste, mesmo o usuário afirmando ser o mesmo aparelho); (c) uma versão de build diferente da que está no repositório no momento (deploy desatualizado); (d) um caminho de código ainda não encontrado nesta leitura.
- **D-07:** Critério de sucesso não muda por causa da incerteza da causa: o card filtrado tem que ficar 100% idêntico ao sem filtro (categoria, vendedor, cidade/estado, os 4 ícones/setas, sem corte de nome).

### Claude's Discretion
- Ordem de execução entre as duas correções (independentes, sem risco de conflito).
- Se a investigação ao vivo de KAN-03 revelar que a causa está em código fora de `KanbanBoard.tsx`/`ClienteCard.tsx` (ex: um componente de layout global, um provider de tema, etc.), o planejamento pode se ajustar sem precisar voltar pra discussão — o critério de sucesso (D-07) é o que não muda.

</decisions>

<canonical_refs>
## Canonical References

### Card do Kanban (KAN-03)
- `components/clientes/KanbanBoard.tsx` — branches `dragDisabled` (linha ~754) e `DndContext` (linha ~797), ambos com container `w-[280px] shrink-0` idêntico
- `components/clientes/ClienteCard.tsx` — card apresentacional puro; categoria/vendedor/cidade/ícones renderizados sem condicional de largura/responsividade

### Agenda "Sem dia fixo definido" (AGD-15)
- `components/agenda/AgendaSemDiaFixo.tsx` — linha 77, ponto exato do bug (usa `cliente.razaoSocial` cru)
- `lib/supabase/queries/agenda.ts` — `getClientesSemDiaFixo()` (linha 182+), tipo `ClienteSemDiaFixoRow` (linha 132+), `mapClienteSemDiaFixoRow()` (linha 140+) — faltam `nome_fantasia`/`nomeFantasia`
- `lib/clientes/nomeExibicao.ts` — `nomeExibicaoCliente(razaoSocial, nomeFantasia)`, a função única de fallback já estabelecida (Fase 26, v1.6) que esta correção deve reaproveitar
- `tests/clientes/nome-exibicao.test.ts` — testes existentes da função, molde para o teste desta fase

No external specs — requisitos totalmente capturados nas decisões acima.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `nomeExibicaoCliente()` (`lib/clientes/nomeExibicao.ts`) — já é a autoridade única de "qual nome mostrar" em `ClienteCard.tsx` e `ClienteDetailSheet.tsx`; AGD-15 só precisa passar a chamá-la também.
- `buscarPaginado` já usado por `getClientesSemDiaFixo` — o `select` só precisa ganhar uma coluna a mais (`nome_fantasia`), sem mudar a forma da paginação.

### Established Patterns
- Toda tela do projeto que exibe nome de cliente já usa `nomeExibicaoCliente()` como fonte única — `AgendaSemDiaFixo.tsx` é uma exceção isolada, criada antes desse padrão existir (Fase 24, antes da Fase 26 que introduziu a função).
- `w-[280px] shrink-0` é a largura de coluna fixa usada nos dois branches (arrastar ligado/desligado) do Kanban — qualquer correção de KAN-03 não deveria precisar mudar essa largura, já que ela é idêntica hoje nos dois caminhos.

### Integration Points
- AGD-15: `getClientesSemDiaFixo()` → `mapClienteSemDiaFixoRow()` → tipo `ClienteSemDiaFixo` → `AgendaSemDiaFixo.tsx` (prop `clientes`) — mudança de tipo atravessa essa cadeia inteira, precisa ajustar os três pontos juntos.
- KAN-03: caminho de dados ainda não totalmente mapeado — pesquisa/planejamento precisa confirmar se o problema está em `KanbanBoard.tsx`, `ClienteCard.tsx`, ou em outro lugar (ex: `ClienteToolbar.tsx`, algum provider global, CSS global).

</code_context>

<specifics>
## Specific Ideas

Nenhuma referência visual nova além das duas fotos já compartilhadas durante a conversa de definição do marco (antes/depois do filtro) — usadas para descrever o sintoma, não uma direção de design nova.

</specifics>

<deferred>
## Deferred Ideas

Nenhuma — a discussão ficou dentro do escopo da fase.

</deferred>

---

*Phase: 27-Correções do Primeiro Uso — Card Filtrado e Agenda*
*Context gathered: 2026-09-25*
