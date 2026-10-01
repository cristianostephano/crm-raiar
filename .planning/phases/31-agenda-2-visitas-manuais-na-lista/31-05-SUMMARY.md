---
phase: 31-agenda-2-visitas-manuais-na-lista
plan: 05
subsystem: ui
tags: [react, typescript, shadcn, date-fns, agenda2]

requires:
  - phase: 31-agenda-2-visitas-manuais-na-lista
    plan: "02"
    provides: "Agenda2Item (lib/agenda2/itens.ts) — tipo consumido pelos dois componentes deste plano"
provides:
  - "components/agenda2/Agenda2ItemRow.tsx — linha apresentacional do item da Agenda 2: pendente/atrasado/concluído-riscado, Editar/Apagar sempre visíveis (D-06), somente-leitura pro Supervisor (D-16), nunca esmaece o cartão (divergência deliberada de AgendaItemRow)"
  - "components/agenda2/Agenda2ApagarDialog.tsx — confirmação de apagar (AGD2-04), copy exata do UI-SPEC, erro genérico em falha sem fechar a janela"
affects: [31-07, 31-08]

tech-stack:
  added: []
  patterns:
    - "Agenda2ApagarDialogBody isola apagando/erro num componente filho remontado por key={`${open}-${item?.id}`} — reseta estado de uma tentativa anterior sem precisar de useEffect, ao contrário do padrão setState-no-corpo-do-efeito já usado em EditableListTab"
    - "Agenda2ItemRow nunca recebe opacity-60 quando concluído (diferente de AgendaItemRow) — D-06 exige o item continuar totalmente editável, e esmaecer o cartão inteiro contradiria isso visualmente"

key-files:
  created:
    - components/agenda2/Agenda2ItemRow.tsx
    - components/agenda2/Agenda2ApagarDialog.tsx
    - tests/agenda2/agenda2-item-row.test.tsx
    - tests/agenda2/agenda2-apagar-dialog.test.tsx
  modified: []

key-decisions:
  - "Editar e Apagar são renderizados sem nenhuma condição sobre item.concluido (só Concluir↔Desmarcar troca) — mitigação direta do Pitfall 5 do RESEARCH.md, testada explicitamente no caso concluido-editavel"
  - "Reset de erro no Agenda2ApagarDialog via key no componente filho (open+item.id), não via useEffect — evita um efeito só para limpar estado, mesmo resultado (erro de uma tentativa anterior nunca aparece na próxima abertura)"

patterns-established: []

requirements-completed: [AGD2-03, AGD2-04, AGD2-05, AGD2-07]

coverage:
  - id: D1
    description: "Agenda2ItemRow: estados pendente/atrasado/concluído-riscado (D-02/D-04), Editar/Apagar sempre visíveis (D-06), somente-leitura pro Supervisor (D-16), sem esmaecimento no concluído"
    requirement: "AGD2-05"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-item-row.test.tsx (11 casos: pendente-no-prazo, mostra-bairro-e-data, pendente-atrasado, concluido-riscado, concluido-editavel, concluido-sem-atraso, sem-esmaecimento, callbacks, somente-leitura, responsavel, salvando)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Agenda2ApagarDialog: confirmação com nome+data antes de apagar (AGD2-04), copy exata, erro genérico sem fechar a janela em falha"
    requirement: "AGD2-04"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-apagar-dialog.test.tsx (5 casos: texto, cancelar, confirmar-sucesso, confirmar-falha, sem-item)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Data sempre formatada com parseISO (nunca o construtor de data a partir de texto) nos dois componentes — regressão de fuso impossível"
    requirement: "AGD2-03"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-item-row.test.tsx#mostra-bairro-e-data, tests/agenda2/agenda2-apagar-dialog.test.tsx#texto"
        status: pass
    human_judgment: false
  - id: D4
    description: "Filtro por vendedor (responsavel/responsavelNome) exposto via showResponsavel na linha — superfície consumida pela Lista (31-08)"
    requirement: "AGD2-07"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-item-row.test.tsx#responsavel"
        status: pass
    human_judgment: false

