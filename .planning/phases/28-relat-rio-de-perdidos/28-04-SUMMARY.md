---
phase: 28-relat-rio-de-perdidos
plan: 04
subsystem: ui
tags: [nextjs, react, client-component, shadcn, lucide, lgpd]

requires:
  - phase: 28-relat-rio-de-perdidos (28-01)
    provides: "função clientes_perdidos(p_inicio, p_fim) — leitura SECURITY INVOKER aplicada em produção, RLS escopada por papel"
  - phase: 28-relat-rio-de-perdidos (28-02)
    provides: "regra do Kanban que esconde clientes perdidos e reaparece reabertos"
  - phase: 28-relat-rio-de-perdidos (28-03)
    provides: "lib/perdidos/lista.ts (regras puras de período/busca) + getClientesPerdidosAction (Server Action de leitura)"
provides:
  - "components/perdidos/PerdidosItemRow.tsx — linha de cliente perdido (nome/motivo/data/vendedor) com botão Reabrir icon-only size-11 sem confirmação"
  - "components/perdidos/PerdidosPeriodoFilter.tsx — Select de período (Tudo/30/90/Personalizado) + Popover/Calendar de intervalo, componente local da fase"
  - "components/perdidos/PerdidosList.tsx — dono da tela: leitura via Server Action, período (useMemo), busca local, reloadKey, Reabrir via marcarStatus"
  - "app/(app)/perdidos/page.tsx — rota /perdidos protegida, deriva isSupervisor"
  - "components/layout/AppSidebar.tsx — item 'Perdidos' (ícone Archive, sem contador) entre Clientes e Dashboard"
affects: []

tech-stack:
  added: []
  patterns:
    - "PerdidosPeriodoFilter é uma cópia estrutural local de components/dashboard/PeriodoFilter.tsx (mesmo Select+Popover+Calendar), com preset set e tipo próprios da fase — nunca importa de lib/dashboard nem de components/dashboard"
    - "PerdidosList reusa o molde fetch-on-mount de AgendaList.tsx (FetchState em união discriminada, setState síncrono no corpo do efeito, guarda cancelled, reloadKey) e intervalo memorizado por useMemo para as janelas móveis não entrarem em laço infinito"
    - "Reabrir chama diretamente marcarStatus (app/actions/funil.ts) já existente — nenhuma Server Action nova, D-08 — e a linha some da tela só pela releitura (reloadKey), sem remoção otimista (D-09)"

key-files:
  created:
    - components/perdidos/PerdidosItemRow.tsx
    - components/perdidos/PerdidosPeriodoFilter.tsx
    - components/perdidos/PerdidosList.tsx
    - app/(app)/perdidos/page.tsx
    - tests/funil/perdidos-item-row.test.tsx
    - tests/funil/perdidos-periodo-filter.test.tsx
    - tests/funil/perdidos-list.test.tsx
    - tests/funil/app-sidebar-perdidos.test.tsx
  modified:
    - components/layout/AppSidebar.tsx

key-decisions:
  - "showResponsavel = isSupervisor (sem filtro de vendedor nesta tela, diferente da Agenda) — para o Vendedor, todas as linhas já são dele, então repetir o próprio nome seria ruído (D-04)"
  - "Terceiro texto de lista vazia, não previsto no UI-SPEC original: quando a busca por nome zera uma lista que tinha itens, o texto usa 'Nenhum cliente perdido com esse nome' / 'Confira a grafia ou limpe a busca.' em vez do texto de período (que seria falso nesse caso)"
  - "Item 'Perdidos' inserido no menu entre Clientes e Dashboard, ícone Archive, sem badgeCount em nenhum estado (D-01/D-02/D-03) — principalSectionComContagem continua preenchendo contagem só em /agenda"

patterns-established: []

requirements-completed: [PERD-02, PERD-03, PERD-04, PERD-05]

