# Phase 12: Comparativo por Vendedor - Pattern Map

**Mapped:** 2026-08-03
**Files analyzed:** 7 (1 new migration, 2 extended files, 1 new component, 1 edited component, 2 test files — 1 extended, 1 new)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `supabase/migrations/0011_dashboard_comparativo_vendedor.sql` | migration | CRUD (read-only aggregation) | `supabase/migrations/0009_dashboard_funil_detalhado.sql` (most recent dashboard RPC migration) + `0003_dashboard_aggregates.sql` (SECURITY INVOKER banner, `group by responsavel` precedent) | exact |
| `lib/supabase/queries/dashboard.ts` (extend) | service (typed RPC reader) | CRUD (read) | itself — existing `getFunilDetalhado`/`getDesempenhoVendedor` functions in the same file | exact |
| `app/actions/dashboard.ts` (extend) | service (Server Action) | request-response | itself — existing `getFunilDetalhadoAction` (no-arg shape) in the same file | exact |
| `components/dashboard/ComparativoVendedorTable.tsx` (new) | component (Client Component, table) | request-response (fetch-on-mount + render) | `components/dashboard/FunilDetalhadoTable.tsx` (table structure, `FetchState`, loading/error/empty, tooltip pattern) | exact |
| `components/dashboard/DashboardClient.tsx` (edit in place) | component (Client orchestrator) | request-response (composition only) | itself — existing file, edited in place | exact |
| `tests/dashboard/rls-dashboard.test.ts` (extend) | test | integration (real Supabase RPC calls, RLS negative case) | itself — existing `Promise.all` before/after arrays + the `dashboard_funil_detalhado` dedicated cross-vendedor `it()` block | exact |
| `tests/dashboard/comparativo-vendedor.test.ts` (new) | test | integration (RPC behavior, disposable fixtures) | `tests/equipe/reassignment.test.ts` (`createTestMember`/`deleteTestMember` fixture pattern + FK-ordered teardown) + `tests/dashboard/rls-dashboard.test.ts` (seeding helpers: `uniqueRazaoSocial`, `baseClienteFields`, `serviceClient`) | exact (composite of two analogs) |

## Pattern Assignments

### `supabase/migrations/0011_dashboard_comparativo_vendedor.sql` (migration, CRUD/read-only aggregation)

**Analog:** `supabase/migrations/0009_dashboard_funil_detalhado.sql` (most recent dashboard RPC migration) and `supabase/migrations/0003_dashboard_aggregates.sql` (original SECURITY INVOKER banner + `group by c.responsavel` precedent from `dashboard_desempenho_vendedor`).

**Numbering confirmed:** `ls supabase/migrations/` currently ends at `0010_fix_dashboard_funil_detalhado_avancou_pct.sql` — `0011` is the correct next sequential number (re-confirm immediately before naming the file, per the project's own numbering-caution convention carried from Phase 11's pattern map).

**`SECURITY INVOKER` banner comment to copy verbatim in spirit** (`0003_dashboard_aggregates.sql` lines 17-32, same text every dashboard migration since has echoed):
```sql
-- ─────────────────────────────────────────────────────────────────────────
-- SECURITY INVOKER by omission — dashboard_comparativo_vendedor() below
-- deliberately has NO "security definer" clause, mirroring every other
-- dashboard_* function. It runs as the CALLING user, so every internal
-- SELECT against clientes/historico is transparently scoped by RLS.
--
-- NEVER add "security definer" here: it would silently bypass RLS and
-- start returning every vendedor's real numbers to every caller. Proven by
-- tests/dashboard/rls-dashboard.test.ts and
-- tests/dashboard/comparativo-vendedor.test.ts, which fail loudly if this
-- rule is ever violated.
--
-- NOTE: profiles has an OPEN, unconditional SELECT RLS policy for every
-- authenticated user (0001_profiles_and_roles.sql, `using (true)`) — the
-- vendedores_ativos CTE below is therefore never narrowed by the caller's
-- own role. This is pre-existing behavior (also relied on by
-- lib/equipe/membros.ts and dashboard_desempenho_vendedor()'s own `left
-- join profiles`), not a new leak introduced here. Do not add a role check.
-- ─────────────────────────────────────────────────────────────────────────
```

