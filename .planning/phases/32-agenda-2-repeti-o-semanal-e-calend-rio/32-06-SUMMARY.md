---
phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
plan: 06
subsystem: ui
tags: [calendario, agenda2, react, vitest, copia-de-componente, leitura-por-periodo]

requires:
  - phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
    provides: "lib/agenda2/itens.ts - intervaloVisivelAgenda2, agruparPorDataAgenda2, itensDoDiaAgenda2 (plano 32-02)"
  - phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
    provides: "getAgenda2PeriodoAction (plano 32-03)"
  - phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
    provides: "Agenda2CalendarioToolbar/Dia/Mes/Semana (plano 32-04)"
provides:
  - "components/agenda2/Agenda2Calendario.tsx: conteiner do calendario - referencia, periodo visivel, leitura so do periodo, filtro de vendedor, dialogo do dia com acoes"
affects: [32-07 integracao na tela da Agenda 2]

tech-stack:
  added: []
  patterns:
    - "Efeito de leitura com dependencias so em textos (inicio, fim) + reloadKey + tentativa; resposta carrega a chave do periodo que a pediu"
    - "Recarga por reloadKey mantem os itens na tela; Skeleton so sem dado do periodo atual"
    - "Editar/Apagar fecham o dialogo do dia antes de chamar a tela (evita dois dialogos modais empilhados)"

key-files:
  created:
    - components/agenda2/Agenda2Calendario.tsx
    - tests/agenda2/agenda2-calendario.test.tsx
  modified: []

key-decisions:
  - "Recarga sem piscar: itens do periodo atual permanecem ate a resposta nova; Skeleton so na primeira leitura ou troca de periodo"
  - "Editar/Apagar a partir do dialogo do dia fecham o dialogo primeiro e depois chamam a tela; Concluir/Desmarcar agem com o dialogo aberto"
  - "Calendario permite agir (Assumption A3/A4); Supervisor sempre somente leitura via podeAlterar, com a RLS da 0048 como fronteira"

patterns-established:
  - "Conteiner da Agenda 2 le uma fonte so (sem mescla), ao contrario do AgendaCalendario original"

requirements-completed: []  # AGD2-08 so fecha em 32-07 (integracao na tela); este plano entrega o conteiner

coverage:
  - id: D1
    description: "Leitura so do periodo visivel (mes 27/07..06/09, semana 10..16/08, dia 14/08), nenhuma leitura na Lista, uma leitura por periodo mesmo com re-render"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-calendario.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Navegacao (anterior/proximo/Hoje), troca de visao preserva a data, resposta atrasada descartada, erro com mensagem fixa e Tentar novamente"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-calendario.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Recarga por reloadKey sem piscar o esqueleto; concluido de dia passado visivel e riscado; filtro de vendedor como estreitamento local"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-calendario.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dialogo do dia (celula do mes e chip da semana), Concluir/Desmarcar no dialogo, Editar/Apagar fecham o dialogo, Supervisor sem botoes de escrita, visao de dia com acoes e salvandoId"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-calendario.test.tsx"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-02
status: complete
---

# Phase 32 Plan 06: Conteiner do calendario da Agenda 2 Summary

**Agenda2Calendario: copia adaptada do conteiner da Agenda atual que le so o periodo visivel por getAgenda2PeriodoAction (uma leitura por periodo, resposta atrasada descartada, recarga sem piscar), filtra por vendedor localmente e abre o dialogo do dia com Concluir/Desmarcar/Editar/Apagar para o dono.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (ambas TDD, RED/GREEN completos)
- **Files:** 2 criados (1 componente, 1 teste); nenhum arquivo existente alterado

## Accomplishments

- Mes pede a grade inteira (agosto/2026: 2026-07-27..2026-09-06; setembro: 2026-08-31..2026-10-04), semana pede 7 dias, dia pede 1, e a Lista nao le nada (ROADMAP nota (e)).
- Dependencias do efeito sao so textos `inicio`/`fim` mais `reloadKey` e `tentativa`: re-render com um `now` novo do mesmo instante nao refaz a leitura (Pitfall 5, T-32-08).
- Cada resposta guarda a chave do periodo que a pediu e o efeito tem guarda `cancelled`: a resposta atrasada de agosto nunca aparece em setembro (Pitfall 6, T-32-18).
- **Regra "sem piscar na recarga":** quando `reloadKey` muda (a tela concluiu, editou ou apagou), os itens do periodo atual ficam na tela ate a resposta nova chegar; o Skeleton so aparece quando ainda nao ha dado DO periodo atual.
- Concluido de dia passado aparece na celula do seu dia, riscado (D-28/D-29); nenhuma regra de visibilidade da Lista e aplicada (`itensDaListaAgenda2` nao e usado).
- Filtro de vendedor e estreitamento local com `filtrarPorVendedor` sobre o que a RLS liberou (D-30, T-32-09), sem nova leitura ao trocar o filtro.
- Dialogo do dia (celula do mes ou chip da semana) reusa `Agenda2CalendarioDia`; Supervisor ve so leitura (T-32-15); erro de leitura mostra mensagem fixa (T-32-06).
- Nada importado de `components/agenda` nem de `app/actions/agenda`; zero diff em `components/agenda`, `tests/agenda`, `lib/agenda`.

