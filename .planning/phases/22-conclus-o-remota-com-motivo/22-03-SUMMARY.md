---
phase: 22-conclus-o-remota-com-motivo
plan: 03
subsystem: frontend
tags: [react, server-actions, supabase, forms, select, checkbox]

# Dependency graph
requires:
  - phase: 22-conclus-o-remota-com-motivo
    plan: 01
    provides: "concluir_tarefa_prospeccao/concluir_visita aceitando p_motivo_conclusao_remota_id (default null, sempre no fim); migration 0022 em produção"
  - phase: 22-conclus-o-remota-com-motivo
    plan: 02
    provides: "getMotivosConclusaoRemotaAtivos() e revalidatePath(\"/agenda\") nas 3 ações de escrita de lista"
provides:
  - "concluirTarefaProspeccao/concluirVisita (app/actions/agenda.ts) com motivoConclusaoRemotaId opcional, sempre no fim, normalizado antes de chegar ao banco"
  - "ConcluirItemDialog.tsx com a caixa 'Não foi presencial' + Select de motivo condicional, válida para as DUAS origens (D-01), desmarcar sempre limpa a escolha (T-22-16)"
  - "app/(app)/agenda/page.tsx buscando getMotivosConclusaoRemotaAtivos() e repassando como motivoConclusaoRemotaOptions"
  - "AgendaList.tsx roteando o identificador do motivo para as DUAS ações de conclusão conforme a origem do item"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seção condicional de checkbox + Select dentro de um diálogo já existente (molde: PerdaMotivoDialog.tsx) — botão desabilitado é cortesia de interface, a fronteira real fica na RPC (plano 22-01)"

key-files:
  created: []
  modified:
    - app/actions/agenda.ts
    - components/agenda/ConcluirItemDialog.tsx
    - components/agenda/AgendaList.tsx
    - "app/(app)/agenda/page.tsx"
    - tests/agenda/concluir-item-dialog.test.tsx
    - tests/agenda/agenda-list.test.tsx
    - tests/agenda/agenda-calendario-integracao.test.tsx

key-decisions:
  - "CONC-02/CONC-03/CONC-04/CONC-05 marcados Complete em REQUIREMENTS.md após este plano — é o último dos três planos da Fase 22, e a própria auditoria do 22-01 já apontava que nenhum requisito fechava sozinho antes da tela existir."
  - "Teste de roteamento (Task 2, caso 'roteia') dividido em DOIS casos independentes ('roteia (prospecção)' e 'roteia (visita)'), ambos com a palavra-chave, em vez de um único caso com unmount()+remontagem sequencial — ver Deviations."
  - "Dados de teste do checkpoint humano (2 clientes, 1 tarefa, 1 visita) semeados e apagados via service-role client, nunca pela UI — mesmo padrão já travado na Fase 19-04, evita depender de signInWithPassword extra e do rate-limit conhecido do Supabase Auth."

patterns-established: []

requirements-completed: [CONC-02, CONC-03, CONC-04, CONC-05]

coverage:
  - id: D1
    description: "Checkbox 'Não foi presencial' + Select de motivo condicional na janela de conclusão, válida para as DUAS origens (prospecção e visita); desmarcar sempre limpa a escolha; botão de confirmar cobre a falta de motivo"
    requirement: "CONC-02"
    verification:
      - kind: unit
        ref: "tests/agenda/concluir-item-dialog.test.tsx (5 casos novos: presencial, remoto, desmarcar, proximavisita, semlista)"
        status: pass
    human_judgment: false
  - id: D2
    description: "AgendaList roteia o identificador do motivo para as DUAS ações de conclusão (prospecção E visita), cada uma no fim da lista de argumentos"
    requirement: "CONC-02"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-list.test.tsx#roteia (prospecção) / #roteia (visita)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Conclusão remota grava o motivo e o Diário exibe '[Nome do motivo] resumo' nas duas origens; conclusão presencial permanece idêntica (sem colchete); a próxima visita continua sendo sugerida na conclusão remota; o Vendedor (não só o Supervisor) vê a lista de motivos preenchida — provado ao vivo, nas duas contas, no navegador"
    requirement: "CONC-03, CONC-04, CONC-05"
    verification:
      - kind: manual_procedural
        ref: "Task 3 checkpoint (pontos a-e): Supervisor administra a 6ª aba, Vendedor vê o dropdown preenchido, tarefa E visita concluídas remotamente com motivo no Diário, conclusão presencial intacta, próxima visita sugerida — aprovado pelo dono do projeto em 2026-08-19 ('tudo certo')"
        status: pass
    human_judgment: true
    rationale: "A falha de maior risco desta fase é silenciosa (RLS mal configurada deixa o dropdown do Vendedor vazio sem erro nenhum, já aconteceu uma vez neste projeto) e só é observável logado como Vendedor de verdade no navegador contra o banco de produção — não é reproduzível com confiança por mock/unit test."

