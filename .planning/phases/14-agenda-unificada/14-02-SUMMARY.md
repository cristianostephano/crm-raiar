---
phase: 14-agenda-unificada
plan: 02
subsystem: api
tags: [date-fns, vitest, supabase-rpc, server-actions, typescript]

# Dependency graph
requires:
  - phase: 14-agenda-unificada (plan 14-01)
    provides: "agenda_do_vendedor() RPC — union all de tarefas de prospecção pendentes + visitas pendentes, 8 colunas, SECURITY INVOKER, já em produção"
provides:
  - "lib/agenda/itens.ts — autoridade única de bucketDoItem/agruparAgenda/filtrarPorVendedor/vendedoresDaAgenda, dependency-free"
  - "lib/supabase/queries/agenda.ts — getAgenda()/getAgendaPendentesCount(), leitor tipado da RPC, mesma fonte para lista e contagem"
  - "app/actions/agenda.ts — getAgendaAction(), Server Action de leitura em união discriminada"
affects: [14-03-tela-agenda, 14-04-menu-e-selo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Camada de lógica pura dependency-free (lib/agenda/itens.ts) seguindo o precedente de lib/clientes/completude.ts e lib/funil/staleness.ts — nenhum import de @/lib/supabase/* ou next/*, para que um Client Component possa importar sem arrastar código de servidor para o bundle"
    - "Comparação por dia de calendário (differenceInCalendarDays + parseISO do date-fns), nunca new Date(string) — mesma mitigação da Pitfall 1 já usada em lib/funil/staleness.ts"
    - "Leitor tipado + Server Action em união discriminada mirando lib/supabase/queries/dashboard.ts e app/actions/dashboard.ts"

key-files:
  created:
    - lib/agenda/itens.ts
    - tests/agenda/itens.test.ts
    - lib/supabase/queries/agenda.ts
    - app/actions/agenda.ts
  modified: []

key-decisions:
  - "getAgendaPendentesCount() usa rpc('agenda_do_vendedor', undefined, { count: 'exact', head: true }) — a fonte de contagem que o 14-01-SUMMARY.md provou funcionar contra o supabase-js desta versão, sem precisar do fallback de length() sobre a leitura completa"
  - "REQUIREMENTS.md NÃO foi editado por este plano: AGD-01/AGD-03/AGD-06 continuam listados como 'Pending' na tabela de rastreabilidade porque o comportamento visível ao usuário (tela e selo do menu) só existe depois dos planos 14-03/14-04 — mesmo precedente já registrado no STATE.md para a Fase 09-01 (requisito que se espalha por vários planos fica Pending até o plano que entrega a UI)"

patterns-established:
  - "lib/agenda/itens.ts é a ÚNICA autoridade de bucketing atrasado/hoje/próximos e de repartição/filtro/opções de vendedor da Agenda — nenhum outro arquivo do projeto pode duplicar essa decisão"
  - "getAgenda() e getAgendaPendentesCount() saem obrigatoriamente da mesma RPC (agenda_do_vendedor) — contrato que impede o selo do menu de discordar da lista da tela (AGD-06)"

requirements-completed: [AGD-01, AGD-03, AGD-06]

coverage:
  - id: D1
    description: "bucketDoItem classifica atrasado/hoje/proximos por dia de calendário, estável em duas horas diferentes do mesmo dia (00h05 e 23h30)"
    requirement: "AGD-03"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#bucketDoItem"
        status: pass
    human_judgment: false
  - id: D2
    description: "agruparAgenda reparte a lista em três seções preservando a ordem de entrada e sem reordenar, com invariante de partição (soma = total) e caso vazio"
    requirement: "AGD-01"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#agruparAgenda"
        status: pass
    human_judgment: false
  - id: D3
    description: "filtrarPorVendedor/vendedoresDaAgenda (base do AGD-05): filtro local sobre lista já escopada pela RLS, opções derivadas dos próprios itens carregados"
    verification:
      - kind: unit
        ref: "tests/agenda/itens.test.ts#filtrarPorVendedor e #vendedoresDaAgenda"
        status: pass
    human_judgment: false
  - id: D4
    description: "getAgenda()/getAgendaPendentesCount() chamam agenda_do_vendedor() uma vez cada, sem filtro manual de responsável, sem reordenação, mesma fonte para lista e contagem (AGD-06)"
    requirement: "AGD-06"
    verification:
      - kind: other
        ref: "check estrutural do verify automatizado do Task 2: ausência de consulta direta a tarefas/visitas, ausência de .sort()/eq('responsavel'...)/any, presença de count:'exact',head:true na mesma chamada rpc('agenda_do_vendedor')"
        status: pass
    human_judgment: false
  - id: D5
    description: "getAgendaAction() devolve união discriminada, checa sessão antes de ler, e a mensagem de erro é exatamente a copy travada no UI-SPEC, sem nenhuma revalidação de cache"
    verification:
      - kind: other
        ref: "check estrutural do verify automatizado do Task 2: use server, união discriminada, códigos unauthenticated/fetch_falhou, copy exata, ausência de revalidatePath/revalidateTag/any"
        status: pass
    human_judgment: false
  - id: D6
    description: "npx tsc --noEmit e npm run lint limpos no projeto inteiro após os quatro arquivos novos"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (sem saída) e npm run lint (sem erros/avisos novos)"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min de trabalho ativo
completed: 2026-08-08
status: complete
---

# Phase 14 Plan 2: Agenda Unificada — Lógica e Leitura Tipada Summary

**Autoridade única de bucketing atrasado/hoje/próximos (`lib/agenda/itens.ts`, testada RED→GREEN com `date-fns`) mais o leitor tipado de `agenda_do_vendedor()` e a Server Action de leitura, ambos sem filtro manual de dono e com a mesma fonte para a lista e a contagem do selo.**

## Performance

- **Duration:** ~20 min de trabalho ativo
- **Started:** 2026-08-08T18:58:00Z (aprox.)
- **Completed:** 2026-08-08T19:19:00Z (aprox.)
- **Tasks:** 2 (ambos `auto`, Task 1 com `tdd="true"`)
- **Files modified:** 4 (todos novos)

## Accomplishments

- `lib/agenda/itens.ts` escrito depois de `tests/agenda/itens.test.ts` (RED confirmado — módulo inexistente falhava o import — depois GREEN com 14/14 casos passando): exporta `bucketDoItem`, `agruparAgenda`, `filtrarPorVendedor`, `vendedoresDaAgenda` e os tipos `AgendaOrigem`/`AgendaItem`/`AgendaBucket`/`AgendaAgrupada`, sem nenhum import de `@/lib/supabase/*`, `next/*` ou componentes
- Comparação de atraso feita com `differenceInCalendarDays` + `parseISO` do `date-fns`, provada estável em duas horas diferentes do mesmo dia (00h05 e 23h30) — mesma mitigação da Pitfall 1 (data crua com `new Date(string)`) já usada em `lib/funil/staleness.ts`
- `agruparAgenda` e `filtrarPorVendedor` provados por teste como não-reordenantes: uma lista deliberadamente fora de ordem alfabética/de data dentro do mesmo bucket volta na sequência exata de entrada; invariante de partição (`atrasado.length + hoje.length + proximos.length === total`) provada
- `vendedoresDaAgenda` provado ignorando itens sem `responsavel` ou sem `responsavelNome`, ordenando por nome com `localeCompare('pt-BR')`, sem repetição
- `lib/supabase/queries/agenda.ts` criado espelhando `lib/supabase/queries/dashboard.ts`: `getAgenda()` chama `agenda_do_vendedor()` uma única vez e mapeia snake_case → camelCase sem `.sort()`/`.filter()`/`.slice()`; `getAgendaPendentesCount()` usa `count: 'exact', head: true` sobre a MESMA rpc (AGD-06)
- `app/actions/agenda.ts` criado espelhando `app/actions/dashboard.ts`: `getAgendaAction()` checa `auth.getUser()`, devolve `{ error: { code: 'unauthenticated' } }` sem sessão, e captura falha de leitura devolvendo a copy exata `Não foi possível carregar sua agenda. Tente novamente.` — nenhum `revalidatePath`/`revalidateTag` no arquivo
- `npx tsc --noEmit` e `npm run lint` limpos após os quatro arquivos

## Task Commits

Each task was committed atomically:

1. **Task 1: `lib/agenda/itens.ts` — a autoridade única de atraso, repartição e filtro (puro, testado antes)** - `c555cd4` (feat, TDD RED→GREEN em um único commit pós-verde)
2. **Task 2: Leitor tipado da RPC e a Server Action de leitura** - `765aed4` (feat)

**Plan metadata:** commit deste SUMMARY.md (docs) — próximo commit desta sessão.

## Files Created/Modified

- `lib/agenda/itens.ts` - autoridade única de bucketing/repartição/filtro/opções de vendedor, dependency-free
- `tests/agenda/itens.test.ts` - 14 testes unitários puros (bucketDoItem, agruparAgenda, filtrarPorVendedor, vendedoresDaAgenda)
- `lib/supabase/queries/agenda.ts` - `getAgenda()`/`getAgendaPendentesCount()`, leitor tipado sobre `agenda_do_vendedor()`
- `app/actions/agenda.ts` - `getAgendaAction()`, Server Action de leitura em união discriminada

## Decisions Made

- `getAgendaPendentesCount()` implementado com `rpc('agenda_do_vendedor', undefined, { count: 'exact', head: true })` — a forma que o `14-01-SUMMARY.md` confirmou funcionar nesta versão do `supabase-js` contra uma função que retorna tabela, sem precisar do fallback de `(await getAgenda()).length`.
- REQUIREMENTS.md não foi editado neste plano: AGD-01/AGD-03/AGD-06 continuam "Pending" na tabela de rastreabilidade porque o comportamento visível (tela com as três seções, destaque visual, selo do menu) só existe depois dos planos 14-03/14-04 — mesmo precedente do 09-01 (requisito espalhado por vários planos fica Pending até o plano que entrega a UI, registrado no STATE.md).
- Três comentários de código precisaram de reformulação (sem mudar o significado) porque os checks estruturais automatizados do próprio plano usam regex simples que também batem em texto de comentário: `new Date(data)` → `new Date(...)`, "`.sort()`" → "método de ordenação de array", `revalidatePath`/`revalidateTag` citados literalmente → "revalidação de cache". Nenhuma mudança de comportamento, só de fraseado do comentário.

## Deviations from Plan

None - plan executado exatamente como escrito. Os três ajustes de fraseado de comentário (ver Decisions Made) são reformulações textuais para passar nos próprios checks mecânicos do plano, não desvios de comportamento ou escopo.

## Issues Encountered

None. `.env.local` não foi necessário neste plano — Task 1 é puro (sem Supabase) e o Task 2 só precisou de `tsc`/`lint` estruturais, sem executar contra o banco.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Camada de lógica e leitura da Agenda pronta: `lib/agenda/itens.ts` (puro), `lib/supabase/queries/agenda.ts` e `app/actions/agenda.ts` (leitura), todos testados/verificados, zero escrita, zero dependência npm nova.
- Plano 14-03 (tela) pode importar `bucketDoItem`/`agruparAgenda`/`filtrarPorVendedor`/`vendedoresDaAgenda` de `lib/agenda/itens.ts` direto num Client Component, e chamar `getAgendaAction()` para o fetch-on-mount.
- Plano 14-04 (menu/selo) pode chamar `getAgendaPendentesCount()` direto de um Server Component — mesma fonte de `getAgenda()`, contrato AGD-06 garantido.
- Nenhum bloqueio conhecido para os planos seguintes.

---
*Phase: 14-agenda-unificada*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: `lib/agenda/itens.ts`
- FOUND: `tests/agenda/itens.test.ts`
- FOUND: `lib/supabase/queries/agenda.ts`
- FOUND: `app/actions/agenda.ts`
- FOUND: commit `c555cd4` (Task 1)
- FOUND: commit `765aed4` (Task 2)
