---
phase: 03-administra-o-de-listas-edit-veis
plan: 01
subsystem: ui
tags: [nextjs, server-actions, supabase, rls, react-hook-form, zod, shadcn-tabs]

requires:
  - phase: 02-cadastro-e-gest-o-de-clientes-pj
    provides: "categorias/produtos_consumidos/tipos_tarefa/motivos_perda tables with ativo soft-delete column, unique(nome) constraint, and Supervisor-only RLS write policies (migration 0002)"
provides:
  - "Supervisor-only /configuracoes route with a Categoria tab that lists active values and adds new ones end-to-end"
  - "Shared lib/validations/lista.ts + app/actions/listas.ts (getListaValores/createListaValor) reusable by the other 3 tabs in 03-03"
  - "tests/configuracoes/rls-listas.test.ts locking the RLS contract for all 4 lookup tables as a reusable regression base"
affects: ["03-02-editar-desativar-reativar", "03-03-outras-3-abas"]

tech-stack:
  added: []
  patterns:
    - "Admin lookup-table reads (getListaValores) return ALL rows (active+inactive), distinct from the existing ativo=true-only getCategoriasAtivas/etc. cadastro-dropdown readers"
    - "Every write on the 4 lookup tables is Supervisor-only with no Vendedor-scoped variant (unlike createCliente/updateCliente's responsavel override)"

key-files:
  created:
    - tests/configuracoes/rls-listas.test.ts
    - lib/validations/lista.ts
    - app/actions/listas.ts
    - "app/(app)/configuracoes/page.tsx"
    - components/configuracoes/ConfiguracoesTabs.tsx
    - components/configuracoes/EditableListTab.tsx
  modified:
    - "app/(app)/layout.tsx"

key-decisions:
  - "getListaValores lives in app/actions/listas.ts (not lib/supabase/queries/clientes.ts) because it's a new admin-only read (active+inactive) distinct from the existing ativo=true-only cadastro readers, which must not change"
  - "EditableListTab's fetch-on-mount effect follows PerdaMotivoDialog's fetch-on-open pattern (isLoading set synchronously before the async call, eslint-disable for react-hooks/set-state-in-effect, cancelled-flag cleanup)"
  - "pluralAtivoLabel is passed in by the caller (ConfiguracoesTabs) as a full string (e.g. \"categorias ativas\") rather than derived, since Portuguese gender/number agreement differs per tab (categorias ativas vs produtos ativos) — keeps EditableListTab dialect-agnostic for 03-03's other 3 tabs"

patterns-established:
  - "Shared zod schema across structurally-identical tables ({id, nome, ativo}) instead of one schema per table"
  - "Server Action defense-in-depth Supervisor check before every write on the 4 lookup tables, mirroring deleteCliente's forbidden-code pattern"

requirements-completed: [ADM-01]

coverage:
  - id: D1
    description: "Supervisor navigates to /configuracoes via the nav link, sees the Categoria tab with existing seed values, and adds a new value that appears immediately in the list"
    requirement: "ADM-01"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit (type-level contract for page/components/actions)"
        status: pass
      - kind: manual_procedural
        ref: "No browser-driving tool available to this executor; build (`next build`) succeeded and registered the /configuracoes route as dynamic (ƒ)"
        status: unknown
    human_judgment: true
    rationale: "No RTL/jsdom test infra exists in this project (vitest.config.ts environment is \"node\", include pattern is *.test.ts only) and no browser tool was available to this executor to drive the actual add-value flow end-to-end visually; tsc/build/lint confirm it compiles and the route renders server-side, but the interactive add-flow needs human/UAT confirmation"
  - id: D2
    description: "Vendedor does not see the Configurações link and is redirected to / if navigating to /configuracoes directly"
    requirement: "ADM-01"
    verification:
      - kind: unit
        ref: "grep confirms the supervisor-role guard mirrors app/(app)/equipe/page.tsx's proven redirect pattern"
        status: pass
    human_judgment: false
  - id: D3
    description: "Vendedor cannot INSERT into any of the 4 lookup tables via direct Supabase API calls (RLS blocks it), including the unique(nome) constraint and soft-delete UPDATE behavior"
    requirement: "ADM-01"
    verification:
      - kind: integration
        ref: "tests/configuracoes/rls-listas.test.ts (25 tests, describe.each over all 4 tables)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-07-17
status: complete
---

# Phase 3 Plan 1: Configurações Screen Spine (Categoria Tab, "Adicionar") Summary

**Supervisor-only `/configuracoes` route with a working Categoria tab (list + "Adicionar" form via Server Action), backed by an RLS regression-lock test covering all 4 editable lookup tables.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-17T23:52:00Z (per STATE.md session start)
- **Completed:** 2026-07-18T00:06:19-03:00
- **Tasks:** 3/3
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments
- Locked the RLS contract for all 4 editable-list lookup tables (`categorias`, `produtos_consumidos`, `tipos_tarefa`, `motivos_perda`) as a single parametrized test suite — Supervisor-only INSERT/UPDATE, unique(nome) → 23505, and soft-delete via UPDATE `ativo` — 25 tests, all passing.
- Built the shared validation + Server Action layer (`lib/validations/lista.ts`, `app/actions/listas.ts`) that all 4 future tabs (this plan + 03-02 + 03-03) will reuse: `getListaValores` (admin read, active+inactive) and `createListaValor` (Supervisor-only insert with duplicate mapping and dual `revalidatePath`).
- Delivered the first vertical slice of ADM-01: a Supervisor can open "Configurações" from the nav, see the Categoria tab's existing values, and add a new one that appears immediately — while a Vendedor never sees the link and is redirected server-side if they try the route directly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Teste de contrato de segurança RLS das 4 tabelas de lookup** - `9c3da13` (test)
2. **Task 2: Camada de validação (zod) + Server Actions de leitura e criação** - `ac91a30` (feat)
3. **Task 3: Rota protegida + link no menu + abas + aba Categoria com "Adicionar"** - `cc0941b` (feat)

