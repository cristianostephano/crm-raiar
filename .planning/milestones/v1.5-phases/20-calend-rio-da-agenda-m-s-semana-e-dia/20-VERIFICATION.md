---
phase: 20-calend-rio-da-agenda-m-s-semana-e-dia
verified: 2026-08-18T15:55:43Z
status: passed
score: 5/5 ROADMAP success criteria verified (12/12 plan-level must-have truths sampled, all VERIFIED)
behavior_unverified: 0
overrides_applied: 0
---

# Phase 20: Calendário da Agenda — Mês, Semana e Dia — Verification Report

**Phase Goal:** O vendedor consegue olhar a própria Agenda como calendário (dia/semana/mês) além da lista que já existe, navegando por datas, sem perder nenhuma das informações que a Lista já dá.
**Verified:** 2026-08-18T15:55:43Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (ROADMAP Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Alterna Lista ↔ Calendário num clique; Lista se comporta exatamente como antes | ✓ VERIFIED | `AgendaList.tsx:103` adds one new state `visao` (default `"lista"`), composes `<AgendaCalendario>` before the empty/sections cut, then wraps the entire pre-existing Lista block (both empty states, three sections, titles, row mapping) in `visao === "lista"` — **byte-identical to what existed before**, only relocated inside a condition. `tests/agenda/agenda-list.test.tsx` (the pre-existing proof of Lista behavior) was **never touched during Phase 20** — confirmed via `git log` (last edit `2726609`, Phase 15, predates Phase 20's first commit `5121d01`) and `git diff 5121d01^ HEAD -- tests/agenda/agenda-list.test.tsx` (empty diff). All 210/210 tests in `tests/agenda/` pass, including this file unedited. |
| 2 | Escolhe mês/semana/dia, avança/volta, "Hoje" volta ao presente; semana começa segunda nas três visões | ✓ VERIFIED | Single exported `INICIO_DA_SEMANA = 1` (Monday) constant in `lib/agenda/itens.ts`, consumed identically by `diasDaGradeDoMes` and `diasDaSemana` (`weekStartsOn: INICIO_DA_SEMANA`) — no hand-written weekday order anywhere (mechanically enforced by each plan's verify script, and independently confirmed by reading all 3 view components). `navegarData(referencia, modo, passo)` steps by exactly 1 day/week/month per mode (tested, incl. the Jan-31→Feb clamp). `AgendaCalendarioToolbar`'s Anterior/Próximo/Hoje buttons call `AgendaCalendario`'s `handleAnterior/handleProximo/handleHoje`, which call `navegarData`/reset-to-`now`. Toolbar and nav wiring verified in `tests/agenda/agenda-calendario.test.tsx` (16 tests, incl. per-mode nav-step correctness and Hoje-resets-after-navigating-3-months-away). |
| 3 | Mês: até 3 itens + "+N", clique no dia abre lista completa; Semana: 7 colunas; Dia: mesmo card da Lista | ✓ VERIFIED | `dividirCelula(itens, MAX_ITENS_NA_CELULA=3)` called exactly once per month cell (`AgendaCalendarioMes.tsx:130`), visible chips + overflow destructured from the same result — sketch's exact reference case (7 items → 3 chips + "+4 mais") proven in test. `AgendaCalendarioSemana.tsx` renders `grid-cols-7` from `diasDaSemana`. `AgendaCalendarioDia.tsx` composes `AgendaItemRow` (the Lista's exact card) verbatim — confirmed `AgendaItemRow.tsx` was never edited (`git diff` empty since Phase 14). Clicking a month cell opens a `Dialog` whose body is the **same** `AgendaCalendarioDia` component (verified: `AgendaCalendarioDia` appears 3 times in `AgendaCalendario.tsx` — day-mode section + dialog body — no second item-listing component exists anywhere in the calendar). |
| 4 | Sinalização Prospecção(cinza)/Ativo(azul) preservada; atrasado legível mesmo em célula de mês vizinho | ✓ VERIFIED | All three calendar surfaces (`AgendaCalendarioDia`, `Semana`, `Mes`) import the exact same two icons as `AgendaItemRow.tsx` (`ClipboardCheck`, `Repeat` — confirmed by grep, identical import in all 4 files). Late-item accent applied via `cn()` with the `destructive` border class placed *last* so it overrides only the border-color channel, never the origin icon/color — proven in `agenda-calendario-mes.test.tsx`'s dedicated "Pitfall 9" test: a late item dated `2026-07-27` (the first, faded, other-month cell of August 2026's grid) keeps `.border-l-destructive` while the cell itself still carries `bg-muted/30` (independently re-read and confirmed). No raw sketch hex colors anywhere in any calendar file (`grep -n "#[0-9a-fA-F]{3,8}"` → 0 matches). |
| 5 | Supervisor filtra calendário por vendedor igual à Lista; contagens/chips acompanham o filtro | ✓ VERIFIED | `filtrarPorVendedor` appears exactly once in `AgendaList.tsx`; its result `itensFiltrados` feeds **both** the section grouping (`agruparAgenda(itensFiltrados)`) and `<AgendaCalendario itens={itensFiltrados} .../>` — the same array reference, not a second computation. `AgendaCalendario` computes `agruparPorData` once via `useMemo(() => agruparPorData(itens), [itens])`, so both the month and week grids read the identical `Map`. Independently re-read `tests/agenda/agenda-calendario-integracao.test.tsx`'s "coerência com o filtro de vendedor" test: filtering to "Alice" narrows both `Hoje (2)`→`Hoje (1)` in the Lista *and* the month grid (Bruno's item absent from both); reverting to "Todos" restores both. |

