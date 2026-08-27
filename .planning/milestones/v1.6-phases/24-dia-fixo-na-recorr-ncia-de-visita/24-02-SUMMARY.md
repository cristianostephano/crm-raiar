---
phase: 24-dia-fixo-na-recorr-ncia-de-visita
plan: 02
subsystem: ui
tags: [react, server-actions, supabase, forms, vocabulario]

# Dependency graph
requires:
  - phase: 24-dia-fixo-na-recorr-ncia-de-visita
    provides: "migration 0026 (dia_semana_enum/semana_do_mes_enum, colunas clientes.dia_semana_visita/semana_do_mes_visita, proxima_data_visita mirando a ancora)"
provides:
  - "lib/funil/diaFixo.ts — vocabulario puro do dia fixo (rotulos, guards de tipo, exigeSemanaDoMes, normalizarAncora, ancoraCompleta)"
  - "atualizarFrequenciaVisita (app/actions/clientes.ts) gravando as duas colunas de ancora, revalidando /clientes e /agenda"
  - "ClienteDetailSheet com os dois Selects condicionais de dia fixo e a linha de explicacao do fallback D-01"
affects: [24-03-agenda-secao-sem-dia-fixo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Handler unico de salvamento (salvarAncora) chamado pelos tres campos de tela, com a normalizacao decidida sempre por um modulo puro — nunca comparacao de texto na tela"
    - "Parametro novo de Server Action sempre no fim da lista com default null, para nenhuma chamada existente quebrar (mesma convencao ja usada em mover_card_funil)"

key-files:
  created:
    - lib/funil/diaFixo.ts
    - tests/clientes/dia-fixo-vocabulario.test.ts
  modified:
    - lib/supabase/queries/clientes.ts
    - app/actions/clientes.ts
    - components/clientes/ClienteDetailSheet.tsx

key-decisions:
  - "Reuso obrigatorio: exigeSemanaDoMes/normalizarAncora usam geraProximaVisita (lib/funil/frequencia.ts) em vez de redeclarar a mesma pergunta ('esta frequencia pede dia da semana?') com um segundo nome."
  - "atualizarFrequenciaVisita continua um UPDATE comum em clientes, nunca uma chamada a mover_card_funil, e nunca toca em visitas — e essa ausencia de escrita em visitas que entrega o D-04 (visita ja marcada nao muda quando o dia fixo e definido agora)."
  - "Os dois campos novos (dia da semana, semana do mes) vivem dentro do MESMO bloco condicionado a cliente ganho que ja continha o Select de frequencia — nunca um formulario paralelo; GanhoFrequenciaDialog.tsx permanece intocado (GANHO-03)."

requirements-completed: [ANCORA-01, ANCORA-02]

coverage:
  - id: D1
    description: "Com frequencia semanal ou quinzenal, a ficha oferece o dia da semana logo abaixo da frequencia e grava a escolha na hora"
    requirement: "ANCORA-01"
    verification:
      - kind: unit
        ref: "tests/clientes/dia-fixo-vocabulario.test.ts#normalizarAncora/ancoraCompleta (semanal/quinzenal)"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint humano (Task 3), passos 1-3, confirmado direto no banco pelo dono do projeto"
        status: pass
    human_judgment: false
  - id: D2
    description: "Com frequencia mensal, a ficha oferece semana do mes (exatamente 5 opcoes) e dia da semana, e grava os dois"
    requirement: "ANCORA-02"
    verification:
      - kind: unit
        ref: "tests/clientes/dia-fixo-vocabulario.test.ts#SEMANA_DO_MES_LABELS tem exatamente 5 chaves + ancoraCompleta mensal"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint humano (Task 3), passos 4-5, confirmado direto no banco pelo dono do projeto"
        status: pass
    human_judgment: false
  - id: D3
    description: "Trocar de mensal para semanal, ou para nenhuma, limpa o campo que nao se aplica mais (sem resto vestigial)"
    verification:
      - kind: unit
        ref: "tests/clientes/dia-fixo-vocabulario.test.ts#normalizarAncora (sem cadencia / semanal / quinzenal limpam semana do mes)"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint humano (Task 3), passos 6-7, confirmado direto no banco (semana_do_mes_visita voltou null, dia_semana_visita preservado; depois ambos null em 'Nenhuma')"
        status: pass
    human_judgment: false
  - id: D4
    description: "Enquanto o dia fixo nao esta completo, a ficha explica em uma linha que o calculo antigo ainda vale (D-01)"
    verification:
      - kind: unit
        ref: "tests/clientes/dia-fixo-vocabulario.test.ts#ancoraCompleta"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint humano (Task 3), passos 1 e 4 (linha aparece sem dia definido / sem semana do mes definida, some ao completar)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A caixinha de marcar ganho (GanhoFrequenciaDialog) continua identica, sem nenhum campo de dia fixo"
    requirement: "GANHO-03"
    verification:
      - kind: other
        ref: "git diff --quiet HEAD -- components/clientes/GanhoFrequenciaDialog.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "Uma visita ja agendada nao muda de data quando o dia fixo e definido agora (D-04)"
    verification:
      - kind: integration
        ref: "tests/clientes/dia-fixo-visita.test.ts (plano 24-01, prova que proxima_data_visita/mover_card_funil nunca tocam visitas ja existentes)"
        status: pass
    human_judgment: true
    rationale: "O cenario fim-a-fim (visita ja agendada -> definir dia fixo -> conferir na Agenda que a data nao mudou) nao foi recriado manualmente no navegador neste checkpoint por falta de um cliente com visita pendente disponivel na sessao de verificacao; a garantia estrutural (a acao so grava clientes.dia_semana_visita/semana_do_mes_visita, nunca visitas) e a cobertura de integracao do plano 24-01 sustentam o D-04, mas o dono do projeto nao confirmou visualmente este passo especifico — registrar como pendencia de baixo risco caso surja divergencia em uso real."

# Metrics
duration: ~10min de execucao ativa (Tasks 1-2) + pausa de checkpoint ate a verificacao do dono do projeto no navegador
completed: 2026-08-26
status: complete
---

# Phase 24 Plan 02: Dia Fixo na Recorrência de Visita — Ficha do Cliente Summary

**Dois Selects novos (dia da semana, semana do mês) abaixo da frequência de visita na ficha do cliente ganho, salvando na hora nas duas colunas que a migration 0026 criou, com um módulo puro (`lib/funil/diaFixo.ts`) como autoridade única do vocabulário e da regra de quais campos sobrevivem a uma troca de frequência.**

## Performance

- **Duration:** ~10min de execução ativa (Tasks 1 e 2), mais o intervalo de checkpoint até o dono do projeto verificar no navegador
- **Started:** 2026-08-26 (logo após o plano ser escrito)
- **Completed:** 2026-08-26 (checkpoint aprovado pelo dono do projeto)
- **Tasks:** 3/3 (2 auto/tdd + 1 checkpoint de verificação humana)
- **Files modified:** 5 (2 novos, 3 editados)

## Accomplishments
- `lib/funil/diaFixo.ts`: módulo puro novo espelhando a forma de `lib/funil/frequencia.ts` — sete dias da semana e cinco semanas do mês com rótulos em português, dois guards de tipo, `exigeSemanaDoMes` (reusando `geraProximaVisita` em vez de redeclarar a mesma pergunta), `normalizarAncora` (regra única de quais campos sobrevivem a uma troca de frequência) e `ancoraCompleta` (decide quando mostrar o aviso de fallback D-01). Coberto por 41 casos em `tests/clientes/dia-fixo-vocabulario.test.ts`, escritos ANTES da implementação (RED confirmado antes do GREEN).
- `lib/supabase/queries/clientes.ts`: leitura da ficha (`getClienteById`) passa a trazer `dia_semana_visita`/`semana_do_mes_visita` como `diaSemanaVisita`/`semanaDoMesVisita` no `ClienteDetalhe`, ambas opcionais.
- `app/actions/clientes.ts`: `atualizarFrequenciaVisita` ganha dois parâmetros novos no fim (`diaSemana`, `semanaDoMes`, ambos `default null`), revalida os dois valores com os guards de `diaFixo.ts` antes de gravar, normaliza pela frequência (T-24-09) e grava as três colunas num único UPDATE; passa a revalidar também `/agenda` (a Fase 24-03 vai listar quem está sem dia fixo).
- `components/clientes/ClienteDetailSheet.tsx`: handler único `salvarAncora` (chamado pelos três selects de tela) substitui o antigo `handleFrequenciaChange` isolado; dois Selects novos — "Semana do mês" (acima, só quando `exigeSemanaDoMes`) e "Dia da semana" (só quando `geraProximaVisita`) — dentro do mesmo bloco condicionado a cliente ganho; linha de explicação em texto simples quando `ancoraCompleta` é falso.

## Task Commits

Each task was committed atomically:

1. **Task 1a (RED): teste do vocabulário de dia fixo** - `efafad9` (test)
2. **Task 1b (GREEN): módulo puro `lib/funil/diaFixo.ts`** - `c2a5b70` (feat)
3. **Task 2: leitura, gravação e os dois Selects na ficha do cliente** - `c37eb59` (feat)
4. **Task 3: checkpoint de verificação humana no navegador** — sem commit próprio, aprovado pelo dono do projeto diretamente

**Plan metadata:** (este commit — docs: complete plan)

## Files Created/Modified
- `lib/funil/diaFixo.ts` - vocabulário puro do dia fixo (rótulos, guards, `exigeSemanaDoMes`, `normalizarAncora`, `ancoraCompleta`)
- `tests/clientes/dia-fixo-vocabulario.test.ts` - 41 casos cobrindo os sete dias da semana, as cinco semanas do mês, os dois guards, e as três funções de regra
- `lib/supabase/queries/clientes.ts` - `ClienteDetalhe`/`ClienteDetalheRow` trazem `diaSemanaVisita`/`semanaDoMesVisita`
- `app/actions/clientes.ts` - `atualizarFrequenciaVisita` estendida (2 parâmetros novos, revalidação de `/agenda`)
- `components/clientes/ClienteDetailSheet.tsx` - dois Selects condicionais + linha de explicação, handler único `salvarAncora`

## Decisions Made
- Módulo `diaFixo.ts` reusa `geraProximaVisita` de `lib/funil/frequencia.ts` em vez de criar uma segunda função com o mesmo significado ("esta frequência pede dia da semana?") — registrado em comentário de cabeçalho, conforme exigido pelo plano.
- `atualizarFrequenciaVisita` nunca toca na tabela `visitas` — apenas grava colunas de `clientes` — o que entrega o D-04 (visita já marcada não muda quando o dia fixo é definido agora) por construção, sem precisar de um guard explícito.
- Revalidação de `/agenda` acrescentada à mesma ação, seguindo o precedente da Fase 22 (revalidação extra quando a Agenda passa a consumir uma lista editável) — a seção nova da Agenda (plano 24-03) vai depender de `dia_semana_visita`/`semana_do_mes_visita` estarem atualizadas ali.

## Deviations from Plan

Nenhum desvio de comportamento. Uma observação sobre a verificação mecânica do próprio plano:

**Nota (sem impacto em correção/segurança):** o script de verificação do plano esperava `grep -c 'cliente-dia-semana-visita-select'` = 1 e `grep -c 'cliente-semana-do-mes-visita-select'` = 1; o valor real é 2 para cada um, porque o identificador aparece tanto no `<Label htmlFor>` quanto no `<SelectTrigger id>` — exatamente o mesmo padrão de acessibilidade que **todo** outro Select desta ficha já usa (`cliente-status-select` e `cliente-frequencia-visita-select` também contam 2). Não é um defeito: os dois Selects existem, com os identificadores certos, ligados corretamente ao rótulo. A contagem esperada pelo script do plano não levou em conta a convenção já estabelecida no próprio arquivo. Confirmado com o dono do projeto, que concordou em registrar aqui em vez de degradar a acessibilidade só para bater com a contagem.

## Issues Encountered

None. `npx tsc --noEmit`, `npx eslint` nos quatro arquivos tocados, e as duas suítes de vitest indicadas pelo plano (`dia-fixo-vocabulario.test.ts` 41/41, `agenda-calendario-integracao.test.tsx`) passaram sem ajuste.

## User Setup Required

None - nenhuma configuração de serviço externo. A migration 0026 já havia sido aplicada em produção no plano 24-01.

## Next Phase Readiness
- `clientes.dia_semana_visita`/`clientes.semana_do_mes_visita` já são lidas e gravadas pela ficha — a seção nova da Agenda (plano 24-03) pode filtrar diretamente por `dia_semana_visita is null` (ou equivalente) sem precisar de nenhuma mudança nesta camada.
- `revalidatePath("/agenda")` já foi acrescentado a `atualizarFrequenciaVisita` — o plano 24-03 não precisa adicionar essa revalidação de novo.
- Pendência de baixo risco (ver coverage D6 acima): o cenário "visita já agendada não muda quando o dia fixo é definido" não foi recriado manualmente no navegador por falta de um cliente com visita pendente disponível na sessão de verificação — sustentado pela cobertura de integração do plano 24-01 e pela garantia estrutural de que a ação nunca escreve em `visitas`, mas vale um teste ocasional em uso real.
- Nenhum bloqueio novo. O blocker pré-existente de contas seed de vendedor apagadas (STATE.md) não afeta este plano — nenhum teste editado ou criado aqui depende de `signInAs`.

---
*Phase: 24-dia-fixo-na-recorr-ncia-de-visita*
*Completed: 2026-08-26*

## Self-Check: PASSED

- FOUND: lib/funil/diaFixo.ts
- FOUND: tests/clientes/dia-fixo-vocabulario.test.ts
- FOUND commit: efafad9
- FOUND commit: c2a5b70
- FOUND commit: c37eb59
