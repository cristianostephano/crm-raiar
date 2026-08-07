# Pitfalls Research — v1.3 Agenda do Vendedor

**Domain:** Retrofitting recurring-schedule + unified-agenda + graduated-entity-field features onto an existing Supabase/Postgres (RLS-only auth) schema with real production rows, on Vercel Hobby (no dedicated background-worker infra)
**Researched:** 2026-08-07
**Confidence:** MEDIUM-HIGH (schema/RLS findings verified directly against this repo's own migrations — HIGH; Vercel cron limits and Postgres NOT NULL migration mechanics cross-checked across multiple independent sources — MEDIUM; recurring-date timezone bug patterns synthesized from multiple community reports of the same failure mode — MEDIUM)

This file assumes the reader already knows this codebase: `clientes` is a 1:1 funnel-card model (`supabase/migrations/0002_clientes_and_funil.sql`), `tarefas`/`historico` are RLS-gated via an `EXISTS`-on-`clientes` parent policy (no RLS inheritance from the parent table), `historico` has **no user INSERT policy** (only `SECURITY DEFINER` triggers write it), and `mover_card_funil` is the existing precedent for "RPC that enforces a business rule with a `CHECK`-constraint-style guard, not `SECURITY DEFINER`." The Agenda milestone repeats several of these same shapes — recurrence, multi-table writes, graduated required fields — at a point where `clientes`/`tarefas`/`historico` already hold real rows, which is what makes this milestone materially riskier than v1.0's greenfield schema.

## Critical Pitfalls

### Pitfall 1: `new Date("2026-08-07")` and friends — the next-visit-date suggestion lands on the wrong day

**What goes wrong:**
The frequência-based "próxima data sugerida" (semanal/quinzenal/mensal) is computed either in the browser or on the server, and the two disagree by one day — or the suggestion itself silently lands a day earlier/later than the frequency implies. The classic root cause: `new Date("2026-08-14")` in JavaScript parses the string as **UTC midnight**, not local midnight. Rendered in `America/Sao_Paulo` (UTC−3), that becomes `2026-08-13 21:00` — so any `.getDate()`/`.toLocaleDateString()` call downstream shows the 13th, not the 14th. This is independently one of the most commonly reported bugs in recurring-task systems (Microsoft To Do, Discourse, Obsidian Tasks plugins all have open issues from exactly this).

**Why it happens:**
The existing `tarefas.data_conclusao` is a plain Postgres `date` (no time/timezone component) and the app has gotten away without a rigorous date-handling convention because tasks are input manually, one at a time, by a human picking a date on a calendar widget — there's no server-side date *arithmetic* anywhere in the codebase yet. Agenda's "sugerir próxima data" is the first feature that does `data + intervalo` math, and `date-fns`'s `addWeeks`/`addMonths` (already in the stack) are timezone-safe *only* if fed a genuine local `Date` object — the danger is constructing that `Date` from an ISO string returned by Supabase (`YYYY-MM-DD`), which reintroduces the UTC-midnight bug.

**How to avoid:**
- Keep `data_prevista`/`data_conclusao` on the new visit-tracking table as plain `date` (no `timestamptz`), matching `tarefas` — this sidesteps timezone entirely for storage.
- Compute the suggested next date **in Postgres**, not in the browser: `p_data_ultima_visita + (case frequencia when 'semanal' then interval '7 days' when 'quinzenal' then interval '14 days' when 'mensal' then interval '1 month' end)`, inside the same RPC that records the visit completion. Postgres's `date + interval '1 month'` correctly clamps (Jan 31 + 1 month = Feb 28/29), matching `date-fns`'s `addMonths` behavior — pick one authority (the RPC) and never duplicate the math client-side.
- If the client ever needs to *preview* the suggestion before confirming (e.g., an optimistic UI), parse the `date` string with `date-fns`'s `parseISO` (which treats the string as local, not UTC) — never `new Date(dateString)`.
- Write one Vitest unit test asserting `mensal` from Jan 31 lands on Feb 28 (non-leap) and Feb 29 (leap), matching the "card atrasado" date-logic testing convention `STACK.md` already establishes for this project.

**Warning signs:**
- A vendor reports "eu marquei a visita de sexta e o sistema sugeriu quinta" (off-by-one).
- Any code path that does `new Date(row.data_prevista)` where `row.data_prevista` came straight from a Supabase `select()`.
- Suggested date for `mensal` frequency lands on day 31 of a 30-day month (should have clamped).

**Phase to address:**
The phase that builds the "concluir visita → sugerir próxima data" RPC. This must be designed and tested before the Agenda UI phase consumes it, since the UI has no way to detect a silently-wrong date.

---

### Pitfall 2: Visit completion is really a 3-table write (visita status + `historico` resumo + next-visit row) — doing it as separate client calls loses atomicity and silently breaks `historico`

**What goes wrong:**
Completing a visit needs to: (1) mark the visit done, (2) insert a `historico` row with the vendor's resumo, and (3) create/update the next pending visit row per the confirmed frequency. If the frontend does this as three sequential Supabase client calls instead of one RPC, a failure between steps 2 and 3 leaves the client's agenda in an inconsistent state (visit shows "done" but no next visit was scheduled, or no resumo was recorded) — and there's no visible error, because each call "succeeded" on its own. Worse: **`historico` currently has zero user-facing INSERT policy** (`supabase/migrations/0002_clientes_and_funil.sql` — only the `SECURITY DEFINER` triggers `clientes_after_update_historico`/`tarefas_before_update_historico` can write it). A naive implementation will either (a) try a direct client insert into `historico` and get silently rejected by RLS (empty-result-shaped failure, not an exception, per this project's own prior pitfall research), or (b) "fix" it by adding a permissive user-facing INSERT policy on `historico`, which lets any authenticated user forge history entries for *any* client, not just their own — a real authorization regression.

