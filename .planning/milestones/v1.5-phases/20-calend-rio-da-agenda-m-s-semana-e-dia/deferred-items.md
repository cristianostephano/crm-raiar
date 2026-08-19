# Deferred Items — Phase 20 (Calendário da Agenda)

## Select do filtro de vendedor perde a seleção durante QUALQUER recarga (pré-existente, fora do escopo do plano 20-05)

**Descoberto durante:** Plano 20-05, Task 1 (escrevendo o caso "vendedor sem item nenhum" do arquivo de teste de integração).

**Sintoma observável:** com o Supervisor tendo escolhido um vendedor no filtro da Agenda, qualquer recarga da tela (concluir um item, salvar/apagar um cliente pela ficha, "Tentar novamente") faz o filtro voltar sozinho para "Todos os vendedores" — mesmo quando o vendedor escolhido continua tendo itens pendentes depois da recarga.

**Causa técnica:** `AgendaList.tsx` computa a lista de opções do filtro (`vendedorOpcoesDoFiltro`) a partir de `itens`, que vira `[]` no instante síncrono em que `state` passa para `"carregando"` (início do `useEffect` de busca), mesmo que a busca em si ainda vá trazer o vendedor de volta. Esse esvaziamento momentâneo do array `items` passado ao `Select` (base-ui) faz o componente reconciliar o `value` controlado para o sentinel de "sem filtro" — confirmado isolando o caso: mesmo quando a SEGUNDA busca devolve itens do mesmo vendedor, a seleção não se recupera.

**Por que não foi corrigido agora:** o plano 20-05 proíbe explicitamente mexer no controle de filtro de vendedor ("Não mexer em nada mais: ... o controle de filtro de vendedor ... ficam exatamente como estão") e tem uma prova mecânica de que `tests/agenda/agenda-list.test.tsx` passa sem edição — o Select e o efeito de recarga são código pré-existente, não tocado pelo diff deste plano. Corrigir aqui violaria a fronteira do próprio plano (D-01) e o Rule de escopo do executor (só corrigir o que o diff da tarefa atual causou).

**Impacto no plano 20-05:** o caso de teste "vendedor sem item nenhum" (`tests/agenda/agenda-calendario-integracao.test.tsx`) foi reescrito para reproduzir o MESMO risco estrutural (barra desaparecendo junto com a Lista quando o corte de vazio decidia a tela inteira) através do caminho sem filtro (concluir o único item pendente, sem vendedor selecionado) — que é 100% reproduzível — em vez do caminho com filtro, que esbarra neste bug pré-existente e não é reproduzível de forma confiável.

**Recomendação:** quick task dedicada para o Select do filtro de vendedor: preservar o `vendedorFiltroId` durante a recarga (por exemplo, computar `vendedorOpcoesDoFiltro`/`selectItems` a partir do último `itens` não-vazio conhecido, ou desacoplar `items` do `Select` do estado `carregando`).
