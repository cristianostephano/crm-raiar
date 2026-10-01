---
phase: 31-agenda-2-visitas-manuais-na-lista
plan: "08"
subsystem: ui
tags: [react, typescript, shadcn, agenda2, nextjs]

requires:
  - phase: 31-agenda-2-visitas-manuais-na-lista
    plan: "02"
    provides: "Agenda2Item, agruparAgenda2, itensDaListaAgenda2, vendedoresDaAgenda2 (lib/agenda2/itens.ts)"
  - phase: 31-agenda-2-visitas-manuais-na-lista
    plan: "04"
    provides: "getAgenda2Action, criarAgenda2Item, atualizarAgenda2Item, apagarAgenda2Item, concluirAgenda2Item, desmarcarAgenda2Item (app/actions/agenda2.ts)"
  - phase: 31-agenda-2-visitas-manuais-na-lista
    plan: "05"
    provides: "Agenda2ItemRow, Agenda2ApagarDialog (components/agenda2/)"
  - phase: 31-agenda-2-visitas-manuais-na-lista
    plan: "07"
    provides: "Agenda2ItemForm (components/agenda2/Agenda2ItemForm.tsx)"
provides:
  - "components/agenda2/Agenda2List.tsx — tela da Agenda 2: leitura, seções Atrasado/Hoje/Próximos dias, visibilidade dos concluídos, filtro por vendedor, ações do vendedor (adicionar/editar/apagar/concluir/desmarcar), somente-leitura do Supervisor"
  - "app/(app)/agenda-2/page.tsx — rota /agenda-2 (Server Component) com guarda de sessão e leitura só do próprio role"
  - "tests/agenda2/agenda2-list.test.tsx — 18 casos verdes cobrindo todos os critérios de sucesso 1-4 do ROADMAP da Fase 31"
affects: []

tech-stack:
  added: []
  patterns:
    - "Agenda2List reusa o MESMO esqueleto de fetch-on-mount de AgendaList.tsx (FetchState em união discriminada, setState síncrono no corpo do efeito com supressão de lint, guarda cancelled, reloadKey) — nenhuma segunda forma de leitura é inventada para a Agenda 2"
    - "Nenhuma decisão de negócio duplicada: seções/visibilidade vêm de lib/agenda2/itens.ts, o estreitamento por vendedor reusa filtrarPorVendedor de lib/agenda/itens.ts sem alteração — a Lista só compõe, nunca recalcula"
    - "Esconder os botões de escrita quando isSupervisor é só reflexo visual (D-16); a fronteira real continua sendo a RLS assimétrica da migration 0048 — nenhuma checagem de permissão vive neste componente"

key-files:
  created:
    - components/agenda2/Agenda2List.tsx
    - "app/(app)/agenda-2/page.tsx"
    - tests/agenda2/agenda2-list.test.tsx
  modified: []

key-decisions:
  - "Agenda2Page não busca categorias/produtos/motivos de conclusão nem a lista de membros da equipe (diferente de /agenda) — minimização LGPD (T-31-34): as opções do filtro de vendedor derivam dos próprios itens que a RLS já liberou (vendedoresDaAgenda2, dentro de Agenda2List), nunca de uma consulta separada a profiles"
  - "Agenda2ApagarDialog.onConfirmar não seta erroAcao em falha — o próprio diálogo já mostra o erro genérico internamente (31-05); handleConfirmarApagar só devolve o booleano do contrato"
  - "Header sem subtítulo (diferente de AgendaList, que tem 'O que você precisa fazer...') — o UI-SPEC desta fase só especifica o h1 'Agenda 2', e D-11 pede explicitamente nenhum extra além do que está especificado"

patterns-established: []

requirements-completed: [AGD2-01, AGD2-03, AGD2-04, AGD2-05, AGD2-07]

