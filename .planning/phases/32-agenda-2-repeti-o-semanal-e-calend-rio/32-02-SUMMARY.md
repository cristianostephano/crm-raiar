---
phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
plan: 02
subsystem: agenda2
tags: [calendario, supabase, rls, paginacao, vitest, lgpd]

requires:
  - phase: 31-agenda-2-visitas-manuais-na-lista
    provides: Agenda2Item, getAgenda2, tabela agenda2_itens com RLS (0048), buscarPaginado
provides:
  - "lib/agenda2/itens.ts: estaAtrasadoAgenda2, agruparPorDataAgenda2, itensDoDiaAgenda2, dividirCelulaAgenda2, intervaloVisivelAgenda2"
  - "lib/supabase/queries/agenda2.ts: getAgenda2Periodo(inicio, fim) - pendentes e concluidos do periodo visivel, paginado"
affects: [32-03 Server Action de leitura do periodo, 32-04 calendario, 32-06 filtro do Supervisor]

tech-stack:
  added: []
  patterns:
    - "Funcoes de calendario da Agenda 2 sao copias tipadas das da Agenda atual (D-27); a original so e importada"
    - "Leitura por periodo sem filtro de dono nem checagem de papel: a RLS e a unica fronteira (D-30)"

key-files:
  created:
    - tests/agenda2/agenda2-periodo-query.test.ts
  modified:
    - lib/agenda2/itens.ts
    - tests/agenda2/itens.test.ts
    - lib/supabase/queries/agenda2.ts

key-decisions:
  - "intervaloVisivelAgenda2 nao apara passado nem futuro e nunca devolve null (D-28); toda grade de mes tem no maximo 41 dias de distancia, dentro do teto de 45 da validacao"
  - "getAgenda2Periodo e uma terceira funcao separada de getAgenda2 (regra de visibilidade propria); getAgenda2 e getAgenda2PendentesCount nao foram alterados (testes da Fase 31 fixam o .or da Lista)"

patterns-established:
  - "Mock de Supabase com builder encadeavel (gte/lte/or/eq/order) e spies, usado para provar a ausencia de .or e .eq"

requirements-completed: [AGD2-08]

coverage:
  - id: D1
    description: "Funcoes puras do calendario da Agenda 2 (atraso, agrupamento por data, dia, celula, intervalo visivel; grade sempre dentro do teto de 45 dias)"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/itens.test.ts#estaAtrasadoAgenda2 / agruparPorDataAgenda2 / itensDoDiaAgenda2 / dividirCelulaAgenda2 / intervaloVisivelAgenda2"
        status: pass
    human_judgment: false
  - id: D2
    description: "getAgenda2Periodo le o periodo com concluidos, sem .or e sem .eq, paginado com ordem estavel e rejeitando em erro"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-periodo-query.test.ts"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-02
status: complete
---

# Phase 32 Plan 02: Motor do calendario da Agenda 2 Summary

**Cinco funcoes puras de calendario copiadas e tipadas para Agenda2Item (sem tocar na Agenda atual) e `getAgenda2Periodo`, uma leitura paginada que traz pendentes e concluidos so do periodo visivel, escopada unicamente pela RLS.**

## Rastreabilidade

- **HEAD no inicio da execucao do plano:** `62624e33daa5cb8030774996a6a205fb06c799db`

## Performance

- **Duration:** ~8 min
- **Tasks:** 2 (ambas TDD, RED/GREEN completos)
- **Files modified:** 4 (1 criado, 3 estendidos)

## Accomplishments