**Full RPC — copy this SQL verbatim as the starting draft (already synthesized against this schema in RESEARCH.md's Code Examples section)**:
```sql
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
    -- CONTEXT.md discretion bullet 3: ONLY this CTE applies the ativo=true
    -- filter. Nothing below it is allowed to re-apply it.
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
    -- Single GROUP BY over ONE clientes row set (percentage-math guard,
    -- same principle as 0010's avancou_pct fix) — negocios_iniciados,
    -- ganho, perdido all derive from the same rows.
    select
      c.responsavel,
      count(*) as negocios_iniciados,
      count(*) filter (where f.status_evento = 'ganho') as ganho,
      count(*) filter (where f.status_evento = 'perdido') as perdido,
      -- Ciclo médio: GANHO-ONLY basis (D-04 — resolved with user).
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
  order by v.nome;      -- alphabetical, matches UI-SPEC's locked row order
$$;
-- No `security definer` — do not add one.
```

**Anti-pattern reminders specific to this migration (do not violate):**
- Never add `security definer`.
- Never re-apply `and p.ativo = true` (or a join through `vendedores_ativos`) inside the `agregados` CTE — a deactivated vendedor's `clientes`/`historico` rows must keep counting in every OTHER dashboard RPC untouched by this phase.
- `taxa_conversao` is NEVER computed in this SQL — return raw `ganho`/`perdido` and let `lib/dashboard/periodo.ts`'s `taxaConversao()` compute it client-side (D-03).

---

### `lib/supabase/queries/dashboard.ts` (extend — typed RPC reader)

**Analog:** itself — `getFunilDetalhado` (lines 172-202, no-arg RPC reader with multiple nullable numeric columns) is the closest match; `getDesempenhoVendedor` (lines 74-101) is the closest match for the `responsavel`/`responsavel_nome` row shape.

**Import to add** (extend the top-of-file import block, line 1-2 — add `taxaConversao`):
```typescript
import { taxaConversao } from "@/lib/dashboard/periodo"
```

**New type + reader to add, following the exact bigint-as-string normalization convention already used by every function in this file** (see file-level comment lines 20-22 — `PostgREST` serializes `bigint`/`numeric` as JSON strings):
```typescript
export type ComparativoVendedorRow = {
  responsavel: string
  responsavelNome: string | null
  negociosIniciados: number
  ganho: number
  perdido: number
  cicloMedioDias: number | null
  taxaConversao: number | null   // computed here via taxaConversao(), never returned by SQL
}

/** VEND-01: live snapshot, whole history, no period parameters (D-01/D-02). */
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

---

### `app/actions/dashboard.ts` (extend — Server Action)

**Analog:** itself — `getFunilDetalhadoAction` (lines 188-214), the closest match since both are no-arg actions with the identical auth-check-then-try/catch shape.

**Imports to extend** (lines 4-18 — add to the existing `from "@/lib/supabase/queries/dashboard"` block, don't add a second import statement):
```typescript
import {
  getClientesPorEtapa,
  getComparativoVendedor,       // NEW
  getDesempenhoVendedor,
  getFunilDetalhado,
  getGanhosPerdidos,
  getProspeccaoPorCategoria,
  getProspeccaoPorProduto,
  getTempoAteFechamento,
  type ClientesPorEtapaRow,
  type ComparativoVendedorRow,   // NEW
  type DesempenhoVendedorRow,
  type FunilDetalhadoRow,
  type GanhosPerdidosRow,
  type ProspeccaoRow,
  type TempoAteFechamentoRow,
} from "@/lib/supabase/queries/dashboard"
```

**No-arg Server Action to add, copied verbatim in shape from `getFunilDetalhadoAction`** (same `DashboardErrorCode` union already declared at line 34, same "unauthenticated" guard, same generic catch → "fetch_falhou" mapping and exact copy string):
```typescript
export type GetComparativoVendedorResult =
  | { data: ComparativoVendedorRow[]; error?: undefined }
  | { data?: undefined; error: { code: DashboardErrorCode; message: string } }

/** VEND-01 — live snapshot, no period parameter; Supervisor-only gate lives in DashboardClient, not here. */
export async function getComparativoVendedorAction(): Promise<GetComparativoVendedorResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    return { data: await getComparativoVendedor() }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message:
          "Não foi possível carregar os dados do dashboard. Tente novamente.",
      },
    }
  }
}
```

No new `DashboardErrorCode` values needed — reuses the existing `"unauthenticated" | "fetch_falhou"` union declared once at line 34.

---

### `components/dashboard/ComparativoVendedorTable.tsx` (new — VEND-01 table)

**Analog:** `components/dashboard/FunilDetalhadoTable.tsx` (full file read, 231 lines) — near-exact structural transplant: same `FetchState` union, same fetch-effect scaffold, same Card/loading/error/empty branching, same null-guard formatters. Differences: 5 columns instead of 5-but-different (Vendedor/Taxa/Iniciados/Ganhos/Ciclo, not Etapa/Quantidade/%Avançou/Perdidos/Tempo), row source is the RPC's own row list (no fixed `ETAPAS` array to always-render — UI-SPEC's empty state instead governs the "no active vendedores" case), and no `gargalo`/`border-l-4`/`Badge` treatment (UI-SPEC explicitly rules this out — every row renders identically).

**Imports to copy, dropping `Badge`/`TriangleAlert`/`ETAPAS` (not needed — no gargalo concept), adding `ComparativoVendedorRow`**:
```tsx
"use client"

