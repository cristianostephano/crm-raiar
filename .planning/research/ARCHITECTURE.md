# Architecture Research

**Domain:** B2B sales CRM — kanban funnel + role-based dashboard (internal tool, zero-infra-cost MVP)
**Researched:** 2026-07-14 (v1.0) — extended 2026-07-22 for milestone v1.1 (bulk import/export) — extended 2026-07-25 for milestone v1.2 (team deactivation, funnel metrics, comparative vendor table, kanban scroll, location filters)
**Confidence:** HIGH for v1.0 patterns (official Supabase/Next.js guidance, cross-checked). MEDIUM for v1.1 bulk-import/export patterns (general Postgres/Next.js idioms cross-checked, applied to this project's schema). MEDIUM for v1.2 patterns below (schema/RPC reasoning is HIGH — traced directly to the live migrations; the Supabase Auth Admin ban-duration mechanism is MEDIUM — confirmed via official reference pages + community discussion, not fetched directly against supabase.com/docs)

> **Read this first if you're planning v1.2 (team deactivation, funnel metrics, comparative vendor table, kanban scroll, location filters):** everything through "Suggested Build Order — v1.1" below is the *existing, already-built* v1.0/v1.1 system — kept verbatim as ground truth for how this codebase actually works today. The new work for this milestone is entirely in **"v1.2 Additions"**, at the end of this document.

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
| Client (PJ) module | CRUD of `clientes`, minimal-required-fields creation flow | `clientes` table with RLS (`responsavel = auth.uid()` OR `is_supervisor()`); confirmed live in `app/actions/clientes.ts` (`createCliente`/`updateCliente`/`deleteCliente`) |
| Editable enum module | CRUD of categoria, produtos_consumidos, tipos_tarefa, motivos_perda (admin-only) | 4 small lookup tables, RLS write-restricted to `is_supervisor()`, read-open to authenticated |
| Kanban/Funnel module | Displays clients as cards across 7 fixed stages, drag-and-drop, enforces stage-transition rules | Funnel state stored directly on `clientes` (etapa, status_acompanhamento, motivo_perda_id, observacao); `dnd-kit` UI; `mover_card_funil` RPC validates transitions atomically — confirmed live in `app/actions/funil.ts` |
| Tasks module | Per-client task list, each with its own completion date | `tarefas` table FK to `clientes` and `tipos_tarefa`, RLS inherited via its own parent-`EXISTS` gate (not inherited automatically from `clientes`' RLS — see Pitfall/Pattern below) |
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
│   │   ├── importar/page.tsx     # v1.1 — supervisor-only bulk import wizard
│   │   └── [id]/page.tsx         # client detail (card detail: tarefas, observação)
│   ├── admin/
│   │   ├── categorias/page.tsx   # supervisor-only enum CRUD
│   │   ├── produtos/page.tsx
│   │   ├── tipos-tarefa/page.tsx
│   │   ├── motivos-perda/page.tsx
│   │   └── equipe/page.tsx       # v1.2 — supervisor-only team list + deactivate action
│   └── dashboard/page.tsx        # metrics screen
├── api/
│   └── clientes/
│       └── exportar/route.ts     # v1.1 — the ONE Route Handler in this app (see rationale below)
├── actions/                       # existing Server Actions (clientes.ts, funil.ts, tarefas.ts, listas.ts, dashboard.ts)
│   ├── importacao.ts              # v1.1 — new: validarLoteImportacao / confirmarLoteImportacao
│   └── equipe.ts                  # v1.2 — new: desativarMembroEquipe (RPC + Auth Admin API orchestration)
├── middleware.ts                  # session refresh + route guard
components/
├── funil/                         # KanbanBoard, KanbanColumn (v1.2: fixed-height + overflow-y scroll), ClienteCard
├── clientes/                      # ClienteForm, ClienteList
│   └── importacao/                # v1.1 — FileDropzone, ColumnMappingTable, ImportPreviewTable
├── admin/                         # EnumList, EnumForm (shared across the 4 enums)
│   └── equipe/                    # v1.2 — EquipeList, DesativarMembroDialog (replacement-vendedor picker)
├── dashboard/                     # StatCard, FunilChart, VendedorRanking
│   └── v1.2 additions             # FunilDetalhadoTable, ComparativoVendedoresTable
└── ui/                             # generic buttons, inputs, etc.
lib/
├── supabase/
│   ├── client.ts                  # browser client (drag interactions, forms)
│   ├── server.ts                  # SSR client for Server Components/Actions
│   ├── admin.ts                   # v1.2 — NEW: service_role client, server-only, used ONLY by equipe.ts
│   ├── middleware.ts              # cookie/session refresh helper
│   └── queries/
│       ├── clientes.ts
│       └── dashboard.ts
├── validations/
│   ├── cliente.ts                 # createClienteSchema / updateClienteSchema
│   └── importacao.ts              # v1.1 — per-row import schema, reuses cliente field rules
└── importacao/                     # v1.1 — parseArquivo(), mapeamento de colunas, dedupe helpers
supabase/
├── migrations/                    # one file per schema change, versioned
│   ├── 0004-0006_importacao_clientes.sql  # v1.1 — importar_clientes_lote RPC (see Pattern 4)
│   └── 0007+_v1_2_*.sql           # v1.2 — profiles.ativo, is_supervisor() update, desativar_membro_equipe(),
│                                    #        dashboard_tempo_por_etapa(), dashboard_dias_ate_ganho_perdido(),
│                                    #        dashboard_desempenho_vendedor() extension, cidades table + RPC
└── functions/                     # empty — see Anti-Patterns (still empty after v1.2, no Edge Function needed)
tests/
```

### Structure Rationale

- **`app/(app)/admin/`:** groups the 4 enum-CRUD screens together because they share the same component pattern (`EnumList`/`EnumForm`) — build one generic admin CRUD component, reuse it 4 times, not 4 bespoke screens. v1.2's `equipe/` screen is a *different* shape (deactivate + reassign, not create/edit/delete of a lookup value) so it gets its own subfolder rather than being forced into the `EnumList`/`EnumForm` pattern.
- **`app/(app)/funil/` as the entry screen, not `clientes/`:** the kanban board is the Core Value (per PROJECT.md) — it should be what a vendedor sees first, not a plain list.
- **No `app/api/` route handlers for CRUD:** Server Actions + direct `supabase-js` calls (browser or server) cover all reads/writes here; a custom API layer would duplicate the RLS/RPC logic that already lives in Postgres, which this project explicitly avoids (see `CLAUDE.md`: "não existe backend Node.js separado"). The one exception (`app/api/clientes/exportar/route.ts`, v1.1) exists only for file-download HTTP semantics — v1.2 does not add a second exception; the deactivation flow's Auth Admin API call is a Server Action, not a Route Handler (see Pattern 7).
- **`lib/supabase/admin.ts` (v1.2, new):** the first server-only Supabase client in this codebase built with the `service_role` key instead of the anon/authenticated key. Deliberately isolated in its own file, imported by exactly one Server Action (`equipe.ts`), never imported by anything that also handles a request body from an untrusted source — keeping the blast radius of "code with RLS-bypassing credentials" as small and auditable as possible.
- **`supabase/functions/` stays empty through v1.2 too:** none of the 6 v1.2 features call a third-party API, need a secret beyond what a Server Action can already hold server-side, or process a webhook. The `supabase-conventions` skill's escalation order (RLS → RPC → Edge Function) never reaches step 3 this milestone either — including for the deactivation login-block, which needs a secret key but not a *new deployable* (see Pattern 7).

## Architectural Patterns

### Pattern 1: `SECURITY DEFINER` role-check helper (avoid RLS recursion)

**What:** A single Postgres function `is_supervisor()` that looks up the caller's role from `profiles`, marked `SECURITY DEFINER` so it bypasses RLS on that lookup itself.
**When to use:** Any time a policy (or an RPC's internal business-rule check — see Pattern 4) needs to check the *current user's own role* from a table that itself has RLS enabled.
**Trade-offs:** Adds one function to maintain, but is the documented fix for a very common Supabase failure mode: querying `profiles` (or `auth.users`) directly inside a policy on `profiles` causes **infinite recursion**, because the lookup itself re-triggers the policy. [Confidence: HIGH — Supabase official + confirmed by multiple GitHub discussions]

**Example (as actually implemented in `supabase/migrations/0001_profiles_and_roles.sql`):**
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
    where id = (select auth.uid()) and role = 'supervisor'
  );
$$;
```

**v1.2 update to this exact function — see Pattern 7 below:** this is the single load-bearing change of the whole v1.2 team-deactivation feature.

### Pattern 2: `security_invoker = true` views / functions for the dashboard

**What:** Dashboard aggregates (clientes por etapa, ganhos x perdidos, desempenho por vendedor, conversão, prospecções por produto/categoria) are implemented as Postgres functions (`language sql stable`, SECURITY INVOKER by omission — see `0003_dashboard_aggregates.sql`) rather than plain views, but the principle is identical to `security_invoker = true` views.
**When to use:** Any read-only aggregate query that must respect the *same* visibility rule as the underlying table (vendedor sees own numbers, supervisor sees the team's).
**Trade-offs:** Functions/views owned by the `postgres` role bypass RLS by default unless explicitly invoker-scoped — a dashboard built without this would leak every vendedor's numbers to every other vendedor. [Confidence: HIGH — Supabase official docs, confirmed live in `0003_dashboard_aggregates.sql`'s own header comment]
**v1.2 reuses this pattern unchanged** for all new/extended dashboard functions (Pattern 8 below) — no new authorization mechanism needed, only new SQL logic layered on the same invoker-scoped foundation.

### Pattern 3: RPC for multi-step funnel business rules

**What:** Moving a card is not a bare `UPDATE` — it must enforce "ganho só é possível na etapa '1ª venda concluída'" and "motivo obrigatório ao marcar perdido". This logic lives in `mover_card_funil`, a `plpgsql` RPC that is **explicitly NOT `SECURITY DEFINER`** — it runs as the calling user, so the `clientes` UPDATE/INSERT RLS policies still apply *inside* it. A vendedor calling it against a client they don't own simply affects 0 rows; the RPC's own validation raises a readable exception for the cases RLS can't express as a row-visibility predicate (like "status can only be 'ganho' when etapa is the last column").
**When to use:** Any write that has a validation rule spanning more than "can this user touch this row" (that part stays RLS's job).
**Trade-offs:** Keeps the rule enforced no matter which client calls it and keeps it in one place instead of duplicated across every UI form. This exact pattern — **non-`SECURITY DEFINER` RPC as the place for a business rule that isn't a pure row-visibility predicate, with the underlying table's RLS policy as the real backstop** — is the direct precedent for v1.1's bulk-import RPC (Pattern 4) and v1.2's team-deactivation RPC (Pattern 7). [Confidence: HIGH — confirmed against the live `supabase/migrations/0002_clientes_and_funil.sql`]

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
Server Action (app/actions/funil.ts moverCard) → supabase.rpc('mover_card_funil', {...})
    ↓
Postgres: RPC validates business rule → UPDATE clientes (RLS still enforced)
    ↓
Success → UI stays; Failure → revert optimistic update, show toast
```

### Dashboard Flow

```
Supervisor or Vendedor opens /dashboard
    ↓
Server Component queries security_invoker views/functions
    ↓
Same RLS that scopes clientes/tarefas automatically scopes the results
    ↓
Vendedor gets own-numbers-only response; Supervisor gets team-wide response
```

### Key Data Flows

1. **Identity → visibility:** `auth.users` → `profiles.role` (+ `profiles.ativo` from v1.2) → `is_supervisor()` → every RLS policy on `clientes`/`tarefas`/enum tables → every read and write in the app.
2. **Client record → funnel card → tasks:** a `clientes` row *is* the funnel card (etapa/status/observação live on it); `tarefas` rows hang off it. There is no separate "opportunity" or "deal" entity — v1.1's bulk import and v1.2's dashboard extensions both read/write this same `clientes` row shape, neither introduces a parallel entity.
3. **Enum tables → everything that references them:** `categorias`, `produtos_consumidos`, `tipos_tarefa`, `motivos_perda` are read by client forms and the dashboard aggregates keyed on them. v1.2 adds a fifth reference dataset, `cidades` (Pattern 10), which is read-only/seeded rather than Supervisor-editable like the other four — a deliberate asymmetry, not an omission (see Pattern 10).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|---------------------------|
| Internal team, <20 users (this project's actual scale) | Current architecture (RLS + functions + a handful of RPCs) is complete — no further work needed |
| 20-200 users | Consider adding a `equipe`/team concept if visibility needs to become "supervisor sees own team" instead of "all"; still pure RLS, no infra change |
| 200+ users / cross-org multi-tenant | Out of scope for this project |

### Scaling Priorities

1. **First real constraint is Supabase free-tier limits, not user count:** 500MB database, bandwidth caps. Neither v1.1's bulk import nor v1.2's new reference table (`cidades`, ~5,570 rows if fully IBGE-seeded) changes this calculus meaningfully.
2. **Second:** dashboard aggregate functions are fine unindexed at this scale; v1.2's new time-in-stage functions read `historico`, which already has `idx_historico_cliente_id` and `idx_historico_tipo_criado` (from `0002`/`0003`) — no new index is anticipated to be required, but should be confirmed once real data volume is visible.

## Anti-Patterns

### Anti-Pattern 1: Checking role only in the frontend

**What people do:** `if (user.role === 'supervisor') fetchAllClients() else fetchOwnClients()` in a React component, with no RLS backing it.
**Why it's wrong:** The Supabase anon/authenticated key is public by design — anyone can call the API directly and bypass a client-side `if`.
**Do this instead:** RLS is always the source of truth. The frontend can still branch on role for UX (e.g. hiding the "Importar" nav link from a Vendedor, or the comparative-vendedor table from a non-Supervisor in v1.2), but the query/RPC itself must independently enforce the rule.

### Anti-Pattern 2: Plain views for the dashboard

**What people do:** `CREATE VIEW dashboard_x AS SELECT ...` without `security_invoker = true` (or, equivalently, a `SECURITY DEFINER` function where invoker-scoping was intended).
**Why it's wrong:** Views/functions default to running as their owner (`postgres`), silently bypassing RLS.
**Do this instead:** Always add `WITH (security_invoker = true)` for views, or omit `security definer` for functions (the pattern this project actually uses, per `0003_dashboard_aggregates.sql`'s own explicit warning comment). v1.2's new dashboard functions must follow the same omission.

### Anti-Pattern 3: A separate Node.js API layer "for business logic"

**What people do:** Stand up an Express/Fastify service to hold validation rules.
**Why it's wrong:** Contradicts this project's no-separate-backend constraint and zero-cost goal.
**Do this instead:** RLS → RPC (`plpgsql`) → Edge Function escalation, per `supabase-conventions`. v1.2 confirms the pattern still holds even for a feature that needs a secret key (team deactivation's Auth Admin API call) — see Pattern 7 for why that still doesn't require step 3.

### Anti-Pattern 4: Modeling the funnel as ad-hoc client-side state

**What people do:** Keep "which column is this card in" only in React state, persisting it lazily or not at all.
**Why it's wrong:** Loses position on refresh, breaks the "supervisor sees the same board as the vendedor" requirement.
**Do this instead:** `etapa` and `status_acompanhamento` are real columns on `clientes`, updated via `mover_card_funil`.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| Supabase Auth | `@supabase/ssr` client in middleware + server/browser clients | The only external identity/session provider |
| Supabase Postgres | `supabase-js` from Server Components (reads), Server Actions/RPC (writes) | No other database or ORM |
| Vercel | Next.js hosting, free tier | No server-side cron/background jobs needed |
| Supabase Auth Admin API (GoTrue) | `auth.admin.updateUserById(id, { ban_duration })`, called server-side with a `service_role` client | **New in v1.2** — first feature needing the service_role key; see Pattern 7 |

No other external services are needed. Spreadsheet parsing (v1.1) happens entirely client-side; v1.2 introduces no file/webhook/third-party integration either — Supabase Storage remains deliberately unused, keeping the zero-infra-cost posture intact.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| Kanban UI ↔ funnel state | `supabase.rpc('mover_card_funil', ...)` | Never a raw `UPDATE` from the client |
| Admin enum CRUD ↔ enum tables | Direct `supabase-js` table calls, protected by RLS | Simple CRUD, no RPC needed |
| Client/task forms ↔ enum tables | Read-only `select` | Enum values populate dropdowns |
| Dashboard ↔ underlying tables | invoker-scoped functions | No app-layer authorization branching |
| Equipe UI ↔ `profiles`/`clientes` (v1.2) | `supabase.rpc('desativar_membro_equipe', ...)` then a second, separate Auth Admin API call | Two-step, not one transaction — see Pattern 7 |

## Suggested Build Order (Vertical MVP Slices) — v1.0, already complete

1. Foundation: Auth, `profiles`, `is_supervisor()`, RLS baseline.
2. Client (PJ) cadastro — thin vertical slice.
3. Kanban board — the Core Value slice.
4. Card detail — tarefas + observação.
5. Admin CRUD for the 4 enum lists.
6. Dashboard.

---

## v1.1 Additions: Bulk Import & Export

**Milestone context:** Supervisor-only bulk import of clients via spreadsheet (with a column-mapping screen and a pre-confirm duplicate/error report), plus export of the client list scoped by the existing RLS visibility rule (Vendedor exports own, Supervisor exports all). No new user-facing entity — imported rows are ordinary `clientes` rows, always starting at `etapa = 'aguardando_contato'` (already the column default).

### Updated System Overview (delta from v1.0)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Next.js Client)                      │
│  ┌────────────┐  ┌───────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │ ...existing│  │ Import wizard │  │ Export button │  │...       │  │
│  │            │  │ (client-side  │  │ (Server Action│  │          │  │
│  │            │  │ file parse +  │  │ fetch → client│  │          │  │
│  │            │  │ column map +  │  │ -side CSV/XLSX│  │          │  │
│  │            │  │ preview)      │  │ blob download)│  │          │  │
│  └─────┬──────┘  └───────┬───────┘  └──────┬────────┘  └────┬─────┘  │
├────────┴─────────────────┴─────────────────┴────────────────┴───────┤
│  Server Actions: validarLoteImportacao (dry-run) /                   │
│  confirmarLoteImportacao (calls RPC) — app/actions/importacao.ts     │
│  Route Handler: GET /api/clientes/exportar (the one exception to     │
│  "no app/api for CRUD" — file-download HTTP semantics only)          │
├───────────────────────────────────────────────────────────────────--┤
│                         SUPABASE (Postgres)                           │
│  clientes (unchanged schema) │ NEW: importar_clientes_lote() RPC     │
│  (non-SECURITY DEFINER, is_supervisor() guard, ON CONFLICT DO        │
│  NOTHING against the existing razao_social unique constraint)        │
└────────────────────────────────────────────────────────────────────┘
```

**No new tables.** No Storage bucket. One new RPC. One new Route Handler (export only). Everything else is Server Actions + existing RLS, matching the rest of the codebase's conventions exactly.

### Pattern 4: Supervisor-only bulk RPC, backed by the existing INSERT policy (not a new one)

**What:** `importar_clientes_lote(p_clientes jsonb)` — a new `plpgsql` RPC, deliberately **NOT `SECURITY DEFINER`**, mirroring `mover_card_funil` exactly: it runs as the calling user, so the *existing* `clientes` INSERT policy (`responsavel = auth.uid() OR is_supervisor()`, from `0002_clientes_and_funil.sql`) still applies to every row it inserts. Before touching the table, the function does one explicit check:

```sql
create or replace function importar_clientes_lote(p_clientes jsonb)
returns table(razao_social text, id uuid, status text)
language plpgsql
as $$
begin
  if not is_supervisor() then
    raise exception 'Somente supervisores podem importar clientes em massa';
  end if;

  return query
  insert into clientes (
    razao_social, cep, rua, numero, complemento, cidade, estado,
    responsavel, categoria_id, contato, telefone, email, numero_de_lojas
  )
  select
    r.razao_social, r.cep, r.rua, r.numero, r.complemento, r.cidade, r.estado,
    r.responsavel, r.categoria_id, r.contato, r.telefone, r.email, r.numero_de_lojas
  from jsonb_to_recordset(p_clientes) as r(
    razao_social text, cep text, rua text, numero text, complemento text,
    cidade text, estado text, responsavel uuid, categoria_id uuid,
    contato text, telefone text, email text, numero_de_lojas int
  )
  on conflict (razao_social) do nothing
  returning clientes.razao_social, clientes.id, 'inserido'::text as status;
end;
$$;
```

**Why this answers "does the SAME table's existing Vendedor INSERT policy need to change?" — no.** RLS policies are evaluated per row against row *content*, never against "how many rows this statement is inserting" or "which named RPC called this" — there is no native "this is a bulk call" predicate to write a policy against. The existing policy already fully covers what bulk import needs (a Supervisor inserting rows with any `responsavel`), so **no new/changed RLS policy is required on `clientes`**. What *does* need a new enforcement point is "only a Supervisor may use the bulk-import feature at all" — that's not a row-visibility rule (a Supervisor's row-level rights don't change between one row and one thousand), it's a **business/feature rule**, which is exactly the class of thing this project already escalates to an RPC for (Pattern 3's precedent). The `if not is_supervisor() then raise exception` line is that escalation — it is not "hand-rolled permission logic" in the sense `CLAUDE.md` forbids (that rule targets auth living *only* in the frontend or a bespoke Node backend); a `plpgsql` check inside a Postgres function, backed by RLS as the row-level backstop, is the sanctioned pattern this codebase already uses for `mover_card_funil`'s "ganho only from the final etapa" rule, and again for v1.2's `desativar_membro_equipe` (Pattern 7). [Confidence: MEDIUM — general Postgres/Supabase RLS semantics cross-checked via web search, applied here to this project's specific schema]

**Stronger alternative (not recommended for this milestone, but the "pure RLS" answer if ever needed):** tag each row with an `origem_cadastro` enum (`'manual' | 'importacao'`) and extend the INSERT policy itself: `with check ((origem_cadastro = 'manual' and (responsavel = auth.uid() or is_supervisor())) or (origem_cadastro = 'importacao' and is_supervisor()))`. This makes the restriction a genuine row-level predicate, immune to any future call path that might bypass the RPC. **Not recommended now** because this project has exactly one way to reach Postgres (this Next.js app's Server Actions/RPCs — no public API, no third-party integration, per this milestone's Out of Scope), so the RPC-level check already is the only call path and adding a column purely for defense-in-depth against a call path that doesn't exist is unnecessary complexity for a 2-person MVP. Revisit only if a future integration adds another way to write to `clientes`.

**Duplicate handling — avoid the plpgsql-loop-with-exception anti-pattern.** A naive implementation loops over rows with `EXCEPTION WHEN unique_violation`; each caught exception implicitly opens a subtransaction (savepoint), which is a known performance drag for large batches. `INSERT ... ON CONFLICT (razao_social) DO NOTHING RETURNING ...` is the set-based, native alternative — one statement, no loop, no savepoints, and it directly reuses the `razao_social` unique constraint already in `0002_clientes_and_funil.sql`. [Confidence: MEDIUM — general Postgres idiom, cross-checked]

### Pattern 5: Two-phase import (client-side parse → server-side validate/preview → server-side confirm)

**What:** Three distinct steps, matching the milestone's explicit "mostrar erros/duplicados antes de confirmar" requirement:

1. **Parse (client-side, browser):** the spreadsheet file (`.xlsx`/`.csv`) is parsed entirely in the browser — never uploaded to Supabase Storage or streamed to a Route Handler first. This keeps the "no new infra" posture (no bucket, no RLS-on-storage-objects to design) and lets the column-mapping UI render an instant preview with zero round trips.
2. **Validate (Server Action `validarLoteImportacao`, read-only):** receives the already-parsed, already-column-mapped rows as plain JSON (never the raw file). Re-validates every row with a Zod schema shaped like the existing `createClienteSchema` (required: razão social, endereço, responsável), resolves free-text `responsavel`/`categoria`/`produtos` values against `profiles`/`categorias`/`produtos_consumidos`, and checks for duplicates two ways: within the uploaded batch itself, and against existing `clientes.razao_social` via a single `select razao_social from clientes where razao_social = any($1)` query. Returns an annotated row list (`ok` / `duplicado` / `erro: campo obrigatório ausente` / `erro: responsável não encontrado`) — **writes nothing to the database**.
3. **Confirm (Server Action `confirmarLoteImportacao`):** only after the Supervisor reviews/corrects the preview does this call `importar_clientes_lote` (Pattern 4) with the final row set. The RPC's `ON CONFLICT DO NOTHING` is a race-safety backstop for this step (e.g. two supervisors importing overlapping lists concurrently), not the primary duplicate-detection mechanism — that already happened in step 2 for the user-facing preview.

**When to use:** Any import flow where the milestone requires a review-before-commit UX. A single-shot "parse and insert immediately" flow would not satisfy that requirement.
**Trade-offs:** Three round trips (parse locally, validate, confirm) instead of one, but each step has a single clear responsibility and matches this codebase's existing double-validation discipline (client-side Zod for UX, server-side Zod re-validation because "Server Actions must never trust client input," per the `createCliente` precedent). [Confidence: HIGH for the "never trust client input" half — this project's own established convention; MEDIUM for the specific three-phase shape, this document's synthesis]

**Do NOT** implement bulk import as a Server Action that loops N times calling the existing single-row `createCliente` action: N sequential network/DB round trips (slow for hundreds of rows, wastes free-tier egress), no natural transactional grouping, wrong response shape. A dedicated RPC accepting a JSON array (Pattern 4) is the correct escalation.

### Pattern 6: Export via a Route Handler reading through existing RLS — the one sanctioned use of `app/api/`

**What:** `GET /api/clientes/exportar` — a Next.js Route Handler (not a Server Action) that: (1) builds the same SSR Supabase client as every Server Component (`lib/supabase/server.ts`), (2) runs `supabase.from('clientes').select(<narrow column list>)` with **no manual role branching** — the existing `clientes` SELECT policy (`responsavel = auth.uid() OR is_supervisor()`) already scopes the result set to "own clients" for a Vendedor and "all clients" for a Supervisor, (3) serializes the rows to CSV/XLSX, and (4) returns them with `Content-Disposition: attachment; filename=clientes.csv` and the matching `Content-Type`.
**When to use:** Specifically for *producing a downloadable file* — the one class of response Server Actions cannot give. [Confidence: MEDIUM — cross-checked web search, consistent with Next.js's own stated Route Handler use case]
**Trade-offs:** A deliberate, narrow exception to this project's "no `app/api/` for CRUD" structural rule — but it does not weaken the authorization story at all, because the export query is exactly as RLS-scoped as every other read in the app; only the transport changed.

**Alternative considered and rejected:** a Server Action returning the full row set as JSON, with the browser building the CSV/XLSX blob client-side. Valid too, but the Route Handler is preferred because it keeps file-format serialization as one server-side concern.

## Updated Data Flow — v1.1

### Import Flow

```
Supervisor opens /clientes/importar
    ↓
Selects .xlsx/.csv file → parsed entirely in the browser (Pattern 5, step 1)
    ↓
Column-mapping UI: maps spreadsheet columns → clientes fields
    ↓
Server Action validarLoteImportacao(rows) — re-validates with Zod, checks
duplicates against DB + within batch, resolves responsavel/categoria/produtos
lookups (Pattern 5, step 2) — NO WRITE YET
    ↓
Preview table shows ok/duplicado/erro per row; Supervisor fixes or excludes rows
    ↓
Server Action confirmarLoteImportacao(rows) → supabase.rpc('importar_clientes_lote', {...})
    ↓
RPC: is_supervisor() guard (raises if not) → INSERT ... ON CONFLICT DO NOTHING
RETURNING (Pattern 4) — RLS's existing INSERT policy is the row-level backstop
    ↓
Result: N inserted, M skipped as (race-condition) duplicates → toast + revalidatePath('/clientes')
```

### Export Flow

```
Vendedor or Supervisor clicks "Exportar"
    ↓
Browser navigates to (or fetches) GET /api/clientes/exportar
    ↓
Route Handler: same SSR Supabase client as everywhere else →
supabase.from('clientes').select(...) — RLS scopes rows automatically
(Vendedor: own clientes only; Supervisor: all clientes) — Pattern 6
    ↓
Route Handler serializes to CSV/XLSX, sets Content-Disposition: attachment
    ↓
Browser triggers native "Save As" download — no new authorization logic anywhere
```

## Updated Integration Points — v1.1

### Internal Boundaries (new rows)

| Boundary | Communication | Notes |
|----------|----------------|-------|
| Import wizard UI ↔ `clientes` table | `validarLoteImportacao` (Server Action, read-only) then `confirmarLoteImportacao` → `supabase.rpc('importar_clientes_lote', ...)` | Never a raw bulk `INSERT` from the client, never a loop of single-row `createCliente` calls — see Pattern 4/5 |
| Export button ↔ `clientes` table | `GET /api/clientes/exportar` (Route Handler) | The one Route Handler in the app; RLS-scoped identically to every other read, no new authorization branching |

### External Services (unchanged)

No new external service. Confirmed: Supabase Storage is **not** introduced by this milestone (file parsing is client-side only); no third-party spreadsheet-processing API is called.

## Updated Suggested Build Order — v1.1

Building on the completed v1.0 order (Foundation → Cadastro → Kanban → Tarefas → Admin CRUD → Dashboard), this milestone added:

7. **Export first, within this milestone:** simpler of the two features (no new RPC, no new UI wizard), immediately useful, low-risk. Build order: `GET /api/clientes/exportar` → "Exportar" button on `/clientes`.
8. **Import — column-mapping + preview, before the RPC:** build the client-side parse + column-mapping UI and `validarLoteImportacao` first, using a hand-typed test file, so the review/duplicate-detection UX is provable before the destructive step exists.
9. **Import — commit path last:** add `importar_clientes_lote` and wire `confirmarLoteImportacao` once the preview step is solid — the riskiest code (bulk INSERT) built and tested last, against an already-validated row set.

---

## v1.2 Additions: Team Deactivation, Funnel Metrics, Comparative Vendor Table, Kanban Scroll, Location Filters

**Milestone context:** Six target features, layered entirely on the existing RLS/RPC/`historico`/dashboard-aggregate architecture, with no new authorization mechanism introduced beyond one modified helper function. Full per-feature reasoning (line-traced to the actual migrations) lives in this section; see "Direct Answer" below for the two questions this research was specifically scoped to resolve.

### Direct Answer: data-model changes for deactivation and time-in-stage

**Team-member deactivation** needs exactly one new column: `profiles.ativo boolean not null default true`. No hard delete, no new table. It plugs into the architecture at a single choke point — `is_supervisor()` (`0001_profiles_and_roles.sql:38-49`) — by adding `and ativo = true` to its `WHERE` clause. Every existing RLS policy that already calls `is_supervisor()` (clientes update/delete, all 4 lookup-table CRUD policies in `0002_clientes_and_funil.sql:196-245`) instantly stops granting Supervisor privileges the moment `ativo` flips to `false`, with zero edits to those ~20 policies. This is what makes deactivation a "real authorization gate," not UI hiding.

**Time-in-stage is answerable from the existing `historico` table with NO structural change.** `historico.descricao` is a fixed-format string (`'Etapa alterada para "%s"'`, written only by `clientes_after_update_historico()` — `0002_clientes_and_funil.sql:412-441`) that already names the etapa a cliente moved *into*, ordered by `criado_em`. Reconstructing "how long a cliente spent in stage X" does not require an `old_etapa` column: read each cliente's `tipo='etapa'` `historico` rows in order and take the gap between consecutive `criado_em` timestamps (a `LEAD()`/self-join over ordered rows), seeded by `clientes.criado_em` as the entry time into the default first stage. This extends — rather than departs from — the "trust the fixed writer format" precedent `dashboard_ganhos_perdidos` already relies on (`0003_dashboard_aggregates.sql:66-94`, `descricao ILIKE '%"ganho"%'`). A new structured column pair would also create a backfill gap (all pre-v1.2 rows would have `NULL`), which the string-parsing approach avoids entirely since it works retroactively on data that already exists.

### Updated System Overview (delta from v1.0/v1.1)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Next.js Server Actions (existing layer — no new deployable)         │
│  ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────┐ │
│  │ desativarMembro() │  │ dashboard queries   │  │ cidadesPorEstado()│ │
│  │ orchestrates 2    │  │ (unchanged pattern) │  │ (new, same shape  │ │
│  │ steps: RPC + Auth │  │                      │  │ as 0003 funcs)   │ │
│  │ Admin API         │  │                      │  │                  │ │
│  └────────┬──────────┘  └──────────┬───────────┘  └────────┬─────────┘ │
├───────────┼─────────────────────────┼────────────────────────┼─────────┤
│           ▼                         ▼                        ▼         │
│  ┌──────────────────┐   ┌───────────────────────┐  ┌──────────────────┐│
│  │ Postgres RPC        │   │ Postgres SQL functions │  │ Postgres SQL      ││
│  │ desativar_membro_    │   │ (SECURITY INVOKER,     │  │ function           ││
│  │ equipe() — NOT        │   │ language sql stable,   │  │ cidades_por_       ││
│  │ security definer,     │   │ RLS-transparent, same   │  │ estado() — same    ││
│  │ is_supervisor()        │   │ pattern as existing     │  │ SECURITY INVOKER   ││
│  │ guard, transactional   │   │ 0003 dashboard funcs)   │  │ pattern             ││
│  └────────┬──────────┘   └──────────┬─────────────┘  └────────┬─────────┘│
│           │                          │                         │          │
│  ┌────────▼──────────────────────────▼─────────────────────────▼───────┐ │
│  │  Postgres tables (RLS-protected)                                     │ │
│  │  profiles(+ativo)   clientes   historico(read-only)   cidades(NEW)   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────────────┤
│  Supabase Auth (GoTrue) — SEPARATE service, not reachable from Postgres│
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ auth.admin.updateUserById(id, { ban_duration }) — requires         │ │
│  │ service_role key, called from the Server Action (server-only env   │ │
│  │ var, never shipped to browser) AFTER the RPC transaction commits   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

### Pattern 7: Two-step, cross-service deactivation — Postgres RPC (reassign + `ativo`) followed by a separate Auth Admin API call (login block)

**What:** `desativar_membro_equipe(p_profile_id uuid, p_novo_responsavel_id uuid)` — a new `plpgsql` RPC, following `mover_card_funil`/`importar_clientes_lote` exactly: **NOT `security definer`**, first statement `if not is_supervisor() then raise exception`. Inside the guard, in one transaction:
1. If the target's role is `supervisor`, count other `ativo = true` supervisors excluding the target; `raise exception` if zero (the "never deactivate the last active Supervisor" rule) — enforced atomically inside the transaction, closing the race condition a client-side check alone could not.
2. `UPDATE clientes SET responsavel = p_novo_responsavel_id WHERE responsavel = p_profile_id` — reassignment, in the same transaction as step 3.
3. `UPDATE profiles SET ativo = false WHERE id = p_profile_id`.

Companion change, same migration, `create or replace function is_supervisor()` (`0001_profiles_and_roles.sql:38-49`), adding `and ativo = true`:
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
    where id = (select auth.uid()) and role = 'supervisor' and ativo = true
  );
$$;
```

**Why reassignment (not an RLS policy change) is what enforces the Vendedor case:** the existing `clientes` SELECT/UPDATE policies key off `responsavel = (select auth.uid())` (`0002_clientes_and_funil.sql:182-200`), not role or `ativo` — they don't need to, because step 2 above already moves every row away from the deactivated vendedor's `uid` inside the same transaction that sets `ativo=false`. Two different enforcement paths for the two roles (`is_supervisor()` cascade for Supervisor, reassignment for Vendedor), both anchored to the same `profiles.ativo` column and the same one RPC.

**Why the login block cannot be part of this RPC, and what the two-step sequence must be:** the actual login block — `auth.admin.updateUserById(id, { ban_duration: '87600h' })`, the officially documented mechanism for blocking sign-in without deleting the user record (see Sources) — is a call to GoTrue, a separate service from Postgres. It cannot be issued from inside a PL/pgSQL function. The Server Action must: (1) call `desativar_membro_equipe` (Postgres transaction, both-or-neither on reassignment+`ativo`), then (2) call the Auth Admin API with a `service_role` client. If step 2 fails after step 1 succeeds, `ativo` is already `false`, so the app-level gate is already enforced — the residual risk is narrow (a still-valid JWT could theoretically be used until its natural expiry, commonly ~1 hour, before the ban takes full effect). This is an accepted, documented residual, not a design flaw — see Anti-Pattern 5.

**Why the Auth Admin call belongs in a Server Action, not a new Edge Function:** `supabase-conventions`'s decision tree reserves Edge Functions for logic needing "algo externo: chamar API de terceiro, usar secret key". The Auth Admin API does need a secret (`service_role`) — but a Next.js Server Action is already a trusted server-side execution context (never shipped to the browser), and CLAUDE.md's "não existe backend Node.js separado" is about not adding a *second deployable*, not about forbidding server-side secrets inside the existing app. An Edge Function here would be new infrastructure for a single admin call the Server Action layer can already make safely with a server-only env var (`lib/supabase/admin.ts`).

**Existing constraint this design routes around:** `clientes.responsavel uuid not null references profiles(id)` has no `ON DELETE` clause (`0002_clientes_and_funil.sql:114`) — a hard delete of a profile owning clients was never viable. This confirms soft-deactivation via `ativo` is the only workable shape here, independent of the login-blocking requirement. [Confidence: HIGH for the schema/RLS reasoning — traced directly to the live migrations. MEDIUM for the `ban_duration` mechanism — confirmed via Supabase's official JS/Dart Admin API reference pages and a GitHub Discussion, not fetched directly against `supabase.com/docs`; verify exact parameter format and this project's JWT expiry setting at implementation time.]

### Pattern 8: Historico-derived duration reconstruction via ordered-window functions (no schema change)

**What:** Two new `language sql stable` functions, same SECURITY INVOKER-by-omission pattern as `0003_dashboard_aggregates.sql` (`0003:18-31`):
- `dashboard_tempo_por_etapa()` — reconstructs entry/exit timestamps per cliente per stage via an ordered window over `historico` rows where `tipo='etapa'`, seeded by `clientes.criado_em` as entry into `aguardando_contato`, extracting the target etapa from `descricao` via `substring(descricao from 'para "([a-z_]+)"')::etapa_funil`. Averages `exit_time - entry_time` (or `now() - entry_time` for a cliente still in that stage — open product question on whether to include ongoing cases, not an architecture blocker either way).
- `dashboard_dias_ate_ganho_perdido()` — reuses the `ultimo_status_change` CTE shape already proven in `dashboard_ganhos_perdidos` (`0003:74-93`), computing `avg(u.criado_em - c.criado_em)` grouped by resulting status instead of `count(*)`.

**When to use:** Per `PROJECT.md`'s explicit out-of-scope note ("filtro de período... no funil de conversão detalhado — v1.2 mostra só o total geral"), neither function needs `p_inicio`/`p_fim` parameters — adding unused period params would contradict that scope decision.
**Trade-offs:** The regex-parsing fragility is the same accepted risk `0003`'s `ILIKE` matching already carries — extending an already-accepted pattern, not introducing a new one. [Confidence: HIGH — traced directly to the live trigger/migration source]

### Pattern 9: Extending an existing dashboard function via `create or replace` in a new migration (not editing the original file)

**What:** `dashboard_desempenho_vendedor` (`0003_dashboard_aggregates.sql:106-144`) gets `create or replace function` in a NEW migration, adding `negocios_iniciados`, `ciclo_medio_dias`, and `ativo` (from Pattern 7) to its return shape — while keeping the existing `p_inicio timestamptz, p_fim timestamptz` signature, even though v1.2's UI passes an all-time range, so the function is ready for period filtering later without a second signature change.
**When to use:** Any time a dashboard aggregate needs new columns/logic without inventing a parallel function. This is the exact same precedent already used twice in this codebase: `0005_fix_importar_clientes_lote_variable_conflict.sql` and `0006_fix_importar_clientes_lote_cte_rls_visibility.sql` are both new files, both `create or replace function importar_clientes_lote(...)`, neither edits `0004`.
**Trade-offs:** Requires the extended query to `LEFT JOIN profiles p ON p.id = c.responsavel` (already present, `0003:139`) and read `p.ativo` — which means `profiles.ativo` (Pattern 7) must exist before this function can be finalized. This is the one **hard** cross-feature dependency in the whole milestone (see Build Order below).
**Not a new security requirement:** because the function stays SECURITY INVOKER, a Vendedor calling it directly only ever gets their own row back (RLS on `clientes` already restricts it) — "visível só pro Supervisor" is a UI-hiding nicety on top of an already-RLS-safe function, consistent with CLAUDE.md's "UI hiding is a UX nicety on top, never the security boundary."

### Pattern 10: Closed geographic reference table (`cidades`) vs. a hardcoded frontend constant (Estado) — sourcing dropdown truth from the right place

**What:** Estado (27 UF codes) is a genuinely closed, decades-static set — a plain frontend TypeScript constant, **not** a database table. Cidade is the opposite: high-cardinality (thousands of Brazilian municipalities), estado-scoped, and — per the milestone's own stated goal ("deixar os filtros de localização mais confiáveis") — the *current* source of city values (`clientes.cidade`, free `text`, no constraint — `0002_clientes_and_funil.sql:112-113`) is exactly the reliability problem being solved, not a source to reuse as-is. The fix: a new `cidades (id uuid pk, nome text, uf text, unique(nome, uf))` table, seeded once from an IBGE municipality dataset (same seeding style as `categorias`/`produtos_consumidos` in `0002:79-100`, but as a closed reference set, not a Supervisor-editable enum — RLS enabled, read-open to `authenticated`, **no** write policy, mirroring `historico`'s "no user insert policy" precedent), plus a new `cidades_por_estado(p_uf text) returns table(nome text)` RPC (`language sql stable`, SECURITY INVOKER, same shape as the `0003` dashboard functions).
**Why NOT `SELECT DISTINCT cidade FROM clientes WHERE estado = :uf` against the existing free-text columns instead:** two concrete problems traced to the milestone's own stated goal. First, it perpetuates whatever inconsistent spellings already exist instead of fixing them — the goal is filter *reliability*, which a distinct-query over already-messy data does not deliver. Second, it structurally can't support cadastro of the first-ever cliente in a city with zero existing rows — a dropdown built only from "already-typed values" would make registering a legitimately new city impossible.
**What does NOT change:** `clientes.estado`/`clientes.cidade` stay plain `text` columns (not converted to `cidade_id uuid references cidades(id)`). A full FK conversion needs backfilling/matching every existing free-text value, including resolving legacy typos — disproportionate to a milestone item scoped as "make the filter more reliable." The `cidades` table drives the dropdown OPTIONS in cadastro/edição/filtro/importação; the selected value is still written into the existing `text` columns. New data becomes clean going forward; existing rows are left as-is (accepted, out of scope for v1.2).
**Importação touchpoint:** `importar_clientes_lote` (`0004_importar_clientes_lote.sql:46-85`) needs no change — it already accepts `estado`/`cidade` as plain text. Validation against the UF list and `cidades_por_estado` belongs in the existing client-side review/re-validation step (Pattern 5), the same place duplicate-checking already happens.

## Updated Data Flow — v1.2

### Deactivation Flow

```
Supervisor opens /admin/equipe, clicks "Desativar" on a Vendedor/Supervisor
    ↓
UI: picks a replacement vendedor (required if the target has any clientes)
    ↓
Server Action desativarMembroEquipe(profileId, novoResponsavelId)
    ↓
Step 1: supabase.rpc('desativar_membro_equipe', {...})
  → Postgres transaction: last-supervisor guard (if applicable) →
    reassign clientes.responsavel → profiles.ativo = false
    ↓ (transaction commits — app-level gate already enforced from here)
Step 2: adminClient.auth.admin.updateUserById(profileId, { ban_duration })
  → GoTrue: revokes refresh token, blocks future sign-in
    ↓
Success → toast; Failure on step 2 → surfaced error, ativo=false already in effect
(see Anti-Pattern 5) → revalidatePath('/admin/equipe')
```

### Dashboard Detailed-Funnel Flow

```
Supervisor or Vendedor opens /dashboard, "Funil detalhado" section
    ↓
Server Component calls dashboard_tempo_por_etapa() and
dashboard_dias_ate_ganho_perdido() (Pattern 8) — no period params (v1.2 scope)
    ↓
Same RLS-on-clientes/historico automatically scopes the underlying rows
    ↓
Vendedor sees own-numbers-only; Supervisor sees team-wide
```

### Location Filter Flow (cadastro/edição/filtro/importação)

```
User selects Estado (frontend constant dropdown, 27 UFs, no DB call)
    ↓
UI calls cidades_por_estado(uf) (Pattern 10) — Cidade dropdown populates
    ↓
Selected Cidade value written into clientes.cidade (still plain text)
```

## Updated Integration Points — v1.2

### New/Modified Schema Objects

| Object | Type | Feature | Notes |
|--------|------|---------|-------|
| `profiles.ativo` | New column | Deactivation | `not null default true` |
| `is_supervisor()` | Modified function (`create or replace`) | Deactivation | Adds `and ativo = true` — cascades to ~20 existing policies with zero policy edits |
| `desativar_membro_equipe()` | New RPC | Deactivation | Not security definer, `is_supervisor()` guard, transactional reassignment + last-supervisor check |
| Auth Admin API call (`ban_duration`) | New Server Action logic, no schema object | Deactivation | Requires `service_role` key server-side; sequenced after the RPC commits |
| `dashboard_tempo_por_etapa()` | New function | Funnel metrics | No schema change to `historico`/`clientes` |
| `dashboard_dias_ate_ganho_perdido()` | New function | Funnel metrics | Reuses `0003`'s `ultimo_status_change` CTE shape |
| `dashboard_desempenho_vendedor()` | Modified function (`create or replace`) | Comparative table | Adds `negocios_iniciados`, `ciclo_medio_dias`, `ativo`; keeps existing `p_inicio`/`p_fim` params |
| *(none)* | — | Kanban scroll | Pure frontend, confirmed no backend touchpoint |
| `cidades` table | New table + RLS (read-only) | Location filter | IBGE-seeded, no user CRUD |
| `cidades_por_estado()` | New RPC | Location filter | SECURITY INVOKER, RLS-transparent |
| Estado UF list | New frontend constant | Location filter | Not a DB object |

### Internal Boundaries (new rows)

| Boundary | Communication | Notes |
|----------|----------------|-------|
| `desativar_membro_equipe()` RPC ↔ Auth Admin API call | Sequential, two separate calls orchestrated by one Server Action, not one transaction | RPC first (both-or-neither on reassignment+`ativo`), Auth ban second; document failure-ordering in error handling |
| `is_supervisor()` ↔ every existing RLS policy that calls it | Already-established indirection (`0001`→`0002` policies) | v1.2 reuses this indirection instead of touching individual policies — the main architectural leverage point of this milestone |
| `dashboard_desempenho_vendedor()` ↔ `profiles.ativo` | New read dependency | Concrete reason Deactivation must precede Comparative table in build order |
| Cadastro/edição/filtro/importação UIs ↔ `cidades_por_estado()` | Read-only RPC call | Same call reused across all four touchpoints named in the requirement |

### External Services (new)

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| Supabase Auth Admin API (GoTrue) | `auth.admin.updateUserById(id, { ban_duration })` from a Server Action using a server-only `service_role` client (`lib/supabase/admin.ts`) | First feature in this project needing the service_role key server-side; confirm the project's JWT/access-token expiry setting to size the residual "still-valid-JWT" window after a ban (commonly ~1h default) |

## New Anti-Patterns (v1.2)

### Anti-Pattern 5: Treating the two-step deactivation (RPC + Auth ban) as atomic

**What people do:** assume "the RPC succeeded" means "the user is fully locked out," and skip error handling on the Auth Admin API call.
**Why it's wrong:** GoTrue is a separate service from Postgres; the two calls cannot share a transaction. A failure in step 2 after step 1 commits leaves `ativo=false` (app-level gate correctly enforced) but the Auth-level ban not yet applied.
**Do this instead:** surface a clear error to the Supervisor if step 2 fails ("desativado no sistema, mas falha ao bloquear login — tentar novamente"), and treat `ativo=false` as the primary, already-effective control rather than assuming both steps always land together.

### Anti-Pattern 6: Adding structured `old_etapa`/`new_etapa` columns to `historico` for time-in-stage

**What people do:** treat "historico only has free text" as a defect and normalize it with new columns before computing time-in-stage.
**Why it's wrong:** creates a backfill gap (pre-migration rows stay `NULL` in the new columns) for zero net benefit, since string-parsing already reconstructs full history retroactively and the codebase already accepts this class of risk.
**Do this instead:** parse `descricao` with the ordered-window technique in Pattern 8; treat the format-string dependency as accepted debt, same as the existing `0003` precedent.

### Anti-Pattern 7: Sourcing the Cidade dropdown from `SELECT DISTINCT cidade FROM clientes`

**What people do:** avoid a new table by deriving city options from data already in `clientes`.
**Why it's wrong:** perpetuates the exact inconsistency the milestone goal names as the problem, and structurally blocks registering the first cliente in any city with zero existing rows.
**Do this instead:** the new IBGE-seeded `cidades` table, scoped by `uf` via `cidades_por_estado()` (Pattern 10).

### Anti-Pattern 8: Building a new Edge Function for the deactivation login-block

**What people do:** reach for an Edge Function because the Auth Admin API needs a secret key, following the `supabase-conventions` skill's "secret key → Edge Function" heuristic too literally.
**Why it's wrong:** the heuristic targets business logic needing external calls; a Next.js Server Action is already a trusted server context that can safely hold a server-only `service_role` env var without becoming "a separate Node backend."
**Do this instead:** a server-only Supabase admin client (`lib/supabase/admin.ts`) inside the Server Action that orchestrates `desativar_membro_equipe()` + `auth.admin.updateUserById`.

## Updated Suggested Build Order — v1.2

Building on the completed v1.0/v1.1 order, this milestone's 6 features have exactly one hard cross-feature dependency and one soft one:

10. **Kanban column scroll** — zero dependencies, zero risk, pure CSS/layout change against the already-existing `clientes.posicao` + `mover_card_funil`. Ship any time, including first, as a quick win.
11. **Estado/Cidade cascading filter** — fully independent of the other four; only needs the new `cidades` table + RPC. No reason to sequence it after anything else.
12. **Team deactivation** — must land `profiles.ativo` before the comparative table (Pattern 9's function needs to read that column). This is the one **hard** schema dependency in the set.
13. **Per-stage funnel metrics** — independent of deactivation/comparative-table/location-filter, but should precede the comparative table for code reuse: the `historico`-based duration-reconstruction logic it introduces (Pattern 8) is exactly what the comparative table's `ciclo_medio_dias` needs too. A **soft** (avoid-duplicating-logic) dependency, not a hard blocker.
14. **Per-salesperson comparative table** — last, because it's the only feature with a real dependency on another (deactivation's `ativo` column) and benefits from funnel-metrics' duration-calc pattern already existing to extend rather than re-derive.

**Ordering rationale in one line:** order by dependency depth — kanban scroll and location filter have none (build anytime); deactivation unblocks the comparative table's schema need; funnel metrics unblocks its logic reuse; the comparative table depends on both and goes last.

## Sources

- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence, official
- [Creating a Supabase client for SSR | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — HIGH confidence, official
- [Setting up Server-Side Auth for Next.js | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — HIGH confidence, official
- [Infinite recursion when using users table to specify users role for RLS · supabase Discussion #1138](https://github.com/orgs/supabase/discussions/1138) — HIGH confidence, official Supabase discussion
- Project's own live migrations (`supabase/migrations/0001_profiles_and_roles.sql` through `0006_fix_importar_clientes_lote_cte_rls_visibility.sql`) and `.planning/PROJECT.md` — HIGH confidence, read directly from the repository, not inferred
- `.claude/skills/Supabase-conventions/SKILL.md` — HIGH confidence, read directly; applied to the v1.2 deactivation login-block design (Pattern 7)
- WebSearch: "Postgres plpgsql bulk insert from jsonb array with per-row error handling and duplicate skipping best practice" — MEDIUM confidence (community sources + PostgreSQL mailing list, converging on `ON CONFLICT DO NOTHING` over loop+exception for large batches)
- WebSearch: "Next.js App Router Server Actions triggering a CSV file download versus a Route Handler" — MEDIUM confidence (multiple 2025/2026 Next.js pattern articles agreeing Route Handlers are correct for file-download HTTP semantics)
- WebSearch: "Supabase RLS restrict bulk import feature to admin role only same table has insert policy for regular users" — MEDIUM confidence; the `origem_cadastro`-column alternative is this document's own synthesis
- WebSearch: "Supabase auth admin updateUserById ban_duration disable user login without deleting official docs" (v1.2) — confirms `ban_duration` on `auth.admin.updateUserById` as the documented mechanism to block login without deleting the user record; cross-referenced against a GitHub Discussion and the official JS/Dart API reference pages ([JavaScript: updateUserById | Supabase Docs](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid), [How to disable/deactivate a user · supabase Discussion #9239](https://github.com/orgs/supabase/discussions/9239)). Confidence: MEDIUM (community + official reference pages surfaced by search, not fetched directly against `supabase.com/docs`) — verify exact current parameter name/format and the project's JWT expiry setting at implementation time.

---
*Architecture research for: B2B sales CRM (kanban funnel + role-based dashboard) on Next.js + Supabase*
*Researched: 2026-07-14 (v1.0) — extended 2026-07-22 (v1.1: bulk import & export) — extended 2026-07-25 (v1.2: team deactivation, funnel metrics, comparative vendor table, kanban scroll, location filters)*
