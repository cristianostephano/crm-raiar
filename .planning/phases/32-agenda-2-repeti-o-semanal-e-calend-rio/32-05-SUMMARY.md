---
phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
plan: 05
subsystem: ui
tags: [agenda2, formulario, react-hook-form, zod, base-ui-select, vitest, lgpd]

requires:
  - phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
    provides: "32-01: REPETIR_SEMANAS_VALORES, repeticaoPermitida, rotuloRepeticao, criarAgenda2CriarSchema(hoje); 32-03: criarAgenda2Item em lote com repetirSemanas"
  - phase: 31-agenda-2-visitas-manuais-na-lista
    provides: "Agenda2ItemForm (Dialog controlado, aviso de duplicado, Calendar no Popover)"
provides:
  - "Agenda2ItemForm com o campo 'Repetir' (Nao repetir, 4, 8 ou 12 semanas), so ao criar, desabilitado sem data ou com data anterior a hoje (Sao Paulo)"
  - "Prop opcional onRecarregar: chamada quando a CRIACAO falha, sem fechar o formulario (Pitfall 8)"
  - "Casos de teste de formulario para D-23, D-24, D-25, D-31 e Pitfall 8"
affects: [32-07 integracao na tela da Agenda 2 (liga onRecarregar = handleRecarregar na Lista)]

tech-stack:
  added: []
  patterns:
    - "UM resolver (criarAgenda2CriarSchema) para criar e editar; em edicao o campo nao e renderizado e o payload e montado com 3 campos explicitos"
    - "'hoje' da tela calculado uma vez por montagem com diaLocalSaoPaulo, a mesma funcao do servidor"
    - "Reset da repeticao feito no onSelect do calendario, nao em efeito"

key-files:
  created: []
  modified:
    - components/agenda2/Agenda2ItemForm.tsx
    - tests/agenda2/agenda2-item-form.test.tsx

key-decisions:
  - "Um resolver so para os dois modos (zodResolver(criarAgenda2CriarSchema(hoje)) com useForm<Agenda2CriarItemInput>): evita dois resolvers com tipos diferentes no mesmo useForm; a protecao da edicao (D-24) fica no payload explicito e no agenda2ItemSchema do servidor"
  - "Aviso de duplicado inalterado (existeItemParecido sobre a data original); apenas os tipos de avisoPara/valoresIguais mudaram para Agenda2CriarItemInput, e trocar a repeticao nao descarta o aviso"

patterns-established:
  - "Falha de criacao em lote sem idempotencia: o formulario pede recarga da lista (onRecarregar) para o aviso de duplicado pegar um lote gravado apesar do erro"

requirements-completed: [AGD2-02]

coverage:
  - id: D1
    description: "Campo Repetir so ao criar, padrao Nao repetir (repetirSemanas 0 ao enviar sem mexer), opcoes com o total de visitas, envio de 4 semanas"
    requirement: "AGD2-02"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#criar-ok, repetir-so-ao-criar, opcoes-com-total, repetir-envia-4"
        status: pass
    human_judgment: false
  - id: D2
    description: "Seletor desabilitado sem data ou com data passada, volta a Nao repetir e explica; edicao envia exatamente nome, bairro e data"
    requirement: "AGD2-02"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#repetir-desabilitado-sem-data, repetir-zera-no-passado, editar-nunca-repete"
        status: pass
    human_judgment: false
  - id: D3
    description: "Aviso de duplicado uma vez so contra a data original (nunca as futuras) e recarga da lista quando a criacao falha"
    requirement: "AGD2-02"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-item-form.test.tsx#duplicado-so-na-data-original, duplicado-ignora-datas-futuras, trocar-repeticao-mantem-aviso, falha-recarrega, falha-lanca-recarrega, falha-sem-onRecarregar, editar-falha-nao-recarrega"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-02
status: complete
---

# Phase 32 Plan 05: Campo Repetir no formulario da Agenda 2 Summary

**O formulario de criar visita da Agenda 2 ganhou o seletor "Repetir" (Nao repetir por padrao, 4/8/12 semanas com o total de visitas no rotulo), so ao criar e so de hoje em diante, mantendo o aviso de duplicado na data original e pedindo recarga da lista quando a criacao falha.**

## Rastreabilidade

- **HEAD no inicio da execucao do plano:** `d015a35`

## Performance

- **Duration:** ~14 min
- **Tasks:** 2 (ambas TDD, RED e GREEN completos)
- **Files modified:** 2

## Accomplishments

