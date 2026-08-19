---
phase: 21-calend-rio-o-que-j-foi-feito-em-datas-passadas
plan: 02
subsystem: agenda
tags: [typescript, date-fns, zod, pure-functions, calendar]

requires:
  - phase: 20-calend-rio-da-agenda-m-s-semana-e-dia
    provides: "diasDaGradeDoMes/diasDaSemana/chaveDoDia/bucketDoItem, a camada pura de agenda que este plano estende"
provides:
  - "estaAtrasado(item, now?) — autoridade única do calendário sobre 'atrasado', sempre falso para item concluído"
  - "mesclarAgenda(pendentes, concluidos) — junta as duas fontes do calendário sem duplicar identificador"
  - "intervaloDeHistorico(referencia, modo, now?) — qual período de histórico buscar para o que está visível, nunca hoje/futuro, null quando nada passado está visível"
  - "INTERVALO_HISTORICO_MAX_DIAS/validarIntervaloHistorico — teto de dias em constante única e o validador puro que a ação de servidor vai consumir"
affects: [21-03, 21-04]

tech-stack:
  added: []
  patterns:
    - "Comparação de intervalo de datas feita inteiramente entre textos YYYY-MM-DD (nunca objeto de data), mesma postura de segurança de fuso que bucketDoItem/agruparPorData já documentam"
    - "Guarda de RECURSO (não de autorização) como validador puro consumido tanto pelo navegador quanto por uma futura ação de servidor — mesmo molde de validarResumo"

key-files:
  created: []
  modified:
    - lib/agenda/itens.ts
    - lib/validations/agenda.ts
    - tests/agenda/itens.test.ts
    - tests/agenda/conclusao-validacao.test.ts

key-decisions:
  - "estaAtrasado envolve bucketDoItem em vez de duplicar a comparação de data, e devolve falso incondicionalmente quando item.concluido é verdadeiro — a Lista continua intocada (não consome esta função)"
  - "mesclarAgenda não ordena nem agrupa; a ordem (pendentes primeiro) e o agrupamento continuam sendo responsabilidade de agruparPorData, chamada depois"
  - "intervaloDeHistorico compara textos YYYY-MM-DD (inicioVisivel > ontem => null; fim = min(fimVisivel, ontem)) em vez de objetos Date, evitando reintroduzir o bug de fuso que o projeto já documentou uma vez"
  - "validarIntervaloHistorico mede a distância em dias de calendário entre início e fim (differenceInCalendarDays), não uma contagem inclusiva — o teto de 45 dá folga sobre os 42 dias da maior grade de mês possível"

requirements-completed: [AGD-13]

coverage:
  - id: D1
    description: "estaAtrasado nunca sinaliza um item concluído como atrasado, mesmo com data muito no passado"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#estaAtrasado > item CONCLUIDO com a MESMA data passada de um pendente atrasado NAO e sinalizado como atrasado (caso central)"
        status: pass
    human_judgment: false
  - id: D2
    description: "mesclarAgenda junta pendentes e concluídos sem jamais produzir dois itens com o mesmo identificador"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#mesclarAgenda > descarta concluido cujo identificador ja aparece entre os pendentes"
        status: pass
    human_judgment: false
  - id: D3
    description: "intervaloDeHistorico nunca alcança hoje/futuro e devolve null quando nada estritamente passado está visível"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#intervaloDeHistorico > dia de hoje: nada estritamente passado visivel, devolve nada"
        status: pass
      - kind: unit
        ref: "tests/agenda/itens.test.ts#intervaloDeHistorico > modo mes: mes em curso devolve intervalo terminando ONTEM, nunca hoje"
        status: pass
    human_judgment: false
  - id: D4
    description: "validarIntervaloHistorico recusa formato inválido, início posterior ao fim, e intervalo maior que o teto; aceita exatamente no teto"
    requirement: "AGD-13"
    verification:
      - kind: unit
        ref: "tests/agenda/conclusao-validacao.test.ts#validarIntervaloHistorico: teto de dias > aceita exatamente no teto (distancia de 45 dias de calendario)"
        status: pass
      - kind: unit
        ref: "tests/agenda/conclusao-validacao.test.ts#validarIntervaloHistorico: teto de dias > recusa um dia acima do teto"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-08-18
status: complete
---

# Phase 21 Plan 02: Camada pura de histórico do calendário Summary

**`lib/agenda/itens.ts`/`lib/validations/agenda.ts` estendidos com o vocabulário puro de item concluído: `estaAtrasado`/`mesclarAgenda` (nunca pintam trabalho já feito de vermelho) e `intervaloDeHistorico`/`validarIntervaloHistorico` (o período de histórico a pedir, e o teto que a ação de servidor vai impor).**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-18T17:35Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- `AgendaItem.concluido?: boolean` — campo opcional que marca um item como histórico, sem exigir mudança em nenhuma construção de item já existente no projeto (`npx tsc --noEmit` limpo sem tocar nenhum outro arquivo)
- `estaAtrasado(item, now?)` — a resposta única a "este item do calendário deve ser sinalizado como atrasado?"; sempre falso para item concluído, idêntico a `bucketDoItem` para item pendente
- `mesclarAgenda(pendentes, concluidos)` — junta as duas fontes do calendário, pendentes primeiro, descartando qualquer concluído cujo `itemId` já esteja entre os pendentes
- `intervaloDeHistorico(referencia, modo, now?)` — deriva o período de histórico a buscar a partir do que está visível (grade do mês/semana/dia), reusando `diasDaGradeDoMes`/`diasDaSemana`/`chaveDoDia`; nunca alcança hoje nem o futuro; devolve `null` quando nada estritamente passado está visível
- `INTERVALO_HISTORICO_MAX_DIAS = 45` + `validarIntervaloHistorico(inicio, fim)` — teto de dias em constante única e o validador puro (guarda de recurso, não de autorização) que a ação de servidor do plano 21-04 vai consumir

