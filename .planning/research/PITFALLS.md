# Pitfalls Research

**Domain:** Adding a calendar (day/week/month) view + "conclusão remota" to the existing CRM Raiar Agenda screen (v1.5)
**Researched:** 2026-08-17
**Confidence:** HIGH for codebase-specific findings (read directly from `supabase/migrations/`, `lib/agenda/`, `components/agenda/`, `app/actions/agenda.ts`, `app/actions/listas.ts`); MEDIUM for the date-fns/locale specific claim (single web source, but corroborated by an authoritative date-fns GitHub issue title).

This file deliberately skips generic calendar-UI or generic RLS advice — everything below is scoped to what breaks specifically in **this** codebase's existing conventions.

## Critical Pitfalls

### Pitfall 1: `agenda_do_vendedor()` only returns pending items — a calendar invites an expectation it can't fulfill

**What goes wrong:**
The moment a user can page a calendar backward to "last month," they expect to see what they *did* that month, the way Google Calendar shows past events. But `agenda_do_vendedor()` (migration `0014`/recreated in `0015`) filters `t.concluida = false` and `v.data_realizada is null` — a completed item disappears from the RPC's result set the instant it's concluded. `lib/agenda/itens.ts`'s `AgendaItem[]` is therefore always a "pending only" set, never a history.

If the calendar is built by literally reusing `getAgendaAction()`'s already-fetched `itens` (the natural, low-risk implementation, consistent with how `AgendaList.tsx` already filters/groups client-side), then navigating to a past month will render **empty cells for anything already completed**, even though real work happened that day. A vendedor who just concluded 5 visits last Tuesday and clicks back a page in the new calendar will see nothing on that Tuesday and reasonably think the app lost data.

**Why it happens:**
The milestone's stated scope ("Mesma sinalização visual... já usada na lista; só visualização") reads as "reuse the same items," and the SQL author of `agenda_do_vendedor()` in migration `0014` explicitly commented "não filtro de dono... a RLS é a única fronteira" — but never discusses a *time-window* filter, because the list view never needed to look backward (`bucketDoItem` only ever produces atrasado/hoje/próximos, all forward/present-facing).

**How to avoid:**
Confirm explicitly during Discuss/Plan whether "past" cells in month/week view are allowed to be empty (pending-only, matching the list 1:1 — cheapest, zero backend change) or must show completed items too (requires extending `agenda_do_vendedor()` or adding a second read path, out of the stated "view only" scope). Given `PROJECT.md`'s Out of Scope entry for v1.3 ("Calendário completo... uma lista ordenada por urgência já resolve") and this milestone's explicit non-goal of dragging/full recurrence, the low-risk reading is: **pending-only is intentional**, and the UI copy for past days with a `0` count should read neutrally ("Nenhum item pendente" — never "Nenhuma atividade"), not imply an empty history. Lock this down as a phase-planning decision, not an implementation-time guess.

**Warning signs:**
Any plan/spec that says "clique num dia do mês passado abre a lista completa daquele dia" without qualifying "itens pendentes daquele dia" — ambiguous phrasing here is exactly what produces the confusing empty-past-month experience.

**Phase to address:**
The phase that builds the month/week data-grouping logic (before any grid rendering) — should be settled at Discuss-phase, since it changes whether a backend RPC needs touching at all.

---

### Pitfall 2: Extending `concluir_tarefa_prospeccao`/`concluir_visita` breaks the ~6 existing integration test files if the new param isn't optional-with-default

