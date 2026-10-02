---
phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
plan: 03
subsystem: agenda2
tags: [server-actions, supabase, rls, insert-em-lote, calendario, vitest, lgpd]

requires:
  - phase: 32-agenda-2-repeti-o-semanal-e-calend-rio
    provides: "32-01: gerarDatasSemanais + criarAgenda2CriarSchema(hoje); 32-02: getAgenda2Periodo"
  - phase: 31-agenda-2-visitas-manuais-na-lista
    provides: tabela agenda2_itens com RLS (0048) e as Server Actions de escrita
provides:
  - "criarAgenda2Item(values: Agenda2CriarItemInput): grava 1 a 12 linhas num unico .insert(array) tudo-ou-nada, dono sempre da sessao, 'hoje' de Sao Paulo no servidor"
  - "getAgenda2PeriodoAction(inicio, fim): leitura do calendario com intervalo validado (formato, ordem, ate 45 dias) e mensagens fixas"
  - "tests/agenda2/rls-agenda2-repeticao.test.ts: prova no banco real de atomicidade, RLS por linha e independencia das ocorrencias"
affects: [32-04 calendario, 32-05 formulario com seletor de repeticao, 32-06 filtro do Supervisor, 32-07]

tech-stack:
  added: []
  patterns:
    - "Gravacao em lote sempre via UM insert(array), mesmo para 1 linha (um unico caminho de codigo, atomico no PostgREST)"
    - "'hoje' de regra de negocio calculado no servidor com diaLocalSaoPaulo(new Date()), nunca em UTC"
    - "Acao de leitura de periodo = molde de getAgendaConcluidosAction com guarda de recurso antes do banco"

key-files:
  created:
    - tests/agenda2/rls-agenda2-repeticao.test.ts
  modified:
    - app/actions/agenda2.ts
    - tests/agenda2/agenda2-actions.test.ts

key-decisions:
  - "Sem migration, sem RPC, sem SECURITY DEFINER: a atomicidade vem do insert em lote do PostgREST e a autorizacao continua so na RLS da 0048, avaliada linha a linha (ROADMAP nota c)"
  - "getAgenda2PeriodoAction reusa validarIntervaloHistorico (somente import, arquivo intocado) em vez de criar um validador novo: uma fonte so para o teto de 45 dias"

patterns-established:
  - "Teste de integracao de lote: 11 linhas validas + 1 invalida prova tudo-ou-nada (CHECK e RLS) contando linhas pelo cliente de servico"

requirements-completed: [AGD2-02]

coverage:
  - id: D1
    description: "Criar com repeticao grava N linhas num unico insert, so com as 4 colunas, dono da sessao, 'hoje' de Sao Paulo, edicao nunca repete"
    requirement: "AGD2-02"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#criarAgenda2Item (casos criar-* e atualizar-ignora-repeticao)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Lote atomico, RLS por linha (alheio, Supervisor, desativado), ocorrencias independentes e escopo de leitura por periodo, contra o banco real"
    requirement: "AGD2-02"
    verification:
      - kind: integration
        ref: "tests/agenda2/rls-agenda2-repeticao.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "getAgenda2PeriodoAction valida o intervalo e devolve o periodo com mensagens fixas (a tela do calendario ainda e feita nos planos 32-04/06/07)"
    requirement: "AGD2-08"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#getAgenda2PeriodoAction"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-02
status: complete
---

# Phase 32 Plan 03: Repeticao em lote e leitura do calendario no servidor Summary

**`criarAgenda2Item` agora grava de 1 a 12 ocorrencias semanais num unico insert tudo-ou-nada (provado no banco real), com o dia de Sao Paulo calculado no servidor, e nasce `getAgenda2PeriodoAction` com intervalo validado para o calendario.**

## Rastreabilidade

- **HEAD no inicio da execucao do plano:** `08fb75d`

## Performance

- **Duration:** ~12 min
- **Tasks:** 3 (duas TDD com RED/GREEN completos; a terceira e teste de integracao do comportamento que o banco ja tem)
- **Files modified:** 3 (1 criado, 2 alterados)

## Accomplishments

