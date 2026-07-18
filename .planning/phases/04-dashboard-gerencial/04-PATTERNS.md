# Phase 4: Dashboard Gerencial - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** 13
**Analogs found:** 9 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0003_dashboard_aggregates.sql` | migration | CRUD (read-only SQL functions) | `supabase/migrations/0002_clientes_and_funil.sql` (`mover_card_funil` RPC + triggers) | role-match |
| `lib/supabase/queries/dashboard.ts` | service (query layer) | request-response (typed `.rpc()` reads) | `lib/supabase/queries/clientes.ts` | exact |
| `app/actions/dashboard.ts` | controller (Server Action wrappers) | request-response | `app/actions/funil.ts` | exact |
| `lib/dashboard/periodo.ts` | utility (pure functions) | transform | `lib/funil/staleness.ts` / `lib/funil/etapas.ts` | exact |
| `app/(app)/dashboard/page.tsx` | route (Server Component page) | request-response | `app/(app)/layout.tsx` (auth guard) + existing `app/(app)/*/page.tsx` screens (e.g. `app/(app)/clientes/page.tsx`, `app/(app)/configuracoes/page.tsx`) | role-match |
| `app/(app)/layout.tsx` (MODIFIED — add "Dashboard" nav link) | route/provider (nav shell) | request-response | itself (existing file, extend in place) | exact |
| `components/dashboard/DashboardClient.tsx` | component (Client Component orchestrator) | request-response (client-side fetch orchestration) | `components/configuracoes/ConfiguracoesTabs.tsx` (state + child-fetch orchestration) | role-match |
| `components/dashboard/PeriodoFilter.tsx` | component | event-driven (UI state -> triggers re-fetch) | `ClienteDetailSheet.tsx`'s Popover+Calendar composition (lines ~1012-1025) | role-match |
| `components/dashboard/ClientesPorEtapaChart.tsx` | component | request-response (renders fetched data) | none in-repo (first chart) — ground in RESEARCH.md Pattern 5 | no analog |
| `components/dashboard/GanhosPerdidosCards.tsx` | component | request-response | shadcn `Card` usage patterns in `components/clientes/*` (e.g. stat-like badges), but no big-number precedent — ground in UI-SPEC Typography "Stat" waiver | no analog |
| `components/dashboard/DesempenhoVendedorChart.tsx` | component | request-response | none in-repo — ground in RESEARCH.md Pattern 4 | no analog |
| `components/dashboard/ProspeccaoChart.tsx` | component | request-response | none in-repo (reused for produto + categoria) — ground in RESEARCH.md Pattern 4 | no analog |
| `tests/dashboard/*.test.ts` (5 files) | test | request-response / integration (RLS) | `tests/clientes/rls-clientes.test.ts` / `tests/clientes/funil-status.test.ts` | exact |

## Pattern Assignments

### `supabase/migrations/0003_dashboard_aggregates.sql` (migration)

**Analog:** `supabase/migrations/0002_clientes_and_funil.sql` — specifically the `mover_card_funil` function header/signature and the `clientes_after_update_historico()` trigger (source of the `descricao` format string dashboard aggregates must `ILIKE` against).

**Core pattern — SECURITY INVOKER SQL function, no RLS bypass:**
```sql
-- mover_card_funil deliberately has NO "security definer" clause, so it runs
-- as the calling user and every internal UPDATE is scoped by clientes' RLS
-- policies. Dashboard aggregate functions must follow the exact same rule:
create or replace function dashboard_clientes_por_etapa()
returns table(etapa etapa_funil, total bigint)
language sql
stable
as $$
  select etapa, count(*) as total
  from clientes
  group by etapa;
$$;
-- No "security definer" -> RLS on `clientes` (vendedor sees own rows,
-- supervisor sees all) transparently scopes this aggregate. Never add
-- security definer here (see RESEARCH.md Pitfall 4).
```

**Historico string-match pattern for ganho/perdido date basis (D-02):**
```sql
-- historico.descricao is always exactly:
-- format('Status alterado para "%s"', new.status_acompanhamento::text)
-- written only by clientes_after_update_historico() — this trigger is the
-- ONLY writer, so ILIKE matching against this fixed format is reliable.
where h.tipo = 'status_acompanhamento'
  and (h.descricao ilike '%"ganho"%' or h.descricao ilike '%"perdido"%')
```

**Migration file convention:** new file only, never edit `0001`/`0002` — same rule already followed for `0002`; naming continues the `000N_snake_case_description.sql` sequence (`0003_dashboard_aggregates.sql`).

---

### `lib/supabase/queries/dashboard.ts` (service, request-response)

**Analog:** `lib/supabase/queries/clientes.ts`

**Imports pattern** (lines 1-7):
```typescript
import { ETAPA_KEYS, type EtapaKey } from "@/lib/funil/etapas"
import { createClient } from "@/lib/supabase/server"
```

**Read-query pattern** (mirrors `getClientesAgrupadosPorEtapa()`, lines 216-297, and `getCategoriasAtivas()`, lines 423-434): create client, query/RPC, map raw row shape to a typed return shape, throw on hard error for group-shaping calls, return `[]`/safe default on lookup-style calls. For dashboard RPCs, follow `getClientesAgrupadosPorEtapa`'s "throw on error" posture (a dashboard chart that silently renders empty on a real error is worse than an explicit failed-fetch state per UI-SPEC's per-card error handling):
```typescript
export async function getClientesPorEtapa(): Promise<{ etapa: EtapaKey; total: number }[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_clientes_por_etapa")
  if (error) {
    throw new Error(`Falha ao carregar clientes por etapa: ${error.message}`)
  }
  return (data ?? []) as { etapa: EtapaKey; total: number }[]
}
```

**No manual role/responsavel filtering** — same principle as `getClientesAgrupadosPorEtapa()`'s comment (lines 203-207): RLS on `clientes`/`historico` scopes every RPC result automatically; never add a client-side `.eq("responsavel", ...)` filter here.

**Etapa label mapping** — reuse `ETAPA_KEYS`/`ETAPAS` from `lib/funil/etapas.ts` for chart x-axis labels; do not hardcode a second etapa->label map (RESEARCH.md Anti-Pattern, UI-SPEC screen note).

---

### `app/actions/dashboard.ts` (controller, request-response)

**Analog:** `app/actions/funil.ts`

**Imports pattern** (lines 1-13):
```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import {
  getClientesPorEtapa,
  getGanhosPerdidos,
  // ... other dashboard.ts query functions
} from "@/lib/supabase/queries/dashboard"
```

**Thin Server Action wrapper pattern** (mirrors `getHistoricoAction`/`getMotivosPerda`, lines 185-219 of `funil.ts` — auth-check + delegate to the query-layer function, since dashboard's Client Components need Server Actions to call functions that depend on `next/headers`' `cookies()`):
```typescript
export type GetGanhosPerdidosResult =
  | { data: { status: "ganho" | "perdido"; total: number }[]; error?: undefined }
  | { data?: undefined; error: { code: "unauthenticated" | "fetch_falhou"; message: string } }

export async function getGanhosPerdidosAction(
  inicio: Date,
  fim: Date
): Promise<GetGanhosPerdidosResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }
  try {
    return { data: await getGanhosPerdidos(inicio, fim) }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message: "Não foi possível carregar os dados do dashboard. Tente novamente.",
      },
    }
  }
}
```

**Error handling pattern:** discriminated-union result type (`{ data } | { error: { code, message } }`), never a thrown exception across the Server Action boundary — matches `MoverCardResult`/`MarcarStatusResult` (lines 20-22, 99-101 of `funil.ts`). Each dashboard metric gets its own action + own error code, so one failed metric's error state (per UI-SPEC's "one failed metric must not blank the whole screen") maps 1:1 to one action call failing independently.

**No `revalidatePath`** needed here (unlike `moverCard`/`marcarStatus`) — this phase is read-only, no mutation to invalidate a cached path for.

---

### `lib/dashboard/periodo.ts` (utility, transform)

**Analog:** `lib/funil/etapas.ts` / `lib/funil/staleness.ts` — dependency-free module convention (no Supabase/`next/headers` import, safe for Client Components).

**Pattern:**
```typescript
// Source: date-fns API, already the project's date library (see
// lib/funil/staleness.ts for the "pure function, no next/headers import"
// convention this module also follows — Client Components import it directly).
import { startOfMonth, startOfYear, subDays } from "date-fns"

export type PeriodoPreset = "30dias" | "este_mes" | "este_ano" | "personalizado"

export function resolvePeriodo(
  preset: PeriodoPreset,
  custom?: { from: Date; to: Date }
): { inicio: Date; fim: Date } {
  // ... (see RESEARCH.md Code Examples section for full body)
}
```

---

### `app/(app)/dashboard/page.tsx` (route, request-response)

**Analog:** `app/(app)/layout.tsx`'s auth-guard block (lines 19-45), applied at page level following the pattern every other `app/(app)/*/page.tsx` Server Component uses (auth already guarded at layout level — this page just reads `profile.role` again for the role-aware subtitle/conditional block, same as layout.tsx lines 34-38, 61-76).

**Core pattern:**
```typescript
import { createClient } from "@/lib/supabase/server"
import { DashboardClient } from "@/components/dashboard/DashboardClient"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // layout.tsx already redirects if !user; page can assume user exists,
  // but re-fetch role for the subtitle + Supervisor-only block gating
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single()

  return <DashboardClient isSupervisor={profile?.role === "supervisor"} />
}
```

**Role-aware conditional block** — reuse the exact `profile?.role === "supervisor"` conditional already used in `app/(app)/layout.tsx` lines 61-76 for "Gerenciar equipe"/"Configurações" nav links; pass as a boolean prop into the Client Component rather than re-deriving role client-side.

---

### `app/(app)/layout.tsx` (MODIFIED)

**Analog:** itself — add a new `<Link>` following the exact structure of the existing "Clientes" link (lines 55-60), visible to both roles (unlike the Supervisor-only links):
```typescript
<Link
  href="/dashboard"
  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
