---
phase: 31-agenda-2-visitas-manuais-na-lista
plan: 04
subsystem: api
tags: [supabase, server-actions, rls, zod, agenda2, lgpd]

requires:
  - phase: 31-agenda-2-visitas-manuais-na-lista
    plan: "01"
    provides: "Tabela agenda2_itens + RLS assimétrica (dono escreve, Supervisor só lê) — migration 0048"
  - phase: 31-agenda-2-visitas-manuais-na-lista
    plan: "02"
    provides: "Agenda2Item, visivelNaListaAgenda2 (lib/agenda2/itens.ts); agenda2ItemSchema, agenda2ItemIdSchema, limites AGENDA2_* (lib/validations/agenda2.ts)"
provides:
  - "lib/supabase/queries/agenda2.ts — getAgenda2() (sem filtro de dono, AGD2-07) e getAgenda2PendentesCount() (filtro explícito de dono, D-13)"
  - "app/actions/agenda2.ts — seis Server Actions: getAgenda2Action, criarAgenda2Item, atualizarAgenda2Item, apagarAgenda2Item, concluirAgenda2Item, desmarcarAgenda2Item"
  - "tests/agenda2/agenda2-query.test.ts, tests/agenda2/agenda2-actions.test.ts, tests/agenda2/limites-sincronizados.test.ts — 29 casos verdes, nenhum depende do banco real"
affects: [31-06, 31-07, 31-08]

tech-stack:
  added: []
  patterns:
    - "getAgenda2PendentesCount() diverge deliberadamente de getAgendaPendentesCount() (Agenda atual): aqui o filtro de dono é explícito (.eq('vendedor_id', user.id)) porque a RLS de SELECT desta tabela é mais ampla (dono OU Supervisor) — sem o filtro explícito o selo do menu de um Supervisor mostraria o total do time"
    - "Mock de teste único cobrindo as quatro formas de chamada do cliente Supabase mockado (select/or/order/range para leitura; insert; update/delete seguidos de .eq().select('id') para escrita) — getAgenda2Action é testada através da implementação REAL de getAgenda2(), nunca mockando o módulo de query, mesma disciplina de tests/funil/encerrados-query.test.ts"
    - "Server Action de escrita nunca inclui campos de controle no objeto gravado: o insert usa só os 3 campos do parse + vendedor_id do servidor; update de edição nunca inclui concluido (D-06); update de concluir/desmarcar usa só { concluido }"

key-files:
  created:
    - lib/supabase/queries/agenda2.ts
    - app/actions/agenda2.ts
    - tests/agenda2/agenda2-query.test.ts
    - tests/agenda2/agenda2-actions.test.ts
    - tests/agenda2/limites-sincronizados.test.ts
  modified: []

key-decisions:
  - "Teste de sincronia (limites-sincronizados.test.ts) lê a migration 0048 com fs e compara contra as constantes de lib/validations/agenda2.ts — string exata 'between 1 and <N>' para nome/bairro e contagem de ocorrências de '[0-9]{8,}' para a regra de documento, garantindo que os dois lados não possam divergir em silêncio"
  - "getAgenda2Action/demais ações exercitam a implementação real de getAgenda2()/schemas (não mocks de módulo) — o mock cobre só o cliente Supabase, replicando o padrão já usado em tests/funil/encerrados-query.test.ts para o resto do projeto"
  - "nao_encontrado e validacao reusam a mesma mensagem genérica de salvar (\"Não foi possível salvar. Tente novamente.\") — nenhuma pista adicional sobre qual das duas causas ocorreu é exposta na tela"

patterns-established: []

requirements-completed: [AGD2-01, AGD2-03, AGD2-04, AGD2-05, AGD2-06, AGD2-07]