import { useEffect, useState } from "react"
import { CircleHelp } from "lucide-react"

import { getComparativoVendedorAction } from "@/app/actions/dashboard"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ComparativoVendedorRow } from "@/lib/supabase/queries/dashboard"

const integerFormatter = new Intl.NumberFormat("pt-BR")
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Null-guard-returns-em-dash: never fabricate "0,0%" for a vendedor with 0 negócios decididos. */
function formatPct(value: number | null): string {
  if (value === null) return "—"
  return `${percentFormatter.format(value)}%`
}

/** Same null-guard convention applied to the "Ciclo médio (dias)" column. */
function formatDias(value: number | null): string {
  if (value === null) return "—"
  return `${percentFormatter.format(value)} dias`
}
```

**Fetch-effect scaffold to copy exactly** (`FunilDetalhadoTable.tsx` lines 58-119 — same `FetchState` discriminated union, same `reloadKey` retry mechanism, same `eslint-disable-next-line react-hooks/set-state-in-effect` comment, `[reloadKey]` deps since this RPC takes zero arguments):
```tsx
type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: ComparativoVendedorRow[] }

export function ComparativoVendedorTable() {
  const [state, setState] = useState<FetchState>({ status: "loading" })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" })

    getComparativoVendedorAction().then((result) => {
      if (cancelled) return

      if (result.error) {
        setState({ status: "error" })
        return
      }

      setState({ status: "ready", rows: result.data })
    })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // ...
}
```

**Card shell + heading/caption to copy exactly, swapping copy per UI-SPEC's Copywriting Contract** (`FunilDetalhadoTable.tsx` lines 129-138):
```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-[20px] font-semibold">
      Comparativo por vendedor
    </CardTitle>
    <CardDescription>
      Histórico completo — não é afetado pelo filtro de período
    </CardDescription>
  </CardHeader>
  <CardContent>{/* table or loading/error/empty branch */}</CardContent>