duration: ~40min
completed: 2026-08-19
status: complete
---

# Phase 22 Plan 3: Tela de Conclusão Remota com Motivo Summary

**ConcluirItemDialog.tsx ganha a caixa "Não foi presencial" + Select de motivo condicional (válida para tarefa de prospecção E visita), o valor percorre app/actions/agenda.ts até as duas RPCs do plano 22-01, e a verificação humana em duas contas (Supervisor/Vendedor) provou o fluxo de ponta a ponta — fechando a Fase 22 e o marco v1.5 inteiro.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-19
- **Tasks:** 3/3 (Task 1 auto, Task 2 auto, Task 3 checkpoint humano — aprovado)
- **Files modified:** 7 (4 de produto + 3 de teste)

## Accomplishments

- `app/actions/agenda.ts`: `concluirTarefaProspeccao`/`concluirVisita` ganharam `motivoConclusaoRemotaId` opcional, sempre no ÚLTIMO parâmetro, normalizado (texto vazio/só espaços vira `null`) antes de seguir para `p_motivo_conclusao_remota_id` nas duas RPCs — nenhuma validação nova aqui, nenhum código de erro novo, e o bloco que decide o envio da próxima data (D-07) ficou byte a byte igual.
- `ConcluirItemDialog.tsx`: seção nova posicionada entre o Resumo e a seção de próxima visita, válida para as DUAS origens (D-01) — caixa "Não foi presencial" (desmarcada por padrão) e, quando marcada, um `Select` de motivo alimentado pelo catálogo recebido como propriedade; catálogo vazio mostra uma mensagem em vez de um Select mudo. Desmarcar sempre limpa o motivo escolhido (T-22-16), inclusive ao fechar a janela. O botão de confirmar ganhou uma quarta condição de desabilitado (marcado sem motivo), revalidada em `handleConfirm` antes de chamar `onConfirm`.
- `app/(app)/agenda/page.tsx`: passou a buscar `getMotivosConclusaoRemotaAtivos()` junto das duas buscas que já fazia, repassando o resultado como `motivoConclusaoRemotaOptions`.
- `AgendaList.tsx`: `handleConfirmarConclusao` cresceu um terceiro parâmetro e passou a repassar o identificador do motivo às DUAS ações de conclusão (prospecção e visita), cada uma no fim da sua lista de argumentos — o ponto exato que o projeto já tinha se avisado ser fácil de esquecer pela metade.
- 5 casos novos em `concluir-item-dialog.test.tsx` (presencial, remoto, desmarcar, proximavisita, semlista) e 2 casos de roteamento em `agenda-list.test.tsx` (um por origem), todos verdes; os quatro arquivos de teste de conclusão de banco (planos 22-01) seguem com zero diff.
- **Checkpoint humano (Task 3) aprovado pelo dono do projeto**: sexta aba de Configurações administrada como Supervisor, dropdown de motivo confirmado NÃO vazio como Vendedor, tarefa E visita concluídas remotamente com o motivo aparecendo no Diário como `[Nome do motivo] resumo`, conclusão presencial confirmada intacta (sem colchete, nenhuma interação nova), e a próxima visita confirmada sendo sugerida normalmente numa conclusão remota. Dados de teste (2 clientes, 1 tarefa, 1 visita) semeados e depois apagados via service-role client, nunca pela UI.

## Task Commits

1. **Task 1: As duas ações de conclusão repassam o motivo — juntas, nunca só uma** - `126835f` (feat)
2. **Task 2: Marcação "não foi presencial" na janela, catálogo vindo da página, roteamento para as duas origens** - `84fa176` (feat)
3. **Task 3: Verificação humana no navegador — as duas contas, as duas origens, e a conclusão presencial intacta** - checkpoint humano; aprovado pelo dono do projeto ("tudo certo" nos 5 pontos a-e)

**Plan metadata:** (este commit — docs: complete plan)

## Files Created/Modified

- `app/actions/agenda.ts` - `motivoConclusaoRemotaId` opcional no fim das duas ações, normalizado, repassado a `p_motivo_conclusao_remota_id`
- `components/agenda/ConcluirItemDialog.tsx` - checkbox "Não foi presencial" + Select de motivo condicional, dois estados novos, limpeza no fechar, quarta condição de desabilitado
- `components/agenda/AgendaList.tsx` - `motivoConclusaoRemotaOptions` recebida e repassada; `handleConfirmarConclusao` roteia o identificador para as duas ações
- `app/(app)/agenda/page.tsx` - busca `getMotivosConclusaoRemotaAtivos()` junto das outras duas, repassa como propriedade nova
- `tests/agenda/concluir-item-dialog.test.tsx` - 5 casos novos (presencial/remoto/desmarcar/proximavisita/semlista) + `motivoOptions` no molde de render
- `tests/agenda/agenda-list.test.tsx` - 2 casos de roteamento (`roteia (prospecção)`/`roteia (visita)`) + `motivoConclusaoRemotaOptions: []` no molde de render
- `tests/agenda/agenda-calendario-integracao.test.tsx` - só o molde de render ajustado para a nova propriedade obrigatória (arquivo fora da lista original do plano — ver Deviations)