coverage:
  - id: D1
    description: "getAgenda2() lê a Lista sem filtro de dono (RLS decide, AGD2-07), com corte folgado pendente/recente (D-08, correção 7 do 31-01) e ordenação só no SQL (data, criado_em, id)"
    requirement: "AGD2-01"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-query.test.ts#leitura-tabela-e-colunas"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-query.test.ts#leitura-sem-filtro-de-dono"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-query.test.ts#leitura-limite-recente"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-query.test.ts#leitura-ordem"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-query.test.ts#leitura-mapeamento"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-query.test.ts#leitura-paginada"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-query.test.ts#leitura-erro"
        status: pass
    human_judgment: false
  - id: D2
    description: "getAgenda2PendentesCount() filtra EXPLICITAMENTE vendedor_id = usuário logado e concluido = false — o selo de um Supervisor nunca mostra o total do time (D-13, Pitfall 2 da pesquisa)"
    requirement: "AGD2-07"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-query.test.ts#contagem-filtro-explicito"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-query.test.ts#contagem-sem-usuario"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-query.test.ts#contagem-erro"
        status: pass
    human_judgment: false
  - id: D3
    description: "criarAgenda2Item grava vendedor_id sempre da sessão do servidor (nunca da tela), com nome/bairro aparados e re-validados por agenda2ItemSchema"
    requirement: "AGD2-01"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#criar-dono-do-servidor"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#criar-aparado"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#criar-validacao"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#criar-falha"
        status: pass
    human_judgment: false
  - id: D4
    description: "atualizarAgenda2Item (AGD2-03) nunca inclui concluido no update (D-06); apagarAgenda2Item (AGD2-04); concluirAgenda2Item/desmarcarAgenda2Item (AGD2-05/D-05) usam update minimalista { concluido }; todas tratam zero linhas afetadas como nao_encontrado"
    requirement: "AGD2-04"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#atualizar-ok"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#atualizar-zero-linhas"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#atualizar-id-invalido"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#apagar-ok"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#apagar-zero-linhas"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#concluir-ok"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#desmarcar-ok"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nenhuma ação chama RPC; todas checam sessão antes de qualquer acesso ao banco; revalidatePath('/agenda-2') só no sucesso"
    requirement: "AGD2-06"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#sem-rpc"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#sem-sessao"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-actions.test.ts#revalida-so-no-sucesso"
        status: pass
    human_judgment: false
  - id: D6
    description: "Limites de tamanho (120/60) e a regra de 8+ dígitos do código permanecem sincronizados com a migration 0048"
    verification:
      - kind: unit
        ref: "tests/agenda2/limites-sincronizados.test.ts#nome-sincronizado"
        status: pass
      - kind: unit
        ref: "tests/agenda2/limites-sincronizados.test.ts#bairro-sincronizado"
        status: pass
      - kind: unit
        ref: "tests/agenda2/limites-sincronizados.test.ts#digitos-sincronizados"
        status: pass
    human_judgment: false

duration: ~12min
completed: 2026-10-01
status: complete
---

# Phase 31 Plan 4: Camada de Dados da Agenda 2 — Leitura, Contagem e Server Actions Summary

**`lib/supabase/queries/agenda2.ts` (leitura sem filtro de dono + contagem do menu com filtro explícito) e `app/actions/agenda2.ts` (seis Server Actions de CRUD direto, sem RPC, dono sempre vindo da sessão), com 29/29 testes verdes contra um cliente Supabase mockado — nenhum depende do banco real.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-10-01T12:52:29Z
- **Completed:** 2026-10-01T13:04:00Z
- **Tasks:** 2
- **Files modified:** 5 (todos criados, nenhum arquivo existente alterado)