**What goes wrong:**
`tests/agenda/agenda-rpc.test.ts`, `concluir-rpc.test.ts`, `rls-conclusao.test.ts`, and `conclusao-validacao.test.ts` all call `supabase.rpc("concluir_tarefa_prospeccao", { p_tarefa_id, p_resumo })` and `supabase.rpc("concluir_visita", { p_visita_id, p_resumo, p_proxima_data })` today, with no motivo parameter. Supabase's PostgREST RPC layer matches parameters **by name** (JSON object), not by position — so this project's own prior pattern (`mover_card_funil` growing from 5→6→7 params across Phases 13/18, `p_motivo_perda_id uuid default null` since migration `0002`) already proves the safe path: append the new parameter with `default null`, never make it required. If the new `p_motivo_conclusao_remota_id` (or whatever it's named) is added **without** a default, every one of those existing calls fails immediately with "function does not exist" or a missing-argument error — not a subtle bug, a hard test-suite break across 4+ files in one migration.

**Why it happens:**
It's tempting to make the new parameter required because "conclusão remota" feels like a real decision point (presencial vs remoto) rather than an optional add-on like `p_motivo_perda_id` was. But the RPC's existing contract is "presencial is the default, remote is the exception" — so nullable-with-default is not just safe, it's the correct modeling (`null` = presencial, non-null = remoto with that reason), mirroring exactly how `motivo_perda_id` encodes "not lost" as `null` rather than a separate boolean column.

**How to avoid:**
- Add the parameter as the **last** positional argument in the SQL signature with `default null`, on **both** RPCs (see Pitfall 3 for why both must change together).
- Do not introduce a separate boolean (`p_remoto boolean`) alongside the reason id — a non-null reason id already encodes "this was remote," same as `motivo_perda_id`'s existing pattern. Two fields for one fact is an easy way to end up with an invalid state (`p_remoto = true, p_motivo = null`).
- Re-run the existing agenda test files after the migration, unmodified — they should still pass with zero changes, proving backward compatibility. If any of them need edits just to keep passing, that's a signal the parameter was added wrong (not just "tests need updating for the new feature," which is expected only for *new* test cases, not the old ones).

**Warning signs:**
Existing tests calling these RPCs start failing with a Postgres "function ... does not exist" or "no function matches the given name and argument types" error right after the migration — a `create or replace function` doesn't allow removing/reordering existing positional params either, but appending one with a default is safe and won't trigger this.

**Phase to address:**
The phase that touches migration `0021`+ for conclusão remota — should be planned as "extend both RPCs, prove old call shape still works" as an explicit acceptance criterion, not just "add motivo support."

---

### Pitfall 3: `concluir_tarefa_prospeccao` and `concluir_visita` are twin RPCs — a motivo change applied to only one of them silently breaks the "visita" half of the feature

**What goes wrong:**
The two conclusion RPCs are structurally near-identical (migration `0015`, sections 5 and 6: same resumo guard, same "0 rows = not found or already concluded" idempotency check) but are two **separate** `create or replace function` statements, called from two separate wrapper functions in `app/actions/agenda.ts` (`concluirTarefaProspeccao` / `concluirVisita`), routed by `AgendaList.tsx`'s `handleConfirmarConclusao` based on `concluirItem.origem`. It is entirely possible to update `concluir_tarefa_prospeccao`'s signature and forget `concluir_visita` (or vice versa), because they live in different sections of the same file and nothing enforces they stay in sync — unlike, say, a single shared function both call into.

Since `ConcluirItemDialog.tsx` is **one shared component** for both origins ("a janela ÚNICA de conclusão," per its own doc comment), a UI that renders the motivo picker unconditionally (not gated by `origem`) will call whichever action wrapper is missing the parameter and get a runtime RPC error specifically for visita completions (or prospecção completions) while the other origin works fine in manual testing — an easy miss if only one origin is spot-checked.

**Why it happens:**
The two RPCs were deliberately kept as separate functions (not one parameterized function) precisely because their bodies diverge past the shared guard (visita also computes `proxima_data_visita`) — but that same divergence is what makes it easy to edit one and skip the other.

**How to avoid:**
Treat "add motivo to concluir_tarefa_prospeccao" and "add motivo to concluir_visita" as a single atomic task in the plan, in the same migration file, with a single verification step that exercises both call paths (prospecção AND visita) end-to-end, not just one.

**Warning signs:**
A plan/PR that touches migration SQL for only one of the two functions, or a test file update that only adds cases to `concluir-rpc.test.ts`'s prospecção block without a matching visita block.

**Phase to address:**
Same phase as Pitfall 2 — the backend RPC-extension phase, verified by a symmetric test pass (both origins).

---

### Pitfall 4: The historico-writing triggers must be updated too, or the motivo silently never reaches the diário

**What goes wrong:**
The actual audit trail (`historico.descricao`, and therefore the client-facing "diário") is written by `tarefas_before_update_historico()` and `visitas_after_update_historico()` (migration `0015`, sections 3–4) — **not** by the RPCs themselves. Both triggers currently build `descricao` from `new.resumo` only:
```sql
case when new.resumo is not null and btrim(new.resumo) <> '' then btrim(new.resumo)
     else 'Tarefa marcada como concluída' end
```
If the RPCs are extended to accept/store a motivo but the two trigger functions are left untouched, the motivo is saved on `tarefas`/`visitas` but **never appears in `historico`**, and therefore never appears in the diário the milestone explicitly requires ("Conclusão remota conta como conclusão normal — entra no diário do cliente"). This is exactly the kind of "looks done" bug this project has hit before: migration `0019`'s discovery that `importar_clientes_lote`'s `jsonb_to_recordset` silently dropped `cnpj`/`nome_fantasia` because a second piece of the pipeline wasn't updated in lockstep with the first.

There is a second, subtler trap here even if the trigger IS updated: the project has **no existing precedent for surfacing a reason-list's display name inside `historico`**. Check `clientes_after_update_historico()` (migration `0002`): when a client is marked "perdido," the historico row is literally `format('Status alterado para "%s"', new.status_acompanhamento::text)` — it never joins `motivos_perda` to embed the reason's `nome`. If the new trigger is written by copying that precedent literally, it will stamp the raw `motivo_conclusao_remota_id` (a UUID) into `historico.descricao`, or omit it entirely — neither is acceptable for a field meant to be human-readable in a non-technical owner's diário.

**How to avoid:**
- Update both `tarefas_before_update_historico()` and `visitas_after_update_historico()` in the same migration that extends the RPCs, adding a `select nome into ... from motivos_conclusao_remota where id = new.motivo_conclusao_remota_id` (or equivalent join) so the trigger embeds the **resolved reason text**, not the id, into `historico.descricao` — e.g. `resumo || ' (concluído remotamente: ' || v_motivo_nome || ')'`.
- Because `historico.descricao` is written once and never re-read against the live lookup table afterward (mirrors the already-locked decision that renaming a `frequencias_pedido` value never propagates to `clientes.frequencia_pedidos`, migration `0016`), this text snapshot is correctly immutable — a Supervisor renaming a "Motivo de conclusão remota" value later must not silently rewrite historical diário entries. Confirm this snapshot behavior explicitly as intended, not accidental.
- Add a direct integration test asserting the resulting `historico.descricao` string contains the resolved motivo text (not just that a row was inserted) — the existing trigger tests likely only assert insertion happened, not content correctness for this new case.

**Warning signs:**
A diário export (`/api/agenda/exportar-diario`) that shows the same generic text for remote and in-person completions, or shows a raw UUID string in a spreadsheet cell.

**Phase to address:**
Same backend phase as Pitfalls 2–3; verification must explicitly read back `historico.descricao` after a remote completion, not just check the RPC returned success.

---

### Pitfall 5: The 6th Supervisor-editable list can silently leave Vendedor with an empty, non-erroring dropdown

**What goes wrong:**
This project's own migration `0016` comment names this exact failure mode for the previous new list (`frequencias_pedido`): *"Restringi-la ao Supervisor por engano deixaria o campo permanentemente vazio para todo Vendedor, sem dar erro nenhum — é o modo de falha silenciosa mais caro desta migration."* All 5 existing editable lists use an identical 4-policy RLS shape: `SELECT` open to **any authenticated user**, `INSERT`/`UPDATE`/`DELETE` gated by `is_supervisor()`. A 6th list ("Motivos de conclusão remota") that copy-pastes this pattern but fat-fingers the `SELECT` policy to `using (is_supervisor())` instead of `using (true)` will compile fine, pass a Supervisor-only smoke test, and only surface as "the dropdown has no options" the first time a Vendedor tries to complete a remote item — with zero error thrown, since an empty result set from an RLS-filtered SELECT is indistinguishable from "the table happens to be empty."

**How to avoid:**
Copy the RLS block from migration `0016` (`frequencias_pedido`) verbatim, changing only the table name — do not write the 4 policies from scratch. Add an explicit RLS integration test (mirroring the project's existing `tests/agenda/rls-agenda.test.ts` / `rls-conclusao.test.ts` pattern) that logs in as a **Vendedor** (not Supervisor) and asserts a non-empty `SELECT` on the new table.

**Warning signs:**
Manual verification performed only by the Supervisor account (this project's Fase 19 checkpoint notes explicitly seed both roles for exactly this reason — "par de nome ambíguo... semeado... nunca pela UI").

**Phase to address:**
The migration phase that creates the 6th table — verification step must include a Vendedor-role read check, not just a Supervisor CRUD check.

---

### Pitfall 6: The 6th list must be registered in three separate places, and the type system only catches one of them for free

**What goes wrong:**
Adding a new editable list to "Configurações" isn't just a migration. It requires three coordinated changes:
1. `app/actions/listas.ts` — add the new table name to the `ListaTabela` union type.
2. `components/configuracoes/ConfiguracoesTabs.tsx` — add a new entry to the `TABS` array (label, `inputPlaceholder`, `pluralAtivoLabel`), inside a `TabsContent` with `keepMounted` set (already-documented pitfall: Base UI unmounts inactive `TabsPanel`s and silently re-fetches/flashes "Carregando" on every switch without it — found in Fase 3's checkpoint).
3. `supabase/migrations/00XX_motivos_conclusao_remota.sql` — the table + RLS itself (Pitfall 5).

TypeScript will catch a missing `ListaTabela` union entry wherever the new table is *referenced* by name in typed code, but will **not** catch forgetting step 2 entirely — a migration + union-type update with no `ConfiguracoesTabs.tsx` entry compiles cleanly and the Supervisor simply has no UI to manage the list at all, discovered only by manual click-through.

**How to avoid:**
Since `getListaValores`/`createListaValor`/etc. in `listas.ts` are already fully generic (`supabase.from(tabela)`, no per-table switch statement), no server-side logic branches on the specific table name — the only two places to touch are the type union and the `TABS` array. Make this a literal checklist item in the plan for this migration's UI-side plan, cross-referenced against `frequencias_pedido`'s Fase 16-01/16-02 diff as the "did I touch everywhere Fase 16 touched" template.

**Warning signs:**
Migration is pushed and RLS tests pass, but "Configurações" screen shows only 5 tabs.

**Phase to address:**
Same phase as Pitfall 5, its UI counterpart plan (mirrors 16-01→16-02 split: schema first, then screen wiring).

---

### Pitfall 7: Month/week grid boundary-day generation invents a second, uncoordinated "which day is this" authority

**What goes wrong:**
Every date-comparison decision in this codebase today lives in exactly one place: `lib/agenda/itens.ts`'s `bucketDoItem` (parseISO + `differenceInCalendarDays`, never `new Date(isoString)`, documented with an explicit warning about the fuso-horário bug this project already hit once). Building a month/week grid introduces a **new kind of date logic this project has never needed before**: enumerating calendar cells (including partial weeks at the start/end of a month) and testing "does this item's date fall in this cell." If that logic is written ad hoc inside the calendar component using `new Date(item.data)` (instead of `parseISO(item.data)`) to test membership, it reintroduces the exact fuso-horário bug from Phase 15's own commit history — an item dated `2026-09-01` would render one cell early in São Paulo's UTC-3, exactly the class of bug `bucketDoItem`'s doc comment warns about.

A second, distinct trap: the grid-generation code itself (which day cells to draw) is pure calendar arithmetic with no timezone component (it never touches an item's date string) — so `startOfMonth`/`endOfMonth`/`eachDayOfInterval` on `Date` objects is safe there. The risk is conflating the two: using the *browser's local* `new Date()` for "today" highlighting (fine, matches `bucketDoItem`'s own `now: Date = new Date()` default) is different from using a raw `new Date(stringFromDatabase)` to place an *item* in a cell (not fine).

**How to avoid:**
- Any function that maps an `AgendaItem.data` (a `YYYY-MM-DD` string) onto a grid cell must go through `parseISO`, never the `Date` constructor — same rule as `bucketDoItem`.
- Grid-cell generation (which days exist in this month/week view) should live in one new pure file (e.g. `lib/agenda/calendario.ts`, dependency-free like `lib/agenda/itens.ts`), tested in isolation, and reused identically by month view, week view, and the "Hoje" navigation button — not reimplemented per view. This mirrors the project's own repeated pattern of centralizing "the one true way to answer this question" (see `agruparAgenda`'s doc comment on why it never re-sorts, or `ComparativoVendedorTable`'s single-ordering-authority precedent).
- "Today" for highlighting purposes should reuse the same `now: Date = new Date()` default-parameter convention `bucketDoItem` already establishes, so tests can pin it the same way `itens.test.ts` presumably already does.

**Warning signs:**
A calendar cell showing an item one day off from its list-view position for the same underlying item — the fastest way to catch this in review is comparing the same test fixture dates against both `bucketDoItem` and the new grid-membership function.

**Phase to address:**
The phase building the month/week/day grouping logic, before any visual grid component — same phase implied by Pitfall 1's data-scope decision.

---

### Pitfall 8: `startOfWeek`/`endOfWeek` are not locale-aware by default — a hardcoded or divergent `weekStartsOn` misaligns month and week views

**What goes wrong:**
date-fns's `startOfWeek`/`endOfWeek` default to `weekStartsOn: 0` (Sunday) globally, and — despite accepting a `locale` option — do **not** automatically derive `weekStartsOn` from a passed locale object (this is a known, named date-fns limitation: date-fns/date-fns#3829, "Feature request: Make `startOfWeek` locale aware"). Passing `{ locale: ptBR }` to `startOfWeek` changes month/weekday *names* if formatted nearby, but does **not** change which day the week starts on — that still requires an explicit `weekStartsOn` number. If the month-grid code and the week-column code each hardcode their own `weekStartsOn` literal (one remembers to set it, one forgets and gets the date-fns default), the two views will disagree about which day is "start of week" — a bug that's easy to miss in isolated testing of each view but jarring the moment a user switches between month and week and sees Tuesday land in different grid columns.

**How to avoid:**
Decide the first-day-of-week convention once (confirm with the project owner — Brazilian consumer calendar apps commonly start Sunday, but this is a business decision, not a technical default) and define it as a single exported constant (e.g. `WEEK_STARTS_ON = 0` in the same `lib/agenda/calendario.ts` from Pitfall 7), imported by every grid/column-generation call — never a bare numeral literal repeated in month view, week view, and any "Hoje" jump logic.

**Warning signs:**
Month view and week view rendered side by side (or navigated between) show the same date under different weekday columns.

**Phase to address:**
Same phase as Pitfall 7 — bake the constant into the shared calendar-math module from the start rather than retrofitting later.

---

### Pitfall 9: Month-grid "leading/trailing days from adjacent months" break the existing `isSameMonth`-style overdue/today visual language if reused carelessly

**What goes wrong:**
The sketch (003, Variant A) shows a month grid where the first and last rows necessarily include a few days from the previous/next month to complete the 7-column weeks. This project's kanban and agenda already have a well-established "overdue" red-highlight convention (`isOverdue`/atrasado styling). If that same highlight logic is applied naively to *every* cell showing a pending item without first checking whether the cell belongs to the currently-viewed month, a leading-edge trailing-month day (e.g., "28, 29, 30" from August shown in September's grid) with an overdue item could visually dominate the wrong month's view, or — the opposite failure — get incorrectly dimmed/suppressed by generic "not this month" styling and hide a genuinely overdue item from view when the user is actually looking at the relevant month.

**How to avoid:**
Keep two independent visual states per cell explicit in the component's props from the start: "is this day inside the currently-viewed month" (dims styling only) and "is this item atrasado" (reuses `bucketDoItem`'s existing atrasado computation, unaffected by which month is being viewed). Do not let one boolean drive both.

**Warning signs:**
An overdue item from the tail end of last month rendered with full-opacity red urgency styling inside next month's dimmed leading cells, or conversely invisible because "dimmed" styling overrode "atrasado" styling.

**Phase to address:**
Same grid-rendering phase as Pitfalls 7–8, as an explicit UAT checklist item ("switch to a month where the 1st is not a Sunday/Monday and confirm adjacent-month overdue items still read as urgent").

---

### Pitfall 10: Dense month cells — the "+N" overflow counter and click targets need to survive the existing vendedor filter and reload-key convention

**What goes wrong:**
`AgendaList.tsx` already has a working, tested local filter (`vendedorFiltroId` via `filtrarPorVendedor`) applied client-side over the already-fetched `itens`, plus a `reloadKey` that re-fetches after any completion. A month grid's "+N mais" chip counter (sketch 003 shows a day with 7 items collapsing to 3 chips + "+4") must be computed **after** `filtrarPorVendedor` runs, from the same filtered set the list view uses — not from the raw unfiltered `itens`. Computing the counter from the unfiltered set would show a Supervisor viewing "Todos os vendedores" one count, but after picking a specific vendedor the badge counts would not update to match, since the grid and the counter would be reading two different arrays. This is the same class of bug the project's own `showResponsavel`/`vendedorFiltroId` logic in `AgendaList.tsx` was carefully built to avoid for the list view — the calendar view must not accidentally reintroduce it by deriving counts from a different data source.

A second, purely UX concern given this is a desktop-first, non-technical-user internal tool (not a touch device): a 7-day-wide grid with 5-6 rows leaves each day cell only a few dozen pixels tall once a header/date-number is subtracted — a "+4 mais" text link needs a real clickable hit area (padding, not just tight text), and each of the up-to-3 visible chips needs to remain individually clickable to open that item's `ConcluirItemDialog`/`ClienteDetailSheet ` (same click affordance the list rows already have via `onOpen`/`onConcluir`), not just the day cell as a whole triggering a single "show day" action. Conflating "click a chip" and "click the day" into the same target is an easy way to make individual-item actions unreachable except through the day's full-list popover.

**How to avoid:**
- Reuse `filtrarPorVendedor(itens, vendedorFiltroId)`'s output as the single source both the list view *and* the calendar grid consume — never compute month/week/day groupings from the pre-filter `itens` array.
- Keep the sketch's own stated interaction model explicit in the plan: chips are visual-only summaries (color + short label, matching the existing gray/blue prospecção/ativo language from `AgendaItemRow.tsx`), clicking a day cell (or its "+N") always opens "the full list for that day" (reusing the existing list-row component, not a second row implementation) rather than trying to make every chip independently actionable inside the cramped grid cell itself — this sidesteps the click-target-size problem entirely per the sketch's own design ("clique no dia abre a lista completa daquele dia"), and is the safer reading of "Visão de dia reaproveita o card da lista atual."

**Warning signs:**
Chip count in a day cell doesn't match the count shown once you open that day's full list, when a vendedor filter is active.

**Phase to address:**
The month-grid rendering phase — verification should explicitly re-run the "switch vendedor filter, confirm month-grid counts update" case the list view's existing tests already cover for buckets.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Client-side-only month/week/day grouping over the already-fetched pending-only `itens` array (no new RPC, no date-range params) | Zero backend risk, reuses `getAgendaAction()` as-is | Calendar can never show completed items in past months without a later RPC change (Pitfall 1) | Acceptable for this milestone — matches the stated "view only, same items as the list" scope; revisit only if the project owner explicitly asks for a history view later |
| Reusing the existing `AgendaItemRow` component inside a day's full-list popover instead of building a calendar-specific row | Guarantees visual consistency (colors/badges) with zero duplicate styling code | None significant — this is the correct reuse, not a shortcut with a real cost | Always |
| Storing `motivo_conclusao_remota_id` as a nullable FK on `tarefas`/`visitas` (mirrors `motivo_perda_id`) rather than copying text directly onto those tables | Matches existing schema convention, no redesign | The FK's live value can be repointed if someone edits/deactivates a list row later — the *displayed* audit text must be frozen into `historico.descricao` at completion time (Pitfall 4), not re-derived from the FK on every later read | Never skip the historico text-snapshot step — only acceptable shortcut is skipping a *second* denormalized text column directly on `tarefas`/`visitas` itself, since `historico` already carries the frozen text |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Supabase PostgREST RPC calls (`supabase.rpc(...)`) | Assuming argument order matters for backward compatibility when extending a function signature | PostgREST matches by parameter **name** (JSON object), so existing calls stay valid as long as names/types of pre-existing params are untouched and new params have defaults — position in the SQL signature is irrelevant to old callers, but `create or replace function` still forbids removing/reordering pre-existing typed params |
| date-fns `startOfWeek`/`endOfWeek` + `locale` option | Assuming passing `{ locale: ptBR }` makes the week start on the locale's conventional day | `locale` only affects names/formatting; `weekStartsOn` must be passed explicitly and centralized (Pitfall 8) |
| Base UI `Tabs`/`TabsContent` (already used by `ConfiguracoesTabs.tsx`) | Adding a 6th `TabsContent` without `keepMounted` | Every `TabsContent` in this file must carry `keepMounted` — Base UI unmounts inactive panels and re-fetches on every switch otherwise (documented root cause from Fase 3's checkpoint) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Re-fetching `getAgendaAction()` on every month/week navigation click (treating calendar nav like a new query) | Visible network round-trip / loading flash on every "próximo mês" click for a dataset small enough to have loaded once already | Fetch once (existing `useEffect`/`reloadKey` pattern in `AgendaList.tsx`), do all month/week/day slicing client-side over the already-loaded `itens` — same principle already applied to the vendedor filter | Would only become a real backend cost concern at a client/task volume far beyond a single sales team's realistic pipeline size; not a near-term risk given the free-tier egress constraint already documented in `STACK.md` |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| New `motivo_conclusao_remota_id` param trusted from the client without server-side re-validation | A tampered/forged reason id (or a deactivated list row's id) gets written straight through, same class of risk the resumo guard already defends against (`app/actions/agenda.ts` re-validates resumo server-side even though the RPC also guards it) | Re-validate the motivo id exists (and is `ativo`, if inactive rows shouldn't be selectable going forward) inside the RPC itself via a `select 1 from motivos_conclusao_remota where id = ... and ativo` guard, mirroring the resumo length guard's fail-closed pattern — don't rely on the dropdown only ever offering valid ids |
| 6th list's `SELECT` policy accidentally scoped to Supervisor-only | Not a data leak, but a silent functional block for every Vendedor (Pitfall 5) — listed here because it's the *inverse* of the usual RLS mistake (usually RLS is too open; here the risk is RLS too narrow) and this codebase's existing lists all correctly stay `using (true)` for reads | Copy migration `0016`'s RLS block verbatim |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| Past months in the calendar rendering as silently empty for completed work (Pitfall 1) | Vendedor thinks the app lost their history | Neutral empty-state copy ("Nenhum item pendente neste dia," never implying "nothing happened") + confirm the pending-only scope explicitly during Discuss so it's a stated decision, not a surprise |
| Chips in a dense month cell trying to be independently clickable for every action (concluir, abrir ficha) inside a tiny grid cell | Mis-clicks, frustration for non-technical desktop users | Day cell / "+N" opens the existing full-list view for that day (reusing `AgendaItemRow`) rather than cramming every action into the grid cell itself (Pitfall 10) |
| Month and week views disagreeing on which weekday a date falls under (Pitfall 8) | Confusing, looks like a bug even when both views are individually "correct" by different rules | Single shared `WEEK_STARTS_ON` constant |

## "Looks Done But Isn't" Checklist

- [ ] **Conclusão remota RPCs:** Confirm BOTH `concluir_tarefa_prospeccao` AND `concluir_visita` accept and store the new motivo param — verify by testing a remote completion through each origin, not just one (Pitfall 3).
- [ ] **Diário/historico text:** Confirm `historico.descricao` for a remote completion contains the resolved motivo **name**, not a raw UUID and not silently omitted — read the row back after calling the RPC, don't just check for success (Pitfall 4).
- [ ] **6th list end-to-end:** Confirm a Vendedor account (not just Supervisor) can see the new motivo dropdown populated, AND that the new tab appears in "Configurações" with `keepMounted` set (Pitfalls 5–6).
- [ ] **Calendar grid date fidelity:** Confirm an item placed near a month boundary (e.g. the 31st) renders in the correct grid cell by comparing against the same item's placement in the existing list view's atrasado/hoje/próximos bucket for the same date (Pitfall 7).
- [ ] **Calendar + vendedor filter interaction:** Confirm switching the Supervisor's vendedor filter updates month-grid "+N" counts, not just the list view's counts (Pitfall 10).
- [ ] **Existing test suite untouched:** Run the pre-existing `tests/agenda/*.test.ts` files after the RPC-extension migration with zero modifications and confirm they still pass — any edit required to keep them green is a signal of a breaking (not additive) change (Pitfall 2).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Historico trigger missing motivo text (Pitfall 4) | LOW | Recreate the two trigger functions with the join added; no data migration needed for *future* completions, but already-written historico rows from before the fix stay generic text forever (matches this project's existing "renaming a list value doesn't retroactively rewrite history" posture) — acceptable, communicate to the owner if any remote completions happened during the gap |
| RLS SELECT policy too narrow on the 6th list (Pitfall 5) | LOW | Single `drop policy` + `create policy ... using (true)` migration, no data affected |
| Calendar grid using `new Date(isoString)` instead of `parseISO` (Pitfall 7) | LOW–MEDIUM | Swap the parsing call in the one shared `lib/agenda/calendario.ts` module (if centralized per the recommended approach) — cost scales with how many places duplicated the mistake, which is exactly why centralizing it first keeps this cheap |
| Existing RPC callers broken by a non-default new param (Pitfall 2) | MEDIUM | `create or replace function` again with the param made `default null`; requires a second migration file (never edit a pushed migration in place, per this project's own hard rule against altering applied migrations) |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| 1. Pending-only scope surprises calendar users | Discuss-phase decision, confirmed before the grouping-logic phase | Explicit product decision recorded in `PROJECT.md` Key Decisions before implementation |
| 2. Breaking existing RPC callers | Backend RPC-extension phase | Full existing `tests/agenda/*.test.ts` suite passes unmodified |
| 3. Twin-RPC divergence | Backend RPC-extension phase | Both origins (prospecção + visita) exercised in the same verification pass |
| 4. Historico trigger missing motivo | Backend RPC-extension phase | Read back `historico.descricao` after a remote completion in the test |
| 5. RLS too narrow on 6th list | Migration phase for the new list | Vendedor-role RLS read test |
| 6. 6th list missing from `ConfiguracoesTabs.tsx`/`ListaTabela` | UI-wiring phase for the new list | Manual click-through: "Configurações" shows 6 tabs |
| 7. Grid date-membership using raw `Date` construction | Calendar grouping-logic phase | Cross-check a boundary-date item's cell against its existing list-view bucket |
| 8. Week-start convention drift between views | Calendar grouping-logic phase | Single shared constant, unit-tested once |
| 9. Adjacent-month overdue styling conflict | Calendar grid rendering phase | Manual UAT on a month whose 1st isn't the configured week-start day |
| 10. Overflow counter / vendedor filter desync | Calendar grid rendering phase | Toggle vendedor filter, confirm counts match the list view |

## Sources

- `.planning/PROJECT.md` — Key Decisions table, v1.5 milestone scope, Out of Scope history (v1.3's explicit deferral of a full calendar).
- `.planning/STATE.md` — Blockers/Concerns, accumulated conventions, SECURITY DEFINER exception count.
- `supabase/migrations/0002_clientes_and_funil.sql` — original `motivos_perda` RLS pattern, `clientes_after_update_historico()` (precedent for historico NOT resolving FK display names today).
- `supabase/migrations/0014_agenda_do_vendedor.sql` / `0015_conclusao_com_resumo.sql` — `agenda_do_vendedor()` pending-only filter, `concluir_tarefa_prospeccao`/`concluir_visita` bodies, both historico trigger functions.
- `supabase/migrations/0016_frequencias_pedido.sql` — 6th-list RLS precedent and its own documented "silent empty dropdown" warning.
- `lib/agenda/itens.ts`, `components/agenda/AgendaList.tsx`, `components/agenda/ConcluirItemDialog.tsx`, `app/actions/agenda.ts`, `app/actions/listas.ts`, `components/configuracoes/ConfiguracoesTabs.tsx` — direct code read for existing date-handling, filter, and list-CRUD conventions. Confidence: HIGH (primary source, this repository).
- `.planning/sketches/003-agenda-calendario/README.md` — approved calendar sketch's stated interaction model (no drag, day/list reuse, "+N" chip counter).
- WebSearch: "date-fns ptBR locale weekStartsOn default startOfWeek" — confirms date-fns's global Sunday default and the `startOfWeek`/locale non-awareness limitation (date-fns/date-fns#3829). Confidence: MEDIUM (web synthesis referencing an authoritative but not directly-fetched GitHub issue).

---
*Pitfalls research for: CRM Raiar v1.5 — Calendário na Agenda e Conclusão Remota*
*Researched: 2026-08-17*
