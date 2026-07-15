# Architecture Research

**Domain:** B2B sales CRM — kanban funnel + role-based dashboard (internal tool, zero-infra-cost MVP)
**Researched:** 2026-07-14
**Confidence:** HIGH (core patterns are official Supabase/Next.js guidance, cross-checked against multiple community sources)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Next.js Client)                      │
│  ┌────────────┐  ┌───────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ Login/Auth │  │ Kanban board  │  │ Admin CRUD    │  │Dashboard │  │
│  │ forms      │  │ (dnd-kit)     │  │ (enum lists)  │  │ (charts) │  │
│  └─────┬──────┘  └───────┬───────┘  └──────┬────────┘  └────┬─────┘  │
├────────┴─────────────────┴─────────────────┴────────────────┴───────┤
│                 NEXT.JS APP ROUTER (Vercel, server + client)         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Server Components (initial reads) · Server Actions (writes)   │   │
│  │ lib/supabase/server.ts (SSR client)  |  lib/supabase/client.ts│   │
│  │ (browser client, used for realtime/drag interactions)         │   │
│  │ middleware.ts — refreshes session, guards protected routes    │   │
│  └───────────────────────────┬──────────────────────────────────┘   │
├──────────────────────────────┴────────────────────────────────────--┤
│                         SUPABASE (Postgres + Auth)                    │
│  ┌───────────┐ ┌────────────────┐ ┌───────────────┐ ┌─────────────┐ │
│  │ auth.users│ │ profiles (role)│ │ RLS policies  │ │ RPC funcs   │ │
│  │ (Auth)    │ │ clientes       │ │ + is_          │ │ (mover_     │ │
│  │           │ │ tarefas        │ │ supervisor()   │ │ card_funil) │ │
│  │           │ │ categorias/    │ │ SECURITY       │ │             │ │
│  │           │ │ produtos/tipos_│ │ DEFINER helper │ │ Views       │ │
│  │           │ │ tarefa/motivos │ │                │ │ (security_  │ │
│  │           │ │                │ │                │ │ invoker)    │ │
│  └───────────┘ └────────────────┘ └───────────────┘ └─────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

There is no separate backend service — Postgres (via RLS, SECURITY DEFINER functions, and RPC) *is* the authorization and business-rule layer, per this project's `supabase-conventions` skill. Next.js is a thin presentation + orchestration layer.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Auth & Identity | Sign up/login, session, holds `role` (Supervisor/Vendedor) | Supabase Auth + `public.profiles` table (`id = auth.users.id`, FK), synced via a trigger on `auth.users` insert |
| Authorization | "Who can see/edit what" — the single source of truth for visibility rules | RLS policies on every table + one `is_supervisor()` `SECURITY DEFINER` helper function used across policies |
| Client (PJ) module | CRUD of `clientes`, minimal-required-fields creation flow | `clientes` table with RLS (`responsavel = auth.uid()` OR `is_supervisor()`) |
| Editable enum module | CRUD of categoria, produtos_consumidos, tipos_tarefa, motivos_perda (admin-only) | 4 small lookup tables, RLS write-restricted to `is_supervisor()`, read-open to authenticated |
| Kanban/Funnel module | Displays clients as cards across 7 fixed stages, drag-and-drop, enforces stage-transition rules | Funnel state stored directly on `clientes` (etapa, status_acompanhamento, motivo_perda_id, observacao); `dnd-kit` UI; RPC function validates transitions atomically |
| Tasks module | Per-client task list, each with its own completion date | `tarefas` table FK to `clientes` and `tipos_tarefa`, RLS inherited from parent client's visibility rule |
| Dashboard/reporting module | Aggregate metrics respecting the same visibility rules as the funnel | Postgres views with `security_invoker = true` (or RPC functions for heavier aggregates), queried from Server Components |

