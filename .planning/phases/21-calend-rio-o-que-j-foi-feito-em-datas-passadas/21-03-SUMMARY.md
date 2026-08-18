---
phase: 21-calend-rio-o-que-j-foi-feito-em-datas-passadas
plan: 03
subsystem: ui
tags: [react, typescript, date-fns, lucide-react, calendar, agenda]

requires:
  - phase: 21-calend-rio-o-que-j-foi-feito-em-datas-passadas
    provides: "estaAtrasado(item, now?) — autoridade unica de atraso do calendario, sempre falso para item concluido (plano 21-02)"
provides:
  - "AgendaItemRow sabendo renderizar item.concluido: botao Concluir ausente do documento, marca visual 'Concluido' somada ao selo de origem, triangulo de atraso suprimido localmente"
  - "AgendaCalendarioDia/Semana/Mes perguntando estaAtrasado (nao mais bucketDoItem direto) — nenhuma das tres visoes pode mais pintar de vermelho um registro historico"
  - "WeekItemChip/MonthItemChip com o mesmo tratamento visual de concluido (border-l-emerald-600 + CheckCircle2 + opacidade reduzida)"
  - "AgendaCalendarioToolbar com a quarta entrada de legenda (Concluido)"
affects: [21-04]

tech-stack:
  added: []
  patterns:
    - "Indicador de concluido sempre derivado do proprio item (item.concluido), nunca de propriedade nova nem de callback ter sido passado — evita que o chamador precise filtrar antes de renderizar"
    - "Cor de acento de concluido (verde-esmeralda-600 do Tailwind) entra na MESMA posicao de composicao de classes que a cor de acento de atraso ja ocupa (cn mantendo a ultima classe conflitante) — nunca coexistem porque estaAtrasado ja garante isso"
    - "Icone de conferido SOMA-se ao icone de origem, nunca o substitui (AGD-12)"

key-files:
  created: []
  modified:
    - components/agenda/AgendaItemRow.tsx
    - components/agenda/AgendaCalendarioDia.tsx
    - components/agenda/AgendaCalendarioSemana.tsx
    - components/agenda/AgendaCalendarioMes.tsx
    - components/agenda/AgendaCalendarioToolbar.tsx
    - tests/agenda/agenda-item-row.test.tsx
    - tests/agenda/agenda-calendario-dia.test.tsx
    - tests/agenda/agenda-calendario-semana.test.tsx
    - tests/agenda/agenda-calendario-mes.test.tsx
    - tests/agenda/agenda-calendario-toolbar.test.tsx

key-decisions:
  - "Cor de acento de concluido: verde-esmeralda-600 do Tailwind (border-emerald-600/text-emerald-600/bg-emerald-600), travada em <decisoes_visuais> do plano"
  - "Icone de concluido: CheckCircle2 (o mesmo que o botao Concluir ja usa), nao um icone novo"
  - "Sem texto riscado — distincao vem de cor de acento + icone + opacidade reduzida (opacity-60) no cartao/chip inteiro"
  - "AgendaCalendarioDia/Semana/Mes trocam bucketDoItem(item.data, now) por estaAtrasado(item, now) — nenhuma das tres visoes decide atraso por conta propria"

requirements-completed: [AGD-13]

