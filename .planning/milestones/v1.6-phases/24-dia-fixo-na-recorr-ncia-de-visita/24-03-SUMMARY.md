---
phase: 24-dia-fixo-na-recorr-ncia-de-visita
plan: 03
subsystem: ui
tags: [react, server-actions, supabase, agenda, vocabulario]

# Dependency graph
requires:
  - phase: 24-dia-fixo-na-recorr-ncia-de-visita
    provides: "clientes.dia_semana_visita/semana_do_mes_visita (migration 0026, plano 24-01), leitura/gravacao da ancora na ficha do cliente (plano 24-02)"
provides:
  - "lib/agenda/itens.ts — ClienteSemDiaFixo, motivoSemDiaFixo, MOTIVO_SEM_DIA_FIXO_LABELS, filtrarPorVendedor generalizada"
  - "lib/supabase/queries/agenda.ts#getClientesSemDiaFixo — SELECT plano sobre clientes (ganho + ancora ausente/incompleta), excluindo frequencia nenhuma"
  - "app/actions/agenda.ts#getClientesSemDiaFixoAction"
  - "components/agenda/AgendaSemDiaFixo.tsx — secao nova da Lista da Agenda"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "filtrarPorVendedor generalizada com generic (T extends { responsavel }) em vez de uma segunda funcao de filtro — unica autoridade de estreitamento por vendedor no projeto, agora aceitando duas formas de dado"
    - "Segunda leitura fetch-on-mount no mesmo componente, dependente do MESMO reloadKey do efeito original, sem setState sincrono no corpo (evita uma segunda supressao de lint) — molde novo para 'aviso auxiliar que nunca pode impedir a tela principal de carregar'"
    - "Item de secao clicavel como <button> nativo com as mesmas classes utilitarias de Card size=sm copiadas (nao herdadas via componente), porque Card so desenha <div> e o item precisa ser um botao de verdade"

key-files:
  created:
    - components/agenda/AgendaSemDiaFixo.tsx
    - tests/agenda/sem-dia-fixo.test.tsx
  modified:
    - lib/agenda/itens.ts
    - lib/supabase/queries/agenda.ts
    - app/actions/agenda.ts
    - components/agenda/AgendaList.tsx
    - tests/agenda/itens.test.ts
    - tests/agenda/agenda-list.test.tsx
    - tests/agenda/agenda-calendario-integracao.test.tsx

key-decisions:
  - "filtrarPorVendedor generalizada em vez de duplicada: T extends { responsavel: string | null } — nenhuma chamada existente mudou, e o teste antigo continuou passando sem edicao."
  - "Frequencia 'nenhuma' fica de fora da consulta de proposito (RES-11 da pesquisa da Fase 24): quem desligou a recorrencia nao e cobrado por um dia fixo que, para ele, nao existe."
  - "Ancora mensal pela metade (dia da semana escolhido, semana do mes ainda nao) conta como 'sem dia fixo' — mesmo raciocinio de D-01 que a migration 0026 ja usa para cair no calculo antigo."
  - "AgendaSemDiaFixo.tsx usa <button> nativo com as classes de Card copiadas, em vez de Card+role='button'+onKeyDown (molde de AgendaItemRow) — o plano pediu explicitamente 'um botao de verdade, para funcionar por teclado', e Card so desenha <div>."
  - "Zero RPC nova: leitura e um SELECT plano sobre clientes, sem join que precise atomicidade — dentro da convencao ja travada do projeto (RPC so para escrita atomica ou leitura que une tabelas)."

requirements-completed: [AGENDA-01]