## Recommended Project Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── signup/page.tsx           # only used for initial user provisioning
├── (app)/
│   ├── layout.tsx                # auth guard, shared nav
│   ├── funil/page.tsx            # kanban board (main screen)
│   ├── clientes/
│   │   ├── page.tsx              # client list (optional, secondary to kanban)
│   │   ├── novo/page.tsx         # cadastro rápido
│   │   └── [id]/page.tsx         # client detail (card detail: tarefas, observação)
│   ├── admin/
│   │   ├── categorias/page.tsx   # supervisor-only enum CRUD
│   │   ├── produtos/page.tsx
│   │   ├── tipos-tarefa/page.tsx
│   │   └── motivos-perda/page.tsx
│   └── dashboard/page.tsx        # metrics screen
├── middleware.ts                  # session refresh + route guard
components/
├── funil/                         # KanbanBoard, KanbanColumn, ClienteCard
├── clientes/                      # ClienteForm, ClienteList
├── admin/                         # EnumList, EnumForm (shared across the 4 enums)
├── dashboard/                     # StatCard, FunilChart, VendedorRanking
└── ui/                             # generic buttons, inputs, etc.
lib/
└── supabase/
    ├── client.ts                  # browser client (drag interactions, forms)
    ├── server.ts                  # SSR client for Server Components/Actions
    └── middleware.ts              # cookie/session refresh helper
supabase/
├── migrations/                    # one file per schema change, versioned
└── functions/                     # empty in MVP — see Anti-Patterns
tests/
```

### Structure Rationale

- **`app/(app)/admin/`:** groups the 4 enum-CRUD screens together because they share the same component pattern (`EnumList`/`EnumForm`) — build one generic admin CRUD component, reuse it 4 times, not 4 bespoke screens.
- **`app/(app)/funil/` as the entry screen, not `clientes/`:** the kanban board is the Core Value (per PROJECT.md) — it should be what a vendedor sees first, not a plain list.
- **No `app/api/` route handlers for CRUD:** Server Actions + direct `supabase-js` calls (browser or server) cover all reads/writes here; a custom API layer would duplicate the RLS/RPC logic that already lives in Postgres, which this project explicitly avoids (see `CLAUDE.md`: "não existe backend Node.js separado").
- **`supabase/functions/` stays empty for the MVP:** nothing in the current requirement list needs a third-party call, secret key, or webhook — the `supabase-conventions` skill's escalation order (RLS → RPC → Edge Function) never reaches step 3 here.

## Architectural Patterns

### Pattern 1: `SECURITY DEFINER` role-check helper (avoid RLS recursion)

**What:** A single Postgres function `is_supervisor()` that looks up the caller's role from `profiles`, marked `SECURITY DEFINER` so it bypasses RLS on that lookup itself.
**When to use:** Any time a policy needs to check the *current user's own role* from a table that itself has RLS enabled — which is every policy in this project (`clientes`, `tarefas`, the 4 enum tables).
**Trade-offs:** Adds one function to maintain, but is the documented fix for a very common Supabase failure mode: querying `profiles` (or `auth.users`) directly inside a policy on `profiles` causes **infinite recursion** ("infinite recursion detected in policy"), because the lookup itself re-triggers the policy. [Confidence: HIGH — Supabase official + confirmed by multiple GitHub discussions]

**Example:**
```sql
create or replace function is_supervisor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'supervisor'
  );
$$;