coverage:
  - id: D1
    description: "AgendaItemRow nao renderiza o botao Concluir (ausencia no documento) quando item.concluido e verdadeiro"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-item-row.test.tsx#AgendaItemRow > concluído: o botão de concluir NÃO está no documento (ausência, não desabilitação)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Item concluido mostra a marca 'Concluido' e continua mostrando o selo de origem correto (AGD-12 preservado)"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-item-row.test.tsx#AgendaItemRow > concluído: mostra a marca de concluído E continua mostrando o selo de origem correto"
        status: pass
    human_judgment: false
  - id: D3
    description: "Item concluido nao exibe aviso de atraso mesmo com atrasado=true recebido do chamador"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-item-row.test.tsx#AgendaItemRow > concluído: não exibe o aviso de atraso mesmo com atrasado=true"
        status: pass
    human_judgment: false
  - id: D4
    description: "Item concluido continua chamando onOpen ao ser clicado/acionado pelo teclado"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-item-row.test.tsx#AgendaItemRow > concluído: clicar no cartão continua chamando onOpen"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visao de dia: item concluido com data passada nao recebe borda de atraso e nao mostra Concluir; um dia com pendente+concluido trata cada um distintamente"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-dia.test.tsx#AgendaCalendarioDia > concluído: item com data passada não recebe a borda de atraso e não mostra o botão Concluir"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-dia.test.tsx#AgendaCalendarioDia > um pendente e um concluído no mesmo dia: cada um recebe seu próprio tratamento"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visao de semana: cartao pequeno de item concluido mostra marca + icone de origem, sem acento de atraso"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-semana.test.tsx#AgendaCalendarioSemana > concluído: cartão pequeno mostra a marca de concluído e o ícone de origem, sem acento de atraso"
        status: pass
    human_judgment: false
  - id: D7
    description: "Visao de mes: chip de item concluido mostra marca + icone de origem sem acento de atraso, inclusive em celula de mes vizinho; contagem/+N soma pendentes e concluidos numa unica reparticao"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#AgendaCalendarioMes > chip de item concluído mostra a marca de concluído e o ícone de origem, sem o acento de atraso"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#AgendaCalendarioMes > Pitfall 9 (concluído): item concluído numa célula de mês vizinho não recebe acento de atraso"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-mes.test.tsx#AgendaCalendarioMes > a contagem da célula soma pendentes e concluídos: 2 pendentes + 3 concluídos mostra 3 chips e +2 mais"
        status: pass
    human_judgment: false
  - id: D8
    description: "Legenda da barra de ferramentas ganha a quarta entrada Concluido nas visoes de calendario, ausente na visao de Lista"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-calendario-toolbar.test.tsx#AgendaCalendarioToolbar > a legenda ganha a quarta marca — concluído — nas visões de calendário"
        status: pass
      - kind: unit
        ref: "tests/agenda/agenda-calendario-toolbar.test.tsx#AgendaCalendarioToolbar > com rótulo nulo (visão de Lista), a marca de concluído também não aparece"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-18
status: complete
---

# Phase 21 Plan 03: Cartão e três visões do calendário aprendem a mostrar concluído Summary

**`AgendaItemRow` + `AgendaCalendarioDia`/`Semana`/`Mes`/`Toolbar` estendidos para renderizar um item já concluído sem oferecer a ação de concluir de novo: botão ausente do documento, marca verde-esmeralda-600 com ícone de conferido somada ao selo de origem, e nenhuma das três visões pinta mais um registro histórico de vermelho.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-18T22:16Z
- **Tasks:** 3/3
- **Files modified:** 10

## Accomplishments

- `AgendaItemRow` deriva `item.concluido` localmente (nunca uma propriedade nova nem `onConcluir` ausente) para decidir três coisas: não renderizar o botão Concluir, suprimir o triângulo de atraso mesmo se `atrasado=true` chegar do chamador, e mostrar uma marca "Concluído" (ícone `CheckCircle2`, verde-esmeralda-600) somada — nunca em lugar — do selo de origem existente
- `AgendaCalendarioDia`/`Semana`/`Mes` trocam a pergunta de atraso direto à classificação de seção (`bucketDoItem`) pela autoridade única do calendário (`estaAtrasado`, publicada pelo plano 21-02) — nenhuma das três visões pode mais pintar de vermelho um item concluído com data no passado
- `WeekItemChip`/`MonthItemChip` ganham o mesmo tratamento visual de concluído do cartão da Lista: classe `border-l-emerald-600` na mesma posição de composição onde a classe de atraso já entra, ícone de conferido pequeno somado ao ícone de origem, opacidade reduzida
- A repartição `dividirCelula`/contagem "+N" da grade de mês não precisou de nenhuma mudança de código — já opera sobre a lista mesclada que a célula recebe; um teste novo prova que 2 pendentes + 3 concluídos no mesmo dia contam 5 e mostram "+2 mais"
- `AgendaCalendarioToolbar` ganha a quarta entrada da legenda ("Concluído", verde-esmeralda-600), presente nas visões de calendário e ausente na visão de Lista, mesma condição das outras três

## Task Commits

Each task followed RED → GREEN:

1. **Task 1: O cartão da agenda passa a saber mostrar um item já concluído**
   - `1ece18d` (test) — casos falhando: botão ausente, marca + selo, sem atraso, onOpen preservado
   - `19eb2dd` (feat) — implementação em `AgendaItemRow.tsx`
2. **Task 2: Visão de dia e visão de semana passam a perguntar o atraso à autoridade única e a marcar o concluído**
   - `63614a0` (test) — casos falhando em `AgendaCalendarioDia`/`Semana`
   - `6a9de20` (feat) — implementação (troca para `estaAtrasado` + `WeekItemChip`)
3. **Task 3: Grade de mês e legenda da barra de ferramentas**
   - `ae175dc` (test) — casos falhando em `AgendaCalendarioMes`/`Toolbar`
   - `19d85a8` (feat) — implementação (`estaAtrasado` + `MonthItemChip` + quarta entrada de legenda)

