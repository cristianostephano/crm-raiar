---
phase: 31-agenda-2-visitas-manuais-na-lista
plan: "06"
subsystem: ui
tags: [react, nextjs, menu, agenda2]

requires:
  - phase: 31-agenda-2-visitas-manuais-na-lista
    plan: "04"
    provides: "getAgenda2PendentesCount() — contagem de pendentes do próprio usuário, filtro explícito de dono"
provides:
  - "Entrada 'Agenda 2' (/agenda-2, ícone NotebookPen) em PRINCIPAL_SECTION.links de AppSidebar, logo depois de Agenda"
  - "Prop agenda2Count em AppSidebarProps, reaproveitando byte a byte o renderizador de selo/bolinha já usado por Agenda"
  - "Segundo bloco try/catch independente em app/(app)/layout.tsx lendo getAgenda2PendentesCount(), fallback 0, nunca somado a agendaCount"
affects: [31-07, 31-08]

tech-stack:
  added: []
  patterns:
    - "AppLayout (Server Component async) testado chamando `await AppLayout({ children })` diretamente em vez de passar por um framework de rota — mesmo padrão agora disponível para qualquer teste futuro de layout"
    - "principalSectionComContagem.map vira um if/else em cadeia (em vez de um único ternário) assim que um segundo item (Agenda 2) também precisa de badgeCount — padrão a repetir se um terceiro item algum dia precisar de selo"

key-files:
  created:
    - tests/agenda2/app-sidebar-agenda2.test.tsx
    - tests/agenda2/app-layout-contagem.test.tsx
  modified:
    - components/layout/AppSidebar.tsx
    - app/(app)/layout.tsx
    - tests/agenda/app-sidebar-agenda.test.tsx
    - tests/funil/app-sidebar-perdidos.test.tsx
    - tests/funil/app-sidebar-encerrados.test.tsx
    - tests/layout/app-sidebar-visual.test.tsx
    - tests/importacao/AppSidebar.test.tsx

key-decisions:
  - "tests/agenda2/app-layout-contagem.test.tsx testa o Server Component AppLayout chamando-o diretamente como função async (`await AppLayout({ children })`) e renderizando o JSX devolvido dentro de TooltipProvider — não havia precedente no projeto de testar um layout.tsx inteiro (só queries/actions mockando @/lib/supabase/server), mas é a forma mais direta de provar o isolamento dos dois try/catch sem subir um servidor Next.js real"
  - "tests/importacao/AppSidebar.test.tsx não tem um helper renderSidebar (cada caso chama <AppSidebar .../> inline) — agenda2Count={0} foi adicionado em cada uma das 6 renderizações inline, em vez de extrair um helper novo (fora do escopo deste plano, que é só ajustar a prop)"

patterns-established: []

requirements-completed: [AGD2-06]

coverage:
  - id: D1
    description: "'Agenda 2' aparece no menu principal logo depois de 'Agenda' e antes de 'Clientes', mesma ordem para Vendedor e Supervisor (D-15)"
    requirement: "AGD2-06"
    verification:
      - kind: unit
        ref: "tests/agenda2/app-sidebar-agenda2.test.tsx#ordem-d15"
        status: pass
      - kind: unit
        ref: "tests/agenda/app-sidebar-agenda.test.tsx#ordem"
        status: pass
      - kind: unit
        ref: "tests/funil/app-sidebar-perdidos.test.tsx#ordem"
        status: pass
      - kind: unit
        ref: "tests/funil/app-sidebar-encerrados.test.tsx#ordem"
        status: pass
    human_judgment: false
  - id: D2
    description: "Selo expandido ('Agenda 2, N itens pendentes') e bolinha recolhida (data-slot agenda-pendente-dot) reaproveitam o mesmo tratamento visual de Agenda, sem classe nova; contagens de Agenda e Agenda 2 nunca se misturam (D-12/D-14)"
    requirement: "AGD2-06"
    verification:
      - kind: unit
        ref: "tests/agenda2/app-sidebar-agenda2.test.tsx#contagem"
        status: pass
      - kind: unit
        ref: "tests/agenda2/app-sidebar-agenda2.test.tsx#contagens-independentes"
        status: pass
      - kind: unit
        ref: "tests/agenda2/app-sidebar-agenda2.test.tsx#zero"
        status: pass
      - kind: unit
        ref: "tests/agenda2/app-sidebar-agenda2.test.tsx#recolhido-bolinha"
        status: pass
      - kind: unit
        ref: "tests/agenda2/app-sidebar-agenda2.test.tsx#ativo-sem-confusao"
        status: pass
      - kind: unit
        ref: "tests/agenda2/app-sidebar-agenda2.test.tsx#icone-distinto"
        status: pass
    human_judgment: false
  - id: D3
    description: "A contagem da Agenda 2 no layout é um bloco try/catch independente do da Agenda: uma falha em uma nunca derruba a outra nem a área logada inteira (T-31-27)"
    requirement: "AGD2-06"
    verification:
      - kind: unit
        ref: "tests/agenda2/app-layout-contagem.test.tsx#contagens-separadas"
        status: pass
      - kind: unit
        ref: "tests/agenda2/app-layout-contagem.test.tsx#falha-agenda2-nao-derruba"
        status: pass
      - kind: unit
        ref: "tests/agenda2/app-layout-contagem.test.tsx#falha-agenda-nao-afeta-agenda2"
        status: pass
    human_judgment: false