coverage:
  - id: D1
    description: "Agenda2List: leitura via getAgenda2Action, três seções Atrasado(n)/Hoje(n)/Próximos dias(n) nessa ordem, sem reordenar itens (D-01/D-08)"
    requirement: "AGD2-01"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#agrupa-secoes"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#ordem-preservada"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#carregando-e-erro"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#titulo"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cartão atrasado destacado (border-l-red-500) e concluído de hoje/futuro riscado e visível; concluído de dia passado só visível se alterado hoje (D-02/D-04, correção 7 do 31-01)"
    requirement: "AGD2-05"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#atrasado-destacado"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#concluido-hoje-riscado"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#concluido-passado-oculto"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ações do vendedor: adicionar (cabeçalho e estado vazio), editar (inclusive concluído, D-06), apagar com confirmação (AGD2-04), concluir e desmarcar (D-05), todas recarregando a Lista; falha de ação mostra erro genérico"
    requirement: "AGD2-04"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#vazio-vendedor"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#adicionar-pelo-cabecalho"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#concluir-recarrega"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#desmarcar-recarrega"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#apagar-com-confirmacao"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#editar-concluido"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#falha-acao"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visão do Supervisor: filtro Vendedor aberto em Todos os vendedores, nome do vendedor em cada linha, filtragem funcional, e NENHUM botão de escrita (D-16/D-17/D-18); vazio do time sem CTA; sem busca/exportação/calendário (D-11)"
    requirement: "AGD2-07"
    verification:
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#supervisor-filtro"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#supervisor-somente-leitura"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#supervisor-vazio"
        status: pass
      - kind: unit
        ref: "tests/agenda2/agenda2-list.test.tsx#sem-busca-e-extras"
        status: pass
    human_judgment: false
  - id: D5
    description: "Critério 5 do ROADMAP: nenhum arquivo da Agenda atual (components/agenda, lib/agenda, queries/actions da agenda, rota /agenda) mudou desde 071871f; rota /agenda-2 compila, tsc/lint/build limpos"
    verification:
      - kind: other
        ref: "node -e checagem git diff/status contra 071871f (ver bloco <git_diff_proof> abaixo)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit"
        status: pass
      - kind: other
        ref: "npm run lint"
        status: pass
      - kind: other
        ref: "npm run build"
        status: pass
    human_judgment: true
    rationale: "Verificação humana ponta a ponta com o banco real (riscado, selo do menu, calendário do formulário) ainda pendente — os testes de componente usam ações mockadas, conforme o human-check do 31-08-PLAN.md."

duration: ~20min
completed: 2026-10-01
status: complete
---

# Phase 31 Plan 8: Tela da Agenda 2 — Lista, Seções, Ações e Visão do Supervisor Summary

**`Agenda2List` (Client Component, irmão novo de `AgendaList.tsx`) compõe os componentes dos planos 31-05/31-07 numa tela completa — leitura, três seções, visibilidade dos concluídos, ações do vendedor e filtro somente-leitura do Supervisor — e a rota `/agenda-2` (Server Component) a expõe; 18/18 testes novos verdes, 244/244 no total da fase, Agenda atual comprovadamente intocada desde 071871f.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-10-01T11:20:00-03:00 (aprox.)
- **Completed:** 2026-10-01T11:40:00-03:00
- **Tasks:** 2
- **Files modified:** 3 (todos criados, nenhum arquivo existente alterado)

## Accomplishments
- `components/agenda2/Agenda2List.tsx` criado: mesmo esqueleto de fetch-on-mount de `AgendaList.tsx` (`FetchState`, `reloadKey`, guarda `cancelled`, `setState` síncrono no corpo do efeito), compondo `itensDaListaAgenda2` → `filtrarPorVendedor` → `agruparAgenda2` (31-02) para gerar as três seções (D-01/D-08) com a visibilidade correta dos concluídos (D-04/D-05, correção 7 do 31-01).
- Ações do vendedor ligadas: `Agenda2ItemForm` (31-07) abre em criar (cabeçalho e estado vazio) e em editar (inclusive item concluído, D-06); `Agenda2ApagarDialog` (31-05) confirma antes de apagar (AGD2-04); concluir/desmarcar chamam as Server Actions do 31-04 e recarregam via `reloadKey`; falha de qualquer ação mostra o banner genérico `role="alert"`.
- Visão do Supervisor: `Select` "Vendedor" sempre aberto em "Todos os vendedores" (D-18), nome do vendedor em cada linha quando sem filtro escolhido (D-17), filtragem funcional, e `Agenda2ItemForm`/`Agenda2ApagarDialog` nem são renderizados — nenhum botão de escrita aparece (D-16, reflexo visual; a RLS assimétrica da migration 0048 é a fronteira real).
- `app/(app)/agenda-2/page.tsx` criado: Server Component simplificado em relação a `app/(app)/agenda/page.tsx` — só lê o próprio `role` para derivar `isSupervisor`, sem buscar catálogos nem a lista de membros da equipe (minimização, ver Alerta de Conformidade abaixo).
- `tests/agenda2/agenda2-list.test.tsx`: 18 casos verdes cobrindo literalmente os 18 cenários do bloco `<behavior>` do 31-08-PLAN.md.
- Verificação final da fase: 244/244 testes verdes entre Agenda 2 completa + Agenda atual + menu + `tests/layout`; `npx tsc --noEmit`, `npm run lint` e `npm run build` terminam limpos, com `/agenda-2` registrada como rota dinâmica no build de produção.
- `components/agenda/*`, `lib/agenda/*`, `lib/supabase/queries/agenda.ts`, `app/actions/agenda.ts` e `app/(app)/agenda` (Agenda atual) confirmados intocados desde 071871f — ver prova abaixo.

