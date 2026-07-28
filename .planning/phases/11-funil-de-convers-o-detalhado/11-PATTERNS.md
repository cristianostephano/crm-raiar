# Phase 11: Funil de Conversão Detalhado - Pattern Map

**Mapped:** 2026-07-27
**Files analyzed:** 7 (1 new migration, 2 extended files, 2 new components, 1 edited component, 1 new/extended test file)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `supabase/migrations/00XX_dashboard_funil_detalhado.sql` (number TBD — see below) | migration | CRUD (read-only aggregation) | `supabase/migrations/0003_dashboard_aggregates.sql` | exact |
| `lib/supabase/queries/dashboard.ts` (extend) | service (typed RPC reader) | CRUD (read) | itself — existing `getClientesPorEtapa`/`getGanhosPerdidos` functions in the same file | exact |
| `app/actions/dashboard.ts` (extend) | service (Server Action) | request-response | itself — existing `getClientesPorEtapaAction`/`getGanhosPerdidosAction` in the same file | exact |
| `components/dashboard/FunilDetalhadoTable.tsx` | component (Client Component, table) | request-response (fetch-on-mount + render) | `components/dashboard/ClientesPorEtapaChart.tsx` (loading/error/empty + fetch-effect scaffold) + `components/importacao/ImportPreviewTable.tsx` (table markup, `border-l-4` status-color row pattern) | exact (composite of two analogs) |
| `components/dashboard/TempoAteFechamentoCards.tsx` | component (Client Component, KPI tiles) | request-response (fetch-on-mount + render) | `components/dashboard/GanhosPerdidosCards.tsx` | exact |
| `components/dashboard/DashboardClient.tsx` (edit in place) | component (Client orchestrator) | request-response (composition only) | itself — existing file, edited in place | exact |
| `tests/dashboard/funil-detalhado.test.ts` (new) + `tests/dashboard/rls-dashboard.test.ts` (extend) | test | integration (real Supabase RPC calls) | `tests/dashboard/rls-dashboard.test.ts` (structure to copy for the new file) + itself (for the extension) | exact |

## Pattern Assignments

### `supabase/migrations/00XX_dashboard_funil_detalhado.sql` (migration, CRUD/read-only aggregation)

**Analog:** `supabase/migrations/0003_dashboard_aggregates.sql` (full file read above — five `dashboard_*` functions + trailing indexes).

**Numbering caution (RESEARCH.md Pitfall 6):** `ls supabase/migrations/` currently ends at `0007_cidades_e_estado_valido.sql`. Phase 10 has already claimed `0008_desativacao_membro_equipe.sql` in its own plan but that file is NOT YET on disk. The implementing plan for this phase MUST run `ls supabase/migrations/` immediately before naming the new file — do not hard-code `0009` from RESEARCH.md's draft structure without checking first, exactly per the pitfall already documented there.

**Header/`SECURITY INVOKER` banner comment to copy verbatim in spirit** (`0003_dashboard_aggregates.sql` lines 17-32):
```sql
-- ─────────────────────────────────────────────────────────────────────────
-- SECURITY INVOKER by omission — every function below deliberately has NO
-- "security definer" clause, mirroring 0002_clientes_and_funil.sql's
-- mover_card_funil precedent. Each function runs as the CALLING user, so
-- every internal SELECT against clientes/historico is transparently scoped
-- by the RLS policies already defined in 0001/0002.
--
-- NEVER add "security definer" here: it would silently bypass RLS and
-- start returning every vendedor's data to every caller, defeating FNL-03
-- with no error or warning. Proven by tests/dashboard/rls-dashboard.test.ts
-- and tests/dashboard/funil-detalhado.test.ts, which fail loudly if this
-- rule is ever violated.
-- ─────────────────────────────────────────────────────────────────────────
```