## Accomplishments
- `lib/supabase/queries/agenda2.ts`: `getAgenda2(now?)` lê `agenda2_itens` sem nenhum filtro de dono (a RLS assimétrica da migration 0048 escopa vendedor → próprios, Supervisor → time, AGD2-07), com paginação via `buscarPaginado`, ordenação só no SQL (`data`, `criado_em`, `id`) e um corte `.or(...)` deliberadamente folgado (pendentes + últimos ~2 dias) para não baixar o histórico inteiro a cada abertura; `getAgenda2PendentesCount()` filtra EXPLICITAMENTE `vendedor_id = user.id` e `concluido = false`, evitando que o selo do menu de um Supervisor mostre o total do time (D-13, Pitfall 2 da pesquisa).
- `app/actions/agenda2.ts`: seis Server Actions (`getAgenda2Action`, `criarAgenda2Item`, `atualizarAgenda2Item`, `apagarAgenda2Item`, `concluirAgenda2Item`, `desmarcarAgenda2Item`) — toda escrita é insert/update/delete direto em `agenda2_itens`, sem RPC e sem privilégio elevado; o dono é sempre `user.id` da sessão do servidor (nunca vindo da tela, T-31-18); editar nunca inclui `concluido` no update (D-06); qualquer ação que afete zero linhas (RLS barrou ou item não existe) devolve `nao_encontrado`, nunca sucesso falso (D-16); a mensagem crua do banco nunca chega à tela.
- `tests/agenda2/agenda2-query.test.ts` (13 casos) e `tests/agenda2/agenda2-actions.test.ts` (16 casos): um único mock do cliente Supabase cobrindo as quatro formas de chamada usadas pelo arquivo de produção (leitura select/or/order/range; insert; update/delete seguidos de `.eq().select("id")`) — `getAgenda2Action` é exercitada pela implementação REAL de `getAgenda2()`, nunca mockando o módulo de query (mesma disciplina de `tests/funil/encerrados-query.test.ts`).
- `tests/agenda2/limites-sincronizados.test.ts` (3 casos): lê a migration 0048 com `fs` e confere, por string exata/contagem de ocorrências, que `AGENDA2_NOME_MAX`/`AGENDA2_BAIRRO_MAX`/`AGENDA2_DIGITOS_SEGUIDOS_MAX` continuam espelhando as constraints `chk_agenda2_*` do banco.
- `app/actions/agenda.ts` e `lib/supabase/queries/agenda.ts` (Agenda atual) confirmados intocados (`git diff --name-only 071871f` vazio para os dois).

## Task Commits

Each task was committed atomically:

1. **Tarefa 1 RED: testes da leitura e contagem da Agenda 2** - `7e61d20` (test)
2. **Tarefa 1 GREEN: leitura e contagem da Agenda 2** - `cd7297d` (feat)
3. **Tarefa 2 RED: testes das seis Server Actions da Agenda 2** - `cba413e` (test)
4. **Tarefa 2 GREEN: Server Actions da Agenda 2** - `4dfff57` (feat)

**Plan metadata:** pending (this commit)

_Nota: as 2 tarefas TDD deste plano (uma RED, uma GREEN cada) resultaram em 4 commits — não houve necessidade de commit REFACTOR em nenhuma delas; o código ficou verde já na primeira versão escrita._

## Files Created/Modified
- `lib/supabase/queries/agenda2.ts` - leitura da Lista (sem filtro de dono) + contagem do menu (filtro explícito de dono)
- `app/actions/agenda2.ts` - seis Server Actions de CRUD direto, sem RPC
- `tests/agenda2/agenda2-query.test.ts` - 13 testes da leitura/contagem
- `tests/agenda2/agenda2-actions.test.ts` - 16 testes das seis Server Actions
- `tests/agenda2/limites-sincronizados.test.ts` - 3 testes de sincronia migration/schema

## Decisions Made
- O teste de sincronia lê a migration 0048 com `fs` e compara string exata (`between 1 and <N>`) e contagem de ocorrências da regra `[0-9]{8,}` contra as constantes de `lib/validations/agenda2.ts`, em vez de apenas checar presença de números soltos — garante que os dois lados não possam divergir silenciosamente mesmo que outro trecho da migration contenha um número parecido por coincidência.
- Os testes de Server Action exercitam a implementação real de `getAgenda2()` (mockando só o cliente Supabase, não o módulo de query) — mesma disciplina já usada em `tests/funil/encerrados-query.test.ts`, evitando um segundo ponto de divergência entre o que o teste afirma e o que o código de produção realmente faz.
- `nao_encontrado` e `validacao` reusam a mesma mensagem genérica de salvar — nenhuma pista adicional sobre qual das duas causas ocorreu é exposta na tela (mesma postura de "não revelar detalhe interno" que o projeto já aplica em outros fluxos, ex. `ForgotPasswordForm`).

## Deviations from Plan

None - plan executed exactly as written. O desenho do mock de teste (cliente Supabase único cobrindo leitura e escrita) não estava especificado literalmente no plano, mas segue a mesma forma já estabelecida em `tests/funil/encerrados-query.test.ts` e `tests/funil/reativar-guard.test.ts` citados no bloco `<read_first>` da Tarefa 2 — não é uma mudança de comportamento, só a implementação do padrão de teste já indicado.