>
  Dashboard
</Link>
```
Insert directly after the "Clientes" link (line 60), before the Supervisor-only conditional links, since UI-SPEC states "Dashboard" is visible to both roles.

---

### `components/dashboard/DashboardClient.tsx` (component, request-response orchestration)

**Analog:** `components/configuracoes/ConfiguracoesTabs.tsx`

**Pattern to copy:** `"use client"` directive at top; holds shared state (here: período/date-range) and passes it down to child components that each independently fetch (mirrors how `ConfiguracoesTabs` passes `tabela` down to each `EditableListTab`, which independently fetches its own rows). Each chart/KPI child component owns its own loading/error/empty state — do not centralize fetch state in `DashboardClient` itself, so one failed metric doesn't blank the page (UI-SPEC requirement, matches the `EditableListTab`-per-tab independent-fetch precedent).

---

### `components/dashboard/PeriodoFilter.tsx` (component, event-driven)

**Analog:** `components/clientes/ClienteDetailSheet.tsx` lines 1010-1026 (single-date Popover+Calendar), extended to `mode="range"`.

**Imports pattern:**
```typescript
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
```

**Core pattern (range variant, per RESEARCH.md Pattern 6):**
```typescript
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
Same `PopoverTrigger` className convention as `ClienteDetailSheet.tsx` line 1013 (`"w-fit rounded-lg border border-input px-2.5 py-1.5 text-left text-sm"`) — copy verbatim for visual consistency.

