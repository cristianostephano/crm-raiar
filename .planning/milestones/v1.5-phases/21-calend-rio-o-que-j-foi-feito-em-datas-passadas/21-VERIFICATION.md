---
phase: 21-calend-rio-o-que-j-foi-feito-em-datas-passadas
verified: 2026-08-19T21:35:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 21: Calendário — O Que Já Foi Feito em Datas Passadas — Verification Report

**Phase Goal:** Navegar para uma data passada no calendário mostra também o que já foi concluído naquele dia — o calendário vira um registro do que aconteceu, não só do que está em aberto.
**Verified:** 2026-08-19
**Status:** passed
**Re-verification:** No — initial verification

## Method

This verification did not trust SUMMARY.md claims. Every truth below was checked against the actual codebase: the migration file was read in full, the RPC's presence and shape were confirmed live against the hosted Supabase project (`npx supabase migration list`), git history was used to prove `agenda_do_vendedor()` has zero diff since Phase 20, and the full relevant test suite (85 pure-function tests, 109 component/container tests, and 32 live-database integration tests across `agenda-concluidos-rpc.test.ts`, `agenda-rpc.test.ts`, and `rls-agenda.test.ts`) was executed directly by the verifier — not read from a prior report.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria, Phase 21)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Navigating to a past month/week/day shows items already completed that day, alongside pendentes — a day with completed work never appears empty | ✓ VERIFIED | `agenda_concluidos_do_vendedor(p_inicio, p_fim)` (migration 0021, confirmed live via `supabase migration list`: local=0021, remote=0021) returns completed tarefas/visitas by real completion date. `AgendaCalendario.tsx` fetches this per visible interval (`intervaloDeHistorico`), merges with pendentes via `mesclarAgenda`, and both feed the single `agruparPorData` map that all 3 views + day dialog read. Proven by 11/11 passing integration tests (`agenda-concluidos-rpc.test.ts`, run live against the hosted DB) covering origin, real-vs-scheduled date, timezone, interval cutoff, pending exclusion, and empty scheduling columns; and 12 container tests in `agenda-calendario-historico.test.tsx` (all passing) covering the merge appearing in the grid. |
| 2 | A completed item is visually distinct from a pending one and does not offer the "conclude" action again | ✓ VERIFIED | `AgendaItemRow.tsx`: the Concluir button block is conditionally not rendered when `item.concluido === true` (absence, not disabled-state, confirmed by reading the JSX — `{concluido ? null : (<Button>...Concluir</Button>)}`), a "Concluído" badge (emerald-600 + CheckCircle2) is shown alongside the origin badge, and `mostraAtraso = atrasado && !concluido` suppresses the overdue triangle unconditionally for completed items. The same pattern is repeated identically in `WeekItemChip` (AgendaCalendarioSemana.tsx) and `MonthItemChip` (AgendaCalendarioMes.tsx). Clicking still calls `onOpen` (opens the client sheet), never a conclude dialog — `AgendaCalendario.tsx`'s `handleOpen` only ever calls `onOpenCliente`. Backed by 109/109 passing component tests. Backend defense-in-depth (pre-existing, Phase 15, untouched): `concluir_tarefa_prospeccao`/`concluir_visita` `UPDATE ... WHERE id = ... AND concluida = false` — a second conclude attempt is a no-op at the DB layer regardless of UI. |
| 3 | The Agenda Lista continues showing only pendentes — no change in its behavior nor in the menu badge count | ✓ VERIFIED | `AgendaList.tsx`'s Lista rendering path (`secoes`/`itensFiltrados`/`AgendaItemRow` block, lines ~357-403) is untouched — the only diff in the whole file since Phase 20's close (`d7e90d1`) is a single line passing `vendedorFiltroId={vendedorFiltroId}` to `<AgendaCalendario>` (git diff: 7 insertions, 1 deletion). The Lista's data source (`state.itens` from `getAgendaAction()`) never merges with the historic/`concluidos` fetch, which lives entirely inside `AgendaCalendario.tsx` and is never surfaced to the Lista. The menu badge (`app/(app)/layout.tsx` → `getAgendaPendentesCount()`) is untouched by this phase's diff (`git diff --stat` on `app/` since Phase 20 shows only `app/actions/agenda.ts` changed). `agenda-list.test.tsx` (1-line diff — only the new action's test double declared, zero case/assertion changes) passes. |
| 4 | Vendedor sees only own history, Supervisor sees the whole team's, with the same vendor filter already used by the calendar/list | ✓ VERIFIED | `agenda_concluidos_do_vendedor()` has zero authorization logic in its body (no role check, no `auth.uid()`, no owner filter — confirmed by reading the SQL) and carries no `security definer` clause, so RLS on `tarefas`/`visitas`/`clientes` is the sole authorization boundary, exactly mirroring `agenda_do_vendedor()`. Proven live against the hosted DB by the two new RLS boundary tests in `rls-agenda.test.ts` (both passing): `historicovendedor` (Vendedor B receives zero rows of Vendedor A's history) and `historicosupervisor` (Supervisor receives Vendedor A's history row). In the browser layer, `AgendaCalendario.tsx` applies the exact same `filtrarPorVendedor` function to the fetched history (`concluidosFiltrados`) that `AgendaList.tsx` already applies to pendentes, memoized by `[concluidos, vendedorFiltroId]` — confirmed by code read and by the passing "trocar o vendedor filtrado estreita também os concluídos" container test. |
| 5 | Navigating between months stays immediate — never downloads the vendor's entire history at once | ✓ VERIFIED | Server-side: `agenda_concluidos_do_vendedor` requires both `p_inicio`/`p_fim` (no defaults — a full-history call is impossible), and two supporting range indexes (`idx_tarefas_concluida_em`, `idx_visitas_data_realizada`) are created by the same migration, confirmed live. The interval filter compares the completion timestamp against instant-converted bounds (not per-row date casts), which is what allows the index to be used. Additionally, `getAgendaConcluidosAction` applies `validarIntervaloHistorico` (45-day cap, `INTERVALO_HISTORICO_MAX_DIAS`) *before* any DB call — confirmed by reading `app/actions/agenda.ts`. Client-side: the fetch effect in `AgendaCalendario.tsx` depends on exactly two interval **strings** (`intervaloInicio`/`intervaloFim`), never the `referencia` Date or the `intervalo` object (both re-created every render) — verified by code read and by the passing "re-render sem mudança de período não dispara busca nova" and "navegar para outro período dispara exatamente uma busca nova" container tests. |

**Score:** 5/5 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0021_agenda_concluidos_do_vendedor.sql` | New RPC + 2 indexes, `agenda_do_vendedor()` untouched, no `security definer` | ✓ VERIFIED | File read in full (146 lines). Exactly one function + two `create index if not exists`. No `security definer`, no `alter table`, no destructive command, no role/owner check in body. Applied live in production — `npx supabase migration list` shows local `0021` == remote `0021`. |
| `lib/agenda/itens.ts` (`estaAtrasado`, `mesclarAgenda`, `intervaloDeHistorico`) | Pure functions, `concluido?` optional field | ✓ VERIFIED | All three exported with the exact signatures from the plan's interface contract; `concluido?: boolean` confirmed optional; the 12 pre-existing exported functions are all still present. 85/85 pure-function unit tests pass (includes `itens.test.ts` + `conclusao-validacao.test.ts`). |
| `lib/validations/agenda.ts` (`validarIntervaloHistorico`) | 45-day cap, guard-of-resource not authorization | ✓ VERIFIED | `INTERVALO_HISTORICO_MAX_DIAS = 45` confirmed; boundary tests exist and pass (45 accepted, 46 rejected — `differenceInCalendarDays`). |
| `lib/supabase/queries/agenda.ts` (`getAgendaConcluidos`) | Reuses single `mapRow`, marks `concluido: true` | ✓ VERIFIED | Single `mapRow` function in the file, reused by both `getAgenda`/`getAgendaConcluidos`; the new function is the only place `concluido: true` is set. |
| `app/actions/agenda.ts` (`getAgendaConcluidosAction`) | Session check, interval guard before DB, no route revalidation | ✓ VERIFIED | Confirmed by reading the function body: auth check → `validarIntervaloHistorico` → only then `getAgendaConcluidos`. No `revalidatePath` call within this action. |
| `components/agenda/AgendaCalendario.tsx` | Owns history fetch by visible interval, filters, merges once | ✓ VERIFIED | Confirmed: single `useEffect` keyed on two interval strings, single `filtrarPorVendedor` call on the historic set, single `mesclarAgenda` call, single `agruparPorData` call. Header comment updated (old "no data reading" claim no longer present — grep confirms). |
| `components/agenda/AgendaList.tsx` | Only change: pass `vendedorFiltroId` down | ✓ VERIFIED | `git diff --stat` since Phase 20 close: 7 insertions, 1 deletion — Lista block untouched. |
| `components/agenda/AgendaItemRow.tsx`, `AgendaCalendarioDia/Semana/Mes.tsx`, `AgendaCalendarioToolbar.tsx` | Completed-item visual treatment, `estaAtrasado` used instead of `bucketDoItem` directly, 4th legend entry | ✓ VERIFIED | All confirmed by direct code read; `bucketDoItem` no longer called directly in any of the three calendar views (only via `estaAtrasado`); toolbar has 4 legend entries (Prospecção/Visita/Atrasado/Concluído). |

### Data-Flow Trace (Level 4)

`AgendaCalendario.tsx`'s `concluidos` state is populated exclusively by `getAgendaConcluidosAction` → `getAgendaConcluidos` → live `supabase.rpc("agenda_concluidos_do_vendedor", ...)` call — no static/hardcoded fallback, confirmed by reading the full data path with no early-return stub. The RPC itself queries `tarefas`/`visitas` joined to `clientes`/`tipos_tarefa`/`profiles` with real `WHERE` filters (`concluida = true`, `data_realizada is not null`) — not a static empty return. Status: ✓ FLOWING.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `AgendaCalendario.tsx` | `getAgendaConcluidosAction` | `useEffect` keyed on 2 interval strings | ✓ WIRED | Confirmed; effect body calls the action, sets `concluidos`/`historicoFalhou` state. |
| `getAgendaConcluidosAction` | `agenda_concluidos_do_vendedor` (Postgres) | `getAgendaConcluidos` → `supabase.rpc(...)` | ✓ WIRED | Confirmed live: RPC exists in production (migration list), integration tests pass against it. |
| `AgendaList.tsx` | `AgendaCalendario.tsx` | `vendedorFiltroId` prop | ✓ WIRED | Confirmed by grep + diff — the exact same state driving `filtrarPorVendedor` for pendentes is passed down. |
| `estaAtrasado` | `AgendaCalendarioDia/Semana/Mes.tsx` | direct import/call | ✓ WIRED | `bucketDoItem` no longer called directly in these 3 files (grep confirms only `estaAtrasado(` calls remain for the atraso decision). |

### Behavioral Spot-Checks / Test Execution (run live by this verifier, not read from prior reports)

| Suite | Command | Result | Status |
|-------|---------|--------|--------|
| Pure functions (`itens.test.ts`, `conclusao-validacao.test.ts`) | `npx vitest run ...` | 85/85 passed | ✓ PASS |
| Components/containers (9 files: item row, 3 calendar views, toolbar, historico, calendario, list, integração) | `npx vitest run ...` | 109/109 passed | ✓ PASS |
| New completed-items RPC integration (`agenda-concluidos-rpc.test.ts`) | `npx vitest run ...` (against hosted Supabase) | 11/11 passed | ✓ PASS |
| Pending-agenda RPC, zero-edit regression proof (`agenda-rpc.test.ts`) | `npx vitest run ...` (against hosted Supabase) | 11/11 passed | ✓ PASS |
| RLS boundary tests incl. 2 new AGD-13 cases (`rls-agenda.test.ts`) | `npx vitest run ...` (against hosted Supabase) | 10/10 passed | ✓ PASS |
| `npx tsc --noEmit` | project-wide | clean, exit 0 | ✓ PASS |
| `npx eslint` (all phase-21 touched paths) | components/agenda, lib/agenda, lib/validations, app/actions/agenda.ts, lib/supabase/queries/agenda.ts, tests/agenda | clean, exit 0 | ✓ PASS |

### Migration / Production State

`npx -y supabase@2.111.0 migration list` (queried live against the linked hosted project): local and remote match exactly through `0021` — the RPC is genuinely live in production, not merely committed to the repo.

### Timezone Handling (América/São_Paulo)

Confirmed real in the SQL, not just documented: `(t.concluida_em at time zone 'America/Sao_Paulo')::date as data` (projected column) and both interval bounds — `t.concluida_em >= (p_inicio::timestamp at time zone 'America/Sao_Paulo')` / `< ((p_fim + 1)::timestamp at time zone 'America/Sao_Paulo')` — use the same timezone. The `fuso` integration test case (23h30 completion staying on the same day) passed live against the hosted DB.

### 45-Day Range Cap

Enforced server-side: `getAgendaConcluidosAction` calls `validarIntervaloHistorico(inicio, fim)` and returns an `intervalo_invalido`/error result *before* calling `getAgendaConcluidos` — confirmed by reading the action's control flow. The cap is not merely a client-side convenience; it's applied inside the Server Action, which is the actual public entry point. Boundary-tested (45 accepted, 46 rejected).

### `agenda_do_vendedor()` — Zero Diff Since Phase 20

`git log --oneline` on `supabase/migrations/0014_agenda_do_vendedor.sql` and `0015_conclusao_com_resumo.sql` shows no commits touching either file since they were authored in Phase 14/15; `git diff --stat d7e90d1 HEAD -- supabase/migrations/0014_agenda_do_vendedor.sql supabase/migrations/0015_conclusao_com_resumo.sql` (d7e90d1 = Phase 20's closing commit) returns empty. Migration 0021 only *references* `agenda_do_vendedor()` in a comment explaining it is not recreated — confirmed by grep, it never calls `create or replace function agenda_do_vendedor`.

### SECURITY DEFINER Exception Count

`grep -rn "security definer" supabase/migrations/*.sql -i` confirms migration 0021 contains no `security definer` clause (only a comment stating "No `security definer` — nao adicionar."). Cross-checked the project's pre-existing exception set (is_supervisor, desativar/reativar_membro_equipe, cidades_com_clientes_por_estado — matching STATE.md's "4 exceptions" narrative) plus two separate, pre-existing, already-documented buckets (the `handle_new_user()` auth trigger and 4 historico-audit trigger functions from migrations 0002/0015) — none of these were touched or added to by Phase 21. No 5th exception was introduced.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AGD-13 | 21-01, 21-02, 21-03, 21-04 | Calendário mostra itens já concluídos ao navegar para datas passadas; Lista continua só pendente | ✓ SATISFIED | Marked `[x]` complete in `REQUIREMENTS.md`; all 5 ROADMAP success criteria verified above with live evidence, not just SUMMARY claims. |

No orphaned requirements found for this phase (REQUIREMENTS.md's Phase 21 row lists only AGD-13, matching the single plan-declared requirement across all 4 plans).

### Anti-Patterns Found

None. Scanned all 12 files modified/created outside of `tests/` for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"coming soon"/"not yet implemented" — zero matches. No stub `return null`/hardcoded-empty patterns found on the data path (traced end-to-end in Data-Flow Trace above).

### Scope Discipline

`git diff --stat d7e90d1 HEAD` (Phase 20's close → current HEAD, excluding `.planning/`) touches exactly the 25 files declared across the four plans' `files_modified` frontmatter — no more, no fewer. Phase 22 files (`ConcluirItemDialog.tsx`, `app/actions/listas.ts`, `ConfiguracoesTabs.tsx`) show zero diff. `package.json`/`package-lock.json` show zero diff (no new npm dependency, matching the "zero dependência npm nova" decision).

### Human Verification Required

None outstanding. Plan 21-04's Task 3 blocking human-verify checkpoint was conducted and approved by the project owner ("tudo certo") against a 12-step browser roadmap covering all 5 ROADMAP success criteria, using seeded test data via the service-role client (avoiding the known Supabase Auth rate limit) that was deleted afterward — this is documented in `21-04-SUMMARY.md`'s "Verificação Humana" section with concrete seed details (5 `ZZ-TESTE 21-04 *` clients, specific dates, specific scenarios). This class of check (visual/interactive browser confirmation) is not independently re-runnable by this verifier, but it was genuinely conducted per the plan's blocking-checkpoint gate (not skipped), and every other truth it covers has independent code/test evidence above.

### Gaps Summary

No gaps found. All 5 ROADMAP success criteria for Phase 21 are verified with concrete, independently-reproduced evidence: the migration is live in production (confirmed via `supabase migration list`, not assumed), the timezone/index/cap mechanisms are real in the SQL and server action (read directly, not inferred from comments), `agenda_do_vendedor()` has a provably empty diff since Phase 20, no 5th `SECURITY DEFINER` exception was introduced, and 226 tests (85 pure + 109 component + 32 live-database integration) were executed by this verifier and all passed. Scope discipline holds — no Phase 22 files were touched, no new dependencies were added.

---

_Verified: 2026-08-19_
_Verifier: Claude (gsd-verifier)_