**Why it happens:**
The existing pattern (`tarefas_before_update_historico`) writes `historico` automatically as a side effect of a *single* row transition (task flips to `concluida`), with a fixed, code-generated description string. Agenda's resumo is free text supplied by the vendor at completion time — it doesn't fit the "trigger writes a canned string" pattern, so it's tempting to bypass triggers with a direct insert, which is exactly where the RLS gap bites.

**How to avoid:**
- Build one `SECURITY INVOKER` RPC (mirroring `mover_card_funil`'s pattern, not `desativar_membro_equipe`'s `SECURITY DEFINER` exception) that does all three writes inside a single PL/pgSQL function body, wrapped implicitly in one transaction. The function runs as the calling user, so the existing RLS `UPDATE`/`SELECT` policies on `clientes`/visits still gate which rows it can touch — no new privilege escalation.
- Extend the `historico`-writing trigger (or add a new one) to accept the resumo as part of the visit-completion `UPDATE`, the same way `tarefas_before_update_historico` reads `NEW`/`OLD` — keep `historico` INSERT `SECURITY DEFINER`-trigger-only, matching the existing documented invariant. Do not add a user-facing INSERT policy to `historico`.
- Test this specifically as a Vendedor (not Supervisor) completing a visit on their own client — confirm exactly one `historico` row and one next-visit row are created, and that a failed step rolls back the whole RPC (a raised exception inside PL/pgSQL rolls back its own transaction automatically).

**Warning signs:**
- Resumo text is missing from a client's history despite the vendor swearing they typed it in.
- Any new `create policy ... on historico for insert` appears in a migration diff — treat this as a stop-and-review signal, not routine.
- Visits marked complete with no corresponding next-visit row (orphaned completions).

**Phase to address:**
The phase implementing "concluir visita" — design the RPC and its trigger/`historico` interaction before the UI is built, since the UI's optimistic-update logic (`@tanstack/react-query`) needs to know it's calling one atomic operation, not three.

---

### Pitfall 3: Graduated required fields (Nome Fantasia, CNPJ, frequências) as a blanket `CHECK`/`NOT NULL` will fail the migration outright against existing "ganho" rows

**What goes wrong:**
The requirement is "these fields are only required once a client is 'ativo'" — but `clientes` already has real "ganho" rows from before this migration ships, none of which have Nome Fantasia/CNPJ/frequência de visitas populated. If the migration adds these columns with `NOT NULL` (even guarded by a `CHECK` like the existing `chk_perdido_exige_motivo` pattern: `check (status_acompanhamento <> 'ganho' or nome_fantasia is not null)`), Postgres validates the constraint against **every existing row** at `ALTER TABLE` time by default — the migration itself fails to apply in production because pre-existing "ganho" clientes violate it immediately. This is exactly the situation `chk_perdido_exige_motivo` never had to face, because it shipped on day one with zero rows in the table.