coverage:
  - id: D1
    description: "A secao 'Sem dia fixo definido (N)' mostra os clientes ativos sem dia fixo com o motivo certo por linha (sem_frequencia vs sem_dia_fixo), excluindo quem tem frequencia 'nenhuma'"
    requirement: "AGENDA-01"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#motivoSemDiaFixo (3 casos) e MOTIVO_SEM_DIA_FIXO_LABELS"
        status: pass
      - kind: automated_ui
        ref: "tests/agenda/sem-dia-fixo.test.tsx#dois clientes desenham duas linhas com os dois textos de motivo diferentes"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint humano (Task 3), passos 1-2 e 5, confirmado pelo dono do projeto com 4 clientes semeados (um por cenario)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cliente mensal com ancora pela metade (dia da semana definido, semana do mes vazia) continua aparecendo na secao"
    requirement: "AGENDA-01"
    verification:
      - kind: manual_procedural
        ref: "Checkpoint humano (Task 3), passo 6 ('24-03 Mensal Parcial LTDA')"
        status: pass
    human_judgment: true
    rationale: "O predicado da consulta (frequencia_visita = 'mensal' AND semana_do_mes_visita IS NULL) so pode ser provado fim-a-fim contra RLS + dados reais; este plano nao introduz um teste de integracao de banco para a leitura nova (mesma decisao de escopo dos planos irmaos), entao a prova veio do checkpoint humano com um cliente semeado especificamente para este caso."
  - id: D3
    description: "Clicar numa linha da secao abre a ficha do cliente (nunca um formulario na propria linha); definir o dia fixo la faz o cliente sair da secao na recarga seguinte"
    requirement: "AGENDA-01"
    verification:
      - kind: automated_ui
        ref: "tests/agenda/sem-dia-fixo.test.tsx#clicar numa linha chama o pedido de abrir ficha com o identificador daquele cliente"
        status: pass
    human_judgment: true
    rationale: "O clique fisico no navegador (passo 3) e o ciclo salvar->recarregar->sumir (passo 4) nao puderam ser exercitados ao vivo nesta sessao de verificacao por uma instabilidade de clique do ambiente ja registrada nesta mesma sessao (mesma classe de problema ja visto com dnd-kit e Selects, nao uma regressao deste plano). A garantia estrutural — handleOpenCliente e reloadKey sao os MESMOS que a Lista ja usa para suas proprias linhas — mais a cobertura RTL do clique sustentam o comportamento, mas o dono do projeto nao confirmou visualmente o fluxo completo."
  - id: D4
    description: "O Calendario (mes/semana/dia) continua exatamente igual — nenhum arquivo dele tocado, a secao nova nao aparece em nenhuma das tres visoes"
    requirement: "AGENDA-01"
    verification:
      - kind: other
        ref: "git diff --quiet HEAD -- components/agenda/AgendaCalendario.tsx components/agenda/AgendaCalendarioDia.tsx components/agenda/AgendaCalendarioMes.tsx components/agenda/AgendaCalendarioSemana.tsx"
        status: pass
      - kind: automated_ui
        ref: "tests/agenda/agenda-list.test.tsx#aviso de dia fixo (AGENDA-01): a secao aparece na Lista quando a acao devolve clientes, e nao aparece na visao de Calendario"
        status: pass
    human_judgment: false
  - id: D5
    description: "O filtro de vendedor do Supervisor estreita a secao nova pelo mesmo criterio que ja estreita a Lista, sempre concordando com ela"
    requirement: "AGENDA-01"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#filtrarPorVendedor (generalizado): com um vendedorId valido devolve so os clientes sem dia fixo daquele responsavel"
        status: pass
    human_judgment: true
    rationale: "A concordancia visual entre o filtro do Supervisor, a Lista e a secao nova (passo 8) nao pode ser confirmada fisicamente no navegador nesta sessao pela mesma instabilidade de clique em Selects ja registrada. A garantia vem de reusar a MESMA funcao filtrarPorVendedor generalizada (nunca um segundo filtro), coberta por teste unitario, mas sem confirmacao visual fim-a-fim do dono do projeto."
  - id: D6
    description: "A secao aparece mesmo quando a agenda de pendentes (atrasado/hoje/proximos) esta vazia — nao fica escondida atras do estado 'Sua agenda esta em dia'"
    requirement: "AGENDA-01"
    verification:
      - kind: automated_ui
        ref: "tests/agenda/agenda-list.test.tsx#aviso de dia fixo (AGENDA-01) (mockedAction resolve lista de pendentes vazia + getClientesSemDiaFixoAction resolve 1 cliente)"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint humano (Task 3), passo 9 ('Sua agenda esta em dia' + secao visivel)"
        status: pass
    human_judgment: false

