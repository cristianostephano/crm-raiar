# Phase 4: Dashboard Gerencial - Research

**Researched:** 2026-07-18
**Domain:** Postgres RLS-scoped aggregation + Recharts (via shadcn/ui Chart) dashboard UI on Next.js App Router
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Período de análise**
- **D-01:** O dashboard tem um filtro de período (ex: últimos 30 dias / este mês / este ano / personalizado) — não mostra só o acumulado total sem opção de filtrar.
- **D-02:** Para métricas de "ganhos x perdidos" e "taxa de conversão", o período filtra pela **data da mudança de status** (quando o card virou ganho/perdido — via `historico` ou `etapa_alterada_em`/campo equivalente), não pela data de cadastro do cliente.

**Localização**
- **D-03:** O Dashboard fica num item de menu separado ("Dashboard"). O funil (kanban) continua sendo a tela inicial ao logar — não muda o fluxo padrão de uso diário.

**Visualização por métrica**
- **D-04:** "Clientes por etapa do funil" — gráfico de barras (uma barra por etapa).
- **D-05:** "Ganhos x perdidos" e "taxa de conversão" — números em destaque (grandes, diretos), não gráfico de pizza/rosca.
- **D-06:** "Prospecção por produto e por categoria" e "desempenho por vendedor" — barras horizontais (uma barra por produto/categoria/vendedor).

**Escopo por papel (já confirmado no PROJECT.md/REQUIREMENTS.md, reafirmado aqui)**
- **D-07:** Vendedor vê uma versão do dashboard só com os próprios números (não vê desempenho por vendedor, já que só existe ele mesmo na visão dele). Supervisor vê o dashboard completo, com todos os vendedores.

### Claude's Discretion
- Biblioteca de gráficos: usar Recharts via o componente Chart do shadcn/ui, já definido em `.claude/CLAUDE.md`.
- Layout exato da tela (ordem dos blocos, grid responsivo).
- Opções exatas do filtro de período (ex: presets exatos oferecidos) e o componente de seleção de data personalizada.
- Onde e como computar os agregados (view/RPC no Postgres vs. client-side) — decisão técnica de implementação.

### Deferred Ideas (OUT OF SCOPE)
Nenhuma — discussão ficou dentro do escopo da fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| DSH-01 | Dashboard mostra clientes por etapa do funil | `dashboard_clientes_por_etapa()` SQL function (Architecture Pattern 1); shadcn Chart vertical BarChart (Pattern 5); treated as a live snapshot, not period-filtered (Assumption A2 / Open Question 2) |
| DSH-02 | Dashboard mostra ganhos x perdidos num período | `dashboard_ganhos_perdidos(p_inicio, p_fim)` querying `historico` (not `etapa_alterada_em`) per D-02 (Architecture Pattern 2); big-number Cards per D-05, no chart library needed for this metric |
| DSH-03 | Dashboard mostra desempenho por vendedor | `dashboard_desempenho_vendedor(p_inicio, p_fim)`, same ganho/perdido logic grouped by `responsavel`, RLS auto-scopes (Architecture Pattern 3); horizontal-bar Chart per D-06 (Pattern 4); exact metric composition flagged in Open Question 3 |
| DSH-04 | Dashboard mostra taxa de conversão | Computed from DSH-02's ganho/perdido counts (`ganho / (ganho + perdido)`), no separate query |
| DSH-05 | Dashboard mostra prospecções por produto e por categoria | `dashboard_prospeccao_por_produto`/`dashboard_prospeccao_por_categoria` SQL functions over `cliente_produtos`/`categoria_id`; date-basis ambiguity flagged in Open Question 1 / Assumption A1; horizontal-bar Chart per D-06 |
| DSH-06 | Vendedor vê uma versão do dashboard só com os próprios números | Enforced entirely via RLS on `clientes`/`historico` inside every SECURITY INVOKER function (Architecture Pattern 1/3, Security Domain) — proven by `tests/dashboard/rls-dashboard.test.ts` (Validation Architecture) |
| DSH-07 | Supervisor vê o dashboard completo, com todos os vendedores | Same RLS mechanism as DSH-06 plus an SSR conditional (`profile?.role === "supervisor"`) hiding the "desempenho por vendedor" block for Vendedor, mirroring the existing nav-link pattern in `app/(app)/layout.tsx` |
</phase_requirements>

## Summary

Phase 4 is a pure read layer: no new tables, no new mutations. Everything the dashboard needs already exists in `clientes`, `historico`, `cliente_produtos`, and the 4 lookup tables from Phases 2-3. The two real technical questions are (1) how to compute grouped/aggregated numbers in Postgres while staying inside the project's established RLS-is-the-boundary convention, and (2) how to wire shadcn/ui's Chart component (Recharts v3) for the three chart shapes D-04/D-05/D-06 call for.