- Campo "Repetir" logo apos a Data, renderizado so em modo criar (D-24). Abre em "Nao repetir"; enviar sem mexer manda `repetirSemanas: 0` (privacidade por padrao: nenhuma agenda futura de deslocamento nasce sem o vendedor pedir).
- Opcoes: "Nao repetir", "Por 4 semanas (4 visitas, incluindo esta)", 8 e 12 (D-31).
- Regra D-23: sem data, ou com data anterior a hoje de Sao Paulo, o seletor fica desabilitado e a dica mostra "Escolha a data primeiro." ou "A repeticao so vale para hoje ou datas futuras."; ao trocar para uma data passada o valor volta a "Nao repetir" (feito no `onSelect` do calendario, nao em efeito).
- Edicao: o campo nao existe e `atualizarAgenda2Item` recebe exatamente `{ nomeCliente, bairro, data }` (o teste confere as chaves).
- Aviso de duplicado (D-25): `existeItemParecido` intocado, roda uma vez contra a data original; trocar de 4 para 8 semanas nao esconde o aviso.
- Pitfall 8: em criacao com erro ou excecao, alem do alerta generico, chama `onRecarregar?.()` sem fechar a janela; em edicao nao chama.

## Ciclos TDD

| Tarefa | RED | GREEN |
|--------|-----|-------|
| 1 - campo Repetir, D-23, envio | `3b1ba87` test(32-05) - 6 casos falharam (criar-ok com repetirSemanas 0 e 5 casos novos); `editar-nunca-repete` ja passava e serve de guarda de regressao do D-24 | `d50d194` feat(32-05) - 17 testes verdes, tsc 0 |
| 2 - duplicado so na data original e recarga | `ce51125` test(32-05) - 2 casos falharam (`falha-recarrega`, `falha-lanca-recarrega`); os casos D-25 ja passavam porque `existeItemParecido` nao mudou e valem como guarda | `51defa2` feat(32-05) - 24 testes verdes no arquivo, 42 com a Lista |

Nenhum REFACTOR necessario.

## Verificacao

- `npx vitest run tests/agenda2/agenda2-item-form.test.tsx tests/agenda2/agenda2-list.test.tsx` - 2 arquivos, 42 testes verdes (os 11 casos da Fase 31 passam, so criar-ok foi ajustado como o plano previu).
- `npx tsc --noEmit` - codigo 0. `npm run lint` - sem avisos.
- `grep -c font-medium` no formulario = 0; `criarAgenda2CriarSchema`, `diaLocalSaoPaulo` e `onRecarregar` (8 ocorrencias) presentes.

## Deviations from Plan

None - plano executado como escrito.

Observacoes: (1) os tipos de `avisoPara`/`valoresIguais` foram trocados para `Agenda2CriarItemInput` ja na Tarefa 1 (necessario para o `tsc` com o resolver unico), em vez de na Tarefa 2 como o texto do plano sugeria; o comportamento do aviso nao mudou. (2) A Lista (`Agenda2List`) ainda NAO passa `onRecarregar` ao formulario: essa ligacao e do plano 32-07 (declarada em seus `must_haves`); ate la a prop e opcional e nada quebra. (3) `.planning/config.json` segue com a alteracao pre-existente (so fim de linha) e nao foi commitado; trabalho na branch `master` local, sem push (envio a `staging` e etapa do orquestrador).

## Privacidade (LGPD)

Nenhum dado novo coletado: a repeticao multiplica ate 12 vezes os mesmos tres dados ja aprovados (nome do cliente, bairro, data). Privacidade por padrao: o seletor abre em "Nao repetir", as opcoes mostram o total de visitas para o vendedor saber o que esta criando, e repetir so e permitido de hoje em diante. A dica de LGPD abaixo do nome continua. Alerta ao dono: a repeticao aumenta o volume de dado pessoal por clique (agenda futura de deslocamento do vendedor) e o descarte automatico apos 1 ano continua sem implementacao.

## Known Stubs

None.

## Threat Flags

None - sem novos endpoints, caminhos de autenticacao ou mudancas de schema. T-32-07 (recarga em falha + botao desabilitado em envio), T-32-11 (padrao Nao repetir), T-32-12 (edicao com 3 campos) e T-32-17 (diaLocalSaoPaulo nos dois lados) mitigados e cobertos por testes.

## Self-Check: PASSED

- FOUND: components/agenda2/Agenda2ItemForm.tsx, tests/agenda2/agenda2-item-form.test.tsx
- FOUND commits: 3b1ba87, d50d194, ce51125, 51defa2