## Task Commits

Each task was committed atomically:

1. **Tarefa 1 RED: testes da tela da Agenda 2** - `0293970` (test)
2. **Tarefa 1 GREEN: tela da Agenda 2 (Agenda2List)** - `677f040` (feat)
3. **Tarefa 2: rota /agenda-2 e verificação final da fase** - `f9b8cd9` (feat)

**Plan metadata:** pending (this commit)

_Nota: a Tarefa 1 (TDD) resultou em 2 commits (RED/GREEN) — não houve necessidade de um commit REFACTOR, o código ficou verde já na primeira versão escrita. A Tarefa 2 não era TDD (rota + verificação), um commit só.

## Files Created/Modified
- `components/agenda2/Agenda2List.tsx` - tela da Agenda 2: leitura, seções, visibilidade, ações, filtro do Supervisor
- `app/(app)/agenda-2/page.tsx` - rota `/agenda-2`, guarda de sessão, deriva `isSupervisor`
- `tests/agenda2/agenda2-list.test.tsx` - 18 testes de componente (RTL + jsdom)

## Decisions Made
- `Agenda2Page` não busca categorias/produtos/motivos de conclusão remota nem a lista de membros da equipe (diferente de `/agenda`) — as opções do filtro de vendedor vêm sempre dos itens que a RLS já liberou (`vendedoresDaAgenda2`, dentro de `Agenda2List`), nunca de uma consulta separada a `profiles`. Minimização deliberada (T-31-34 do threat register do 31-08-PLAN.md).
- `handleConfirmarApagar` não seta `erroAcao` em caso de falha — `Agenda2ApagarDialog` (31-05) já mostra seu próprio erro genérico internamente quando `onConfirmar` devolve `false`; duplicar o erro em dois lugares seria ruído.
- Cabeçalho da Agenda 2 não tem subtítulo (diferente de `AgendaList`, que tem "O que você precisa fazer, do mais urgente ao mais distante.") — o UI-SPEC desta fase só especifica o `h1` "Agenda 2", e D-11 ("não há extras além do especificado") foi interpretado literalmente.

## Deviations from Plan

None - plan executed exactly as written. Os 18 casos de teste e a implementação de `Agenda2List`/`Agenda2Page` seguem literalmente o bloco `<behavior>`/`<action>` de cada tarefa do 31-08-PLAN.md.

## Issues Encountered
None.

## User Setup Required
None - componentes de interface e rota em TypeScript, sem configuração de serviço externo nova. A migration 0048 (31-01) e as Server Actions (31-04) que esta tela consome já foram tratadas em planos anteriores desta fase.

## Alerta de Conformidade (LGPD)

Conforme instrução organizacional: este plano monta a TELA que lê, cria, edita, apaga e exibe o dado pessoal manual da Agenda 2 (nome livre do cliente, bairro, data, e — para o Supervisor — o nome do vendedor dono do item), já validado/persistido pelos planos anteriores da fase (31-01/31-02/31-04/31-05/31-07). Reforços de Privacidade por Design e por Padrão aplicados especificamente aqui, na composição da tela:
- `app/(app)/agenda-2/page.tsx` lê só o `role` do próprio usuário logado — nenhuma consulta a `profiles` de outros usuários, nenhuma leitura de catálogo não utilizado por esta tela (minimização).
- As opções do filtro de vendedor (`vendedoresDaAgenda2`) são derivadas em memória dos próprios itens que a Lista já carregou (que a RLS já escopou para o papel do usuário) — nunca uma segunda consulta ao banco que poderia vazar nomes de vendedores fora do que a RLS autoriza.
- O Supervisor nunca tem acesso aos componentes de escrita (`Agenda2ItemForm`/`Agenda2ApagarDialog` nem são renderizados) — reduz a superfície de risco de alteração acidental de um dado pessoal que não é seu, além da proteção já garantida pela RLS.
- Nenhuma exportação, nenhuma agregação além das três seções e da contagem por seção; nenhum campo extra é exibido além do que `Agenda2ItemRow` (31-05) já define como o mínimo necessário.
O prazo de retenção dos dados do piloto continua em aberto, como já registrado nos planos anteriores da fase (31-01/31-02/31-04/31-05/31-07) — nenhuma mudança neste plano.

