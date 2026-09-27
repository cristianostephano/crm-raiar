---
phase: 29-encerrar-cliente-ativo
plan: 07
subsystem: ui
tags: [react, nextjs, server-actions, shadcn, dnd-kit-adjacent, encerrados]

# Dependency graph
requires:
  - phase: 29-encerrar-cliente-ativo (plano 29-05)
    provides: "lib/encerrados/lista.ts + app/actions/encerrados.ts (getClientesEncerradosAction, getMotivosEncerramento) — camada de dados desta tela"
  - phase: 29-encerrar-cliente-ativo (plano 29-04, concorrente)
    provides: "marcarStatus com frequência efetiva e reativação sem frequência não bloqueando (D-10/D-11/D-12) — commit 8676a2a, aterrissou durante este dispatch"
provides:
  - "components/encerrados/EncerradosItemRow.tsx — linha de cliente encerrado (nome/motivo/data/vendedor, botão Reativar 44px sem confirmação)"
  - "components/encerrados/EncerradosPeriodoFilter.tsx — filtro de período Tudo/30/90/Personalizado"
  - "components/encerrados/EncerradosList.tsx — tela dona: leitura via Server Action, período, busca, reativar"
  - "app/(app)/encerrados/page.tsx — rota /encerrados protegida"
  - "item 'Encerrados' no menu principal (components/layout/AppSidebar.tsx), ícone PauseCircle, sem contador"