# Metrics
duration: ~16min de execucao ativa (Tasks 1-2) + pausa de checkpoint ate o dono do projeto verificar no navegador
completed: 2026-08-26
status: complete
---

# Phase 24 Plan 03: Dia Fixo na Recorrência de Visita — Aviso na Agenda Summary

**Nova seção "Sem dia fixo definido (N)" no topo da Lista da Agenda, listando clientes ativos sem âncora de recorrência (com o motivo certo por linha), lida por um SELECT plano novo que exclui de propósito quem desligou a recorrência (`frequencia_visita = 'nenhuma'`).**

## Performance

- **Duration:** ~16min de execução ativa (Tasks 1 e 2), mais a pausa de checkpoint até o dono do projeto verificar no navegador
- **Started:** 2026-08-26T18:31Z (aprox.)
- **Completed:** 2026-08-26 (checkpoint aprovado pelo dono do projeto)
- **Tasks:** 3/3 (2 auto/tdd + 1 checkpoint de verificação humana)
- **Files modified:** 9 (2 novos, 7 editados)

## Accomplishments
- `lib/agenda/itens.ts`: camada pura nova — `ClienteSemDiaFixo` (tipo explicitamente NÃO um item de agenda), `motivoSemDiaFixo` (classifica `sem_frequencia` vs `sem_dia_fixo`, sem decidir quem entra na lista), `MOTIVO_SEM_DIA_FIXO_LABELS` (os dois textos de tela), e `filtrarPorVendedor` generalizada com um genérico (`T extends { responsavel: string | null }`) para aceitar tanto `AgendaItem[]` quanto `ClienteSemDiaFixo[]` sem quebrar nenhuma chamada existente. Coberto por 8 casos novos em `tests/agenda/itens.test.ts`, escritos ANTES da implementação (RED confirmado com `motivoSemDiaFixo is not a function`, depois GREEN).
- `lib/supabase/queries/agenda.ts#getClientesSemDiaFixo`: leitura nova, SELECT plano sobre `clientes` (`status_acompanhamento = 'ganho'`), filtrando por três casos somados em OR (frequência vazia; frequência ≠ `nenhuma` e dia da semana vazio; frequência `mensal` e semana do mês vazia), ordenada por razão social, sem filtro de responsável escrito à mão (RLS de `clientes` já escopa).
- `app/actions/agenda.ts#getClientesSemDiaFixoAction`: embrulho fino no molde de `getAgendaAction`, checa sessão antes de chamar a leitura.
- `components/agenda/AgendaSemDiaFixo.tsx`: componente de apresentação puro novo — devolve `null` para lista vazia, título com contagem, linha de explicação, e um item por cliente como `<button>` nativo (para funcionar por teclado nativamente, sem `onKeyDown` próprio) com as mesmas classes utilitárias de `Card size="sm"` copiadas.
- `components/agenda/AgendaList.tsx`: segunda leitura fetch-on-mount (`clientesSemDiaFixo`), dependente do MESMO `reloadKey` do efeito original (reage à mesma recarga: salvar pela ficha, "Tentar novamente"), sem `setState` síncrono no corpo (nenhuma supressão de lint nova), estreitada pelo mesmo `filtrarPorVendedor`, renderizada acima das três seções de trabalho — inclusive quando a agenda de pendentes está vazia.
- `tests/agenda/agenda-list.test.tsx` e `tests/agenda/agenda-calendario-integracao.test.tsx`: simulações de módulo de `app/actions/agenda.ts` ganham `getClientesSemDiaFixoAction`; caso novo em `agenda-list.test.tsx` prova a seção na Lista (com a agenda de pendentes vazia, cobrindo também D6/passo 9) e sua ausência no Calendário.
- `tests/agenda/sem-dia-fixo.test.tsx`: teste de tela novo do componente — lista vazia não desenha nada, dois motivos diferentes aparecem, contagem no título, clique devolve o identificador certo, nome do responsável condicional.