duration: ~6min
completed: 2026-10-01
status: complete
---

# Phase 31 Plan 6: Entrada "Agenda 2" no Menu Principal Summary

**AppSidebar ganha a entrada "/agenda-2" (ícone NotebookPen) logo depois de "Agenda", com selo/bolinha reaproveitados byte a byte e uma segunda contagem isolada em app/(app)/layout.tsx — 7 testes de menu existentes ajustados para a nova ordem D-15.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-10-01T10:56:17-03:00
- **Completed:** 2026-10-01T11:02:12-03:00
- **Tasks:** 3
- **Files modified:** 9 (2 criados, 7 alterados)

## Accomplishments
- `components/layout/AppSidebar.tsx`: `PRINCIPAL_SECTION.links` ganha `{ href: "/agenda-2", label: "Agenda 2", icon: NotebookPen }` logo depois de `/agenda`, antes de `/clientes` (D-15); `AppSidebarProps` ganha `agenda2Count: number`, documentado no mesmo tom de `agendaCount`; `principalSectionComContagem` agora distribui `badgeCount` para `/agenda` E `/agenda-2` (if/else em cadeia, já que um único ternário não comporta um terceiro destino); o renderizador de selo/bolinha (loop `section.links.map`), as classes CSS, `isActive` e a seção Administração não mudaram uma linha.
- `app/(app)/layout.tsx`: um segundo bloco `try { agenda2Count = await getAgenda2PendentesCount() } catch { agenda2Count = 0 }`, irmão e independente do bloco já existente da Agenda — uma falha na contagem nova nunca derruba a contagem antiga nem a área logada inteira (T-31-27); `agenda2Count` repassado ao `AppSidebar`.
- `tests/agenda2/app-sidebar-agenda2.test.tsx` (8 casos): ordem D-15 (Vendedor e Supervisor), href do link, selo com contagem (D-12), duas contagens coexistindo sem se misturar, zero não renderiza selo nem "Agenda 2 (0)", bolinha recolhida única e ancorada no ícone (D-14), item ativo em `/agenda-2` sem marcar `/agenda` como ativo, ícone `lucide-notebook-pen` distinto do de `/agenda`.
- `tests/agenda2/app-layout-contagem.test.tsx` (3 casos): chama `AppLayout({ children })` diretamente como Server Component async, mockando `@/lib/supabase/server`, `@/lib/supabase/queries/agenda` e `@/lib/supabase/queries/agenda2` — prova que as duas contagens aparecem separadas, que uma falha na Agenda 2 não derruba o conteúdo filho nem o selo da Agenda, e que uma falha na Agenda não afeta o selo da Agenda 2.
- Os 5 testes de menu já existentes (`tests/agenda/app-sidebar-agenda.test.tsx`, `tests/funil/app-sidebar-perdidos.test.tsx`, `tests/funil/app-sidebar-encerrados.test.tsx`, `tests/layout/app-sidebar-visual.test.tsx`, `tests/importacao/AppSidebar.test.tsx`) passam a enviar `agenda2Count={0}` em toda renderização de `AppSidebar`; os três casos "ordem" (agenda/perdidos/encerrados) passam a esperar `/agenda-2` logo depois de `/agenda`. Nenhuma asserção pré-existente foi removida (mesmo número de `it(` em cada arquivo, confirmado antes/depois da edição).

## Task Commits

Each task was committed atomically:

1. **Tarefa 1 RED: testes do item Agenda 2 no menu** - `c2c3eb1` (test)
2. **Tarefa 1 GREEN: item Agenda 2 no menu** - `72d4814` (feat)
3. **Tarefa 2 RED: testes da contagem da Agenda 2 no layout** - `791611f` (test)
4. **Tarefa 2 GREEN: contagem da Agenda 2 no layout** - `623829d` (feat)
5. **Tarefa 3: ajuste dos 5 testes de menu existentes** - `bb79523` (test)

**Plan metadata:** pending (this commit)