**Function signature shape to copy exactly** (`0003` lines 39-47, the simplest no-arg RPC — this phase's two new RPCs both take zero parameters, same shape as `dashboard_clientes_por_etapa`, NOT the `p_inicio`/`p_fim` shape used by the period-filtered metrics):
```sql
create or replace function dashboard_clientes_por_etapa()
returns table(etapa etapa_funil, total bigint)
language sql
stable
as $$
  select etapa, count(*) as total
  from clientes
  group by etapa;
$$;
```

**Dedup CTE pattern to reuse for `dashboard_tempo_ate_fechamento()`** (`0003` lines 74-94, `dashboard_ganhos_perdidos` — RESEARCH.md's FNL-02 RPC is a direct swap of `count(*)` for `avg(day-diff)` over this exact same `ultimo_status_change` CTE shape):
```sql
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
where c.status_acompanhamento::text = u.status_evento
group by u.status_evento;
```

**Full new-SQL content:** use RESEARCH.md's Code Examples section verbatim as the starting draft for both `dashboard_funil_detalhado()` and `dashboard_tempo_ate_fechamento()` — that SQL is already synthesized against this exact schema/trigger format and is the concrete text to paste into this migration, not just inspiration. Both functions must land with **no** `security definer` clause and **zero** parameters, per the header banner above and RESEARCH.md's Anti-Patterns section.

**Trailing supporting-index pattern** (`0003` lines 205-209 — only add a new index if `EXPLAIN` shows the new query needs one beyond the two already created by `0003`; `idx_historico_tipo_criado` and `idx_clientes_criado_em` already cover the `historico.tipo`/`criado_em` and `clientes.criado_em` access paths this phase's RPCs also use):
```sql
create index idx_historico_tipo_criado on historico (tipo, criado_em);
create index idx_clientes_criado_em on clientes (criado_em);
```

---

### `lib/supabase/queries/dashboard.ts` (extend — typed RPC readers)

**Analog:** itself — `getClientesPorEtapa` (lines 25-37, no-arg RPC reader) is the closer match since both new RPCs take zero parameters, unlike the `p_inicio`/`p_fim` readers below it in the same file.

**File-level doc comment to extend, not duplicate** (lines 1-16 — keep the existing "no manual responsavel/role filtering" framing, add the two new RPC names to the list this comment implicitly covers):
```typescript
import { ETAPA_KEYS, type EtapaKey } from "@/lib/funil/etapas"
import { createClient } from "@/lib/supabase/server"
```

**No-arg RPC reader pattern to copy exactly** (lines 24-37, `getClientesPorEtapa` — the shape for `getFunilDetalhado()`; note the `Number()` normalization comment at lines 18-20 applies identically to every `bigint`/`numeric` column the new RPCs return):
```typescript
export type ClientesPorEtapaRow = { etapa: EtapaKey; total: number }

/** DSH-01/DSH-08: live snapshot, no period parameters. */
export async function getClientesPorEtapa(): Promise<ClientesPorEtapaRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_clientes_por_etapa")

  if (error) {
    throw new Error(`Falha ao carregar clientes por etapa: ${error.message}`)
  }

  return (data ?? []).map((row: { etapa: EtapaKey; total: number | string }) => ({
    etapa: row.etapa,
    total: Number(row.total),
  }))
}
```

**New type + reader to add, following the exact same shape** (per RESEARCH.md's own worked example — already snake_case→camelCase mapped, `null`-safe for the nullable percentage/dias columns):
```typescript
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

export type TempoAteFechamentoRow = { status: "ganho" | "perdido"; mediaDias: number }

export async function getTempoAteFechamento(): Promise<TempoAteFechamentoRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_tempo_ate_fechamento")
  if (error) {
    throw new Error(`Falha ao carregar tempo até fechamento: ${error.message}`)
  }
  return (data ?? []).map(
    (row: { status: "ganho" | "perdido"; media_dias: number | string }) => ({
      status: row.status,
      mediaDias: Number(row.media_dias),
    })
  )
}
```

---

### `app/actions/dashboard.ts` (extend — Server Actions)

**Analog:** itself — `getClientesPorEtapaAction` (lines 36-58), the closest match since both new actions take zero arguments and follow the identical auth-check-then-try/catch shape.

**Imports to extend** (lines 4-14 — add the two new imports to the existing `from "@/lib/supabase/queries/dashboard"` block, don't add a second import statement):
```typescript
import {
  getClientesPorEtapa,
  getDesempenhoVendedor,
  getFunilDetalhado,           // NEW
  getGanhosPerdidos,
  getProspeccaoPorCategoria,
  getProspeccaoPorProduto,
  getTempoAteFechamento,       // NEW
  type ClientesPorEtapaRow,
  type DesempenhoVendedorRow,
  type FunilDetalhadoRow,      // NEW
  type GanhosPerdidosRow,
  type ProspeccaoRow,
  type TempoAteFechamentoRow,  // NEW
} from "@/lib/supabase/queries/dashboard"
```

**No-arg Server Action pattern to copy exactly** (lines 36-58, `getClientesPorEtapaAction` — reuse verbatim, same `DashboardErrorCode` union already declared at line 30, same "unauthenticated" guard, same generic catch → "fetch_falhou" mapping and exact copy string):
```typescript
export type GetFunilDetalhadoResult =
  | { data: FunilDetalhadoRow[]; error?: undefined }
  | { data?: undefined; error: { code: DashboardErrorCode; message: string } }

export async function getFunilDetalhadoAction(): Promise<GetFunilDetalhadoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    return { data: await getFunilDetalhado() }
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

export type GetTempoAteFechamentoResult =
  | { data: TempoAteFechamentoRow[]; error?: undefined }
  | { data?: undefined; error: { code: DashboardErrorCode; message: string } }

export async function getTempoAteFechamentoAction(): Promise<GetTempoAteFechamentoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    return { data: await getTempoAteFechamento() }
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

No new `DashboardErrorCode` values needed — both new actions reuse the existing `"unauthenticated" | "fetch_falhou"` union declared once at line 30.

---

### `components/dashboard/FunilDetalhadoTable.tsx` (new — D-01 table, FNL-01)

**Analogs:** `components/dashboard/ClientesPorEtapaChart.tsx` (fetch-effect scaffold, loading/error/empty state posture, Card/CardHeader/CardTitle/CardDescription shell) + `components/importacao/ImportPreviewTable.tsx` (Table/TableHeader/TableBody markup, `border-l-4 border-l-{color}-500` semantic row-border pattern) + `lib/importacao/preview.ts`'s `statusBorderClass` (the exact "named-status → border class" map to imitate for the boolean `gargalo` case) + `components/clientes/ClienteCard.tsx`'s `TriangleAlert`/`Tooltip` usage (lines 213-224, the "icon+text, never color-only" non-color signal, plus the info-icon tooltip on the Quantidade column).

**Fetch-effect scaffold to copy exactly** (`ClientesPorEtapaChart.tsx` lines 34-84 — same `FetchState` discriminated union, same `reloadKey` retry mechanism, same `// eslint-disable-next-line react-hooks/set-state-in-effect` comment convention):
```typescript
type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: FunilDetalhadoRow[] }

export function FunilDetalhadoTable() {
  const [state, setState] = useState<FetchState>({ status: "loading" })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" })

    getFunilDetalhadoAction().then((result) => {
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

**Card shell + heading/caption to copy exactly** (`ClientesPorEtapaChart.tsx` lines 92-100, adapted to UI-SPEC's copy):
```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-[20px] font-semibold">
      Funil de conversão detalhado
    </CardTitle>
    <CardDescription>
      Histórico completo — não é afetado pelo filtro de período
    </CardDescription>
  </CardHeader>
  <CardContent>{/* table or loading/error/empty branch */}</CardContent>
</Card>
```

**Loading/error branch structure to copy exactly** (`ClientesPorEtapaChart.tsx` lines 102-116 — UI-SPEC scales the skeleton height to `h-[320px]` instead of `h-[280px]`, everything else identical including the exact retry copy string):
```tsx
{state.status === "loading" ? (
  <Skeleton className="h-[320px] w-full" />
) : state.status === "error" ? (
  <div className="flex h-[320px] w-full flex-col items-center justify-center gap-3 text-center">
    <p className="text-sm text-muted-foreground">
      Não foi possível carregar os dados do dashboard. Tente novamente.
    </p>
    <Button type="button" variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
      Tentar novamente
    </Button>
  </div>
) : totalQuantidade === 0 ? (
  <div className="flex h-[320px] w-full items-center justify-center text-center text-sm text-muted-foreground">
    Nenhum cliente cadastrado ainda.
  </div>
) : (
  /* Table goes here */
)}
```

**Table markup to copy** (`ImportPreviewTable.tsx` lines 90-99 for the `Table`/`TableHeader`/`TableHead` shell, and lines 106-107 for the "identifying column gets `font-medium`, others don't" convention):
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Etapa</TableHead>
      <TableHead>Quantidade</TableHead>
      <TableHead>% Avançou</TableHead>
      <TableHead>Perdidos</TableHead>
      <TableHead>Tempo médio parado</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {ETAPAS.map((etapa) => {
      const row = rowsByEtapa.get(etapa.key)
      return (
        <TableRow
          key={etapa.key}
          className={row?.gargalo ? "border-l-4 border-l-amber-500" : undefined}
        >
          <TableCell className="font-medium">{etapa.label}</TableCell>
          {/* Quantidade / % Avançou / Perdidos / Tempo médio cells */}
        </TableRow>
      )
    })}
  </TableBody>
</Table>
```

**Always-render-all-7-rows pattern to copy exactly** (`ClientesPorEtapaChart.tsx`'s `buildChartRows`, lines 40-47 — the table version must never re-sort by column value, always iterate `ETAPAS` in fixed array order, same "totals map + `.get(key) ?? 0`" merge idiom):
```typescript
function buildTableRows(data: FunilDetalhadoRow[]): Map<EtapaKey, FunilDetalhadoRow> {
  return new Map(data.map((row) => [row.etapa, row]))
}
```

**`border-l-4` semantic-status-color pattern to imitate (not reuse the map itself — this is a boolean, not a 3-way status)** (`lib/importacao/preview.ts` lines 35-45, `STATUS_BORDER`/`statusBorderClass`):
```typescript
const STATUS_BORDER: Record<ReviewRowStatus, string> = {
  ok: "border-l-4 border-l-green-500",
  duplicado: "border-l-4 border-l-amber-500",
  erro: "border-l-4 border-l-red-500",
}
export function statusBorderClass(status: ReviewRowStatus): string {
  return STATUS_BORDER[status]
}
```
D-03's version is simpler (one boolean flag, one color): `row.gargalo ? "border-l-4 border-l-amber-500" : undefined` inline, no lookup map needed — but the `amber-500` value itself must come from this exact file's vocabulary, not a freshly-chosen shade.

**Non-color-only "Gargalo" badge pattern to copy** (`ClienteCard.tsx` lines 213-224, `TriangleAlert` + `Tooltip` combo — UI-SPEC §1 requires the same icon, reused as a `Badge` instead of a bare tooltip trigger):
```tsx
import { TriangleAlert } from "lucide-react"
// ...
{row.gargalo ? (
  <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-500">
    <TriangleAlert className="size-3" />
    Gargalo
  </Badge>
) : null}
```

**Info-icon tooltip on the Quantidade column** (same `Tooltip`/`TooltipTrigger`/`TooltipContent` primitive already imported in `ClienteCard.tsx` lines 8-... — reuse the same three-component API, new trigger icon/copy per UI-SPEC's Copywriting Contract: "Total de clientes que já passaram por esta etapa, incluindo os que estão parados nela agora.").

**Null-cell formatting to copy exactly** (`GanhosPerdidosCards.tsx` lines 23-34, `percentFormatter`/`formatConversao`'s null-guard-returns-em-dash pattern — reuse the same `Intl.NumberFormat("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1})` instance for `% Avançou`/`Tempo médio`, same "—" convention, never "0,0%"):
```typescript
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
function formatPct(value: number | null): string {
  if (value === null) return "—"
  return `${percentFormatter.format(value)}%`
}
```

---

### `components/dashboard/TempoAteFechamentoCards.tsx` (new — FNL-02, 2 KPI tiles)

**Analog:** `components/dashboard/GanhosPerdidosCards.tsx` (full file read above) — near-exact structural transplant, only 3 tiles → 2 tiles and period-reactive → no-arg fetch.

**Fetch-effect scaffold to copy, with ONE deviation** (`GanhosPerdidosCards.tsx` lines 58-80 — that component's effect dependency array is `[inicio, fim, reloadKey]` because it's period-filtered; this component's new RPC takes no arguments, so the dependency array is just `[reloadKey]`, matching `ClientesPorEtapaChart`'s no-arg fetch shape instead):
```typescript
type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: TempoAteFechamentoRow[] }

export function TempoAteFechamentoCards() {
  const [state, setState] = useState<FetchState>({ status: "loading" })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" })

    getTempoAteFechamentoAction().then((result) => {
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
  // no [inicio, fim] deps — this RPC takes zero arguments (RESEARCH.md anti-pattern note)
}
```

**Grid/loading/error branch to copy, swapping 3 columns for 2** (`GanhosPerdidosCards.tsx` lines 82-109 — identical structure, `md:grid-cols-3` → `md:grid-cols-2`, `Skeleton` × 3 → `Skeleton` × 2):
```tsx
if (state.status === "loading") {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Skeleton className="h-[140px] w-full" />
      <Skeleton className="h-[140px] w-full" />
    </div>
  )
}

if (state.status === "error") {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar os dados do dashboard. Tente novamente.
        </p>
        <Button type="button" variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
          Tentar novamente
        </Button>
      </CardContent>
    </Card>
  )
}
```

**Tile markup to copy exactly, swapping icon/label/border-color per UI-SPEC** (`GanhosPerdidosCards.tsx` lines 118-140, the "Ganhos" tile for Tile 1 and the "Perdidos" tile for Tile 2 — both keep the exact `border-l-4 border-l-{color}` / `TrendingUp`/`TrendingDown` icon / `text-[36px] leading-[1.1] font-semibold` value treatment):
```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <Card className="border-l-4 border-l-green-600">
    <CardContent className="flex flex-col gap-2 p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <TrendingUp className="size-4 text-muted-foreground" />
        Média de dias até ganho
      </div>
      <p className="text-[36px] leading-[1.1] font-semibold text-foreground">
        {ganhoDias === null ? "—" : `${diasFormatter.format(ganhoDias)} dias`}
      </p>
    </CardContent>
  </Card>
  <Card className="border-l-4 border-l-destructive">
    <CardContent className="flex flex-col gap-2 p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <TrendingDown className="size-4 text-muted-foreground" />
        Média de dias até perdido
      </div>
      <p className="text-[36px] leading-[1.1] font-semibold text-foreground">
        {perdidoDias === null ? "—" : `${diasFormatter.format(perdidoDias)} dias`}
      </p>
    </CardContent>
  </Card>
</div>
```
`ganhoDias`/`perdidoDias` derive from `state.rows.find((r) => r.status === "ganho")?.mediaDias ?? null` — same `.find(...) ?? fallback` idiom as `GanhosPerdidosCards.tsx` lines 111-114, reusing the same `percentFormatter`-style `Intl.NumberFormat("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1})` instance (renamed `diasFormatter` here) for the 1-decimal day count.

---

### `components/dashboard/DashboardClient.tsx` (edit in place)

**Analog:** itself (full file read above, 101 lines).

**Import additions** (extend the existing import block, lines 6-13):
```typescript
import { FunilDetalhadoTable } from "@/components/dashboard/FunilDetalhadoTable"
import { TempoAteFechamentoCards } from "@/components/dashboard/TempoAteFechamentoCards"
```

**Insertion point** (between the existing `ClientesPorEtapaChart` at line 62 and `GanhosPerdidosCards` at line 66, inside the same `flex flex-col gap-6` stack, lines 60-98 — no new gap/grid class introduced, per UI-SPEC §3):
```tsx
<div className="flex flex-col gap-6">
  {/* DSH-01 — always-current snapshot, not period-filtered (D-08). */}
  <ClientesPorEtapaChart />

  {/*
    FNL-01/FNL-02 — new "Funil de conversão detalhado" section. Both new
    components take zero period parameters (RESEARCH.md's explicit
    anti-pattern note), un-period-filtered like ClientesPorEtapaChart
    above them, so they're placed adjacent to it and before the
    period-filtered GanhosPerdidosCards section (UI-SPEC §3).
  */}
  <FunilDetalhadoTable />
  <TempoAteFechamentoCards />

  {/* KPI row (Ganhos / Perdidos / Taxa de conversão) — DSH-02/DSH-04,
    period-filtered via `periodo`. */}
  <GanhosPerdidosCards inicio={periodo.inicio} fim={periodo.fim} />
  {/* ... rest unchanged ... */}
</div>
```
No prop plumbing needed — neither new component takes `isSupervisor`, `inicio`, or `fim` (RLS handles visibility, no period filter this phase per CONTEXT.md).

---

### `tests/dashboard/funil-detalhado.test.ts` (new) + `tests/dashboard/rls-dashboard.test.ts` (extend)

**Analog:** `tests/dashboard/rls-dashboard.test.ts` (full file read above) — both the new file's structure and the extension follow this file's established helpers/imports/seed pattern exactly. Do NOT create a second RLS test file for the new RPCs — extend the existing one, per RESEARCH.md's Phase Requirements → Test Map ("⚠️ extend existing file, don't create new").

**Shared imports/helpers to reuse verbatim** (lines 1-18, 40-52, 82-88 — `SEED_ACCOUNTS`, `serviceClient`/`signInAs`, `uniqueRazaoSocial`, `baseClienteFields`, `createdClienteIds` + `afterEach` cleanup, `getUserId`, `testWindow`):
```typescript
import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

const createdClienteIds: string[] = []

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  const admin = serviceClient()
  await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
})
```

**Cross-vendedor RLS extension pattern to copy exactly** (lines 119-251, the first `describe` block — add `dashboard_funil_detalhado` and `dashboard_tempo_ate_fechamento` to the `Promise.all([...])` arrays of before/after RPC calls in `rls-dashboard.test.ts`, asserting Vendedor B's totals are unaffected by Vendedor A's newly-created/advanced cliente, same `toMap`/`toResponsavelMap` helper idiom):
```typescript
const [beforeEtapa, beforeGanhosPerdidos, /* ... */, beforeFunilDetalhado, beforeTempoFechamento] =
  await Promise.all([
    vendedorB.rpc("dashboard_clientes_por_etapa"),
    vendedorB.rpc("dashboard_ganhos_perdidos", { p_inicio, p_fim }),
    // ...
    vendedorB.rpc("dashboard_funil_detalhado"),
    vendedorB.rpc("dashboard_tempo_ate_fechamento"),
  ])
```
Both new RPCs take zero parameters, so their `.rpc()` calls need no `{p_inicio, p_fim}` argument — simpler than the existing period-filtered calls in the same array.

**New behavior-focused test file** (`tests/dashboard/funil-detalhado.test.ts`, per RESEARCH.md's Phase Requirements → Test Map) should reuse this same file's seeding helpers (`uniqueRazaoSocial`, `baseClienteFields`, `serviceClient`/`signInAs`, `createdClienteIds`/`afterEach`) to construct the specific scenarios RESEARCH.md's test map calls for: "quantidade" (ever-entered count), "ainda parado" (still-active client counts as not-advanced, `now()` used as provisional exit), "perdido" (a lost client's dwell time stops accruing after the loss event, attributed to the correct stage), "gargalo" (an artificially long stage average gets flagged, a normal one doesn't), and "fechamento" (ganho/perdido averages computed from `clientes.criado_em` to the closing event, kept separate per status).

---

## Shared Patterns

### No-arg `dashboard_*` RPC + typed reader + Server Action, zero period parameters
**Source:** `dashboard_clientes_por_etapa()` (`0003_dashboard_aggregates.sql`) → `getClientesPorEtapa` (`lib/supabase/queries/dashboard.ts`) → `getClientesPorEtapaAction` (`app/actions/dashboard.ts`)
**Apply to:** both `dashboard_funil_detalhado()` and `dashboard_tempo_ate_fechamento()` end to end — this phase deliberately does NOT reuse the `p_inicio`/`p_fim` shape used by `dashboard_ganhos_perdidos`/`dashboard_desempenho_vendedor`/`dashboard_prospeccao_por_*`, since a period filter is explicitly out of scope (RESEARCH.md Anti-Patterns, CONTEXT.md, PROJECT.md Out of Scope).

### `SECURITY INVOKER` by omission (never `security definer`) for `dashboard_*` functions
**Source:** `supabase/migrations/0003_dashboard_aggregates.sql`'s banner comment (lines 17-32)
**Apply to:** both new RPCs in this phase's migration — the sole authorization boundary for FNL-03, proven by extending `tests/dashboard/rls-dashboard.test.ts`.

### Fetch-on-mount Client Component with independent `FetchState`/`reloadKey`
**Source:** `components/dashboard/ClientesPorEtapaChart.tsx` (no-arg fetch) and `components/dashboard/GanhosPerdidosCards.tsx` (period-reactive fetch)
**Apply to:** both `FunilDetalhadoTable.tsx` and `TempoAteFechamentoCards.tsx` — each owns its own loading/error state so one section's failure never blanks the rest of `DashboardClient`.

### Exact retry/empty/error copy strings, never re-worded
**Source:** `ClientesPorEtapaChart.tsx`/`GanhosPerdidosCards.tsx`'s "Não foi possível carregar os dados do dashboard. Tente novamente." / "Tentar novamente" / "Nenhum cliente cadastrado ainda."
**Apply to:** both new components' error and empty states verbatim — UI-SPEC's Copywriting Contract explicitly locks these as reused, not new copy.

### `border-l-4 border-l-{color}-{shade}` semantic row/tile coloring, never color-only
**Source:** `lib/importacao/preview.ts`'s `STATUS_BORDER`/`statusBorderClass`, `components/dashboard/GanhosPerdidosCards.tsx`'s tile borders, `components/clientes/ClienteCard.tsx`'s `TriangleAlert` icon+tooltip
**Apply to:** `FunilDetalhadoTable.tsx`'s D-03 gargalo row (`border-l-amber-500` + `TriangleAlert` Badge, never border alone) and `TempoAteFechamentoCards.tsx`'s tile borders (`border-l-green-600`/`border-l-destructive`, matching `GanhosPerdidosCards`'s existing Ganhos/Perdidos precedent exactly).

### `Intl.NumberFormat("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1})` + null-guard-returns-em-dash
**Source:** `GanhosPerdidosCards.tsx`'s `percentFormatter`/`formatConversao` (lines 24-34)
**Apply to:** every 1-decimal percentage/day-count value in `FunilDetalhadoTable.tsx` and `TempoAteFechamentoCards.tsx` — "—" for null, never a manufactured "0,0%"/"0,0 dias".

### Always render all 7 `ETAPAS`, in fixed array order, from `lib/funil/etapas.ts`
**Source:** `ClientesPorEtapaChart.tsx`'s `buildChartRows` (lines 40-47)
**Apply to:** `FunilDetalhadoTable.tsx`'s row iteration — never re-sort by `tempo_medio_dias`/`gargalo` or any other column value.

### Extend existing RLS test file, don't fork a new one for the same concern
**Source:** `tests/dashboard/rls-dashboard.test.ts`'s existing cross-vendedor/supervisor-visibility `describe` blocks
**Apply to:** add both new RPC names into the existing `Promise.all([...])` assertion arrays — matches RESEARCH.md's explicit Test Map instruction.

## No Analog Found

None — every new/modified file in this phase has a strong same-codebase precedent (see Match Quality column above). This phase is unusually low-risk on the "no analog" front since RESEARCH.md itself frames the whole phase as "additive SQL + one new component built entirely from already-installed dependencies," and UI-SPEC confirms zero new shadcn components/tokens.

## Metadata

**Analog search scope:** `supabase/migrations/`, `lib/supabase/queries/`, `app/actions/`, `components/dashboard/`, `components/importacao/`, `components/clientes/`, `lib/importacao/`, `lib/funil/`, `tests/dashboard/`
**Files scanned:** `supabase/migrations/0003_dashboard_aggregates.sql`, `lib/supabase/queries/dashboard.ts`, `app/actions/dashboard.ts`, `components/dashboard/ClientesPorEtapaChart.tsx`, `components/dashboard/GanhosPerdidosCards.tsx`, `components/dashboard/DashboardClient.tsx`, `components/importacao/ImportPreviewTable.tsx`, `lib/importacao/preview.ts`, `lib/funil/etapas.ts`, `components/clientes/ClienteCard.tsx` (targeted `TriangleAlert`/`Tooltip` excerpt), `tests/dashboard/rls-dashboard.test.ts`, `ls supabase/migrations/` (numbering check)
**Pattern extraction date:** 2026-07-27