- `intervaloVisivelAgenda2(agosto/2026, "mes")` devolve `2026-07-27..2026-09-06`; semana vai de segunda a domingo (inclusive quando a referencia e domingo); data futura nao e aparada. Todas as grades de jan/2026 a dez/2027 cabem em `INTERVALO_HISTORICO_MAX_DIAS` (45), entao a Server Action do 32-03 nunca recusara um periodo que a tela pede.
- `estaAtrasadoAgenda2`: pendente de data passada e atrasado; concluido nunca (D-29). A decisao de dia continua em `bucketDoItem`.
- `getAgenda2Periodo(inicio, fim)`: `.gte/.lte` em `data`, mesmo select minimo da Lista (sem `criado_em`), ordem `data, criado_em, id`, paginacao por `buscarPaginado`, erro explicito "calendario" em vez de lista truncada.

## Ciclos TDD

| Tarefa | RED | GREEN |
|--------|-----|-------|
| 1 - funcoes puras | `9aa5a46` test(32-02) - 17 casos falharam (funcoes inexistentes) | `47c3aa2` feat(32-02) - 33 testes verdes no arquivo |
| 2 - getAgenda2Periodo | `d08b2ec` test(32-02) - 4 casos falharam | `33bf757` feat(32-02) - 14 testes verdes nos 2 arquivos do verify |

Nenhum REFACTOR necessario.

## Verificacao

- `npx vitest run tests/agenda2/itens.test.ts tests/agenda2/agenda2-periodo-query.test.ts tests/agenda2/agenda2-query.test.ts` - 3 arquivos, 47 testes verdes (casos da Fase 31 sem edicao, incluindo o guard `fonte-sem-data-propria`).
- `npx tsc --noEmit` - codigo 0.
- `git diff --name-only -- lib/agenda components/agenda tests/agenda lib/supabase/queries/agenda.ts supabase/migrations` - vazio.
- `grep -c "\.rpc(" lib/supabase/queries/agenda2.ts` = 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Comentario do cabecalho casava com o criterio `grep -c "\.rpc("` = 0**
- **Found during:** Tarefa 2 (verificacao dos criterios de aceite)
- **Issue:** o comentario pre-existente do cabecalho de `lib/supabase/queries/agenda2.ts` citava a string literal `.rpc(`, o que fazia o criterio de aceite (= 0) dar 1 sem existir nenhuma chamada real.
- **Fix:** comentario reescrito para "nenhuma chamada de funcao do banco (RPC)"; sentido preservado.
- **Files modified:** lib/supabase/queries/agenda2.ts
- **Commit:** 33bf757

Observacoes de ambiente (nao sao desvios de escopo): a raiz real do repositorio e `C:/Users/Cristiano Stephano/workspace/crm-raiar`; o `.planning/config.json` segue com a alteracao pre-existente (so fim de linha) e nao foi commitado.

## Privacidade (LGPD)

Nenhum campo novo, coluna, migration ou identificador. `getAgenda2Periodo` le os mesmos tres dados ja aprovados na Fase 31 (nome do cliente, bairro, data) mais o nome do dono, no mesmo select minimo da Lista (sem `criado_em`). Minimizacao: o periodo e restrito por `.gte/.lte` ao que a tela mostra, e nao ha filtro de dono na query porque a fronteira e a RLS da 0048 (vendedor so os seus, Supervisor o time). Ponto de atencao para o 32-03: a Server Action deve validar o intervalo pedido pelo navegador (teto de 45 dias) para o calendario nao virar um meio de baixar o historico inteiro de dados pessoais. O descarte automatico apos 1 ano (decidido na UAT da Fase 31) continua sem implementacao.

## Known Stubs

None.

## Threat Flags

None - sem novos endpoints, caminhos de autenticacao ou mudancas de schema. T-32-08, T-32-09 e T-32-14 mitigados e cobertos por testes (`periodo-filtros`, `periodo-pagina`).

## Self-Check: PASSED

- FOUND: lib/agenda2/itens.ts, lib/supabase/queries/agenda2.ts, tests/agenda2/itens.test.ts, tests/agenda2/agenda2-periodo-query.test.ts
- FOUND commits: 9aa5a46, 47c3aa2, d08b2ec, 33bf757
