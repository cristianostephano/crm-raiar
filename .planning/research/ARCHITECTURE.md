# Architecture Research

**Domain:** CRM feature integration — recurring post-sale visit system ("Agenda do Vendedor") into an existing Next.js 16 + Supabase (Postgres/RLS) app
**Researched:** 2026-08-07
**Confidence:** HIGH (grounded directly in the actual current schema — `supabase/migrations/0001`–`0012` — and this project's own established conventions; MEDIUM/LOW only where general web patterns for cron-free recurrence and RLS-safe unified views were cross-checked)

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│  UI (Next.js App Router)                                                   │
│  ┌───────────────┐   ┌────────────────────┐   ┌─────────────────────────┐ │
│  │ AppSidebar.tsx │   │  app/agenda/page   │   │ ClienteDetailSheet.tsx  │ │
│  │ (MODIFIED —    │   │  (NEW) — AgendaList│   │ (MODIFIED) — campos     │ │
│  │  novo item     │   │  + ConcluirDialog  │   │  "ativo" + histórico    │ │
│  │  "Agenda")     │   │  (shared, 2 origens│   │  de visitas por cliente │ │
│  └───────┬────────┘   └─────────┬──────────┘   └────────────┬────────────┘ │
├──────────┴──────────────────────┴──────────────────────────┴──────────────┤
│  Server Actions (app/actions/agenda.ts NEW, app/actions/clientes.ts        │
│  MODIFIED) — thin wrappers, zod re-validation, call Supabase RPC/queries   │
├──────────────────────────────────────────────────────────────────────────┤
│  Postgres RPCs (SECURITY INVOKER by omission — RLS does the scoping)      │
│  ┌────────────────────┐ ┌──────────────────┐ ┌───────────────────────┐   │
│  │ agenda_do_vendedor()│ │ concluir_visita() │ │ concluir_tarefa_      │   │
│  │ NEW — UNION ALL     │ │ NEW — fecha visita│ │ prospeccao() NEW —    │   │
│  │ tarefas + visitas   │ │ + semeia a próxima│ │ marca tarefa concluída│   │
│  └────────────────────┘ └──────────────────┘ └───────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ mover_card_funil() EXTENDED — ao marcar "ganho", exige             │    │
│  │ p_frequencia_visita e semeia a 1ª linha de visitas                 │    │
│  └──────────────────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────────────────┤
│  Tables (RLS enabled on every table, parent-gated where there's no owner  │
│  column of its own)                                                      │
│  clientes (MODIFIED: + nome_fantasia, cnpj, frequencia_pedidos,          │
│    frequencia_visita)                                                    │
│  tarefas (MODIFIED: + resumo text)      visitas (NEW table)              │
│  historico (UNCHANGED schema — reused via the existing trigger pattern)  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| `visitas` (new table) | One row per post-sale visit *occurrence* — a scheduled/pending one (`data_realizada is null`) or a completed one (`data_realizada` + `resumo` filled). This table **is** the per-client visit history; no separate history table needed. | Plain Postgres table, RLS parent-gated through `clientes` exactly like `tarefas` already is |
| `clientes.frequencia_visita` (new column) | The *cadence setting* (semanal/quinzenal/mensal/nenhuma) — lives once per cliente, not duplicated per `visitas` row | New enum column, set/edited via `mover_card_funil` (first time) and a client-detail edit action (later changes) |
| `mover_card_funil` (extended RPC) | Single atomic action for "mark as ganho, which also starts the recurring-visit cadence" — mirrors the already-existing `motivo_perda_id`-required-when-perdido pattern | Add `p_frequencia_visita` param, required when `p_novo_status = 'ganho'`; on success, INSERTs the first `visitas` row |
| `concluir_visita` (new RPC) | Closes the current pending `visitas` row (`data_realizada = now()`, `resumo`), and if a next date was confirmed, INSERTs the next pending row in the same call | `language sql`/`plpgsql`, **not** security definer — relies on `visitas`' own RLS policies, same trust model as `mover_card_funil` |
| `concluir_tarefa_prospeccao` (new RPC, or Server Action-only) | Marks a `tarefas` row done + stores `resumo` | Reuses the existing `tarefas` UPDATE RLS policy; no new authorization code |
| `agenda_do_vendedor` (new RPC) | The single unified, role-aware feed: pending `tarefas` UNION ALL pending `visitas`, each row tagged with an `origem` discriminator for the "sinalizado visualmente" requirement | `language sql stable`, SECURITY INVOKER by omission — RLS on `tarefas`/`visitas`/`clientes` auto-scopes both halves to the caller for free |
| `historico` (existing, schema unchanged) | Chronological audit trail, now also receiving `tarefa_concluida`/`visita_concluida` entries whose `descricao` embeds the vendor's `resumo` | Existing SECURITY DEFINER trigger pattern, extended (not touched-in-place — a new migration `create or replace function`s it) |
| `AppSidebar.tsx` (modified) | New top-level nav item "Agenda", above "Clientes" | Existing component, one new `<Link>` entry |
| `ClienteDetailSheet.tsx` (modified) | Surfaces the new "cliente ativo" fields (conditionally, only relevant once `status_acompanhamento = 'ganho'`) + a "Histórico de visitas" section reading `visitas` | Existing component, new conditional section + a narrow `select()` read of `visitas` for that cliente |

## Recommended Project Structure

```
supabase/migrations/
├── 0013_agenda_do_vendedor_schema.sql   # NEW — clientes columns + enums,
│                                         #   tarefas.resumo, mover_card_funil
│                                         #   extension, historico trigger
│                                         #   replace (no cron, no new SECURITY
│                                         #   DEFINER — see Patterns 1 & 4)
├── 0014_agenda_do_vendedor_visitas.sql   # NEW — visitas table + RLS,
│                                         #   concluir_visita, concluir_tarefa_
│                                         #   prospeccao, agenda_do_vendedor,
│                                         #   visitas→historico trigger
app/
├── agenda/
│   └── page.tsx                          # NEW — Server Component, calls
│                                         #   agenda_do_vendedor() RPC
├── actions/
│   ├── agenda.ts                         # NEW — concluirVisita,
│   │                                     #   concluirTarefaProspeccao
│   └── clientes.ts                       # MODIFIED — atualizarClienteAtivo
│                                         #   (nome_fantasia, cnpj,
│                                         #   frequencia_pedidos) + pass
│                                         #   p_frequencia_visita through the
│                                         #   existing mover-card action
components/
├── agenda/
│   ├── AgendaList.tsx                    # NEW — renders the unified feed,
│   │                                     #   origem badge (prospecção/visita)
│   └── ConcluirItemDialog.tsx            # NEW — ONE shared dialog for both
│                                         #   origens (SEED: "conclusão +
│                                         #   resumo vale nas DUAS frentes")
├── clientes/
│   └── ClienteDetailSheet.tsx            # MODIFIED — campos "ativo" +
│                                         #   histórico de visitas
└── layout/
    └── AppSidebar.tsx                    # MODIFIED — novo item "Agenda"
lib/
└── validations/
    └── agenda.ts                         # NEW — zod: resumo, frequencia_
                                          #   visita/pedidos enums, next-date
                                          #   confirm
```

### Structure Rationale

- **`visitas` as a sibling table to `tarefas`, not an extension of it:** `tarefas.tipo_tarefa_id` FKs into the Supervisor-editable `tipos_tarefa` enum (Visitar, Mandar mensagem) — a prospecting-specific concept CRUD'd through the existing admin screens. Overloading `tarefas` with recurrence columns (`frequencia`, next-suggested-date) would leave those columns NULL for every prospecting row and force a discriminator anyway. A dedicated `visitas` table keeps Frente 1 (prospecção, `tarefas`, untouched) and Frente 2 (pós-venda, `visitas`, new) exactly as separate as the SEED's own "duas frentes" framing — and avoids touching the RLS/trigger wiring of a table already in production use.
- **Two migration files, not one:** `0013` (clientes/enums/`mover_card_funil`) has zero dependency on `visitas` existing yet and unblocks the "cliente ativo" field work independently; `0014` (`visitas` + the completion/agenda RPCs) is the piece the Agenda screen actually needs. Splitting them lets phase 4 (cliente-ativo fields) start without waiting on phase 3's write-flow RPCs — see Build Order below. (This split is a recommendation for the phase planner, not a hard requirement — a single combined migration is also acceptable if the roadmap prefers one phase for all schema work.)
- **`app/actions/agenda.ts` as a new file, not folded into `clientes.ts`:** matches the project's existing pattern of one actions file per domain concept (clientes vs. presumably a separate admin/equipe actions file) rather than one growing monolith.

## Architectural Patterns

### Pattern 1: Compute-and-store the next date at write time, never a background job

**What:** The "suggested next visit date" is never computed by a scheduled process. It is computed twice, in two different places, for two different purposes:
1. **Display-time suggestion** (before the vendor confirms): pure client-side date math (`date-fns` `addWeeks`/`addMonths` off the visit being completed), used only to pre-fill a date picker default.
2. **Persisted value** (after the vendor confirms or adjusts): written once, inside `concluir_visita`, as the `data_prevista` of the newly-INSERTed next `visitas` row.

**When to use:** Any "next occurrence" feature under the `CLAUDE.md`/Vercel-Hobby constraint of no persistent workers and no separate Node backend.
**Trade-offs:** No stale-until-a-cron-runs window (there's nothing to run) and no `pg_cron` extension to introduce/monitor for a feature the SEED explicitly wants to stay *human-confirmed*, not silently automated ("o vendedor confirma ou ajusta, não é 100% automático"). The only cost is that a `visitas` row must exist eagerly (created at ganho-time and at each completion) rather than being derived lazily — a non-issue at this data volume (hundreds of clientes).

**Example (inside `concluir_visita`):**
```sql
create or replace function concluir_visita(
  p_visita_id uuid,
  p_resumo text,
  p_proxima_data date default null
)
returns void
language plpgsql
as $$
declare
  v_cliente_id uuid;
begin
  update visitas
  set data_realizada = now(), resumo = p_resumo
  where id = p_visita_id
  returning cliente_id into v_cliente_id;

  if p_proxima_data is not null then
    insert into visitas (cliente_id, data_prevista, criado_por)
    values (v_cliente_id, p_proxima_data, (select auth.uid()));
  end if;
end;
$$;
```
No `security definer` — RLS on `visitas` (parent-gated to `clientes.responsavel`/`is_supervisor()`, mirroring `tarefas`) governs both the UPDATE and the INSERT transparently.

### Pattern 2: Unified feed via a SECURITY-INVOKER `stable sql` RPC, not a view or a client-side merge

**What:** `agenda_do_vendedor()` is a `language sql stable` function with **no** `security definer` clause — exactly the convention already established by `dashboard_funil_detalhado`/`dashboard_tempo_ate_fechamento` (0009) and `dashboard_comparativo_vendedor` (0011). It does a `UNION ALL` of open `tarefas` and pending `visitas`, each tagged with an `origem` column.

**When to use:** Any time two different RLS-scoped tables need to appear as one ordered, role-aware feed.
**Trade-offs vs. a plain view:** Supabase's Postgres does support `security_invoker = true` on views (PG15+), which would make a bare `create view` RLS-safe too — but this project has never used a view for aggregation, only `stable sql` functions, for every prior cross-table read (0003, 0009, 0011, 0012). Matching that precedent keeps the pattern uniform and testable the same way (`tests/dashboard/rls-*.test.ts` already prove this exact "no security definer ⇒ RLS auto-scopes" mechanism). A function also composes more naturally with future optional parameters (date range, include-completed toggle) than a bare view.
**Trade-offs vs. a client-side merge of two `supabase-js` queries:** a client merge would (a) duplicate the "is this item overdue" sort/highlight logic in TypeScript instead of once in SQL, (b) cost two round trips instead of one, and (c) contradicts `STACK.md`'s existing guidance to prefer server-side aggregation over client-side reduction to keep egress low. RLS already scopes each half of the union correctly with zero extra permission code either way — the only reason to prefer the RPC is efficiency and single-source-of-truth ordering, not safety.

**Example:**
```sql
create or replace function agenda_do_vendedor()
returns table (
  origem text, item_id uuid, cliente_id uuid, razao_social text,
  titulo text, data date, resumo text
)
language sql
stable
as $$
  select 'prospeccao', t.id, t.cliente_id, c.razao_social,
         tt.nome, t.data_conclusao, t.resumo
  from tarefas t
  join clientes c on c.id = t.cliente_id
  join tipos_tarefa tt on tt.id = t.tipo_tarefa_id
  where t.concluida = false
  union all
  select 'visita', v.id, v.cliente_id, c.razao_social,
         'Visita', v.data_prevista, v.resumo
  from visitas v
  join clientes c on c.id = v.cliente_id
  where v.data_realizada is null
  order by 6;
$$;
```

### Pattern 3: Resumo propagates into `historico` via the existing trigger convention, never a new SECURITY DEFINER RPC

**What:** The vendor-authored `resumo` is stored as a first-class nullable column directly on the row it belongs to (`tarefas.resumo`, `visitas.resumo`) and written by a plain (non-definer) RPC/Server Action, exactly like every other field update today. Propagation into `historico` happens the same way it already does for `etapa`/`status_acompanhamento`/task-completion: a `SECURITY DEFINER` **trigger** (not RPC) that fires on the UPDATE/INSERT and formats `descricao` from `NEW.resumo`.

**When to use:** Any time a user-authored value needs to land in the audit-log table (`historico`) that has no direct INSERT policy for authenticated users.
**Trade-offs:** This adds **zero new SECURITY DEFINER exceptions** to the project's documented list of three (`is_supervisor()`, `desativar_membro_equipe`/`reativar_membro_equipe`, `cidades_com_clientes_por_estado`) — it reuses the already-blessed "trigger writes historico" category that `clientes_after_update_historico` and `tarefas_before_update_historico` already established in 0002. The alternative — a new SECURITY DEFINER RPC that inserts into `historico` directly — would be a *fourth* exception needing its own justification for no real benefit, since the trigger pattern already solves it.
**Note on migration mechanics:** `tarefas_before_update_historico` cannot be edited in place (0002 is an already-applied migration — `CLAUDE.md`: never alter an applied migration). Instead, `0013`/`0014` issues `create or replace function tarefas_before_update_historico() ...` again, in a **new** file — the exact mechanic this codebase already used for `0010_fix_dashboard_funil_detalhado_avancou_pct.sql`.

**Example (trigger body, new file, same function name):**
```sql
create or replace function tarefas_before_update_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.concluida = false and new.concluida = true then
    new.concluida_em := now();
    insert into historico (cliente_id, tipo, descricao, autor_id)
    values (
      new.cliente_id, 'tarefa_concluida',
      coalesce('Tarefa concluída: ' || new.resumo, 'Tarefa marcada como concluída'),
      (select auth.uid())
    );
  end if;
  return new;
end;
$$;
```
A new sibling trigger `visitas_after_visita_concluida_historico` follows the identical shape for `visitas`.

### Pattern 4: `mover_card_funil` as the single atomic "start the cadence" moment

**What:** Extend the existing RPC (not a separate new action) with `p_frequencia_visita frequencia_visita_enum default null`, required exactly when `p_novo_status = 'ganho'` — mirroring the RPC's own existing `p_motivo_perda_id`-required-when-`perdido` check. On success it also seeds the first `visitas` row (`data_prevista` = today + the chosen cadence, or no row at all if `'nenhuma'`).

**When to use:** Whenever a status transition and a piece of data that only makes sense *because of* that transition should be captured together, atomically, in one call — exactly the precedent `motivo_perda_id` already set.
**Trade-offs:** Keeps "mark as ganho" a single vendor action (per SEED: "Ao marcar o card como ganho, o vendedor define a frequência de visita") instead of a two-step flow (move card, then separately remember to set a cadence) that could be skipped. Editing the cadence *later* (SEED: "editável/cancelável a qualquer momento") is a separate, ordinary `clientes` UPDATE — not routed through `mover_card_funil` again, since that RPC's purpose is specifically the funnel-stage transition.

## Data Flow

### Agenda read flow (Phase 2)

```
Vendor opens /agenda
    ↓
Server Component calls supabase.rpc('agenda_do_vendedor')
    ↓
RPC runs SECURITY INVOKER → RLS on tarefas/visitas/clientes scopes
  results to caller (own clientes, or all if supervisor) — zero app-level
  permission code
    ↓
AgendaList.tsx renders rows, origem badge (prospecção/visita),
  overdue highlight (data < today, same visual language as the kanban's
  existing "cards parados/atrasados" pattern — pure client-side date
  compare, no stored boolean)
```

### Completion + recorrência write flow (Phase 3)

```
Vendor clicks "Concluir" on an Agenda item
    ↓
ConcluirItemDialog opens (shared component, parameterized by origem)
    ↓ (origem = visita only)
Client computes a SUGGESTED next date: date-fns addWeeks/addMonths off
  today, using clientes.frequencia_visita already loaded with the item —
  pure display-time math, no DB round trip
    ↓
Vendor writes resumo, confirms or edits the suggested date, submits
    ↓
Server Action → RPC (concluir_visita or concluir_tarefa_prospeccao)
    ↓
RPC closes the current row (resumo + realizada/concluida) and — visita
  only — INSERTs the next pending row with the CONFIRMED date
    ↓
SECURITY DEFINER trigger fires on that UPDATE, writes one historico row
  embedding the resumo (Pattern 3)
    ↓
Client detail screen's "Histórico de visitas" section and the Agenda
  both reflect the change on next read — no cache invalidation beyond
  Next.js's normal revalidation, no realtime needed for MVP scope
```

### Key Data Flows

1. **Ganho → cadence starts:** `mover_card_funil(..., p_novo_status='ganho', p_frequencia_visita=...)` is the single moment a cadence is born; the very first `visitas` row is a side effect of that call, not a separate step.
2. **Recorrência self-perpetuates without a scheduler:** each `concluir_visita` call both closes the current occurrence *and* seeds the next one — the chain of pending visits never needs a background process to "catch up," because there is always at most one pending row per cliente, created at the moment the previous one closes.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (single sales team, hundreds of clientes) | Exactly as designed above — one pending `visitas` row per active cliente at a time, `UNION ALL` over two small tables, no indexing concerns beyond the two new indexes below |
| If prospecção volume grows a lot (thousands of open `tarefas`) | `agenda_do_vendedor()` already filters to `concluida = false` / `data_realizada is null` before the union, so the RPC's working set stays proportional to *open* items, not total history — no change needed |
| If "notificações ativas" (explicitly out of scope today) is ever revisited | That is the point where a real background job becomes necessary (to check overdue items and push a notification) — at that point, and only then, is `pg_cron` (available on Supabase, including free tier, since it runs inside Postgres itself, not Vercel) worth introducing. Not needed for this milestone's human-confirms-the-date UX |

### Scaling Priorities

1. **First bottleneck (theoretical, not expected this milestone):** `agenda_do_vendedor()` doing an unindexed scan of `visitas`/`tarefas` per cliente — mitigated by the two new indexes below (`idx_visitas_cliente_id`, and reusing the existing `idx_tarefas_cliente_id`), same as every prior migration in this project.
2. **Not a concern at this scale:** `historico` growth from the new trigger — it's already an append-only table today and the dashboard queries (0009/0011) already read it at the current row count without issue; two new `tipo` values don't change that.

## Anti-Patterns

### Anti-Pattern 1: Introducing `pg_cron` (or any scheduler) to "recompute" next-visit dates

**What people do:** Reach for a scheduled job to periodically scan for clients whose next visit is "due" and generate the next occurrence.
**Why it's wrong:** Unnecessary here — the SEED explicitly wants a human-confirmed date, not a silently-generated one ("não é 100% automático/silencioso"), and PROJECT.md explicitly puts active notifications out of scope for this milestone. A scheduler would be new operational surface (a job to monitor, a failure mode to handle) for a feature that Pattern 1 already solves for free at write time.
**Do this instead:** Compute-and-store at write time (Pattern 1) — the chain of pending visits self-perpetuates through `concluir_visita`, never needs "catching up."

### Anti-Pattern 2: Adding a fourth `SECURITY DEFINER` RPC to write the resumo into `historico`

**What people do:** Write a new RPC that does `insert into historico (...)` directly, marked `security definer` so it can bypass `historico`'s no-insert policy.
**Why it's wrong:** This project has exactly three documented, deliberately-scoped `SECURITY DEFINER` exceptions, each with a specific reason RLS/triggers couldn't cover it (Auth Admin API access, or a narrow city-name-only leak). Writing user-authored free text into `historico` is *not* one of those cases — the existing trigger mechanism (`SECURITY DEFINER` **trigger**, not RPC) already does this for `etapa`/`status_acompanhamento`/task-completion, and extending it costs nothing new.
**Do this instead:** Pattern 3 — store `resumo` on the row itself via an ordinary RLS-governed UPDATE, let the (extended) existing trigger cascade it into `historico`.

### Anti-Pattern 3: Overloading `tarefas` with recurrence columns instead of a new `visitas` table

**What people do:** Add `frequencia`, `data_prevista`, `cliente_ativo_only` style columns directly to `tarefas` to "avoid a new table."
**Why it's wrong:** Conflates two genuinely different domain concepts (a one-off prospecting to-do vs. a recurring post-sale cadence) inside one table, leaves the new columns NULL for the majority of rows (every prospecting task), and forces a discriminator column anyway — all the cost of a new table with none of the clarity.
**Do this instead:** A sibling `visitas` table (Structure Rationale above), unified only at the query layer (`agenda_do_vendedor`), never at the storage layer.

### Anti-Pattern 4: Client-side merging the two Agenda queries

**What people do:** Fetch `tarefas` and `visitas` separately with `supabase-js` and merge/sort them in a `useEffect` or render function.
**Why it's wrong:** Duplicates sort/overdue logic across two code paths, costs an extra round trip, and works against `STACK.md`'s existing "prefer server-side aggregation, keep egress low" guidance — with no safety benefit, since RLS already scopes both halves correctly either way.
**Do this instead:** Pattern 2 — one `stable sql` RPC, one round trip, one ordered result.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| None new | — | This feature is fully internal to the existing Postgres/RLS boundary; no new external API, no new Vercel/Supabase service tier needed |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `clientes` ↔ `visitas` | FK (`visitas.cliente_id → clientes.id`, `on delete cascade`, mirroring `tarefas`) | `visitas` has no RLS of its own beyond the same parent-gated EXISTS pattern already proven for `tarefas`/`cliente_produtos` in 0002 |
| `mover_card_funil` ↔ `visitas` | Same-transaction side effect (RPC body INSERTs the first `visitas` row) | Keeps "ganho + set cadence" atomic; no eventual-consistency window |
| `tarefas`/`visitas` ↔ `historico` | One-way, trigger-only (`SECURITY DEFINER`), never a direct user INSERT | Preserves the existing "historico is an append-only, trigger-populated audit log" invariant unchanged |
| `agenda_do_vendedor` ↔ `tarefas`/`visitas`/`clientes` | Read-only `UNION ALL`, SECURITY INVOKER | RLS on the three underlying tables is the entire authorization mechanism — no app-level role check inside the function |

## Sources

- `supabase/migrations/0001`–`0012` (this repo) — actual current schema, RLS policies, and the three documented `SECURITY DEFINER` precedents. Confidence: HIGH (primary source, the code itself).
- `.claude/skills/Supabase-conventions/SKILL.md` — RLS → RPC → Edge Function decision order for this project. Confidence: HIGH (project-authored convention doc).
- `.planning/seeds/SEED-001-agenda-do-vendedor.md` — original domain capture for this milestone (duas frentes, recorrência, conclusão+resumo, campos de cliente ativo). Confidence: HIGH (primary source, verbatim discovery notes).
- `.planning/PROJECT.md` — Key Decisions log (soft-delete pattern, `mover_card_funil` non-definer precedent, out-of-scope notifications) used to justify Anti-Pattern 1 and Pattern 4. Confidence: HIGH.
- WebSearch: "recurring task next-occurrence date calculation without cron job serverless Postgres app-generated suggestion pattern" — confirms compute-and-store-at-write-time and PL/pgSQL date-interval math as standard, cron-free approaches; also surfaced RRULE-extension options, deliberately not chosen here (over-engineered for a 4-value enum cadence). Confidence: LOW (general web synthesis, cross-checked against this project's own precedent instead of relied on alone).
- WebSearch: "Postgres view UNION ALL combine two tables into single unified feed with row level security discriminator column" — confirms RLS does not apply to views directly (needs PG15+ `security_invoker = true` on the view, or a SECURITY-INVOKER function) — used to justify choosing the RPC pattern already proven in this codebase over introducing a bare view. Confidence: LOW-MEDIUM (cross-checked against official `postgresql.org`/`supabase.com` doc links surfaced in the same search, not fetched directly).

---
*Architecture research for: Agenda do Vendedor (recurring post-sale visit system) — CRM Raiar v1.3*
*Researched: 2026-08-07*