duration: ~7min
completed: 2026-10-01
status: complete
---

# Phase 31 Plan 5: Linha do Item e Confirmação de Apagar da Agenda 2 Summary

**Dois componentes apresentacionais TDD — `Agenda2ItemRow` (pendente/atrasado/concluído-riscado-mas-editável, somente-leitura pro Supervisor) e `Agenda2ApagarDialog` (confirmação com nome+data) — com 16/16 testes verdes, irmãos novos sem tocar `components/agenda/*`.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-10-01T10:03:09-03:00
- **Completed:** 2026-10-01T10:10:16-03:00
- **Tasks:** 2
- **Files modified:** 4 (todos criados, nenhum arquivo existente alterado)

## Accomplishments
- `components/agenda2/Agenda2ItemRow.tsx` criado: `Card size="sm"` com borda vermelha só quando `atrasado && !concluido` (D-02), título riscado + selo "Concluído" quando concluído (D-04), botões Editar/Apagar ghost sempre renderizados e Concluir↔Desmarcar trocando por estado (D-06, Pitfall 5), linha de ações inteira ausente quando `podeAlterar=false` (D-16), e **nunca** `opacity-60` no cartão concluído — divergência deliberada de `AgendaItemRow` registrada no UI-SPEC.
- `components/agenda2/Agenda2ApagarDialog.tsx` criado: título "Apagar item", corpo "Tem certeza que deseja apagar o item de {nome} em {dd/MM}? Essa ação não pode ser desfeita.", Cancelar (ghost) nunca chama `onConfirmar`, Apagar (destructive) mostra "Apagando..." desabilitado enquanto pendente e só fecha a janela quando `onConfirmar` resolve `true`; falha mostra `role="alert"` com a mensagem genérica do projeto e mantém a janela aberta.
- `tests/agenda2/agenda2-item-row.test.tsx`: 11 casos verdes.
- `tests/agenda2/agenda2-apagar-dialog.test.tsx`: 5 casos verdes.
- `components/agenda/*` (Agenda atual) confirmado intocado: `git diff --name-only 071871f -- components/agenda` não lista nada.
- `npx tsc --noEmit` e `npx eslint` dos 4 arquivos terminam com código 0.

## Task Commits

Each task was committed atomically:

1. **Tarefa 1 RED: testes da linha do item da Agenda 2** - `5af6dce` (test)
2. **Tarefa 1 GREEN: linha do item da Agenda 2** - `3e5a2dd` (feat)
3. **Tarefa 2 RED: testes da confirmação de apagar item da Agenda 2** - `e09089b` (test)
4. **Tarefa 2 GREEN: confirmação de apagar item da Agenda 2** - `0f798a2` (feat)

**Plan metadata:** pending (this commit)

_Nota: as 4 tarefas TDD deste plano (duas RED, duas GREEN) resultaram em 4 commits — não houve necessidade de um commit REFACTOR em nenhuma delas; o código ficou verde já na primeira versão escrita._

## Files Created/Modified
- `components/agenda2/Agenda2ItemRow.tsx` - linha apresentacional do item da Agenda 2 (estados + ações)
- `components/agenda2/Agenda2ApagarDialog.tsx` - janela de confirmação de apagar
- `tests/agenda2/agenda2-item-row.test.tsx` - 11 testes de estado/ação da linha
- `tests/agenda2/agenda2-apagar-dialog.test.tsx` - 5 testes da confirmação de apagar

## Decisions Made
- `Editar`/`Apagar` nunca são condicionados a `item.concluido` — only `podeAlterar` controla se a linha de ações inteira aparece; a única troca por estado é `Concluir`↔`Desmarcar`, exatamente o que o UI-SPEC e o Pitfall 5 do RESEARCH.md pedem.
- O reset de `erro`/`apagando` no `Agenda2ApagarDialog` usa um componente filho (`Agenda2ApagarDialogBody`) remontado via `key={`${open}-${item?.id ?? "none"}`}` em vez de um `useEffect` — o mesmo resultado (erro de uma tentativa anterior nunca sobrevive à próxima abertura) sem precisar de um efeito só para isso.
- `Card` sem `role="button"`/`tabIndex` em `Agenda2ItemRow` (diferente de `AgendaItemRow`) — não existe ficha de cliente para abrir, já que `nomeCliente` é texto livre, não uma referência a `clientes`.