## Task Commits

Each task followed RED → GREEN:

1. **Task 1: Vocabulário de item concluído, sinalização de atraso e mescla das duas fontes**
   - `ba08139` (test) — casos falhando de `estaAtrasado`/`mesclarAgenda`
   - `58a267a` (feat) — implementação + campo `concluido?` no tipo
2. **Task 2: Intervalo de histórico a partir do que está visível, e o teto do servidor**
   - `15da5bd` (test) — casos falhando de `intervaloDeHistorico`/`validarIntervaloHistorico`
   - `464bf00` (feat) — implementação

**Plan metadata:** (this commit)

## Files Created/Modified

- `lib/agenda/itens.ts` — campo `concluido?` no tipo `AgendaItem`; nova seção "Camada histórica (AGD-13, Fase 21)" com `estaAtrasado` e `mesclarAgenda`; `intervaloDeHistorico` acrescentada dentro da mesma seção
- `lib/validations/agenda.ts` — `INTERVALO_HISTORICO_MAX_DIAS`, `INTERVALO_MSG_INVALIDO`, `INTERVALO_MSG_LONGO`, `ValidarIntervaloResult`, `validarIntervaloHistorico`
- `tests/agenda/itens.test.ts` — blocos novos `describe("estaAtrasado")`, `describe("mesclarAgenda")`, `describe("intervaloDeHistorico")`, ao final do arquivo; nenhum caso existente editado
- `tests/agenda/conclusao-validacao.test.ts` — blocos novos `describe("validarIntervaloHistorico: teto de dias")` e `describe("validarIntervaloHistorico: formato e ordem")`, ao final do arquivo; nenhum caso existente editado

## Decisions Made

- `intervaloDeHistorico` calcula "ontem" com `addDays(now, -1)` do date-fns (não é a mesma "aritmética de grade" proibida pelo plano — a proibição é sobre recalcular a grade em si, que continua vindo 100% de `diasDaGradeDoMes`/`diasDaSemana`)
- `validarIntervaloHistorico` mede distância com `differenceInCalendarDays(parseISO(fim), parseISO(inicio))`, não uma contagem inclusiva de dias — interpretação literal de "a distância em dias de calendário entre os dois" do texto do plano; teste prova a fronteira exata (45 aceito, 46 recusado) usando a mesma definição
- As duas mensagens de erro do intervalo (`INTERVALO_MSG_INVALIDO` para formato/ordem inválidos, `INTERVALO_MSG_LONGO` para intervalo grande demais) seguem o mesmo padrão de string literal exportada que `RESUMO_MSG_*` já estabelece, para a futura tela (21-03) nunca reescrever o texto

## Deviations from Plan

None — plan executado exatamente como escrito. As doze funções já existentes de `lib/agenda/itens.ts` (`bucketDoItem`, `agruparAgenda`, `filtrarPorVendedor`, `vendedoresDaAgenda`, `agruparPorData`, `itensDoDia`, `chaveDoDia`, `diasDaGradeDoMes`, `diasDaSemana`, `dividirCelula`, `navegarData`, `rotuloDoPeriodo`) e `validarResumo`/`RESUMO_MIN`/`RESUMO_MAX` de `lib/validations/agenda.ts` continuam exportadas e sem edição; todos os 68 casos de teste antigos passam sem alteração.

## Issues Encountered

None.

## User Setup Required

None — nenhuma configuração de serviço externo neste plano.

## Next Phase Readiness

- Superfície pública publicada e estável para os planos 21-03 (componentes/telas) e 21-04 (contêiner + ação de servidor): `estaAtrasado`, `mesclarAgenda`, `intervaloDeHistorico`, `INTERVALO_HISTORICO_MAX_DIAS`, `validarIntervaloHistorico` — nenhum deles precisa reimplementar ou renomear nada disto.
- Nenhum componente, ação de servidor, leitura de banco ou migration foi tocado — fora de escopo declarado deste plano, conforme `<source_audit>`.
- `AGD-13` permanece "Pending" em REQUIREMENTS.md (não marcado Complete): esta camada pura é só metade do requisito — o comportamento visível ao usuário só fecha depois dos planos 21-03/21-04, mesma convenção já travada nas Fases 9-01/19-01/20-01 para requisitos multi-plano.

---
*Phase: 21-calend-rio-o-que-j-foi-feito-em-datas-passadas*
*Completed: 2026-08-18*

## Self-Check: PASSED

All created/modified files found on disk; all 4 task commit hashes (ba08139, 58a267a, 15da5bd, 464bf00) found in git log.
