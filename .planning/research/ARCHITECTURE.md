# Architecture Research

**Domain:** B2B sales CRM — kanban funnel + role-based dashboard (internal tool, zero-infra-cost MVP)
**Researched:** 2026-07-14 (v1.0) — extended 2026-07-22 for milestone v1.1 (bulk import/export)
**Confidence:** HIGH for v1.0 patterns (official Supabase/Next.js guidance, cross-checked). MEDIUM for the new v1.1 bulk-import/export patterns below (general Postgres/Next.js idioms cross-checked against multiple sources, applied to this project's existing schema — no single official "how to bulk-import into a Supabase RLS table" doc exists, so the synthesis is this document's own reasoning, not a copied recipe)

> **Read this first if you're planning v1.1 (bulk import/export):** everything in "Standard Architecture" through "Suggested Build Order" below is the *existing, already-built* v1.0 system — kept verbatim as ground truth for how this codebase actually works today (confirmed against the real migrations and Server Actions in this repo, not just the original research). The new work for this milestone is entirely in **"v1.1 Additions: Bulk Import & Export"**, near the end of this document.

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
│   │   └── motivos-perda/page.tsx
│   └── dashboard/page.tsx        # metrics screen
├── api/
│   └── clientes/
│       └── exportar/route.ts     # v1.1 — the ONE Route Handler in this app (see rationale below)
├── actions/                       # existing Server Actions (clientes.ts, funil.ts, tarefas.ts, listas.ts, dashboard.ts)
│   └── importacao.ts              # v1.1 — new: validarLoteImportacao / confirmarLoteImportacao
├── middleware.ts                  # session refresh + route guard
components/
├── funil/                         # KanbanBoard, KanbanColumn, ClienteCard
├── clientes/                      # ClienteForm, ClienteList
│   └── importacao/                # v1.1 — FileDropzone, ColumnMappingTable, ImportPreviewTable
├── admin/                         # EnumList, EnumForm (shared across the 4 enums)
├── dashboard/                     # StatCard, FunilChart, VendedorRanking
└── ui/                             # generic buttons, inputs, etc.
lib/
├── supabase/
│   ├── client.ts                  # browser client (drag interactions, forms)
│   ├── server.ts                  # SSR client for Server Components/Actions
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
│   └── 000X_importacao_clientes.sql  # v1.1 — importar_clientes_lote RPC (see Pattern 4)
└── functions/                     # empty — see Anti-Patterns (still empty after v1.1, no external call needed)
tests/
```

### Structure Rationale

- **`app/(app)/admin/`:** groups the 4 enum-CRUD screens together because they share the same component pattern (`EnumList`/`EnumForm`) — build one generic admin CRUD component, reuse it 4 times, not 4 bespoke screens.
- **`app/(app)/funil/` as the entry screen, not `clientes/`:** the kanban board is the Core Value (per PROJECT.md) — it should be what a vendedor sees first, not a plain list.
- **No `app/api/` route handlers for CRUD:** Server Actions + direct `supabase-js` calls (browser or server) cover all reads/writes here; a custom API layer would duplicate the RLS/RPC logic that already lives in Postgres, which this project explicitly avoids (see `CLAUDE.md`: "não existe backend Node.js separado"). **v1.1 note:** the one exception introduced this milestone (`app/api/clientes/exportar/route.ts`) is not a reversal of this rule — it exists only because *file-download HTTP semantics* (Content-Disposition, Content-Type, streaming a binary body) are the one thing Server Actions genuinely cannot express, not because export needed different authorization. See Pattern 6 below.
- **`supabase/functions/` stays empty for the MVP, including after v1.1:** bulk import is pure Postgres logic (validate rows already in the browser/Server Action, then a set-based INSERT) and export is a pure RLS-scoped read — neither needs a third-party call, a secret key, or a webhook. The `supabase-conventions` skill's escalation order (RLS → RPC → Edge Function) never reaches step 3 for this milestone either.

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

### Pattern 2: `security_invoker = true` views for the dashboard

**What:** Dashboard aggregates (clientes por etapa, ganhos x perdidos, desempenho por vendedor, conversão, prospecções por produto/categoria) are Postgres views created with `security_invoker = true` (Postgres 15+, which Supabase runs).
**When to use:** Any read-only aggregate query that must respect the *same* visibility rule as the underlying table (vendedor sees own numbers, supervisor sees the team's).
**Trade-offs:** Views are owned by the `postgres` role by default and silently bypass RLS unless `security_invoker` is set — a dashboard built on a plain view would leak every vendedor's numbers to every other vendedor. [Confidence: HIGH — Supabase official docs]

### Pattern 3: RPC for multi-step funnel business rules

**What:** Moving a card is not a bare `UPDATE` — it must enforce "ganho só é possível na etapa '1ª venda concluída'" and "motivo obrigatório ao marcar perdido". This logic lives in `mover_card_funil`, a `plpgsql` RPC that is **explicitly NOT `SECURITY DEFINER`** — it runs as the calling user, so the `clientes` UPDATE/INSERT RLS policies still apply *inside* it. A vendedor calling it against a client they don't own simply affects 0 rows; the RPC's own validation raises a readable exception for the cases RLS can't express as a row-visibility predicate (like "status can only be 'ganho' when etapa is the last column").
**When to use:** Any write that has a validation rule spanning more than "can this user touch this row" (that part stays RLS's job).
**Trade-offs:** Keeps the rule enforced no matter which client calls it and keeps it in one place instead of duplicated across every UI form. This exact pattern — **non-`SECURITY DEFINER` RPC as the place for a business rule that isn't a pure row-visibility predicate, with the underlying table's RLS policy as the real backstop** — is the direct precedent for how v1.1's bulk-import RPC is designed (Pattern 4 below). [Confidence: HIGH — confirmed against the live `supabase/migrations/0002_clientes_and_funil.sql`]

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
Server Component queries security_invoker views
    ↓
Same RLS that scopes clientes/tarefas automatically scopes the views
    ↓
Vendedor gets own-numbers-only response; Supervisor gets team-wide response
```