**Score:** 5/5 ROADMAP success criteria VERIFIED.

### Plan-Level Must-Haves (sample, cross-checked against code)

| Plan | Must-have | Status | Evidence |
|---|---|---|---|
| 20-01 | `INICIO_DA_SEMANA`/`MAX_ITENS_NA_CELULA` exported once, 9 new pure functions with exact signatures, 4 pre-existing functions untouched | ✓ VERIFIED | Read `lib/agenda/itens.ts` in full — matches interface_context exactly. `bucketDoItem`/`agruparAgenda`/`filtrarPorVendedor`/`vendedoresDaAgenda` unchanged (lines 85-154 identical in structure/doc to pre-Phase-20 version). |
| 20-01 | Day-bucketing compares string keys, never converts item date to a `Date` object | ✓ VERIFIED | `agruparPorData`/`itensDoDia`/`chaveDoDia` — read in full; `chaveDoDia` only converts object→text (never the reverse); `agruparPorData` uses `item.data` verbatim as map key. |
| 20-02 | `AgendaCalendarioDia` reuses `AgendaItemRow` verbatim (D-05); no new row markup | ✓ VERIFIED | Component composes `<AgendaItemRow item={item} atrasado={bucketDoItem(...)} .../>` — no `Badge`/icon/button markup of its own. |
| 20-02 | `AgendaCalendarioSemana` derives 7 cols from `diasDaSemana`; atraso accent additive, not replacing origem | ✓ VERIFIED | `diasDaSemana(referencia)` drives the grid; `WeekItemChip`'s `cn()` places `border-l-destructive` last. |
| 20-03 | Month grid: 2 independent booleans (`noMesVisivel`, `ehHoje`); dividirCelula called once/cell; +N mais bubbles to cell click | ✓ VERIFIED | `MonthDayCell` computes both booleans independently in `AgendaCalendarioMes.tsx:74-75`; chips/`+N mais` have no own `onClick`/`role`/`tabIndex`. |
| 20-04 | Toolbar 4-button switch (Lista/Dia/Semana/Mês) from a constant, gated nav+legend on nullable `rotulo`; container computes `porData` once via `useMemo` | ✓ VERIFIED | `OPCOES_DE_VISAO` constant iterated; `AgendaCalendario.tsx:79` single `useMemo`. |
| 20-04 | Day dialog reuses the exact same `AgendaCalendarioDia` component (D-03/D-05 chain closes) | ✓ VERIFIED | 3 usages of `AgendaCalendarioDia` in `AgendaCalendario.tsx` (import + day-mode render + dialog render), zero second item-list implementation. |
| 20-05 | Exactly one new state (`visao`) added to `AgendaList.tsx`, defaulting to `"lista"`; `filtrarPorVendedor`/`getAgendaAction` each called exactly once; both dialogs (`ClienteDetailSheet`/`ConcluirItemDialog`) mounted exactly once | ✓ VERIFIED | Confirmed by direct read + grep counts: 1× `filtrarPorVendedor(`, 1× `getAgendaAction(`, 1× `<ConcluirItemDialog`, 1× `<ClienteDetailSheet`. |
| 20-05 | `tests/agenda/agenda-list.test.tsx` passes with zero edits | ✓ VERIFIED | `git log` shows last edit at commit `2726609` (Phase 15); `git diff 5121d01^ HEAD -- tests/agenda/agenda-list.test.tsx` is empty. |
| all | Zero new npm dependency, zero new migration | ✓ VERIFIED | `git diff 5121d01^ HEAD -- package.json package-lock.json` empty; `git diff 5121d01^ HEAD -- supabase/migrations` empty. |
| all | No drag-and-drop introduced | ✓ VERIFIED | `grep -rn "dnd-kit\|draggable\|onDragStart\|useDraggable\|useDroppable" components/agenda/AgendaCalendario*.tsx` → 0 matches. |
| all | No debt markers (TBD/FIXME/XXX/TODO/HACK/placeholder-as-stub) in modified files | ✓ VERIFIED | Scanned all 7 phase-touched source files; only false-positive matches (a UI `placeholder` prop text, an unrelated code comment containing the substring "placeholder"). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `lib/agenda/itens.ts` | 2 constants, 2 types, 9 pure calendar functions, 4 pre-existing functions untouched | ✓ VERIFIED | Read in full; matches published interface_context exactly. |
| `components/agenda/AgendaCalendarioDia.tsx` | Day list reusing `AgendaItemRow` | ✓ VERIFIED | Read in full, matches contract. |
| `components/agenda/AgendaCalendarioSemana.tsx` | 7-column week grid | ✓ VERIFIED | Read in full, matches contract. |
| `components/agenda/AgendaCalendarioMes.tsx` | Month grid, chips, +N mais | ✓ VERIFIED | Read in full, matches contract. |
| `components/agenda/AgendaCalendarioToolbar.tsx` | Variante A toolbar | ✓ VERIFIED | Read in full, matches sketch structure (segmented switch, date-nav, legend; no mini-calendar sidebar). |
| `components/agenda/AgendaCalendario.tsx` | Composition root | ✓ VERIFIED | Read in full, owns only `referencia`/`diaDialogo` state, single `useMemo` grouping. |
| `components/agenda/AgendaList.tsx` | Toggle wiring, Lista block preserved | ✓ VERIFIED | Read in full; diff is surgical and additive around the pre-existing block. |
| `tests/agenda/*.test.{ts,tsx}` (9 new/extended test files) | Genuine, behavior-exercising coverage | ✓ VERIFIED | Spot-read `itens.test.ts`, `agenda-calendario-mes.test.tsx`, `agenda-calendario-integracao.test.tsx` — real assertions on rendered DOM/classes/callbacks, not smoke-only tests. All 210/210 pass (`npx vitest run tests/agenda/`, executed independently by this verifier). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `AgendaCalendarioMes`/`Semana` | `lib/agenda/itens.ts` grid functions | `diasDaGradeDoMes`/`diasDaSemana`/`INICIO_DA_SEMANA` | ✓ WIRED | Both components import and call these; no local `startOfWeek`/`eachDayOfInterval` arithmetic found in either file. |
| `AgendaCalendarioMes` cell click | `AgendaCalendario` dialog | `onSelecionarDia` → `setDiaDialogo` → `<Dialog>` body = `AgendaCalendarioDia` | ✓ WIRED | Traced end-to-end in `AgendaCalendario.tsx`; confirmed 3-site reuse. |
| `AgendaList.itensFiltrados` | `AgendaCalendario.itens` | `itens={itensFiltrados}` prop | ✓ WIRED | Same array reference feeds both the Lista's `agruparAgenda` call and the calendar; proven coherent under filter change by integration test. |
| Toolbar nav buttons | Reference-date navigation | `onAnterior`/`onProximo`/`onHoje` → `navegarData`/`now` | ✓ WIRED | `AgendaCalendario.tsx` handlers call the pure module functions; step-per-mode proven in tests. |
| `AgendaCalendarioDia`/`Semana`/`Mes` late-item styling | `bucketDoItem` (single lateness authority) | direct call with received `now` | ✓ WIRED | No `differenceInCalendarDays`/`isBefore`/`isAfter` found duplicated in any of the 3 view files (mechanically re-checked). |