## Deviations from Plan

None - plan executed exactly as written. Os 16 casos de teste e a implementação dos dois componentes seguem literalmente o bloco `<behavior>`/`<action>` de cada tarefa do 31-05-PLAN.md, inclusive a estrutura `Card`/`CardHeader`/`CardContent` e as classes utilitárias do UI-SPEC.

## Issues Encountered
None.

## User Setup Required
None - componentes puramente apresentacionais em TypeScript, sem dependência de serviço externo nem de banco.

## Alerta de Conformidade (LGPD)

Conforme instrução organizacional: este plano renderiza na tela dados pessoais já validados/persistidos pelos planos anteriores da fase (31-01/31-02/31-04) — nome livre do cliente (que pode identificar uma pessoa física em pequenos negócios PJ/MEI), bairro e, quando `showResponsavel=true`, o nome do vendedor dono do item. Nenhum dado novo é coletado aqui (os dois componentes são apresentacionais: recebem `Agenda2Item` já pronto via props e delegam toda escrita a callbacks de quem compõe, 31-08) e nenhuma informação adicional é exibida além do que os planos anteriores já definiram como o mínimo necessário. `showResponsavel` continua sendo decisão de quem compõe a tela (reservado ao Supervisor vendo "Todos", conforme 31-UI-SPEC.md) — este plano não introduz nenhum caminho novo de exposição desse nome. Apagar um item passa por confirmação explícita (`Agenda2ApagarDialog`), reduzindo o risco de perda acidental de dado por clique errado.

## Next Phase Readiness
- `Agenda2ItemRow` e `Agenda2ApagarDialog` estão prontos para serem compostos pela Lista (31-08): a interface publicada (`item`, `atrasado`, `showResponsavel`, `podeAlterar`, `salvando`, `onEditar`/`onApagar`/`onConcluir`/`onDesmarcar` para a linha; `open`/`onOpenChange`/`item`/`onConfirmar` para o diálogo) é exatamente a que o 31-05-PLAN.md publicou para o plano 31-08 consumir.
- Nenhum bloqueio para os planos seguintes da fase (31-06 formulário, 31-07 tela, 31-08 Lista) — este plano não toca em `lib/agenda2/*`, Supabase, nem em `components/agenda/*`.
- `Agenda2ApagarDialog.onConfirmar` espera `Promise<boolean>` (true = apagou; false = falhou) — a Lista (31-08) deve adaptar o retorno de `apagarAgenda2Item` (Server Action do 31-04) para esse contrato booleano antes de passar o callback.

---
*Phase: 31-agenda-2-visitas-manuais-na-lista*
*Completed: 2026-10-01*

## Self-Check: PASSED

- FOUND: components/agenda2/Agenda2ItemRow.tsx
- FOUND: components/agenda2/Agenda2ApagarDialog.tsx
- FOUND: tests/agenda2/agenda2-item-row.test.tsx
- FOUND: tests/agenda2/agenda2-apagar-dialog.test.tsx
- FOUND commit: 5af6dce (Tarefa 1 RED)
- FOUND commit: 3e5a2dd (Tarefa 1 GREEN)
- FOUND commit: e09089b (Tarefa 2 RED)
- FOUND commit: 0f798a2 (Tarefa 2 GREEN)
- Re-ran `npx vitest run tests/agenda2/agenda2-item-row.test.tsx tests/agenda2/agenda2-apagar-dialog.test.tsx` — 16/16 passed
- Re-ran `npx tsc --noEmit` — clean
- Re-ran `npx eslint components/agenda2/Agenda2ItemRow.tsx components/agenda2/Agenda2ApagarDialog.tsx tests/agenda2/agenda2-item-row.test.tsx tests/agenda2/agenda2-apagar-dialog.test.tsx` — clean
- Confirmed `git diff --name-only 071871f -- components/agenda` lists no file (Agenda atual intocada)