### Key Data Flows

1. **Identity → visibility:** `auth.users` → `profiles.role` → `is_supervisor()` → every RLS policy on `clientes`/`tarefas`/enum tables → every read and write in the app.
2. **Client record → funnel card → tasks:** a `clientes` row *is* the funnel card (etapa/status/observação live on it); `tarefas` rows hang off it. There is no separate "opportunity" or "deal" entity — v1.1's bulk import inserts directly into this same `clientes` row shape, it does not introduce a parallel staging entity in the database (see Pattern 4/5 for where staging *does* happen — client-side, before any DB write).
3. **Enum tables → everything that references them:** `categorias`, `produtos_consumidos`, `tipos_tarefa`, `motivos_perda` are read by client forms and the two dashboard aggregates keyed on them — v1.1's column-mapping screen needs to resolve free-text spreadsheet values (e.g. "Food Service") against these same lookup tables, not invent new ones.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|---------------------------|
| Internal team, <20 users (this project's actual scale) | Current architecture (RLS + views + a couple of RPCs) is complete — no further work needed |
| 20-200 users | Consider adding a `equipe`/team concept if visibility needs to become "supervisor sees own team" instead of "all"; still pure RLS, no infra change |
| 200+ users / cross-org multi-tenant | Out of scope for this project |

### Scaling Priorities

1. **First real constraint is Supabase free-tier limits, not user count:** 500MB database, bandwidth caps. v1.1's bulk import (hundreds of rows per spreadsheet, occasional/recurring, not continuous) does not change this calculus meaningfully.
2. **Second:** dashboard aggregate views are fine unindexed at this scale.

## Anti-Patterns

### Anti-Pattern 1: Checking role only in the frontend

**What people do:** `if (user.role === 'supervisor') fetchAllClients() else fetchOwnClients()` in a React component, with no RLS backing it.
**Why it's wrong:** The Supabase anon/authenticated key is public by design — anyone can call the API directly and bypass a client-side `if`.
**Do this instead:** RLS is always the source of truth. The frontend can still branch on role for UX (e.g. hiding the "Importar" nav link from a Vendedor), but the query/RPC itself must independently enforce the rule — as v1.1's import RPC does (Pattern 4).

### Anti-Pattern 2: Plain views for the dashboard

**What people do:** `CREATE VIEW dashboard_x AS SELECT ...` without `security_invoker = true`.
**Why it's wrong:** Views default to running as their owner (`postgres`), silently bypassing RLS.
**Do this instead:** Always add `WITH (security_invoker = true)`.

### Anti-Pattern 3: A separate Node.js API layer "for business logic"

**What people do:** Stand up an Express/Fastify service to hold validation rules.
**Why it's wrong:** Contradicts this project's no-separate-backend constraint and zero-cost goal.
**Do this instead:** RLS → RPC (`plpgsql`) → Edge Function escalation, per `supabase-conventions`. v1.1 confirms the pattern still holds: a spreadsheet import never needs step 3 (no external service is called; parsing happens in the browser, not via a third-party file-conversion API).

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

No other external services are needed for v1.0 or v1.1 — spreadsheet parsing happens entirely client-side (no upload-to-storage-then-process pipeline, see Pattern 5), so **Supabase Storage is deliberately not introduced by this milestone**, keeping the zero-infra-cost posture intact.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| Kanban UI ↔ funnel state | `supabase.rpc('mover_card_funil', ...)` | Never a raw `UPDATE` from the client |
| Admin enum CRUD ↔ enum tables | Direct `supabase-js` table calls, protected by RLS | Simple CRUD, no RPC needed |
| Client/task forms ↔ enum tables | Read-only `select` | Enum values populate dropdowns |
| Dashboard ↔ underlying tables | `security_invoker` views | No app-layer authorization branching |

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

**Why this answers "does the SAME table's existing Vendedor INSERT policy need to change?" — no.** RLS policies are evaluated per row against row *content*, never against "how many rows this statement is inserting" or "which named RPC called this" — there is no native "this is a bulk call" predicate to write a policy against. The existing policy already fully covers what bulk import needs (a Supervisor inserting rows with any `responsavel`), so **no new/changed RLS policy is required on `clientes`**. What *does* need a new enforcement point is "only a Supervisor may use the bulk-import feature at all" — that's not a row-visibility rule (a Supervisor's row-level rights don't change between one row and one thousand), it's a **business/feature rule**, which is exactly the class of thing this project already escalates to an RPC for (Pattern 3's precedent). The `if not is_supervisor() then raise exception` line is that escalation — it is not "hand-rolled permission logic" in the sense `CLAUDE.md` forbids (that rule targets auth living *only* in the frontend or a bespoke Node backend); a `plpgsql` check inside a Postgres function, backed by RLS as the row-level backstop, is the sanctioned pattern this codebase already uses for `mover_card_funil`'s "ganho only from the final etapa" rule. [Confidence: MEDIUM — general Postgres/Supabase RLS semantics cross-checked via web search, applied here to this project's specific schema]

**Stronger alternative (not recommended for this milestone, but the "pure RLS" answer if ever needed):** tag each row with an `origem_cadastro` enum (`'manual' | 'importacao'`) and extend the INSERT policy itself: `with check ((origem_cadastro = 'manual' and (responsavel = auth.uid() or is_supervisor())) or (origem_cadastro = 'importacao' and is_supervisor()))`. This makes the restriction a genuine row-level predicate, immune to any future call path that might bypass the RPC. **Not recommended now** because this project has exactly one way to reach Postgres (this Next.js app's Server Actions/RPCs — no public API, no third-party integration, per this milestone's Out of Scope), so the RPC-level check already is the only call path and adding a column purely for defense-in-depth against a call path that doesn't exist is unnecessary complexity for a 2-person MVP. Revisit only if a future integration adds another way to write to `clientes`.

**Duplicate handling — avoid the plpgsql-loop-with-exception anti-pattern.** A naive implementation loops over rows with `EXCEPTION WHEN unique_violation`; each caught exception implicitly opens a subtransaction (savepoint), which is a known performance drag for large batches. `INSERT ... ON CONFLICT (razao_social) DO NOTHING RETURNING ...` is the set-based, native alternative — one statement, no loop, no savepoints, and it directly reuses the `razao_social` unique constraint already in `0002_clientes_and_funil.sql`. [Confidence: MEDIUM — general Postgres idiom, cross-checked]

### Pattern 5: Two-phase import (client-side parse → server-side validate/preview → server-side confirm)

**What:** Three distinct steps, matching the milestone's explicit "mostrar erros/duplicados antes de confirmar" requirement:

1. **Parse (client-side, browser):** the spreadsheet file (`.xlsx`/`.csv`) is parsed entirely in the browser — never uploaded to Supabase Storage or streamed to a Route Handler first. This keeps the "no new infra" posture (no bucket, no RLS-on-storage-objects to design) and lets the column-mapping UI render an instant preview with zero round trips. (Which parsing library to use is a `STACK.md`-level decision, not an architecture one — any library that runs client-side and handles both CSV and XLSX satisfies this pattern.)
2. **Validate (Server Action `validarLoteImportacao`, read-only):** receives the already-parsed, already-column-mapped rows as plain JSON (never the raw file). Re-validates every row with a Zod schema shaped like the existing `createClienteSchema` (required: razão social, endereço, responsável), resolves free-text `responsavel`/`categoria`/`produtos` values against `profiles`/`categorias`/`produtos_consumidos`, and checks for duplicates two ways: within the uploaded batch itself, and against existing `clientes.razao_social` via a single `select razao_social from clientes where razao_social = any($1)` query. Returns an annotated row list (`ok` / `duplicado` / `erro: campo obrigatório ausente` / `erro: responsável não encontrado`) — **writes nothing to the database**.
3. **Confirm (Server Action `confirmarLoteImportacao`):** only after the Supervisor reviews/corrects the preview does this call `importar_clientes_lote` (Pattern 4) with the final row set. The RPC's `ON CONFLICT DO NOTHING` is a race-safety backstop for this step (e.g. two supervisors importing overlapping lists concurrently), not the primary duplicate-detection mechanism — that already happened in step 2 for the user-facing preview.

**When to use:** Any import flow where the milestone requires a review-before-commit UX (this one explicitly does: "Sistema mostra erros e duplicados antes de confirmar a importação"). A single-shot "parse and insert immediately" flow would not satisfy that requirement.
**Trade-offs:** Three round trips (parse locally, validate, confirm) instead of one, but each step has a single clear responsibility and matches this codebase's existing double-validation discipline (client-side Zod for UX, server-side Zod re-validation because "Server Actions must never trust client input," per the `createCliente` precedent). [Confidence: HIGH for the "never trust client input" half — this is this project's own established convention, confirmed in `app/actions/clientes.ts`; MEDIUM for the specific three-phase shape, which is this document's synthesis for this milestone's stated requirements]

**Do NOT** implement bulk import as a Server Action that loops N times calling the existing single-row `createCliente` action: that means N sequential network/DB round trips (slow for hundreds of rows, and consumes free-tier egress needlessly), gives no natural transactional grouping, and produces a *different* response shape than what a batch import UI needs (a per-row outcome list, not a single `{id}`). A dedicated RPC accepting a JSON array (Pattern 4) is the correct escalation, exactly like `mover_card_funil` already isn't "a loop of raw updates."

### Pattern 6: Export via a Route Handler reading through existing RLS — the one sanctioned use of `app/api/`

**What:** `GET /api/clientes/exportar` — a Next.js Route Handler (not a Server Action) that: (1) builds the same SSR Supabase client as every Server Component (`lib/supabase/server.ts`), (2) runs `supabase.from('clientes').select(<narrow column list>)` with **no manual role branching** — the existing `clientes` SELECT policy (`responsavel = auth.uid() OR is_supervisor()`) already scopes the result set to "own clients" for a Vendedor and "all clients" for a Supervisor, identically to how the kanban board and dashboard already work, (3) serializes the rows to CSV/XLSX, and (4) returns them with `Content-Disposition: attachment; filename=clientes.csv` and the matching `Content-Type`.
**When to use:** Specifically for *producing a downloadable file* — the one class of response Server Actions cannot give (they return serialized values through the React Server Actions protocol, not a raw HTTP response with custom headers/streaming). This is confirmed general Next.js App Router guidance, not specific to this project. [Confidence: MEDIUM — cross-checked web search, consistent with Next.js's own stated Route Handler use case of "cacheable GET endpoints needing precise HTTP response control"]
**Trade-offs:** This is a deliberate, narrow exception to this project's existing "no `app/api/` for CRUD" structural rule — but it does not weaken the authorization story at all, because the export query is exactly as RLS-scoped as every other read in the app; the only thing that changed is the transport (HTTP response with download headers instead of a React Server Component render or a Server Action return value). No new authorization logic is introduced or duplicated.

**Alternative considered and rejected:** a Server Action returning the full row set as JSON, with the browser building the CSV/XLSX blob and triggering `URL.createObjectURL` + a synthetic `<a download>` click. This avoids the `app/api/` exception entirely and is a valid pattern too — but at this project's scale (hundreds of rows) either approach works, and the Route Handler is preferred because it keeps file-format serialization (CSV vs XLSX, escaping, encoding) as one server-side concern instead of shipping that logic to the browser bundle. If the roadmap later prefers zero new routes over this trade-off, the Server-Action-plus-client-blob alternative is a safe fallback with identical RLS-scoping guarantees.

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

Building on the completed v1.0 order (Foundation → Cadastro → Kanban → Tarefas → Admin CRUD → Dashboard), this milestone adds:

7. **Export first, within this milestone:** it's the simpler of the two features (no new RPC, no new UI wizard, just a Route Handler reusing existing RLS-scoped reads) and gives an immediately-useful, low-risk win before tackling import's multi-step flow. Build order: `GET /api/clientes/exportar` → "Exportar" button on `/clientes`.
8. **Import — column-mapping + preview, before the RPC:** build the client-side parse + column-mapping UI and the `validarLoteImportacao` Server Action first, using a hand-typed test file, so the review/duplicate-detection UX is provable before the destructive step exists at all.
9. **Import — commit path last:** add the `importar_clientes_lote` migration/RPC and wire `confirmarLoteImportacao` to it once the preview step is solid. This ordering means the only step capable of writing bad data to `clientes` is built and tested last, against an already-validated row set.

**Ordering rationale in one line:** read-only/lowest-risk (export) → validate-only/no-write (import preview) → the one new write path (import RPC), so the riskiest code (bulk INSERT into the same table the whole rest of the app depends on) is built last, on top of already-proven validation.

## Sources

- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence, official
- [Creating a Supabase client for SSR | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — HIGH confidence, official
- [Setting up Server-Side Auth for Next.js | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs) — HIGH confidence, official
- [Infinite recursion when using users table to specify users role for RLS · supabase Discussion #1138](https://github.com/orgs/supabase/discussions/1138) — HIGH confidence, official Supabase discussion
- Project's own live migrations (`supabase/migrations/0001_profiles_and_roles.sql`, `0002_clientes_and_funil.sql`) and Server Actions (`app/actions/clientes.ts`, `app/actions/funil.ts`) — HIGH confidence, read directly from the repository, not inferred
- WebSearch: "Postgres plpgsql bulk insert from jsonb array with per-row error handling and duplicate skipping best practice" — MEDIUM confidence (community sources + PostgreSQL mailing list, converging on `ON CONFLICT DO NOTHING` over loop+exception for large batches)
- WebSearch: "Next.js App Router Server Actions triggering a CSV file download versus a Route Handler" — MEDIUM confidence (multiple 2025/2026 Next.js pattern articles agreeing Route Handlers are correct for file-download HTTP semantics)
- WebSearch: "Supabase RLS restrict bulk import feature to admin role only same table has insert policy for regular users" — MEDIUM confidence; the specific `origem_cadastro`-column alternative is this document's own synthesis (general RLS OR-composition + per-row-predicate principles, which are HIGH-confidence official behavior, applied to a scenario no single source addressed directly)

---
*Architecture research for: B2B sales CRM (kanban funnel + role-based dashboard) on Next.js + Supabase*
*Researched: 2026-07-14 (v1.0) — extended 2026-07-22 (v1.1: bulk import & export)*