### Behavioral Spot-Checks (executed independently by this verifier)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full agenda test suite | `npx vitest run tests/agenda/` | 17 files, 210/210 tests passed | ✓ PASS |
| Type check | `npx tsc --noEmit` | clean, no output | ✓ PASS |
| Lint | `npx eslint components/agenda tests/agenda lib/agenda` | clean, no output | ✓ PASS |
| Production build | `npx next build` | Compiled successfully, all 18 routes generated, no errors | ✓ PASS |
| Pitfall 9 regression (atrasado in other-month cell) | Read `tests/agenda/agenda-calendario-mes.test.tsx:243-258` | Item dated in the faded first cell of August's grid keeps `.border-l-destructive` while cell keeps `.bg-muted/30` | ✓ PASS |
| Pitfall 10 regression (+N follows narrowed set) | Read `tests/agenda/agenda-calendario-mes.test.tsx:260-286` | Narrowing from 7→4 items on rerender changes `+4 mais`→`+1 mais` coherently | ✓ PASS |
| Vendedor-filter coherence (SC 5) | Read `tests/agenda/agenda-calendario-integracao.test.tsx:214-266` | Filtering to Alice narrows Lista (`Hoje (2)`→`Hoje (1)`) and month grid together; reverting restores both | ✓ PASS |
| Lista test file untouched | `git diff 5121d01^ HEAD -- tests/agenda/agenda-list.test.tsx` | empty diff | ✓ PASS |
| Zero new deps / migrations | `git diff 5121d01^ HEAD -- package.json package-lock.json supabase/migrations` | empty diff | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| AGD-07 | 20-05 | Vendedor alterna entre Lista e Calendário | ✓ SATISFIED | `visao` state + toolbar switch, default Lista. |
| AGD-08 | 20-01 + 20-04 | 3 modos, navegação de data, botão "Hoje", semana começa segunda | ✓ SATISFIED | `navegarData`/`rotuloDoPeriodo`/`INICIO_DA_SEMANA` + toolbar wiring. |
| AGD-09 | 20-01 + 20-03 + 20-04 | Mês: até 3 itens + "+N"; clique abre lista do dia | ✓ SATISFIED | `dividirCelula` + `AgendaCalendarioMes` + dialog. |
| AGD-10 | 20-01 + 20-02 | Semana: 7 colunas | ✓ SATISFIED | `diasDaSemana` + `AgendaCalendarioSemana`. |
| AGD-11 | 20-01 + 20-02 | Dia: mesmo card da Lista | ✓ SATISFIED | `AgendaCalendarioDia` composing `AgendaItemRow`. |
| AGD-12 | 20-02 + 20-03 | Mesma sinalização visual Prospecção/Ativo | ✓ SATISFIED | Same icons/colors reused across all 3 views. |
| AGD-14 | 20-05 | Supervisor filtra calendário por vendedor | ✓ SATISFIED | `itensFiltrados` feeds both views; proven by integration test. |