affects: [30-ader-ncia-de-uso-no-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Componentes irmãos de Perdidos (Fase 28) em vez de generalização — components/encerrados/* espelha components/perdidos/* estruturalmente, zero import cruzado (Pitfall 4)"
    - "Reativar reusa marcarStatus(clienteId, 'ganho') existente — nenhuma ação nova criada (D-10)"

key-files:
  created:
    - components/encerrados/EncerradosItemRow.tsx
    - components/encerrados/EncerradosPeriodoFilter.tsx
    - components/encerrados/EncerradosList.tsx
    - app/(app)/encerrados/page.tsx
    - tests/funil/encerrados-item-row.test.tsx
    - tests/funil/encerrados-periodo-filter.test.tsx
    - tests/funil/encerrados-list.test.tsx
    - tests/funil/app-sidebar-encerrados.test.tsx
  modified:
    - components/layout/AppSidebar.tsx

key-decisions:
  - "Reativar chama marcarStatus(clienteId, 'ganho') diretamente — nenhuma ação de servidor nova (D-10); a frequência efetiva que faz o toque único funcionar mora em app/actions/funil.ts, entregue pelo plano 29-04"
  - "Texto de lista vazia corrigido para 'Nenhum cliente encerrado' (concordância), divergindo do UI-SPEC literal ('Nenhuma cliente encerrado'), por decisão de tela já registrada no PLAN"
  - "Aviso de falha do Reativar mostra a mensagem crua do servidor (não a cópia fixa do UI-SPEC §4), porque reativar sem frequência não gera mais erro desde 29-01/29-04 (conflitos_resolvidos 1)"

patterns-established: []

requirements-completed: [ENCR-04, ENCR-05]

coverage:
  - id: D1
    description: "Linha EncerradosItemRow (nome/motivo/data/vendedor, botão Reativar 44px sem janela de confirmação) e filtro EncerradosPeriodoFilter (Tudo/30/90/Personalizado)"
    requirement: "ENCR-05"
    verification:
      - kind: unit
        ref: "tests/funil/encerrados-item-row.test.tsx (10 casos), tests/funil/encerrados-periodo-filter.test.tsx (3 casos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "EncerradosList e rota /encerrados: leitura única via getClientesEncerradosAction, período, busca local, estados vazio/erro/carregando, Reativar via marcarStatus(clienteId, 'ganho') com releitura (sem remoção otimista)"
    requirement: "ENCR-05"
    verification:
      - kind: unit
        ref: "tests/funil/encerrados-list.test.tsx (9 casos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Item 'Encerrados' no menu principal (Vendedor e Supervisor), ícone PauseCircle, posição depois de Perdidos e antes de Dashboard, sem contador em nenhum estado"
    requirement: "ENCR-04"
    verification:
      - kind: unit
        ref: "tests/funil/app-sidebar-encerrados.test.tsx (6 casos)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Fluxo completo em produção (encerrar na Agenda -> some da Agenda -> aparece em Encerrados -> Reativar -> volta para a Agenda), incluindo o caso do cliente sem frequência gravada, e escopo por papel (Vendedor só vê os próprios)"
    verification: []
    human_judgment: true
    rationale: "Requer sessão real do Vendedor/Supervisor contra o banco de produção e a branch staging publicada (Fluxo de Deploy do CLAUDE.md); os testes unitários cobrem cada peça isoladamente com dados inventados, mas não o caminho ponta a ponta pelo navegador real."

duration: ~25min
completed: 2026-09-27
status: complete
---

# Phase 29 Plan 07: Tela Encerrados — Menu, Lista, Período e Reativar Summary

**3 componentes irmãos de Perdidos (EncerradosItemRow, EncerradosPeriodoFilter, EncerradosList), a rota `/encerrados` e o item "Encerrados" no menu principal (ícone PauseCircle, sem contador), com "Reativar" de um toque reusando `marcarStatus(clienteId, "ganho")`.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-26T23:56:00-03:00 (aprox.)
- **Completed:** 2026-09-27T00:07:00-03:00 (aprox.)
- **Tasks:** 3/3
- **Files modified:** 9 (8 criados, 1 alterado)

## Accomplishments

- `EncerradosItemRow` e `EncerradosPeriodoFilter`: componentes irmãos diretos da Fase 28 (Perdidos), sem nenhum import cruzado. A linha mostra só nome exibido/motivo/data/vendedor (LGPD) e o botão "Reativar" (44px, `RotateCcw`, sem janela de confirmação, D-09).
- `EncerradosList` + rota `/encerrados`: única leitura via `getClientesEncerradosAction` (29-05), filtro de período (Tudo/30/90/Personalizado), busca local sem nova leitura, todos os estados vazio/erro/carregando do UI-SPEC, e "Reativar" chamando `marcarStatus(clienteId, "ganho")` diretamente — nenhuma ação de servidor nova (D-10). A linha some pela releitura (`reloadKey`), nunca por remoção otimista.
- Item "Encerrados" no menu principal (`components/layout/AppSidebar.tsx`): ícone `PauseCircle`, posicionado depois de "Perdidos" e antes de "Dashboard", nunca recebe contador (mesma regra de "Perdidos") — verificado que os 3 testes de menu já existentes (`app-sidebar-perdidos`, `app-sidebar-agenda`, `importacao/AppSidebar`) continuam verdes SEM edição.
- `npm run build` concluído sem erro; a rota `/encerrados` aparece corretamente na árvore de rotas gerada (`ƒ /encerrados`).

## Task Commits

Cada tarefa TDD gerou um commit RED (test) e um GREEN (feat):

1. **Tarefa 1: EncerradosItemRow e EncerradosPeriodoFilter** — `93c0116` (test, RED) → `cc3d4da` (feat, GREEN)
2. **Tarefa 2: EncerradosList e rota /encerrados** — `3999b06` (test, RED) → `35edfbf` (feat, GREEN)
3. **Tarefa 3: Item "Encerrados" no menu** — `2205b6a` (test, RED) → `1874dbf` (feat, GREEN)

_Nota: os commits `3888ced` e `8676a2a` (plano 29-04, `feat(29-04): ...`) aparecem intercalados no histórico porque 29-04 rodou em paralelo no mesmo checkout (sem isolamento de worktree para este dispatch) — não pertencem a este plano._

## Files Created/Modified

- `components/encerrados/EncerradosItemRow.tsx` - Linha de cliente encerrado (nome/motivo/data/vendedor + botão Reativar 44px)
- `components/encerrados/EncerradosPeriodoFilter.tsx` - Select de período + Popover/Calendar de intervalo personalizado
- `components/encerrados/EncerradosList.tsx` - Tela dona: leitura, período, busca, estados, Reativar
- `app/(app)/encerrados/page.tsx` - Rota protegida `/encerrados`, deriva `isSupervisor`
- `components/layout/AppSidebar.tsx` - Entrada "Encerrados" em `PRINCIPAL_SECTION`, import `PauseCircle`
- `tests/funil/encerrados-item-row.test.tsx` - 10 testes
- `tests/funil/encerrados-periodo-filter.test.tsx` - 3 testes
- `tests/funil/encerrados-list.test.tsx` - 9 testes
- `tests/funil/app-sidebar-encerrados.test.tsx` - 6 testes

## Decisions Made

- Reativar chama `marcarStatus(clienteId, "ganho")` diretamente de `EncerradosList` — nenhuma ação de servidor nova criada, conforme D-10 e o comentário de cabeçalho já deixado em `app/actions/encerrados.ts` pelo plano 29-05.
- Texto de lista vazia usa "Nenhum cliente encerrado" (concordância corrigida), não o "Nenhuma cliente encerrado" literal do UI-SPEC — decisão de tela já registrada no PLAN (`<decisoes_de_tela>` item 5), mesmo padrão de "Nenhum cliente perdido".
- O aviso de falha do Reativar mostra a mensagem crua devolvida pelo servidor (não uma cópia fixa do UI-SPEC §4), porque a reativação sem frequência gravada não gera mais erro desde a resolução de conflito registrada em 29-01 e implementada por 29-04 (ver abaixo).

## Deviations from Plan

None - plan executado exatamente como escrito nas 3 tarefas.

## Issues Encountered

- Durante a Tarefa 3, `npx tsc --noEmit` reportou 3 erros em `tests/funil/reativar-guard.test.ts` ("Expected 2-5 arguments, but got 6"). Investigado e confirmado, via `git status`/`git log`, que esse arquivo e a edição em `app/actions/funil.ts` eram trabalho NÃO commitado do plano 29-04, rodando em paralelo no mesmo checkout (sem isolamento de worktree para este dispatch) — não relacionado a nenhum arquivo deste plano. Nenhuma ação foi tomada (fora do escopo desta tarefa, `SCOPE BOUNDARY`). Poucos minutos depois, 29-04 commitou `8676a2a` (`feat(29-04): marcarStatus com pre-checagens de encerrar, frequencia efetiva e revalidacao da Agenda`), e uma nova checagem de `npx tsc --noEmit` voltou limpa — o erro era transitório ao trabalho concorrente de outro plano, não um problema deste plano.
- **Dependência cruzada com 29-04 resolvida durante o dispatch:** o prompt deste plano avisava que a fiação do "Reativar" (`marcarStatus(clienteId, "ganho")`) dependia da correção de frequência efetiva do plano 29-04, ainda em andamento. Confirmado por commit (`8676a2a`, visível no `git log` ao final deste dispatch) que 29-04 já entregou essa correção antes do fechamento deste plano — a reativação, incluindo o caso do cliente sem frequência gravada (D-11/D-12), já está coberta pelo `marcarStatus` atual. Os testes unitários deste plano mockam `marcarStatus` inteiramente, então não dependiam dessa entrega para passar, mas o comportamento real em produção agora está alinhado.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Critério 4 da fase (encerrados achados num lugar próprio pelo menu, escopo por papel, filtro por período, Reativar de um toque) está implementado e coberto por 28 testes unitários novos (10+3+9+6), todos verdes, mais os 3 testes de menu pré-existentes confirmados sem regressão.
- `npm run build` concluiu sem erro — a rota `/encerrados` compila como Server Component e o Client Component `EncerradosList` não importa nenhum módulo de servidor.
- **Pendência explícita para o fechamento da fase (bloco human-check da Tarefa 2, não executado neste dispatch):** com a mudança publicada na branch `staging` (Fluxo de Deploy do CLAUDE.md), o dono do projeto precisa abrir o link de teste e confirmar, como Vendedor e como Supervisor, o fluxo ponta a ponta: encerrar um cliente ativo de teste na Agenda → ele some da Agenda e do menu → aparece em "Encerrados" com nome/motivo/data (sem contato) → "Reativar" funciona pelo celular sem pergunta → o cliente volta para a Agenda (com a frequência antiga, nova, ou "Sem dia fixo definido" se nunca teve frequência) → os números do Dashboard não mudam. Esse item de verificação humana está registrado como `D4` no bloco `coverage` acima (`human_judgment: true`) e não foi marcado como concluído.
- Não foi feito push para `master` nem para `staging` — a publicação segue o Fluxo de Deploy do CLAUDE.md no fechamento da fase, responsabilidade do orquestrador/dono do projeto, não deste plano.
- `npm test` completo NÃO foi executado neste dispatch (constraint explícita do orquestrador para este dispatch) — fica para o fechamento da fase, quando o custo de logins repetidos contra o Supabase Auth de teste pode ser avaliado de uma vez só.

## Self-Check: PASSED

Todos os 9 arquivos de `key-files` (8 criados + 1 modificado) + este SUMMARY.md confirmados no disco. Os 6 hashes de commit das 3 tarefas (93c0116, cc3d4da, 3999b06, 35edfbf, 2205b6a, 1874dbf) confirmados em `git log`.

---
*Phase: 29-encerrar-cliente-ativo*
*Completed: 2026-09-27*
