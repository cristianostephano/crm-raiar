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

---
---

# Milestone Addendum: v1.1 Bulk Import/Export

**Domain:** Adding bulk spreadsheet import/export to the existing single-record-cadastro CRM described above, with per-role (Vendedor/Supervisor) RLS visibility
**Researched:** 2026-07-22
**Confidence:** MEDIUM (cross-checked web sources agreeing on core mechanisms; no primary-vendor doc directly fetched for every claim — see Sources below)

This section is scoped specifically to the v1.1 milestone (`Importação e Exportação de Clientes`, see `PROJECT.md`). It supplements, not replaces, the Critical Pitfalls above — those (RLS gaps, migration discipline, testing-as-Supervisor-only) all still apply to any new table/column/RPC this milestone introduces.

## Critical Pitfalls

### Pitfall A1: Trusting company name (razão social) as the duplicate key

**What goes wrong:**
The system either (a) silently creates duplicate `clientes` rows because "Distribuidora ABC Ltda" and "DISTRIBUIDORA ABC LTDA." / "Distribuidora ABC" don't match textually (false negative — misses real duplicates), or (b) blocks/merges two genuinely different companies that happen to share a common name fragment (false positive).

**Why it happens:**
There is no CNPJ/tax-ID field in the current schema — razão social is the only quasi-identifying text field, and free-text company names vary in case, punctuation, whitespace, and legal-entity suffixes (LTDA, S.A., ME, EIRELI) between the spreadsheets the sales team receives from different partners/feiras.

**How to avoid:**
- Normalize before comparing: lowercase, strip accents/punctuation/extra whitespace, strip common legal suffixes (LTDA, S/A, S.A., ME, EIRELI, EPP) into a computed `dedup_key`, never overwrite the original razão social with the normalized form.
- Combine the normalized name with a second discriminating field already in the schema (e.g. `responsavel`/vendedor, city/CEP prefix from endereço) to reduce false positives — "Distribuidora ABC" in São Paulo and "Distribuidora ABC" in Salvador are very likely different clients.
- Since this milestone doesn't add a CNPJ field, treat duplicate detection as **advisory** (flag for human review before confirming import), never as an automatic silent skip/merge — the supervisor reviewing "erros/duplicados antes de confirmar" (already scoped in `PROJECT.md`) is the right place for this, not a background auto-merge.
- Flag CNPJ as a strong candidate for a future milestone if duplicate false positives/negatives turn out to be a recurring pain point after this ships.

**Warning signs:**
Supervisor reports "eu importei e agora tem cliente repetido" or "ele bloqueou um cliente que não era duplicado" during UAT.

**Phase to address:**
Import validation/duplicate-detection phase (the "mostrar erros/duplicados antes de confirmar" screen).

---

### Pitfall A2: Hardcoding comma as the CSV delimiter (breaks on pt-BR Excel exports)

**What goes wrong:**
A parser written and tested with comma-delimited sample files works fine in development, then fails silently or garbles columns the first time the sales team uploads a real spreadsheet exported from Excel in Brazilian Portuguese locale — because Excel PT-BR defaults to comma as the **decimal** separator and therefore exports CSV with **semicolon** as the field delimiter (to avoid ambiguity with decimals inside numeric cells like `número_de_lojas`).

**Why it happens:**
Most CSV libraries and tutorials assume US/UK locale (comma-delimited) by default; the mismatch only surfaces with real-world Brazilian-locale files, which is exactly the population of files this feature is built for.

**How to avoid:**
- Auto-detect the delimiter (sniff the first line for `,` vs `;` vs `\t` occurrence counts) rather than hardcoding one, or explicitly support both and let the column-mapping screen show a preview so the user visually confirms columns lined up correctly before proceeding.
- Prefer accepting `.xlsx` uploads (parsed via a library that reads cell values directly, sidestepping delimiter ambiguity entirely) as the primary path, with CSV as a secondary path that requires delimiter detection.
- Never assume `,` is safe as a decimal separator either — if any numeric column (e.g. `numero_de_lojas`) is ever entered with a comma decimal, parse it locale-aware, not with a naive `parseFloat`.

**Warning signs:**
A spreadsheet from a real partner/feira parses into the wrong number of columns, or every value from one Brazilian-locale test file lands in a single "column A".

**Phase to address:**
Import parsing phase (before column-mapping screen is shown).

---

### Pitfall A3: UTF-8 BOM breaking the first column header, silently

**What goes wrong:**
When Excel saves "CSV UTF-8", it prepends a 3-byte BOM. If the parser isn't BOM-aware, the first header cell comes back as `"﻿razao_social"` instead of `"razao_social"` — the column-mapping screen then fails to auto-match the first column to any known field, forcing the supervisor to manually remap something that should have matched automatically, or (worse) the app silently treats it as an "unknown column" and drops it.

**Why it happens:**
Excel adds the BOM by default on that save option; many Node CSV/XLSX libraries don't strip it unless explicitly configured (`bom: true` / `utf-8-sig` equivalent).

**How to avoid:**
Explicitly strip a leading BOM from the raw file buffer/first line before header parsing, regardless of which library is used. Add a test fixture that is an actual BOM-prefixed pt-BR Excel export, not just a plain UTF-8 CSV.

**Warning signs:**
The first column of every uploaded file fails to auto-map in the column-mapping UI, but every other column matches fine.

**Phase to address:**
Import parsing phase.

---

### Pitfall A4: CSV export vulnerable to formula/CSV injection

**What goes wrong:**
The export feature writes user-entered free-text fields (razão social, contato, observação) straight into CSV cells. If a value happens to start with `=`, `+`, `-`, or `@` (even accidentally, e.g. a phone number typed as `+55...` or an observação starting with `-`), Excel/Sheets on the vendedor's or supervisor's machine may interpret it as a formula on open — at minimum a broken cell, at worst (with legacy DDE-style payloads) code execution on whoever opens the exported file. This is an OWASP-catalogued, well-documented class of vulnerability (CSV/Formula Injection).

**Why it happens:**
CSV files are opened in spreadsheet software by default, and spreadsheet software treats leading `=`, `+`, `-`, `@` as formula triggers regardless of the file's actual intent — developers exporting "just data" don't think of the output as executable.

**How to avoid:**
Sanitize every exported cell: if the value starts with `=`, `+`, `-`, `@`, tab, or CR, prefix it with a leading single-quote (`'`) or space to force text interpretation before writing. Do this in one shared export utility function, not ad hoc per column, so every current and future exported field is covered without remembering to re-check next time a column is added.

**Warning signs:**
None visible from the app itself — this is a "silent until someone gets phished/burned" class of bug. Treat it as a mandatory checklist item, not something to catch via manual testing.

**Phase to address:**
Export phase — should be part of the initial implementation, not a follow-up hardening pass, since `observacao` is explicitly free text.

---

### Pitfall A5: Long-running import request hits the serverless execution time limit

**What goes wrong:**
A Server Action / API route that validates + inserts every row of a spreadsheet synchronously in one request works fine with the 20-row test file used during development, then times out (504) on a real 500-row partner list — the import appears to "hang" or fail with no clear error, and the supervisor has no idea whether some rows were saved or not.

**Why it happens:**
Vercel's Hobby-plan serverless functions default to a 10-second execution limit (killable at that point regardless of what's mid-flight); this project is explicitly on the free/Hobby tier per `CLAUDE.md`'s zero-infra-cost constraint. Row-by-row validation + individual inserts against Supabase, each with network round-trip latency, adds up fast once row counts grow past a few dozen.

**How to avoid:**
- Batch inserts (500-1000 rows per statement, not one `INSERT` per row) to cut both round-trips and total request time.
- Keep the "validate + preview" step and the "commit to DB" step as separate requests: parse/validate happens in one shorter-lived call and returns a preview + error list to the browser (already scoped as a UI step — "tela de mapear colunas" and "mostrar erros/duplicados antes de confirmar" — so this fits the planned UX naturally); the actual commit-to-DB call only needs to do inserts, not full re-parsing.
- Design for the realistic ceiling: internal sales team spreadsheets are expected to be hundreds of rows, not tens of thousands — plan the commit step to comfortably finish under Hobby's ~10s window at that volume, and treat "still too slow" as a signal to chunk the commit into multiple sequential requests from the client (e.g. 200 rows per request) rather than reaching for a paid background-job service.

**Warning signs:**
Import "hangs" or returns a generic 504/timeout error on a full-size real file even though smaller test files work.

