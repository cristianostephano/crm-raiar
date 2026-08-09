---
phase: 15-conclus-o-com-resumo-e-pr-xima-visita
plan: 03
subsystem: ui
tags: [react, next-client-component, date-fns, base-ui, vitest]

# Dependency graph
requires:
  - phase: 15-conclus-o-com-resumo-e-pr-xima-visita
    provides: "Plano 15-02 — lib/validations/agenda.ts (RESUMO_MIN/RESUMO_MAX/mensagens/validarResumo), lib/funil/frequencia.ts (geraProximaVisita), AgendaItem.frequenciaVisita/proximaDataSugerida, concluirTarefaProspeccao()/concluirVisita() em app/actions/agenda.ts"
provides:
  - "components/agenda/ConcluirItemDialog.tsx — janela única de conclusão, parametrizada por origem (prospeccao/visita), servindo as duas frentes"
  - "components/agenda/AgendaItemRow.tsx — botão Concluir na linha, com stopPropagation antes do callback"
  - "components/agenda/AgendaList.tsx — estado da janela de conclusão, roteamento por origem para a Server Action correta, recarga da lista no sucesso"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Janela única parametrizada por origem em vez de dois componentes quase-iguais — mesmo padrão que GanhoFrequenciaDialog/PerdaMotivoDialog já estabelecem para diálogos de confirmação com campo obrigatório"
    - "Data sugerida vinda pronta do banco (proximaDataSugerida) semeada no seletor via useEffect keyed em [open, proximaDataSugerida] — nunca recalculada no navegador, zero aritmética de data no componente"

key-files:
  created:
    - components/agenda/ConcluirItemDialog.tsx
    - tests/agenda/concluir-item-dialog.test.tsx
  modified:
    - components/agenda/AgendaItemRow.tsx
    - components/agenda/AgendaList.tsx
    - tests/agenda/agenda-item-row.test.tsx
    - tests/agenda/agenda-list.test.tsx

key-decisions:
  - "Desvio aprovado em relação a uma seção do 15-UI-SPEC.md: a data sugerida NUNCA é recalculada no navegador com date-fns addWeeks/addMonths (como uma seção mais antiga do UI-SPEC descrevia) — ela vem pronta em AgendaItem.proximaDataSugerida (Plano 15-02) e é só analisada com parseISO. Instrução explícita do Plano 15-03 (Task 1, 'Proibido neste arquivo: qualquer soma/subtração de dias, semanas ou meses') e do prompt de execução tomam precedência sobre a seção mais antiga do contrato."
  - "GENERIC_ERROR redeclarado localmente em ConcluirItemDialog.tsx com a mesma string literal — app/actions/agenda.ts não exporta sua constante homônima, mesmo padrão de duplicação intencional que GanhoFrequenciaDialog.tsx/PerdaMotivoDialog.tsx já usam."
  - "Contador de caracteres usa o comprimento bruto do campo (resumo.length), não o aparado — reflete diretamente o maxLength físico do Textarea; a validação de mínimo (10) usa o comprimento aparado, seguindo a mesma distinção que validarResumo() já faz no lado do servidor."

requirements-completed: [CONC-01, VIS-03]
# Checkpoint humano (Task 3) aprovado pelo dono do projeto em 2026-08-08
# ("approved"). Cobertura mista: passos 1-4 do how-to-verify (resumo
# obrigatório, clique não sobrepõe a ficha do cliente, item some da Agenda,
# resumo aparece no histórico com data/autor corretos) foram verificados
# ao vivo no navegador contra o Supabase real. Não havia visita pendente de
# cliente com frequência disponível para exercitar ao vivo os passos 6-8
# (sugestão/edição de próxima data e o caso "nenhuma") — o dono do projeto
# aceitou explicitamente a cobertura dos 34 testes automatizados de 15-01
# (incluindo o caso de virada de mês) e dos 9 testes de componente deste
# plano para esse caminho específico, em vez de bloquear a fase por falta
# de dado de teste ao vivo.