For the aggregation layer, this project has no existing precedent for a "read" RPC (the only RPC so far, `mover_card_funil`, returns `void`). The recommended pattern is a small set of **SQL `language sql stable` functions** (not `security definer`, matching the project's established SECURITY INVOKER-by-default convention from `mover_card_funil`) that each run as the calling user, so the existing `clientes`/`historico` RLS policies automatically scope every aggregate — a Vendedor's dashboard query returns only their own numbers with zero manual `responsavel` filtering, exactly like `getClientesAgrupadosPorEtapa()` already does for the kanban. Plain Postgres views are a viable alternative for the non-parameterized aggregate (clientes por etapa), but the period-filtered aggregates (D-01/D-02) need a `date range` argument, which views can't take — so RPC functions returning `table(...)` are the right primitive across the board, for consistency.

The critical schema finding: **`historico` has no structured "new value" column** — status changes are recorded as a human-readable `descricao` string (`'Status alterado para "ganho"'`), not a discrete enum value, and `clientes.etapa_alterada_em` only updates on **etapa** changes, not on **status_acompanhamento** changes (confirmed by reading `clientes_before_update()` in `0002_clientes_and_funil.sql`). This means D-02's "period filters by the date the card became ganho/perdido" can only be answered by querying `historico` rows where `tipo = 'status_acompanhamento'` and `descricao` contains the target status, ordered by `criado_em` — there is no shortcut via a timestamp column on `clientes`.

**Primary recommendation:** Build 4-5 `SECURITY INVOKER` SQL functions (`dashboard_clientes_por_etapa`, `dashboard_ganhos_perdidos`, `dashboard_desempenho_vendedor`, `dashboard_prospeccao_por_produto`, `dashboard_prospeccao_por_categoria`), each `stable`, no `security definer`, taking `p_inicio timestamptz, p_fim timestamptz` where a period applies; parse the ganho/perdido moment out of `historico.descricao` via `ILIKE`; install shadcn's Chart component (`npx shadcn@latest add chart`) which is style-agnostic and works unmodified with this project's `base-nova` preset; reuse the already-installed `Calendar` + `Popover` primitives for a custom date-range picker (the installed `calendar.tsx` already ships `range_start`/`range_middle`/`range_end` styling, so `mode="range"` needs no further Calendar changes).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Clientes por etapa (count) | Database (RPC/SQL function) | API/Backend (Server Component read) | Grouped count over RLS-scoped `clientes`; must run server-side so RLS applies per-user, never computed client-side over a full fetched list (violates CLAUDE.md's egress constraint) |
| Ganhos x perdidos + conversão (período) | Database (RPC/SQL function) | API/Backend | Needs a `historico`-driven date filter Postgres can express in one query; wrong tier = N+1 client-side joins |
| Desempenho por vendedor | Database (RPC/SQL function) | API/Backend | Same RLS-scoped aggregate as ganhos/perdidos, grouped by `responsavel`; RLS itself collapses a Vendedor's call to their own single row, so no extra role branching needed at the DB layer |
| Prospecção por produto/categoria | Database (RPC/SQL function) | API/Backend | Grouped count via `cliente_produtos`/`categoria_id` join, RLS-scoped the same way |
| Período filter (state: preset/custom range) | Browser/Client (Client Component) | API/Backend (params passed to RPC calls) | Pure UI state (selected preset or custom `{from, to}`) — no server round-trip needed until the user commits a period; the RPC calls take the resolved range as arguments |
| Role-based dashboard shape (Vendedor sees own only, Supervisor sees all) | Database (RLS on `clientes`/`historico`) | Frontend Server (SSR conditional render of the "desempenho por vendedor" block) | RLS is the real boundary (already proven for `clientes`); the Vendedor/Supervisor UI difference (D-07) is a UX nicety on top, following the same `profile?.role === "supervisor"` conditional already used for "Gerenciar equipe"/"Configurações" nav links |
| Chart rendering (bars, big numbers) | Browser/Client (Client Component, Recharts) | — | Recharts requires a browser canvas/SVG render; ChartContainer/ResponsiveContainer needs client-side layout measurement |
| Dashboard page shell + nav entry | Frontend Server (SSR page + layout) | — | Matches every other screen in this app (`app/(app)/*/page.tsx` Server Components with an auth/redirect guard) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `recharts` | 3.9.2 [VERIFIED: npm registry] | Underlying chart rendering engine | Installed automatically by `npx shadcn@latest add chart`; already the pinned version in `.claude/CLAUDE.md`'s Technology Stack table |
| shadcn/ui Chart component (`components/ui/chart.tsx`) | shadcn CLI 4.13.1 [VERIFIED: npm registry] | `ChartContainer`/`ChartConfig`/`ChartTooltip`/`ChartLegend` wrappers around Recharts | Official shadcn component, confirmed style-agnostic (works with `base-nova` — this project's preset — same as `radix`/`new-york`) [CITED: ui.shadcn.com/docs/components/chart] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `components/ui/calendar.tsx` (already installed) | react-day-picker ^10.0.1 (already in `package.json`) | Custom period date-range selection (D-01's "personalizado" option) | Already ships `range_start`/`range_middle`/`range_end` classNames and `data-range-*` attributes on `CalendarDayButton` [VERIFIED: codebase read, `components/ui/calendar.tsx`] — `mode="range"` needs zero changes to the installed file |
| `components/ui/popover.tsx` (already installed) | — | Trigger + panel shell for the date-range picker | Same `Popover`/`PopoverTrigger`/`PopoverContent` composition already used twice in `ClienteDetailSheet.tsx` for the single-date `data_conclusao` pickers |
| `date-fns` (already installed) | ^4.4.0 | Formatting the selected range for the trigger button label, computing preset ranges (`subDays`, `startOfMonth`, `startOfYear`) | Already the project's date library (CLAUDE.md forbids `moment.js`); `date-fns`'s `startOfMonth`/`subDays`/`startOfYear` cover every D-01 preset with no new dependency |
| `components/ui/tabs.tsx` or `components/ui/select.tsx` (already installed) | — | Preset period selector UI (últimos 30 dias / este mês / este ano / personalizado) | Claude's Discretion per CONTEXT.md; `Select` is the lower-friction choice for 4 mutually exclusive options plus the "personalizado" range-picker reveal |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RPC functions (`language sql stable`) for every aggregate | Plain Postgres views with `security_invoker = true` | Views work fine for the non-parameterized `clientes_por_etapa` aggregate, but every period-filtered aggregate (D-01/D-02) needs a `date range` argument views can't accept without a wrapping function anyway — using RPC functions uniformly keeps one calling convention instead of two |
| Parsing ganho/perdido moment from `historico.descricao` (`ILIKE '%ganho%'`) | Add a new structured column to `historico` (e.g. `valor_anterior`/`valor_novo`) | A schema change here is out of CONTEXT.md's stated boundary ("não cria tabelas novas, só agrega o que já existe") — string-matching against the trigger's own fixed-format `descricao` (`clientes_after_update_historico()` in `0002_clientes_and_funil.sql`, format is always `'Status alterado para "%s"'`) is reliable since the trigger is the only writer and its format string is stable |
| shadcn/ui Chart component (Recharts) | Tremor / visx / a hand-rolled `<svg>` | Already fixed in CLAUDE.md's Technology Stack table and reaffirmed by CONTEXT.md's Claude's Discretion section; not re-litigated here |

**Installation:**
```bash
npx shadcn@latest add chart
```
No other new packages needed — `Calendar`, `Popover`, `Select`, `Tabs`, `Card`, `Badge` are already installed from Phases 1-3.

**Version verification:** `npm view recharts version` → `3.9.2`, published 2026-07-04 [VERIFIED: npm registry]. `npm view shadcn version` → `4.13.1` [VERIFIED: npm registry], compatible with the already-pinned `^4.13.0` in `package.json`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| `recharts` | npm | Long-established project (recharts org); latest patch published 2026-07-04, flagged "too-new" by the age heuristic because it checks the *latest version's* publish date, not the package's first-publish date | 49,443,114/week | `github.com/recharts/recharts` | SUS (signal: `too-new`, i.e. recent patch release) | Approved — the "too-new" signal is a false positive from checking latest-version publish recency, not package age; 49M weekly downloads and an established GitHub org make slopsquatting implausible. **Planner should still add a `checkpoint:human-verify` task before `npx shadcn@latest add chart` runs `npm install recharts`, per the SUS disposition rule**, even though this is a known, already-pinned dependency in `.claude/CLAUDE.md`. |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `recharts` — see disposition above; the planner must gate the `npx shadcn@latest add chart` install step behind a `checkpoint:human-verify` task per protocol, even though this package is a pre-existing, CLAUDE.md-approved dependency.

No `postinstall` script present (`npm view recharts scripts.postinstall` returns nothing).

## Project Constraints (from CLAUDE.md)

Extracted from `./CLAUDE.md` and `./.claude/CLAUDE.md` — the planner must not produce tasks that contradict these:

- **Stack is fixed:** Next.js (React/TypeScript) + Supabase; no separate Node.js backend. Every dashboard aggregate must be Server Component reads / Server Actions calling Supabase directly (behind RLS) — never a new API layer.
- **RLS is the only authorization boundary:** "Não implementar autenticação/autorização por conta própria — sempre usar Supabase Auth + RLS." Confirms this research's core recommendation (SECURITY INVOKER functions relying on existing RLS, never a hand-rolled role check as the real boundary).
- **Migrations only, never dashboard schema edits:** any new SQL function goes in a new file under `/supabase/migrations`, never edited into `0001`/`0002` (already-applied migrations) — matches Pitfall 11 precedent from prior phases.
- **No new tables:** CONTEXT.md's Phase Boundary explicitly states this phase "não cria tabelas novas, só agrega o que já existe" — the recommended design (RPC functions + no schema changes beyond optional new indexes) honors this.
- **TypeScript strict, no `any` without a justifying comment.**
- **Every new table needs RLS + explicit policies** — not applicable here (no new tables), but any new indexes/functions still need the "why not security definer" comment discipline established in this research.
- **Non-technical project owner:** explanations of technical decisions must stay jargon-light; big changes need a plain-language plan before implementation. The planner should keep this in mind when writing task descriptions/checkpoints for this phase.
- **No new paid/metered services:** Recharts (already approved, runs client-side, zero infra cost) and the existing Supabase free tier cover this phase entirely — no new external dependency introduces cost.
- **Cost-conscious aggregation:** "Compute aggregates with Postgres views or RPC functions... not client-side reduction over a full client list — keeps egress low against the 5GB/month free-tier cap" (`.claude/CLAUDE.md` Stack Patterns) — directly drives this research's Postgres-function-first recommendation.
- **Testing:** every new feature needs at least one automated test before being considered done (`CLAUDE.md` Testes) — reflected in the Validation Architecture section's Wave 0 gaps.

## Architecture Patterns

### System Architecture Diagram

```
Browser (Vendedor or Supervisor)
        │
        ▼
  /dashboard page (Server Component, app/(app)/dashboard/page.tsx)
        │  auth guard: redirect to /login if no session (existing pattern)
        │  reads caller's role from `profiles` (existing pattern)
        ▼
  DashboardClient (Client Component)
        │  holds período state: preset | {from, to}
        │
        ├──> on período change ──> Server Action wrapper calls RPC ──┐
        │                                                             │
        ▼                                                             ▼
  Postgres (via supabase-js .rpc())                     RLS evaluated as the CALLING user
        │  dashboard_clientes_por_etapa()                (SECURITY INVOKER — no bypass)
        │  dashboard_ganhos_perdidos(p_inicio, p_fim)            │
        │  dashboard_desempenho_vendedor(p_inicio, p_fim)        │
        │  dashboard_prospeccao_por_produto(p_inicio, p_fim)     │
        │  dashboard_prospeccao_por_categoria(p_inicio, p_fim)   │
        │                                                         │
        │  internally SELECTs from `clientes` + `historico`      │
        │  + `cliente_produtos` — every SELECT is filtered by    │
        │  the existing "responsavel = auth.uid() OR             │
        │  is_supervisor()" policy automatically                 │
        ▼
  Aggregated rows returned to the Server Action/Server Component
        │
        ▼
  shadcn/ui Chart components (Client Component, Recharts under the hood)
        │  BarChart (D-04, D-06) / big-number Cards (D-05)
        ▼
  Rendered dashboard — Vendedor sees only their own numbers (RLS-narrowed
  result set, not a client-side filter); Supervisor sees the full team,
  including the "desempenho por vendedor" block hidden entirely for Vendedor
  (SSR conditional, mirroring the existing "Configurações"/"Gerenciar equipe"
  nav-link pattern)
```

### Recommended Project Structure
```
app/(app)/dashboard/
└── page.tsx                     # Server Component: auth guard, role read, renders DashboardClient
app/actions/
└── dashboard.ts                 # Server Action wrappers around the 5 RPC calls (mirrors app/actions/funil.ts's thin-wrapper pattern)
lib/supabase/queries/
└── dashboard.ts                 # Typed .rpc() callers + row-shape mapping (mirrors lib/supabase/queries/clientes.ts)
lib/dashboard/
└── periodo.ts                   # Pure functions: preset -> {from, to} (subDays/startOfMonth/startOfYear), no Supabase import (Client-Component-safe, mirrors lib/funil/staleness.ts's dependency-free-module pattern)
components/dashboard/
├── DashboardClient.tsx          # Client Component: período state, orchestrates all 5 metric fetches
├── PeriodoFilter.tsx            # Select (presets) + Popover/Calendar mode="range" (custom)
├── ClientesPorEtapaChart.tsx    # shadcn Chart, vertical bars (D-04)
├── GanhosPerdidosCards.tsx      # Big-number Cards, no chart (D-05)
├── DesempenhoVendedorChart.tsx  # shadcn Chart, horizontal bars (D-06), Supervisor-only
└── ProspeccaoChart.tsx          # shadcn Chart, horizontal bars (D-06), reused for produto + categoria
supabase/migrations/
└── 000X_dashboard_aggregates.sql   # The 5 SQL functions + supporting indexes, NEW file per Pitfall 11
```

### Pattern 1: SECURITY INVOKER SQL aggregate function (read RPC)
**What:** A `language sql stable` function with no `security definer`, so it runs with the calling user's row-level permissions — every internal `SELECT` is transparently scoped by the existing `clientes`/`historico` RLS policies.
**When to use:** Every dashboard metric in this phase.
**Example:**
```sql
-- Source: pattern derived from this project's own mover_card_funil (NOT
-- security definer, 0002_clientes_and_funil.sql) + Supabase's documented
-- security_invoker guidance [CITED: supabase.com/docs/guides/database/postgres/row-level-security]
create or replace function dashboard_clientes_por_etapa()
returns table(etapa etapa_funil, total bigint)
language sql
stable
as $$
  select etapa, count(*) as total
  from clientes
  group by etapa;
$$;
-- No "security definer" clause -> runs as invoker. A Vendedor's session
-- only ever sees their own clientes rows here (same RLS policy that
-- already scopes getClientesAgrupadosPorEtapa()); a Supervisor sees all.
```

### Pattern 2: Period-filtered ganhos/perdidos via `historico` (not `clientes.etapa_alterada_em`)
**What:** D-02 requires filtering by the date the status became ganho/perdido, which `clientes.etapa_alterada_em` cannot answer — it only tracks the last `etapa` change, and marking ganho/perdido typically does NOT change `etapa` (the etapa is already `primeira_venda` when ganho is set; `perdido` can be set from any etapa without moving it). The only record of "when did this status become X" is a `historico` row.
**When to use:** `dashboard_ganhos_perdidos`, `dashboard_desempenho_vendedor` (same underlying question, grouped by `responsavel`).
**Example:**
```sql
-- Source: schema facts verified directly against
-- supabase/migrations/0002_clientes_and_funil.sql (clientes_after_update_historico()
-- trigger — the only writer of historico, format string is stable:
-- format('Status alterado para "%s"', new.status_acompanhamento::text))
create or replace function dashboard_ganhos_perdidos(
  p_inicio timestamptz,
  p_fim timestamptz
)
returns table(status text, total bigint)
language sql
stable
as $$
  -- Most-recent status-change historico row per cliente, so a client whose
  -- status flipped more than once (e.g. perdido -> em_andamento -> ganho)
  -- is counted once, under its CURRENT status, at the moment it last
  -- became that status. See "Open Questions" for the edge case this
  -- resolves.
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
  select u.status_evento as status, count(*) as total
  from ultimo_status_change u
  join clientes c on c.id = u.cliente_id  -- RLS on clientes applies here
  where u.criado_em >= p_inicio
    and u.criado_em <  p_fim
    and c.status_acompanhamento::text = u.status_evento  -- only count if still that status today
  group by u.status_evento;
$$;
```
**Conversão:** compute client-side (or in a thin wrapper) as `ganho / (ganho + perdido)` from this same result — no separate query needed.

### Pattern 3: RLS auto-scoping a per-vendedor breakdown (no manual role branching)
**What:** `dashboard_desempenho_vendedor` groups the same ganho/perdido query by `responsavel`. Because the function is SECURITY INVOKER, a Vendedor's call is transparently restricted by RLS to their own `clientes` rows before the `group by responsavel` even runs — the function itself needs zero `is_supervisor()` check.
**When to use:** `dashboard_desempenho_vendedor`.
**Why it matters for D-07:** A Vendedor calling this RPC gets back exactly one row (themselves). The UI decision (hide the "desempenho por vendedor" chart block entirely for non-Supervisors) is a UX nicety layered on top, following the exact `profile?.role === "supervisor"` conditional already used in `app/(app)/layout.tsx` for the "Gerenciar equipe"/"Configurações" nav links — not a new authorization mechanism.

### Pattern 4: shadcn Chart — horizontal bars
**Example:**
```typescript
// Source: WebSearch synthesis of recharts.github.io/en-US/api/BarChart +
// GitHub issue recharts/recharts#90 [CITED: recharts.github.io]
<ChartContainer config={chartConfig} className="h-[280px] w-full">
  <BarChart accessibilityLayer data={data} layout="vertical">
    <CartesianGrid horizontal={false} />
    <XAxis type="number" dataKey="total" />
    <YAxis type="category" dataKey="nome" tickLine={false} axisLine={false} width={120} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="total" fill="var(--color-total)" radius={4} />
  </BarChart>
</ChartContainer>
```
Used for D-06 (prospecção por produto/categoria, desempenho por vendedor).

### Pattern 5: shadcn Chart — vertical bars (one bar per etapa)
```typescript
// Source: ui.shadcn.com/docs/components/chart [CITED]
<ChartContainer config={chartConfig} className="h-[280px] w-full">
  <BarChart accessibilityLayer data={data}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="etapaLabel" tickLine={false} tickMargin={10} axisLine={false} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="total" fill="var(--color-total)" radius={4} />
  </BarChart>
</ChartContainer>
```
Used for D-04. `etapaLabel` should map through the existing `lib/funil/etapas.ts` `ETAPA_KEYS`/label lookup so the chart's x-axis uses the same Portuguese labels as the kanban columns — do not hardcode a second label map.

### Pattern 6: Custom period range picker (Popover + Calendar mode="range")
```typescript
// Source: mirrors the exact Popover+Calendar composition already used twice
// in components/clientes/ClienteDetailSheet.tsx (single-date data_conclusao
// pickers), extended to range mode [VERIFIED: codebase read]
const [range, setRange] = useState<DateRange | undefined>()

<Popover>
  <PopoverTrigger className="w-fit rounded-lg border border-input px-2.5 py-1.5 text-left text-sm">
    {range?.from && range?.to
      ? `${format(range.from, "dd/MM/yyyy")} - ${format(range.to, "dd/MM/yyyy")}`
      : "Selecionar período"}
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0">
    <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} />
  </PopoverContent>
</Popover>
```

### Anti-Patterns to Avoid
- **Computing aggregates by fetching the full `clientes` table client-side and reducing in JS:** explicitly forbidden by `.claude/CLAUDE.md`'s Stack Patterns ("Compute aggregates with Postgres views or RPC functions... not client-side reduction over a full client list — keeps egress low against the 5GB/month free-tier cap"). Every metric in this phase must be computed inside a Postgres function.
- **Filtering `clientes.etapa_alterada_em` for ganho/perdido period filtering:** wrong column — it only tracks the last etapa change, not status changes. Use `historico` (Pattern 2).
- **`security definer` on the dashboard RPC functions:** would bypass RLS and require manually re-implementing the Vendedor/Supervisor visibility check inside every function (drifting from the single source of truth). This project's own `mover_card_funil` deliberately avoids `security definer` for exactly this reason — follow that precedent.
- **A second, hardcoded etapa-label map for the chart x-axis:** `lib/funil/etapas.ts` already owns the etapa -> Portuguese label mapping used by the kanban; reuse it so a future etapa rename doesn't need updating in two places.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Bar/horizontal-bar chart rendering, tooltips, responsive sizing | Custom `<svg>` chart or manual D3 | shadcn/ui Chart (Recharts) | Already the project's fixed stack decision; Recharts handles responsive containers, accessibility layer, and tooltip positioning that a hand-rolled SVG chart would need to reinvent |
| Date-range selection UI (calendar popup, range highlighting) | A custom two-`<input type="date">` form | `Calendar` (react-day-picker) `mode="range"` + `Popover` | `react-day-picker` already ships correct range selection semantics (click start, hover-preview, click end) and the installed `calendar.tsx` already has the CSS for it — a raw date-input pair has worse UX and no visual range preview |
| Preset period math (últimos 30 dias / este mês / este ano) | Manual `Date` arithmetic (off-by-one risks around month/year boundaries and DST) | `date-fns` (`subDays`, `startOfMonth`, `endOfMonth`, `startOfYear`, `endOfYear`) | Already the project's date library; hand-rolled boundary math is exactly the kind of edge-case-prone code `date-fns` exists to avoid |
| Grouped counts / aggregates over RLS-scoped data | Fetching every row and grouping in the Server Action / Client Component | Postgres `GROUP BY` inside a SECURITY INVOKER SQL function | Postgres already does this correctly and efficiently, and doing it in the database is the only way to keep RLS as the actual enforcement boundary (a client-side group-by after an over-fetch would still need the *fetch* to be correctly scoped, so the RLS-scoped SQL function is strictly less code and less risk either way) |

**Key insight:** Every "don't hand-roll" item in this phase reduces to the same principle already established across Phases 1-3: push authorization-sensitive filtering into Postgres/RLS, and push repetitive UI mechanics (date pickers, charts) into already-installed, already-accessible libraries. This phase introduces no new class of problem — it composes existing primitives.

## Common Pitfalls

### Pitfall 1: Treating `clientes.etapa_alterada_em` as the ganho/perdido timestamp
**What goes wrong:** A period filter built on `etapa_alterada_em` silently excludes clients marked ganho/perdido without an accompanying etapa change (the common case — `marcarStatus` calls `mover_card_funil` with the *same* `p_nova_etapa` when only the status is changing), producing an undercounted or empty "ganhos x perdidos" chart.
**Why it happens:** `etapa_alterada_em` looks like the obvious "last changed" timestamp on `clientes`, but the `clientes_before_update()` trigger (0002 migration) only bumps it `if new.etapa is distinct from old.etapa` — status-only changes don't touch it.
**How to avoid:** Always source the ganho/perdido moment from `historico.criado_em` where `tipo = 'status_acompanhamento'` (Pattern 2).
**Warning signs:** A "ganhos x perdidos" count that's suspiciously lower than the count of `clientes` currently sitting at `status_acompanhamento = 'ganho'`/`'perdido'`.

### Pitfall 2: Double-counting a status that flipped more than once in the period
**What goes wrong:** If a card is marked `perdido`, then reopened to `em_andamento`, then later marked `ganho`, a naive `count(*)` over every matching `historico` row in the period counts it twice (once as perdido, once as ganho) even though its *current* state is only one of those.
**Why it happens:** `historico` is an append-only event log, not a current-state table; nothing in the schema prevents a status from being set more than once.
**How to avoid:** Use `distinct on (cliente_id) ... order by criado_em desc` to take only the most recent status-change event per client within the period, and cross-check it still matches `clientes.status_acompanhamento` today (Pattern 2's `ultimo_status_change` CTE).
**Warning signs:** Sum of ganho+perdido counts exceeding the total number of distinct clients ever assigned those statuses.

### Pitfall 3: Installing the Chart component but forgetting the sizing class
**What goes wrong:** `ChartContainer` renders at zero height (Recharts' `ResponsiveContainer` needs an explicit parent height) if no `h-[Npx]` or `aspect-*` class is applied, producing a blank chart area with no visible error.
**Why it happens:** Recharts' `ResponsiveContainer` measures its parent's dimensions; a parent with no defined height resolves to `0`.
**How to avoid:** Always pass a sizing class on `ChartContainer` (e.g. `className="h-[280px] w-full"`), as shown in every pattern example above.
**Warning signs:** Chart section renders an empty `<div>` with no console error.

### Pitfall 4: RPC functions with `security definer` re-opening the RLS hole this project deliberately avoided
**What goes wrong:** If a future contributor marks one of the dashboard functions `security definer` (e.g. "to make it faster" or copying an unrelated Supabase tutorial), it silently starts returning every vendedor's data to every caller, defeating D-07/CLI-04/CLI-05's visibility rules with no error or warning.
**Why it happens:** Many online Supabase RPC examples default to `security definer` without explaining the RLS-bypass implication.
**How to avoid:** Never add `security definer` to any function in `000X_dashboard_aggregates.sql`; add a comment on each function (mirroring `mover_card_funil`'s own header comment) explaining why it's deliberately omitted.
**Warning signs:** A code reviewer sees `security definer` on a new function touching `clientes`/`historico` — this should always be treated as a red flag requiring explicit justification, not a default.

### Pitfall 5: Filtering `cliente_produtos`/`categoria_id` aggregates by the wrong date field
**What goes wrong:** "Prospecção por produto e por categoria" (DSH-05) has no CONTEXT.md-specified date basis (D-02 only defines the date basis for ganhos/perdidos/conversão) — building it against `criado_em` vs. treating it as a live snapshot are both defensible, and picking wrong produces a metric the Supervisor doesn't recognize as matching their mental model.
**Why it happens:** D-01 says the dashboard "has" a period filter in general, but D-02 explicitly scopes its date-basis clarification to only two of the seven DSH requirements.
**How to avoid:** Flag this for explicit confirmation before implementation (see Open Questions below) rather than silently picking one.
**Warning signs:** User feedback that "prospecção" numbers don't match what they expect when they change the period filter.

## Runtime State Inventory

Not applicable — this phase is a greenfield read layer over existing schema/data, not a rename/refactor/migration. No renaming, no data migration.

## Code Examples

### Server Action wrapper (mirrors `app/actions/funil.ts`'s thin-wrapper pattern)
```typescript
// Source: pattern mirrors this project's existing app/actions/funil.ts
"use server"

import { createClient } from "@/lib/supabase/server"

export async function getGanhosPerdidos(inicio: Date, fim: Date) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_ganhos_perdidos", {
    p_inicio: inicio.toISOString(),
    p_fim: fim.toISOString(),
  })
  if (error) throw new Error(`Falha ao carregar ganhos/perdidos: ${error.message}`)
  return data as { status: "ganho" | "perdido"; total: number }[]
}
```

### Preset period resolution (`lib/dashboard/periodo.ts`, dependency-free per Pitfall precedent in `lib/funil/staleness.ts`)
```typescript
// Source: date-fns API, already the project's date library
import { startOfMonth, startOfYear, subDays } from "date-fns"

export type PeriodoPreset = "30dias" | "este_mes" | "este_ano" | "personalizado"

export function resolvePeriodo(
  preset: PeriodoPreset,
  custom?: { from: Date; to: Date }
): { inicio: Date; fim: Date } {
  const now = new Date()
  switch (preset) {
    case "30dias":
      return { inicio: subDays(now, 30), fim: now }
    case "este_mes":
      return { inicio: startOfMonth(now), fim: now }
    case "este_ano":
      return { inicio: startOfYear(now), fim: now }
    case "personalizado":
      if (!custom) throw new Error("Período personalizado requer from/to")
      return { inicio: custom.from, fim: custom.to }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Postgres views always bypassing RLS (pre-PG15 "security definer-like" view behavior) | `WITH (security_invoker = true)` view option | Postgres 15 (2022) | Not directly used in this phase's recommended design (RPC functions instead, for parameter support), but relevant if the planner chooses a view for the non-parameterized `clientes_por_etapa` metric — must not omit `security_invoker = true` if a view is used [CITED: supabase.com/docs/guides/database/postgres/row-level-security] |

**Deprecated/outdated:** none specific to this phase's stack — Recharts v3, shadcn/ui Chart, and react-day-picker v10 are all current majors already pinned in this project.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | "Prospecção por produto e por categoria" (DSH-05) should be filtered by `clientes.criado_em` (cadastro date) when the D-01 period filter is applied, rather than shown as an always-current snapshot | Common Pitfalls (Pitfall 5), Open Questions | If wrong, the planner builds the wrong date-filter wiring for 2 of the 5 aggregate functions; low cost to fix (single `WHERE` clause change) but should be confirmed before implementation, not after |
| A2 | "Clientes por etapa" (DSH-01) should be a live snapshot (current counts), NOT filtered by the D-01 period picker at all | Architecture Patterns (Pattern 1), Open Questions | If wrong, `dashboard_clientes_por_etapa()` needs `p_inicio`/`p_fim` params filtering by `criado_em`, changing its signature and the UI's "does the period filter affect this chart?" behavior |
| A3 | shadcn/ui's Chart component installs cleanly with this project's `base-nova` style preset with no manual adaptation | Standard Stack, Package Legitimacy Audit | Low risk — Context7 MCP was unavailable this session so this is WebSearch/WebFetch-sourced rather than tool-verified against the live docs registry; if the chart component turns out to have a Radix-only code path, the planner should budget extra time for the install step and re-check `ui.shadcn.com/docs/components/chart` directly at implementation time |

## Open Questions

1. **What date field, if any, filters "Prospecção por produto e por categoria" (DSH-05) when the D-01 period picker is set?**
   - What we know: D-02 explicitly scopes its date-basis rule ("filtra pela data da mudança de status") to only ganhos/perdidos/conversão. D-01 says the dashboard broadly "has" a period filter but doesn't say every chart obeys it identically.
   - What's unclear: whether DSH-05 should filter by `clientes.criado_em` (when the prospect was registered) or ignore the period filter entirely (always show the current full pipeline breakdown).
   - Recommendation: default to filtering by `criado_em` (Assumption A1) since it's the only sensible date on a `clientes`/`cliente_produtos` row for this purpose, but confirm with the project owner during planning or via a `checkpoint:human-verify` before building the 2 corresponding RPC functions.

2. **Does "Clientes por etapa" (DSH-01) respect the period filter at all, or is it always a live snapshot?**
   - What we know: A "current pipeline state" metric (how many clients sit in each stage right now) doesn't have a clean historical-filter interpretation — filtering by `criado_em` would answer a different question ("of clients registered in this period, where are they now"), and filtering by `etapa_alterada_em` would exclude clients who haven't moved recently even if they're still validly in that stage.
   - What's unclear: CONTEXT.md's D-01/D-04 don't explicitly say.
   - Recommendation: treat as an always-current snapshot, unaffected by the period picker (Assumption A2) — this matches the most common interpretation of a kanban-stage funnel chart in CRM dashboards, and keeps `dashboard_clientes_por_etapa()`'s signature simple (no date params).

3. **Does "Desempenho por vendedor" (DSH-03) mean exactly the same ganho/perdido/conversão numbers as DSH-02, just grouped by `responsavel`, or does it include additional signals (e.g. número de clientes cadastrados, tarefas concluídas)?**
   - What we know: CONTEXT.md's D-06 only specifies the chart shape (horizontal bars, one per vendedor), not the metric.
   - What's unclear: the exact value plotted per bar.
   - Recommendation: default to the same ganho/perdido counts as DSH-02, grouped by `responsavel` (Pattern 3) — the phase goal statement ("dando ao Supervisor a informação gerencial que faltava") most directly maps to "who is winning/losing deals," which is exactly the ganho/perdido breakdown; confirm with the project owner if a richer "performance" definition (e.g. weighted by number of active clients) is expected instead.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| `recharts` (npm) | Chart rendering (all D-04/D-05/D-06 visuals) | Not yet installed in this repo | 3.9.2 confirmed available on npm registry [VERIFIED: npm registry] | Installed automatically by `npx shadcn@latest add chart` — no manual fallback needed |
| Supabase CLI / local Postgres | New migration `000X_dashboard_aggregates.sql` (RPC functions), tested against real RLS | Not probed this session (no shell access to verify `supabase status`) — assume same as prior phases (Phase 1-3 all used `supabase db push` successfully per SUMMARY.md files) | — | If unavailable, `supabase link`/`supabase db push` following the same procedure already used for `0001`/`0002` migrations |
| Context7 MCP | Authoritative shadcn/Recharts doc lookups | Not available this session (`mcp__context7__resolve-library-id` returned "No such tool available") | — | WebSearch + direct `WebFetch` of `ui.shadcn.com` used instead; confidence tagged MEDIUM/CITED rather than VERIFIED/HIGH as a result — see Assumptions Log A3 |

**Missing dependencies with no fallback:** none — every dependency either has a working fallback or is already installed.

**Missing dependencies with fallback:** `recharts` (installed via shadcn CLI), Context7 (WebSearch/WebFetch fallback used).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (already configured) |
| Config file | `vitest.config.ts` — `include: ["tests/**/*.test.ts"]`, loads `.env`/`.env.local` for real Supabase credentials |
| Quick run command | `npx vitest run tests/dashboard/ -t "<test name>"` |
| Full suite command | `npx vitest run tests/dashboard/` (run in isolation from other `tests/**` directories — this project's established constraint is Supabase free-tier auth sign-in rate limiting when running many `signInAs()`-based RLS tests in one invocation, documented since `02-01-SUMMARY.md`; batch 2-3 files at a time like every prior phase) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| DSH-01 | `dashboard_clientes_por_etapa()` returns correct per-etapa counts | unit/integration | `npx vitest run tests/dashboard/clientes-por-etapa.test.ts` | ❌ Wave 0 |
| DSH-02 | `dashboard_ganhos_perdidos()` counts only status-change events inside `[p_inicio, p_fim)`, using `historico`, not `etapa_alterada_em` | unit/integration | `npx vitest run tests/dashboard/ganhos-perdidos.test.ts` | ❌ Wave 0 |
| DSH-02 | Conversão computed correctly as `ganho / (ganho + perdido)` | unit | `npx vitest run tests/dashboard/conversao.test.ts` | ❌ Wave 0 |
| DSH-03 | `dashboard_desempenho_vendedor()` groups by `responsavel` correctly | unit/integration | `npx vitest run tests/dashboard/desempenho-vendedor.test.ts` | ❌ Wave 0 |
| DSH-04 | Taxa de conversão matches DSH-02's ganho/perdido split | unit | covered by the DSH-02 conversão test above | ❌ Wave 0 |
| DSH-05 | `dashboard_prospeccao_por_produto`/`_categoria` return correct grouped counts | unit/integration | `npx vitest run tests/dashboard/prospeccao.test.ts` | ❌ Wave 0 |
| DSH-06 | Vendedor B calling any dashboard RPC never sees Vendedor A's rows (RLS proof) | integration (RLS) | `npx vitest run tests/dashboard/rls-dashboard.test.ts` | ❌ Wave 0 |
| DSH-07 | Supervisor calling `dashboard_desempenho_vendedor()` sees all vendedores; Vendedor sees only their own row | integration (RLS) | same file as DSH-06 | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted test file(s) for that task, e.g. `npx vitest run tests/dashboard/ganhos-perdidos.test.ts`
- **Per wave merge:** `npx vitest run tests/dashboard/` (batched per the rate-limit constraint above)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus `npx tsc --noEmit` and `npm run build` per this project's established phase-close checklist (see every prior `0X-0Y-SUMMARY.md`)

### Wave 0 Gaps
- [ ] `tests/dashboard/clientes-por-etapa.test.ts` — covers DSH-01
- [ ] `tests/dashboard/ganhos-perdidos.test.ts` — covers DSH-02, including the double-counting edge case from Pitfall 2 (a client marked perdido then reactivated then ganho should count once, as ganho, in the period of its most recent status-change event)
- [ ] `tests/dashboard/desempenho-vendedor.test.ts` — covers DSH-03
- [ ] `tests/dashboard/prospeccao.test.ts` — covers DSH-05
- [ ] `tests/dashboard/rls-dashboard.test.ts` — covers DSH-06/DSH-07, following the exact `signInAs()` cross-vendedor pattern already established in `tests/clientes/rls-clientes.test.ts` and `tests/clientes/funil-status.test.ts`
- [ ] `lib/dashboard/periodo.test.ts` (or folded into an existing test file) — pure unit test of `resolvePeriodo()`'s preset math, no Supabase needed
- [ ] Framework install: none — Vitest already configured project-wide

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No (new surface) | Existing Supabase Auth session check, reused verbatim from every other `app/(app)/*` page |
| V3 Session Management | No (new surface) | Existing `createClient()`/cookie session handling, unchanged |
| V4 Access Control | Yes | RLS on `clientes`/`historico`/`cliente_produtos` (already in place from Phase 2), enforced automatically inside every SECURITY INVOKER dashboard function — no new access-control code, but the *absence* of `security definer` is itself the control (Pitfall 4) |
| V5 Input Validation | Yes | `p_inicio`/`p_fim` are `timestamptz` parameters bound via `supabase.rpc()`, not string-interpolated SQL — Postgres's typed RPC parameter binding is the injection defense, same posture as `mover_card_funil`'s existing typed parameters |
| V6 Cryptography | No | Not applicable — no new secrets/crypto in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| A Vendedor calls a dashboard RPC directly (bypassing the UI) hoping to see another vendedor's aggregated numbers | Information Disclosure | SECURITY INVOKER (not DEFINER) on every dashboard function — RLS on `clientes`/`historico` transparently narrows the result set to the caller's own rows, exactly as already proven for `getClientesAgrupadosPorEtapa()`. Must be proven by an explicit cross-vendedor RLS test (see `tests/dashboard/rls-dashboard.test.ts` above), not assumed. |
| A new function accidentally marked `security definer` re-opens full-table visibility | Elevation of Privilege | Code-review checklist item (Pitfall 4): any `security definer` on a new function touching `clientes`/`historico` requires explicit justification in a comment, mirroring `is_supervisor()`'s own documented reason for using it |
| SQL injection via period parameters | Tampering | Not exploitable — `supabase.rpc()` binds `p_inicio`/`p_fim` as typed parameters, never string-concatenated into a query; no raw SQL construction anywhere in this phase's design |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/0001_profiles_and_roles.sql`, `0002_clientes_and_funil.sql` — read directly, ground truth for `historico`/`clientes` schema, trigger logic, existing RLS policies, and the `mover_card_funil` SECURITY INVOKER precedent [VERIFIED: codebase]
- `lib/supabase/queries/clientes.ts`, `components/clientes/ClienteDetailSheet.tsx`, `components/ui/calendar.tsx`, `app/(app)/layout.tsx` — read directly for existing patterns to mirror [VERIFIED: codebase]
- `npm view recharts version` / `npm view shadcn version` — direct registry queries [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- `ui.shadcn.com/docs/components/chart` — fetched directly via WebFetch [CITED: ui.shadcn.com]
- `ui.shadcn.com/docs/components/date-picker` — fetched directly via WebFetch [CITED: ui.shadcn.com]
- WebSearch synthesis on Postgres `security_invoker` views, cross-referencing `supabase.com/docs/guides/database/postgres/row-level-security` [CITED: supabase.com]
- WebSearch synthesis on Recharts `layout="vertical"` horizontal-bar API, cross-referencing `recharts.github.io/en-US/api/BarChart` and `github.com/recharts/recharts/issues/90` [CITED: recharts.github.io]

### Tertiary (LOW confidence)
- None — Context7 MCP was unavailable this session (see Environment Availability), so all non-codebase claims were escalated to direct WebFetch of official docs where possible rather than left at raw WebSearch synthesis.

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — Recharts/shadcn version numbers are registry-VERIFIED; component API details are WebFetch/WebSearch-CITED (Context7 unavailable this session)
- Architecture: HIGH for the RLS/SECURITY INVOKER pattern (directly derived from this project's own existing, already-shipped `mover_card_funil`/`is_supervisor()` code) — MEDIUM for the exact RPC function bodies (novel to this phase, not yet executed against a real database)
- Pitfalls: HIGH for Pitfall 1/2/4 (derived directly from reading the actual trigger source, not assumed) — MEDIUM for Pitfall 5 (a scope-ambiguity finding, not a technical pitfall)

**Research date:** 2026-07-18
**Valid until:** 2026-08-17 (30 days — stable stack, no fast-moving dependencies)