</Card>
```

**Loading/error/empty branch structure to copy exactly** (`FunilDetalhadoTable.tsx` lines 140-159 — `h-[320px]` per UI-SPEC's confirmed table-card skeleton height, same exact retry copy; empty condition changes from `totalQuantidade === 0` to `state.rows.length === 0`, and the empty copy changes per UI-SPEC):
```tsx
{state.status === "loading" ? (
  <Skeleton className="h-[320px] w-full" />
) : state.status === "error" ? (
  <div className="flex h-[320px] w-full flex-col items-center justify-center gap-3 text-center">
    <p className="text-sm text-muted-foreground">
      Não foi possível carregar os dados do dashboard. Tente novamente.
    </p>
    <Button
      type="button"
      variant="outline"
      onClick={() => setReloadKey((key) => key + 1)}
    >
      Tentar novamente
    </Button>
  </div>
) : state.rows.length === 0 ? (
  <div className="flex h-[320px] w-full items-center justify-center text-center text-sm text-muted-foreground">
    Nenhum vendedor ativo no momento.
  </div>
) : (
  /* Table goes here */
)}
```

**Table markup — 5 columns, no fixed-array-of-7 iteration (unlike FunilDetalhadoTable's `ETAPAS.map`), just render `state.rows` in the order the RPC already returned (RPC's own `order by v.nome`, never re-sorted client-side per UI-SPEC)**:
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Vendedor</TableHead>
      <TableHead>Taxa de conversão</TableHead>
      <TableHead>Negócios iniciados</TableHead>
      <TableHead>Negócios ganhos</TableHead>
      <TableHead>
        <div className="flex items-center gap-1">
          Ciclo médio (dias)
          <Tooltip>
            <TooltipTrigger
              className="inline-flex shrink-0 items-center bg-transparent p-0"
              aria-label="Considera só os negócios ganhos — não inclui os negócios perdidos."
            >
              <CircleHelp className="size-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              Considera só os negócios ganhos — não inclui os negócios perdidos.
            </TooltipContent>
          </Tooltip>
        </div>
      </TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {state.rows.map((row) => (
      <TableRow key={row.responsavel}>
        <TableCell className="font-medium">{row.responsavelNome}</TableCell>
        <TableCell>{formatPct(row.taxaConversao)}</TableCell>
        <TableCell>{integerFormatter.format(row.negociosIniciados)}</TableCell>
        <TableCell>{integerFormatter.format(row.ganho)}</TableCell>
        <TableCell>{formatDias(row.cicloMedioDias)}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

Notes carried from UI-SPEC (do not deviate):
- "Negócios iniciados"/"Negócios ganhos" columns are ALWAYS a plain integer, NEVER "—" (a real 0 is informative, unlike `FunilDetalhadoTable`'s "Perdidos" column which does use "—" when `quantidade === 0`).
- No `border-l-4`/`Badge`/`TriangleAlert` gargalo-style treatment anywhere — every row renders with default `TableRow` styling (UI-SPEC explicitly rules this out for this component).
- No role check inside this component — it assumes it is only ever mounted for a Supervisor (matches `DesempenhoVendedorChart`'s precedent); `DashboardClient` owns the `isSupervisor` gate.
- No client-side `.filter(v => v.ativo)` or re-sort — the RPC's `vendedores_ativos` CTE and `order by v.nome` are the single source of truth; render `state.rows` as-is.

---

### `components/dashboard/DashboardClient.tsx` (edit in place)

**Analog:** itself (full file read, 117 lines).

**Import to add** (extend the existing import block, lines 9-15 — alphabetical position after `ClientesPorEtapaChart`, before `DesempenhoVendedorChart`):
```typescript
import { ComparativoVendedorTable } from "@/components/dashboard/ComparativoVendedorTable"
```

**Insertion point** (immediately after `TempoAteFechamentoCards` at line 77, before `GanhosPerdidosCards` at line 81, inside the same `flex flex-col gap-6` stack — extends the existing whole-history/un-period-filtered block, per UI-SPEC's Placement section):
```tsx
        <FunilDetalhadoTable />
        <TempoAteFechamentoCards />
        {/*
          VEND-01 — "Comparativo por vendedor", Supervisor-only, whole-
          history/un-period-filtered like its two block-mates above.
          Same {isSupervisor ? ... : null} gate DesempenhoVendedorChart
          already uses below — RLS is the actual authorization boundary,
          this is a UX nicety on top (no role check inside the RPC or the
          component itself).
        */}
        {isSupervisor ? <ComparativoVendedorTable /> : null}

        {/* KPI row (Ganhos / Perdidos / Taxa de conversão) — DSH-02/DSH-04,
          period-filtered via `periodo`. */}
        <GanhosPerdidosCards inicio={periodo.inicio} fim={periodo.fim} />
