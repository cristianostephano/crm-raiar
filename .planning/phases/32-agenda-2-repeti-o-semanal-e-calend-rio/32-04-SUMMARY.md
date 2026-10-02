---
phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
plan: 04
subsystem: ui
tags: [calendario, agenda2, react, vitest, copia-de-componente]

requires:
  - phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
    provides: "lib/agenda2/itens.ts - estaAtrasadoAgenda2, itensDoDiaAgenda2, dividirCelulaAgenda2, agruparPorDataAgenda2 (plano 32-02)"
  - phase: 31-agenda-2-visitas-manuais-na-lista
    provides: "Agenda2ItemRow e o tipo Agenda2Item"
provides:
  - "components/agenda2/Agenda2CalendarioToolbar.tsx: barra com setas, Hoje, seletor Lista/Dia/Semana/Mes e legenda Pendente/Atrasado/Concluido"
  - "components/agenda2/Agenda2CalendarioDia.tsx: lista de um dia com Agenda2ItemRow"
  - "components/agenda2/Agenda2CalendarioMes.tsx: grade de mes com chips (nome), riscado, atrasado e +N mais"
  - "components/agenda2/Agenda2CalendarioSemana.tsx: 7 colunas com chips (nome + bairro) que abrem o dia"
affects: [32-06 container do calendario, 32-07 integracao na tela da Agenda 2]

tech-stack:
  added: []
  patterns:
    - "Calendario da Agenda 2 e COPIA dos quatro componentes da Agenda atual (D-27); so funcoes puras e tipos de lib/agenda/itens.ts sao importados"
    - "Chip de semana abre o DIA (onSelecionarDia), nunca uma ficha inexistente (Pitfall 9)"

key-files:
  created:
    - components/agenda2/Agenda2CalendarioToolbar.tsx
    - components/agenda2/Agenda2CalendarioDia.tsx
    - components/agenda2/Agenda2CalendarioMes.tsx
    - components/agenda2/Agenda2CalendarioSemana.tsx
    - tests/agenda2/agenda2-calendario-toolbar.test.tsx
    - tests/agenda2/agenda2-calendario-dia.test.tsx
    - tests/agenda2/agenda2-calendario-mes.test.tsx
    - tests/agenda2/agenda2-calendario-semana.test.tsx
  modified: []

key-decisions:
  - "Chip do mes usa ternario para a cor base (pendente azul / concluido cinza com borda verde) e depois o acento de atraso, em vez de somar classes de origem"
  - "Concluido fica riscado (line-through) em mes, semana e dia, sem opacity-60: o item concluido continua acionavel (UI-SPEC Fase 31)"

patterns-established:
  - "Cabecalho de cada copia documenta de qual original veio, o que mudou e que nada importa componentes/acoes da Agenda atual"

requirements-completed: []  # AGD2-08 so fecha em 32-06/32-07 (container + integracao); este plano entrega as pecas visuais

coverage:
  - id: D1
    description: "Barra do calendario da Agenda 2 (navegacao, Hoje, seletor de visao com aria-pressed, legenda de 3 itens; so seletor na Lista)"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-calendario-toolbar.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Visao de dia com Agenda2ItemRow (acoes repassam o item, somente leitura sem botoes, concluido riscado sem vermelho)"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-calendario-dia.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Grade de mes: 42 celulas, cabecalho Seg..Dom, chips com nome, concluido riscado, atrasado vermelho inclusive em celula vizinha, +N mais, sem icone de repeticao"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-calendario-mes.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Grade de semana: 7 colunas, chips nome + bairro, concluido riscado, hoje destacado, chip abre o dia por clique e Enter"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-calendario-semana.test.tsx"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-02
status: complete
---

# Phase 32 Plan 04: Pecas visuais do calendario da Agenda 2 Summary

**Quatro componentes de calendario (barra, dia, mes, semana) copiados da Agenda atual e adaptados para a Agenda 2: nome + bairro nos chips, concluido riscado, legenda Pendente/Atrasado/Concluido, sem icone de repeticao, e chip da semana que abre o dia.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2 (ambas TDD, RED/GREEN completos)
- **Files:** 8 criados (4 componentes, 4 testes); nenhum arquivo existente alterado

## Accomplishments