coverage:
  - id: D1
    description: "PerdidosItemRow: nome exibido (razão social > Nome Fantasia > 'Sem nome'), motivo da perda (ou 'Motivo não informado'), 'Perdido em dd/mm/aaaa' via parseISO, nome do vendedor condicionado a showResponsavel, botão Reabrir icon-only size-11 (RotateCcw) sem janela de confirmação"
    requirement: "PERD-02"
    verification:
      - kind: unit
        ref: "tests/funil/perdidos-item-row.test.tsx (12 casos: titulo x3, motivo x2, data, responsavel x2, reabrir x2, sem-janela)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PerdidosPeriodoFilter: Select com Tudo/Últimos 30 dias/Últimos 90 dias/Personalizado nesta ordem, aplica na hora; intervalo personalizado via Popover+Calendar com rótulo 'Selecionar período' ou as datas formatadas"
    requirement: "PERD-04"
    verification:
      - kind: unit
        ref: "tests/funil/perdidos-periodo-filter.test.tsx (3 casos: opcoes, troca, personalizado-rotulo)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PerdidosList: leitura única via getClientesPerdidosAction ao montar e a cada troca de período/reloadKey; showResponsavel=isSupervisor; Reabrir chama marcarStatus(clienteId,'em_andamento') sem diálogo, releitura remove a linha em sucesso e mantém a linha com alerta em falha; busca local sem nova leitura; troca de período limpa a busca; quatro estados de lista vazia/erro"
    requirement: "PERD-03"
    verification:
      - kind: unit
        ref: "tests/funil/perdidos-list.test.tsx (10 casos: carga-inicial, vendedor-nome, vendedor-nome-oculto, reabrir, reabrir-erro, vazio, vazio-periodo, busca, busca-limpa, erro-carga)"
        status: pass
    human_judgment: false
  - id: D4
    description: "app/(app)/perdidos/page.tsx: rota protegida (redirect /login sem sessão) dentro do grupo (app), deriva isSupervisor e renderiza PerdidosList"
    requirement: "PERD-02"
    verification:
      - kind: unit
        ref: "node -e script do bloco verify da Tarefa 2 (confirma redirect(\"/login\") e <PerdidosList isSupervisor={isSupervisor} />) + npm run build (rota /perdidos compilada e listada)"
        status: pass
    human_judgment: false
  - id: D5
    description: "AppSidebar: item 'Perdidos' (ícone Archive) visível para Vendedor e Supervisor, entre Clientes e Dashboard, sem contador em nenhum estado do menu (expandido/recolhido)"
    requirement: "PERD-05"
    verification:
      - kind: unit
        ref: "tests/funil/app-sidebar-perdidos.test.tsx (6 casos: vendedor, supervisor, ordem, sem-contador, recolhido-sem-contador, ativo) + tests/agenda/app-sidebar-agenda.test.tsx e tests/importacao/AppSidebar.test.tsx continuam verdes sem edição"
        status: pass
    human_judgment: false
  - id: D6
    description: "Verificação humana ponta a ponta em staging (fluxo de deploy do CLAUDE.md): perder um cliente de teste no Kanban, ver o item Perdidos no menu, listar, tocar Reabrir e conferir o retorno ao Kanban na mesma etapa — como Vendedor e como Supervisor"
    verification: []
    human_judgment: true
    rationale: "Pendente por natureza (bloco human-check da Tarefa 2, marcado explicitamente no plano como 'checagem humana pendente para o fechamento da fase') — precisa da interface real publicada em staging e do dono do projeto testando em telefone/tablet; os testes automatizados acima cobrem cada peça isoladamente com dados inventados, não o fluxo físico completo."

duration: ~35min
completed: 2026-09-25
status: complete
---

# Phase 28 Plan 4: Relatório de Perdidos — Tela (Menu, Lista, Reabrir) Summary

**Tela `/perdidos` completa: item no menu (Archive, sem contador), lista de clientes perdidos com filtro de período/busca e quatro estados vazios/erro, e botão "Reabrir" de um toque (icon-only, 44px) que devolve o cliente ao Kanban via `marcarStatus` — 32 testes de tela novos, todos no molde da Agenda já aprovado pelo UI-SPEC.**

## Performance

- **Duration:** ~35min
- **Started:** 2026-09-25T21:00:00Z (aprox.)
- **Completed:** 2026-09-25T21:07:00Z (aprox.)
- **Tasks:** 3/3 concluídas
- **Files modified:** 9 (5 produção + 4 teste)

## Accomplishments