No orphaned requirements — `REQUIREMENTS.md`'s Phase 20 mapping (AGD-07..12, AGD-14 — 7 requirements) is exactly the union of what the 5 plans declare, and all are marked Complete in `REQUIREMENTS.md`.

### Anti-Patterns Found

None. No debt markers, no stub returns, no empty handlers, no hardcoded-empty data flowing to render, no raw sketch hex colors, no drag-and-drop code, in any of the 7 phase-touched source files.

### Deferred / Out-of-Scope Item (not a phase gap)

**Vendedor-filter Select resets to "Todos" on any reload** — pre-existing bug in `AgendaList.tsx`'s `vendedorOpcoesDoFiltro`/`Select` wiring, confirmed via `git blame`/`git show` to already exist in commit `2726623` (Phase 15), well before Phase 20's first commit. Documented in `.planning/phases/20-calend-rio-da-agenda-m-s-semana-e-dia/deferred-items.md` with root cause and a recommended follow-up quick task. Phase 20's plan 20-05 explicitly forbids touching the vendedor-filter control, and this verifier independently confirmed the affected code (`const itens = state.status === "pronto" ? state.itens : []`) predates the phase. Correctly excluded from Phase 20's gap list.

### Human Verification

None outstanding. Plan `20-05-PLAN.md` Task 2 included an explicit `<human-check>` block (10-step browser walkthrough covering all 5 ROADMAP success criteria) that was already executed **during phase execution** — `20-05-SUMMARY.md` documents it as conducted with seeded test data (`ZZ-TESTE 20-05 *`, via service-role client, never via UI) and approved by the project owner ("tudo certo"). This verifier additionally independently confirmed, via static code reading, the structural/visual claims that browser check covered (color-token usage instead of raw sketch hex, icon reuse, grid column counts, Monday-first ordering, atraso-accent survival at grid edges) — consistent with the human sign-off.

### Gaps Summary

None. All 5 ROADMAP success criteria are independently verified against the actual codebase (not SUMMARY claims): code read in full for all 7 touched source files, all plan-level interface contracts matched exactly, 210/210 tests re-run and passing, `tsc`/`eslint`/`next build` all clean, and the two highest-risk claims (Lista completely unchanged; zero new dependencies/migrations) independently confirmed via `git diff`/`git log` against pre-phase commits rather than trusted from the summaries.

---

*Verified: 2026-08-18T15:55:43Z*
*Verifier: Claude (gsd-verifier)*