**Phase to address:**
Import commit phase — needs a load test with a realistic row count (300-800 rows) before considering it done.

---

### Pitfall A6: Partial-import failure leaves the funil in a half-imported, confusing state

**What goes wrong:**
Row 340 of a 500-row spreadsheet fails validation (missing required endereço field, or a duplicate) mid-commit. Depending on how the commit is written, either (a) Postgres rolls back the entire transaction and the supervisor sees "0 imported" with no idea which rows were the problem, or (b) the commit isn't wrapped in a transaction at all and 339 clients get created while the rest silently don't, leaving the supervisor unsure what actually landed in the funil.

**Why it happens:**
Bulk import naturally wants "best effort, skip the bad ones" behavior, but a single Postgres transaction is all-or-nothing by default — mixing "some rows commit, some don't" into one unguarded transaction either loses good rows or silently applies partial writes, and developers often don't decide explicitly which behavior they want until it happens in production.

**How to avoid:**
- Validate the entire file *before* touching the `clientes` table — the "mostrar erros/duplicados antes de confirmar" screen already scoped for this milestone is exactly the right place to catch bad rows, so make it a hard gate: nothing is written to the DB until validation of the whole file has already run and the supervisor has explicitly confirmed.
- At commit time, decide explicitly and document the choice: either commit only the rows that passed validation (skip/report the rest, e.g. via a temporary staging step or batching that only includes clean rows) or require 100% clean before any commit — but never let it happen implicitly via whichever rows a partial transaction happened to reach before failing.
- Always show a post-import summary: "N importados, M pulados por [motivo]" so the supervisor never has to guess what happened.

**Warning signs:**
Supervisor asks "importei mas não sei quantos entraram de verdade" or the funil count doesn't match what the supervisor expected after an import with known-bad rows in the source file.

**Phase to address:**
Import commit phase; validation-gate phase should be sequenced before it in the roadmap.

---

### Pitfall A7: File upload accepted based on filename/extension or client-sent MIME type alone

**What goes wrong:**
The upload endpoint checks only the file's extension (`.xlsx`/`.csv`) or the `Content-Type` header the browser sent, both of which are attacker-controlled and trivially spoofed — a malicious or malformed file (e.g. renamed executable, oversized file designed to exhaust memory, or a "zip bomb"-style crafted xlsx, since xlsx is itself a zip container) can be uploaded and processed by the parsing library server-side.

**Why it happens:**
Extension/MIME checks are the fastest thing to implement and look sufficient in casual testing, but neither reflects the file's actual binary content — this is OWASP's documented weak point for any file upload feature, and it's easy to skip harder validation for an "internal tool, low risk" feature like this one.