- `components/perdidos/PerdidosItemRow.tsx`: linha de apresentação pura (`Card size="sm"`, molde de `AgendaItemRow.tsx`/`ClienteCard.tsx`) mostrando nome exibido (`nomeExibicaoCliente`), motivo da perda (ou `MOTIVO_PERDA_AUSENTE`), "Perdido em dd/mm/aaaa" (via `parseISO`, nunca `new Date(string)`) e, condicionado a `showResponsavel`, o nome do vendedor. Botão "Reabrir" icon-only `size-11` (44px) com `RotateCcw`, `aria-label` carregando o nome do cliente, `title="Reabrir"`, `stopPropagation`, sem qualquer janela de confirmação (D-05) — critério 2 da fase (LGPD): nenhum dado de contato do cliente é renderizado.
- `components/perdidos/PerdidosPeriodoFilter.tsx`: cópia estrutural local de `components/dashboard/PeriodoFilter.tsx` (mesmo Select + Popover/Calendar `mode="range"`), mas com o preset set próprio da fase (`PERIODO_PRESETS_PERDIDOS`: Tudo/Últimos 30 dias/Últimos 90 dias/Personalizado) e tipo `PeriodoPresetPerdidos` — sem importar nada de `lib/dashboard` nem `components/dashboard`.
- `components/perdidos/PerdidosList.tsx`: dono da tela inteira — faz a ÚNICA leitura via `getClientesPerdidosAction` (efeito dependente de `[intervalo.inicio, intervalo.fim, reloadKey]`, intervalo memorizado por `useMemo` para as janelas móveis 30/90 dias não recalcularem a cada render e entrarem em laço), busca por nome local (`filtrarPerdidosPorNome`, sem nova leitura), troca de período limpa a busca, e "Reabrir" chama diretamente `marcarStatus(clienteId, "em_andamento")` de `app/actions/funil.ts` (D-08 — nenhuma ação nova) — sucesso bumpa `reloadKey` e a linha some pela releitura (D-09, sem remoção otimista); falha mantém a linha e mostra um alerta com a mensagem de erro. Quatro estados cobertos: carregando (Skeleton), erro de carga (com "Tentar novamente"), vazio sem recorte de período, vazio com recorte de período, e vazio por busca sem resultado (extensão mínima do UI-SPEC, decisão de tela 5 do plano).
- `app/(app)/perdidos/page.tsx`: rota Server Component no molde de `app/(app)/agenda/page.tsx` — `redirect("/login")` sem sessão, deriva `isSupervisor` do papel do perfil (a leitura em si não roda aqui — roda no navegador, dentro de `PerdidosList`, porque precisa ser refeita ao trocar período/reabrir).
- `components/layout/AppSidebar.tsx`: `PRINCIPAL_SECTION` ganha `{ href: "/perdidos", label: "Perdidos", icon: Archive }` entre Clientes e Dashboard (D-01: mesmo nível dos outros itens principais; D-02: nunca recebe `badgeCount`; D-03: `Archive` em vez de um ícone com conotação de alarme/erro). `principalSectionComContagem` continua preenchendo contagem só em `/agenda` — nenhuma edição lá.
- 32 testes de tela novos (12 + 3 + 10 + 6 já sem contar duplicatas) todos passando; `tests/agenda/app-sidebar-agenda.test.tsx` e `tests/importacao/AppSidebar.test.tsx` continuam verdes SEM edição (guard mecânico de `git diff` confirmou isso). `npx tsc --noEmit` e `npx eslint` limpos em todos os arquivos tocados. `npm run build` concluiu sem erro, com a rota `/perdidos` (ƒ, server-rendered on demand) listada na saída — prova de que nenhum import de módulo de servidor vazou para dentro do Client Component.

## Task Commits

Each task was committed atomically:

1. **Tarefa 1: Linha PerdidosItemRow e filtro PerdidosPeriodoFilter** - `9aa38e6` (feat, RED→GREEN)
2. **Tarefa 2: PerdidosList e rota /perdidos** - `4e1147b` (feat, RED→GREEN)
3. **Tarefa 3: Item "Perdidos" no menu principal, sem contador** - `49fd681` (feat, RED→GREEN)

## Files Created/Modified

- `components/perdidos/PerdidosItemRow.tsx` - linha de cliente perdido (nome/motivo/data/vendedor + Reabrir)
- `components/perdidos/PerdidosPeriodoFilter.tsx` - filtro de período local da fase (Tudo/30/90/Personalizado)
- `components/perdidos/PerdidosList.tsx` - dono da tela (leitura, período, busca, reabrir, estados)
- `app/(app)/perdidos/page.tsx` - rota `/perdidos` protegida
- `components/layout/AppSidebar.tsx` - item "Perdidos" no menu principal (alterado)
- `tests/funil/perdidos-item-row.test.tsx` - 12 testes unitários (Tarefa 1)
- `tests/funil/perdidos-periodo-filter.test.tsx` - 3 testes unitários (Tarefa 1)
- `tests/funil/perdidos-list.test.tsx` - 10 testes unitários (Tarefa 2)
- `tests/funil/app-sidebar-perdidos.test.tsx` - 6 testes unitários (Tarefa 3)

## Decisions Made