## Task Commits

Each task was committed atomically:

1. **Task 1a (RED): teste de motivoSemDiaFixo e filtrarPorVendedor generalizado** - `e4843d9` (test)
2. **Task 1b (GREEN): vocabulário puro (`lib/agenda/itens.ts`)** - `a05b3b8` (feat)
3. **Task 1c: leitura `getClientesSemDiaFixo` e ação `getClientesSemDiaFixoAction`** - `48059d2` (feat)
4. **Task 2: seção `AgendaSemDiaFixo`, fiação em `AgendaList.tsx` e testes de tela** - `45b7e27` (feat)
5. **Task 3: checkpoint de verificação humana no navegador** — sem commit próprio, aprovado pelo dono do projeto com clientes de teste semeados

**Plan metadata:** (este commit — docs: complete plan)

## Files Created/Modified
- `lib/agenda/itens.ts` - `ClienteSemDiaFixo`, `MotivoSemDiaFixo`, `motivoSemDiaFixo`, `MOTIVO_SEM_DIA_FIXO_LABELS`, `filtrarPorVendedor` generalizada
- `lib/supabase/queries/agenda.ts` - `getClientesSemDiaFixo` (SELECT plano + filtro OR de três casos)
- `app/actions/agenda.ts` - `getClientesSemDiaFixoAction`
- `components/agenda/AgendaSemDiaFixo.tsx` - seção nova, apresentação pura
- `components/agenda/AgendaList.tsx` - segunda leitura, estreitamento e composição da seção
- `tests/agenda/itens.test.ts` - 8 casos novos (motivo, labels, filtro generalizado)
- `tests/agenda/agenda-list.test.tsx` - mock da ação nova + 1 caso novo (seção na Lista, ausente no Calendário, agenda de pendentes vazia)
- `tests/agenda/agenda-calendario-integracao.test.tsx` - mock da ação nova (sem caso novo, só para não quebrar)
- `tests/agenda/sem-dia-fixo.test.tsx` - teste de tela do componente novo (5 casos)

## Decisions Made
- `filtrarPorVendedor` generalizada com genérico em vez de uma segunda função com a mesma regra — a trava mecânica do plano (`grep -c 'export function filtrarPorVendedor'` = 1) confirma que continua existindo uma única autoridade de estreitamento por vendedor no projeto.
- Frequência `nenhuma` fica fora da consulta de propósito (RES-11 da pesquisa da Fase 24, decisão já travada no plano): quem desligou a recorrência não é cobrado por um dia fixo que, para ele, não existe.
- Âncora mensal pela metade conta como "sem dia fixo" (mesmo raciocínio de D-01 que a migration 0026 já usa) — provado no checkpoint com o cliente `24-03 Mensal Parcial LTDA`.
- `AgendaSemDiaFixo.tsx` usa um `<button>` nativo com as classes de `Card size="sm"` copiadas, em vez do molde `Card` + `role="button"` + `onKeyDown` de `AgendaItemRow.tsx` — o plano pediu explicitamente "um botão de verdade, para funcionar por teclado", e o componente `Card` só desenha `<div>`.
- Zero RPC nova: a leitura é um SELECT plano sem união de tabelas que precise atomicidade — dentro da convenção já travada do projeto (RPC reservada para escrita atômica/guardada ou leitura que precisa unir tabelas).

## Deviations from Plan

Nenhum desvio de comportamento. Duas observações sobre a verificação mecânica do próprio plano, na mesma classe de falso positivo já documentada em `24-02-SUMMARY.md`:

