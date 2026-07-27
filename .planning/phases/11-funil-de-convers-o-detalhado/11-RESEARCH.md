# Phase 11: Funil de Conversão Detalhado - Research

**Researched:** 2026-07-27
**Domain:** Postgres/Supabase SQL aggregation over event-sourced history (window functions, RLS-scoped read-only RPCs)
**Confidence:** MEDIUM — the schema facts and existing patterns are directly verified from the live codebase; the new SQL design is a from-scratch synthesis (no prior art in this codebase reconstructs "time in state" from an audit-log table), so treat the exact query shapes as a strong, testable starting draft rather than copy-paste-final SQL.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Formato da visualização**
- **D-01:** Tabela (uma linha por etapa), não gráfico de funil. Colunas: quantidade de clientes, % avançou, perdidos (número e %), tempo médio parado. Essa tabela é uma seção NOVA, adicional ao gráfico simples "clientes por etapa" já existente no dashboard (`ClientesPorEtapaChart`) — não substitui nada.

**Cálculo do "% que avançou"**
- **D-02:** O percentual inclui quem ainda está parado na etapa: dos clientes que já passaram por ela (incluindo os parados nela agora), quantos % já avançaram para a próxima. Quem está parado conta como "ainda não avançou" no denominador do cálculo — não é excluído.

**Destaque de gargalo**
- **D-03:** A tabela destaca visualmente (cor de alerta) etapas cujo tempo médio parado está bem acima da média das outras etapas do funil — cálculo relativo/comparativo entre as 7 etapas, não um número fixo de dias. Mesmo espírito do destaque que já existe para cards individuais parados no kanban, mas aplicado à etapa inteira.

### Claude's Discretion
- Exata fórmula estatística do "bem acima da média" (ex: quanto acima da média das demais etapas conta como gargalo — desvio padrão, múltiplo da média, etc.) — decisão técnica de threshold, não precisa voltar ao usuário.
- Estrutura exata da(s) RPC(s) Postgres para os cálculos (uma RPC por métrica, ou uma RPC única que devolve tudo) — seguir o padrão não-security-definer já estabelecido em `0003_dashboard_aggregates.sql`.
- Como reconstruir "tempo parado por etapa" e "dias até ganho/perdido" a partir das linhas de `historico` (não existe coluna dedicada de "duração por etapa" — só `clientes.etapa_alterada_em`, que rastreia apenas a etapa atual, não o histórico completo).

### Deferred Ideas (OUT OF SCOPE)
Nenhuma — discussão ficou dentro do escopo da fase. Filtro de período no funil detalhado está explicitamente fora do escopo deste marco (`.planning/PROJECT.md` Out of Scope / `.planning/REQUIREMENTS.md`).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FNL-01 | Dashboard mostra um funil de conversão detalhado por etapa: quantidade de clientes, % que avançou pra próxima etapa, quantos foram perdidos naquela etapa (contagem e taxa), e tempo médio parado na etapa (incluindo clientes que ainda estão parados agora) | Single RPC `dashboard_funil_detalhado()` (see Architecture Patterns / Code Examples) reconstructs stage-visit intervals from `historico` + `clientes.criado_em`, computes all four columns plus the D-03 gargalo flag in one pass |
| FNL-02 | Dashboard mostra a média de dias entre entrada no funil e "ganho", separada da média de dias até "perdido" | Second RPC `dashboard_tempo_ate_fechamento()` — direct extension of the already-proven `dashboard_ganhos_perdidos` dedup pattern (0003 migration), swapping `count(*)` for `avg(dias)` |
| FNL-03 | O funil detalhado segue a mesma regra de visibilidade do Dashboard atual (vendedor só o próprio, supervisor tudo) | Both new RPCs follow the established `language sql stable` + **no** `security definer` convention — RLS on `clientes`/`historico` scopes results automatically, zero new permission code, proven by extending `tests/dashboard/rls-dashboard.test.ts`'s existing pattern |
</phase_requirements>

## Summary

This phase is pure Postgres/SQL work plus one new read-only dashboard section — no new npm packages, no new tables, no new RLS policies, no new auth logic. The entire technical challenge is reconstructing "how long did each client spend in each funnel stage" and "which stage were they in when they were lost" from an append-only audit log (`historico`) that only records **changes**, not durations.

Two facts about the existing schema make this tractable:

1. **Every `clientes` row is born in `aguardando_contato`** via the column default (`app/actions/clientes.ts`'s own comment confirms no code path sets an initial `etapa` explicitly), and `historico` triggers only fire on `UPDATE`, never `INSERT` [VERIFIED: codebase — supabase/migrations/0002_clientes_and_funil.sql, app/actions/clientes.ts]. So `clientes.criado_em` is always the entry timestamp into stage 1, and every subsequent stage entry is a `historico` row with `tipo='etapa'`.
2. **`etapa_funil` is a Postgres enum declared in exact funnel order** [VERIFIED: codebase — supabase/migrations/0002_clientes_and_funil.sql lines 28-36], and Postgres enum comparison operators (`<`, `>`, `max()`, etc.) follow declaration order by design [VERIFIED: postgresql.org/docs/current/datatype-enum.html]. This means "has this client ever advanced past stage N" can be computed with a plain `>` comparison on the enum column — no manual ordinal-index mapping needed.

Building on these two facts, one CTE chain reconstructs a "stage visit" table (`cliente_id, etapa, entrada, saida`) using `LEAD()` over `historico` rows unioned with the synthetic first entry from `clientes.criado_em`. That single reconstruction feeds every number FNL-01 asks for — current count, ever-entered count, advanced count, lost count, and average dwell time — and the **same COALESCE pattern** (`próxima etapa → evento de fechamento → now()`) is the answer to the phase's central technical question: a client's "exit" from a stage is the next stage-entry if they advanced, the ganho/perdido event timestamp if they closed out while still there, or `now()` only if they are still genuinely active and stuck (per the locked ROADMAP rule).

Both new functions must be `language sql stable` with **no** `security definer` clause, mirroring every function in `0003_dashboard_aggregates.sql` exactly — this is what makes FNL-03 free: RLS on `clientes` and `historico` already restricts a Vendedor's call to their own rows with zero manual role-check code.

**Primary recommendation:** One RPC (`dashboard_funil_detalhado()`, no arguments) returns 7 rows (one per `etapa_funil` value, always present even at 0) covering FNL-01 in full, including the D-03 bottleneck flag computed in the same query. A second RPC (`dashboard_tempo_ate_fechamento()`, no arguments) returns 2 rows (ganho/perdido) covering FNL-02, reusing the exact dedup CTE already proven in `dashboard_ganhos_perdidos`. Both plug into `DashboardClient.tsx` as a new section below `ClientesPorEtapaChart`, using the existing shadcn `Table` primitive (already installed, no new dependency) instead of a new chart.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stage-visit duration reconstruction (LAG/LEAD over `historico`) | Database / Storage (Postgres `stable` SQL function) | — | Set-based window-function math over rows that already live in Postgres; doing this client-side would require pulling the *entire* `historico` table to the browser, breaking the "narrow `select()`, low egress" convention already established in `0003`'s header comment and `.claude/CLAUDE.md`'s Stack Patterns |
| % avançou / perdidos / tempo médio aggregation | Database / Storage (same RPC) | — | Same reasoning — aggregation belongs in the RPC, not in `lib/supabase/queries/dashboard.ts` |
| Role-based visibility (vendedor vs supervisor) | Database / Storage (RLS on `clientes`/`historico`) | — | Already the project's sole authorization boundary (`CLAUDE.md`: "nenhuma lógica de permissão feita à mão"); the new RPCs inherit it for free by staying `SECURITY INVOKER` |
| Bottleneck (gargalo) highlight computation | Database / Storage (same RPC, boolean column) | Frontend Server / Client (styling only) | Keeping the threshold math in SQL means the UI just reads a boolean and applies a CSS class — no duplicate logic, no risk of UI and RPC disagreeing on which stage is a bottleneck |
| Table rendering, loading/error/empty states | Frontend (Client Component) | — | Matches `ClientesPorEtapaChart`'s established fetch-on-mount + Server Action pattern; this is a "new card" in `DashboardClient.tsx`, not a schema or auth concern |
| Server Action wrapper (`{data}\|{error}` union) | Frontend Server (Next.js Server Action) | — | Thin pass-through per `app/actions/dashboard.ts`'s existing convention — no business logic lives here |

## Standard Stack

### Core
No new libraries. This phase is additive SQL + one new component built entirely from already-installed dependencies.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL (via Supabase) | already provisioned | Window functions (`LEAD`), enum comparison, CTEs for the duration reconstruction | Already the project's only backend datastore; per `supabase-conventions` skill, business-rule calculations that only depend on data already in Postgres belong in a PL/pgSQL or `language sql` function, never an Edge Function |
| shadcn/ui `Table` | already installed (`components/ui/table.tsx` exists in repo) [VERIFIED: codebase] | Renders the new per-etapa table (D-01) | D-01 explicitly calls for a table, not a chart — no need to touch Recharts/`ChartContainer` for this section |

### Supporting
None needed — no new date-math library required beyond what a Postgres `interval`/`extract(epoch from ...)` already gives; `date-fns` (already a dependency) is only needed client-side if the table renders a "X dias" label from a raw day-count number, which is a plain `Math.round()`/string format, not a `date-fns` call.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQL `stable` function reconstructing history via `LEAD()` | A dedicated `etapa_historico_intervalos` materialized view, refreshed periodically | Adds a new object to maintain and a staleness window; at this app's data volume (hundreds of clientes, free-tier Postgres) a live `stable` function recomputing on every dashboard load is fast enough and always current — no cache invalidation to reason about |
| SQL `stable` function | A new `clientes_etapa_historico` table populated by triggers going forward (start tracking durations natively from now on) | Would under-count every client that already exists today (no retroactive backfill possible without doing the exact same `historico` reconstruction anyway) — reconstructing from `historico` is strictly more correct and requires no migration/backfill |
| Postgres enum `>` comparison for "advanced past stage N" | A `case when etapa = 'x' then 1 when etapa = 'y' then 2 ... end` manual ordinal mapping | Enum ordering already encodes the funnel order by declaration (verified via official Postgres docs) — a manual CASE duplicates that mapping and silently drifts if a stage is ever inserted (e.g., `ALTER TYPE ... ADD VALUE`) without updating the CASE |

**Installation:** None — no `npm install` needed for this phase.

**Version verification:** Not applicable (no new packages).

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** No `npm view` / registry checks were needed. All work is new SQL (migration file) plus a new React component built from primitives already present in the repo (`components/ui/table.tsx`, existing shadcn `Card`).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ historico (append-only audit log)                                │
│  tipo='etapa'              -> "Etapa alterada para \"X\""        │
│  tipo='status_acompanhamento' -> "Status alterado para \"X\""    │
│  (written ONLY by SECURITY DEFINER triggers on clientes UPDATE)  │
└───────────────────────────┬───────────────────────────────────────┘
                            │  RLS: readable only via parent-cliente gate
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ clientes (criado_em = entry into stage 1, current etapa/status)  │
└───────────────────────────┬───────────────────────────────────────┘
                            │  UNION (synthetic "entered aguardando_contato
                            │  at criado_em" row) + historico 'etapa' rows
                            ▼
              ┌───────────────────────────────┐
              │ stage_events (per cliente_id)   │  entrada timestamps, in order
              └───────────────┬─────────────────┘
                              │ LEAD(entrada) OVER (PARTITION BY cliente_id
                              │                     ORDER BY entrada)
                              ▼
              ┌───────────────────────────────┐
              │ stage_visits (+ proxima_entrada)│
              └───────────────┬─────────────────┘
                              │ saida = COALESCE(proxima_entrada,
                              │           fechamento_evento.criado_em,  now())
                              ▼
              ┌───────────────────────────────┐
              │ duracoes (cliente_id, etapa,    │──▶ avg(saida-entrada) per etapa
              │           entrada, saida)        │──▶ perdidos-per-etapa (interval
              └───────────────┬─────────────────┘    containing the loss event)
                              │
                              │ + maior_etapa (max(etapa) per cliente,
                              │   using enum ordering) -> avançou/alcançou counts
                              ▼
              ┌────────────────────────────────────────┐
              │ dashboard_funil_detalhado()  (RPC, invoker, no args)  │
              │   -> 7 rows: etapa, quantidade, avancou_pct,          │
              │      perdidos_count/pct, tempo_medio_dias, gargalo    │
              └───────────────┬────────────────────────────────────────┘
                              │ .rpc() via typed wrapper
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ lib/supabase/queries/dashboard.ts  -> app/actions/dashboard.ts     │
│ (typed reader)                        ({data}|{error} Server Action)│
└───────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ components/dashboard/FunilDetalhadoTable.tsx  (new, Client Component)│
│   + components/dashboard/TempoAteFechamentoCards.tsx (new, FNL-02)   │
│   plugged into DashboardClient.tsx below ClientesPorEtapaChart       │
└─────────────────────────────────────────────────────────────────┘

(dashboard_tempo_ate_fechamento() is a parallel, simpler branch off the
 same historico table — it reuses only the "ultimo_fechamento" dedup CTE
 already proven in dashboard_ganhos_perdidos, not the stage-visit chain.)
```

### Recommended Project Structure
```
supabase/migrations/
└── 0009_dashboard_funil_detalhado.sql   # NEW migration — verify this number
                                          # against the actual next-free number
                                          # at execution time (Phase 10's
                                          # 0008 must land first if run
                                          # sequentially; parallel worktrees
                                          # can collide, see STATE.md's
                                          # existing note on this)

lib/supabase/queries/
└── dashboard.ts                          # ADD getFunilDetalhado(),
                                           # getTempoAteFechamento() readers,
                                           # same file, same conventions

app/actions/
└── dashboard.ts                          # ADD getFunilDetalhadoAction(),
                                           # getTempoAteFechamentoAction()

components/dashboard/
├── FunilDetalhadoTable.tsx                # NEW — D-01 table + D-03 highlight
├── TempoAteFechamentoCards.tsx            # NEW — FNL-02, 2 small stat cards
└── DashboardClient.tsx                    # EDIT — mount both below
                                            # ClientesPorEtapaChart

tests/dashboard/
└── funil-detalhado.test.ts                # NEW — RPC behavior + RLS proof
```

### Pattern 1: Synthetic first-entry row + `LEAD()` for stage-visit reconstruction
**What:** Union a synthetic "(cliente_id, 'aguardando_contato', criado_em)" row per cliente with every `historico` row where `tipo='etapa'` (extracting the target stage from `descricao` via `substring(descricao from '"(.*)"')::etapa_funil`), then use `LEAD(entrada) OVER (PARTITION BY cliente_id ORDER BY entrada)` to get each visit's `proxima_entrada`.
**When to use:** Any time "how long was X in state Y" must be derived from an event log that only records transitions, not durations — this exact pattern is the one Phase 12 (Comparativo por Vendedor) is expected to reuse for "ciclo médio em dias" per `ROADMAP.md`'s stated dependency ("Fase 12 ... depende de ... Fase 11 (lógica de reconstrução de duração)").
**Example:**
```sql
-- Source: synthesized from supabase/migrations/0002_clientes_and_funil.sql
-- (historico schema, trigger-written descricao format) + PostgreSQL LEAD()
-- window function docs (postgresql.org/docs/current/tutorial-window.html)
with stage_events as (
  select c.id as cliente_id,
         'aguardando_contato'::etapa_funil as etapa,
         c.criado_em as entrada
  from clientes c                    -- RLS already scopes this to the caller
  union all
  select h.cliente_id,
         (substring(h.descricao from '"(.*)"'))::etapa_funil as etapa,
         h.criado_em as entrada
  from historico h                   -- RLS (parent-cliente gate) already
  where h.tipo = 'etapa'              -- scopes this too — no extra join needed
),
stage_visits as (
  select cliente_id, etapa, entrada,
         lead(entrada) over (partition by cliente_id order by entrada) as proxima_entrada
  from stage_events
)
select * from stage_visits;
```

### Pattern 2: Enum-native "highest stage reached" instead of a manual ordinal map
**What:** `max(etapa)` (or a plain `>` comparison) on the `etapa_funil` column directly, relying on Postgres's declaration-order enum semantics.
**When to use:** Any "has this client advanced past stage N" check — the D-02 "% avançou" numerator.
**Example:**
```sql
-- Source: PostgreSQL enum ordering — verified official docs
-- https://www.postgresql.org/docs/current/datatype-enum.html
-- ("the order the values were listed ... All comparisons ... work
--   according to that ordering")
select cliente_id, max(etapa) as etapa_max
from stage_events
group by cliente_id;

-- "advanced past stage N" for every stage in one pass:
select eb.etapa, count(*) as avancou_count
from unnest(enum_range(null::etapa_funil)) as eb(etapa)
join (select cliente_id, max(etapa) as etapa_max from stage_events group by cliente_id) m
  on m.etapa_max > eb.etapa
group by eb.etapa;
```

### Pattern 3: Three-way COALESCE for "exit time" (the phase's central technical question)
**What:** A stage visit's exit timestamp is whichever comes first, in this priority order: (1) the next real stage entry, if the client advanced; (2) the ganho/perdido closing event's timestamp, if the client was marked closed while still in that visit; (3) `now()`, only as the final fallback for a client still genuinely active (`em_andamento`) and stuck.
**When to use:** This is the exact mechanism the phase's ROADMAP-locked rule ("tempo médio por etapa inclui clientes ainda parados, usando `now()` como saída provisória — de propósito") requires, while avoiding the mistake of also inflating a *closed* (ganho/perdido) client's dwell time with dead time after closure.
**Example:**
```sql
-- Source: synthesized — no direct precedent in this codebase; mirrors the
-- dedup CTE already proven in dashboard_ganhos_perdidos (0003 migration)
-- for identifying "the" ganho/perdido event per cliente.
with status_events as (
  select h.cliente_id,
         substring(h.descricao from '"(.*)"') as status_evento,
         h.criado_em
  from historico h
  where h.tipo = 'status_acompanhamento'
    and (h.descricao ilike '%"ganho"%' or h.descricao ilike '%"perdido"%')
),
ultimo_fechamento as (
  select distinct on (s.cliente_id)
    s.cliente_id, s.status_evento, s.criado_em
  from status_events s
  join clientes c on c.id = s.cliente_id     -- needed for the column below,
  where c.status_acompanhamento::text = s.status_evento  -- not just RLS
  order by s.cliente_id, s.criado_em desc
)
select
  v.cliente_id, v.etapa, v.entrada,
  coalesce(v.proxima_entrada, f.criado_em, now()) as saida
from stage_visits v
left join ultimo_fechamento f
  on f.cliente_id = v.cliente_id and v.proxima_entrada is null;
  -- the `and v.proxima_entrada is null` guard means f is only consulted
  -- for each cliente's LAST (still-open) visit — earlier visits always
  -- use their real proxima_entrada, never the closing event.
```

### Anti-Patterns to Avoid
- **Re-deriving stage order with a hand-written CASE/ordinal map:** the enum already encodes it (Pattern 2) — a manual map is a second source of truth that can silently drift.
- **Using `clientes.etapa_alterada_em` for anything in this phase:** it only tracks the *current* stage's start, not history — already flagged as a known gap in `0003`'s own comments and explicitly named in this phase's central technical question. Every duration calculation must go through `historico` + `criado_em`, never this column.
- **Marking either new RPC `security definer`:** would silently bypass RLS and leak every vendedor's data to every caller (FNL-03 violation) with no error — exactly the failure mode `tests/dashboard/rls-dashboard.test.ts` exists to catch for the other five functions; the same test file must be extended, not bypassed.
- **Adding a period-filter parameter "just in case":** explicitly out of scope for this milestone (`PROJECT.md` Out of Scope table) — both new RPCs should take zero arguments, matching `dashboard_clientes_por_etapa()`'s "always a live/whole-history snapshot" shape, not the `p_inicio`/`p_fim` shape used by the period-filtered metrics.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Time spent in each state" from a change log | A client-side loop over fetched `historico` rows computing diffs in JavaScript | The `LEAD()`/COALESCE SQL pattern above, run inside the `stable` RPC | Pulling all `historico` rows to the browser to compute this client-side means shipping unbounded rows over the wire (violates the project's "narrow select(), low egress" convention) and re-implementing window-function logic in JS with none of Postgres's set-based correctness guarantees |
| "Stage order" comparison | A TypeScript `ETAPA_KEYS.indexOf(a) > ETAPA_KEYS.indexOf(b)` re-implemented in SQL as a CASE statement | Direct enum `>`/`max()` comparison (Pattern 2) | Postgres already gives you this in the type system — building a parallel ordinal map risks drifting from `lib/funil/etapas.ts`'s canonical order if either is edited without the other |
| Bottleneck/outlier threshold math | A hand-picked fixed "> 5 dias = gargalo" constant | A relative multiple of the other stages' average (D-03 requires *relative*, not fixed) | CONTEXT.md explicitly locks this as comparative, not an absolute day count — a fixed threshold would violate D-03 outright, not just be a worse implementation |

**Key insight:** Everything this phase needs is expressible as one SQL query per RPC over data that's already in Postgres. The temptation to reach for a helper library, a cron job, or a denormalized tracking table should be resisted — none of those are needed at this data volume, and all three would be new moving parts the non-technical owner would have to reason about later.

## Common Pitfalls

### Pitfall 1: Forgetting the synthetic "stage 1 entry" row
**What goes wrong:** If the CTE only reads from `historico` (`tipo='etapa'`), every client's *first* visit (aguardando_contato) is invisible — their entry timestamp into that stage never appears anywhere, because the trigger that writes `historico` only fires on `UPDATE`, never on the initial `INSERT`.
**Why it happens:** It's natural to think "the history table has everything" — but `clientes.criado_em` + the column default is the *only* record of entry into the first stage.
**How to avoid:** Always `UNION ALL` a synthetic row `(c.id, 'aguardando_contato', c.criado_em)` from `clientes` before computing `LEAD()`.
**Warning signs:** `quantidade`/`alcançou` count for `aguardando_contato` comes out lower than the total client count, or the average dwell time for `aguardando_contato` is suspiciously `NULL` for clients who never moved.

### Pitfall 2: Using `now()` as exit time for clients who are already closed
**What goes wrong:** A client marked `perdido` while sitting in stage 3, and never touched again, would show an ever-growing "tempo parado" in stage 3 if `saida` naively defaults to `now()` for every visit with no `proxima_entrada` — inflating the average with dead time that has nothing to do with active funnel friction.
**Why it happens:** The ROADMAP rule ("usa `now()` como saída provisória") is written for clients who are `em_andamento` and genuinely stuck — it's easy to over-apply it to every open-ended visit, including closed ones.
**How to avoid:** The COALESCE chain must check the ganho/perdido closing event *before* falling back to `now()` (Pattern 3) — `now()` is the last resort, not the default.
**Warning signs:** Average dwell time for early/mid stages keeps growing every time the dashboard is reloaded, even for stages with no active clients left in them.

### Pitfall 3: Treating `historico.descricao` string-matching as fragile
**What goes wrong:** Copying the `ilike '%"ganho"%'` two-way pattern from `dashboard_ganhos_perdidos` to a 7-way `etapa_funil` extraction via a chain of `ilike` checks would be verbose and error-prone (7 branches to keep in sync with the enum).
**Why it happens:** `0003`'s existing code uses `ilike` because it only ever needed to distinguish 2 possible values (ganho/perdido) inline in a CASE. Copy-pasting that shape for 7 values is a natural but suboptimal instinct.
**How to avoid:** Use `substring(descricao from '"(.*)"')` to directly extract the quoted value written by `format('Etapa alterada para "%s"', new.etapa::text)` (and the analogous status format string), then cast to the target type. Confirmed both trigger functions in `0002_clientes_and_funil.sql` always produce exactly one quoted segment per row [VERIFIED: codebase].
**Warning signs:** A new funnel stage name that happens to be a substring of another stage's name would silently misattribute rows under the `ilike` approach — the `substring(... from '"(.*)"')` approach has no such risk since it extracts the exact value, not a pattern match.

### Pitfall 4: Redundant `join clientes` "for RLS" that isn't actually needed
**What goes wrong:** Copying `0003`'s `join clientes c on c.id = ...  -- RLS on clientes applies here` comment onto every CTE, even ones that don't need any column from `clientes`, adds needless joins.
**Why it happens:** `historico` already has its own RLS SELECT policy gated on the parent `clientes` row (`acesso a historico gated pelo cliente pai (select)`, defined in `0002_clientes_and_funil.sql`) — a bare `select ... from historico h` is *already* scoped to the caller's visible clientes without any explicit join.
**How to avoid:** Only join `clientes` when a CTE genuinely needs one of its columns (e.g., `c.status_acompanhamento` for the closing-event dedup cross-check, or `c.criado_em` for FNL-02's day-count). Every `stage_events`/`maior_etapa`-style CTE that reads `historico` directly is already RLS-correct with zero join.
**Warning signs:** None functionally (extra joins here are harmless correctness-wise, just avoidable complexity) — flagged for code-review cleanliness, not a bug.

### Pitfall 5: Ambiguity in what "quantidade" means in the D-01 table
**What goes wrong:** D-01 locks the column list ("quantidade de clientes, % avançou, perdidos, tempo médio") but CONTEXT.md does not disambiguate whether "quantidade" means the *current* live count in that stage (same semantics as the existing `ClientesPorEtapaChart`) or the *historical total that ever passed through* that stage (the natural funnel-drop-off denominator that `% avançou`/`perdidos %` would logically be percentages OF).
**Why it happens:** The two numbers coincide for a linear, forward-only, never-revisited funnel with no losses — they only diverge once any client has advanced past, or been lost at, a stage. Since this is genuinely a new "conversion funnel" table (distinct from the existing live snapshot chart), the historical/ever-entered interpretation is recommended: it makes `% avançou + % perdido + % ainda parado` sum to ~100% per row, which is a strong self-consistency property worth keeping and testing.
**How to avoid:** Recommend building `quantidade` = the "ever entered this stage" count (same denominator that already powers `% avançou`/`perdidos %`) rather than a fresh live-count column that would just duplicate `ClientesPorEtapaChart`. Flagged in Assumptions Log below — worth a quick sanity confirmation during `/gsd-ui-phase` or plan review, since it changes what the leftmost column visually communicates.
**Warning signs:** If built as a live count instead, the leftmost column would show *decreasing-then-jumping-around* numbers that don't visually funnel downward, undermining the "detailed conversion funnel" framing the phase is named for.

### Pitfall 6: Migration file numbering collision across phases planned/executed in parallel
**What goes wrong:** Phase 10's plan already claims `supabase/migrations/0008_desativacao_membro_equipe.sql`. If Phase 11 is planned/executed before Phase 10's migration actually lands (or in a parallel worktree), hard-coding `0009_...` in this phase's plan could collide with a migration Phase 10 lands later, or vice versa.
**Why it happens:** `STATE.md` already documents this exact class of problem for parallel worktrees in this project.
**How to avoid:** The implementing plan must check `ls supabase/migrations/` immediately before naming the new file, not trust a number written into a plan ahead of time.
**Warning signs:** `supabase db push` reporting a migration conflict, or two files with the same numeric prefix in git status.

## Code Examples

### Full `dashboard_funil_detalhado()` RPC (FNL-01 + D-02 + D-03)
```sql
-- Source: synthesized from supabase/migrations/0002_clientes_and_funil.sql
-- (schema/trigger formats) + 0003_dashboard_aggregates.sql (SECURITY INVOKER
-- convention, dedup CTE precedent) + PostgreSQL enum/window-function docs.
-- Confidence: MEDIUM — the pieces are individually verified; the composed
-- query has not been executed against live data in this research pass and
-- should be proven by tests/dashboard/funil-detalhado.test.ts before ship.
create or replace function dashboard_funil_detalhado()
returns table (
  etapa etapa_funil,
  quantidade bigint,
  avancou_count bigint,
  avancou_pct numeric,
  perdidos_count bigint,
  perdidos_pct numeric,
  tempo_medio_dias numeric,
  gargalo boolean
)
language sql
stable
as $$
  with stage_events as (
    select c.id as cliente_id,
           'aguardando_contato'::etapa_funil as etapa,
           c.criado_em as entrada
    from clientes c
    union all
    select h.cliente_id,
           (substring(h.descricao from '"(.*)"'))::etapa_funil,
           h.criado_em
    from historico h
    where h.tipo = 'etapa'
  ),
  stage_visits as (
    select cliente_id, etapa, entrada,
           lead(entrada) over (partition by cliente_id order by entrada) as proxima_entrada
    from stage_events
  ),
  status_events as (
    select h.cliente_id,
           substring(h.descricao from '"(.*)"') as status_evento,
           h.criado_em
    from historico h
    where h.tipo = 'status_acompanhamento'
      and (h.descricao ilike '%"ganho"%' or h.descricao ilike '%"perdido"%')
  ),
  ultimo_fechamento as (
    select distinct on (s.cliente_id) s.cliente_id, s.status_evento, s.criado_em
    from status_events s
    join clientes c on c.id = s.cliente_id
    where c.status_acompanhamento::text = s.status_evento
    order by s.cliente_id, s.criado_em desc
  ),
  duracoes as (
    select
      v.cliente_id, v.etapa, v.entrada,
      coalesce(v.proxima_entrada, f.criado_em, now()) as saida
    from stage_visits v
    left join ultimo_fechamento f
      on f.cliente_id = v.cliente_id and v.proxima_entrada is null
  ),
  maior_etapa as (
    select cliente_id, max(etapa) as etapa_max
    from stage_events
    group by cliente_id
  ),
  etapas_base as (
    select unnest(enum_range(null::etapa_funil)) as etapa
  ),
  quantidade_atual as (
    select etapa, count(*) as total from clientes group by etapa
  ),
  alcancados as (
    select etapa, count(distinct cliente_id) as total
    from stage_events
    group by etapa
  ),
  avancados as (
    select eb.etapa, count(*) as total
    from etapas_base eb
    join maior_etapa m on m.etapa_max > eb.etapa
    group by eb.etapa
  ),
  perdidos_por_etapa as (
    select d.etapa, count(*) as total
    from duracoes d
    join ultimo_fechamento f
      on f.cliente_id = d.cliente_id
     and f.status_evento = 'perdido'
     and f.criado_em >= d.entrada
     and f.criado_em <= d.saida
    group by d.etapa
  ),
  tempo_medio as (
    select etapa,
           round((avg(extract(epoch from (saida - entrada))) / 86400.0)::numeric, 1) as dias
    from duracoes
    group by etapa
  ),
  resumo as (
    select
      eb.etapa,
      coalesce(al.total, 0) as quantidade,          -- see Pitfall 5: "ever entered" basis
      coalesce(av.total, 0) as avancou_count,
      case when coalesce(al.total, 0) = 0 then null
           else round(100.0 * coalesce(av.total, 0) / al.total, 1) end as avancou_pct,
      coalesce(pp.total, 0) as perdidos_count,
      case when coalesce(al.total, 0) = 0 then null
           else round(100.0 * coalesce(pp.total, 0) / al.total, 1) end as perdidos_pct,
      tm.dias as tempo_medio_dias
    from etapas_base eb
    left join alcancados al on al.etapa = eb.etapa
    left join avancados av on av.etapa = eb.etapa
    left join perdidos_por_etapa pp on pp.etapa = eb.etapa
    left join tempo_medio tm on tm.etapa = eb.etapa
    left join quantidade_atual qa on qa.etapa = eb.etapa  -- available if the
                                                            -- planner instead
                                                            -- prefers qa.total
                                                            -- for "quantidade"
  ),
  media_outras as (
    select r1.etapa,
           (select avg(r2.tempo_medio_dias) from resumo r2
             where r2.etapa <> r1.etapa and r2.tempo_medio_dias is not null) as media
    from resumo r1
  )
  select
    r.etapa, r.quantidade, r.avancou_count, r.avancou_pct,
    r.perdidos_count, r.perdidos_pct, r.tempo_medio_dias,
    coalesce(
      r.tempo_medio_dias is not null
      and mo.media is not null and mo.media > 0
      and r.tempo_medio_dias > mo.media * 1.5,
      false
    ) as gargalo
  from resumo r
  join media_outras mo on mo.etapa = r.etapa
  order by r.etapa;
$$;
```

### `dashboard_tempo_ate_fechamento()` RPC (FNL-02)
```sql
-- Source: direct extension of dashboard_ganhos_perdidos's proven dedup CTE
-- (supabase/migrations/0003_dashboard_aggregates.sql) — swaps count(*) for
-- avg(day-diff). No period parameters (out of scope for this milestone).
create or replace function dashboard_tempo_ate_fechamento()
returns table(status text, media_dias numeric)
language sql
stable
as $$
  with ultimo_status_change as (
    select distinct on (h.cliente_id)
      h.cliente_id, h.criado_em,
      case
        when h.descricao ilike '%"ganho"%' then 'ganho'
        when h.descricao ilike '%"perdido"%' then 'perdido'
      end as status_evento
    from historico h
    where h.tipo = 'status_acompanhamento'
      and (h.descricao ilike '%"ganho"%' or h.descricao ilike '%"perdido"%')
    order by h.cliente_id, h.criado_em desc
  )
  select
    u.status_evento as status,
    round((avg(extract(epoch from (u.criado_em - c.criado_em))) / 86400.0)::numeric, 1) as media_dias
  from ultimo_status_change u
  join clientes c on c.id = u.cliente_id  -- needs c.criado_em, also RLS-scoped
  where c.status_acompanhamento::text = u.status_evento
  group by u.status_evento;
$$;
```

### Typed reader + Server Action (mirrors existing file conventions exactly)
```typescript
// Source: pattern lifted verbatim from lib/supabase/queries/dashboard.ts /
// app/actions/dashboard.ts's existing five functions — no new shape needed.
export type FunilDetalhadoRow = {
  etapa: EtapaKey
  quantidade: number
  avancouCount: number
  avancouPct: number | null
  perdidosCount: number
  perdidosPct: number | null
  tempoMedioDias: number | null
  gargalo: boolean
}

export async function getFunilDetalhado(): Promise<FunilDetalhadoRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_funil_detalhado")
  if (error) {
    throw new Error(`Falha ao carregar funil detalhado: ${error.message}`)
  }
  return (data ?? []).map((row) => ({
    etapa: row.etapa,
    quantidade: Number(row.quantidade),
    avancouCount: Number(row.avancou_count),
    avancouPct: row.avancou_pct === null ? null : Number(row.avancou_pct),
    perdidosCount: Number(row.perdidos_count),
    perdidosPct: row.perdidos_pct === null ? null : Number(row.perdidos_pct),
    tempoMedioDias:
      row.tempo_medio_dias === null ? null : Number(row.tempo_medio_dias),
    gargalo: row.gargalo,
  }))
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A | N/A | — | This is a novel calculation for this codebase, not a replacement of an older approach — no prior "funil detalhado" existed before this phase |

**Deprecated/outdated:** None applicable to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "quantidade" in the D-01 table means the historical "ever entered this stage" count, not the current live count already shown by `ClientesPorEtapaChart` | Pitfall 5 / Code Examples | Low-medium — if the user actually wanted the live count, the fix is a one-line change (`qa.total` instead of `al.total` in the `resumo` CTE, already wired as an available join in the draft query), not a redesign |
| A2 | A client marked `perdido`/`ganho` never has further `etapa` moves afterward (no CHECK constraint enforces this) | Pattern 3 / Pitfall 2 | Low — if it does happen, the "perdidos_por_etapa" interval-containment join still correctly attributes the loss to the stage active at that moment; only a rare double-counting edge in `avancados`/`alcancados` for stage-moves that happen *after* the loss event would be slightly off, affecting a handful of rows at most |
| A3 | 1.5× the average of the other 6 stages is an appropriate "gargalo" threshold multiplier | D-03 / Code Examples | Low — this is explicitly Claude's discretion per CONTEXT.md, a single numeric literal in one `case`/`coalesce` expression, trivially tunable after the owner sees the table live and judges whether the right stages get flagged |
| A4 | Backward drag (moving a card to an *earlier* stage) is technically possible today (no CHECK constraint or UI guard prevents it, confirmed via `components/clientes/KanbanBoard.tsx`'s `handleDragEnd`) but is not a normal/expected sales workflow | Pitfall 2 / stage_visits design | Low — the reconstruction already handles revisits correctly (each visit is counted independently via `LEAD()`), so this assumption only affects how *surprising* the resulting numbers might look if backward moves turn out to be common in practice, not correctness |

## Open Questions

1. **Does "quantidade" mean live count or historical ever-entered count?**
   - What we know: CONTEXT.md locks the column list but not this semantic; the historical interpretation gives a self-consistent, funnel-shaped table (Pitfall 5).
   - What's unclear: Whether the project owner pictures this column literally duplicating the existing "clientes por etapa" chart's numbers.
   - Recommendation: Build the historical/ever-entered version (draft query already does this); the live-count alternative is a one-column swap if a UI review surfaces a mismatch with the owner's mental model. Worth flagging explicitly during `/gsd-ui-phase` (UI-SPEC review) rather than assuming silently.

2. **Should Phase 12's "ciclo médio em dias" reuse `dashboard_tempo_ate_fechamento()` directly, or a `responsavel`-parameterized variant?**
   - What we know: `ROADMAP.md` states Phase 12 depends on this phase's duration-reconstruction logic.
   - What's unclear: Phase 12 groups by vendedor (like `dashboard_desempenho_vendedor` groups the ganho/perdido dedup CTE by `responsavel`); this phase's RPC returns an ungrouped 2-row result.
   - Recommendation: No action needed now — flag for Phase 12's own research/planning that the `ultimo_fechamento`-style dedup CTE here is the reusable building block, parameterizable by adding a `group by c.responsavel` the same way `dashboard_desempenho_vendedor` already does relative to `dashboard_ganhos_perdidos`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 [VERIFIED: codebase — package.json] |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/dashboard/funil-detalhado.test.ts` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FNL-01 | `dashboard_funil_detalhado()` returns 7 rows (every etapa, even 0-count), with `avancou_pct`/`perdidos_pct` computed against the "ever entered" denominator | integration (real Supabase RPC call) | `npx vitest run tests/dashboard/funil-detalhado.test.ts -t "quantidade"` | ❌ Wave 0 |
| FNL-01 | A client still `em_andamento` and never advanced counts as NOT advanced, using `now()` as provisional exit for dwell-time averaging | integration | `npx vitest run tests/dashboard/funil-detalhado.test.ts -t "ainda parado"` | ❌ Wave 0 |
| FNL-01 | A client marked `perdido` while in stage N is attributed to stage N's `perdidos_count`, and does NOT keep accruing dwell time toward `now()` after the loss event | integration | `npx vitest run tests/dashboard/funil-detalhado.test.ts -t "perdido"` | ❌ Wave 0 |
| FNL-01 (D-03) | A stage with an artificially long average dwell time (relative to the other 6) is flagged `gargalo = true`; a normal stage is not | integration | `npx vitest run tests/dashboard/funil-detalhado.test.ts -t "gargalo"` | ❌ Wave 0 |
| FNL-02 | `dashboard_tempo_ate_fechamento()` returns separate `ganho`/`perdido` averages, each computed from `clientes.criado_em` to the respective closing event | integration | `npx vitest run tests/dashboard/funil-detalhado.test.ts -t "fechamento"` | ❌ Wave 0 |
| FNL-03 | Vendedor B's calls to both new RPCs never reflect Vendedor A's clientes; Supervisor's calls see everyone | integration (RLS negative case) | `npx vitest run tests/dashboard/rls-dashboard.test.ts` (extend existing file) | ⚠️ extend existing file, don't create new |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/dashboard/funil-detalhado.test.ts`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/dashboard/funil-detalhado.test.ts` — new file, covers FNL-01/FNL-02 behavior (quantidade/avançou/perdidos/tempo-médio/gargalo/fechamento cases above)
- [ ] Extend `tests/dashboard/rls-dashboard.test.ts` — add both new RPC names to its existing cross-vendedor + supervisor-sees-all assertions (FNL-03), following its established pattern exactly rather than a new file
- Framework install: none — Vitest, `serviceClient()`/`signInAs()` test helpers, and `SEED_ACCOUNTS` already exist and are directly reusable

*(No component-render test gap: no existing `tests/dashboard/*.test.tsx` precedent exists for the chart/card components either — this phase's UI testing posture matches the rest of the dashboard, which relies on the human-verify checkpoint + RLS-level integration tests rather than component render tests.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | No new auth surface — both RPCs require an authenticated Supabase session, same as every existing dashboard RPC |
| V3 Session Management | no | No change |
| V4 Access Control | yes | Row Level Security on `clientes`/`historico`, enforced by keeping both new functions `SECURITY INVOKER` (no `security definer` clause) — the sole control, per project convention |
| V5 Input Validation | no | Both RPCs take **zero** parameters (no period filter, out of scope) — nothing for a caller to inject or manipulate |
| V6 Cryptography | no | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| A future edit accidentally adds `security definer` to either new RPC (or to a copy-pasted variant in Phase 12) | Elevation of Privilege / Information Disclosure | Never add `security definer` to a `dashboard_*` function; extend `tests/dashboard/rls-dashboard.test.ts`'s existing cross-vendedor assertions to cover both new RPC names so this class of regression fails a test immediately, exactly as it already does for the five existing functions |
| SQL injection via the `descricao` string-extraction regex | Tampering | Not exploitable here — `descricao` is never user-supplied at query time; it's written only by the `SECURITY DEFINER` triggers in `0002_clientes_and_funil.sql` using `format()` with a controlled enum cast, and the new RPCs take no external parameters to inject through |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/0002_clientes_and_funil.sql` — `historico` schema, trigger-written `descricao` formats, `etapa_funil` enum declaration order, RLS policies, `chk_ganho_somente_etapa_final`/`chk_perdido_exige_motivo` constraints
- `supabase/migrations/0003_dashboard_aggregates.sql` — proven `SECURITY INVOKER` convention, the `ganho`/`perdido` dedup CTE pattern reused for FNL-02, existing index coverage (`idx_historico_tipo_criado`, `idx_clientes_criado_em`)
- `lib/funil/etapas.ts`, `app/actions/clientes.ts` — confirms every cliente starts in `aguardando_contato` via DB default, no code path sets an explicit initial etapa
- `components/clientes/KanbanBoard.tsx` (`handleDragEnd`) — confirms backward stage drags are not blocked at the UI/RPC level today (Assumption A4)
- `lib/supabase/queries/dashboard.ts`, `app/actions/dashboard.ts`, `components/dashboard/ClientesPorEtapaChart.tsx`, `components/dashboard/DashboardClient.tsx`, `tests/dashboard/rls-dashboard.test.ts`, `tests/dashboard/ganhos-perdidos.test.ts` — established typed-reader / Server Action / component / RLS-test conventions this phase must extend, not reinvent
- [PostgreSQL 8.7. Enumerated Types](https://www.postgresql.org/docs/current/datatype-enum.html) — official confirmation that enum comparison operators follow declaration order, the load-bearing fact behind Pattern 2

### Secondary (MEDIUM confidence)
- None beyond the primary codebase/official-docs sources above — no web-search-only claims were needed for this phase's core design.

### Tertiary (LOW confidence)
- The exact composed SQL in Code Examples is a from-scratch synthesis (no existing precedent in this codebase reconstructs durations from an audit log) — individually-verified building blocks, but the full query has not been executed against live data in this research pass. Flagged throughout as needing proof via the Wave 0 test file before being considered final.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — genuinely no new dependencies, every primitive already exists in the repo
- Architecture: MEDIUM — the reconstruction strategy is grounded in verified schema facts and an official Postgres semantic, but the composed multi-CTE query is new and untested against live data
- Pitfalls: MEDIUM-HIGH — Pitfalls 1-4 and 6 are directly derived from verified codebase facts (trigger behavior, existing RLS policies, existing migration numbering conflict pattern); Pitfall 5 (quantidade semantics) is a genuine ambiguity flagged rather than resolved with certainty

**Research date:** 2026-07-27
**Valid until:** 30 days (stable domain — Postgres/Supabase schema semantics don't shift quickly; re-verify sooner only if Phase 10's migration numbering or `historico` schema changes before this phase executes)