coverage:
  - id: D1
    description: "ConcluirItemDialog: um componente só, parametrizado por origem, com resumo obrigatório (min 10/max 500 importados de lib/validations/agenda.ts) e botão de confirmar desabilitado abaixo do mínimo"
    requirement: "CONC-01"
    verification:
      - kind: unit
        ref: "tests/agenda/concluir-item-dialog.test.tsx#desabilitado/contador/prospeccao"
        status: pass
      - kind: other
        ref: "check estrutural do Task 1 (node -e): import de lib/validations/agenda e lib/funil/frequencia, ausência de aritmética de data, ausência de construção de data via construtor cru, ausência de toISOString, teto não escrito à mão, variante do confirmar não-destrutiva, copy do contrato presente literalmente"
        status: pass
    human_judgment: false
  - id: D2
    description: "Próxima data pré-preenchida com o que o banco calculou (proximaDataSugerida, via parseISO) para visita de cliente com cadência, trocável no calendário; aviso explícito no lugar do campo para cliente sem cadência"
    requirement: "VIS-03"
    verification:
      - kind: unit
        ref: "tests/agenda/concluir-item-dialog.test.tsx#visita/nenhuma/confirma"
        status: pass
      - kind: manual_procedural
        ref: "checkpoint Task 3 — sem visita pendente de cliente com frequência disponível para clique ao vivo; dono do projeto aceitou explicitamente a cobertura dos 34 testes automatizados de 15-01 (inclui virada de mês) + os testes unit acima para este caminho, em vez de bloquear a fase"
        status: pass
    human_judgment: false
  - id: D3
    description: "Botão Concluir na linha da Agenda, com interrupção de propagação para não abrir a ficha do cliente junto"
    requirement: "CONC-01"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-item-row.test.tsx#concluir/propagacao"
        status: pass
      - kind: other
        ref: "check estrutural do Task 2 (node -e): stopPropagation presente, onConcluir exposto, ausência de chamada de app/actions na linha"
        status: pass
    human_judgment: false
  - id: D4
    description: "AgendaList roteia a confirmação para concluirTarefaProspeccao/concluirVisita conforme a origem do item e recarrega a lista (reloadKey) no sucesso — item concluído some, próxima visita aparece"
    requirement: "CONC-01"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-list.test.tsx#abre/recarrega"
        status: pass
      - kind: other
        ref: "check estrutural do Task 2 (node -e): ConcluirItemDialog renderizada, import de app/actions/agenda, setReloadKey chamado, nenhuma dependência npm nova (@tanstack/react-query/sonner ausentes do package.json)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Fluxo completo de ponta a ponta no navegador — resumo obrigatório bloqueando envio, data sugerida sem deslocamento de fuso, aviso de cliente sem cadência, recarga da Agenda após confirmar, e limpeza de estado entre clientes diferentes"
    verification:
      - kind: manual_procedural
        ref: "checkpoint Task 3, aprovado 2026-08-08 — verificado ao vivo: botão desabilitado com resumo vazio/curto ('ok') e habilitado com resumo válido, contador correto; clique em Concluir abre só o ConcluirItemDialog sem sobrepor a ClienteDetailSheet; item some da Agenda após confirmar (volta a 'Sua agenda está em dia'); resumo aparece no histórico do cliente sem prefixo, com data/autor corretos, tarefa marcada concluída"
        status: pass
    human_judgment: true
    rationale: "Sign-off do dono do projeto já registrado no checkpoint (2026-08-08, 'approved'). Caminho de próxima-data/aviso de cadência (passos 6-8 do how-to-verify) não pôde ser clicado ao vivo por falta de visita pendente de cliente com frequência — coberto por D2 acima."

# Metrics
duration: ~55min (Tasks 1-3, incluindo o checkpoint humano aprovado)
completed: 2026-08-08
status: complete
---

# Phase 15 Plan 3: Tela de Conclusão (Janela Única + Botão na Agenda) Summary

**`ConcluirItemDialog` — janela única de conclusão parametrizada por origem (prospecção/visita), com resumo obrigatório contado em tempo real e próxima data pré-preenchida do banco (nunca recalculada no navegador); botão "Concluir" na linha da Agenda com interrupção de propagação; `AgendaList` roteando para a Server Action correta e recarregando no sucesso.**

## Performance

- **Duration:** ~55 min (Tasks 1-2 `auto` + Task 3 checkpoint humano)
- **Started:** 2026-08-09T01:40:00Z (aprox.)
- **Completed (código):** 2026-08-09T02:31:36Z
- **Checkpoint aprovado:** 2026-08-08 ("approved")
- **Tasks:** 3/3 completas
- **Files modified:** 6 (1 componente novo + 1 teste novo + 2 componentes modificados + 2 testes modificados)