## Issues Encountered
None.

## User Setup Required
None - módulos de aplicação (queries + Server Actions), sem configuração de serviço externo. A migration 0048 que esta camada consome ainda depende da aplicação manual do plano 31-03 (pendente, aprovação do dono) — até lá, a tabela `agenda2_itens` não existe em produção; os testes deste plano não dependem do banco real (cliente Supabase mockado), então não são afetados por essa pendência.

## Alerta de Conformidade (LGPD)

Conforme instrução organizacional: este plano implementa a camada de leitura/escrita de uma tabela que guarda **dado pessoal** (nome livre do cliente + bairro + data, associados ao vendedor responsável — já sinalizado em `31-01-SUMMARY.md`/`31-02-SUMMARY.md`). Reforços de Privacidade por Design aplicados aqui, no lado do servidor:
- `getAgenda2()` não lê a coluna `criado_em` (minimização — a tela não usa esse campo).
- `getAgenda2PendentesCount()` filtra explicitamente por `vendedor_id` do usuário logado, evitando que um Supervisor veja, mesmo que indiretamente via contagem agregada, dados de acompanhamento de outro vendedor além do que a RLS já autoriza para leitura completa.
- `criarAgenda2Item`/`atualizarAgenda2Item` só persistem os três campos validados por `agenda2ItemSchema` (que já recusa sequências de 8+ dígitos de documento, 31-02) mais o dono vindo da sessão — nenhum campo extra enviado pela tela é gravado.
- Nenhuma dessas ações exporta, agrega fora do escopo do próprio usuário, ou expõe a mensagem crua de erro do banco.
O prazo de retenção dos dados do piloto continua em aberto (ver `31-01-SUMMARY.md`), sem mudança neste plano.

## Next Phase Readiness
- `lib/supabase/queries/agenda2.ts` e `app/actions/agenda2.ts` estão prontos para o menu (plano 31-06, via `getAgenda2PendentesCount`), o formulário (plano 31-07, via `criarAgenda2Item`/`atualizarAgenda2Item`) e a tela da Lista (plano 31-08, via `getAgenda2Action`/`concluirAgenda2Item`/`desmarcarAgenda2Item`/`apagarAgenda2Item`).
- Bloqueio real para uso em produção: a tabela `agenda2_itens` só existe depois da aplicação manual da migration 0048 pelo plano 31-03 (aguardando aprovação do dono do projeto) — sem isso, qualquer chamada real a estas funções falha com "tabela inexistente". Nenhum teste deste plano depende disso (cliente mockado), mas o uso real na tela, sim.
- Nenhum bloqueio de código para os planos 31-06/31-07/31-08: a superfície pública (`GetAgenda2Result`, `Agenda2MutationResult`, `Agenda2ErrorCode`) já está fixada exatamente como o bloco `<interfaces>` deste plano especifica.

---
*Phase: 31-agenda-2-visitas-manuais-na-lista*
*Completed: 2026-10-01*

## Self-Check: PASSED

- FOUND: lib/supabase/queries/agenda2.ts
- FOUND: app/actions/agenda2.ts
- FOUND: tests/agenda2/agenda2-query.test.ts
- FOUND: tests/agenda2/agenda2-actions.test.ts
- FOUND: tests/agenda2/limites-sincronizados.test.ts
- FOUND commit: 7e61d20 (Tarefa 1 RED)
- FOUND commit: cd7297d (Tarefa 1 GREEN)
- FOUND commit: cba413e (Tarefa 2 RED)
- FOUND commit: 4dfff57 (Tarefa 2 GREEN)
- Re-ran `npx vitest run tests/agenda2/agenda2-actions.test.ts tests/agenda2/agenda2-query.test.ts tests/agenda2/limites-sincronizados.test.ts` — 29/29 passed
- Re-ran `npx tsc --noEmit` — clean
- Re-ran `npx eslint lib/supabase/queries/agenda2.ts app/actions/agenda2.ts tests/agenda2/agenda2-actions.test.ts tests/agenda2/agenda2-query.test.ts tests/agenda2/limites-sincronizados.test.ts` — clean
- Confirmed `git diff --name-only 071871f -- app/actions/agenda.ts lib/supabase/queries/agenda.ts` lists nothing (Agenda atual intocada)