## Decisions Made

- CONC-02/CONC-03/CONC-04/CONC-05 marcados **Complete** em REQUIREMENTS.md — este é o plano que fecha os quatro, encerrando a Fase 22 e o marco v1.5 inteiro.
- Dados de teste do checkpoint humano semeados/apagados via service-role client (nunca pela UI), mesmo padrão já travado na Fase 19-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tests/agenda/agenda-calendario-integracao.test.tsx` precisou da nova propriedade obrigatória**
- **Found during:** Task 2, verificação `npx tsc --noEmit`
- **Issue:** Este arquivo de teste (Fase 20-05, fora da lista `files_modified` do plano) também renderiza `AgendaList` diretamente, com seu próprio molde de render — `motivoConclusaoRemotaOptions` virando propriedade obrigatória quebrou a checagem de tipos aqui também.
- **Fix:** Acrescentada `motivoConclusaoRemotaOptions={[]}` ao molde de render deste arquivo, mesma mudança já feita no molde de `agenda-list.test.tsx`. Nenhuma asserção de teste mudou.
- **Files modified:** tests/agenda/agenda-calendario-integracao.test.tsx
- **Verification:** `npx tsc --noEmit` limpo; suíte (8 casos) roda verde sem alteração de comportamento.
- **Committed in:** `84fa176` (Task 2 commit)

**2. [Rule 1 - Bug] Caso de roteamento dividido em dois, por causa da fila de mocks não-consumidos entre testes**
- **Found during:** Task 2, ao escrever o caso `roteia` (originalmente um único teste cobrindo as duas origens com `unmount()` no meio)
- **Issue:** `mockClear()` (chamado no `beforeEach`) limpa `mock.calls` mas NÃO limpa implementações `mockResolvedValueOnce` ainda não consumidas. Ao concluir a tarefa de prospecção na primeira metade do teste, a recarga automática (`handleRecarregar`) dispara uma segunda chamada a `getAgendaAction()` que é assíncrona; sem esperar explicitamente por ela, o teste seguia para a segunda metade (visita) antes dessa chamada terminar, deixando o valor enfileirado para ela ainda não consumido quando o próximo `it()` começava — o próximo teste então recebia esse valor "atrasado" no lugar do seu próprio.
- **Fix:** Dividido em dois casos independentes, `roteia (prospecção)` e `roteia (visita)` (mesma palavra-chave `roteia`, conforme a alternativa já prevista no próprio plano: "as duas metades no MESMO caso, ou dois casos, ambos com a palavra-chave"), cada um com seu próprio `renderList()` e sem `unmount()` manual — o `cleanup()` global de `tests/setup.ts` cuida do desmonte. Cada caso agora também espera explicitamente pela segunda chamada de `getAgendaAction()` (`toHaveBeenCalledTimes(2)`) antes de terminar, evitando o mesmo vazamento para qualquer teste futuro que venha depois no arquivo.
- **Files modified:** tests/agenda/agenda-list.test.tsx
- **Verification:** `npx vitest run tests/agenda/agenda-list.test.tsx` verde (11/11), inclusive rodando o arquivo inteiro em sequência (não só o caso isolado).
- **Committed in:** `84fa176` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug de teste)
**Impact on plan:** Nenhuma das duas mudou comportamento de produto; ambas necessárias para o arquivo compilar/passar de forma determinística. Sem scope creep.

## Issues Encountered

None além das duas deviations acima.

## User Setup Required

None - nenhuma configuração externa nova. O dono do projeto já rodou o checkpoint de verificação diretamente no navegador (`npm run dev`, localhost:3000).

## Next Phase Readiness

- Fase 22 completa: as três camadas (banco no plano 22-01, Configurações no plano 22-02, tela no plano 22-03) estão fiadas de ponta a ponta e provadas com sessão real de Vendedor.
- **Marco v1.5 completo** — as três fases (20 Calendário, 21 Histórico do Calendário, 22 Conclusão Remota) entregam os 12 requisitos do marco (AGD-07..AGD-14, CONC-02..CONC-05).
- Nenhum bloqueio conhecido para o próximo marco.

---
*Phase: 22-conclus-o-remota-com-motivo*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: `app/actions/agenda.ts`
- FOUND: `components/agenda/ConcluirItemDialog.tsx`
- FOUND: `components/agenda/AgendaList.tsx`
- FOUND: `app/(app)/agenda/page.tsx`
- FOUND: `tests/agenda/concluir-item-dialog.test.tsx`
- FOUND: `tests/agenda/agenda-list.test.tsx`
- FOUND: `.planning/phases/22-conclus-o-remota-com-motivo/22-03-SUMMARY.md`
- FOUND: commit `126835f` in git log
- FOUND: commit `84fa176` in git log