There's a second, more fundamental gap here worth flagging before any migration is written: **"ativo" is not yet a defined state in this schema.** The milestone context says fields are gated on "quando o cliente vira 'ativo,'" but the existing enum is `status_acompanhamento` (`em_andamento`/`perdido`/`ganho`) — there's no `ativo` value or column anywhere. Is "ativo" a synonym for `status_acompanhamento = 'ganho'`, or a new, separate lifecycle state (e.g., a client can be "ganho" but not yet "ativo" until onboarding finishes)? This needs an explicit answer in Discuss before any schema is written, because it changes which existing rows the migration needs to consider "already past the gate."

**Why it happens:**
It's natural to reach for the same `CHECK`-constraint idiom already used successfully for `motivo_perda`, without noticing the precondition that made it safe then (an empty table) no longer holds now (a populated table).

**How to avoid:**
- Resolve the "ativo" definition question in Discuss first — do not let it get implicitly decided by whichever column name a migration happens to use.
- Add the new columns as nullable, with no blanket `CHECK`. Enforce "required once ativo" the same way `mover_card_funil` enforces "motivo obrigatório ao perder" — as an explicit guard *inside the RPC that performs the ativo/ganho transition*, raising a readable exception if the fields are missing, rather than a table-level constraint. This makes the rule enforceable going forward without ever touching historical rows.
- If a table-level `CHECK` is still wanted for defense-in-depth, add it with `NOT VALID` (`alter table clientes add constraint chk_ativo_exige_dados check (...) not valid;`) so Postgres skips validating existing rows, and only enforces the rule on future `INSERT`/`UPDATE`. Explicitly decide (with the product owner, in plain language) whether pre-existing "ganho" clients missing Nome Fantasia/CNPJ should be flagged for manual backfill or left as-is — don't let this be an accidental side effect of constraint choice.
- Whatever is decided, write it down as a Key Decision in `PROJECT.md`, the same way the `motivos_perda`/soft-delete decisions were — this is the kind of ambiguity that silently reappears as a bug report three months later otherwise.

**Warning signs:**
- `supabase db push` (or the migration apply step) fails with a `CHECK` constraint violation error listing existing row IDs.
- A vendor opens an existing "ganho" client from before the migration and the UI crashes or shows a broken form because it assumes Nome Fantasia/CNPJ are always present once `ganho`.

**Phase to address:**
The phase that adds the new `clientes` columns — must run a query against production data (`select count(*) from clientes where status_acompanhamento = 'ganho'`) before deciding the constraint strategy, not after.

---

### Pitfall 4: Trying to auto-generate the next visit via a scheduled/background job when the existing architecture deliberately has none

**What goes wrong:**
"On completing a visit, the system suggests the next date" sounds adjacent to "a nightly job scans for clients whose next-visit date has passed and creates a reminder" — and that second shape is a background job, which this project's `CLAUDE.md`/`STACK.md` explicitly avoid (no separate Node backend, "sem notificações ativas... destaque visual no kanban já resolve o problema" was an explicit v1.0 decision). If Agenda's implementation reaches for a cron-triggered Edge Function to pre-compute "overdue" or auto-create next-visit rows, it's solving a problem the existing `tarefas`/kanban "cards parados" feature already solved without a scheduler: **compute "atrasada" and the suggested date at read time**, inside the same query/view that renders the Agenda list, not via a batch job that runs ahead of time and writes state.

Worth noting precisely, since it's easy to get wrong in either direction: Vercel's Hobby plan *does* now support cron jobs (up to 100 per project), but capped at once-per-day cadence — so a daily job isn't technically impossible on this project's plan, but it's still the wrong tool here. A once-a-day cron can't atomically participate in the same transaction as "vendor clicks conclude visit," and it reintroduces exactly the staleness/timing complexity ("did today's cron already run before this visit was completed?") that computing everything on-the-fly avoids entirely.

**Why it happens:**
Recurring-schedule features read, on the surface, like they need a scheduler — "recurring" implies "something runs periodically." But the actual recurrence here is driven by a *user action* (completing a visit), not by wall-clock time; the "reminder" is just a sort/filter on a `data_prevista` column that's already sitting in the table.

