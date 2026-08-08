---
phase: 14-agenda-unificada
plan: 04
subsystem: ui
tags: [nextjs, react, typescript, lucide-react, vitest, testing-library]

# Dependency graph
requires:
  - phase: 14-agenda-unificada (plan 14-02)
    provides: "getAgendaPendentesCount() — leitor tipado sobre agenda_do_vendedor(), mesma fonte usada por getAgenda() (contrato AGD-06)"
provides:
  - "components/layout/AppSidebar.tsx — item Agenda como primeiro da seção Principal, prop agendaCount, badgeCount opcional no NavLink, selo expandido e indicador recolhido"
  - "app/(app)/layout.tsx — leitura tolerante a falha de getAgendaPendentesCount(), repassada a AppSidebar"
  - "tests/agenda/app-sidebar-agenda.test.tsx — prova de ordem, contagem, zero, recolhido, limite e não-contaminação dos demais itens"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NavLink.badgeCount opcional: um único item de menu com conteúdo dinâmico é modelado como campo opcional no tipo compartilhado, preenchido por .map() sobre a constante PRINCIPAL_SECTION dentro do componente — a constante continua sendo a fonte única de ORDEM, nunca duplicada nem virando função com parâmetro"
    - "Leitura decorativa no layout raiz sempre em try/catch com valor de recuo (zero) — o layout envolve toda a área logada, então uma falha ali não pode derrubar Clientes/Dashboard/Equipe/Configurações por causa de um número de selo"

key-files:
  created:
    - tests/agenda/app-sidebar-agenda.test.tsx
  modified:
    - components/layout/AppSidebar.tsx
    - app/(app)/layout.tsx
    - tests/importacao/AppSidebar.test.tsx

key-decisions:
  - "tests/importacao/AppSidebar.test.tsx (fora do files_modified do plano) precisou de um ajuste mínimo — adicionar agendaCount={0} às duas chamadas de render — porque a prop nova e obrigatória quebrava tsc --noEmit; sem esse ajuste o build inteiro ficava vermelho por causa de um teste pré-existente não relacionado ao escopo funcional deste plano (Rule 3 - blocking issue causado diretamente pela mudança de tipo desta tarefa)"
  - "Selo expandido e tooltip do modo recolhido mostram o número CHEIO (sem cap); só o indicador circular do modo recolhido é capado em 9+ — o UI-SPEC só menciona o limite de dígitos para o indicador sobreposto ao ícone, não para o selo nem para o texto da dica"

patterns-established:
  - "aria-label da contagem usa link.label dinamicamente (`${link.label}, ${badgeCount} itens pendentes`) em vez de hardcode — funcionalmente idêntico ao texto exigido porque só o item Agenda carrega badgeCount, mas evita duplicar a string 'Agenda' hardcoded no componente"

requirements-completed: [AGD-02, AGD-06]

coverage:
  - id: D1
    description: "Menu principal com Agenda como primeiro item da seção Principal, acima de Clientes e Dashboard, apontando para /agenda com ícone ListChecks dedicado"
    requirement: "AGD-02"
    verification:
      - kind: unit
        ref: "tests/agenda/app-sidebar-agenda.test.tsx#ordem: Agenda aparece antes de Clientes e Dashboard no documento (AGD-02)"
        status: pass
      - kind: other
        ref: "check estrutural do verify automatizado do Task 1: ordem dos três hrefs na seção Principal, ListChecks usado exatamente uma vez"
        status: pass
    human_judgment: false
  - id: D2
    description: "Selo de contagem no modo expandido (Badge com aria-label anunciando a contagem) e indicador circular sobreposto ao ícone no modo recolhido (capado em 9+), ambos ausentes quando a contagem é zero — nunca a forma 'Agenda (0)'"
    requirement: "AGD-06"
    verification:
      - kind: unit
        ref: "tests/agenda/app-sidebar-agenda.test.tsx#contagem, #zero, #recolhido, #limite"
        status: pass
      - kind: other
        ref: "check estrutural do verify automatizado do Task 1: ausência da string 'Agenda (0)' no arquivo, presença de justify-between/absolute -top-1 -right-1/rounded-full/9+"
        status: pass
    human_judgment: false
  - id: D3
    description: "Contagem lida uma única vez por carregamento de página em app/(app)/layout.tsx via getAgendaPendentesCount() (mesma fonte da tela), dentro de try/catch com zero de recuo, sem tempo real/polling/segunda fonte"
    verification:
      - kind: other
        ref: "check estrutural do verify automatizado do Task 1: presença de getAgendaPendentesCount/agendaCount/catch em app/(app)/layout.tsx, ausência de subscribe/realtime/setInterval e de any"
        status: pass
    human_judgment: false
  - id: D4
    description: "Nenhum outro item de menu (Clientes, Dashboard, Administração) recebe selo — só a Agenda tem conteúdo dinâmico"
    verification:
      - kind: unit
        ref: "tests/agenda/app-sidebar-agenda.test.tsx#intacto: nem Clientes nem Dashboard recebem selo — existe só um selo de contagem no menu inteiro"
        status: pass
    human_judgment: false
  - id: D5
    description: "npx tsc --noEmit e npm run lint limpos no projeto inteiro; npx vitest run tests/agenda/ (RPC, RLS, lógica pura, linha, lista e menu) verde por completo"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (sem saída), npm run lint (sem erros/avisos), npx vitest run tests/agenda/ (4 arquivos, 39 testes, todos passando)"
        status: pass
    human_judgment: false