- Nenhum arquivo de `components/agenda`, `tests/agenda` ou `lib/agenda` foi tocado (`git diff --name-only` vazio) e nenhum dos quatro novos importa componente ou Server Action da Agenda atual — so funcoes puras/tipos de `lib/agenda/itens.ts` (D-27).
- Mesmo visual e navegacao do calendario de hoje: setas "Periodo anterior"/"Proximo periodo", "Hoje", seletor com `aria-pressed`, semana comecando na segunda.
- Concluido riscado em mes, semana e dia, nunca com acento vermelho (D-29); nenhum icone de repeticao nem de origem (D-26).

## Copiado como esta x o que mudou

| Componente | Copiado como esta | Mudou |
|---|---|---|
| Toolbar | Estrutura, classes, aria-labels, `OPCOES_DE_VISAO`, barra sempre montada (so seletor com `rotulo === null`) | Legenda: Pendente (`bg-primary`), Atrasado, Concluido; saiu Prospeccao/Visita |
| Dia | Estrutura e bloco tracejado do estado vazio | Usa `Agenda2ItemRow` (Editar/Apagar/Concluir/Desmarcar repassam o proprio item, `podeAlterar`, `salvandoId`); atraso por `estaAtrasadoAgenda2`; texto "Nenhuma visita neste dia." |
| Mes | Grade, classes da celula, celula inteira clicavel (role=button, Enter/espaco, `min-h-28`), "+N mais", as tres perguntas do Pitfall 9 | Tipos/funcoes da Agenda 2, `key={item.id}`, aria-label termina em "visita(s)", chip so com nome, concluido com `line-through` e borda verde em vez de `opacity-60`, sem icones de origem/repeticao |
| Semana | 7 colunas via `diasDaSemana`, cabecalho do dia, destaque de hoje, "—" no dia vazio, role=button + Enter/espaco | `onSelecionarDia(dia)` no lugar de `onOpenItem`; chip com nome (`font-semibold`, riscado se concluido) e bairro; sem `opacity-60`; sem icones de origem/repeticao; peso 500 do nome virou 600 |

## Ciclos TDD

| Tarefa | RED | GREEN |
|--------|-----|-------|
| 1 - Toolbar + Dia | `f0ca8d3` test(32-04) - modulos inexistentes, 2 arquivos falharam | `40654ce` feat(32-04) - 11 testes verdes |
| 2 - Mes + Semana | `0bd1b1e` test(32-04) - modulos inexistentes, 2 arquivos falharam | `2ef8314` feat(32-04) - 29 testes verdes nos 4 arquivos |

Nenhum REFACTOR necessario.

## Verificacao

- `npx vitest run` nos quatro arquivos de calendario: 4 arquivos, 29 testes verdes.
- `npx tsc --noEmit`: codigo 0.
- `npx eslint` nos 4 componentes e 4 testes: codigo 0.
- `grep` por imports de `@/components/agenda/` ou `@/app/actions/agenda`: nenhum arquivo; `grep -c font-medium`: 0 em todos.
- `git diff --name-only -- components/agenda tests/agenda lib/agenda`: vazio.

## Deviations from Plan

None - plano executado como escrito. O `npm run lint` completo do repositorio nao foi rodado (so eslint nos arquivos do plano, que e o que pode ser afetado por ele).

## Privacidade (LGPD)

Componentes puramente apresentacionais: nao leem nem gravam dado, nao criam campo, coluna, migration nem identificador. Os chips mostram apenas nome do cliente e bairro (ja exibidos na Lista) e o dia mostra tambem o nome do vendedor so quando `showResponsavel` e verdadeiro (Supervisor). A visibilidade continua sendo imposta pela RLS da 0048; `podeAlterar` apenas esconde botoes (T-32-15), nao e fronteira de seguranca. Pendencia lembrada ao dono: o descarte automatico apos 1 ano (decidido na UAT da Fase 31) segue sem implementacao.

## Known Stubs

None.

## Threat Flags

None - sem novos endpoints, caminhos de autenticacao, acesso a arquivos ou mudancas de schema. T-32-10 (regressao na Agenda atual) mitigado: zero diff nos arquivos da Agenda atual e sem imports dela. T-32-15 coberto pelo teste `somente-leitura`. T-32-16 aceito (nenhum campo novo exibido).

## Self-Check: PASSED

- FOUND: components/agenda2/Agenda2CalendarioToolbar.tsx, Agenda2CalendarioDia.tsx, Agenda2CalendarioMes.tsx, Agenda2CalendarioSemana.tsx
- FOUND: tests/agenda2/agenda2-calendario-{toolbar,dia,mes,semana}.test.tsx
- FOUND commits: f0ca8d3, 40654ce, 0bd1b1e, 2ef8314