**How to avoid:**
- Enforce a hard file-size cap on upload (spreadsheets from partners/feiras have no legitimate reason to be huge; a cap in the low tens of MB is generous for a CRM contact list).
- Validate actual file signature/magic bytes server-side in addition to extension, not instead of it (defense in depth, not either/or).
- Because the only importer is the Supervisor role (already restricted per `PROJECT.md`), this is lower severity than a public-facing upload — but it still runs server-side code against the uploaded bytes, so treat it as untrusted input regardless of who's allowed to upload.
- If using the `xlsx` (SheetJS) npm package specifically for parsing: the widely-distributed npm version has a known prototype-pollution advisory (CVE-2023-30533) affecting versions through 0.19.2 when parsing crafted files — pin to a patched version (0.19.3+, note the officially patched build is distributed via SheetJS's own CDN rather than a newer npm release) or use an actively maintained alternative parser.

**Warning signs:**
No visible symptom until an unusual file is uploaded — verify explicitly during code review/security review of this phase rather than waiting for it to surface.

**Phase to address:**
Import upload phase — file validation should land in the same PR as the upload endpoint, not as a later hardening pass.

---

## Technical Debt Patterns (v1.1 addendum)

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Exact-match duplicate detection on razão social only (no normalization) | Ships faster, simpler code | Misses real duplicates (different formatting) and/or blocks non-duplicates; supervisor loses trust in the "duplicados" screen | Never for the actual detection logic — but acceptable to ship the *first* version with only whitespace/case normalization (not full suffix-stripping) and refine after real usage shows the gaps |
| Client-only column-mapping validation (no server re-validation) | Faster to build the mapping UI | A crafted request could bypass required-field checks that the RLS/DB schema doesn't itself enforce (e.g. razão social required only in the UI) | Never — required-field and type validation must be re-checked server-side regardless of what the mapping UI already validated, consistent with the project's existing zod-on-both-sides pattern |
| Skipping a post-import summary count | One less UI screen to build | Supervisor can't tell what actually happened after a partial failure; erodes trust in the feature | Never — this is cheap to build and directly prevents Pitfall A6's worst symptom |
| Reusing the single-record cadastro's Server Action for each imported row (loop of individual inserts) | Reuses existing, already-tested code | Multiplies latency by row count, makes the import much more likely to hit the serverless time limit at realistic volumes | Only acceptable for an internal "just make it work" first pass with a hard row cap (e.g. 50 rows) while the real batched-insert path is built |

## Integration Gotchas (v1.1 addendum)

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Supabase (RLS) | Running the bulk insert through the same client-side RLS-scoped session per row, incurring policy-evaluation overhead per row and multiplying round-trips | Perform the import commit through a server-side path (a Server Action calling Supabase with the request's authenticated session is fine at this row scale; a `SECURITY DEFINER` RPC is the documented escape hatch per this project's own `supabase-conventions` skill if RLS overhead becomes measurable) — but the *authorization check* ("is this user the Supervisor?") must still happen, RLS just shouldn't be the perf bottleneck |
| Vercel Hobby serverless functions | Assuming request duration scales fine because dev testing used a small file | Load-test the commit endpoint with a file at the upper end of realistic size (300-800 rows) before considering the phase done; batch server-side inserts and/or chunk the commit into multiple client-driven requests if the single-request path is close to the 10s ceiling |
| Excel PT-BR CSV export | Assuming comma-delimited CSV like most English-language tutorials/libraries assume by default | Detect delimiter from the file itself, or prefer `.xlsx` upload as the primary supported format since it has no delimiter ambiguity |

## Performance Traps (v1.1 addendum)

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Row-by-row insert loop against Supabase | Import "spins" for a long time then times out on real files | Batch inserts (500-1000 rows per statement) | Becomes noticeable past roughly 50-100 rows on Vercel Hobby's 10s window; guaranteed to break well before 500 rows if done row-by-row |
| Client-side-only spreadsheet parsing of a large file in the browser before upload | Browser tab freezes/crashes on a large partner spreadsheet | Parse server-side (or stream-parse) rather than loading the whole file into browser memory and JS-object-ifying it client-side | Matters once files approach a few thousand rows or include many columns; low risk at this project's expected volumes but cheap to avoid by parsing server-side from the start |
| Fetching full existing `clientes` table client-side to run duplicate-check in the browser | Slow duplicate-check step, high egress against Supabase's free-tier cap | Run duplicate detection as a server-side query/RPC with a narrow `select()`, not a full client-side table fetch — consistent with this project's existing "narrow select() over full client fetch" stack convention | Breaks the free-tier egress budget well before it breaks on raw speed, since egress (not row count) is the constrained resource here |

## Security Mistakes (v1.1 addendum)

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting client-sent file extension/MIME type for upload validation | Malformed/oversized/malicious file processed server-side by the parsing library | Validate file size + actual content signature server-side; enforce allowlist of xlsx/csv only |
| Writing free-text fields into exported CSV cells unsanitized | CSV/formula injection — corrupted or malicious spreadsheet opened by a teammate | Sanitize any cell starting with `=`,`+`,`-`,`@` before writing to the export |
| Using an outdated `xlsx` (SheetJS) npm package version to parse uploaded files | Prototype pollution (CVE-2023-30533) when parsing a crafted file, potential DoS/RCE-class impact | Pin to a patched SheetJS build (0.19.3+ via SheetJS's own distribution) or use a maintained alternative; this specifically matters here because parsing *user-uploaded* files (not just exporting) is exactly the vulnerable code path |
| Assuming "only the Supervisor can import" removes the need for server-side validation | A compromised/careless Supervisor session, or a bug in the role check, still hits an unguarded upload/parse path | Server-side role check (RLS/RPC-backed, per this project's existing authorization convention) is still mandatory even though only one role has UI access to the feature |

## UX Pitfalls (v1.1 addendum)

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Column-mapping screen with no preview of parsed values | Supervisor can't tell if columns lined up correctly (especially with the pt-BR delimiter issue) until after import, then has to fix bad data by hand | Show a small preview (first 3-5 parsed rows) under each mapped column before the supervisor confirms |
| Generic "import failed" error with no row-level detail | Supervisor has no idea which of hundreds of rows caused the problem, gives up or re-uploads blindly | Show a per-row error list (row number + reason: "linha 47: endereço obrigatório ausente") before commit, matching the "mostrar erros/duplicados antes de confirmar" requirement already scoped |
| No indication of which stage a large import is currently at (parsing vs validating vs committing) | Supervisor thinks the app froze during a slower real-file import and re-submits, risking a double-import | Simple progress/step indicator ("Lendo arquivo… Validando… Salvando…") even if each step is a separate request |
| Export button with no visible scope indicator | Vendedor exports and is confused about whether the file includes all clients or just their own | Label the export explicitly ("Exportar meus clientes" vs "Exportar todos os clientes") reflecting the RLS-driven scope so it's not ambiguous, even though the underlying rule (own vs all) is already decided |

## "Looks Done But Isn't" Checklist (v1.1 addendum)

- [ ] **Duplicate detection**: Often missing normalization of company-name formatting — verify with two test rows that are the same company but different case/punctuation/suffix and confirm they're flagged
- [ ] **CSV/xlsx parsing**: Often missing BOM-stripping and delimiter auto-detection — verify with a real file exported from Excel in pt-BR locale (semicolon-delimited, UTF-8 BOM), not just a hand-written comma CSV
- [ ] **Export**: Often missing CSV-injection sanitization on free-text fields — verify by putting a value starting with `=` or `+` in `observacao` or `contato` and confirming the exported file opens safely in Excel without a formula/warning
- [ ] **Import commit**: Often missing a load test at realistic volume — verify a 300-800 row real-shaped file completes without a serverless timeout
- [ ] **Partial-failure handling**: Often missing an explicit "what happened" summary — verify that after an import with some intentionally-bad rows, the supervisor sees a clear count of imported vs skipped, not silence or a generic error
- [ ] **File upload validation**: Often missing content-based (magic byte) validation beyond extension check — verify a renamed non-spreadsheet file is rejected server-side, not just by the `<input accept>` attribute (which is client-side only and trivially bypassed)
- [ ] **RLS on export**: Often missing a server-side re-check that a Vendedor's export request can't be tricked into returning all clients — verify the export query itself is scoped by the authenticated user's role/RLS, not filtered only in the UI

## Recovery Strategies (v1.1 addendum)

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|-----------------|
| Duplicate clients created from a bad detection pass | LOW-MEDIUM | Since clients aren't destructively merged, a supervisor can identify and manually delete the duplicate cards (delete is already supervisor-only per existing RLS rules); consider a follow-up "merge duplicates" utility if this recurs often |
| Partial import committed inconsistent rows | MEDIUM | Because imported clients always land in "Aguardando contato" with no downstream side effects yet triggered, a partial batch can be identified (e.g. via `created_at` timestamp window) and bulk-deleted by the supervisor, then re-imported after fixing the source file |
| CSV injection payload already exported and opened elsewhere | HIGH (depends on what ran on the opening machine) | Treat as a security incident, not just a bug — patch the export sanitization immediately and communicate to whoever opened the file; this is exactly why it must be prevented upfront rather than "recovered from" |
| Vulnerable xlsx parser version already shipped | LOW-MEDIUM | Bump to patched version, re-deploy; since only the Supervisor uploads files, exposure window is limited but should still be treated as a real fix, not deferred |

## Pitfall-to-Phase Mapping (v1.1 addendum)

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Fragile duplicate detection (name-only) (A1) | Import validation/duplicate-detection phase | Test with same company under 2+ formatting variants; confirm flagged, not silently duplicated or falsely blocked |
| pt-BR delimiter/decimal mismatch (A2) | Import parsing phase | Test with a real Excel-pt-BR-exported CSV (semicolon-delimited) as a required test fixture |
| UTF-8 BOM breaking header parsing (A3) | Import parsing phase | Test with a BOM-prefixed file fixture; confirm first column auto-maps correctly |
| CSV/formula injection on export (A4) | Export phase | Test exporting a client with `observacao` starting with `=`/`+`/`-`/`@`; confirm sanitized in output file |
| Serverless execution time limit on commit (A5) | Import commit phase | Load test with 300-800 row file; confirm completes without 504 |
| Partial-import inconsistent state (A6) | Import commit phase (sequenced after validation-gate phase) | Test import with intentionally-bad rows mixed in; confirm clear imported/skipped summary, no silent partial writes |
| Untrusted file upload (extension/MIME spoofing, vulnerable parser) (A7) | Import upload phase | Security review step: attempt uploading a renamed non-spreadsheet file, confirm server-side rejection; confirm xlsx parser dependency version is patched |

## Sources (v1.1 addendum)

- [OWASP: CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection) — Confidence: MEDIUM (cross-checked against multiple independent write-ups agreeing on mechanism and the leading-quote mitigation)
- [OWASP Web Security Testing Guide: Testing for CSV Injection](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/21-Testing_for_CSV_Injection)
- [Cyber Chief: CSV formula injection prevention in Node.js/Django/Flask/Java/PHP](https://www.cyberchief.ai/2024/09/csv-formula-injection-attacks.html)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — Confidence: MEDIUM
- [Sourcery: File Upload Content Type and MIME Type Bypass Vulnerabilities](https://www.sourcery.ai/vulnerabilities/file-upload-content-type-bypass)
- [Vercel Functions Limits (docs)](https://vercel.com/docs/functions/limitations) — Confidence: MEDIUM (cross-checked against 2 independent 2026 write-ups reporting the same 10s Hobby default / Fluid Compute 300s figures); recommend re-verifying exact current numbers directly against Vercel's docs at implementation time, since these limits have changed across Vercel plan revisions before
- [GitHub supabase/discussions: Best Practices for Inserting Large Number of Rows](https://github.com/orgs/supabase/discussions/11349) — Confidence: LOW (community discussion, not official doc)
- [SupaExplorer: Batch INSERT Statements for Bulk Data](https://supaexplorer.com/best-practices/supabase-postgres/data-batch-inserts/) — Confidence: LOW
- [PostgreSQL Wiki: UPSERT](https://wiki.postgresql.org/wiki/UPSERT) — Confidence: MEDIUM
- [dev.to: Understanding Atomicity in PostgreSQL](https://dev.to/kfir-g/understanding-atomicity-in-postgresql-a-deep-dive-into-the-a-in-acid-209a) — Confidence: LOW
- [ablebits: How to change Excel CSV delimiter to comma or semicolon](https://www.ablebits.com/office-addins-blog/change-excel-csv-delimiter/) — Confidence: MEDIUM (cross-checked against a second independent explanation of the same locale-driven Excel delimiter behavior)
- [LeapRows: How to Control CSV Encoding in Excel — The UTF-8 BOM Problem Explained](https://leaprows.com/en/blog/csv-utf8-bom-encoding-guide) — Confidence: MEDIUM
- [Elysiate: CSV Encoding Problems: UTF-8, BOM, and Character Issues](https://www.elysiate.com/blog/csv-encoding-problems-utf8-bom-character-issues) — Confidence: LOW
- [Snyk: Prototype Pollution in xlsx — CVE-2023-30533](https://security.snyk.io/vuln/SNYK-JS-XLSX-5457926) — Confidence: MEDIUM (cross-checked against GitHub Advisory Database and SheetJS's own advisory page reporting the same CVE and affected-version range)
- [GitHub Advisory Database: Prototype Pollution in sheetJS](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6)
- [SheetJS official advisory: CVE-2023-30533](https://cdn.sheetjs.com/advisories/CVE-2023-30533)
- [Supabase Docs: Understanding Edge Function CPU limits](https://supabase.com/docs/guides/troubleshooting/edge-function-cpu-limits) — Confidence: MEDIUM; relevant only if a future phase moves import processing into an Edge Function instead of a Vercel Server Action — noted here as a secondary option if the Vercel Hobby time limit proves too restrictive at real usage volumes
- [Datablist: What tools to dedupe using fuzzy matching?](https://www.datablist.com/learn/data-cleaning/fuzzy-matching) — Confidence: LOW
- [Databar.ai: CRM Deduplication Complete Guide](https://databar.ai/blog/article/crm-deduplication-complete-guide-to-finding-merging-duplicate-records) — Confidence: LOW — general CRM-deduplication best practice (normalize to a dedup key, prefer real unique identifiers over name matching, combine name with a secondary field); no dedicated primary source found specific to CNPJ/Brazilian tax-ID normalization, so treat the CNPJ-specific recommendation above as this researcher's inference from general dedup principles, not a directly sourced claim

---
*Pitfalls research for: Bulk import/export addition to CRM Raiar (v1.1 milestone)*
*Researched: 2026-07-22*


---

# Milestone Addendum: v1.2 Gestão de Equipe, Análises de Funil e Filtros

**Domain:** v1.2 features on an existing Next.js 16 (App Router) + Supabase (Postgres/Auth/RLS) CRM — team deactivation, funnel analytics from a free-text event log, Estado/Cidade data migration, Supervisor-only aggregates, fixed-height dnd-kit kanban columns.
**Researched:** 2026-07-25
**Confidence:** MEDIUM-HIGH (schema facts read directly from `supabase/migrations/0001-0006` = HIGH; Postgres/Supabase Auth/dnd-kit library behavior cross-checked against official docs = MEDIUM-HIGH; a few product-ambiguity flags are judgment calls, not documented facts = explicitly marked LOW)

## Critical Pitfalls

### Pitfall 1: Deactivation only bans in Supabase Auth — the already-issued JWT keeps working

**What goes wrong:**
A deactivated Vendedor/Supervisor keeps reading and writing data for up to the access-token lifetime (Supabase default ~1h) after being "deactivated," because `supabase.auth.admin.updateUserById(id, { ban_duration: ... })` only blocks future logins and token **refreshes** — it does not revoke an access token that's already been issued and is still cached in the browser. PostgREST (which every Supabase query goes through) validates the JWT's signature and expiry only; it does not call back to the Auth service to check ban status on every request.

**Why it happens:**
It's natural to treat "ban the user in Supabase Auth" as the whole solution, since that's the only Auth-native primitive available, and to stop there without adding a second, independent check.

**How to avoid:**
Add `profiles.ativo boolean not null default true` and make it the **primary, immediate** enforcement mechanism, not the Auth ban. Every RLS policy/helper that currently gates on role must also gate on `ativo`:
- `is_supervisor()` (0001) must become `role = 'supervisor' and ativo = true` — currently it only checks role, so a deactivated Supervisor would still pass every check that calls `is_supervisor()` unless this helper itself is updated.
- Any future `is_vendedor_ativo()`-style check used by `clientes`/`historico`/`tarefas` policies must do the same.

Because RLS is evaluated fresh on **every single request** (not cached in the JWT), flipping `profiles.ativo = false` cuts off access on the user's very next query — even mid-session, even with a technically-still-valid JWT. This is strictly faster and more reliable than relying on the Auth ban, and it's free (no extra infra). Treat the Auth-service ban (`ban_duration`) as **defense-in-depth for stopping new logins/refreshes**, not as the access-control boundary.

**Warning signs:**
- A manual test: deactivate a user in another browser tab while they're mid-session in a first tab, then have them click something in the first tab without refreshing — if it still succeeds, `ativo` isn't wired into RLS yet.
- Any RLS policy/RPC that checks `is_supervisor()` or `role = 'vendedor'` without also checking `ativo`.

**Phase to address:**
Feature 1 (deactivate team member).

---

### Pitfall 2: The Auth-ban step needs the service role key — it cannot live inside a plain Postgres RPC

**What goes wrong:**
Following the existing RPC pattern (`mover_card_funil`, `importar_clientes_lote` — both plain `language plpgsql`, not `security definer`, called via `supabase.rpc(...)`), it's tempting to implement the whole deactivation flow as one more Postgres RPC. But `supabase.auth.admin.updateUserById` is an **Auth service** operation, not a Postgres one — Postgres has no access to it at all. It can only be called from trusted server-side code (a Next.js Server Action or an Edge Function) holding `SUPABASE_SERVICE_ROLE_KEY`, per the project's own `supabase-conventions` skill ("Edge Function... só quando a lógica precisa de algo externo... usar uma secret key").

**Why it happens:**
Every write in this project so far has fit inside a single Postgres RPC; this is the first v1.2 feature that genuinely needs to reach outside Postgres.

**How to avoid:**
Split deactivation into two steps and treat the Postgres one as the source of truth:
1. **Postgres transaction/RPC** (non-security-definer, `is_supervisor()` guard, same pattern as existing RPCs): reassign `clientes.responsavel` for the target user, run the last-active-Supervisor guard (Pitfall 3), then set `profiles.ativo = false`. This alone already blocks all further data access per Pitfall 1, regardless of what happens next.
2. **Server Action with the service role key** (never in client code, never `NEXT_PUBLIC_`-prefixed — see Security Mistakes): call `auth.admin.updateUserById(id, { ban_duration: '87600h' })` (or similar) as a best-effort follow-up to stop future logins/refreshes.

Sequence step 1 first. If step 2 fails or is slow, the system still fails safe — RLS is already blocking the deactivated user.

**Warning signs:**
- Trying to call `supabase.auth.admin.*` from a plain PL/pgSQL function — it doesn't exist there; will surface as "function does not exist" or simply be structurally impossible to write.
- `SUPABASE_SERVICE_ROLE_KEY` referenced anywhere reachable from client bundles.

**Phase to address:**
Feature 1.

---

### Pitfall 3: Check-then-act race lets the last two Supervisors deactivate each other simultaneously

**What goes wrong:**
A naive guard ("`select count(*) from profiles where role='supervisor' and ativo` — if count > 1, allow deactivation") is a classic TOCTOU race: two concurrent transactions (two Supervisors each deactivating a *different* Supervisor, or one deactivating themselves while another does the same to a third) can both read `count = 2` before either commits, and both proceed, leaving zero active Supervisors — locking everyone out of the parts of the system Supervisor-gates.

**Why it happens:**
The count-then-decide logic looks correct in isolation and this project has no precedent yet for concurrency-sensitive guards (v1.0/v1.1 RPCs are all per-row, not aggregate-guard, operations).

**How to avoid:**
Make the guard atomic by locking the rows it depends on before counting, inside the same transaction as the `ativo = false` update:
```sql
perform 1 from profiles
where role = 'supervisor' and ativo = true
for update;

if (select count(*) from profiles where role = 'supervisor' and ativo = true) <= 1 then
  raise exception 'Não é possível desativar o último Supervisor ativo';
end if;
```
`for update` serializes concurrent deactivation attempts against the same row set — the second transaction blocks until the first commits (or rolls back), so it re-reads a consistent count.

**Warning signs:**
- Any last-Supervisor check written as a plain `select count(*)` without `for update`/row locking in the same statement as the mutation.
- No test that fires two concurrent deactivation RPC calls against the last two Supervisors.

**Phase to address:**
Feature 1.

---

### Pitfall 4: Reassignment + historico writes chained across CTEs hit the same RLS-visibility bug already found in v1.1 (migration 0006)

**What goes wrong:**
The project already has a documented, project-specific instance of this bug: `importar_clientes_lote` originally chained the `clientes` INSERT and the `cliente_produtos` INSERT as two data-modifying CTEs inside one `WITH` statement. Postgres evaluates every CTE of a single statement against the **same command snapshot**, so a later CTE's RLS `EXISTS` check re-scanning the real `clientes` table cannot see rows written by an earlier CTE of that same statement — the fix (0006) was to split it into two **sequential statements**, not one chained `WITH`.

Feature 1's reassignment logic is structurally the same shape: it needs to (a) bulk-`UPDATE clientes SET responsavel = new_vendedor WHERE responsavel = old_vendedor`, and depending on design, (b) possibly write/read something that RLS-gates on the parent `clientes` row's current state (e.g., historico visibility, or a report of "N clientes reassigned"). If (a) and (b) are chained as CTEs of one statement, (b) risks the exact same "can't see the update for RLS purposes" failure.

**Why it happens:**
It's a genuinely non-obvious Postgres semantic (each CTE of one `WITH` sees the pre-statement snapshot for RLS/re-scans of the base table), and the natural instinct when writing "reassign, then report" logic is to chain it into one query for efficiency.

**How to avoid:**
Follow the 0006 fix exactly: split into **separate sequential SQL statements** inside the PL/pgSQL function body (not chained data-modifying CTEs in one `WITH`). Capture what you need from the first statement's `RETURNING` into a PL/pgSQL array/variable, then use that in the next statement — never re-query the base table's RLS-relevant state from inside a second CTE of the same statement that wrote to it.

**Warning signs:**
- Error `new row violates row-level security policy` or `0 rows affected` on a step that should clearly succeed, immediately after a prior write in the same statement.
- Any new RPC with more than one data-modifying CTE inside a single `WITH ... AS (...)`.

**Phase to address:**
Feature 1. Reference: `supabase/migrations/0006_fix_importar_clientes_lote_cte_rls_visibility.sql`.

---

### Pitfall 5: `now()` is frozen per-transaction — historico events written together get identical timestamps, breaking chronological ordering

**What goes wrong:**
Postgres's `now()` returns the **transaction start time**, not the statement/row execution time. `clientes_after_update_historico()` (0002) can insert **two** historico rows in one trigger firing (one `tipo='etapa'`, one `tipo='status_acompanhamento'`) when a single `mover_card_funil` call changes both columns at once (e.g., moving to "1ª venda concluída" while marking `ganho`). Both rows get the exact same `criado_em`. Any future stage-duration or win/loss-date logic (features 2 and 3) that sorts historico rows `order by criado_em` to reconstruct sequence has no reliable tiebreak between same-transaction rows, and this gets worse if a future bulk-move or bulk-status-change RPC is ever added (all its historico rows would share one timestamp).

**Why it happens:**
`now()`/`current_timestamp` being transaction-scoped (not per-statement) is a well-known but easy-to-forget Postgres behavior; it "just works" for display purposes and only becomes a bug when code starts depending on `criado_em` for **ordering**, which v1.0/v1.1 never needed.

**How to avoid:**
For any new logic that depends on event ordering (feature 2's time-in-stage math, feature 3's win/loss-date math), never assume `criado_em` alone disambiguates order within a transaction. Either: (a) add a monotonic `id`/sequence-based tiebreak (`order by criado_em, id` only works if `id` generation order matches insertion order, which `gen_random_uuid()` does **not** guarantee — so this doesn't actually fix it), or (b) switch the historico insert triggers to `clock_timestamp()` instead of `now()` for `criado_em` specifically (statement-time, monotonically increasing even within one transaction), or (c) add an explicit integer sequence column. Recommend (b) as the least invasive: it only changes what `criado_em` records, not the schema.

**Warning signs:**
- Two historico rows for the same `cliente_id` with identical `criado_em` down to the microsecond.
- Stage-duration calculations that produce a negative or zero duration for a transition that should have taken measurable time.

**Phase to address:**
Feature 2 (funnel conversion metrics) and feature 3 (avg days-to-win/loss) — both depend on historico ordering.

---

### Pitfall 6: Time-in-stage math built only from `historico` silently excludes the initial stage, currently-open stays, and non-linear moves

**What goes wrong:**
`historico` only gets a `tipo='etapa'` row on **UPDATE** (`clientes_after_update_historico`, fires `after update`) — there is no `after insert` trigger, so the time a card spends in its very first stage (from `clientes.criado_em` until its first move) has **zero historico rows** representing it. A query that computes stage durations purely by pairing consecutive historico rows will:
1. Never account for time spent in the stage a card was created into (miscounts every card that hasn't moved yet, and undercounts every card's first stage even after it moves).
2. Exclude cards **currently sitting** in a stage with no further transition yet — the interval from "entered this stage" to "now" is open-ended and must still count. Since the entire point of this feature is to surface stuck/stalled cards, excluding open intervals **excludes exactly the data the feature exists to show** (classic survivorship bias — the stuck cards are the ones missing their "next" event).
3. Assume linear progression: `mover_card_funil` has no constraint forcing forward-only or one-step moves — a card can skip stages or move backward. Pairing "enter stage N" with "enter stage N+1" (instead of "enter stage N" with "whatever the next chronological event actually is") breaks the moment a card skips or reverts.

**Why it happens:**
The event log's shape (`descricao` only records the destination stage, not origin) plus the missing insert-trigger make "reconstruct history" look more complete than it is; it's easy to write a query that looks right against a happy-path test card (created → moved once → moved again) and silently wrong for real data (imported batches sitting untouched, cards moved backward, cards created straight into a mid-funnel stage via Supervisor cadastro).

**How to avoid:**
1. Treat `clientes.criado_em` as a synthetic "entered [initial etapa] at this time" event, unioned with the real historico `tipo='etapa'` rows, before computing any interval.
2. For the most recent event per `cliente_id` (whether that's the synthetic creation event or the last historico row), compute its duration against `now()`, not against a next-event that doesn't exist yet — include these open intervals in the average, ideally with a way to distinguish "still ongoing" from "completed stay" in the UI (e.g., show both an average **completed** time-in-stage and a "N cards currently over X days in this stage" count — this is exactly the kind of stuck-card signal the milestone is asking for).
3. Compute durations as: sort each cliente's (synthetic + real) etapa events chronologically, and attribute the duration of the interval **[event i, event i+1)** to the etapa value carried by **event i** (the stage the card was actually in during that interval) — this is correct regardless of whether event i+1 is a forward move, a skip, or a backward move, because it never assumes which stage comes "next," it only uses the actual next event whatever it is.
4. Given the log stores only free text (`format('Etapa alterada para "%s"', ...)`), parsing it via `ILIKE`/regex is inherently brittle (already a known weak point — see `dashboard_ganhos_perdidos` in 0003, which does the same `ilike '%"ganho"%'` pattern). **Recommend adding structured columns** (`historico.etapa_anterior etapa_funil`, `historico.etapa_nova etapa_funil`) via a new migration, backfilling `etapa_nova` from a one-time parse of existing rows (and reconstructing `etapa_anterior` from each cliente's previous event, or from `clientes.criado_em`'s implicit stage where there is none) and updating the trigger to write both columns going forward. This removes text-parsing risk from every future aggregate rather than re-solving it per query.

**Warning signs:**
- Average time-in-stage for a stage known (from manual observation) to have several stalled cards comes out suspiciously low.
- A card created directly into a non-first stage (Supervisor cadastro, or a card manually moved right after import) shows `NULL`/zero time for its actual first stage.
- Sum of all per-stage average durations times card counts doesn't roughly reconcile with `now() - criado_em` for a sample of individual cards.

**Phase to address:**
Feature 2 (funnel conversion metrics per stage).

---

### Pitfall 7: "Days to win/loss" is ambiguous once a card's status has flipped more than once

**What goes wrong:**
`dashboard_ganhos_perdidos` (0003) already documents this exact edge case: a card can go `perdido → em_andamento → ganho`, and its comment explains the existing dashboard query resolves it by taking "only the most recent status-change event **that still matches the current status**" — a reasonable choice for a point-in-time count, but genuinely ambiguous for a **duration** metric. When a card flips status multiple times, "days to win" could mean: (a) `criado_em` to the *first* time it became `ganho`, (b) `criado_em` to the *most recent* time it became `ganho` (matching the existing dashboard's convention), or (c) time since the *last* status change regardless of how many prior flips happened. These give materially different numbers, and picking silently (without it being a deliberate product decision) risks numbers that don't match what the Supervisor expects when they cross-check a specific client by memory.

**Why it happens:**
The requirement ("average days to win / days to loss as two separate summary numbers") reads as simple, but the underlying data model already has a known toggle-status edge case that a simple average doesn't obviously resolve.

**How to avoid:**
Reuse the **same** convention already established in `dashboard_ganhos_perdidos`/`dashboard_desempenho_vendedor` (most-recent status-change event that still matches current status) for consistency — don't invent a second convention for a closely related metric. Explicitly document this choice (in code comment and in the phase's spec) so it's a deliberate decision, not an accident, and so the "por vendedor" comparison table (feature 4) and the "days to win/loss" summary (feature 3) agree with each other and with the existing ganhos/perdidos dashboard counts.

**Warning signs:**
- Two different dashboard widgets (existing ganhos/perdidos count vs. new days-to-win average) disagree on which clients count as "ganho" for the same period.
- A manually-checked client that's been marked ganho/perdido/ganho again produces a days-to-win number that doesn't match anyone's intuition about "how long did this actually take."

**Phase to address:**
Feature 3 (avg days-to-win/loss). Confidence: LOW on which convention is "correct" — this is a product decision, not a technical fact; flagging it so it gets made deliberately.

---

### Pitfall 8: Per-vendedor stats attributed to `clientes.responsavel` (current) instead of `historico.autor_id` (at-the-time) get silently corrupted by every future reassignment

**What goes wrong:**
Feature 1 explicitly requires reassigning `clientes.responsavel` on deactivation while keeping `historico.autor_id` untouched ("manter atribuição histórica intacta"). If the per-vendedor comparison table (feature 4) or any "deals closed" metric is computed by grouping `clientes` on **current** `responsavel`, then every deal a deactivated vendedor ever closed gets silently re-attributed to whoever inherited their book of clients after a reassignment — inflating the new owner's historical stats and zeroing out the original closer's, even for deals closed months before the reassignment happened.

**Why it happens:**
`clientes.responsavel` is the obvious, already-indexed column to `GROUP BY`, and it's what every existing dashboard function (0003) already uses — there's no precedent yet in this codebase for "who did this at the time" vs. "who owns this now" diverging, because reassignment didn't exist before v1.2.

**How to avoid:**
For metrics that are inherently historical ("deals won/lost", "average cycle time to close" — i.e., anything answering "how did this vendedor perform"), attribute to the `autor_id` of the specific `historico` row representing the win/loss event (same event used for Pitfall 7's date), not to `clientes.responsavel` today. Reserve `clientes.responsavel`-based grouping for genuinely **current-state** questions (e.g., "how many open deals does this vendedor have right now"), which should legitimately reflect reassignment. Document which of the two basis columns each new dashboard function uses, the same way 0003 already documents "criado_em vs. status-change date" as two deliberately different bases for different questions (D-09 vs. D-02 in that migration's comments).

**Warning signs:**
- A vendedor's "deals ganhos" count changes immediately after an unrelated teammate is deactivated and their clients reassigned, with no new sales activity.
- Historical dashboard numbers for past periods change when queried again after a reassignment event (a correct historical metric should be stable once the period is closed).

**Phase to address:**
Feature 4 (per-vendedor comparison table), cross-cutting with feature 1 (deactivation/reassignment) and feature 3 (days-to-win/loss).

---

### Pitfall 9: Migrating free-text Estado to a fixed 27-UF list can silently fail the deploy or silently hide/corrupt existing clients

**What goes wrong:**
`clientes.estado` is `text not null` with zero constraint today, and known to contain a mix of full names ("São Paulo"), abbreviations ("SP"), and typos. Two common bad approaches:
1. **Hard constraint added directly** (`check (estado in (<27 UFs>))` or converting to a Postgres `enum` type): this validates **every existing row synchronously** at migration time. Any row with an unmapped value (a typo, a full name not yet normalized, blank) makes the whole migration fail — blocking deploy, potentially mid-release.
2. **Silent normalization with a fallback**: mapping anything unrecognized to `NULL` or to a default UF "just to make the constraint pass" **hides or corrupts real client data** without the Supervisor ever being told which rows were affected — a client's real state silently becomes wrong or missing, and any existing Estado-based filter or export will now be quietly incomplete without an error.

**Why it happens:**
Both approaches make the migration "just work" in the moment; the cost shows up later as either a deploy blocker discovered under time pressure, or worse, as data that looks fine until someone notices a specific known client no longer appears under the state they expect.

**How to avoid:**
1. **Backfill first, constrain second.** Build a normalization mapping (full names + common accentless/typo variants → UF) and run an `UPDATE` pass against existing data before adding any constraint. Run `select distinct estado from clientes where estado not in (<27 UFs>)` and get an explicit count/list of remaining unmapped rows before proceeding — do not guess at 100% coverage.
2. **Add the constraint as `NOT VALID` first**: `alter table clientes add constraint chk_estado_valido check (estado in (<27 UFs>)) not valid;` — this is enforced for all **new** writes immediately without scanning/blocking on existing rows (confirmed current Postgres behavior). Existing bad rows remain exactly as they are and remain queryable/visible (not silently hidden) while a manual cleanup pass runs, then `alter table clientes validate constraint chk_estado_valido;` once cleanup is confirmed complete.
3. For any row that genuinely can't be auto-mapped (real typo, ambiguous data), leave it visibly flagged in the UI (e.g., an explicit "Estado não reconhecido — revisar" state) rather than defaulting it to any specific UF — a wrong guess is worse than an honest "needs review."
4. Update the **importação** RPC (`importar_clientes_lote`, which today accepts `estado text` completely unvalidated) to enforce the same 27-UF list at the same time — otherwise the very next bulk import reintroduces the exact inconsistency this migration just cleaned up.
5. Keep Estado as a fixed list in code/migration (not a new Supervisor-editable lookup table like `categorias`/`produtos_consumidos`/`tipos_tarefa`/`motivos_perda`) — Brazilian UFs are a closed, non-editable set of exactly 27, unlike this project's other "enum" fields, which are deliberately editable-by-permission. Don't reflexively copy the CRUD-lookup-table pattern here; it would add pointless admin surface for something that never changes (parallels the project's existing decision to keep funnel stages fixed rather than CRUD-editable).

**Warning signs:**
- Migration fails on `ALTER TABLE ... VALIDATE`/`CHECK` with a constraint-violation error naming specific row values.
- Client list counts under a specific Estado filter drop after the migration compared to before, with no corresponding drop in total client count.
- The Cidade cascading select (sourced from existing records — see Pitfall 10) shows fewer or duplicate cities immediately after the Estado migration.

**Phase to address:**
Feature 6 (Estado/Cidade structured filters).

---

### Pitfall 10: Cidade dropdown "sourced from existing records" is built from raw (pre-normalization) Estado groupings, or has no escape hatch for genuinely new cities

**What goes wrong:**
Two related traps in feature 6's Cidade cascade:
1. If the Cidade-options query (`select distinct cidade from clientes where estado = :uf`) runs against the **same** free-text `estado` column before/without Pitfall 9's normalization being complete, cities that were entered under "São Paulo" for one row and "SP" for another end up split across two different (soon-to-be-invalid) Estado groupings — the dropdown either misses cities or shows them duplicated depending on which Estado variant is queried. This must run strictly **after** the Estado backfill, against normalized data.
2. Because Cidade options are sourced only from **existing** client records (not a static IBGE municipality list), there is structurally no way to enter a client in a genuinely new city not already in the database — the first client ever registered in a new city has no valid option to pick. If the UI doesn't include an explicit fallback (free-text "outra cidade" entry, or an inline "add city" affordance), this becomes a hard blocker for legitimate new data entry, not just an edge case.

**Why it happens:**
"Cascading select sourced from existing data" is simple to build against a snapshot of current data, and the new-city gap is easy to miss because it won't show up in testing against an already-populated database.

**How to avoid:**
Sequence: normalize Estado (Pitfall 9) → backfill/verify → build the Cidade distinct-value source. Add a deliberate "cidade não está na lista" escape hatch (free-text fallback that still ends up filed under the chosen Estado) so the cascade never blocks entry of a real new client.

**Warning signs:**
- Same city name appearing twice in the Cidade dropdown under the same Estado.
- A vendedor reports being unable to register a client in a city they know is correct.

**Phase to address:**
Feature 6.

---

### Pitfall 11: Per-vendedor comparison table becomes `security definer` "for simplicity" and leaks every vendedor's rows to every vendedor

**What goes wrong:**
The existing dashboard functions (0003) are all deliberately `language sql stable` **without** `security definer`, so each call runs as the calling user and RLS on `clientes` transparently restricts a Vendedor's aggregate to their own rows — this is explicitly called out in that migration's header comment as a rule ("NEVER add security definer here... start returning every vendedor's data to every caller"). The new per-vendedor comparison function (feature 4) is the same shape (group-by-`responsavel` aggregate) and carries exactly the same risk: adding `security definer` — even for an unrelated reason like "it needs to join something RLS would otherwise block" — silently defeats the row-level restriction and a Vendedor calling it would see every colleague's numbers, not just their own.

**Why it happens:**
`security definer` is the "make the permission error go away" fix, and this feature is more complex (multi-table joins, cycle-time math) than the existing dashboard functions, increasing the temptation to reach for it if a join hits an unexpected RLS wall during development.

**How to avoid:**
Keep the new function `security invoker` (i.e., omit `security definer` entirely), matching the existing pattern exactly. Write an integration test mirroring the project's existing `tests/dashboard/rls-dashboard.test.ts` pattern: log in as a Vendedor, call the new comparison RPC, and assert it returns at most one row (their own) or zero rows — not the full team. Since `profiles` already has an open `select` policy (`using (true)` — every authenticated user can already read every profile's name), the actual sensitive surface here is the **metrics**, not the names; make sure the query never independently lists all `profiles` with role='vendedor' and left-joins metrics in a way that exposes "0 deals" for colleagues as if it were real data — either omit rows the caller can't see metrics for, or don't run this widget's query at all for non-Supervisor callers (UI-side is a courtesy, RLS is still the actual boundary).

**Warning signs:**
- Any `security definer` on a new function that aggregates across `responsavel`.
- A Vendedor account seeing more than one row (or any teammate's name paired with non-zero metrics) in this table during manual testing.

**Phase to address:**
Feature 4 (per-vendedor comparison table). Cross-reference: `supabase/migrations/0003_dashboard_aggregates.sql` header comment (existing project rule) and Pitfall 8 above (which basis column to aggregate on).

---

### Pitfall 12: Fixed-height scroll columns break dnd-kit's auto-scroll and stale-rect collision detection

**What goes wrong:**
Capping each kanban column to a fixed height with its own `overflow-y: auto` (feature 5) interacts with `@dnd-kit` in two specific, well-documented ways:
1. **Auto-scroll targeting**: dnd-kit's auto-scroll plugin detects scrollable ancestors and scrolls them when the pointer nears an edge during drag. If the column's scroll container isn't correctly picked up (e.g., because the droppable ref and the scroll container are the same node with conflicting overflow/position styling, or a `canScroll`/`scrollableAncestors` override wasn't updated after introducing internal scroll), dragging toward a card below the visible fold of a short column simply can't reach it — the page used to scroll for this, but no longer does once the outer page stops growing.
2. **Stale droppable rects during scroll**: dnd-kit's default measuring strategy measures droppable containers once (before/at drag start), which was fine when the page didn't scroll during a drag. Once columns scroll internally *during* a drag (via auto-scroll), the drop targets' on-screen positions change but a `DndContext` left at default measuring won't re-measure them, causing drops to register in the wrong slot or not register as "over" the column at all. Fix confirmed via dnd-kit docs: set `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` on `DndContext` once internal scrolling is introduced.

A secondary, easy-to-miss CSS issue: if `DragOverlay` is ever rendered inline inside the scrollable column div instead of relying on its default body-portal behavior, the column's `overflow: hidden`/`auto` will visually clip the dragged card as soon as it's lifted above the column's bounds.

**Why it happens:**
The kanban board currently works because the whole page scrolls together; fixed-height per-column scrolling is a structurally different layout that dnd-kit needs to be explicitly told about — it isn't automatic just because CSS `overflow` changed.

**How to avoid:**
- Separate the droppable boundary element (fixed height, defines the column's drop-zone rect) from the inner scrollable list element, rather than making one div do both jobs.
- Add `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` to the top-level `DndContext` once columns scroll internally.
- Verify `DragOverlay` still portals to `document.body` (dnd-kit's default) rather than being nested inside the new scroll container.
- If touch/tablet use is a realistic scenario, set `touch-action: none` on the drag handle only (not the scroll container), and keep a `PointerSensor` `activationConstraint: { distance: 8 }` so a short touch is read as "start scrolling," not "start dragging."
- Manually test dragging a card from the top to the bottom of a column with more cards than fit in the fixed height, on both mouse and (if relevant) touch.

**Warning signs:**
- Cards below the visible area of a column can't be reached by dragging near the column's bottom edge.
- A card dropped near a column boundary during/after an auto-scroll lands in the wrong position or wrong column.
- The dragged card visually disappears/clips at the column's edge instead of floating above it.

**Phase to address:**
Feature 5 (fixed-height kanban columns).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Parsing `historico.descricao` free text (ILIKE) for stage-duration math instead of adding structured `etapa_anterior`/`etapa_nova` columns | No new migration/backfill work for feature 2 | Brittle to any future wording/format change in the trigger's `format()` string; every new aggregate re-implements the same fragile parsing (already true of `dashboard_ganhos_perdidos`) | Only for a first pass with a hard follow-up commitment to add structured columns before more metrics are built on the same text |
| Defaulting unmapped legacy Estado values to a guessed UF instead of an explicit "needs review" flag | Constraint passes cleanly, no visible loose ends | Silently wrong client data that nobody is prompted to fix; erodes trust in Estado-based filters/reports | Never |
| Deactivation implemented as `security definer` RPC "to make the Auth-ban call simpler" | Avoids the two-step Postgres-then-Server-Action split | `security definer` on Postgres can't reach the Auth service anyway (Pitfall 2) — this shortcut doesn't even work, it just obscures where privilege escalation is actually happening | Never — this isn't a valid shortcut, it's a misunderstanding of the boundary |
| Building the per-vendedor comparison table on `clientes.responsavel` instead of `historico.autor_id` | Simpler query, reuses existing indexed column, matches existing 0003 pattern | Historical stats silently rewrite themselves after every future reassignment (Pitfall 8) | Acceptable only for genuinely current-state questions ("open deals right now"), never for historical performance metrics |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Supabase Auth Admin API (`auth.admin.updateUserById` with `ban_duration`) | Calling it from client code, or assuming it invalidates already-issued access tokens | Call only from a Server Action/Edge Function holding `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_`-prefixed); treat it as secondary defense, with `profiles.ativo` + RLS as the primary, immediate cutoff (Pitfall 1) |
| `@dnd-kit/core` `DndContext` + internal-scroll columns | Assuming auto-scroll and collision detection "just work" the same way they did with page-level scroll | Explicitly set `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` and verify the scrollable ancestor is correctly detected once columns get `overflow-y: auto` (Pitfall 12) |
| Postgres `now()` in trigger-written timestamps | Assuming `criado_em` values are strictly increasing across rows written in one transaction | Use `clock_timestamp()` (statement-time) instead of `now()` (transaction-time) for any timestamp column used for event ordering (Pitfall 5) |
| Postgres `CHECK`/`enum` constraints on a column with pre-existing bad data | Adding the constraint directly and letting the migration fail (or worse, coercing bad data silently to pass it) | Backfill first, then add as `NOT VALID`, then `VALIDATE CONSTRAINT` once confirmed clean (Pitfall 9) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Computing time-in-stage/win-loss durations client-side by fetching full `historico` rows per cliente | Dashboard load grows with total historico row count, egress climbs against Supabase's 5GB/month free-tier cap | Compute in a `stable` SQL/PL-pgSQL function (same pattern as 0003), returning only aggregated rows, not raw historico | Once historico rows number in the low thousands, a client-side reduction becomes both slow and egress-expensive |
| Estado/Cidade cascading select re-querying `distinct cidade` from the full `clientes` table on every keystroke/render | Noticeable UI lag as client count grows; repeated full-table scans | Query once per Estado selection (not per keystroke), consider a small materialized/cached list per Estado if client count grows past a few thousand | Not an issue at current free-tier client volumes (hundreds), worth revisiting only if `clientes` grows into the tens of thousands |
| `@dnd-kit` collision detection cost with fixed-height columns holding very large card counts | Drag feels laggy once a single column holds hundreds of cards, independent of the scroll-height change | Already flagged in `STACK.md`'s Alternatives Considered (Atlassian `pragmatic-drag-and-drop` if this becomes a real bottleneck) — not expected at this project's scale | ~1,000+ cards in a single column |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `SUPABASE_SERVICE_ROLE_KEY` accidentally prefixed `NEXT_PUBLIC_` or otherwise reachable from client bundles | Full admin access to Auth (and RLS-bypass on the DB) exposed to anyone inspecting client JS — the first time this project would need this key at all, so there's no existing convention to follow by habit | Only reference the service role key inside Server Actions/Edge Functions; verify via a bundle-content check (`grep` the built client chunks) that it never appears client-side |
| `is_supervisor()` (and any future `is_*_ativo()` helper) not updated to also check `profiles.ativo` | A deactivated Supervisor keeps passing every RLS policy/RPC guard that calls this helper, silently defeating the whole deactivation feature | Update the shared helper once, in one migration, and re-run every existing test that depends on `is_supervisor()` to confirm nothing else regresses |
| Trusting only UI role-hiding to keep the per-vendedor comparison table Supervisor-only | Contradicts `CLAUDE.md`'s explicit rule against UI-only authorization; even though the underlying RLS pattern here happens to be safe-by-construction (Pitfall 11), a future edit could add `security definer` without anyone noticing the UI was the only real gate | Keep an integration test asserting a Vendedor's RPC call is empty/self-only, independent of whatever the UI currently hides |
| No `for update` row lock on the last-active-Supervisor check | Concurrent deactivation requests can both pass a stale count check, leaving zero active Supervisors | `for update` lock inside the same transaction as the mutation (Pitfall 3) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Cidade select with no fallback for a city not yet in any existing client record | Vendedor is blocked from registering a legitimate new client in a genuinely new city | Add an explicit free-text "outra cidade" fallback (Pitfall 10) |
| Estado values that fail auto-normalization silently defaulted instead of flagged | Supervisor never learns a specific client's address data is now wrong | Visible "Estado não reconhecido — revisar" state on affected records (Pitfall 9) |
| Average time-in-stage excluding currently-stalled cards (open intervals) | The dashboard's core purpose — surfacing where the funnel is stuck — is defeated by exactly the data it's meant to show | Explicitly include open intervals (Pitfall 6), and consider a companion "cards over N days in this stage" count for extra visibility |
| Per-vendedor comparison table showing "0 deals" for a colleague with genuinely no visible data vs. a colleague who legitimately closed zero deals | A Vendedor (if the widget were ever visible to them) can't distinguish "I can't see this" from "this person did nothing" | Either don't render the widget at all for non-Supervisor callers, or omit rows the caller has no visibility into rather than showing them as zero |

## "Looks Done But Isn't" Checklist

- [ ] **Deactivation**: Often missing the `ativo` check inside `is_supervisor()`/other shared role helpers — verify a deactivated Supervisor is actually rejected by every RPC that calls that helper, not just by a fresh login attempt.
- [ ] **Deactivation**: Often missing an atomic last-Supervisor guard — verify with a concurrency test (two simultaneous deactivation calls against the last two active Supervisors), not just a sequential manual click-through.
- [ ] **Funnel conversion metrics**: Often missing the initial-stage duration (no historico row exists for it) and open (in-progress) intervals — verify a freshly-created, never-moved card and a long-stalled card both contribute correctly to the averages, not just cards that have completed multiple transitions.
- [ ] **Estado/Cidade migration**: Often missing a post-migration reconciliation check — verify total client count and per-Estado filter counts before and after match (no client silently vanished from a filter).
- [ ] **Estado/Cidade migration**: Often missing the importação RPC update — verify a fresh spreadsheet import with a free-text "São Paulo" Estado column either gets normalized or rejected, not silently inserted as invalid raw text again.
- [ ] **Per-vendedor comparison table**: Often missing the RLS-scoping integration test — verify a Vendedor account calling the underlying RPC directly (not just via the hidden UI) never receives another vendedor's metrics.
- [ ] **Kanban fixed-height scroll**: Often missing drag-to-bottom testing — verify a card below the fold of a short column can actually be dragged to and dropped correctly, with auto-scroll engaging.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Deactivation only banned in Auth, `ativo`/RLS never wired in | LOW | Add the `ativo` column/check retroactively (no data loss — it's additive); existing sessions self-correct on their next request once the policy is live |
| Free-text Estado silently coerced/nulled during migration | HIGH | Requires restoring original free-text values from a pre-migration backup/export (the v1.1 export feature can double as an ad-hoc backup before running this migration) and re-running the backfill properly; if no backup exists, affected rows may need manual re-entry from memory/other records |
| Time-in-stage metrics shipped without accounting for open intervals or the initial stage | MEDIUM | No data loss — it's a query bug, not a data bug; fix the aggregate function and the numbers self-correct on next dashboard load, no backfill needed since historico/clientes rows are untouched |
| Per-vendedor comparison table shipped as `security definer` | MEDIUM | Remove `security definer`, re-test with the Vendedor-scoping integration test; no data was persisted incorrectly, only over-exposed on read, so no backfill needed — just redeploy the corrected function |
| dnd-kit drag/drop broken in fixed-height columns | LOW | Purely a frontend/CSS+config fix (measuring strategy, container structure) — no data implications, safe to iterate live |

## Pitfall-to-Phase Mapping

| Pitfall | Target Feature | Verification |
|---------|-----------------|----------------|
| 1. Deactivated user's live JWT keeps working | Feature 1 | Manual concurrent-session test: deactivate mid-session, confirm next request from the still-open session fails |
| 2. Auth-ban needs service role key, can't live in Postgres RPC | Feature 1 | Code review: confirm the Auth-ban call only exists in a Server Action/Edge Function, never inside `supabase/migrations/*.sql` |
| 3. Last-Supervisor race condition | Feature 1 | Automated concurrency test: two simultaneous deactivation calls against the last two active Supervisors, assert exactly one fails |
| 4. Chained-CTE RLS visibility bug (recurrence of 0006) | Feature 1 | Integration test against real Postgres/RLS (not mocked), reassigning clientes and immediately checking historico/clientes visibility, mirroring `tests/importacao`'s existing integration-test pattern |
| 5. `now()` transaction-time breaks event ordering | Features 2, 3 | Test firing two historico-writing triggers within one transaction, assert `criado_em` values are still distinguishable/orderable |
| 6. Time-in-stage math excludes initial/open stages, assumes linear order | Feature 2 | Test fixtures covering: never-moved card, skipped-stage card, backward-moved card, currently-open (unfinished) stage |
| 7. Ambiguous win/loss date on multi-toggle status | Feature 3 | Explicit code comment + cross-check against `dashboard_ganhos_perdidos`'s existing convention for consistency |
| 8. Historical stats corrupted by reassignment | Features 1, 3, 4 | Test: reassign a vendedor's clients, confirm past-period win/loss stats for both vendedors are unchanged |
| 9. Estado migration fails/corrupts on bad legacy data | Feature 6 | Pre-migration audit query (`distinct estado not in (27 UFs)`) run and reviewed before the constraint is validated; post-migration count reconciliation |
| 10. Cidade cascade missing/duplicated cities, no new-city escape hatch | Feature 6 | Manual test: register a client in a brand-new city after the migration ships |
| 11. Comparison table leaks via `security definer` | Feature 4 | Integration test: Vendedor-scoped RPC call returns self-only/empty, mirroring `tests/dashboard/rls-dashboard.test.ts` |
| 12. dnd-kit auto-scroll/measuring breaks in fixed-height columns | Feature 5 | Manual drag-to-bottom-of-column test, plus `measuring` prop present in code review |

## Sources

- `supabase/migrations/0001_profiles_and_roles.sql`, `0002_clientes_and_funil.sql`, `0003_dashboard_aggregates.sql`, `0006_fix_importar_clientes_lote_cte_rls_visibility.sql` — read directly from this repository. Confidence: HIGH (primary source, the project's own committed schema and documented bug fix).
- `.planning/PROJECT.md`, `.planning/RETROSPECTIVE.md` — read directly per required reading. Confidence: HIGH (primary project source).
- `.claude/skills/Supabase-conventions/SKILL.md` — read directly. Confidence: HIGH (primary source, project convention).
- WebSearch: "Supabase auth admin updateUserById ban_duration invalidate session" — [supabase.com/docs/reference/javascript/auth-admin-updateuserbyid](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), [github.com/orgs/supabase/discussions/9239](https://github.com/orgs/supabase/discussions/9239). Confidence: MEDIUM (official docs surfaced, but session-invalidation behavior specifically confirmed via community discussion, not a direct official statement).
- WebSearch: "dnd-kit DndContext autoScroll scrollable container measuring strategy Always" — [dndkit.com/extend/plugins/auto-scroller](https://dndkit.com/extend/plugins/auto-scroller/), [dndkit.com/legacy/api-documentation/context-provider/dnd-context](https://dndkit.com/legacy/api-documentation/context-provider/dnd-context/). Confidence: MEDIUM-HIGH (official dnd-kit docs).
- WebSearch: "postgres ADD CONSTRAINT CHECK NOT VALID existing rows validate later" — [postgresql.org message threads on NOT VALID constraints](https://www.postgresql.org/message-id/4DE4D265020000250003DF04%40gw.wicourts.gov), postgresqltutorial.com. Confidence: HIGH (matches well-documented, stable Postgres feature, cross-checked across multiple sources).
- Postgres `now()` vs `clock_timestamp()` transaction-time semantics — standard, stable, widely-documented Postgres behavior (not separately re-verified this session; consistent with official Postgres documentation on date/time functions). Confidence: HIGH (well-established language semantic, not a claim likely to have changed or be version-sensitive).

---
*Pitfalls research for: CRM Raiar v1.2 — Gestão de Equipe, Análises de Funil e Filtros*
*Researched: 2026-07-25*
