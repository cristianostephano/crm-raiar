# Phase 12: Comparativo por Vendedor - Research

**Researched:** 2026-08-03
**Domain:** Supabase Postgres RPC aggregation (SQL) + Next.js Server Component/Client Component dashboard table, reusing three already-established project patterns (dashboard RPC convention, `taxaConversao()`, `FunilDetalhadoTable`'s table UI shape)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase Boundary:** O Dashboard ganha uma tabela nova, visível só para o Supervisor, comparando os vendedores ativos lado a lado: taxa de conversão, negócios iniciados, negócios ganhos, e ciclo médio em dias. Vendedores desativados não aparecem na lista de comparação, mas seus números históricos (clientes ganhos/perdidos já atribuídos a eles) continuam intactos e contando normalmente nos totais gerais do sistema — só a lista de "quem aparece na tabela" é filtrada por `ativo = true`.

- **D-01 (Base de "negócios iniciados"):** Conta todos os clientes que já foram atribuídos a esse vendedor desde sempre (histórico completo), não só os do período filtrado.
- **D-02 (Janela de tempo da tabela):** A tabela inteira (todas as 4 métricas) mostra o histórico completo, sem filtro de período — mesma decisão já tomada na Fase 11 para o funil detalhado e a média de dias até ganho/perdido. Não segue o filtro de período que o gráfico "Desempenho por vendedor" (já existente) usa hoje — este é um comportamento NOVO e diferente do gráfico existente, e ambos continuam coexistindo (o gráfico existente não é alterado por esta fase).
- **D-03 (Fórmula de "taxa de conversão"):** `ganhos / (ganhos + perdidos)` — mede eficácia de fechamento entre negócios já decididos, ignorando os que ainda estão em andamento. Mesma fórmula já usada em `lib/dashboard/periodo.ts`'s `taxaConversao()` para os cards de Ganhos/Perdidos existentes — reaproveitar essa função, não reinventar.

### Claude's Discretion
- Ordem das linhas na tabela (alfabético por nome, ou por desempenho) — decisão de UX sem impacto funcional, delegada ao UI-SPEC.
- Nome e assinatura exata da nova RPC (uma RPC nova dedicada, ou extensão de `dashboard_desempenho_vendedor()` existente) — decisão técnica, ver Canonical References.
- Exata forma de filtrar vendedores ativos na lista (LEFT JOIN + WHERE `ativo = true` na lista de linhas, mantendo a agregação histórica completa de `clientes`/`historico` sem truncar por essa condição) — já mapeado em pesquisa preliminar, não precisa voltar ao usuário.

### Deferred Ideas (OUT OF SCOPE)
Nenhuma — discussão ficou dentro do escopo da fase. Nenhum todo pendente encontrado para esta fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VEND-01 | Dashboard mostra uma tabela comparando os vendedores ativos (taxa de conversão, negócios iniciados, negócios ganhos, ciclo médio em dias), visível só para o Supervisor | New `dashboard_comparativo_vendedor()` RPC (Code Examples) delivers all four metrics from a single query; `ComparativoVendedorTable.tsx` (Architecture Pattern 4) delivers the Supervisor-only UI gate mirroring `DesempenhoVendedorChart`; `taxaConversao()` reuse (D-03) delivers the conversion-rate column without duplicating the formula; `vendedores_ativos` CTE (Pattern 2) delivers the `ativo = true` row-list filter without touching historical totals elsewhere |
</phase_requirements>

## Summary

This phase adds exactly one new artifact class: a new `language sql stable` Postgres function (no new table, no new npm package, no new UI primitive). Every structural decision it needs has already been made and proven twice in this codebase — `dashboard_desempenho_vendedor()` (0003) established "group dashboard aggregates by `responsavel`," `dashboard_funil_detalhado()` / `dashboard_tempo_ate_fechamento()` (0009/0010) established "reconstruct a per-cliente duration from `historico`'s append-only change log, dedup the latest ganho/perdido event with `distinct on`," and `FunilDetalhadoTable.tsx` established the exact whole-history, Supervisor-agnostic-at-the-SQL-layer table shape this phase's new component should mirror (with the addition of the `isSupervisor` UI-only gate `DesempenhoVendedorChart.tsx` already uses). No new research territory exists here — this is applying proven local patterns a third time, with one new twist (filtering the row list by `profiles.ativo`) that CONTEXT.md has already pre-mapped in its Canonical References.

The one genuinely new mechanic is that `profiles` has an **open, unconditional SELECT RLS policy for every authenticated user** (`0001_profiles_and_roles.sql`, `using (true)`) — unlike `clientes`/`historico`, which are per-vendedor-scoped. This means the new RPC's vendedor-listing half (`profiles` filtered to `role='vendedor' and ativo=true`) is **never** narrowed by the caller's own role, while its aggregation half (`clientes`/`historico`) **is** narrowed by RLS exactly like every other dashboard RPC. This is not a new leak to introduce — `profiles.role`/`.ativo`/`.nome` are already fully readable by any authenticated Vendedor today (confirmed by `lib/equipe/membros.ts` and `dashboard_desempenho_vendedor()`'s own `left join profiles p on p.id = c.responsavel` with no role check) — it just needs to be understood and documented so nobody attempts to "fix" it with an unnecessary role guard inside the RPC.

**Primary recommendation:** Add one new migration file `supabase/migrations/0011_dashboard_comparativo_vendedor.sql` defining `dashboard_comparativo_vendedor()` — `language sql stable`, no arguments, `SECURITY INVOKER` by omission (no `security definer`) — returning one row per active Vendedor with `negocios_iniciados`, `ganho`, `perdido`, and `ciclo_medio_dias` (ganho-only basis, see Open Questions). Compute `taxa_conversao` client-side from `ganho`/`perdido` via the existing `taxaConversao()` in `lib/dashboard/periodo.ts` — never in SQL. Add a new `ComparativoVendedorTable.tsx` Client Component mirroring `FunilDetalhadoTable.tsx`'s fetch/loading/error/empty shape, gated by `isSupervisor` the same way `DesempenhoVendedorChart.tsx` is gated, and place it in `DashboardClient.tsx` next to the other whole-history (non-período) components (`FunilDetalhadoTable`/`TempoAteFechamentoCards`), not next to the período-filtered KPI row.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vendedor comparison aggregation (counts, ciclo médio) | Database (Postgres RPC) | — | Same convention as every other `dashboard_*` function — aggregation must happen in Postgres, not by fetching raw rows to the client (`CLAUDE.md`: "Compute aggregates with Postgres views or RPC functions... not client-side reduction," keeps egress low against the free-tier cap) |
| Active-vendedor row filtering (`ativo = true`) | Database (Postgres RPC, inside the `vendedores_ativos` CTE) | — | Must happen in the SQL that builds the row LIST, never as a post-fetch client-side `.filter()` — the RPC is already the single source of truth for what to display, and doing it in SQL means one code path instead of two |
| Taxa de conversão calculation | Frontend Server Action / query layer (TypeScript) | — | D-03 explicitly locks reuse of the existing `taxaConversao()` pure function — this is deliberately NOT computed in SQL, to avoid a second implementation of the same formula ever drifting from the first |
| Supervisor-only visibility gate | Frontend (Server Component `isSupervisor` prop) | RLS (backstop, not primary) | Matches `DesempenhoVendedorChart`'s established precedent exactly: the RPC has zero role check of its own (same as every other dashboard RPC); RLS on `clientes`/`historico` is what prevents a Vendedor from harvesting other vendedores' real numbers even if they called the RPC directly, but `profiles`' own open SELECT policy means the vendedor ROSTER itself is visible to any authenticated user regardless of this gate (documented above, not a new hole) |
| Table rendering (loading/error/empty/formatting) | Browser / Client Component | — | Matches `FunilDetalhadoTable.tsx`'s `"use client"` + `useEffect` fetch-on-mount + `FetchState` union pattern exactly — no Server Component data-fetching needed here since every other dashboard section already uses this Client-Component-owns-its-fetch shape |

## Standard Stack

No new packages. This phase is 100% additive SQL (one migration) plus TypeScript/React using libraries already installed and version-pinned in `package.json` (`@supabase/supabase-js` for `.rpc()`, `date-fns`/`Intl.NumberFormat` for formatting, shadcn/ui `Table`/`Card`/`Skeleton`/`Tooltip` primitives already vendored into `components/ui/`). No `npm install` step belongs in this phase's plan.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.110.5 (already installed) | `.rpc("dashboard_comparativo_vendedor")` typed call | Same call shape as every other function in `lib/supabase/queries/dashboard.ts` |

### Supporting
No new supporting libraries — reuses `lib/dashboard/periodo.ts`'s `taxaConversao()`, and the shadcn `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableCell`/`Card`/`Skeleton`/`Tooltip` primitives already vendored in `components/ui/` (same set `FunilDetalhadoTable.tsx` already imports).

### Alternatives Considered
Not applicable — no library decision exists in this phase; the only design choices are SQL shape and component structure, both of which have a locked, proven local precedent (see Code Examples).

**Installation:** None required.

## Package Legitimacy Audit

Not applicable — this phase installs zero external packages. Skipped per the protocol's own scope ("Required whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
Supervisor's browser
      │
      │ 1. mounts ComparativoVendedorTable (only when isSupervisor === true,
      │    passed down from app/(app)/page.tsx → DashboardClient)
      ▼
useEffect fetch-on-mount
      │
      ▼
getComparativoVendedorAction()          <- app/actions/dashboard.ts (Server Action)
      │   - checks supabase.auth.getUser(); returns {error:"unauthenticated"} if none
      ▼
getComparativoVendedor()                <- lib/supabase/queries/dashboard.ts (typed .rpc() wrapper)
      │   - calls supabase.rpc("dashboard_comparativo_vendedor")
      │   - maps bigint-as-string PostgREST rows -> Number(), computes taxaConversao() per row
      ▼
dashboard_comparativo_vendedor()        <- Postgres RPC, SECURITY INVOKER (no security definer)
      │
      ├─ vendedores_ativos CTE  ← profiles (role='vendedor', ativo=true)   [profiles: OPEN select RLS,
      │                                                                     not scoped by caller's role]
      │
      ├─ ultimo_status_change CTE ← historico (dedup latest ganho/perdido event per cliente,
      │                                          same distinct-on pattern as 0003/0009)
      │
      ├─ fechamentos CTE  ← clientes JOIN ultimo_status_change            [clientes/historico: RLS-scoped
      │                                                                     by responsavel per caller]
      │
      └─ agregados CTE  ← clientes LEFT JOIN fechamentos, GROUP BY responsavel
             (negocios_iniciados = count(*), ganho/perdido = count(*) filter,
              ciclo_medio_dias = avg(epoch diff) filter (ganho only) / 86400)
      │
      ▼
LEFT JOIN vendedores_ativos ⟕ agregados  (every active vendedor gets a row even with 0 clientes)
      │
      ▼
returns one row per active vendedor → back up through the stack → rendered as a Table row
```

### Recommended Project Structure
No new directories. New files land in the same locations as every prior dashboard addition:
```
supabase/migrations/
└── 0011_dashboard_comparativo_vendedor.sql   # NEW — the RPC (only new file at the DB layer)
lib/supabase/queries/
└── dashboard.ts                               # EDIT — add ComparativoVendedorRow type + getComparativoVendedor()
app/actions/
└── dashboard.ts                               # EDIT — add getComparativoVendedorAction()
components/dashboard/
├── ComparativoVendedorTable.tsx                # NEW — mirrors FunilDetalhadoTable.tsx's shape
└── DashboardClient.tsx                         # EDIT — mount new component, isSupervisor-gated
tests/dashboard/
├── rls-dashboard.test.ts                       # EDIT — extend the existing before/after array
└── comparativo-vendedor.test.ts                # NEW — dedicated fixture-based behavior test
```

### Pattern 1: SECURITY INVOKER dashboard RPC (project-wide convention, do not deviate)
**What:** Every `dashboard_*` function is `language sql stable` with **no** `security definer` clause. RLS on `clientes`/`historico` is the entire authorization mechanism — the function body itself contains zero role checks.
**When to use:** Always, for this phase's new RPC. This is the single most load-bearing convention in the codebase for dashboard code — `0003_dashboard_aggregates.sql`'s own header comment states it applies project-wide, and `tests/dashboard/rls-dashboard.test.ts` fails loudly the moment it's violated.
**Example:**
```sql
-- Source: supabase/migrations/0003_dashboard_aggregates.sql (existing convention, verbatim header)
-- SECURITY INVOKER by omission — every function below deliberately has NO
-- "security definer" clause... a Vendedor's call only ever aggregates their
-- own clientes rows, a Supervisor's call aggregates every vendedor's rows.
-- NEVER add "security definer" here: it would silently bypass RLS.
create or replace function dashboard_comparativo_vendedor()
returns table(
  responsavel uuid,
  responsavel_nome text,
  negocios_iniciados bigint,
  ganho bigint,
  perdido bigint,
  ciclo_medio_dias numeric
)
language sql
stable
as $$ ... $$;
-- No `security definer` — do not add one.
```

### Pattern 2: Vendedor row-list filter, separate from historical aggregation (D-01/D-02/CONTEXT.md discretion, already pre-mapped)
**What:** The list of ROWS to display comes from a `profiles`-only CTE filtered by `ativo = true`. The historical counts (`negocios_iniciados`/`ganho`/`perdido`/`ciclo_medio_dias`) come from a completely separate aggregation over `clientes`/`historico`, joined to that row list AFTER both are computed independently. The `ativo = true` filter must appear exactly once, only inside the `vendedores_ativos` CTE — never inside the `agregados` CTE's `WHERE`/`JOIN` conditions.
**When to use:** This is the exact mechanism that satisfies "vendedores desativados não aparecem na lista, mas seus números históricos continuam intactos nos totais gerais" (Phase Boundary) — a deactivated vendedor's own clientes rows are untouched and still contribute to whatever OTHER RPC or aggregate references them (nothing in this phase touches those), they just never appear as a row in THIS particular RPC's result set because they never enter `vendedores_ativos`.
**Example:**
```sql
-- Source: supabase/migrations/0008_desativacao_membro_equipe.sql (profiles.ativo semantics)
--         + this phase's own CONTEXT.md "Claude's Discretion" bullet 3
with vendedores_ativos as (
  select
    p.id,
    trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as nome
  from profiles p
  where p.role = 'vendedor' and p.ativo = true
),
-- ... agregados CTE below has NO ativo filter anywhere — it aggregates
-- clientes.responsavel unconditionally, then is LEFT JOINed onto the
-- filtered vendedores_ativos list. A deactivated vendedor's clientes rows
-- still exist in `clientes` and are still counted by `dashboard_ganhos_perdidos`,
-- `dashboard_funil_detalhado`, etc. — those RPCs are untouched by this phase.
select v.id as responsavel, v.nome as responsavel_nome, ...
from vendedores_ativos v
left join agregados a on a.responsavel = v.id
order by v.nome;
```

### Pattern 3: Latest-status-change dedup (reused verbatim shape, 3rd application in this codebase)
**What:** `historico` only records CHANGES (an append-only trigger-written log), never a final state directly. Every dashboard RPC that needs "is this cliente currently ganho or perdido" reconstructs it via `distinct on (cliente_id) ... order by criado_em desc`, then cross-checks against `clientes.status_acompanhamento` to guard against a cliente that flipped status more than once (e.g., `perdido -> em_andamento -> ganho`).
**When to use:** Any time this phase's new RPC needs to know a cliente's ganho/perdido outcome or the timestamp it happened — do not invent a new way to derive this; copy the CTE verbatim from `0003`/`0009`.
**Example:**
```sql
-- Source: supabase/migrations/0003_dashboard_aggregates.sql (dashboard_ganhos_perdidos,
--         identical CTE also used by dashboard_desempenho_vendedor and
--         dashboard_tempo_ate_fechamento — copy exactly, do not modify the regex/ilike logic)
with ultimo_status_change as (
  select distinct on (h.cliente_id)
    h.cliente_id,
    h.criado_em,
    case
      when h.descricao ilike '%"ganho"%' then 'ganho'
      when h.descricao ilike '%"perdido"%' then 'perdido'
    end as status_evento
  from historico h
  where h.tipo = 'status_acompanhamento'
    and (h.descricao ilike '%"ganho"%' or h.descricao ilike '%"perdido"%')
  order by h.cliente_id, h.criado_em desc
)
```

### Pattern 4: Supervisor-only gate is UI-layer only, never SQL (established twice already)
**What:** `DesempenhoVendedorChart` takes no role prop, performs no role check — `DashboardClient.tsx` wraps it in `{isSupervisor ? <DesempenhoVendedorChart .../> : null}`. The RPC itself needs zero guard because RLS already prevents a Vendedor from ever seeing another vendedor's aggregated numbers even if the component somehow rendered for them.
**When to use:** For the new `ComparativoVendedorTable` — same `{isSupervisor ? <ComparativoVendedorTable /> : null}` wrapper in `DashboardClient.tsx`, placed next to `FunilDetalhadoTable`/`TempoAteFechamentoCards` (the whole-history, no-período group), NOT next to `DesempenhoVendedorChart` itself (that one still takes `inicio`/`fim` — a period-filtered chart — while this phase's new table takes zero arguments, per D-02).
**Example:**
```tsx
// Source: components/dashboard/DashboardClient.tsx (existing lines 76-91, pattern to extend)
<FunilDetalhadoTable />
<TempoAteFechamentoCards />
{isSupervisor ? <ComparativoVendedorTable /> : null}
{/* KPI row (período-filtered) and DesempenhoVendedorChart (période-filtered,
    Supervisor-only) continue below, unchanged by this phase */}
```

### Anti-Patterns to Avoid
- **Recomputing `taxaConversao` in SQL:** D-03 locks reuse of `lib/dashboard/periodo.ts`'s `taxaConversao(ganho, perdido)`. Returning a pre-computed percentage column from the RPC would create a second implementation of "ganho/(ganho+perdido), null when both are 0" that could silently drift from the first. Return raw `ganho`/`perdido` counts and compute the ratio in TypeScript.
- **Filtering `clientes`/`historico` by the assigned vendedor's `ativo` status:** Would silently and incorrectly shrink `dashboard_ganhos_perdidos`'s or any other RPC's company-wide totals the moment a vendedor is deactivated — those RPCs are not touched by this phase and must keep counting every cliente regardless of the current `responsavel`'s `ativo` flag (EQP-04's existing guarantee).
- **Adding a `security definer` clause "just to be safe":** Every dashboard RPC that has ever needed one (only `is_supervisor()`, `desativar_membro_equipe`, `reativar_membro_equipe` — all in `0001`/`0008`, none of them `dashboard_*` functions) needed it because `profiles` has zero write policies for regular users. This new function only ever SELECTs, has no such need, and adding `security definer` here would bypass RLS on `clientes`/`historico` and leak every vendedor's real numbers to every caller regardless of role — the exact regression `tests/dashboard/rls-dashboard.test.ts` exists to catch.
- **A second, hand-rolled `ativo` filter added defensively inside the `clientes` aggregation CTE ("just in case"):** Redundant and actively wrong — it would silently start excluding a deactivated vendedor's historical clientes from the JOIN (rather than just from the row list), contradicting the Phase Boundary's explicit "seus números históricos continuam intactos."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Conversion rate math (division-by-zero-safe) | A second `ganho / (ganho + perdido)` calculation inline in the new component or in SQL | `taxaConversao()` from `lib/dashboard/periodo.ts` (already returns `null`, never `NaN`, when both counts are 0) |
| "Latest ganho/perdido event per cliente" reconstruction | A new CTE with different regex/dedup logic | Copy the `ultimo_status_change` CTE verbatim from `0003_dashboard_aggregates.sql` / `0009_dashboard_funil_detalhado.sql` |
| Active/inactive vendedor filtering | A client-side `.filter(m => m.ativo)` over a fetched list | Filter inside the RPC's `vendedores_ativos` CTE — keeps this table's row list authoritative in one place, matching `CLAUDE.md`'s "compute aggregates in Postgres, not client-side" rule |
| Table loading/error/empty/retry UI | A bespoke new state machine | Copy `FunilDetalhadoTable.tsx`'s `FetchState` union + `useEffect`-with-`cancelled`-guard + `reloadKey` retry pattern exactly |

**Key insight:** Every piece this phase needs already exists somewhere in the codebase in a proven, tested form. The only genuinely new SQL is the `GROUP BY responsavel` + `ativo`-filtered-row-list combination, and even that combination is fully specified by CONTEXT.md's own Canonical References section — there is no remaining design ambiguity except the ciclo-médio basis (see Open Questions).

## Common Pitfalls

### Pitfall 1: `profiles`'s open SELECT policy means the vendedor roster is never role-scoped
**What goes wrong:** A reviewer might assume the RPC needs an internal `is_supervisor()`-style check because "a Vendedor shouldn't see other vendedores' names," and add one, breaking the "SECURITY INVOKER, zero role checks" convention for no real gain.
**Why it happens:** `profiles` (unlike `clientes`/`historico`) has `using (true)` for SELECT (`0001_profiles_and_roles.sql`) — every authenticated user, any role, can already read every profile's `nome`/`sobrenome`/`role`/`ativo`. This is pre-existing behavior (also relied on by `lib/equipe/membros.ts` and `dashboard_desempenho_vendedor()`'s own `left join profiles`), not something this phase introduces.
**How to avoid:** Do not add a role check to the new RPC. The UI-layer `isSupervisor` gate (Pattern 4) is the only guard needed, exactly like `DesempenhoVendedorChart`. If a Vendedor somehow calls this RPC directly, they'd see every active vendedor's NAME (already visible to them via `profiles` today) with ZERO counts for everyone but themselves (since `clientes`/`historico` stay RLS-scoped) — not a new information disclosure.
**Warning signs:** A `security definer` clause, or an `if not is_supervisor()` check, appearing in the new migration file.

### Pitfall 2: Confusing "who gets a row" with "whose historical data counts"
**What goes wrong:** Adding `and p.ativo = true` (or joining through `vendedores_ativos` before aggregating) anywhere inside the `clientes`/`historico` aggregation logic, rather than only in the final row-list CTE.
**Why it happens:** It looks like a natural place to "also" apply the filter, especially when copy-pasting the `LEFT JOIN` shape from `dashboard_desempenho_vendedor()`, which has no `ativo` concept at all today.
**How to avoid:** Build `vendedores_ativos` and the `clientes`/`historico` aggregation as two fully independent CTEs first; only `LEFT JOIN` them together in the final `SELECT`. Never let `ativo` leak into a `WHERE` clause that also touches `clientes`.
**Warning signs:** A deactivated fixture vendedor's `ganho`/`perdido` counts disappearing from this RPC's row (expected — they lose the row entirely) AND ALSO from `dashboard_ganhos_perdidos`'s company-wide total (NOT expected — this would be the bug).

### Pitfall 3: `avancou_pct`-style percentage math errors resurfacing
**What goes wrong:** `0009`/`0010`'s own history shows a real, live-observed bug where a percentage computed from two independently-derived counts could exceed 100% because the numerator and denominator weren't drawn from the same underlying row set.
**Why it happens:** Easy to compute `ganho`/`perdido` from one CTE and `negocios_iniciados` from a differently-scoped CTE, then have them disagree on which clientes are included (e.g., a cliente created after a vendedor's cutoff timestamp counted in one but not the other).
**How to avoid:** Derive `negocios_iniciados`, `ganho`, and `perdido` all from the SAME base `clientes` row set per `responsavel` (a single `GROUP BY c.responsavel` with `count(*) filter (...)` clauses), not three separately-scoped subqueries that are then joined — this guarantees `ganho + perdido <= negocios_iniciados` by construction, the same defensive principle `0010`'s fix applied to `avancados <= alcancados`.
**Warning signs:** `ganho + perdido > negocios_iniciados` for any row during manual/human verification.

### Pitfall 4: `bigint` columns arriving as strings from PostgREST
**What goes wrong:** Every existing dashboard query wrapper (`lib/supabase/queries/dashboard.ts`) has to `Number()`-normalize every `bigint`/`numeric` column because PostgREST serializes them as JSON strings to avoid precision loss past 2^53. Forgetting this on the new fields produces silent string-concatenation bugs (`"3" + "5" === "35"`) instead of arithmetic.
**Why it happens:** TypeScript's structural typing doesn't catch this — the RPC's declared return type and the actual over-the-wire JSON type diverge without a compile error.
**How to avoid:** Copy the existing row-mapper shape exactly: type the raw row as `{ ...: number | string | null }`, map every numeric field through `Number(...)`, preserving `null` explicitly for `ciclo_medio_dias` (a vendedor with zero ganho closings has no defined cycle time — must render `null`/`—`, never `0` or `NaN`).
**Warning signs:** A `ciclo_medio_dias` displaying as `NaN dias` or a table row's numbers looking like string concatenation.

## Runtime State Inventory

Not applicable — this is a purely additive phase (new RPC, new component, new tests). It renames nothing, migrates no existing rows, and touches no live external service configuration.

## Code Examples

### Full proposed RPC (reference implementation — the planner/executor should verify column names against the live schema before finalizing)
```sql
-- Source: supabase/migrations/0011_dashboard_comparativo_vendedor.sql (proposed, new file)
-- Mirrors 0003_dashboard_aggregates.sql's SECURITY INVOKER convention and
-- 0009/0010's ultimo_status_change dedup CTE verbatim. NEW file only — never
-- an edit to 0001-0010 (Pitfall 11, project-wide convention).
create or replace function dashboard_comparativo_vendedor()
returns table(
  responsavel uuid,
  responsavel_nome text,
  negocios_iniciados bigint,
  ganho bigint,
  perdido bigint,
  ciclo_medio_dias numeric
)
language sql
stable
as $$
  with vendedores_ativos as (
    -- D-02/CONTEXT.md discretion bullet 3: ONLY this CTE applies the
    -- ativo=true filter. Nothing below it is allowed to re-apply it.
    select
      p.id,
      trim(both ' ' from coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')) as nome
    from profiles p              -- open SELECT RLS (0001) — not caller-role-scoped
    where p.role = 'vendedor' and p.ativo = true
  ),
  ultimo_status_change as (
    -- Verbatim from 0003/0009 — do not modify this CTE's logic.
    select distinct on (h.cliente_id)
      h.cliente_id,
      h.criado_em,
      case
        when h.descricao ilike '%"ganho"%' then 'ganho'
        when h.descricao ilike '%"perdido"%' then 'perdido'
      end as status_evento
    from historico h             -- RLS-scoped via clientes' parent gate
    where h.tipo = 'status_acompanhamento'
      and (h.descricao ilike '%"ganho"%' or h.descricao ilike '%"perdido"%')
    order by h.cliente_id, h.criado_em desc
  ),
  fechamentos as (
    select
      c.id as cliente_id,
      u.status_evento,
      c.criado_em,
      u.criado_em as fechado_em
    from clientes c               -- RLS-scoped — a Vendedor's call only ever
    join ultimo_status_change u   -- sees their own clientes here
      on u.cliente_id = c.id
    where c.status_acompanhamento::text = u.status_evento
  ),
  agregados as (
    -- Single GROUP BY over ONE clientes row set (Pitfall 3 guard) —
    -- negocios_iniciados, ganho, perdido all derive from the same rows.
    select
      c.responsavel,
      count(*) as negocios_iniciados,
      count(*) filter (where f.status_evento = 'ganho') as ganho,
      count(*) filter (where f.status_evento = 'perdido') as perdido,
      -- Ciclo médio: GANHO-ONLY basis (see RESEARCH.md Open Questions —
      -- "ciclo de venda" conventionally means time-to-close-a-WIN; a
      -- perdido negotiation was never a completed sales cycle).
      round(
        (avg(extract(epoch from (f.fechado_em - f.criado_em)))
           filter (where f.status_evento = 'ganho') / 86400.0
        )::numeric,
        1
      ) as ciclo_medio_dias
    from clientes c                -- D-01/D-02: NO period filter, whole history
    left join fechamentos f on f.cliente_id = c.id
    group by c.responsavel
  )
  select
    v.id as responsavel,
    v.nome as responsavel_nome,
    coalesce(a.negocios_iniciados, 0) as negocios_iniciados,
    coalesce(a.ganho, 0) as ganho,
    coalesce(a.perdido, 0) as perdido,
    a.ciclo_medio_dias  -- stays NULL when the vendedor has zero ganho closings
  from vendedores_ativos v
  left join agregados a on a.responsavel = v.id
  order by v.nome;      -- Claude's Discretion (CONTEXT.md): alphabetical by
                         -- nome, matching lib/equipe/membros.ts's
                         -- substitutosDisponiveis sort precedent. Flag for
                         -- UI-SPEC to confirm or override with a performance
                         -- sort (see Open Questions).
$$;
-- No `security definer` — do not add one (Pattern 1 / Pitfall 1).
```

### Typed query wrapper (mirrors every existing function in this file)
```typescript
// Source: lib/supabase/queries/dashboard.ts (existing file, pattern to extend)
export type ComparativoVendedorRow = {
  responsavel: string
  responsavelNome: string | null
  negociosIniciados: number
  ganho: number
  perdido: number
  cicloMedioDias: number | null
  taxaConversao: number | null   // computed here via taxaConversao(), not returned by SQL
}

export async function getComparativoVendedor(): Promise<ComparativoVendedorRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_comparativo_vendedor")

  if (error) {
    throw new Error(`Falha ao carregar comparativo por vendedor: ${error.message}`)
  }

  return (data ?? []).map(
    (row: {
      responsavel: string
      responsavel_nome: string | null
      negocios_iniciados: number | string
      ganho: number | string
      perdido: number | string
      ciclo_medio_dias: number | string | null
    }) => {
      const ganho = Number(row.ganho)
      const perdido = Number(row.perdido)
      return {
        responsavel: row.responsavel,
        responsavelNome: row.responsavel_nome,
        negociosIniciados: Number(row.negocios_iniciados),
        ganho,
        perdido,
        cicloMedioDias:
          row.ciclo_medio_dias === null ? null : Number(row.ciclo_medio_dias),
        taxaConversao: taxaConversao(ganho, perdido),  // D-03 — reused, not reimplemented
      }
    }
  )
}
```

## State of the Art

Not applicable — no external ecosystem or third-party library is involved in this phase; "state of the art" here is simply "the third application of this codebase's own established dashboard-RPC pattern," already covered above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Ciclo médio em dias" should average GANHO-ONLY closing durations, not ganho+perdido combined | Code Examples (RPC), Open Questions | Low-medium — if the owner actually wants both included, it's a one-line change (drop the `filter (where f.status_evento = 'ganho')` on the `avg(...)`), but it changes what the number means and should be confirmed before shipping, since CONTEXT.md explicitly left this to research/planner discretion rather than locking it |
| A2 | Row order should default to alphabetical by `nome` (not by performance/ganho descending) | Code Examples (RPC's `order by v.nome`), Architecture Pattern | Low — CONTEXT.md explicitly delegates this to UI-SPEC as "no functional impact"; if UI-SPEC picks a performance sort instead, only the `ORDER BY` clause or a client-side re-sort changes, no other logic is affected |
| A3 | Migration should be filed as `0011_dashboard_comparativo_vendedor.sql` | Recommended Project Structure | None — purely a naming/numbering convenience; `0010` is confirmed as the last applied migration in this repo today, so `0011` is the correct next sequential number, but the planner should re-confirm no other in-flight phase has already claimed `0011` before finalizing |

## Open Questions

1. **Does "ciclo médio em dias" for this comparison average ganho-only closings, or ganho+perdido combined?**
   - What we know: CONTEXT.md's D-01/D-02/D-03 lock the "negócios iniciados" and "período" and "taxa de conversão" definitions precisely, but explicitly do NOT lock the ciclo-médio basis — the Canonical References section only says the base pattern is `dashboard_tempo_ate_fechamento()`'s CTE, "grouped by `c.responsavel` (or remove the split ganho/perdido, dependending on how Claude decides to aggregate — discretion)."
   - What's unclear: whether the Supervisor's mental model of "vendedor's average cycle" includes time spent on deals that were ultimately lost.
   - Recommendation: Default to ganho-only (implemented above) — this matches the conventional sales-ops meaning of "sales cycle length" (time to close a WIN) and is the simpler, more actionable number for a Supervisor comparing performance. Surface this in the UI-SPEC as a `CircleHelp` tooltip exactly like `FunilDetalhadoTable.tsx`'s existing "Quantidade" column tooltip, so the exact definition is never ambiguous to the end user, and flag it explicitly for the project owner's confirmation during `/gsd-plan-phase`'s own review step, since this is a genuine product-definition choice, not just an implementation detail.

2. **Should a vendedor with zero clientes ever assigned (an active vendedor invited but who hasn't started working yet) render as a full row with zeros, or be hidden entirely?**
   - What we know: The RPC as designed (LEFT JOIN from `vendedores_ativos`) always produces a row for every active vendedor, with `negocios_iniciados = 0`, `ganho = 0`, `perdido = 0`, `ciclo_medio_dias = null`, `taxaConversao = null` (via `taxaConversao`'s own zero-guard).
   - What's unclear: whether a Supervisor comparing performance wants to see a brand-new vendedor's "all zeros" row (arguably useful — flags someone who hasn't started) or would find it noise.
   - Recommendation: Show the row (default LEFT JOIN behavior) — this matches `FunilDetalhadoTable.tsx`'s own "never silently hide a possible-zero row" convention (it always renders all 7 etapas, even ones with `quantidade = 0`), and a Supervisor spotting a zero-activity vendedor is plausibly valuable information, not noise. No code change needed to implement this recommendation — it's the natural behavior of the query as designed; only mention if UI-SPEC decides to filter these out.

## Environment Availability

Skipped — this phase has no new external dependencies. It uses the already-configured, already-provisioned Supabase project (same `supabase/migrations/` pipeline every prior phase used) and the existing local dev toolchain (Node, npm, Vitest) already verified functional by every completed prior phase in this milestone.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`vitest.config.ts`, already configured) |
| Config file | `vitest.config.ts` (existing, no changes needed) |
| Quick run command | `npx vitest run tests/dashboard/comparativo-vendedor.test.ts` |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VEND-01 | RPC lists only active vendedores (`role='vendedor' and ativo=true`) | integration (live Supabase, RLS) | `npx vitest run tests/dashboard/comparativo-vendedor.test.ts` | ❌ Wave 0 |
| VEND-01 | A deactivated vendedor disappears from this RPC's row list, but their historical ganho/perdido counts remain unchanged in `dashboard_ganhos_perdidos` | integration (live Supabase) | same file as above | ❌ Wave 0 |
| VEND-01 | `negocios_iniciados` counts ALL-time clientes ever assigned, unaffected by any period filter (D-01/D-02) | integration | same file | ❌ Wave 0 |
| VEND-01 | Taxa de conversão uses `taxaConversao(ganho, perdido)` — returns `null` when both are 0, matches the existing formula (D-03) | unit (pure function, already covered) | existing `taxaConversao` has no dedicated test file today — confirm/add one alongside this phase's query-layer test | ⚠️ verify during Wave 0 |
| VEND-03 (RLS isolation, implicit in Phase Boundary + STATE.md's carried-forward research flag "Phase 12 — precisa de teste automatizado do isolamento por papel") | A Vendedor calling the RPC directly never sees another vendedor's real ganho/perdido/ciclo numbers (only their own row's real numbers; other active vendedores' rows show zeros, per Pitfall 1) | integration (RLS negative case) | extend `tests/dashboard/rls-dashboard.test.ts`'s existing before/after array with `dashboard_comparativo_vendedor` (zero-argument RPC, same pattern as `dashboard_funil_detalhado`/`dashboard_tempo_ate_fechamento`) | ⚠️ extend existing file |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/dashboard/comparativo-vendedor.test.ts tests/dashboard/rls-dashboard.test.ts`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/dashboard/comparativo-vendedor.test.ts` — covers VEND-01's active-vendedor-listing, deactivation-exclusion, and whole-history-counting behavior. **Must use the `createTestMember("vendedor", label)` / `deleteTestMember(id)` fixture pattern from `tests/equipe/reassignment.test.ts`** (not the shared `SEED_ACCOUNTS.vendedorA/B`) to get deterministic, disposable counts — the live test project already has unknown-quantity historical clientes on the shared seed accounts, which would make exact-count assertions flaky. Create a fixture vendedor, seed a small known number of ganho/perdido/em_andamento clientes for them via `serviceClient()`, call `desativar_membro_equipe`-adjacent deactivation (or directly flip `profiles.ativo` via service role) to prove the exclusion, then tear down via `deleteTestMember` in `afterAll` (clientes must be deleted first, per the FK constraint `reassignment.test.ts` already documents).
- [ ] Extend `tests/dashboard/rls-dashboard.test.ts`'s existing `beforeX`/`afterX` `Promise.all` arrays with `vendedorB.rpc("dashboard_comparativo_vendedor")`, mirroring exactly how `dashboard_funil_detalhado`/`dashboard_tempo_ate_fechamento` were added in Phase 11 — this is the fastest way to prove the new RPC never leaks a cross-vendedor number, reusing the existing before/after diffing infrastructure.
- [ ] No new framework install needed — Vitest + the existing `tests/helpers/supabase-test-clients.ts` fixtures already cover everything this phase's tests need.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — Server Action still calls `supabase.auth.getUser()` and returns `{error:"unauthenticated"}` exactly like every other `getXAction` in `app/actions/dashboard.ts` |
| V3 Session Management | no | No new session-handling code in this phase |
| V4 Access Control | yes | RLS on `clientes`/`historico` (existing policies, unmodified) — this phase adds a NEW RPC but reuses the SAME authorization boundary every other dashboard RPC already relies on; `profiles`' pre-existing open-SELECT policy is the one nuance to document (Pitfall 1), not a control this phase introduces |
| V5 Input Validation | n/a | The new RPC takes zero parameters — there is no user input surface to validate |
| V6 Cryptography | no | Not applicable to this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A Vendedor calls the new RPC directly (bypassing the `isSupervisor` UI gate) hoping to see other vendedores' real numbers | Information Disclosure | RLS on `clientes`/`historico` already scopes the aggregation half to the caller's own rows regardless of the RPC being called — proven by extending `tests/dashboard/rls-dashboard.test.ts` (Pattern 4). The vendedor ROSTER (names) is visible either way via `profiles`' existing open policy — pre-existing, not a new exposure introduced by this phase |
| Adding `security definer` "to make the profiles join simpler" | Elevation of Privilege | Never add it — see Anti-Patterns / Pitfall 1. This is the single highest-risk mistake available in this phase's scope, and the existing `tests/dashboard/rls-dashboard.test.ts` regression suite is specifically designed to catch it |
| Deactivating a vendedor mid-session (JWT still valid for ~1h per Phase 10's documented residual window) while they're viewing a stale dashboard | Tampering (stale authorization state) | Out of scope for this phase — this is Phase 10's already-accepted, already-documented residual window (STATE.md Blockers/Concerns), not something Phase 12 needs to re-solve; Phase 12 only needs to ensure ITS OWN new RPC is subject to the same RLS/`is_supervisor()` re-evaluation-per-request behavior every other RPC already has (it is, by construction, since it has no `security definer`) |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/0001_profiles_and_roles.sql` — `profiles` table shape, `is_supervisor()`, open SELECT RLS policy, deliberate absence of write policies. Read directly.
- `supabase/migrations/0003_dashboard_aggregates.sql` — SECURITY INVOKER convention, `dashboard_desempenho_vendedor()`'s `group by c.responsavel` precedent, `ultimo_status_change` dedup CTE. Read directly.
- `supabase/migrations/0008_desativacao_membro_equipe.sql` — `profiles.ativo` column semantics, `is_supervisor()`'s extension to also require `ativo = true`. Read directly.
- `supabase/migrations/0009_dashboard_funil_detalhado.sql` / `0010_fix_dashboard_funil_detalhado_avancou_pct.sql` — duration-reconstruction CTE pattern, and a real live-observed percentage-math bug (Pitfall 3) with its documented fix. Read directly.
- `lib/dashboard/periodo.ts` — `taxaConversao()`'s exact null-safe formula (D-03's reuse target). Read directly.
- `lib/supabase/queries/dashboard.ts`, `app/actions/dashboard.ts` — the typed-wrapper / Server-Action pattern every new query/action in this phase must mirror. Read directly.
- `components/dashboard/DesempenhoVendedorChart.tsx`, `components/dashboard/FunilDetalhadoTable.tsx`, `components/dashboard/DashboardClient.tsx` — the exact Supervisor-gate and table-shape precedents. Read directly.
- `lib/equipe/membros.ts`, `app/(app)/equipe/page.tsx` — `ativo=true` filtering precedent and confirmation that `profiles` is read openly (not RLS-scoped by role). Read directly.
- `tests/dashboard/rls-dashboard.test.ts`, `tests/equipe/reassignment.test.ts`, `tests/helpers/supabase-test-clients.ts` — existing RLS test pattern and the `createTestMember`/`deleteTestMember` disposable-fixture pattern this phase's own tests should reuse. Read directly.
- `.planning/phases/12-comparativo-por-vendedor/12-CONTEXT.md` — locked decisions D-01/D-02/D-03 and Claude's Discretion bullets. Read directly.
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — VEND-01 wording, cross-phase decision history (EQP-04's "closed clientes stay with the deactivated member" rule, the carried-forward "Phase 12 needs a role-isolation test" research flag). Read directly.

### Secondary (MEDIUM confidence)
None — every claim in this research was verified directly against this repository's own source files (migrations, components, tests, CONTEXT.md/REQUIREMENTS.md/STATE.md). No web search or external documentation was needed since this phase introduces no new library or external API.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, zero external-ecosystem risk
- Architecture: HIGH — every pattern is copied verbatim from this repository's own already-shipped, already-tested code (3rd application of the same dashboard-RPC convention)
- Pitfalls: HIGH — three of the four pitfalls documented are real, previously-observed bugs in this exact codebase (`0010`'s live percentage-math fix, the `bigint`-as-string PostgREST behavior every existing query wrapper already guards against, and the `profiles` open-SELECT nuance confirmed by direct code reading)

**Research date:** 2026-08-03
**Valid until:** 90 days (stable, internal-convention-driven domain; not tied to any external library's release cadence)