**1. (sem impacto em correção)** A trava de pureza de `lib/agenda/itens.ts` (`grep -c 'next/\|@/lib/supabase/'` = 0) conta também os COMENTÁRIOS que mencionam essas strings ao explicar a regra de pureza do arquivo (pré-existente desde o cabeçalho original, e a seção nova deste plano repete a mesma frase de aviso já usada pelas camadas de calendário e de histórico). A contagem real de `import` no topo do arquivo continua em 2 (`date-fns`, `date-fns/locale`) mais 1 `import type` (`lib/funil/frequencia`) — nenhum `next/*` nem `@/lib/supabase/*` de verdade. Confirmado manualmente com `grep -n '^import'`.

**2. (sem impacto em cobertura)** O checkpoint humano (Task 3) não conseguiu exercitar fisicamente os passos 3, 7 e 8 (clique numa linha, alternância Lista/Calendário, filtro do Supervisor) por uma instabilidade de clique do ambiente de navegador já registrada nesta mesma sessão em outras verificações (dnd-kit, Selects) — não uma regressão introduzida por este plano. O dono do projeto optou por considerar esses três passos cobertos pela combinação de evidências já existentes: a trava mecânica de `git diff --quiet` sobre os 4 arquivos do Calendário (passo 7), e a cobertura RTL de clique/navegação em `sem-dia-fixo.test.tsx` e `agenda-list.test.tsx` (passos 3 e 8). Registrado em `coverage` acima (D2/D3/D5) com `human_judgment: true` e a razão explícita, em vez de marcado como confirmado sem ressalva.

## Issues Encountered

None. `npx tsc --noEmit`, `npx eslint` nos cinco arquivos de aplicação tocados, e as quatro suítes de vitest indicadas pelo plano (`sem-dia-fixo.test.tsx`, `agenda-list.test.tsx`, `agenda-calendario-integracao.test.tsx`, `itens.test.ts` — 98/98 casos) passaram sem ajuste.

## User Setup Required

None - nenhuma configuração de serviço externo. Nenhuma migration nova neste plano (a leitura usa as colunas já criadas pela migration 0026 no plano 24-01).

## Next Phase Readiness

Este é o último plano da Fase 24 — a fase inteira fecha aqui.

- ANCORA-01 a ANCORA-04 (plano 24-01) e AGENDA-01 (este plano) são os 5 requisitos da Fase 24 — todos completos.
- O ciclo fim-a-fim da Fase 24 está fechado: schema/cálculo (24-01) → ficha do cliente grava a âncora (24-02) → Agenda lembra quem ainda não tem âncora (24-03). Nenhum requisito órfão.
- Pendência de baixo risco herdada (não deste plano): a nota já registrada em `24-02-SUMMARY.md` sobre o cenário "visita já agendada não muda quando o dia fixo é definido" (D-04) não ter sido recriado manualmente no navegador — sustentada pela cobertura de integração do plano 24-01 e pela garantia estrutural de que `atualizarFrequenciaVisita` nunca escreve em `visitas`.
- Pendência de baixo risco nova (deste plano): os passos 3, 7 e 8 do checkpoint humano não foram exercitados fisicamente no navegador por instabilidade de clique do ambiente (ver Deviations acima) — cobertos por RTL + trava mecânica, mas vale um teste ocasional em uso real caso surja divergência com o comportamento visual do Select de vendedor da Agenda (já com uma ressalva própria registrada em `deferred-items.md` desde a Fase 20).
- Nenhum bloqueio novo. O blocker pré-existente de contas seed de vendedor apagadas (STATE.md) não afeta este plano — nenhum teste editado ou criado aqui depende de `signInAs`.

---
*Phase: 24-dia-fixo-na-recorr-ncia-de-visita*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: components/agenda/AgendaSemDiaFixo.tsx
- FOUND: tests/agenda/sem-dia-fixo.test.tsx
- FOUND commit: e4843d9
- FOUND commit: a05b3b8
- FOUND commit: 48059d2
- FOUND commit: 45b7e27