## Decisao: fechar o dialogo antes de Editar/Apagar

`onEditar` e `onApagar` recebidos da tela sao envolvidos para chamar `setDiaDialogo(null)` PRIMEIRO e so depois o handler. O formulario e a confirmacao de apagar moram na tela (montados uma vez); deixar o dialogo do dia aberto empilharia dois dialogos modais. `onConcluir`/`onDesmarcar` sao repassados direto: o dialogo continua aberto e a linha se atualiza quando a recarga chega (sem piscar).

## Ciclos TDD

| Tarefa | RED | GREEN |
|--------|-----|-------|
| 1 - Conteiner (leitura, recarga, corrida, erro, filtro) | `0cb4b1b` test(32-06) - modulo inexistente | `15261c3` feat(32-06) - 12 testes verdes |
| 2 - Dialogo do dia e acoes | `2b57fc4` test(32-06) - 7 casos de dialogo falhando | `8e651ea` feat(32-06) - 21 testes verdes no arquivo |

Nenhum REFACTOR necessario.

## Verificacao

- `npx vitest run` nos cinco arquivos de calendario (conteiner, mes, semana, dia, toolbar): 5 arquivos, 50 testes verdes.
- `npx tsc --noEmit`: codigo 0. `npm run lint`: codigo 0.
- `grep` por imports de `@/components/agenda/` ou `@/app/actions/agenda"` no conteiner: nenhum; `grep -c itensDaListaAgenda2`: 0.
- `git diff --name-only -- components/agenda tests/agenda lib/agenda app/actions/agenda.ts`: vazio.

## Deviations from Plan

### Auto-added

**1. [Rule 2 - Cobertura] Caso extra `esqueleto`**
- **Found during:** Tarefa 1
- **Issue:** a regra "Skeleton so quando ainda nao ha dado do periodo atual" so tinha o lado negativo coberto (sem piscar na recarga).
- **Fix:** acrescentado um teste que confirma o Skeleton na primeira leitura e sua remocao ao resolver. A Tarefa 1 ficou com 12 casos em vez de 11.
- **Files modified:** tests/agenda2/agenda2-calendario.test.tsx
- **Commit:** 0cb4b1b

O caso `supervisor-somente-leitura` foi dividido em dois testes (dialogo e visao de dia); por isso a Tarefa 2 tem 9 casos em vez de 7. Fora isso, plano executado como escrito.

## Privacidade (LGPD)

O componente nao cria campo, coluna, migration nem identificador novo. Le pela acao existente (32-03) so o periodo visivel, o que reduz a quantidade de dado trazido ao navegador (minimizacao). Mostra nome do cliente e bairro (ja exibidos na Lista) e o nome do vendedor so quando `showResponsavel` e verdadeiro (Supervisor). A visibilidade continua sendo imposta pela RLS da 0048; `podeAlterar` e o filtro de vendedor sao so reflexo visual/estreitamento local, nao fronteira de seguranca. Erros de leitura mostram mensagem fixa, sem expor detalhe do servidor. Pendencia lembrada ao dono: o descarte automatico apos 1 ano (decidido na UAT da Fase 31) segue sem implementacao.

## Known Stubs

None.

## Threat Flags

None - sem novos endpoints, caminhos de autenticacao, acesso a arquivos ou mudancas de schema. Mitigados: T-32-08 (rajada de leituras), T-32-18 (resposta atrasada), T-32-09 (filtro nao e permissao), T-32-15 (Supervisor sem botoes), T-32-06 (mensagem fixa).

## Self-Check: PASSED

- FOUND: components/agenda2/Agenda2Calendario.tsx, tests/agenda2/agenda2-calendario.test.tsx
- FOUND commits: 0cb4b1b, 15261c3, 2b57fc4, 8e651ea