## Accomplishments
- `components/agenda/ConcluirItemDialog.tsx` (novo): UM componente, parametrizado por `origem: "prospeccao" | "visita"` — nunca dois componentes de conclusão. Campo de resumo obrigatório (`Textarea` com `maxLength` importado de `RESUMO_MAX`, contador `{length}/500 caracteres`, mensagens de validação importadas de `lib/validations/agenda.ts`); botão de confirmar desabilitado enquanto o resumo aparado não atinge 10 caracteres. Para `origem="visita"`, decide via `geraProximaVisita()` (autoridade única, `lib/funil/frequencia.ts`): cliente com cadência real mostra o seletor `Popover`+`Calendar` pré-preenchido com `proximaDataSugerida` (analisada com `parseISO`, nunca recalculada), cliente sem cadência mostra o aviso literal do contrato no lugar do campo. `origem="prospeccao"` nunca renderiza a seção de próxima data e sempre confirma com `proximaData = null`. Limpeza de estado (resumo/data/erros) no `handleOpenChange`, nunca num efeito reagindo à abertura virar falsa.
- `tests/agenda/concluir-item-dialog.test.tsx` (novo, 9/9 verde): casos `prospeccao`, `visita`, `nenhuma` (frequência `"nenhuma"` e `null`), `desabilitado`, `contador`, `confirma` (×2: prospecção e visita com cadência), `erro`, `limpa`.
- `components/agenda/AgendaItemRow.tsx`: novo prop obrigatório `onConcluir`; botão "Concluir" (`variant="outline"`, `size="sm"`, ícone `CheckCircle2`) como último bloco do `CardContent`, alinhado à direita; `onClick` interrompe a propagação ANTES de chamar `onConcluir`, mesmo padrão defensivo do `TooltipTrigger` do triângulo de atraso já existente na mesma linha. Comentário de cabeçalho reescrito (deixou de listar o botão como proibido). Continua sem chamar Server Action, sem ler dados, sem calcular atraso.
- `components/agenda/AgendaList.tsx`: par de estado `concluirItem`/`concluirDialogOpen` espelhando literalmente `selectedClienteId`/`sheetOpen`; `handleOpenConcluir` liga o botão da linha à abertura da janela; `handleConfirmarConclusao` roteia para `concluirTarefaProspeccao` (origem prospecção) ou `concluirVisita` (origem visita, com `frequenciaVisita` e a data confirmada) e, no sucesso, chama `handleRecarregar()` (o mesmo `reloadKey` que a ficha do cliente já usa) — é isso que faz o item concluído sumir e a próxima visita aparecer. Nenhuma biblioteca de cache nova, nenhuma atualização otimista. Comentário de cabeçalho reescrito.
- `tests/agenda/{agenda-item-row,agenda-list}.test.tsx`: casos novos `concluir`/`propagacao` (linha) e `abre`/`recarrega` (lista), mais os mocks de `concluirTarefaProspeccao`/`concluirVisita`.
- Verificação completa: `npx tsc --noEmit` limpo, `npx eslint` limpo nos três componentes tocados, 41/41 testes verdes (4 arquivos: `concluir-item-dialog`, `agenda-item-row`, `agenda-list`, `itens`), todos os checks estruturais mecânicos dos dois tasks passaram, `package.json` sem dependência nova.
- Ambiente de verificação preparado para a Task 3: `.env.local` e `supabase/.temp/` copiados do checkout principal para esta worktree (ambos gitignored, não commitados); servidor de desenvolvimento (`npm run dev`) rodando em `http://localhost:3000`, confirmado respondendo (status 200).

## Task Commits

Each task was committed atomically:

1. **Task 1: A janela única de conclusão, parametrizada pela origem** - `edad37c` (feat)
2. **Task 2: Botão de concluir na linha e ligação da janela na lista da Agenda** - `2726609` (feat)

**Task 3 (checkpoint:human-verify, gate="blocking"): APROVADO** — o dono do projeto verificou pessoalmente no navegador (2026-08-08): botão "Concluir tarefa" desabilitado com resumo vazio e com "ok" (2 chars), habilitado com resumo válido, contador correto; clique em "Concluir" abre só o `ConcluirItemDialog`, sem sobrepor a `ClienteDetailSheet`; após confirmar, o item some da Agenda (volta ao estado "Sua agenda está em dia"); no histórico do cliente, o resumo aparece exatamente como escrito, sem prefixo, com a data/hora corretas, e a tarefa aparece marcada como concluída. Não havia visita pendente de cliente com frequência disponível para testar ao vivo a sugestão/edição de próxima data e o caso "nenhuma" (passos 6-8 do how-to-verify) — o dono do projeto aceitou explicitamente a cobertura dos 34 testes automatizados de 15-01 (incluindo o caso de virada de mês) e dos 9 testes de componente deste plano para esse caminho, em vez de bloquear a fase por falta de dado de teste ao vivo. Nenhum código adicional foi produzido por esta task; ela só confirma o que as Tasks 1-2 já entregaram.

**Plan metadata:** commits deste SUMMARY.md (docs) — feitos nesta mesma worktree, por exigência de isolamento de worktree paralela (o orquestrador remove esta worktree após o retorno).

