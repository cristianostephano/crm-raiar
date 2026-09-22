# Quick Task 260921-n0a: Adicionar uma forma alternativa de avançar/mudar a etapa do cliente no funil, além de arrastar o card (drag-and-drop) - Context

**Gathered:** 2026-09-21 (revisado em 2026-09-22 após teste real com o time)
**Status:** Ready for planning (revisão 2 — decisões D-01/D-02 substituídas)

<domain>
## Task Boundary

Adicionar uma forma alternativa de avançar/mudar a etapa do cliente no funil, além de arrastar o card (drag-and-drop). Hoje o drag-and-drop é o único jeito de mover um cliente entre as 7 colunas do Kanban — não existe botão, menu ou seletor pra isso.

**Achado do teste real com o time (2026-09-22):** o dono do projeto testou o arrastar ao vivo com a equipe. Não houve erro técnico (nenhum crash, nenhuma mensagem de falha) — mas o gesto de arrastar "simplesmente não ia" na maioria das tentativas, só funcionando depois de várias tentativas. Isso é consistente com uma fricção de usabilidade do gesto de arrastar (não um bug isolado) — registrado aqui como sintoma observado, não diagnosticado a fundo (fora do escopo desta task; ver nota em `<specifics>`).

Por causa desse achado, a Revisão 2 desta task SUBSTITUI as decisões originais (Revisão 1, abaixo) por uma abordagem diferente: setas de avançar/voltar direto no card do Kanban, em vez de um seletor na ficha do cliente.

</domain>

<decisions>
## Implementation Decisions (Revisão 2 — vale esta, substitui a Revisão 1 abaixo)

### Onde o controle aparece
- **Direto no card do Kanban**, não na ficha do cliente. Duas setas pequenas no próprio card: uma pra avançar, uma pra voltar uma etapa.

### Liberdade de movimento
- **Só avançar ou voltar UMA etapa por vez** (etapa adjacente), não mais escolha livre entre as 7. É exatamente o que arrastar já faz quando solta na coluna vizinha — só que sem precisar arrastar.

### Coexistência com o arrastar
- Arrastar **continua existindo e funcionando exatamente como hoje**. As setas são um caminho a mais, não uma substituição — ninguém perde a forma que já conhecia.

### Confirmação antes de aplicar
- Aplica na hora, sem diálogo de confirmação (mesma decisão da Revisão 1, não muda).

### Reaproveitamento de lógica (requisito técnico não-negociável, não muda)
- O novo controle DEVE chamar a mesma Server Action/RPC que o drag-and-drop já usa (`moverCard` → `mover_card_funil`), nunca uma lógica de movimentação paralela — mesmo raciocínio da Revisão 1.

### Bordas do funil (Claude's Discretion)
- Na primeira etapa ("Aguardando contato"), a seta de voltar não aparece (ou fica desabilitada) — não existe etapa anterior. Na última etapa ("1ª venda concluída"), a seta de avançar não aparece — não existe etapa seguinte. Isso é só sobre a grade do funil (sempre 7 etapas fixas), não duplica nenhuma trava de negócio do RPC.

### Erro do RPC (Claude's Discretion)
- Se o RPC recusar a mudança (ex.: cliente já "ganho"), o erro aparece no mesmo aviso/banner transitório que o próprio KanbanBoard já usa hoje para erros de arrastar (Fase 02-04) — não inventar um segundo mecanismo de erro. Nenhum item é desabilitado antecipadamente tentando adivinhar essa recusa (mesmo princípio E-02 da Revisão 1: a trava mora só no RPC).

### Claude's Discretion (geral)
- Posição de destino ao mover pela seta: fim da coluna de destino (mesmo raciocínio já usado na Revisão 1 — `posicao` é só ordenação visual).
- Ícone/estilo exato das setas: seguir o padrão visual já usado no card (`components/clientes/ClienteCard.tsx`), tamanho compatível com toque em celular/tablet (é justamente o cenário que motivou esta mudança).

</decisions>

<specifics>
## Specific Ideas

Nenhuma referência visual específica — seguir o padrão visual já estabelecido no card do Kanban (`ClienteCard.tsx`).

**Fora do escopo desta task, registrar como possível trabalho futuro:** o "não ia" do arrastar relatado pelo time pode indicar um problema real no gesto de drag-and-drop em si (ex.: sensor de toque, distância mínima de ativação do dnd-kit) — vale investigar separadamente depois, já que as setas resolvem o problema imediato do time sem depender de descobrir a causa raiz do arrastar.

</specifics>

<canonical_refs>
## Canonical References

- `components/clientes/KanbanBoard.tsx` — `handleDragEnd` → `moverCard()` (comportamento de referência a replicar); também já tem um banner transitório de erro (Fase 02-04) a reaproveitar para o erro das setas.
- `app/actions/funil.ts` — `moverCard()` (chama RPC `mover_card_funil`).
- `components/clientes/ClienteCard.tsx` — onde as duas setas novas devem ser adicionadas.
- `lib/funil/etapas.ts` — lista `ETAPAS`/`ETAPA_KEYS`, usada pra achar a etapa anterior/seguinte de uma etapa dada.

</canonical_refs>

<superseded>
## Revisão 1 (2026-09-21) — SUBSTITUÍDA, mantida aqui só como histórico

- Onde: na ficha do cliente (`ClienteDetailSheet.tsx`), não no card.
- Liberdade: Select livre entre as 7 etapas.
- Motivo da troca: teste real com o time (2026-09-22) mostrou que o problema urgente é o próprio gesto de arrastar ser difícil de usar, principalmente em celular/tablet — um controle direto no card resolve isso mais diretamente que um seletor escondido dentro da ficha.

</superseded>