**How to avoid:**
- Both the next-visit-date computation (Pitfall 1) and the "is this item overdue" flag happen inside the visit-completion RPC and the Agenda read query, respectively — never in a scheduled job.
- If a true wall-clock trigger is ever needed later (e.g., a daily digest email), treat that as new scope requiring an explicit cost/complexity conversation per `CLAUDE.md`'s "não introduzir novas dependências/serviços externos sem antes explicar" rule — not something to reach for by default while building Agenda v1.

**Warning signs:**
- Any `supabase/functions/` directory proposal for Agenda that isn't handling something genuinely external (there's nothing external here — no email/SMS in scope).
- A plan that mentions "cron" or "scheduled function" anywhere in Agenda's design.

**Phase to address:**
Should be settled as an explicit architectural constraint stated up front in the Agenda phase's plan, so it never gets proposed mid-implementation as a "clean" solution to the next-date problem.

---

### Pitfall 5: Unified Agenda built as two client-side fetches merged in JavaScript instead of one server-side sorted source

**What goes wrong:**
The Agenda view needs one chronologically sorted list mixing existing prospecção `tarefas` and new post-sale `visitas`, each with different parent-table shapes and different RLS-gating tables. The easy-to-reach-for approach — fetch `tarefas` (open, not concluída) and fetch `visitas` (pending) as two separate Supabase queries, then `.concat().sort()` client-side — has three compounding problems specific to this project: (1) it can't paginate correctly (page 1 of a merged, client-sorted list requires fetching *all* rows of both sources up front, defeating any `limit()`); (2) each row typically also needs `cliente.razao_social`/`responsavel` for display, so a naive implementation does a second round-trip per source (or worse, per row) to resolve that — an N+1 pattern; (3) this project has an explicit, already-documented cost constraint (Supabase free-tier egress cap, `STACK.md`: "Cache dashboard aggregates... keeps egress low against the 5GB/month free-tier cap") that a full-table-fetch-then-merge pattern works directly against.

**Why it happens:**
There's no existing precedent in this codebase for merging two heterogeneous tables into one sorted feed — the dashboard RPCs (`dashboard_funil_detalhado`, etc.) all aggregate a *single* source (`clientes`). Agenda is the first feature that needs a `UNION ALL`-shaped read, and reaching for "just fetch both and merge in the component" is the path of least resistance for someone extending existing `@tanstack/react-query` hooks that already fetch `tarefas` and `clientes` separately.

**How to avoid:**
- Build a single Postgres view or `SECURITY INVOKER` RPC (same family as the existing dashboard RPCs) that does `select ... from tarefas ... union all select ... from visitas ...`, normalized to a common shape (`id, tipo, cliente_id, razao_social, responsavel, data_prevista, atrasada`), with `order by data_prevista` and pagination (`limit`/`offset`) applied in SQL, not in the client. `UNION ALL` over two RLS-protected tables preserves each source's row-level filtering (Postgres evaluates RLS on the underlying tables before the union), so a Vendedor still only sees their own rows without any extra logic in the view.
- Add (or confirm) an index on whatever date column drives the sort in each source table (`tarefas.data_conclusao` already lacks one — only `idx_tarefas_cliente_id` exists today; add `idx_tarefas_data_conclusao` and its `visitas` equivalent) so the union's sort doesn't degrade as row counts grow.
- Select only the columns the Agenda list actually renders — don't `select *` on either side of the union, matching the existing "narrow `select()`" convention already stated in `STACK.md`.

