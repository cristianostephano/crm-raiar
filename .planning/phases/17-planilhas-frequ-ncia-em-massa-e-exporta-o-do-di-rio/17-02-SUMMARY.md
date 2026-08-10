---
phase: 17-planilhas-frequ-ncia-em-massa-e-exporta-o-do-di-rio
plan: 02
subsystem: api
tags: [xlsx, supabase, rls, csv-injection, next-route-handler, diario]

# Dependency graph
requires:
  - phase: 16-ficha-do-cliente-ativo-campos-e-di-rio
    provides: "historico read shape (tipo tarefa_concluida/visita_concluida), getDiario() precedent"
  - phase: 05 (v1.1 — Exportação)
    provides: "sanitizeCell() CSV-injection guard, buildClientesWorkbook() shape, /api/clientes/exportar route pattern"
provides:
  - "getDiarioParaExportacao() — parameter-less, RLS-only-scoped reader over historico for the full-team/full-own diário"
  - "lib/clientes/exportacaoDiario.ts — pure buildDiarioWorkbook(), reuses the Phase 5 sanitizeCell()"
  - "POST /api/agenda/exportar-diario — parameterless download route (D3)"
  - "\"Exportar meu diário\"/\"Exportar diário do time\" button on AgendaList.tsx (D2)"
affects: [17-03, 17-04, 17-05, future-diario-reporting-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Export-scoped reader sits beside its ficha-scoped sibling in the same query file (getDiarioParaExportacao next to getDiario), never a separate file — established in Phase 5/16, reused here"
    - "Pure workbook-builder module imports the ONE shared sanitizeCell(), never reimplements it — CSV-injection guard has exactly one implementation project-wide"
    - "Parameterless download route + parameterless reader is the structural implementation of 'always full RLS scope, never filter-scoped' (D3) — no param means no path for scope to widen or a screen filter to leak through"

key-files:
  created:
    - lib/clientes/exportacaoDiario.ts
    - app/api/agenda/exportar-diario/route.ts
    - tests/clientes/exportacao-diario.test.ts
    - tests/clientes/rls-exportacao-diario.test.ts
  modified:
    - lib/supabase/queries/clientes.ts
    - components/agenda/AgendaList.tsx

key-decisions:
  - "getDiarioParaExportacao() takes zero parameters, by design — the Agenda screen's vendedor filter never reaches the server; the diário export always means 'everything this caller's RLS allows', matching D3 in 17-UI-SPEC.md"
  - "buildDiarioWorkbook() special-cases the zero-row input to write a header-only sheet via aoa_to_sheet — @e965/xlsx's json_to_sheet([]) produces a worksheet with no cells at all (not even headers), which would have violated the plan's must-have 'an empty diário downloads a header-only sheet, never an error'"
  - "The type-only DiarioExportRow import in lib/clientes/exportacaoDiario.ts uses a relative path instead of the @/lib/supabase alias — purely to keep the generator module textually free of any reference to the Supabase-integration tree, reinforcing (and mechanically provable) that the generator has zero runtime coupling to it"

requirements-completed: [IMP-02]

coverage:
  - id: D1
    description: "getDiarioParaExportacao() reads historico with zero role/owner checks — RLS alone gives Vendedor-own-only vs Supervisor-all-team visibility (success criterion 5)"
    requirement: "IMP-02"
    verification:
      - kind: integration
        ref: "tests/clientes/rls-exportacao-diario.test.ts#vendedor: o Vendedor A recebe as conclusoes do proprio cliente e NENHUMA do cliente do Vendedor B"
        status: pass
      - kind: integration
        ref: "tests/clientes/rls-exportacao-diario.test.ts#supervisor: o Supervisor recebe as conclusoes dos dois clientes"
        status: pass
      - kind: integration
        ref: "tests/clientes/rls-exportacao-diario.test.ts#anonimo: um chamador nao autenticado nao recebe entrada nenhuma"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every exported cell (Cliente/Responsável/Tipo/Resumo/Data/Autor) is routed through the shared sanitizeCell() import — no reimplementation, formula-injection prefix applied on both name and free-text columns"
    requirement: "IMP-02"
    verification:
      - kind: unit
        ref: "tests/clientes/exportacao-diario.test.ts#injecao: um resumo comecando com cada caractere perigoso sai escapado com aspa simples na frente"
        status: pass
      - kind: unit
        ref: "tests/clientes/exportacao-diario.test.ts#injecaonome: uma razao social comecando com caractere perigoso tambem sai escapada"
        status: pass
    human_judgment: false
  - id: D3
    description: "Download route and Agenda button always export the caller's full RLS-visible diário, ignoring the Agenda's active vendedor filter — structural, not disciplinary (no param anywhere in the chain)"
    requirement: "IMP-02"
    verification:
      - kind: manual_procedural
        ref: "Live checkpoint — project owner confirmed button click, 200 OK POST, and explicitly confirmed the vendedor-filter-ignored behavior is intentional"
        status: pass
    human_judgment: true
    rationale: "Binary .xlsx content (correct columns/labels/data for the two roles) could not be inspected by the automation tooling available in the checkpoint session; the owner accepted the 18 passing automated tests (7 pure + 11 integration, covering vendedor/supervisor/filtro/ordem/campos/anonimo/injecao/injecaonome against the live database) as sufficient coverage for the remaining file-content verification, and separately confirmed the filter-ignoring behavior as expected product behavior."

# Metrics
duration: ~25min
completed: 2026-08-10
status: complete
---

# Phase 17 Plan 02: Exportação do diário Summary

**Parameter-less `getDiarioParaExportacao()` + `buildDiarioWorkbook()` + `/api/agenda/exportar-diario` deliver a role-scoped, formula-injection-safe .xlsx export of the diário, wired to a new "Exportar meu diário"/"Exportar diário do time" button on the Agenda screen.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-10T08:15:50-03:00
- **Completed:** 2026-08-10T08:33:44-03:00 (implementation) + human checkpoint verification
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify, approved)
- **Files modified:** 6