- Criar com "repetir 4/8/12 semanas" faz UMA chamada `.insert(linhas)`: 4/8/12 linhas, a primeira na data escolhida, uma por semana no mesmo dia da semana, cada linha so com `nome_cliente`, `bairro`, `data`, `vendedor_id` (D-20, D-22, D-31). Sempre array, inclusive para 1 linha.
- O "hoje" da regra D-23 e `diaLocalSaoPaulo(new Date())`: as 22:30 de Brasilia (01:30 UTC do dia seguinte) a repeticao a partir de "hoje" continua aceita.
- A edicao continua descartando `repetirSemanas` e nunca insere linhas (D-24).
- `getAgenda2PeriodoAction` recusa formato invalido, inicio maior que fim e mais de 45 dias antes de qualquer leitura, e devolve sempre a mensagem fixa "Nao foi possivel carregar o calendario deste periodo." em qualquer falha.
- O banco real confirmou: lote com uma linha ruim (bairro de 61 caracteres ou linha de outro vendedor) grava 0 linhas; Supervisor e vendedor desativado nao conseguem inserir lote; concluir, renomear e apagar uma ocorrencia nao muda as outras.

## Ciclos TDD

| Tarefa | RED | GREEN |
|--------|-----|-------|
| 1 - criarAgenda2Item em lote | `fc6a892` test(32-03) - 8 casos falharam (insert ainda era objeto) | `fce5a76` feat(32-03) - 24 testes verdes no arquivo |
| 2 - getAgenda2PeriodoAction | `2325c9f` test(32-03) - 6 casos falharam (acao inexistente) | `37f97d0` feat(32-03) - 42 testes verdes nos 3 arquivos do verify |
| 3 - integracao no banco real | n/a (comportamento que o banco ja tem) | `7981572` test(32-03) - 7 casos verdes |

Nenhum REFACTOR necessario. O caso `atualizar-ignora-repeticao` ja passava no RED (a edicao nao mudou), entao funciona como guarda de regressao do D-24, nao como teste que falhava antes.

## Verificacao

- `npx vitest run tests/agenda2` - 16 arquivos, 207 testes verdes (inclui os 7 casos contra o Supabase real e todos os casos da Fase 31).
- `npx tsc --noEmit` - codigo 0.
- `grep -c "\.rpc(" app/actions/agenda2.ts` = 0; `diaLocalSaoPaulo` e `gerarDatasSemanais` presentes.
- `git diff --name-only` sobre `supabase/migrations`, `app/actions/agenda.ts`, `lib/validations/agenda.ts`, `lib/agenda`, `components/agenda`, `tests/agenda` - vazio.
- `signInAs(` aparece 2 vezes no arquivo de integracao; `deleteTestMember` 5 vezes; consulta de residuos depois da execucao devolveu 0 linhas (so contagem, nenhum dado lido).

## Deviations from Plan

None - plano executado como escrito.

Observacoes de ambiente (nao sao desvios de escopo): a raiz real do repositorio e `C:/Users/Cristiano Stephano/workspace/crm-raiar`; o `.planning/config.json` segue com a alteracao pre-existente (so fim de linha) e nao foi commitado; o trabalho esta na branch `master` local, sem push (o envio para `staging` antes de `master` e etapa do orquestrador, conforme o fluxo de deploy do CLAUDE.md). Acrescentei timeout explicito de 60s nos hooks e casos do teste de integracao porque a rede ate o Supabase torna o padrao de 5s/10s fragil.

## Privacidade (LGPD)

Nenhuma coluna, migration, funcao de banco ou identificador de serie novos (D-22): a acao so multiplica, ate 12 vezes por envio, os mesmos tres dados ja aprovados na Fase 31 (nome do cliente, bairro, data). Privacidade por padrao mantida: o dono de cada linha vem sempre da sessao do servidor, as constraints da 0048 que recusam documentos continuam valendo para cada linha do lote, o teto de 12 linhas vem da lista fechada e a leitura do calendario so aceita periodos de ate 45 dias (nao vira meio de baixar o historico inteiro). As mensagens de erro sao fixas, sem eco de dado do banco. Os testes usam so contas descartaveis e nomes inventados, filtram leituras do Supervisor pelos ids de fixture e nao imprimem nenhuma linha. Alerta ao dono: a repeticao aumenta o volume de dado pessoal por clique, e o descarte automatico apos 1 ano (decidido na UAT da Fase 31) continua sem implementacao.

## Known Stubs

None.

## Threat Flags

None - sem novos endpoints, caminhos de autenticacao ou mudancas de schema alem dos previstos. T-32-01 a T-32-06, T-32-12 e T-32-13 mitigados e cobertos por testes (mock e banco real).

## Self-Check: PASSED

- FOUND: app/actions/agenda2.ts, tests/agenda2/agenda2-actions.test.ts, tests/agenda2/rls-agenda2-repeticao.test.ts
- FOUND commits: fc6a892, fce5a76, 2325c9f, 37f97d0, 7981572
