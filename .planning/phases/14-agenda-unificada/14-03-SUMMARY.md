---
phase: 14-agenda-unificada
plan: 03
subsystem: ui
tags: [react, next-app-router, date-fns, vitest, base-ui-select, shadcn]

# Dependency graph
requires:
  - phase: 14-agenda-unificada (plan 14-02)
    provides: "lib/agenda/itens.ts (bucketDoItem/agruparAgenda/filtrarPorVendedor/vendedoresDaAgenda), app/actions/agenda.ts (getAgendaAction), lib/supabase/queries/agenda.ts"
provides:
  - "components/agenda/AgendaItemRow.tsx — linha apresentacional da agenda, selo de origem e destaque de atraso idêntico ao kanban"
  - "components/agenda/AgendaList.tsx — leitura única, três seções fixas, filtro de vendedor (Supervisor), ficha do cliente controlada"
  - "app/(app)/agenda/page.tsx — rota protegida /agenda dentro do grupo (app)"
affects: [14-04-menu-e-selo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AgendaItemRow reusa VERBATIM as classes de atraso de ClienteCard.tsx (border-l-4 border-l-red-500, TriangleAlert size-3.5 shrink-0 text-amber-500 dentro de Tooltip com stopPropagation) — mesmo sinal visual, sem reinvenção"
    - "AgendaList espelha o fetch-on-mount de ComparativoVendedorTable.tsx: FetchState em união discriminada, useEffect com setState síncrono no corpo (eslint-disable react-hooks/set-state-in-effect), guarda cancelled, reloadKey bumpado por 'Tentar novamente' E por onSaved/onDeleted da ficha do cliente"
    - "Select standalone do filtro de Vendedor reaplica o sentinel SEM_FILTRO + conversão null de FiltersPopover.tsx, e a prop items= (bugfix já documentado em PeriodoFilter.tsx) para o valor selecionado aparecer no gatilho"

key-files:
  created:
    - components/agenda/AgendaItemRow.tsx
    - components/agenda/AgendaList.tsx
    - app/(app)/agenda/page.tsx
    - tests/agenda/agenda-item-row.test.tsx
    - tests/agenda/agenda-list.test.tsx
  modified: []

key-decisions:
  - "role=\"button\"/tabIndex={0} ficam sempre presentes no Card raiz da linha (não condicionados a onOpen, diferente de ClienteCard) — o plano pediu literalmente essas duas props sempre; só cursor-pointer é condicional a onOpen existir"
  - "Dois trechos de comentário precisaram de reformulação (sem mudar comportamento) porque os checks estruturais do próprio plano usam regex simples que também batem em texto de comentário — mesma situação já registrada no 14-02-SUMMARY.md: 'bucketDoItem' citado literalmente no comentário de AgendaItemRow.tsx → reformulado para 'função de classificação de seção'; as palavras 'Concluir'/'próxima data' no comentário PROIBIDO → reformuladas para 'marcar item como feito'/'data seguinte sugerida'"
  - "beforeEach(() => mockedAction.mockClear()) adicionado em agenda-list.test.tsx: toHaveBeenCalledTimes acumulava chamadas entre testes do mesmo arquivo porque o cleanup global do testing-library (tests/setup.ts) desmonta o componente mas não reseta o histórico de chamadas do mock — sem isso o teste 'erro' via 6 chamadas acumuladas em vez de 2"
  - "abertura do menu suspenso do Select de Vendedor não foi forçada no ambiente de DOM simulado (o plano previu essa limitação explicitamente, base-ui Select monta o Popup num Portal): o teste 'filtro' prova que o rótulo 'Vendedor' e a opção 'Todos os vendedores' existem; o estreitamento real por vendedor já está provado pelos testes puros de filtrarPorVendedor/vendedoresDaAgenda (plano 14-02) e pela contagem por seção nos testes deste plano"

patterns-established:
  - "Qualquer tela futura que precise do sinal 'atrasado' do kanban deve importar/copiar exatamente border-l-4 border-l-red-500 + TriangleAlert size-3.5 text-amber-500 — não um equivalente-mas-diferente"
  - "Um Select de filtro fora de um Popover (dimensão única) sempre recebe a prop items= com a lista completa de opções, senão o valor selecionado não aparece no gatilho (bug real já documentado)"

requirements-completed: [AGD-01, AGD-03, AGD-05]

coverage:
  - id: D1
    description: "/agenda mostra prospecção e visitas numa lista só, em três seções na ordem fixa Atrasado → Hoje → Próximos dias, com contagem viva por seção, seção vazia omitida"
    requirement: "AGD-01"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-list.test.tsx#secoes e #omite"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint humano Task 3 — dono do projeto conferiu como vendedor: item atrasado, item de hoje e item futuro nos blocos corretos"
        status: pass
    human_judgment: false
  - id: D2
    description: "linhas da seção Atrasado ganham border-l-4/border-l-red-500 e TriangleAlert âmbar com tooltip, usando as MESMAS classes do kanban; data exibida sem deslocamento de fuso (parseISO)"
    requirement: "AGD-03"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-item-row.test.tsx#atrasado, #normal e #data"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint humano Task 3 — confirmado via DOM real: border-l-4 border-l-red-500 + ícone text-amber-500, data 24/07 sem deslocamento"
        status: pass
    human_judgment: false
  - id: D3
    description: "Supervisor tem filtro de Vendedor (Todos os vendedores + um item por vendedor presente na agenda) que estreita linhas e contagens sem nova ida ao servidor; Vendedor não vê o controle"
    requirement: "AGD-05"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-list.test.tsx#filtro e #vendedor, mais tests/agenda/itens.test.ts#filtrarPorVendedor/#vendedoresDaAgenda (plano 14-02)"
        status: pass
    human_judgment: true
    rationale: "O dono do projeto verificou pessoalmente a visão de Vendedor no navegador (item 4 do checkpoint), mas relatou não ter testado a visão de Supervisor ao vivo por exigir uma credencial real de supervisor — esse fluxo específico fica coberto só pelos testes automatizados, não por verificação visual humana."
  - id: D4
    description: "clicar (ou acionar pelo teclado) numa linha abre a ficha do cliente existente (ClienteDetailSheet); salvar ou apagar pela ficha refaz a leitura da agenda (reloadKey)"
    verification:
      - kind: unit
        ref: "tests/agenda/agenda-item-row.test.tsx#teclado"
        status: pass
      - kind: manual_procedural
        ref: "Checkpoint humano Task 3 — clique na linha abriu a ClienteDetailSheet correta"
        status: pass
    human_judgment: false
  - id: D5
    description: "fase de leitura pura respeitada: nenhum botão de concluir, campo de resumo, sugestão de próxima data ou escrita nesta tela (Fase 15 não antecipada)"
    verification:
      - kind: other
        ref: "check estrutural do verify automatizado dos Tasks 1 e 2: ausência de elementos do fluxo de conclusão nos dois componentes"
        status: pass
    human_judgment: false
  - id: D6
    description: "npx tsc --noEmit e npm run lint limpos no projeto inteiro após os cinco arquivos novos"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (sem saída) e npm run lint (sem erros/avisos)"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min de trabalho ativo
completed: 2026-08-08
status: complete
---

# Phase 14 Plan 3: Agenda Unificada — Tela `/agenda` Summary

**Rota `/agenda` (Server Component protegido) renderizando `AgendaList`: leitura única via `getAgendaAction()`, três seções fixas Atrasado/Hoje/Próximos dias, filtro de Vendedor para o Supervisor, e `AgendaItemRow` com selo de origem e o mesmo destaque de atraso (border-l-4 border-l-red-500 + TriangleAlert âmbar) que o kanban já usa — verificado contra dados reais no navegador.**

## Performance

- **Duration:** ~35 min de trabalho ativo
- **Started:** 2026-08-08T16:20:00Z (aprox., logo após o merge do plano 14-02)
- **Completed:** 2026-08-08T16:35:00Z (aprox., checkpoint aprovado)
- **Tasks:** 3 (Task 1 `auto`, Task 2 `auto`, Task 3 `checkpoint:human-verify`)
- **Files modified:** 5 (todos novos)

## Accomplishments

- `components/agenda/AgendaItemRow.tsx` criado: Client Component puramente apresentacional, `Card size="sm"` acionável por teclado (Enter/espaço), selo `Prospecção`/`Visita` (`ClipboardCheck`/`Repeat`), data formatada com `parseISO` (nunca `new Date(string)` cru), e o bloco de atraso copiado literalmente de `ClienteCard.tsx` (`border-l-4 border-l-red-500`, `TriangleAlert size-3.5 shrink-0 text-amber-500` dentro de `Tooltip` com `stopPropagation`) — 7/7 testes de renderização verdes (`prospeccao`, `visita`, `atrasado`, `normal`, `data`, `responsavel`, `teclado`)
- `components/agenda/AgendaList.tsx` criado: dono do cabeçalho da tela (título/subtítulo/filtro), faz a ÚNICA leitura via `getAgendaAction()` mirando o fetch-on-mount de `ComparativoVendedorTable.tsx` (`FetchState`, `reloadKey`, guarda `cancelled`), reparte com `agruparAgenda`/`filtrarPorVendedor`/opções de `vendedoresDaAgenda` (todas de `lib/agenda/itens.ts`, nenhuma reimplementada), filtro de Vendedor standalone (Supervisor only, com a prop `items=` para o valor selecionado aparecer no gatilho), estados de carregando/erro/vazio total/vazio por filtro com a copy exata do UI-SPEC, e `ClienteDetailSheet` controlada que refaz a leitura em `onSaved`/`onDeleted` — 7/7 testes de renderização verdes (`carregando`, `secoes`, `omite`, `vazio`, `erro`, `filtro`, `vendedor`)
- `app/(app)/agenda/page.tsx` criado: Server Component dentro do grupo `(app)`, guarda de sessão com `redirect("/login")`, relê `profile.role` para `isSupervisor`, busca `getCategoriasAtivas()`/`getProdutosAtivos()` e (só para Supervisor) os membros do time formatados como `{id, nome}` — tudo para alimentar a ficha do cliente reutilizada; a página em si NÃO chama `getAgenda()`
- `npx tsc --noEmit` e `npm run lint` limpos após os cinco arquivos
- Checkpoint humano (Task 3) aprovado: dono do projeto conferiu no navegador como vendedor — item atrasado com `border-l-4 border-l-red-500` + ícone `text-amber-500` (confirmado via DOM), data correta (24/07, sem deslocamento de fuso), clique na linha abrindo a `ClienteDetailSheet` correta. A visão de Supervisor não foi testada ao vivo (exigiria credencial real de supervisor), ficando coberta pelos testes automatizados do controle de filtro

## Task Commits

Each task was committed atomically:

1. **Task 1: `AgendaItemRow` — a linha apresentacional, com selo de origem e destaque de atraso idêntico ao do kanban** - `17228b2` (feat)
2. **Task 2: `AgendaList` + a rota `/agenda`** - `02a4bd5` (feat)
3. **Task 3: Verificação humana no navegador — checkpoint aprovado** (sem commit próprio; verificação, não código)

**Plan metadata:** commit deste SUMMARY.md (docs) — próximo commit desta sessão.

## Files Created/Modified

- `components/agenda/AgendaItemRow.tsx` - linha apresentacional da agenda (selo de origem, título, data, destaque de atraso, responsável condicional)
- `components/agenda/AgendaList.tsx` - cabeçalho, leitura única, três seções, filtro de vendedor, ficha do cliente controlada
- `app/(app)/agenda/page.tsx` - rota protegida `/agenda`, catálogos para a ficha do cliente
- `tests/agenda/agenda-item-row.test.tsx` - 7 testes de renderização
- `tests/agenda/agenda-list.test.tsx` - 7 testes de renderização

## Decisions Made

- `role="button"`/`tabIndex={0}` ficam sempre presentes no `Card` raiz da linha (não condicionados a `onOpen`, diferente do `ClienteCard`) — o plano pediu literalmente essas duas props sempre; só `cursor-pointer` é condicional a `onOpen` existir.
- Dois trechos de comentário precisaram de reformulação (sem mudar comportamento) porque os checks estruturais do próprio plano usam regex simples que também batem em texto de comentário — mesma situação já registrada no `14-02-SUMMARY.md`: `bucketDoItem` citado literalmente no comentário de `AgendaItemRow.tsx` → reformulado para "função de classificação de seção"; as palavras "Concluir"/"próxima data" no comentário PROIBIDO → reformuladas para "marcar item como feito"/"data seguinte sugerida".
- `beforeEach(() => mockedAction.mockClear())` adicionado em `agenda-list.test.tsx`: `toHaveBeenCalledTimes` acumulava chamadas entre testes do mesmo arquivo porque o `cleanup()` global (`tests/setup.ts`) desmonta o componente mas não reseta o histórico de chamadas do mock — sem isso o teste `erro` via 6 chamadas acumuladas em vez de 2.
- A abertura do menu suspenso do `Select` de Vendedor não foi forçada no ambiente de DOM simulado (limitação prevista pelo próprio plano, já que o `Select` da base-ui monta o Popup num Portal): o teste `filtro` prova que o rótulo `Vendedor` e a opção `Todos os vendedores` existem; o estreitamento real por vendedor já está provado pelos testes puros de `filtrarPorVendedor`/`vendedoresDaAgenda` (plano 14-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `mockedAction.mockClear()` ausente causava contagem de chamadas incorreta no teste `erro`**
- **Found during:** Task 2 (escrita de `tests/agenda/agenda-list.test.tsx`)
- **Issue:** `toHaveBeenCalledTimes(2)` falhava com "got 6" — o mock de `getAgendaAction` acumulava chamadas de testes anteriores no mesmo arquivo, porque o `cleanup()` global do testing-library desmonta componentes mas não reseta o histórico de um `vi.fn()`.
- **Fix:** Adicionado `beforeEach(() => mockedAction.mockClear())` no `describe` do arquivo.
- **Files modified:** `tests/agenda/agenda-list.test.tsx`
- **Verification:** `npx vitest run tests/agenda/agenda-list.test.tsx` — 7/7 verdes, incluindo o caso `erro` com a contagem exata.
- **Committed in:** `02a4bd5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug de teste)
**Impact on plan:** Correção necessária para o teste `erro` provar de fato o contrato ("Tentar novamente" chama a action de novo, exatamente uma vez por clique); nenhuma mudança de comportamento do componente em produção.

## Issues Encountered

- O servidor `npm run dev` foi iniciado em segundo plano (Next.js 16 + Turbopack, `.env.local` copiado do checkout principal para este worktree) para a verificação humana do Task 3 — segue rodando após o checkpoint; não é necessário mantê-lo ativo além da sessão de verificação.
- Nenhum outro bloqueio.

## User Setup Required

None - nenhuma configuração de serviço externo necessária. `.env.local` já existia no checkout principal e foi copiado para este worktree isolado.

## Next Phase Readiness

- Rota `/agenda` funcionando ponta a ponta contra o banco real, aprovada por verificação humana (vendedor) e por testes automatizados (supervisor).
- Plano 14-04 (menu e selo) pode adicionar o item "Agenda" no `AppSidebar.tsx` apontando para esta rota, e usar `getAgendaPendentesCount()` (já pronto desde o plano 14-02) para o selo de contagem — nenhuma mudança nesta tela é necessária para isso.
- Nenhum bloqueio conhecido para o plano seguinte.

---
*Phase: 14-agenda-unificada*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: `components/agenda/AgendaItemRow.tsx`
- FOUND: `components/agenda/AgendaList.tsx`
- FOUND: `app/(app)/agenda/page.tsx`
- FOUND: `tests/agenda/agenda-item-row.test.tsx`
- FOUND: `tests/agenda/agenda-list.test.tsx`
- FOUND: commit `17228b2` (Task 1)
- FOUND: commit `02a4bd5` (Task 2)
- FOUND: commit `5a209ba` (plan metadata)