- `showResponsavel = isSupervisor` (sem estado de filtro de vendedor nesta tela — decisão de tela 3 do plano): para o Vendedor todas as linhas já são as próprias, repetir o nome seria ruído.
- Terceiro texto de lista vazia ("Nenhum cliente perdido com esse nome" / "Confira a grafia ou limpe a busca.") acrescentado para o caso em que a busca por nome zera uma lista que tinha itens — o texto de "nesse período" ficaria enganoso nesse caso (decisão de tela 5 do plano, já prevista, não é desvio).
- Linhas não clicáveis (D-04): `PerdidosItemRow` não tem `role="button"`/`onClick` na casca — a única ação é o botão Reabrir, com `stopPropagation` como defesa mesmo sem um `onOpen` existir hoje.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Teste `recolhido-sem-contador` usava `getByRole("link", { name: "Perdidos" })`, que não tem nome acessível no menu recolhido**
- **Found during:** Tarefa 3 (RED do teste novo `tests/funil/app-sidebar-perdidos.test.tsx`)
- **Issue:** No modo recolhido do menu, o link renderiza só o ícone (sem texto visível, sem `aria-label`) — o rótulo "Perdidos" só existe dentro do `TooltipContent`, que a Testing Library não conta como nome acessível do link. A consulta por `role("link", { name: "Perdidos" })` nunca encontraria o elemento nesse estado, mesmo com o componente correto.
- **Fix:** Reescrita a consulta do teste para `container.querySelector('a[href="/perdidos"]')`, mesma estratégia que o teste irmão de Agenda (`tests/agenda/app-sidebar-agenda.test.tsx`) já usa para o caso recolhido (procura o indicador circular via classe, não via nome acessível do link).
- **Files modified:** tests/funil/app-sidebar-perdidos.test.tsx
- **Verification:** os 6 casos do arquivo passaram depois do ajuste; nenhuma mudança em `components/layout/AppSidebar.tsx` foi necessária.
- **Committed in:** 49fd681 (Tarefa 3 commit — o arquivo já nasceu corrigido, sem commit intermediário quebrado)

---

**Total deviations:** 1 auto-fixed (1 bug de teste, não de produto)
**Impact on plan:** Sem impacto de escopo — ajuste de estratégia de consulta dentro do próprio teste novo, nenhuma mudança de comportamento do componente.

## Issues Encountered

None além do desvio documentado acima.

## User Setup Required

None. Nenhuma migration, dependência nova ou configuração de serviço externo neste plano — só componentes React/TypeScript sobre a Server Action e o leitor já publicados pelo plano 28-03.

## Next Phase Readiness

- Fase 28 (Relatório de Perdidos) está com os 4 planos completos (28-01 banco, 28-02 regra do Kanban, 28-03 camada de dados, 28-04 tela). Critérios 2, 3, 4 e 5 da fase estão implementados e verificáveis por teste automatizado.
- **Checagem humana pendente (bloco `human-check` da Tarefa 2, obrigatória para o fechamento da fase):** com a mudança publicada na branch `staging` (Fluxo de Deploy do CLAUDE.md) e o link de teste da Vercel aberto, o dono do projeto precisa confirmar em telefone/tablet: (1) como Vendedor — perder um cliente de teste no Kanban, ver o item "Perdidos" no menu sem número, abrir a lista, conferir nome/motivo/data sem nome de vendedor, tocar "Reabrir"; (2) como Supervisor — abrir "Perdidos", conferir que aparece o nome do vendedor e os perdidos de mais de um vendedor, testar "Últimos 30 dias" e "Personalizado". Só depois dessa validação a mudança segue para `master`.
- Nenhum bloqueio técnico identificado: `npm run build` passou, a rota `/perdidos` está listada na saída do build, e as suítes de regressão do menu/prospecção/kanban-sem-perdidos continuam verdes sem qualquer edição.
- Este plano NÃO fez push para `master` nem para `staging` — a publicação e a checagem humana acima ficam para o fechamento da fase, conforme instrução do bloco `<output>` do plano.

## Self-Check: PASSED

All 9 created/modified files found on disk (components/perdidos/PerdidosItemRow.tsx, components/perdidos/PerdidosPeriodoFilter.tsx, components/perdidos/PerdidosList.tsx, app/(app)/perdidos/page.tsx, components/layout/AppSidebar.tsx, tests/funil/perdidos-item-row.test.tsx, tests/funil/perdidos-periodo-filter.test.tsx, tests/funil/perdidos-list.test.tsx, tests/funil/app-sidebar-perdidos.test.tsx). All three task commits (9aa38e6, 4e1147b, 49fd681) confirmed present in git log.

---
*Phase: 28-relat-rio-de-perdidos*
*Completed: 2026-09-25*