# Metrics
duration: ~25min de trabalho ativo
completed: 2026-08-08
status: complete
---

# Phase 14 Plan 4: Menu e Selo de Pendências Summary

**Item "Agenda" inserido como primeiro da seção Principal do menu (acima de Clientes e Dashboard), com selo de contagem nas formas expandida (Badge + aria-label) e recolhida (indicador circular capado em 9+), lido uma única vez por carregamento a partir da mesma fonte que alimenta a tela e tolerante a falha no layout raiz.**

## Performance

- **Duration:** ~25 min de trabalho ativo
- **Started:** 2026-08-08T16:05:00-03:00 (aprox.)
- **Completed:** 2026-08-08T16:29:00-03:00 (aprox.)
- **Tasks:** 2 (ambos `auto`)
- **Files modified:** 4 (2 do plano modificados, 1 do plano criado, 1 fora do escopo ajustado por Rule 3)

## Accomplishments

- `PRINCIPAL_SECTION.links` de `components/layout/AppSidebar.tsx` passa a ter três entradas, nesta ordem exata: Agenda (`/agenda`, ícone `ListChecks`), Clientes, Dashboard — a constante continua sendo a única fonte de ORDEM, nunca duplicada
- `AppSidebar` ganha a prop `agendaCount: number`; `NavLink` ganha `badgeCount?: number`, preenchido dinamicamente só na entrada `/agenda` via `.map()` dentro do componente
- Modo expandido: quando `badgeCount > 0`, o link vira `justify-between` com ícone+rótulo à esquerda e um `Badge` (`h-4 min-w-4 px-1 text-[10px]`) à direita mostrando o número cheio, com `aria-label` anunciando `"Agenda, {N} itens pendentes"` para leitor de tela
- Modo recolhido: quando `badgeCount > 0`, o link ganha `relative` e um indicador circular sobreposto ao ícone (`absolute -top-1 -right-1`, `size-3.5 rounded-full bg-primary`), capado em `9+` para contagens de dois dígitos, marcado `aria-hidden` (a dica carrega a informação nesse modo)
- Dica (`TooltipContent`) do modo recolhido mostra `"Agenda (N)"` quando há pendências e só `"Agenda"` quando não há — a string literal `"Agenda (0)"` nunca é construída porque o ramo do template só executa quando `badgeCount > 0`
- Com contagem zero, nem o selo expandido nem o indicador recolhido são renderizados — provado por teste, incluindo a ausência da substring `"Agenda (0)"` em qualquer lugar do HTML renderizado
- `app/(app)/layout.tsx` importa `getAgendaPendentesCount()` de `@/lib/supabase/queries/agenda` e lê a contagem dentro de `try/catch` com `0` de recuo, com comentário registrando que este layout envolve toda a área logada — uma falha na leitura nunca derruba Clientes/Dashboard/Equipe/Configurações
- Nenhuma assinatura de tempo real, `setInterval` ou segunda consulta introduzida: a contagem é lida uma vez por carregamento de página, exatamente como o UI-SPEC exige
- `tests/agenda/app-sidebar-agenda.test.tsx` criado com 6 casos (`ordem`, `contagem`, `zero`, `recolhido`, `limite`, `intacto`), mockando `next/navigation` e `@/lib/supabase/client` seguindo o padrão de `tests/clientes/filters-popover.test.tsx`
- `npx tsc --noEmit` e `npm run lint` limpos no projeto inteiro; `npx vitest run tests/agenda/` verde com 39 testes (RPC, RLS, lógica pura, linha, lista e menu)

## Task Commits