_Nota: as 2 tarefas TDD (Tarefas 1 e 2) resultaram em 4 commits — não houve necessidade de commit REFACTOR em nenhuma delas; o código ficou verde já na primeira versão escrita. A Tarefa 3 é só ajuste de teste (`type="auto"`, sem `tdd="true"` no plano), por isso um único commit `test`._

## Files Created/Modified
- `components/layout/AppSidebar.tsx` - entrada "Agenda 2" (/agenda-2, NotebookPen) + prop `agenda2Count`
- `app/(app)/layout.tsx` - segundo bloco try/catch lendo `getAgenda2PendentesCount()`
- `tests/agenda2/app-sidebar-agenda2.test.tsx` - 8 testes novos do item no menu
- `tests/agenda2/app-layout-contagem.test.tsx` - 3 testes novos da contagem isolada no layout
- `tests/agenda/app-sidebar-agenda.test.tsx` - `agenda2Count={0}` + ordem D-15
- `tests/funil/app-sidebar-perdidos.test.tsx` - `agenda2Count={0}` + ordem D-15
- `tests/funil/app-sidebar-encerrados.test.tsx` - `agenda2Count={0}` + ordem D-15
- `tests/layout/app-sidebar-visual.test.tsx` - `agenda2Count={0}`
- `tests/importacao/AppSidebar.test.tsx` - `agenda2Count={0}` nas 6 renderizações inline

## Decisions Made
- `tests/agenda2/app-layout-contagem.test.tsx` testa `AppLayout` chamando-o diretamente como função async (`await AppLayout({ children })`) e renderizando o JSX devolvido dentro de `TooltipProvider`, em vez de qualquer harness de rota do Next.js — não havia precedente disso no projeto (os testes de Server Component existentes mockam só `queries`/`actions`, nunca um `layout.tsx` inteiro), mas é a forma mais direta de provar que os dois blocos `try/catch` são de fato independentes um do outro.
- `tests/importacao/AppSidebar.test.tsx` não tem um helper `renderSidebar` (cada caso renderiza `<AppSidebar />` inline) — `agenda2Count={0}` foi adicionado em cada uma das 6 renderizações em vez de introduzir um helper novo, para não ampliar o escopo deste plano (que é só "ajustar a prop").

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - mudança de componente/layout, sem configuração de serviço externo. A tela real em `/agenda-2` (plano 31-08) ainda não existe — o link no menu aponta para uma rota que só passa a resolver depois desse plano; isso é esperado e não bloqueia este plano (o contrato é só o item do menu, não a tela).

## Alerta de Conformidade (LGPD)

Conforme instrução organizacional: este plano não lê nem exibe nenhum dado pessoal novo — `getAgenda2PendentesCount()` (já implementado e com filtro explícito de dono no plano 31-04) só devolve um número. O layout e o menu apenas repassam esse número adiante; nenhuma mudança neste plano altera superfície de dado pessoal, exportação ou retenção.

## Next Phase Readiness
- O item "Agenda 2" no menu está pronto e visível para Vendedor e Supervisor, com selo/bolinha funcionando a partir da contagem real do plano 31-04.
- O link aponta para `/agenda-2`, que só existirá de fato depois do plano 31-08 (a tela da Lista) — até lá, clicar no item leva a uma rota 404, comportamento esperado e sem bloqueio de código para os planos seguintes (31-07 formulário, 31-08 tela).
- Nenhum bloqueio técnico identificado para os próximos planos da fase.

---
*Phase: 31-agenda-2-visitas-manuais-na-lista*
*Completed: 2026-10-01*

## Self-Check: PASSED

- FOUND: components/layout/AppSidebar.tsx
- FOUND: app/(app)/layout.tsx
- FOUND: tests/agenda2/app-sidebar-agenda2.test.tsx
- FOUND: tests/agenda2/app-layout-contagem.test.tsx
- FOUND commit: c2c3eb1 (Tarefa 1 RED)
- FOUND commit: 72d4814 (Tarefa 1 GREEN)
- FOUND commit: 791611f (Tarefa 2 RED)
- FOUND commit: 623829d (Tarefa 2 GREEN)
- FOUND commit: bb79523 (Tarefa 3)
- Re-ran `npx vitest run tests/agenda/app-sidebar-agenda.test.tsx tests/layout tests/funil/app-sidebar-perdidos.test.tsx tests/funil/app-sidebar-encerrados.test.tsx tests/importacao/AppSidebar.test.tsx tests/agenda2/app-sidebar-agenda2.test.tsx tests/agenda2/app-layout-contagem.test.tsx` — 46/46 passed
- Re-ran `npx tsc --noEmit` — clean
- Re-ran `npx eslint` on all touched files — clean