**Warning signs:**
- Agenda screen visibly slows down as more clients accumulate visits/tarefas (a client-merge implementation degrades linearly with total row count, not with what's actually displayed).
- Network tab shows two-plus round trips per Agenda page load, or a round trip per row.
- No `limit`/pagination on the Agenda query at all.

**Phase to address:**
The phase that builds the Agenda list/view itself — this is the single highest-leverage design decision in the whole milestone, since every other Agenda feature (filtering, overdue highlighting, drag-free date confirm) sits on top of this read path.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Merge `tarefas` + `visitas` client-side in JS instead of a SQL `UNION ALL` view | Ships faster, no new migration needed | Breaks pagination, multiplies egress against the free-tier cap, silently slows down as data grows | Never — the free-tier egress constraint is explicit in this project's stack decisions |
| Overload the existing `tarefas` table with nullable `frequencia`/`proxima_data` columns instead of a new `visitas` table | Reuses existing RLS policies and `historico` trigger wiring, less migration surface | Conflates two semantically different entities (ad-hoc prospecção task vs. recurring post-sale visit); every future tarefas query needs to filter out visita-shaped rows; `tipos_tarefa` lookup has no concept of recurrence | Only if the team is certain Agenda never needs visita-specific fields `tarefas` doesn't have (frequência, resumo obrigatório) — given the spec already lists frequência and mandatory resumo, a separate table is the safer default |
| Table-level blanket `CHECK` constraint for graduated fields instead of an RPC-enforced rule | Feels more "database-enforced," matches the `motivo_perda` precedent | Fails to apply against existing production rows (Pitfall 3); harder to give a friendly Portuguese error message to a non-technical user than a `raise exception` inside a PL/pgSQL RPC | Only once there are zero existing rows that could violate it, or after an explicit backfill/`NOT VALID` decision is made |
| Skip a Vitest date-math test for the frequency → next-date calculation because "date-fns is well-tested" | Saves time this sprint | The bug isn't in date-fns, it's in how the app constructs/passes dates around it (Pitfall 1) — untested, this exact bug shape recurs across products even with correct libraries | Never — `CLAUDE.md` already requires at least one automated test per feature, and this is the feature most likely to have a silent off-by-one |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Postgres `date` vs `timestamptz` for visit dates | Using `timestamptz` "to be safe," then having to strip time/timezone everywhere it's displayed or compared | Match `tarefas.data_conclusao`'s existing convention: plain `date`, no time component — this is a date the vendor picks/confirms, not an instant in time |
| Browser `Date` construction from Supabase-returned ISO date strings | `new Date("2026-08-14")` → parsed as UTC, off by a day in `America/Sao_Paulo` when rendered | Use `date-fns`'s `parseISO`, or better, do the arithmetic server-side in the RPC and only ever *display* the returned date client-side |
| `date-fns` `addMonths` vs Postgres `date + interval '1 month'` | Computing the suggestion in one place, re-deriving/re-validating it in another, and getting different month-end clamping behavior between the two | Pick one authority (recommend the RPC/Postgres) for the actual computation; the client only renders what the RPC returns |
| Vercel Hobby cron | Assuming "no cron exists on Hobby" (it does, once/day) and either avoiding a genuinely useful daily job out of an outdated assumption, or reaching for it to solve something that doesn't need wall-clock triggering at all | Confirm current Vercel plan limits before ruling cron in or out for any *future* feature; for Agenda specifically, no cron is needed regardless (Pitfall 4) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Unindexed `UNION ALL` sort across `tarefas`/`visitas` by date | Agenda page load time grows noticeably as historical (completed) rows accumulate, even though only pending ones should render | Add `WHERE concluida = false` / `WHERE status = 'pendente'` filters *before* the union, plus a date index on each source table | Noticeable at a few hundred open rows per source; this team's scale (small sales team) still means it's worth doing from day one rather than retrofitting |
| Client-side merge-then-sort of two full result sets | Network payload includes every open tarefa/visita on every Agenda load, not just the visible page | Server-side `UNION ALL` view/RPC with `LIMIT`/`OFFSET` or cursor pagination | Breaks pagination correctness immediately (not a "scale" threshold — it's wrong from the first page with >1 page of data) |
| Recomputing "quantos dias até a próxima visita" or similar aggregates client-side over full `historico` | Dashboard-adjacent Agenda summary stats slow down and re-fetch full history repeatedly | Follow the existing `dashboard_funil_detalhado`/`dashboard_comparativo_vendedor` precedent: aggregate in a `SECURITY INVOKER` RPC, not in the browser | As soon as any per-client history view is added alongside Agenda |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Adding a user-facing `INSERT` policy to `historico` to make the resumo-writing "simpler" | Any authenticated user (including a Vendedor for another vendedor's client) can forge history entries once a blanket INSERT policy exists, since the `EXISTS`-on-parent gate is easy to get subtly wrong compared to the current trigger-only design | Keep `historico` writes trigger-only (`SECURITY DEFINER`), extended to accept the resumo text as part of the existing UPDATE-triggering pattern (Pitfall 2) |
| New `SECURITY DEFINER` RPC for the visit-completion multi-table write, "because it's easier than reasoning about RLS across three tables" | Bypasses RLS entirely inside the function body — a bug in the function's own row-selection logic becomes a cross-vendedor data leak/write, with no RLS safety net catching it, unlike every existing non-definer RPC in this project | Default to `SECURITY INVOKER` (the `mover_card_funil` precedent) for the visit-completion RPC; reserve `SECURITY DEFINER` for the same narrow, explicitly-documented category this project already limits it to (Auth Admin API calls) |
| Client-side-only enforcement of "Nome Fantasia/CNPJ required before marking ativo" (a form-level required-field check with no matching DB-side guard) | A Vendedor can call the underlying RPC directly (browser devtools, or a future automated import) and skip the requirement entirely — same class of risk `CLAUDE.md` already flags for permission checks | Enforce the graduated-field rule inside the RPC that performs the ativo transition (Pitfall 3), not only in the React form |
| Assuming the new `visitas` table inherits `clientes`'s RLS because it has a `cliente_id` foreign key | Postgres RLS does **not** cascade through foreign keys — this exact gap is what the existing `EXISTS`-on-parent policies for `tarefas`/`cliente_produtos`/`historico` were built to close, and it's easy to forget when adding yet another child table | Copy the existing `tarefas` RLS policy shape (four explicit `EXISTS (select 1 from clientes c where c.id = visitas.cliente_id and (c.responsavel = auth.uid() or is_supervisor()))` policies) verbatim for `visitas` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Forcing a long/multi-field resumo form on every single visit or task completion | Reintroduces the exact "telas longas, esquecimento" friction this CRM was built to replace (`CLAUDE.md`'s stated Core Value) — a vendor stops completing visits promptly if the confirmation step feels heavy | One short free-text field, no extra required metadata beyond what's already specified (resumo + confirmed date) |
| Auto-suggested next date lands on a weekend/holiday with no easy adjustment | Vendor has to manually retype a whole new date instead of nudging by a day or two | Suggest the date, but make "confirmar" a single tap and adjusting a lightweight date-picker interaction, not a full form re-entry |
| Agenda list mixes prospecção tasks and post-sale visits with no visual distinction | Vendor can't tell at a glance whether an item is "finish selling" work or "maintain an existing client" work, undermining the "clareza do que está parado" value the kanban already delivers | Reuse a badge/variant pattern consistent with existing kanban status badges (`class-variance-authority` is already in the stack for exactly this) to visually separate the two item types in the unified list |
| A pre-existing "ganho" client (from before this migration) opened in the UI silently has blank Nome Fantasia/CNPJ with no explanation | Vendor assumes it's a bug ("por que não salvou?") rather than understanding it's historical data that predates the new fields | Explicit, plain-language empty-state messaging on those fields for legacy rows, rather than treating a blank field as an error state |

## "Looks Done But Isn't" Checklist

- [ ] **Next-date suggestion:** Often missing month-end clamping test (Jan 31 + mensal) and a timezone-safe date construction path — verify with a Vitest test asserting the exact date, not just "a date got returned."
- [ ] **Visit completion:** Often missing the atomic three-way write (status + `historico` + next visit) — verify by forcing a mid-transaction failure (e.g., temporarily break the next-visit insert) and confirming the whole operation rolls back, not partially commits.
- [ ] **New `visitas` table RLS:** Often missing per-policy coverage for all four operations (select/insert/update/delete), each independently gated by the `clientes` parent — verify by testing as a Vendedor against another vendedor's client, not just as Supervisor (this project's own prior research already flags "testing only as Supervisor hides RLS bugs" as a recurring failure mode).
- [ ] **Unified Agenda list:** Often missing pagination/limits and a supporting date index — verify by checking the network payload size and query plan (`EXPLAIN ANALYZE`) once there are a few hundred combined open items, not just with today's small dataset.
- [ ] **Graduated `clientes` fields (Nome Fantasia/CNPJ/frequências):** Often missing a defined answer for what "ativo" means as a schema state, and a plan for existing "ganho" rows that predate the migration — verify by running the row-count query against production data before finalizing the constraint approach.
- [ ] **"Frequência: nenhuma":** Often missing explicit handling — verify that choosing "nenhuma" suppresses next-date suggestion entirely rather than defaulting to some fallback interval.
- [ ] **Historico entries for visita completions:** Often missing a distinct `tipo` value (vs. the existing `'tarefa_concluida'`/`'etapa'`/`'status_acompanhamento'` values) — verify a future dashboard/report could filter visita-history from tarefa-history without string-matching the free-text `descricao`.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Migration fails against existing "ganho" rows due to a blanket `CHECK` | LOW | Drop the failed constraint attempt, re-add with `NOT VALID`, decide backfill policy separately (no data was touched by the failed migration attempt) |
| Off-by-one next-date bug already shipped and vendors have confirmed wrong dates | MEDIUM | Identify affected `visitas` rows by re-running the corrected computation against `historico`'s recorded completion dates, flag discrepancies for vendor review rather than silently overwriting confirmed dates |
| `historico` INSERT policy was mistakenly opened up | HIGH | Immediately revert the migration/policy (new migration removing the policy, per this project's "never edit an applied migration" rule), audit `historico` for any rows inserted directly (not via trigger) during the window it was open, and confirm with the team whether any need manual correction |
| Client-side merge-then-sort Agenda shipped and is already slow | MEDIUM | Replace with the `UNION ALL` RPC/view without changing the RPC's external contract (same shape the frontend already expects), so the fix is a backend-only migration, not a UI rewrite |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Timezone/date-math bugs in next-date suggestion | Phase building the visit-completion RPC | Vitest test asserting exact dates across month boundaries (incl. leap year) and a manual test in `America/Sao_Paulo` |
| Multi-table write atomicity / `historico` RLS gap | Phase building the visit-completion RPC | Test as Vendedor completing own client's visit; force a failure mid-RPC and confirm full rollback; confirm no new `historico` INSERT policy was added |
| Graduated fields on populated `clientes` table | Phase adding the new `clientes` columns | Run `select count(*) from clientes where status_acompanhamento = 'ganho'` against real data before writing the migration; confirm "ativo" definition was resolved in Discuss |
| Background-job-shaped next-visit generation | Phase-plan review before implementation starts (architectural constraint, not a coding task) | Plan explicitly states no cron/Edge Function is used for next-date computation or overdue detection |
| Unified Agenda merge/N+1/pagination | Phase building the Agenda list view | `EXPLAIN ANALYZE` on the union query with a few hundred rows; confirm one round trip per Agenda page load in the network tab |

## Sources

- `supabase/migrations/0001_profiles_and_roles.sql`, `0002_clientes_and_funil.sql`, `0007_cidades_e_estado_valido.sql`, `0008_desativacao_membro_equipe.sql` — this repo's own applied schema, RLS policies, and RPC/trigger conventions. Confidence: HIGH (primary source, directly read).
- `.claude/skills/Supabase-conventions/SKILL.md` — project convention for RLS/RPC/Edge Function decision order. Confidence: HIGH (primary source).
- `.planning/PROJECT.md` — current milestone scope, prior Key Decisions (soft-delete pattern, IBGE cidades decision), Out of Scope items (notificações ativas). Confidence: HIGH (primary source).
- WebSearch: "Vercel Hobby plan cron jobs limits" — cross-checked across Vercel's own docs/changelog and third-party trackers agreeing on "100 jobs/project, once-per-day cadence cap on Hobby." Confidence: MEDIUM (cross-checked, includes an official Vercel changelog result).
- WebSearch: "Postgres add NOT NULL column to existing table with rows safe migration pattern" — cross-checked across multiple independent sources agreeing on the `NOT VALID` constraint / three-step migration pattern and the "ALTER TABLE validates all existing rows by default" mechanic. Confidence: MEDIUM.
- WebSearch: "Supabase RLS multiple tables single transaction RPC security invoker pitfalls" — cross-checked across Supabase community/docs sources agreeing RPC functions are the standard multi-table-transaction mechanism, and `SECURITY DEFINER` bypasses RLS. Confidence: MEDIUM.
- WebSearch: "recurring task next occurrence date calculation timezone bugs common mistakes" — cross-checked across multiple independent bug reports (Discourse, Microsoft To Do, open-source recurring-task plugins) all describing the same UTC-midnight-parsing / off-by-one failure mode. Confidence: MEDIUM.
- `gsd-tools query classify-confidence --provider websearch` (and `--verified`) — used to assign LOW (single-source) vs MEDIUM (cross-checked) tiers to the WebSearch findings above.

---
*Pitfalls research for: CRM Raiar v1.3 — Agenda do Vendedor (recurring visit scheduling + unified agenda + graduated client fields on existing Supabase/RLS schema)*
*Researched: 2026-08-07*