Each task was committed atomically:

1. **Task 1: Item "Agenda" no topo do menu, com selo de contagem nas duas formas** - `a7ab927` (feat)
2. **Task 2: Teste de renderização do menu — ordem, contagem e o caso de zero** - `3308cf3` (test)

**Plan metadata:** commit deste SUMMARY.md (docs) — próximo commit desta sessão.

## Files Created/Modified

- `components/layout/AppSidebar.tsx` - item Agenda em primeiro lugar na seção Principal, prop `agendaCount`, `badgeCount` opcional no tipo de link, selo expandido e indicador recolhido
- `app/(app)/layout.tsx` - leitura tolerante a falha de `getAgendaPendentesCount()`, repassada como `agendaCount` a `AppSidebar`
- `tests/agenda/app-sidebar-agenda.test.tsx` - teste de renderização novo: ordem, contagem, zero, recolhido, limite, intacto
- `tests/importacao/AppSidebar.test.tsx` - ajuste mínimo (prop `agendaCount={0}` adicionada às duas chamadas de render existentes) para manter `tsc --noEmit` limpo após a prop nova se tornar obrigatória

## Decisions Made

- `tests/importacao/AppSidebar.test.tsx` não estava no `files_modified` deste plano, mas a prop `agendaCount` obrigatória quebrava `npx tsc --noEmit` nas duas chamadas de `render(<AppSidebar .../>)` desse arquivo pré-existente. Corrigido com `agendaCount={0}` em ambas — mudança mínima, sem alterar a intenção do teste (Rule 3: blocking issue causado diretamente pela mudança de tipo desta tarefa).
- Selo expandido e texto da dica do modo recolhido mostram o número cheio (sem cap); só o indicador circular do modo recolhido é capado em `9+`. O UI-SPEC menciona o limite de dígitos explicitamente só para "o indicador... sized up slightly to fit 1-2 digits... capped display at 9+", não para o selo nem para o texto `"Agenda (5)"` da dica — mantive a distinção literal do contrato.
- `aria-label` da contagem usa `link.label` interpolado (`${link.label}, ${badgeCount} itens pendentes`) em vez do texto `"Agenda"` hardcoded — resultado idêntico porque só o item Agenda tem `badgeCount`, mas evita repetir a string do rótulo em dois lugares do componente.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ajuste em teste pré-existente fora do escopo do plano**
- **Found during:** Task 1 (`npx tsc --noEmit`)
- **Issue:** `tests/importacao/AppSidebar.test.tsx` (não listado em `files_modified`) renderiza `<AppSidebar>` sem a prop nova `agendaCount`, que passou a ser obrigatória — dois erros `TS2741` bloqueavam o build inteiro.
- **Fix:** Adicionado `agendaCount={0}` às duas chamadas de `render(...)` existentes nesse arquivo.
- **Files modified:** `tests/importacao/AppSidebar.test.tsx`
- **Verification:** `npx tsc --noEmit` limpo depois do ajuste; os dois testes originais desse arquivo continuam passando sem mudança de comportamento.
- **Committed in:** `a7ab927` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Ajuste estritamente mecânico (prop obrigatória nova) em um arquivo de teste não relacionado ao escopo funcional — sem mudança de intenção de teste, sem escopo criado além do necessário para manter o build verde.

## Issues Encountered

- `.env.local` estava ausente neste worktree (esperado, é gitignored) — copiado do checkout principal antes de rodar `npx vitest run tests/agenda/`, necessário porque `tests/agenda/agenda-rpc.test.ts` e `tests/agenda/rls-agenda.test.ts` fazem login real contra o Supabase do projeto. Nenhuma mudança de código, só configuração local de ambiente para rodar a suíte completa da fase.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- AGD-02 e AGD-06 completos ponta a ponta: o vendedor agora descobre a Agenda pelo menu, com a contagem de pendentes visível nas duas formas do menu (expandido/recolhido) e sempre em acordo com a lista da tela (mesma fonte, `getAgendaPendentesCount()`).
- Este era o último plano da Fase 14 (parte 4 de 4). Nenhum bloqueio conhecido para o encerramento da fase.

---
*Phase: 14-agenda-unificada*
*Completed: 2026-08-08*

## Self-Check: PASSED

- FOUND: `components/layout/AppSidebar.tsx`
- FOUND: `app/(app)/layout.tsx`
- FOUND: `tests/agenda/app-sidebar-agenda.test.tsx`
- FOUND: commit `a7ab927` (Task 1)
- FOUND: commit `3308cf3` (Task 2)