```
No prop plumbing needed — `ComparativoVendedorTable` takes no `inicio`/`fim`/`isSupervisor` props (RLS + the RPC's own `vendedores_ativos` CTE handle visibility/filtering; `DashboardClient` only decides WHETHER to mount it).

---

### `tests/dashboard/rls-dashboard.test.ts` (extend — RLS negative case)

**Analog:** itself — the existing `Promise.all` before/after arrays (lines 190-215, 257-280) and the dedicated `dashboard_funil_detalhado grows for the Supervisor...` `it()` block (lines 387-444+), both added in Phase 11 for exactly this same "new zero-arg RPC" situation.

**Extend the before/after `Promise.all` arrays** (lines 190-215 and 257-280 — add `dashboard_comparativo_vendedor` alongside `dashboard_funil_detalhado`/`dashboard_tempo_ate_fechamento`, same zero-argument shape):
```typescript
const [
  beforeEtapa,
  beforeGanhosPerdidos,
  /* ...existing entries... */
  beforeFunilDetalhado,
  beforeTempoFechamento,
  beforeComparativoVendedor,   // NEW
] = await Promise.all([
  vendedorB.rpc("dashboard_clientes_por_etapa"),
  vendedorB.rpc("dashboard_ganhos_perdidos", { p_inicio: window.inicio, p_fim: window.fim }),
  /* ...existing calls... */
  vendedorB.rpc("dashboard_funil_detalhado"),
  vendedorB.rpc("dashboard_tempo_ate_fechamento"),
  vendedorB.rpc("dashboard_comparativo_vendedor"),   // NEW — zero arguments
])
```
Mirror the identical addition in the `after*` array further down (lines 257-280), and add `beforeComparativoVendedor`/`afterComparativoVendedor` to whatever normalization/deep-equality loop already iterates the other before/after pairs.

**New dedicated cross-vendedor `it()` block to add, copied in shape from the `dashboard_funil_detalhado grows for the Supervisor...` block** (lines 387-444+ — same signed-in-as-Vendedor-A/Vendedor-B/Supervisor triple, same before/after `Promise.all`, same "Supervisor's numbers can only grow or stay flat, Vendedor B's own row is unaffected" assertion shape):
```typescript
it("dashboard_comparativo_vendedor never leaks another vendedor's real numbers to Vendedor B (VEND-01)", async () => {
  const vendedorA = await signInAs(
    SEED_ACCOUNTS.vendedorA.email,
    SEED_ACCOUNTS.vendedorA.password
  )
  const vendedorB = await signInAs(
    SEED_ACCOUNTS.vendedorB.email,
    SEED_ACCOUNTS.vendedorB.password
  )
  const supervisor = await signInAs(
    SEED_ACCOUNTS.supervisor.email,
    SEED_ACCOUNTS.supervisor.password
  )

  const [beforeSupervisor, beforeVendedorB] = await Promise.all([
    supervisor.rpc("dashboard_comparativo_vendedor"),
    vendedorB.rpc("dashboard_comparativo_vendedor"),
  ])
  expect(beforeSupervisor.error).toBeNull()
  expect(beforeVendedorB.error).toBeNull()

  // ...insert a cliente as vendedorA (uniqueRazaoSocial/baseClienteFields,
  // push id into createdClienteIds for afterEach cleanup)...

  const [afterSupervisor, afterVendedorB] = await Promise.all([
    supervisor.rpc("dashboard_comparativo_vendedor"),
    vendedorB.rpc("dashboard_comparativo_vendedor"),
  ])
  expect(afterSupervisor.error).toBeNull()
  expect(afterVendedorB.error).toBeNull()

  // Vendedor B's OWN row is unaffected by Vendedor A's new cliente.
  // Vendedor A's row (if visible in Vendedor B's own result set at all —
  // it will be, since `profiles` is open-SELECT and every active vendedor
  // gets a row) must show unchanged counts from Vendedor B's perspective,
  // since clientes/historico stay RLS-scoped even though the roster itself
  // (profiles) is visible to any authenticated caller (Pitfall 1).
})
```

---

### `tests/dashboard/comparativo-vendedor.test.ts` (new — dedicated RPC behavior test)

**Analog:** `tests/equipe/reassignment.test.ts` for the `createTestMember`/`deleteTestMember` disposable-fixture pattern (lines 5-6, 62-79, FK-ordered teardown), and `tests/dashboard/rls-dashboard.test.ts` for `uniqueRazaoSocial`/`baseClienteFields`/`serviceClient`/`createdClienteIds` seeding helpers (lines 1-49).

**Imports/setup to copy verbatim in shape**:
```typescript
import { afterAll, describe, expect, it } from "vitest"

import {
  createTestMember,
  deleteTestMember,
  serviceClient,
} from "../helpers/supabase-test-clients"

