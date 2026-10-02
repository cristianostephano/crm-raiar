---
phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
plan: 01
subsystem: agenda2
tags: [date-fns, zod, vitest, repeticao-semanal, lgpd]

requires:
  - phase: 31-agenda-2-visitas-manuais-na-lista
    provides: agenda2ItemSchema (nome/bairro/data) e chaveDoDia de lib/agenda/itens.ts
provides:
  - "lib/agenda2/repeticao.ts: lista fechada 0/4/8/12, gerarDatasSemanais, repeticaoPermitida, rotuloRepeticao"
  - "criarAgenda2CriarSchema(hoje) + Agenda2CriarItemInput em lib/validations/agenda2.ts"
affects: [32-03 Server Action de criacao em lote, 32-05 formulario com seletor de repeticao]

tech-stack:
  added: []
  patterns:
    - "Datas de repeticao sempre via parseISO -> addWeeks -> chaveDoDia (nunca construtor de data a partir de texto nem soma de milissegundos)"
    - "Schema de criacao separado do de edicao (extend + superRefine), com 'hoje' injetado por parametro"

key-files:
  created:
    - lib/agenda2/repeticao.ts
    - tests/agenda2/repeticao.test.ts
  modified:
    - lib/validations/agenda2.ts
    - tests/agenda2/validacao-agenda2.test.ts

key-decisions:
  - "N semanas = N visitas NO TOTAL (a data escolhida e a primeira) - D-31"
  - "repetirSemanas usa .optional() e nao .default(0); a Server Action trata ausente como 0 (evita divergencia entrada/saida no zodResolver)"
  - "z.literal(REPETIR_SEMANAS_VALORES) usa a lista readonly direto: uma fonte unica, sem copia literal a sincronizar"

patterns-established:
  - "Regra 'hoje em diante' compara texto AAAA-MM-DD, com 'hoje' vindo de fora (testavel, mesmo dia de Sao Paulo no servidor e na tela)"

requirements-completed: [AGD2-02]

coverage:
  - id: D1
    description: "Geracao das datas semanais (N no total, mesmo dia da semana, atravessa horario de verao e virada de ano)"
    requirement: "AGD2-02"
    verification:
      - kind: unit
        ref: "tests/agenda2/repeticao.test.ts#gerarDatasSemanais"
        status: pass
    human_judgment: false
  - id: D2
    description: "Schema de criacao aceita so 0/4/8/12, recusa repetir no passado, descarta chaves extras; edicao inalterada"
    requirement: "AGD2-02"
    verification:
      - kind: unit
        ref: "tests/agenda2/validacao-agenda2.test.ts#criarAgenda2CriarSchema"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-02
status: complete
---

# Phase 32 Plan 01: Base pura da repeticao semanal Summary

**Fonte unica da repeticao semanal da Agenda 2: lista fechada 0/4/8/12, datas geradas com parseISO/addWeeks (N visitas no total, sem bug de fuso) e schema de criacao `criarAgenda2CriarSchema(hoje)` separado do de edicao.**

## Rastreabilidade

- **HEAD no inicio da execucao da Fase 32:** `1502a931cd71824ca9da90abce70720bc1171dd4`

## Performance

- **Duration:** ~8 min
- **Tasks:** 2 (ambas TDD, ciclos RED/GREEN completos)
- **Files modified:** 4 (2 criados, 2 estendidos)

## Accomplishments

- `gerarDatasSemanais("2026-10-30", 12)` devolve 12 sextas-feiras de 2026-10-30 a 2027-01-15, atravessando o fim do horario de verao americano e a virada de ano sem deslocar o dia; `semanas = 0` devolve so a data escolhida.
- `repeticaoPermitida(data, hoje)` implementa D-23 comparando texto AAAA-MM-DD, com `hoje` sempre injetado.
- `criarAgenda2CriarSchema(hoje)` recusa 5, "4", 1000, -4 e null com a mensagem fixa, recusa repetir com data passada, aceita item avulso com data passada (D-09 da Fase 31) e descarta chaves extras (vendedorId, concluido, serieId).
- `agenda2ItemSchema` (edicao) ficou intocado: `repetirSemanas` e descartado no parse (D-24).

## Ciclos TDD

| Tarefa | RED | GREEN |
|--------|-----|-------|
| 1 - repeticao.ts | `33ccd54` test(32-01) - falhou por modulo inexistente | `fab1dee` feat(32-01) - 9 casos verdes |
| 2 - schema de criacao | `3c10760` test(32-01) - falhou por `criarAgenda2CriarSchema` inexistente | `b5d6b03` feat(32-01) - 36 testes verdes nos 3 arquivos do verify |

Nenhum REFACTOR necessario.

## Verificacao

- `npx vitest run tests/agenda2/repeticao.test.ts tests/agenda2/validacao-agenda2.test.ts tests/agenda2/limites-sincronizados.test.ts` - 3 arquivos, 36 testes verdes (casos da Fase 31 sem edicao).
- `npx tsc --noEmit` - codigo 0.
- `repeticao.ts` sem import de `next/*` nem de supabase; usa `addWeeks` e `chaveDoDia`.
- `git diff --name-only -- lib/agenda components/agenda tests/agenda supabase/migrations` - vazio (Agenda atual e migrations intocadas).

## Deviations from Plan

None - plano executado como escrito. Observacoes de ambiente (nao sao desvios de escopo):

- Os caminhos absolutos do prompt apontavam para `C:/Users/Cristiano/...`; a raiz real do repositorio e `C:/Users/Cristiano Stephano/workspace/crm-raiar`. Tudo foi lido e gravado na raiz real.
- Python nao esta instalado na maquina; a extensao do arquivo de testes foi feita com Edit em vez de script.

## Privacidade (LGPD)

Nenhum campo novo, nenhuma coluna, nenhuma migration e nenhum identificador de serie (D-22). O plano so define a regra que o servidor usara para multiplicar (ate 12x) os mesmos tres dados ja aprovados na Fase 31 (nome do cliente, bairro, data). As constraints da migration 0048 que recusam documentos continuam valendo, e o teto de 12 linhas por envio vem da lista fechada (T-32-01). O padrao "Nao repetir" (0) deve ser o valor inicial do formulario no 32-05 (privacidade por padrao). Alerta para o dono: a repeticao aumenta o volume de dado pessoal por clique, e o descarte automatico apos 1 ano (decidido na UAT da Fase 31) continua sem implementacao.

## Known Stubs

None.

## Threat Flags

None - sem novas superficies de rede, autenticacao ou schema. T-32-01, T-32-02 e T-32-03 mitigados no schema e cobertos por testes.

## Self-Check: PASSED

- FOUND: lib/agenda2/repeticao.ts, tests/agenda2/repeticao.test.ts, lib/validations/agenda2.ts, tests/agenda2/validacao-agenda2.test.ts
- FOUND commits: 33ccd54, fab1dee, 3c10760, b5d6b03
