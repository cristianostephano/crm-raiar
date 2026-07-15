# Pitfalls Research

**Domain:** B2B sales CRM / kanban sales pipeline, built on Supabase (Postgres + RLS) with a non-technical founder, free-tier constrained
**Researched:** 2026-07-14
**Confidence:** MEDIUM-HIGH (RLS mechanics cross-checked against official Supabase docs; kanban/UX and MVP-scope findings drawn from multiple independent community sources)

## Critical Pitfalls

### Pitfall 1: RLS enabled but "silently wrong" — empty results or full leaks, no error either way

**What goes wrong:**
Two opposite failure modes, both silent:
- A new table is created without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. Every row is readable through the Supabase API by any authenticated (or even anonymous) client — a full cross-vendedor data leak with zero error messages.
- RLS is enabled but a policy is missing or too narrow. Queries return empty results instead of an error, so the app "looks broken" (blank kanban) rather than throwing something you'd notice in a bug report.

**Why it happens:**
RLS is off by default on every new Postgres table, and Supabase's REST/PostgREST layer will happily serve (or silently filter) rows either way — there's no exception thrown for "RLS enabled, no matching policy." Nothing in the UI tells a non-technical user "this table is unprotected."

**How to avoid:**
- Make "every new table ships with RLS enabled + explicit policies in the same migration" a non-negotiable rule (already stated in this project's `CLAUDE.md` — enforce it mechanically, not just by memory).
- Add a checklist item to every migration PR: `SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace;` should show `true` for every application table before merging.
- Use Supabase's built-in Advisors (Dashboard → Advisors → Security) which specifically flags tables with RLS disabled or with permissive `USING (true)` policies.

**Warning signs:**
- A vendedor reports seeing zero clients right after a new table/column is added (empty-result failure mode).
- A vendedor reports seeing clients that aren't theirs (leak failure mode) — the more dangerous and less likely to self-report.
- Supabase Advisors tab shows any "RLS disabled" or "policy allows public access" warning.

**Phase to address:**
Auth/RLS foundation phase — before any table beyond `users` is created. This is the highest-leverage phase to get right first, because every later phase (clientes, kanban, enums, dashboard) inherits its policies.

---

### Pitfall 2: Testing only as Supervisor hides RLS bugs

**What goes wrong:**
The Supervisor role can see every client from every vendedor by design. If manual testing during development is done exclusively (or mostly) as the Supervisor account, an RLS policy that's too permissive for Vendedor (e.g. accidentally lets a vendedor see `responsavel != auth.uid()` rows) goes completely unnoticed — the Supervisor view looks identical whether the policy is correct or broken.

**Why it happens:**
It's the natural path of least resistance: one dev/founder account, usually given the "sees everything" role, is used for all day-to-day testing. The failure only shows up when a second vendedor account is used side-by-side.

**How to avoid:**
- Maintain at least two seeded test accounts (one Vendedor A, one Vendedor B) from the very first migration, and require every RLS-touching change to be manually checked by logging in as Vendedor A and confirming Vendedor B's clients are invisible.
- Write this as an automated test (per `CLAUDE.md`'s testing requirement) using the Supabase JS client authenticated as each role, not just service-role queries — service-role bypasses RLS entirely and would give a false pass.

**Warning signs:**
- No test/checklist item ever asserts "Vendedor A cannot see Vendedor B's client."
- All manual QA sessions happen under one login.

**Phase to address:**
Auth/RLS foundation phase (write the cross-vendedor isolation test here) — re-run this same test at the end of every subsequent phase that touches `clientes` or `cards`, since new columns/joins can reopen the leak (see Pitfall 3).

---

### Pitfall 3: RLS on joined/related tables is evaluated independently — dashboard and kanban joins can leak

**What goes wrong:**
A correct policy on `clientes` (vendedor sees own rows) does not automatically protect `cards`, `tarefas`, or the dashboard's aggregate views if those tables have their own (weaker, or missing) policies. Each table's RLS is checked independently by Postgres — joining to a protected table doesn't inherit its protection.

**Why it happens:**
It's intuitive to assume "I locked down `clientes`, so anything joined to it is safe too." Postgres RLS doesn't work that way: a `SELECT` on `cards JOIN clientes` still applies `cards`' own policy to filter `cards` rows, independently of the `clientes` policy.

**How to avoid:**
- Every table that stores per-client or per-vendedor data (`clientes`, `cards`, `tarefas`, and any dashboard aggregation view/RPC) needs its own explicit `responsavel = auth.uid() OR is_supervisor()` policy — not just `clientes`.
- For the dashboard's aggregate queries specifically, prefer a `SECURITY DEFINER` RPC function that explicitly filters by role rather than relying on RLS across a multi-table join, since it's easier to reason about and test in one place (see `supabase-conventions` skill for when to use RPC vs raw RLS).

**Warning signs:**
- A table was created via "add column to existing table" flow rather than the standard new-table migration checklist, and its RLS policy was copy-pasted without adjusting the ownership check.
- Dashboard numbers for a vendedor include data from clients not assigned to them.

**Phase to address:**
Kanban/cards phase (when `cards` and `tarefas` tables are created) and Dashboard phase (when aggregate views/RPCs are created) — both need their own explicit policy review, not a rubber-stamp of the `clientes` phase's work.

---

### Pitfall 4: `auth.uid()` called unwrapped in RLS policies — quiet performance cliff

**What goes wrong:**
Writing policies like `USING (responsavel = auth.uid())` (function called directly, unwrapped) makes Postgres re-evaluate `auth.uid()` once per row scanned, instead of once per query. On a small free-tier dataset (hundreds of clients) this is invisible; as the client base and card history grow, kanban and dashboard queries get progressively slower with no code change — a project on a non-technical founder's radar is unlikely to catch this until it's already painful.

**Why it happens:**
`auth.uid() = column` reads naturally and is what most Supabase tutorials show first; the `(SELECT auth.uid()) = column` rewrite (which lets Postgres cache the result as a single init-plan) is a non-obvious optimization that Supabase's own linter had to be built to catch after enough production incidents.

**How to avoid:**
- Always wrap auth functions in policies: `USING (responsavel = (SELECT auth.uid()))`. Apply this from the very first policy written, not as a later optimization pass.
- Index the columns used in RLS predicates (`responsavel` on `clientes` and `cards`) — an unindexed `responsavel = ...` filter forces a sequential scan regardless of the wrapping.
- Periodically check Supabase Dashboard → Advisors → Performance, which specifically flags the `auth_rls_initplan` pattern.

**Warning signs:**
- Kanban board takes visibly longer to load as more clients/cards accumulate.
- Advisors tab shows `auth_rls_initplan` warnings.

**Phase to address:**
Auth/RLS foundation phase (establish the wrapped-function convention in the first policies written) — treat it as a lint rule applied to every subsequent migration, not a one-time fix.

---

### Pitfall 5: Kanban drag-and-drop card ordering breaks down without a proper position strategy

**What goes wrong:**
Storing card order as a simple integer column that gets renumbered on every drag (`position = position + 1` cascades) causes two problems specific to this project: (1) every drag triggers writes to many rows, which is wasteful on a free-tier Postgres row-write budget and fights with RLS-protected updates across potentially many cards, and (2) concurrent drags by two vendedores (or a vendedor and a supervisor moving the same client) can produce duplicate or out-of-order positions, visibly "jumping" cards on screen.

**Why it happens:**
Integer position columns are the obvious first implementation and work fine in a demo with a handful of cards, but degrade specifically under the two conditions this project will hit fast: many drags per session, and free-tier constraints that make "cheap writes" matter.

**How to avoid:**
- Use fractional positioning (a `numeric`/`float` or lexicographic string `position` column) so a drag only ever writes to the single card being moved — the new position is computed as the midpoint between its new neighbors, no cascade.
- Avoid the historical bug pattern of computing positions via repeated `/2` on integers, which silently overflows after enough reorders; use a `numeric` type or well-tested fractional-indexing library, and periodically "rebalance" (rewrite all positions evenly) as a maintenance job if fractions get too small.

**Warning signs:**
- Card order occasionally "resets" or duplicates after several drags in the same column.
- A single drag operation in the browser network tab shows updates to more than one row.

**Phase to address:**
Kanban/funil phase — decide the position strategy before drag-and-drop is wired up, since retrofitting it after cards already have brittle integer positions means a data migration.

---

### Pitfall 6: Kanban drag-and-drop breaks on mobile / touch, and status changes have real business meaning

**What goes wrong:**
Two overlapping issues: (1) drag-and-drop interactions tuned for desktop mouse hover often fail on touch — small drop targets, no hover affordance, and native scroll gestures conflicting with drag gestures make the board hard to use on a phone, which matters here because vendedores plausibly update the funil from the field; (2) unlike a generic task board, moving a card in this CRM is a business event — reaching "1ª venda concluída" is the only stage from which `status_acompanhamento` can become "ganho," and marking a card "perdido" requires a mandatory reason. If that logic lives only in frontend drag-handlers, it's trivially bypassable via direct API calls and easy to regress when the UI is refactored.

**Why it happens:**
Drag-and-drop libraries (e.g. `dnd-kit`) are usually adopted primarily for their desktop polish; touch ergonomics and keyboard/screen-reader support need deliberate extra work (larger touch targets, dedicated drag handles, non-drag fallback controls). Business-rule enforcement is often left in the frontend because "that's where the drag event fires," rather than being pushed down to the database as the source of truth.

**How to avoid:**
- Use touch-friendly drag handles (not the whole card) and generously sized drop zones; provide a non-drag fallback (e.g. a "move to stage" menu/select) for both mobile and accessibility.
- Enforce the "ganho only from 1ª venda concluída" and "perdido requires motivo" rules as database constraints/triggers or a `SECURITY DEFINER` RPC function that the drag handler calls — not client-side validation alone (per the `supabase-conventions` skill's RPC guidance).
- `dnd-kit` (rather than the unmaintained `react-beautiful-dnd`) is the current standard choice specifically because it handles keyboard and touch interactions out of the box.

**Warning signs:**
- QA only ever tests drag-and-drop with a mouse on a laptop.
- A card can be marked "ganho" from a stage other than "1ª venda concluída" via a direct API request (test this explicitly).
- A card can be marked "perdido" with no motivo recorded.

**Phase to address:**
Kanban/funil phase for the drag mechanics and mobile fallback; the "ganho"/"perdido" business rule enforcement belongs in whichever phase defines `cards`/`status_acompanhamento` (likely the same phase) and should be verified with an automated test per `CLAUDE.md`.

---

### Pitfall 7: Dashboard aggregate queries are the first thing to get slow on a transactional free-tier database

**What goes wrong:**
Postgres (and by extension Supabase's free tier) is row-oriented and optimized for transactional reads/writes, not for aggregation (`COUNT`, `GROUP BY`, conversion-rate math) across the whole `clientes`/`cards` history. The dashboard's requirements — clients per stage, ganhos x perdidos, desempenho por vendedor, taxa de conversão, prospecções por produto/categoria — are exactly this kind of query, and running them directly against the live transactional tables on every dashboard load creates I/O pressure that can also slow down the kanban itself, especially once data volume grows past what fits comfortably with the free tier's 500MB storage / limited compute.

**Why it happens:**
It's simplest to write dashboard aggregates as ad-hoc `SELECT COUNT(*) ... GROUP BY` queries straight off the same tables the kanban writes to, without indexes tailored to the aggregation's filter/group columns (e.g. `responsavel`, `status_acompanhamento`, `categoria`).

**How to avoid:**
- Add indexes on the columns the dashboard filters/groups by (`responsavel`, `status_acompanhamento`, stage, `categoria`, `produtos_consumidos`) — without them, aggregate queries force sequential scans that get worse as data grows.
- Wrap dashboard aggregations in `SECURITY DEFINER` Postgres functions (RPCs) rather than raw client-side `.select()` calls — this both centralizes the role-based filtering (Pitfall 3) and lets you use `EXPLAIN ANALYZE` on one well-defined query per metric instead of many ad-hoc ones.
- At MVP scale (a single small sales team) this likely won't be a real problem yet — but write it with indexes and RPCs from day one so it doesn't become a rewrite later. Don't add a separate analytics/OLAP service; that's over-engineering for this project's actual scale and free-tier constraint.

**Warning signs:**
- Dashboard page takes noticeably longer to load than the kanban.
- `EXPLAIN ANALYZE` on any dashboard query shows a sequential scan (`Seq Scan`) on `clientes` or `cards`.

**Phase to address:**
Dashboard phase — but the indexes it depends on (`responsavel`, `status_acompanhamento`, `categoria`) should be added in the migrations that create those columns, in the clientes/kanban phases, so the dashboard phase isn't retrofitting indexes onto a live table.

---

### Pitfall 8: Editable enum tables (categoria, produtos, tarefas, motivo de perda) break referential integrity on delete

**What goes wrong:**
Because these four lists are explicitly modeled as editable tables (not fixed `CHECK` constraints) so the Supervisor can CRUD them, a naive `DELETE` on a value that's already referenced by existing `clientes` or `cards` either fails with a foreign-key violation (confusing error for a non-technical supervisor) or, worse, silently orphans references if the FK isn't enforced at all.

**Why it happens:**
CRUD screens for "simple lookup lists" are usually built as generic delete-by-id forms without considering that production data already references the row being deleted.

**How to avoid:**
- Enforce foreign keys from `clientes.categoria`, `clientes.produtos_consumidos`, `cards.tarefas`, and `cards.motivo_perda` to their respective lookup tables (per `CLAUDE.md`'s "no open tables" and "enum tables, not hardcoded" requirements).
- Prefer soft-delete (an `ativo`/`is_active` boolean) over hard delete for these lookup tables: deactivated values disappear from "create new" dropdowns but remain valid for historical records already using them. Surface this to the Supervisor in plain language ("valores desativados continuam nos clientes já cadastrados, mas não aparecem em novos cadastros").

**Warning signs:**
- Supervisor tries to delete a `categoria` value and gets a raw Postgres foreign-key-violation error message.
- A client's `categoria` or `produtos_consumidos` field shows blank/null after an enum value was deleted.

**Phase to address:**
The phase that implements the 4 editable enum CRUD screens — decide soft-delete vs hard-delete before shipping the delete button, not after a Supervisor hits the FK error in production.

---

### Pitfall 9: Scope creep past the explicitly-agreed MVP boundaries

**What goes wrong:**
`PROJECT.md` already draws clear MVP lines (no notifications, fixed kanban columns, no import screen, no mobile app, no CRM integration). The domain-general failure pattern for founder-led MVPs is that these boundaries erode mid-build — "just one more field," "just make the columns editable too since we're already touching that table" — each individually small, collectively turning a 4-6 week MVP into an open-ended project that never validates the core hypothesis (can the team actually keep the funil updated).

**Why it happens:**
Every deferred idea in `PROJECT.md`'s "Out of Scope" section is a genuinely reasonable feature — that's exactly what makes it tempting to pull forward once the underlying table/screen already exists.

**How to avoid:**
- Treat `PROJECT.md`'s Out of Scope list as a checklist to actively defend during planning of each phase, not just a one-time note — GSD's roadmap/phase-planning should explicitly re-confirm "still out of scope?" rather than silently absorbing scope creep.
- If a genuinely new requirement surfaces mid-build (as `motivo_perda` already did during initialization), route it through the same explicit Active-requirements process rather than adding it ad hoc inside an unrelated phase's implementation.

**Warning signs:**
- A phase's implementation touches a table/screen not listed in that phase's original requirements.
- "While we're at it..." appears in planning conversation.

**Phase to address:**
Cross-cutting — enforced at roadmap/phase-planning time, not a single implementation phase. Worth an explicit reminder in the roadmap's phase-boundary criteria.

---

### Pitfall 10: Skipping or faking tests specifically for RLS and business-rule logic

**What goes wrong:**
`CLAUDE.md` requires a test before any feature is "done," but for this project the highest-value tests are exactly the ones easiest to skip under time pressure: cross-vendedor RLS isolation (Pitfall 2), "ganho only from last stage" (Pitfall 6), and enum FK integrity (Pitfall 8) — none of these fail loudly in a quick manual click-through, so a rushed MVP is likely to end up with UI tests ("the form saves") but no policy/business-rule tests, which is precisely where the real risk lives in a multi-tenant RLS app.

**Why it happens:**
UI-level smoke tests ("click save, see the row appear") are faster to write and feel like "coverage," but they exercise the happy path only and, run under whichever account is currently logged in, won't catch a policy that's wrong for a different role.

**How to avoid:**
- For every phase that touches RLS or a status-transition rule, require at minimum one automated test written from the perspective of a restricted role (Vendedor, not Supervisor) hitting the Supabase client directly — not just a UI click-through.
- Treat "does Vendedor B see Vendedor A's data" and "can a card skip straight to ganho from stage 2" as standing regression tests re-run after any change to `clientes`/`cards`/policies, not one-off checks.

**Warning signs:**
- All existing tests pass while logged in as Supervisor only.
- No test asserts a negative case ("this user should NOT be able to see/do X").

**Phase to address:**
Auth/RLS foundation phase establishes the pattern; every phase that adds a table or status rule afterward should be required to add its own negative-case test.

---

### Pitfall 11: Editing migrations after they've been applied instead of creating a new one

**What goes wrong:**
`CLAUDE.md` already forbids this, and Supabase's own guidance backs it: once a migration has been applied (even just locally), editing the same file instead of writing a new one means git history (what the file says now) and the database's migration-history table (what was actually run) diverge. On a free-tier single-environment setup this is easy to do by accident — "just tweak this column name in the migration I wrote 10 minutes ago, it's not committed yet" — and quietly stops being safe the moment `supabase db push`/deploy has touched the real database.

**Why it happens:**
It feels harmless to edit a very recent migration, especially for a non-technical founder pairing with an AI assistant, where "was this actually applied yet?" isn't an obvious distinction. Also easy to bypass by making a schema change directly in the Supabase Studio dashboard, which isn't tracked in git at all.

**How to avoid:**
- Hard rule already in `CLAUDE.md`: any schema change is a *new* migration file, never an edit to an already-applied one, and never made directly via the dashboard's Table Editor.
- Before any schema change, run a local `supabase db reset` (replays all migrations from scratch) to prove the migration set is self-consistent — this is also the cheapest way to catch "wait, this migration depends on one I forgot to include."

**Warning signs:**
- A migration file's git diff shows changes to a file with an old timestamp/already merged commit.
- The Supabase Studio Table Editor was used to add/rename a column "just to test something."

**Phase to address:**
Cross-cutting, but establish the discipline explicitly in the Auth/RLS foundation phase (the first phase writing migrations) since habits set there persist through the rest of the project.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Integer `position` column for kanban card order, renumbered on every drag | Simple to implement first | Cascading writes on every drag; breaks under concurrent drags; can overflow (real production incident on record) | Never for this project — go straight to fractional/numeric position |
| Business rules (ganho/perdido transitions) enforced only in frontend drag handler | Faster to ship the first kanban interaction | Bypassable via direct API call; regresses silently on UI refactor | Never — always back with a DB constraint/trigger/RPC, even in MVP |
| Hard-delete on editable enum tables (categoria, produtos, tarefas, motivo) | Simpler CRUD screen | FK violations or orphaned references once real data references a value | Only if you also block delete when referenced — otherwise use soft-delete |
| Dashboard aggregate queries as ad-hoc client-side `.select()` calls without RPC wrapping | Faster first dashboard iteration | Duplicates role-filtering logic in every query; harder to optimize/index later | Acceptable very early (first draft) but replace with RPC before the phase is called done |
| Testing exclusively as Supervisor account | One less test account to manage | Never catches vendedor-scoped RLS bugs (Pitfall 2) | Never — seed a second vendedor account from the first migration |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| Supabase Auth + RLS | Using `raw_user_meta_data` / JWT custom claims as the source of truth for role (Supervisor vs Vendedor) | Store role in a proper `users`/`profiles` table row and check it via a `SECURITY DEFINER` function inside policies — JWT metadata is user-editable and not a safe authorization source |
| Supabase service-role key | Used from client-side code "to make an admin feature work faster" | Service role bypasses RLS entirely; keep it exclusively in Edge Functions/server contexts, never shipped to the browser bundle |
| Supabase Studio (hosted dashboard) | Making a schema change directly in the Table Editor "just this once" | All schema changes go through a migration file in `/supabase/migrations`, applied via CLI — dashboard edits aren't tracked in git and cause drift |
| PostgREST aggregate/group-by queries | Calling `COUNT`/`GROUP BY` style aggregates directly on unindexed columns via the auto-generated REST API | Add indexes on filter/group columns, or move the aggregation into a `SECURITY DEFINER` RPC function |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Unwrapped `auth.uid()` in RLS policies | Kanban/dashboard load times creep up as row count grows, with no code change | Wrap as `(SELECT auth.uid())` in every policy from the start; index the columns compared against it | Noticeable past low thousands of rows; timeouts possible past ~1M rows per Supabase's own guidance |
| Missing index on `responsavel`/`status_acompanhamento`/`categoria` | Dashboard aggregate queries and RLS-filtered kanban queries slow down together | Add indexes in the same migration that creates the column | As soon as `clientes`/`cards` grow past a few thousand rows on free-tier compute |
| Integer position renumbering on kanban drag | Occasional "flicker" or duplicate card order after many drags | Fractional/numeric position strategy from day one | With frequent drags per session or any concurrent multi-user editing |
| Dashboard aggregation queries hitting the same tables the kanban writes to | Kanban feels sluggish specifically when the dashboard is also being viewed/refreshed | Index-backed RPC functions for aggregates; avoid re-running full-table aggregates on every render (cache/memoize on the client where reasonable) | Once the team's real usage overlaps kanban editing with dashboard viewing — plausible even at MVP team size |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| New table shipped without RLS enabled | Full cross-vendedor data leak with no error thrown | Migration checklist: verify `pg_class.relrowsecurity = true` for every new table before merge; check Supabase Advisors |
| Policy written as `USING (true)` "temporarily, to unblock testing" | Left in place, becomes a silent leak in production | Never merge a `USING (true)` policy on data tables; if needed for debugging, use a separate local-only branch/migration that's never pushed |
| Role check based on JWT claims instead of a DB-backed roles table | User can potentially self-elevate by manipulating client-controlled metadata | Store and check role from a server-controlled `users` table via a `SECURITY DEFINER` function |
| `WITH CHECK` clause missing on UPDATE policies (only `USING` set) | A vendedor could update their own client row's `responsavel` field to reassign it to themselves, bypassing supervisor-only reassignment | Set `WITH CHECK` explicitly on every UPDATE policy, and consider column-level protection (a trigger rejecting changes to `responsavel` by non-supervisors) since RLS alone can't restrict which columns are writable |
| Business status transitions (ganho/perdido) trusted from client input | A vendedor (or a bug) can force a card to "ganho" from any stage via direct API call | Enforce the transition rule in a DB constraint/trigger or `SECURITY DEFINER` RPC, not client-side validation alone |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Drag handle is the entire card, tuned for mouse hover only | Frustrating or unusable kanban on phone/tablet in the field | Dedicated touch-friendly drag handle, larger drop zones, and a non-drag fallback (dropdown/menu "mover para etapa") |
| No visual feedback distinguishing "draggable" cards from static content | Users unsure what can be moved, guess-and-check behavior | Consistent affordance (cursor, shadow/elevation on drag) via `dnd-kit`'s built-in states |
| Marking "perdido" with no forced reason capture at the moment of the drag | Loss-reason data becomes an afterthought, dashboard's "perdido" breakdown ends up empty/unreliable | Trigger a required "motivo" prompt as part of the drag-to-perdido interaction itself, not a separate optional edit later |
| Stalled/atrasado cards only visible by scanning the whole board manually | Defeats the stated Core Value (visibility of what's stuck) if highlighting isn't prominent | Explicit, consistent visual treatment (e.g. border/badge) computed server-side or on load, exactly as already scoped in `PROJECT.md` — don't let this slip to "just sort by date" |

## "Looks Done But Isn't" Checklist

- [ ] **RLS on a new table:** Often missing `WITH CHECK` on UPDATE policies — verify a vendedor cannot reassign `responsavel` on their own client via a direct update call, not just via the UI.
- [ ] **Kanban drag-and-drop:** Often missing DB-side enforcement of "ganho only from last stage" — verify via a direct API/RPC call bypassing the UI, not just by dragging in the browser.
- [ ] **"Perdido" motivo:** Often missing a NOT NULL / required-field enforcement at the DB level — verify a card can't be saved as "perdido" with a null motivo via direct API call.
- [ ] **Editable enum CRUD (categoria/produtos/tarefas/motivo):** Often missing delete protection — verify deleting a value already referenced by an existing cliente/card either blocks or is a deliberate soft-delete, not a silent orphan.
- [ ] **Dashboard numbers per vendedor:** Often missing role-scoping on the aggregate query itself — verify a vendedor's dashboard RPC/query, called directly (not just clicked through the UI), only returns their own numbers.
- [ ] **Cross-vendedor isolation:** Often "tested" only by the developer's own account — verify with two distinct seeded vendedor accounts, not assumed from a single-user demo.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-----------------|
| RLS leak discovered in production (Pitfall 1/3) | MEDIUM | Immediately tighten/patch the policy via a new migration; audit Postgres logs (if available) for which rows were exposed and to whom; communicate plainly to the founder what was exposed and for how long |
| Integer position field already causing cascading writes/overflow (Pitfall 5) | MEDIUM | Migrate to fractional/numeric positions: write a one-time migration that assigns evenly-spaced fractional values to existing cards per column, then switch the app's write path |
| Business rule bypass discovered (card marked "ganho" from wrong stage) (Pitfall 6) | LOW | Add the missing constraint/trigger via new migration; write a data-correction script to flag/fix already-mis-stated cards for manual review by the supervisor |
| Migration history diverged from git (edited an applied migration) (Pitfall 11) | HIGH | Reconcile by diffing actual DB schema against migration files, writing a new "repair" migration that brings them back in sync, and going forward strictly enforcing new-migration-only discipline |
| Scope crept past MVP boundary mid-phase (Pitfall 9) | LOW | Cut the added scope back out into a documented backlog item (GSD's Out of Scope / backlog flow), finish the original phase boundary, revisit the idea as its own future phase |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| RLS disabled or policy-less table (P1) | Auth/RLS foundation phase | `pg_class.relrowsecurity = true` check + Supabase Advisors clean on every migration |
| Testing only as Supervisor (P2) | Auth/RLS foundation phase (seed 2 vendedor accounts here); re-verified every phase touching clientes/cards | Automated test: Vendedor A query cannot return Vendedor B's rows |
| RLS gaps on joined tables / dashboard (P3) | Kanban/cards phase + Dashboard phase | Each new table has its own reviewed policy; dashboard RPCs tested per-role |
| Unwrapped `auth.uid()` performance trap (P4) | Auth/RLS foundation phase (set the convention) | Supabase Advisors → Performance shows no `auth_rls_initplan` warnings |
| Kanban position/ordering breakage (P5) | Kanban/funil phase | Manual multi-drag test producing no duplicate/out-of-order positions; single-row write confirmed per drag |
| Mobile drag UX + business-rule bypass (P6) | Kanban/funil phase | Touch-device manual test; direct API call attempting invalid ganho/perdido transition is rejected |
| Dashboard aggregate performance (P7) | Dashboard phase (indexes added earlier, in clientes/kanban phases) | `EXPLAIN ANALYZE` on each dashboard metric shows index usage, not sequential scan |
| Enum delete breaking referential integrity (P8) | Editable-enums CRUD phase | Attempt to delete a referenced enum value is blocked or soft-deletes correctly |
| MVP scope creep (P9) | Cross-cutting / roadmap & phase-planning | Each phase's implementation checked against `PROJECT.md` Out of Scope list before merge |
| Skipped negative-case tests (P10) | Auth/RLS foundation phase (set the pattern); every phase after | Each phase adding a table/rule ships at least one negative-case automated test |
| Editing applied migrations (P11) | Auth/RLS foundation phase (first migrations written) | `supabase db reset` succeeds cleanly from a fresh database using only the current migration files |

## Sources

- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence, official docs
- [Supabase Docs | Troubleshooting | RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — HIGH confidence, official docs
- [Database Migrations | Supabase Docs](https://supabase.com/docs/guides/deployment/database-migrations) — HIGH confidence, official docs
- [Local development with schema migrations | Supabase Docs](https://supabase.com/docs/guides/local-development/overview) — HIGH confidence, official docs
- [PostgREST Aggregate Functions | Supabase Blog](https://supabase.com/blog/postgrest-aggregate-functions) — HIGH confidence, official
- [Supabase Docs | Troubleshooting | Understanding Postgres EXPLAIN Output](https://supabase.com/docs/guides/troubleshooting/understanding-postgresql-explain-output-Un9dqX) — HIGH confidence, official docs
- [Can I use Supabase for analytics? | Tinybird](https://www.tinybird.co/blog/can-i-use-supabase-for-user-facing-analytics) — MEDIUM confidence, third-party but technically grounded
- [76 RLS policies rewritten in one migration: the auth.uid() init-plan trap in Supabase | DEV Community](https://dev.to/arvavit/76-rls-policies-rewritten-in-one-migration-the-authuid-init-plan-trap-in-supabase-4hg) — MEDIUM confidence, corroborates official docs with a real-world incident
- [Supabase RLS Best Practices: Production Patterns for Secure Multi-Tenant Apps | MakerKit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — MEDIUM confidence, established Supabase-focused vendor
- [Row-Level Security in Supabase: Multi-Tenant SaaS from Day One | DEV Community](https://dev.to/issuecapture/row-level-security-in-supabase-multi-tenant-saas-from-day-one-4lon) — MEDIUM confidence
- [GitHub - Georgegriff/react-dnd-kit-tailwind-shadcn-ui](https://github.com/Georgegriff/react-dnd-kit-tailwind-shadcn-ui) — MEDIUM confidence, widely referenced accessible kanban reference implementation
- [Drag and drop UI examples and UX tips | Eleken](https://www.eleken.co/blog-posts/drag-and-drop-ui) — MEDIUM confidence
- [A robust mechanism for Kanban board column indexing | Nick McCleery](https://nickmccleery.com/posts/08-kanban-indexing/) — MEDIUM confidence, includes documented real-world integer-overflow incident
- [Kanban and dense orders | Alex Drummond, multiverse-tech](https://medium.com/multiverse-tech/kanban-and-dense-orders-ef7c6d5c0491) — MEDIUM confidence
- [8 Common Sales Pipeline Mistakes to Avoid | Leadfeeder](https://www.leadfeeder.com/blog/conversion-optimization/sales-pipeline-mistakes/) — MEDIUM confidence
- [Understanding Deal Stages in Sales Pipelines | Storylane](https://www.storylane.io/feeds/blog/deal-stages) — MEDIUM confidence
- [MVP Development for Non-Technical Founders: 7 Costly Mistakes | Valtorian](https://www.valtorian.com/blog/mvp-development-non-technical-founders-costly-mistakes) — MEDIUM confidence
- [Defining MVP Scope Correctly | Appilian](https://appilian.com/defining-mvp-scope-correctly/) — MEDIUM confidence
- [Seeking advice: What is the professional standard for DB migration workflows? | supabase GitHub Discussions](https://github.com/orgs/supabase/discussions/37503) — MEDIUM confidence, community discussion on official repo

---
*Pitfalls research for: B2B sales CRM / kanban pipeline on Supabase*
*Researched: 2026-07-14*