## Files Created/Modified
- `components/agenda/ConcluirItemDialog.tsx` - janela única de conclusão (novo)
- `tests/agenda/concluir-item-dialog.test.tsx` - 9 testes de componente (novo)
- `components/agenda/AgendaItemRow.tsx` - botão Concluir com stopPropagation
- `components/agenda/AgendaList.tsx` - estado da janela, roteamento por origem, recarga
- `tests/agenda/agenda-item-row.test.tsx` - casos concluir/propagacao
- `tests/agenda/agenda-list.test.tsx` - casos abre/recarrega

## Decisions Made

- **Desvio aprovado em relação a uma seção do `15-UI-SPEC.md`:** a seção "Layout & Interaction Contract" do UI-SPEC original descrevia calcular a data sugerida no navegador com `date-fns` (`addWeeks`/`addMonths` a partir de `new Date()`). O Plano 15-03 (Task 1) e o prompt de execução desta task substituem essa descrição explicitamente: a data sugerida vem pronta em `AgendaItem.proximaDataSugerida` (calculada no banco pelo Plano 15-01/15-02) e este componente só a analisa com `parseISO`, nunca recalcula. Isso está documentado como desvio aprovado, não como um erro do executor — a proibição de aritmética de data está mecanicamente verificada pelo check estrutural do Task 1 (`addMonths|addWeeks|addDays|setMonth|setDate\(` proibidos no arquivo).
- `GENERIC_ERROR` redeclarado localmente em `ConcluirItemDialog.tsx` com a mesma string literal de `app/actions/agenda.ts` (que não a exporta) — mesmo padrão de duplicação intencional já usado por `GanhoFrequenciaDialog.tsx`/`PerdaMotivoDialog.tsx`.
- Contador de caracteres mostra o comprimento bruto do campo (`resumo.length`), refletindo diretamente o `maxLength` físico do `Textarea`; a checagem de habilitação do botão usa o comprimento aparado (`resumo.trim().length`), a mesma distinção que `validarResumo()` já faz no servidor.

## Deviations from Plan

None (além do desvio aprovado em relação ao `15-UI-SPEC.md` documentado acima, que é uma correção de contrato explicitamente autorizada pelo prompt de execução, não uma decisão unilateral do executor) - as Tasks 1 e 2 foram executadas exatamente como especificado, sem necessidade de Regra 1/2/3/4.

## Issues Encountered

None.

## User Setup Required

None - nenhuma dependência npm nova, nenhuma migration, nenhuma alteração de banco. O único setup necessário nesta worktree (copiar `.env.local`/`supabase/.temp/` e iniciar o servidor de desenvolvimento) já foi feito pelo executor antes do checkpoint.

## Next Phase Readiness

- **Plano 15-03 completo, checkpoint humano aprovado.** Nenhum bloqueio remanescente — implementação, testes automatizados e verificação humana no navegador todos concluídos.
- CONC-01/VIS-03 podem ser marcados `Complete` em `REQUIREMENTS.md` (via `requirements.mark-complete`, responsabilidade do orquestrador após a wave, mesma convenção de STATE.md/ROADMAP.md nesta execução em worktree paralela).
- Cobertura mista documentada no bloco `coverage` acima (D2/D5): os passos de resumo obrigatório, isolamento do diálogo, recarga da Agenda e histórico do cliente foram verificados ao vivo; o caminho de próxima-data por cadência/aviso "nenhuma" não teve dado de teste ao vivo disponível (nenhuma visita pendente de cliente com frequência no momento do checkpoint) e teve sua cobertura automatizada aceita explicitamente pelo dono do projeto.
- Fase 15 (conclusão com resumo e próxima visita) pronta para ser encerrada — este era o último plano da fase.
- Servidor de desenvolvimento que rodava em `http://localhost:3000` nesta worktree foi encerrado após a aprovação; `.env.local`/`supabase/.temp/` (copiados do checkout principal para viabilizar a verificação, ambos gitignored) permanecem nesta worktree até sua remoção pelo orquestrador.

---
*Phase: 15-conclus-o-com-resumo-e-pr-xima-visita*
*Completed: 2026-08-08*
*Task 3 (checkpoint humano): aprovado*

## Self-Check: PASSED

Todos os 6 arquivos criados/modificados (componente novo, teste novo, 2 componentes modificados, 2 testes modificados) confirmados presentes no disco. Os 3 commits deste plano (`edad37c`, `2726609`, `9d3d15b`) confirmados presentes em `git log --oneline --all`. Checkpoint humano (Task 3) aprovado pelo dono do projeto — SUMMARY atualizado para refletir a aprovação antes deste commit final.