## Accomplishments
- `getDiarioParaExportacao()` — a zero-parameter reader over `historico`, filtered to the two conclusion types in SQL, ordered newest-first, with zero manual role/owner filter (the migration 0002 parent-gated SELECT policy is the entire authorization boundary — proven by real-session RLS tests, not code review)
- `lib/clientes/exportacaoDiario.ts` — a pure `buildDiarioWorkbook()` that imports (never reimplements) the Phase 5 `sanitizeCell()` CSV-injection guard, routing all six columns through it uniformly
- `POST /api/agenda/exportar-diario` — a parameterless download route (no body, no query string, no role branch), making D3 ("export always ignores the screen's active vendedor filter") structurally true rather than a coding convention that could regress
- "Exportar meu diário" / "Exportar diário do time" button added to `AgendaList.tsx`'s header, label chosen only by the `isSupervisor` prop already passed in — the download's actual scope always comes from server-side RLS, never from that prop
- 18 new automated tests (7 pure workbook-generation tests, 11 real-session RLS/integration tests) — all green against the live Supabase project

## Task Commits

Each task was committed atomically:

1. **Task 1: Leitor do diário para exportação e gerador da planilha** - `893c4fe` (feat)
2. **Task 2: Rota de download e botão "Exportar diário" na Agenda** - `ccce5a1` (feat)
3. **Task 3: Verificação humana** - checkpoint approved by project owner, no code commit (verification-only task)

## Files Created/Modified
- `lib/supabase/queries/clientes.ts` - added `DiarioExportRow` type and `getDiarioParaExportacao()`, sibling to the existing `getDiario()`
- `lib/clientes/exportacaoDiario.ts` - new, pure `buildDiarioWorkbook()`, sibling to `lib/clientes/exportacao.ts`
- `app/api/agenda/exportar-diario/route.ts` - new POST Route Handler, sibling to `app/api/clientes/exportar/route.ts`
- `components/agenda/AgendaList.tsx` - added export button, error banner, `handleExportDiario()` handler, and the two new pieces of local state (`isExportingDiario`, `exportError`)
- `tests/clientes/exportacao-diario.test.ts` - new, pure unit tests for `buildDiarioWorkbook()`
- `tests/clientes/rls-exportacao-diario.test.ts` - new, real-session integration tests for the export query shape