---

### `components/dashboard/ClientesPorEtapaChart.tsx` / `DesempenhoVendedorChart.tsx` / `ProspeccaoChart.tsx` / `GanhosPerdidosCards.tsx` — NO IN-REPO ANALOG

This is the project's first data-visualization screen — no existing Recharts/shadcn Chart usage anywhere in the codebase. Ground these 4 files entirely in `04-RESEARCH.md`:
- Pattern 5 (vertical bars) for `ClientesPorEtapaChart.tsx`
- Pattern 4 (horizontal bars) for `DesempenhoVendedorChart.tsx` and `ProspeccaoChart.tsx`
- Pitfall 3 (always pass a sizing class, e.g. `h-[280px] w-full`, on `ChartContainer` — Recharts' `ResponsiveContainer` renders zero-height otherwise)
- `04-UI-SPEC.md` Typography section for the KPI "Stat" 36px waiver used in `GanhosPerdidosCards.tsx`
- `04-UI-SPEC.md` Color section for `--chart-1` override to `--primary` blue

Reuse `Card`/`CardHeader`/`CardContent`/`Skeleton` primitives (already installed) for the container shell around each chart — that part does have precedent throughout `components/clientes/*` and `components/configuracoes/*`, just not the chart body itself.

---

## Shared Patterns

### Auth / RLS boundary
**Source:** `app/actions/funil.ts` (no `security definer`, RLS-scoped `.from()`/`.rpc()` calls) + `supabase/migrations/0002_clientes_and_funil.sql`'s `mover_card_funil` (SECURITY INVOKER by omission)
**Apply to:** `supabase/migrations/0003_dashboard_aggregates.sql` (all 5 functions), `lib/supabase/queries/dashboard.ts`
Never add `security definer`; never add a manual `responsavel = auth.uid()` filter in application code — RLS on `clientes`/`historico` is the single source of truth (per CLAUDE.md and RESEARCH.md Pitfall 4).

### Server Action error-result shape
**Source:** `app/actions/funil.ts` — `MoverCardResult`/`MarcarStatusResult` discriminated unions (lines 20-22, 99-101)
**Apply to:** all `app/actions/dashboard.ts` functions — `{ data } | { error: { code, message } }`, never a thrown exception crossing the Server Action boundary.

### Role-aware conditional rendering
**Source:** `app/(app)/layout.tsx` lines 61-76 (`profile?.role === "supervisor"` conditional for nav links)
**Apply to:** `app/(app)/dashboard/page.tsx` (subtitle text + gating `DesempenhoVendedorChart` entirely for Vendedor, not shown disabled).

### Popover + Calendar composition
**Source:** `components/clientes/ClienteDetailSheet.tsx` lines 1012-1025 (single-date) and 932-961
**Apply to:** `components/dashboard/PeriodoFilter.tsx` (extended to `mode="range"`, `numberOfMonths={2}`, per RESEARCH.md Pattern 6).

### Dependency-free pure-function modules (Client-Component-safe)
**Source:** `lib/funil/etapas.ts`, `lib/funil/staleness.ts` — no `next/headers`/Supabase import, safe to import from both Server and Client Components
**Apply to:** `lib/dashboard/periodo.ts`.

### Tabs `keepMounted` fix
**Source:** `components/configuracoes/ConfiguracoesTabs.tsx` lines 59-69 (comment explains the Base UI `TabsPanel` unmount-on-switch bug)
**Apply to:** N/A for this phase directly (Dashboard has no Tabs component in the UI-SPEC — Select is used for period presets instead) — flagged here only in case a future revision adds a Tabs-based view toggle; not required by current scope.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `components/dashboard/ClientesPorEtapaChart.tsx` | component | request-response | No Recharts/shadcn Chart usage exists anywhere in the codebase yet — first data-viz screen. Ground in RESEARCH.md Pattern 5. |
| `components/dashboard/DesempenhoVendedorChart.tsx` | component | request-response | Same as above. Ground in RESEARCH.md Pattern 4. |
| `components/dashboard/ProspeccaoChart.tsx` | component | request-response | Same as above. Ground in RESEARCH.md Pattern 4. |
| `components/dashboard/GanhosPerdidosCards.tsx` | component | request-response | No big-number/hero-stat precedent in the codebase; ground in UI-SPEC's Typography "Stat" 36px approved waiver and Color section (Success/Destructive tokens reused from Phase 2 status badges). |

## Metadata

**Analog search scope:** `app/actions/`, `lib/supabase/queries/`, `app/(app)/`, `components/clientes/`, `components/configuracoes/`, `lib/funil/`, `supabase/migrations/`, `tests/clientes/`
**Files scanned:** `app/actions/funil.ts`, `lib/supabase/queries/clientes.ts`, `app/(app)/layout.tsx`, `components/configuracoes/ConfiguracoesTabs.tsx`, `components/clientes/ClienteDetailSheet.tsx`, `lib/funil/etapas.ts`, `supabase/migrations/0002_clientes_and_funil.sql` (referenced via RESEARCH.md's direct reads)
**Pattern extraction date:** 2026-07-18