function uniqueRazaoSocial(label: string): string {
  return `Teste Comparativo ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function baseClienteFields(
  razaoSocial: string,
  responsavelId: string,
  etapa: string
) {
  return {
    razao_social: razaoSocial,
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: responsavelId,
    etapa,
  }
}
```

**Fixture-vendedor + disposable-clientes lifecycle, per `reassignment.test.ts`'s own documented FK constraint** (lines 62-79 — clientes must be deleted BEFORE the fixture member, or `deleteTestMember` fails on the `clientes.responsavel` foreign key):
```typescript
describe("dashboard_comparativo_vendedor RPC behavior (VEND-01)", () => {
  const createdClienteIds: string[] = []
  let fixtureVendedorId: string

  afterAll(async () => {
    const admin = serviceClient()
    if (createdClienteIds.length > 0) {
      await admin.from("clientes").delete().in("id", createdClienteIds)
    }
    // clientes deleted FIRST — deleteTestMember fails on the
    // clientes.responsavel FK otherwise (reassignment.test.ts precedent).
    if (fixtureVendedorId) await deleteTestMember(fixtureVendedorId)
  })

  it("counts negócios iniciados across all-time history, computes ganho-only ciclo médio, and excludes ativo=false vendedores", async () => {
    const fixture = await createTestMember("vendedor", "comparativo")
    fixtureVendedorId = fixture.id
    const admin = serviceClient()

    // Seed a known, deterministic set of clientes for the fixture vendedor:
    // 1 ganho, 1 perdido, 1 em_andamento — asserting exact counts against a
    // fixture avoids the flakiness a shared seed account's unknown-quantity
    // historical clientes would introduce (per RESEARCH.md's Wave 0 Gaps).
    // ...insert via admin.from("clientes").insert(...), push ids into
    // createdClienteIds, drive status changes via the same historico-
    // producing path other dashboard tests already use (mover_card_funil /
    // direct status update, matching this codebase's existing convention)...

    // Assert: negocios_iniciados === 3, ganho === 1, perdido === 1,
    // ciclo_medio_dias reflects only the ganho cliente's duration.

    // Then flip profiles.ativo = false directly via service role (or the
    // desativar_membro_equipe RPC, per RESEARCH.md's Wave 0 Gaps note) and
    // re-call the RPC: assert the fixture vendedor's row is now ABSENT from
    // dashboard_comparativo_vendedor()'s result set entirely, while
    // dashboard_ganhos_perdidos()'s company-wide totals are UNCHANGED
    // (Pitfall 2 — deactivation must only remove the ROW, never the
    // underlying historical counts elsewhere).
  })
})
```

---

## Shared Patterns

### No-arg `dashboard_*` RPC + typed reader + Server Action, zero period parameters
**Source:** `dashboard_funil_detalhado()` (`0009_dashboard_funil_detalhado.sql`) → `getFunilDetalhado` (`lib/supabase/queries/dashboard.ts`) → `getFunilDetalhadoAction` (`app/actions/dashboard.ts`)
**Apply to:** `dashboard_comparativo_vendedor()` end to end — this phase deliberately does NOT reuse the `p_inicio`/`p_fim` shape (D-02, whole-history table).

### `SECURITY INVOKER` by omission (never `security definer`) for `dashboard_*` functions
**Source:** `supabase/migrations/0003_dashboard_aggregates.sql`'s banner comment
**Apply to:** the new RPC in `0011_dashboard_comparativo_vendedor.sql` — the sole authorization boundary for VEND-01, proven by extending `tests/dashboard/rls-dashboard.test.ts`.

### `taxaConversao()` reuse, never re-implemented in SQL
**Source:** `lib/dashboard/periodo.ts`'s `taxaConversao(ganho, perdido)`
**Apply to:** `lib/supabase/queries/dashboard.ts`'s new `getComparativoVendedor()` — D-03 locks this reuse explicitly; the RPC returns raw `ganho`/`perdido` counts only.

### Fetch-on-mount Client Component with independent `FetchState`/`reloadKey`
**Source:** `components/dashboard/FunilDetalhadoTable.tsx`
**Apply to:** `ComparativoVendedorTable.tsx` — owns its own loading/error state so its failure never blanks the rest of `DashboardClient`.

### Exact retry/error copy strings, never re-worded
**Source:** `FunilDetalhadoTable.tsx`'s "Não foi possível carregar os dados do dashboard. Tente novamente." / "Tentar novamente"
**Apply to:** `ComparativoVendedorTable.tsx`'s error state verbatim; only the empty-state copy is new ("Nenhum vendedor ativo no momento.", per UI-SPEC).

### `Intl.NumberFormat("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1})` + null-guard-returns-em-dash
**Source:** `FunilDetalhadoTable.tsx`'s `percentFormatter`/`formatPct`/`formatDias`
**Apply to:** `ComparativoVendedorTable.tsx`'s "Taxa de conversão"/"Ciclo médio (dias)" columns — "—" for null, never a manufactured "0,0%"/"0,0 dias". Integer columns ("Negócios iniciados"/"Negócios ganhos") use `integerFormatter` and NEVER "—" (always-defined counts).

### `isSupervisor`-gated mount in `DashboardClient`, zero role check inside the RPC or component
**Source:** `components/dashboard/DesempenhoVendedorChart.tsx`'s established precedent, already applied identically to `FunilDetalhadoTable`
**Apply to:** `{isSupervisor ? <ComparativoVendedorTable /> : null}` in `DashboardClient.tsx` — RLS on `clientes`/`historico` is the real boundary; the UI gate is a nicety, not security.

### Disposable-fixture pattern for deterministic dashboard aggregate tests
**Source:** `createTestMember`/`deleteTestMember` (`tests/helpers/supabase-test-clients.ts`) as used by `tests/equipe/reassignment.test.ts`
**Apply to:** `tests/dashboard/comparativo-vendedor.test.ts` — required (per RESEARCH.md's Wave 0 Gaps) instead of the shared `SEED_ACCOUNTS.vendedorA/B`, since exact-count assertions on a fixture vendedor avoid flakiness against unknown-quantity historical clientes on shared seed accounts. Remember the FK-ordered teardown: delete `clientes` before calling `deleteTestMember`.

### Extend existing RLS test file, don't fork a new one for the RLS-isolation concern
**Source:** `tests/dashboard/rls-dashboard.test.ts`'s existing cross-vendedor `describe`/`it` blocks (Phase 11's own additions for `dashboard_funil_detalhado`/`dashboard_tempo_ate_fechamento`)
**Apply to:** add `dashboard_comparativo_vendedor` to the existing `Promise.all([...])` assertion arrays AND add one dedicated `it()` block mirroring the `dashboard_funil_detalhado grows for the Supervisor...` block — the RPC-behavior test (active/inactive filtering, ciclo médio basis, all-time counting) belongs in the separate new `comparativo-vendedor.test.ts` file instead, per RESEARCH.md's explicit Test Map split.

## No Analog Found

None — every new/modified file in this phase has a strong same-codebase precedent (see Match Quality column above). This is the third application of the same dashboard-RPC/table/Server-Action convention (after the original `0003` set and Phase 11's `FunilDetalhadoTable`), with the only genuinely new SQL mechanic (`profiles.ativo` row-list filtering) already fully pre-mapped by CONTEXT.md's own Canonical References and RESEARCH.md's Code Examples.

## Metadata

**Analog search scope:** `supabase/migrations/`, `lib/supabase/queries/`, `app/actions/`, `components/dashboard/`, `lib/dashboard/`, `tests/dashboard/`, `tests/equipe/`, `tests/helpers/`
**Files scanned:** `supabase/migrations/0003_dashboard_aggregates.sql` (via RESEARCH.md excerpts), `supabase/migrations/0009_dashboard_funil_detalhado.sql`/`0010_fix_dashboard_funil_detalhado_avancou_pct.sql` (via RESEARCH.md excerpts + `ls` numbering check), `lib/supabase/queries/dashboard.ts` (full file read), `app/actions/dashboard.ts` (full file read), `components/dashboard/FunilDetalhadoTable.tsx` (full file read), `components/dashboard/DashboardClient.tsx` (full file read), `tests/dashboard/rls-dashboard.test.ts` (targeted reads: header, seeding helpers, `Promise.all` arrays, dedicated `it()` block), `tests/helpers/supabase-test-clients.ts` (targeted grep for `createTestMember`/`deleteTestMember`), `tests/equipe/reassignment.test.ts` (targeted grep for fixture lifecycle/FK ordering)
**Pattern extraction date:** 2026-08-03