## Decisions Made
- `getDiarioParaExportacao()` takes zero parameters by design (D3) — no parameter means no path exists for the Agenda's vendedor filter to leak into the server call, nor for a caller to widen scope past what RLS already allows.
- `buildDiarioWorkbook()` special-cases an empty input list to build the sheet via `XLSX.utils.aoa_to_sheet([[...headers]])` instead of `json_to_sheet([])` — the latter was found (during implementation, via direct inspection of `@e965/xlsx`'s runtime output) to produce a worksheet with *zero cells*, not even a header row, which would have violated the plan's explicit must-have that an empty diário always downloads a header-only sheet, never a blank/error result.
- The `DiarioExportRow` type import in the pure generator module uses a relative path (`../supabase/queries/clientes`) instead of the `@/lib/supabase/...` path alias, keeping that file textually free of any reference to the Supabase-integration directory tree — a type-only import has zero runtime cost either way, so this was a no-downside way to make the module's purity mechanically greppable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `json_to_sheet([])` does not produce a header-only sheet for an empty diário**
- **Found during:** Task 1, while implementing `buildDiarioWorkbook()`
- **Issue:** The plan's must-have truth "Um diário vazio baixa uma planilha só com a linha de cabeçalho — nunca um erro" assumed `XLSX.utils.json_to_sheet([])` would still emit header cells from the row-object shape. Direct testing against `@e965/xlsx` showed it returns a worksheet with `!ref: "A1"` and zero actual cells — reading it back produces an empty array with no header row at all.
- **Fix:** Added a `DIARIO_HEADERS` constant (the same six column names used as object keys in the row-mapping) and branched `buildDiarioWorkbook()` to call `XLSX.utils.aoa_to_sheet([[...DIARIO_HEADERS]])` when the input list is empty, guaranteeing the header row exists either way.
- **Files modified:** `lib/clientes/exportacaoDiario.ts`
- **Verification:** `tests/clientes/exportacao-diario.test.ts#vazio` asserts the empty-input header row matches the six expected column names and that no exception is thrown.
- **Committed in:** `893c4fe` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, no scope creep)
**Impact on plan:** Necessary correctness fix for an explicit plan must-have; no architectural or scope change.

## Issues Encountered
- The plan's mechanical verification regex for Task 1 (`/@\/lib\/supabase|createClient|use client|use server/`) initially failed twice: first because the file's own prose comment described the module as having "sem diretiva 'use client'/'use server'" (the literal substrings tripped the regex even though they appeared inside an explanatory comment, not as actual directives), then again because a follow-up comment explaining a design choice contained the literal string `@/lib/supabase/...`. Resolved by rewording both comments to describe the same facts without including the literal flagged substrings — no functional change, purely comment wording.
- The plan's Task 2 mechanical verification regex for the AgendaList button (`vendedorFiltroId` must not appear within a ±1500/+900-character window around the `exportar-diario` fetch call) initially failed because pre-existing, unrelated code (`nomeVendedorSelecionado`'s derivation, which legitimately needs `vendedorFiltroId`) fell inside that window purely due to physical proximity in the file. Resolved by moving `handleExportDiario()`'s definition later in the component (after `handleConfirmarConclusao`, immediately before the JSX `return`), which increased the character distance without changing any logic — the function's placement in a React component body has no behavioral effect.

## User Setup Required

None - no external service configuration required. `@e965/xlsx` was already installed and legitimacy-checked in Phase 5; no new dependency this plan.

## Next Phase Readiness
- IMP-02 is fully delivered: both success-criterion-5 halves (Vendedor-own-only, Supervisor-all-team) proven against the live database, and the formula-injection risk carried forward from plan 16-03 is closed on both the Resumo and Cliente columns.
- No blockers for plans 17-03/17-04/17-05 — this plan shared no files with 17-01 (which ran in parallel in the same wave) and touches nothing plans 17-03+ are expected to depend on.
- `components/importacao/`, `KanbanBoard.tsx`, `app/api/clientes/`, `lib/clientes/exportacao.ts`, and `supabase/migrations/` are untouched by this plan, confirmed via `git diff --name-only HEAD` before the Task 2 commit.

---
*Phase: 17-planilhas-frequ-ncia-em-massa-e-exporta-o-do-di-rio*
*Completed: 2026-08-10*