**Plan metadata:** _pending final commit (see below)_

## Files Created/Modified
- `tests/configuracoes/rls-listas.test.ts` - Parametrized RLS contract test (`describe.each` over the 4 tables): Supervisor-can-INSERT, Vendedor-cannot-INSERT, duplicate-nome-23505, Supervisor-can-toggle-ativo, Vendedor-cannot-UPDATE-ativo.
- `lib/validations/lista.ts` - `createListaValorSchema`/`updateListaValorSchema` shared across all 4 tables (`{id, nome, ativo}` shape).
- `app/actions/listas.ts` - `getListaValores` (all rows, admin use) and `createListaValor` (Supervisor-only, 23505 → `duplicate_nome`, `revalidatePath("/configuracoes")` + `revalidatePath("/clientes")`).
- `app/(app)/configuracoes/page.tsx` - Supervisor-only Server Component route, redirects non-Supervisor to `/`.
- `app/(app)/layout.tsx` - Added the "Configurações" nav Link under the same `profile?.role === "supervisor"` guard as "Gerenciar equipe".
- `components/configuracoes/ConfiguracoesTabs.tsx` - Tab shell; only the "Categoria" `TabsTrigger`/`TabsContent` is wired this plan.
- `components/configuracoes/EditableListTab.tsx` - Fetch-on-mount active-values list + "Adicionar" form (react-hook-form + zod), success/error copy per the UI-SPEC Copywriting Contract.

## Decisions Made
- `getListaValores` intentionally lives in `app/actions/listas.ts`, not alongside `getCategoriasAtivas`/etc. in `lib/supabase/queries/clientes.ts` — it's a distinct admin read (returns inactive rows too) and must not be confused with or accidentally merged into the existing `ativo=true`-only cadastro-dropdown readers.
- `EditableListTab`'s count-caption suffix (`pluralAtivoLabel`) is passed in fully-formed by the caller rather than pluralized/gendered internally, since Portuguese noun agreement differs per tab ("categorias ativas" vs a future "produtos ativos") — keeps the shared component reusable as-is for 03-03's other 3 tabs.
- No migration was created, per the plan's own `<schema_decision>` — Task 1 confirmed (and now regression-locks) that the unique(nome) constraint, RLS policies, and `ativo` column already existed from Phase 2's migration 0002.

## Deviations from Plan

None - plan executed exactly as written. One documentation note below (not a code deviation).

## TDD Gate Compliance

Task 3 was marked `tdd="true"` in the plan and includes a `<behavior>` block, but its own `<files>`/`<verify>`/`<acceptance_criteria>` sections specify no test file and only `npx tsc --noEmit` as verification — there is no RED/GREEN test-first gate defined for this task to follow. This mirrors the established precedent in `02-05-PLAN.md` Task 2 (an equivalent full-UI task with `<behavior>`, deliberately left as plain `type="auto"` without `tdd="true"`, reserving the `tdd="true"` marker for tasks with a testable pure-function `<behavior>` like `isClienteIncompleto`). Additionally, this project's `vitest.config.ts` runs with `environment: "node"` and only includes `tests/**/*.test.ts` — there is no jsdom/React Testing Library component-test infrastructure set up yet to author a RED test against. Rather than introducing new test infrastructure unscoped by this plan (a Rule 4 architectural decision, not auto-fixable), Task 3 was executed as a standard auto task: implemented directly, verified via `tsc --noEmit` + `eslint` + `next build` (all clean), matching the plan's own stated verification contract. No RED/GREEN/REFACTOR commits exist for Task 3 as a result — flagged here per the TDD Gate Compliance instruction rather than silently proceeding.

## Issues Encountered
- ESLint's `react-hooks/set-state-in-effect` rule flagged `EditableListTab`'s fetch-on-mount effect (synchronous `setIsLoading(true)` before the async call). Resolved with the same `eslint-disable-next-line` + comment already used for the identical situation in `PerdaMotivoDialog.tsx` (an established, intentional pattern in this codebase — not a new suppression).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `getListaValores`/`createListaValor` and `EditableListTab`/`ConfiguracoesTabs` are ready for 03-02 (add `updateListaValor`/`setListaValorAtivo`, edit-in-place row state, "Mostrar inativos" `Switch`) and 03-03 (wire the remaining 3 `TabsTrigger`/`TabsContent` pairs) to extend directly, with no rework expected.
- The interactive "add a value and see it appear" flow has not been visually/manually confirmed in a running browser by this executor (no browser-driving tool was available) — recommend a quick manual pass (or `/gsd-verify-work`) before considering ADM-01's UI slice fully signed off, per the `D1` coverage entry above.

---
*Phase: 03-administra-o-de-listas-edit-veis*
*Completed: 2026-07-17*

## Self-Check: PASSED

All 7 claimed files confirmed present on disk; all 3 task commit hashes (`9c3da13`, `ac91a30`, `cc0941b`) confirmed present in git history.