**Plan metadata:** (this commit)

## Files Created/Modified

- `components/agenda/AgendaItemRow.tsx` — indicador local `concluido`; botão Concluir condicional; `mostraAtraso = atrasado && !concluido`; badge "Concluído" somada ao selo de origem; opacidade reduzida no cartão
- `components/agenda/AgendaCalendarioDia.tsx` — `estaAtrasado(item, now)` no lugar de `bucketDoItem(item.data, now) === "atrasado"`; comentário de cabeçalho atualizado
- `components/agenda/AgendaCalendarioSemana.tsx` — mesma troca de autoridade de atraso; `WeekItemChip` ganha tratamento de concluído (classe, ícone, opacidade)
- `components/agenda/AgendaCalendarioMes.tsx` — mesma troca de autoridade de atraso; `MonthItemChip` ganha o mesmo tratamento de concluído que `WeekItemChip`; comentário sobre os "três estados independentes" da célula
- `components/agenda/AgendaCalendarioToolbar.tsx` — quarta entrada de legenda ("Concluído")
- `tests/agenda/agenda-item-row.test.tsx` — 4 casos novos ao final, nenhum editado
- `tests/agenda/agenda-calendario-dia.test.tsx` — 2 casos novos ao final, nenhum editado
- `tests/agenda/agenda-calendario-semana.test.tsx` — 1 caso novo ao final, nenhum editado
- `tests/agenda/agenda-calendario-mes.test.tsx` — 3 casos novos ao final, nenhum editado
- `tests/agenda/agenda-calendario-toolbar.test.tsx` — 2 casos novos ao final, nenhum editado

## Decisions Made

- Cor de acento de concluído travada em verde-esmeralda-600 do Tailwind (já no bloco `<decisoes_visuais>` do plano, aplicada literalmente: `border-emerald-600`/`text-emerald-600`/`bg-emerald-600`)
- Ícone de conferido `CheckCircle2` reaproveitado do próprio botão Concluir — mesma associação visual "o que eu apertei" / "o estado em que ficou"
- Sem texto riscado; distinção só por cor de acento + ícone + `opacity-60` no elemento inteiro (cartão/chip)
- Marca de concluído sempre SOMA ao selo/ícone de origem, nunca substitui — verificado por checagem estrutural (`ClipboardCheck`/`Repeat` continuam presentes nos três arquivos de calendário) e por casos de teste

## Deviations from Plan

None — plan executado exatamente como escrito. As cinco assinaturas de componente (`AgendaItemRow`, `AgendaCalendarioDia`, `AgendaCalendarioSemana`, `AgendaCalendarioMes`, `AgendaCalendarioToolbar`) permanecem idênticas às de hoje; nenhuma propriedade nova foi adicionada. `AgendaList.tsx` não foi tocado. Nenhum caso de teste existente precisou de edição — todos os 68+ casos anteriores dos cinco arquivos de teste passam sem alteração, além dos 12 novos casos deste plano.

## Issues Encountered

None.

## User Setup Required

None — nenhuma configuração de serviço externo neste plano (puramente apresentacional, sem leitura de dado, sem ação de servidor, sem migration).

## Next Phase Readiness

- As cinco assinaturas de componente publicadas por este plano permanecem estáveis (nenhuma propriedade nova) — é isso que permite ao plano 21-04 acrescentar a segunda fonte de dados (leitura de histórico + `mesclarAgenda`) sem tocar em nenhum destes cinco arquivos, exatamente como o `<interface_context>` do plano previa.
- `AGD-13` permanece "Pending" em REQUIREMENTS.md — o comportamento visível ao usuário só fecha depois do plano 21-04 (fiação da segunda fonte de dados), mesma convenção já travada nas Fases 9-01/19-01/20-01/21-02 para requisitos multi-plano.
- `npx tsc --noEmit`, `npx eslint components/agenda tests/agenda` e as 139 suítes de teste relevantes (`agenda-item-row`, as 3 visões de calendário, `toolbar`, `agenda-list`, `itens.test.ts`) passam limpos.
- `git diff --stat` confinado exatamente aos 10 arquivos declarados em `files_modified`; `AgendaList.tsx` não aparece.

---
*Phase: 21-calend-rio-o-que-j-foi-feito-em-datas-passadas*
*Completed: 2026-08-18*

## Self-Check: PASSED

All 10 created/modified files found on disk; all 6 task commit hashes (1ece18d, 19eb2dd, 63614a0, 6a9de20, ae175dc, 19d85a8) found in git log.