-- clientes RLS:
create policy "vendedor ve os proprios clientes, supervisor ve todos"
on clientes for select
using (responsavel = auth.uid() or is_supervisor());
```

### Pattern 2: `security_invoker = true` views for the dashboard

**What:** Dashboard aggregates (clientes por etapa, ganhos x perdidos, desempenho por vendedor, conversão, prospecções por produto/categoria) are Postgres views created with `security_invoker = true` (Postgres 15+, which Supabase runs).
**When to use:** Any read-only aggregate query that must respect the *same* visibility rule as the underlying table (vendedor sees own numbers, supervisor sees the team's).
**Trade-offs:** This is the single most important architectural decision for the dashboard. **Views are owned by the `postgres` role by default and silently bypass RLS** unless `security_invoker` is set — a dashboard built on a plain view would leak every vendedor's numbers to every other vendedor. Setting the flag means zero duplicate authorization logic: the view inherits whatever RLS already protects `clientes`/`tarefas`. [Confidence: HIGH — Supabase official docs]

**Example:**
```sql
create view dashboard_por_etapa
with (security_invoker = true) as
select etapa, status_acompanhamento, count(*) as total
from clientes
group by etapa, status_acompanhamento;
-- A vendedor querying this view only ever sees rows the clientes RLS policy
-- already allows them to see; a supervisor sees the full team aggregate.
```

### Pattern 3: RPC for multi-step funnel business rules

**What:** Moving a card is not a bare `UPDATE` — it must enforce "ganho só é possível na etapa '1ª venda concluída'" and "motivo obrigatório ao marcar perdido". This logic lives in a `plpgsql` RPC function, not in the frontend.
**When to use:** Any write that has a validation rule spanning more than "can this user touch this row" (that part is still RLS's job — the RPC runs *as* the calling user by default, so RLS still applies to the underlying `UPDATE` inside it).
**Trade-offs:** Keeps the rule enforced no matter which client calls it (web today, potentially something else later) and keeps it in one place instead of duplicated across every UI form. Per `supabase-conventions`, this is the correct escalation from RLS (step 1) — RLS alone can't express "only allow `status_acompanhamento = 'ganho'` when `etapa = '1ª venda concluída'`" as a row-visibility rule, but a `plpgsql` function can validate it before writing.

**Example:**
```sql
create or replace function mover_card_funil(
  p_cliente_id uuid,
  p_nova_etapa text,
  p_novo_status text default null,
  p_motivo_perda_id uuid default null
) returns void as $$
begin
  if p_novo_status = 'ganho' and p_nova_etapa <> '1a_venda_concluida' then
    raise exception 'Só é possível marcar como ganho na etapa final';
  end if;
  if p_novo_status = 'perdido' and p_motivo_perda_id is null then
    raise exception 'Motivo de perda é obrigatório';
  end if;

  update clientes
  set etapa = p_nova_etapa,
      status_acompanhamento = coalesce(p_novo_status, status_acompanhamento),
      motivo_perda_id = p_motivo_perda_id
  where id = p_cliente_id;
  -- RLS on clientes still applies here: a vendedor calling this on a
  -- client they don't own simply updates 0 rows.
end;
$$ language plpgsql;
```

## Data Flow

### Request Flow (read — e.g. opening the kanban board)

```
Vendedor opens /funil
    ↓
Server Component → lib/supabase/server.ts (SSR client, reads session cookie)
    ↓
supabase.from('clientes').select(...)   [no manual WHERE responsavel=... needed]
    ↓
Postgres applies RLS automatically:  responsavel = auth.uid()  OR  is_supervisor()
    ↓
Rows returned already scoped correctly → rendered as kanban columns
```

### Write Flow (drag a card to a new column)

```
onDragEnd (dnd-kit, Client Component)
    ↓
Optimistic UI update (card moves immediately)
    ↓
lib/supabase/client.ts → supabase.rpc('mover_card_funil', {...})
    ↓
Postgres: RPC validates business rule → UPDATE clientes (RLS still enforced:
vendedor moving a client they don't own affects 0 rows → RPC should check
row count and raise/report failure so the UI can roll back the optimistic move)
    ↓
Success → UI stays; Failure → revert optimistic update, show toast
```

### Dashboard Flow

```
Supervisor or Vendedor opens /dashboard
    ↓
Server Component queries security_invoker views (dashboard_por_etapa,
dashboard_ganhos_perdidos, dashboard_por_vendedor, dashboard_conversao,
dashboard_por_produto, dashboard_por_categoria)
    ↓
Same RLS that scopes clientes/tarefas automatically scopes the views —
no separate "if role === supervisor" branching needed in application code
    ↓