## Next Phase Readiness
- A Fase 31 (Agenda 2 — Visitas Manuais na Lista) está funcionalmente completa: tabela + RLS (31-01/31-03), funções puras e schema (31-02), camada de dados (31-04), linha do item e confirmação de apagar (31-05), menu (31-06), formulário (31-07) e a tela completa (31-08) — todos os critérios de sucesso 1-4 do ROADMAP observáveis na tela, critério 5 (Agenda atual intocada) comprovado por git + testes.
- Pendência explícita de verificação humana consolidada (human-check do 31-08-PLAN.md): testar com `npm run dev` (ou o link de Preview da branch `staging`) como vendedor e como Supervisor, cobrindo o fluxo ponta a ponta com o banco real (riscado, selo do menu, calendário do formulário, recusa de documento no nome) — os testes de componente usam ações mockadas e não substituem essa verificação.
- Não houve push para `master`. Conforme CLAUDE.md ("Fluxo de Deploy") e o bloco `<output>` do 31-08-PLAN.md: o próximo passo é enviar para a branch `staging`, validar no link de Preview da Vercel (incluindo o human-check acima), e só depois enviar para `master`. A migration 0048 já está aplicada em produção desde o 31-03, então não há passo de banco pendente para este envio.
- Nenhum bloqueio de código para a Fase 32 (Agenda 2 — Repetição Semanal e Calendário) nem para a Fase 33 (Agenda Atual sem Visitas Automáticas de Clientes Ativos).

---
*Phase: 31-agenda-2-visitas-manuais-na-lista*
*Completed: 2026-10-01*

## Self-Check: PASSED

- FOUND: components/agenda2/Agenda2List.tsx
- FOUND: app/(app)/agenda-2/page.tsx
- FOUND: tests/agenda2/agenda2-list.test.tsx
- FOUND commit: 0293970 (Tarefa 1 RED)
- FOUND commit: 677f040 (Tarefa 1 GREEN)
- FOUND commit: f9b8cd9 (Tarefa 2)
- Re-ran `npx vitest run tests/agenda2/agenda2-list.test.tsx tests/agenda2/agenda2-item-row.test.tsx tests/agenda2/agenda2-apagar-dialog.test.tsx tests/agenda2/agenda2-item-form.test.tsx tests/agenda2/itens.test.ts tests/agenda2/validacao-agenda2.test.ts tests/agenda2/agenda2-query.test.ts tests/agenda2/agenda2-actions.test.ts tests/agenda2/limites-sincronizados.test.ts tests/agenda2/migracao-agenda2.test.ts tests/agenda2/app-sidebar-agenda2.test.tsx tests/agenda2/app-layout-contagem.test.tsx tests/agenda/agenda-list.test.tsx tests/agenda/agenda-item-row.test.tsx tests/agenda/itens.test.ts tests/agenda/app-sidebar-agenda.test.tsx tests/layout` — 244/244 passed
- Re-ran `npx tsc --noEmit` — clean
- Re-ran `npm run lint` — clean
- Re-ran `npm run build` — clean, `/agenda-2` listed as dynamic route
- Confirmed `git diff --name-only 071871f -- components/agenda lib/agenda lib/supabase/queries/agenda.ts app/actions/agenda.ts "app/(app)/agenda"` and `git status --porcelain` for the same paths both list nothing (Agenda atual intocada)

## Git Diff Proof — Agenda Atual Intocada (Critério 5 do ROADMAP)

```
$ node -e "const cp=require('child_process');const alvo=['components/agenda','lib/agenda','lib/supabase/queries/agenda.ts','app/actions/agenda.ts','app/(app)/agenda'];const d=cp.execFileSync('git',['diff','--name-only','071871f','--'].concat(alvo)).toString().trim();const s=cp.execFileSync('git',['status','--porcelain','--'].concat(alvo)).toString().trim();if(d||s)throw new Error('Agenda atual alterada: '+d+' '+s);console.log('OK Agenda atual intocada')"
OK Agenda atual intocada
```

Nenhum arquivo de `components/agenda`, `lib/agenda`, `lib/supabase/queries/agenda.ts`, `app/actions/agenda.ts` ou `app/(app)/agenda` mudou desde o commit `071871f736010850ebd300ce6e997220853014ca` (o último antes do início da Fase 31) — nem no histórico commitado (`git diff --name-only`), nem como alteração pendente (`git status --porcelain`).