Vendedor gets own-numbers-only response; Supervisor gets team-wide response,
from the exact same query
```

### Key Data Flows

1. **Identity → visibility:** `auth.users` → `profiles.role` → `is_supervisor()` → every RLS policy on `clientes`/`tarefas`/enum tables → every read and write in the app. This is the one flow every other component depends on; it must exist before any other module is buildable.
2. **Client record → funnel card → tasks:** a `clientes` row *is* the funnel card (etapa/status/observação live on it); `tarefas` rows hang off it. There is no separate "opportunity" or "deal" entity in the MVP — see Anti-Patterns for the risk this introduces if the business model changes.
3. **Enum tables → everything that references them:** `categorias`, `produtos_consumidos`, `tipos_tarefa`, `motivos_perda` are read by client forms, task forms, and the loss-reason field, and are the group-by keys for two of the six dashboard aggregates (por produto, por categoria) — they must be seeded before those flows are testable, but do **not** need their admin CRUD UI built first (see Build Order below).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|---------------------------|
| Internal team, <20 users (this project's actual scale) | Current architecture (RLS + views + a couple of RPCs) is complete — no further work needed |
| 20-200 users (e.g. company grows, adds sales pods) | Consider adding a `equipe`/team concept if visibility needs to become "supervisor sees own team" instead of "all"; still pure RLS, no infra change |
| 200+ users / cross-org multi-tenant | Out of scope for this project (internal tool, not sold to third parties) — would require an `organizacao_id` column everywhere and RLS keyed on it |

### Scaling Priorities

1. **First real constraint is Supabase free-tier limits, not user count:** 500MB database, limited monthly active users on Auth, and bandwidth caps are what could actually bite before any query-performance issue does, given an internal sales team's data volume (low thousands of client rows at most). No architectural action needed now — just something to watch.
2. **Second, if it ever mattered:** dashboard aggregate views scanning the full `clientes`/`tarefas` tables are fine unindexed at this scale; if it ever grew large, add a composite index on `(responsavel, etapa)` — not needed for the MVP.

## Anti-Patterns

### Anti-Pattern 1: Checking role only in the frontend

**What people do:** `if (user.role === 'supervisor') fetchAllClients() else fetchOwnClients()` in a React component, with no RLS backing it.
**Why it's wrong:** The Supabase anon/authenticated key is public by design — anyone can call the API directly and bypass a client-side `if`. Frontend role checks are fine for **hiding UI** (don't render the admin menu for a vendedor) but must never be the actual authorization boundary.
**Do this instead:** RLS is always the source of truth (already the project's stated rule in `CLAUDE.md`: "não implementar autenticação/autorização por conta própria"). The frontend can still branch on role for UX, but the query itself should be identical for both roles and let Postgres filter — as shown in the Data Flow section above.

### Anti-Pattern 2: Plain views for the dashboard

**What people do:** `CREATE VIEW dashboard_x AS SELECT ...` without `security_invoker = true`.
**Why it's wrong:** Views default to running as their owner (`postgres`), which has full table access — silently bypassing RLS. A dashboard is exactly the kind of feature that looks like "just a read query" and is the easiest place to accidentally leak every vendedor's numbers to every other vendedor.
**Do this instead:** Always add `WITH (security_invoker = true)` to dashboard views (Postgres 15+, which Supabase runs), or wrap the aggregate in a `SECURITY INVOKER` RPC function if it needs parameters the view syntax can't express.

### Anti-Pattern 3: A separate Node.js API layer "for business logic"

**What people do:** Stand up an Express/Fastify service to hold validation rules (e.g. the ganho/perdido rules) because "that's where backend logic normally goes."
**Why it's wrong:** Directly contradicts this project's stack constraint (no separate Node backend) and its zero-cost goal — a second service means a second thing to host, secure, and pay for, and duplicates authorization Postgres already does for free via RLS.
**Do this instead:** Follow the `supabase-conventions` escalation order — RLS for "who can touch this row," RPC (`plpgsql`) for "is this write valid," Edge Function only for the (currently nonexistent) case of calling something external.

### Anti-Pattern 4: Modeling the funnel as ad-hoc client-side state

**What people do:** Keep "which column is this card in" only in React state (e.g. from a client-side JSON blob), persisting it lazily or not at all.
**Why it's wrong:** Loses position on refresh, breaks the "supervisor sees the same board as the vendedor" requirement, and makes the dashboard aggregates impossible (there's no durable `etapa` to `GROUP BY`).
**Do this instead:** `etapa` and `status_acompanhamento` are real columns on `clientes`, updated via the `mover_card_funil` RPC, so the board is always a direct rendering of database state — matching the Pattern 3 approach above.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| Supabase Auth | `@supabase/ssr` client in middleware + server/browser clients | The only external identity/session provider; no custom auth code per `CLAUDE.md` |
| Supabase Postgres | `supabase-js` from Server Components (reads), Server Actions/RPC (writes) | No other database or ORM |
| Vercel | Next.js hosting, free tier | No server-side cron/background jobs needed for the MVP (no active notifications, per Out of Scope) |

No other external services are needed for the current requirement set — the "Out of Scope" list (no notifications, no CRM sync, no spreadsheet import UI) is precisely the set of features that would otherwise justify an Edge Function or third-party integration. That absence is itself an architectural simplification worth preserving.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| Kanban UI ↔ funnel state | `supabase.rpc('mover_card_funil', ...)` | Never a raw `UPDATE` from the client — the business rule must be enforced server-side |
| Admin enum CRUD ↔ enum tables | Direct `supabase-js` table calls, protected by RLS (`is_supervisor()` on write policies) | Simple CRUD, no RPC needed — this is exactly the case where plain RLS is sufficient (step 1 of the escalation order) |
| Client/task forms ↔ enum tables | Read-only `select` (RLS allows all authenticated users to read) | Enum values populate dropdowns; only supervisors can mutate them |
| Dashboard ↔ underlying tables | `security_invoker` views (or RPC for parameterized aggregates) | No app-layer authorization branching — see Pattern 2 |

## Suggested Build Order (Vertical MVP Slices)

This project favors thin end-to-end slices over building full horizontal layers (e.g. "all tables first, then all UI"). Order below reflects actual dependencies, not implementation convenience:

1. **Foundation (not a feature slice, a prerequisite):** Supabase Auth wiring, `profiles` table + role, `is_supervisor()` helper, RLS baseline. Nothing else in the system can be correctly authorized without this existing first — every other component's RLS policy depends on it.
2. **Client (PJ) cadastro — thin vertical slice:** `clientes` table + minimal-required-field creation form + list scoped by RLS. This is the first slice that proves the full stack works end-to-end (auth → RLS → CRUD → UI) and is a hard prerequisite for the kanban (a card *is* a `clientes` row). The 4 enum tables should be created and **seeded via migration** at this point (fixed initial values from `CLAUDE.md`'s domain mapping) so client fields like categoria/produtos_consumidos are usable immediately — their admin CRUD *screens* are not required yet.
3. **Kanban board — the Core Value slice:** drag-and-drop across the 7 fixed columns, `mover_card_funil` RPC enforcing ganho/perdido rules, visual highlight for stalled/overdue cards. This is explicitly the reason the project exists (per `PROJECT.md`'s Core Value section), so it should land as soon as client records exist, before task management or admin niceties.
4. **Card detail — tarefas + observação:** builds on the client/card slice; needs `tipos_tarefa` seeded (already done in step 2).
5. **Admin CRUD for the 4 enum lists:** now that categoria, produtos_consumidos, tipos_tarefa, and motivos_perda are already in real use (seeded + referenced), build the supervisor-only screens to manage them. Deferring this past the core funnel is safe because nothing else blocks on it — the values already work, only their *editability* is missing.
6. **Dashboard:** last, because it's a read-only aggregate over data the previous steps produce. Building it earlier risks reworking the six aggregate views/queries as the `clientes`/`tarefas` schema still shifts; building it last means every metric (clientes por etapa, ganhos x perdidos, desempenho por vendedor, conversão, prospecções por produto/categoria) has real underlying columns and real RLS behavior to query against, with `security_invoker = true` views as the implementation pattern from day one.

**Ordering rationale in one line:** identity/authorization → the entity everything else hangs off of (`clientes`) → the feature that is the actual point of the product (kanban) → supporting detail (tasks) → admin conveniences → aggregate reporting over everything that now exists.

## Sources

- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence, official
- [Creating a Supabase client for SSR | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — HIGH confidence, official
- [Setting up Server-Side Auth for Next.js | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — HIGH confidence, official
- [Infinite recursion when using users table to specify users role for RLS · supabase Discussion #1138](https://github.com/orgs/supabase/discussions/1138) — HIGH confidence, official Supabase discussion, cross-checked against #3328 and #32579
- [Postgres Views: The Hidden Security Gotcha in Supabase](https://dev.to/datadeer/postgres-views-the-hidden-security-gotcha-in-supabase-ckd) — MEDIUM confidence, community; core claim (`security_invoker`) verified against official RLS docs
- [Setting Up Row-Level Security in Supabase User and Admin Roles](https://dev.to/shahidkhans/setting-up-row-level-security-in-supabase-user-and-admin-2ac1) — MEDIUM confidence, community, consistent with official docs pattern
- dnd-kit adoption as the current standard React drag-and-drop library — MEDIUM confidence, aggregated from multiple 2025/2026 community sources (LogRocket, radzion.com, Georgegriff reference implementation); no single authoritative source but strong consensus and it directly supersedes the archived `react-beautiful-dnd`
- Project's own `.claude/Skills/Supabase-conventions/SKILL.md` and `CLAUDE.md` — HIGH confidence, project-authoritative constraints (RLS-first, no separate backend, migrations-only schema changes)

---
*Architecture research for: B2B sales CRM (kanban funnel + role-based dashboard) on Next.js + Supabase*
*Researched: 2026-07-14*
