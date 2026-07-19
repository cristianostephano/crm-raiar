"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import type { DashboardErrorCode } from "@/app/actions/dashboard"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { ProspeccaoRow } from "@/lib/supabase/queries/dashboard"

const chartConfig = {
  total: {
    label: "Clientes",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

type ProspeccaoActionResult =
  | { data: ProspeccaoRow[]; error?: undefined }
  | { data?: undefined; error: { code: DashboardErrorCode; message: string } }

type ProspeccaoChartProps = {
  title: string
  caption: string
  inicio: Date
  fim: Date
  /** getProspeccaoPorProdutoAction or getProspeccaoPorCategoriaAction — the
   * same shape lets this one component serve both blocks (DSH-05/D-09). */
  action: (inicio: Date, fim: Date) => Promise<ProspeccaoActionResult>
}

type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: ProspeccaoRow[] }

const MIN_HEIGHT = 280
const ROW_HEIGHT = 40
const MAX_HEIGHT = 480

/** UI-SPEC's variable-row-count chart sizing rule: min 280px, +40px per row,
 * uncapped here — the caller wraps this in a max-height 480px scrollable
 * container so a long list scrolls internally instead of pushing the rest
 * of the dashboard off-screen. */
function computeContentHeight(rowCount: number): number {
  return Math.max(MIN_HEIGHT, rowCount * ROW_HEIGHT)
}

/**
 * Reusable horizontal-bar chart (RESEARCH.md Pattern 4) — a single
 * parameterized component instantiated twice in DashboardClient (produto,
 * categoria), each passing its own title/caption/Server Action so the two
 * "Prospecção por X" blocks share one implementation instead of two
 * near-identical files (DSH-05). Owns its own loading/empty/error states,
 * mirroring ClientesPorEtapaChart/GanhosPerdidosCards' fetch-effect pattern.
 */
export function ProspeccaoChart({
  title,
  caption,
  inicio,
  fim,
  action,
}: ProspeccaoChartProps) {
  const [state, setState] = useState<FetchState>({ status: "loading" })
  // Bumped by "Tentar novamente" to re-run the fetch effect below.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" })

    action(inicio, fim).then((result) => {
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
  }, [inicio, fim, reloadKey, action])

  const contentHeight =
    state.status === "ready"
      ? computeContentHeight(state.rows.length)
      : MIN_HEIGHT

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[20px] font-semibold">{title}</CardTitle>
        <CardDescription>{caption}</CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === "loading" ? (
          <Skeleton className="w-full" style={{ height: MIN_HEIGHT }} />
        ) : state.status === "error" ? (
          <div
            className="flex w-full flex-col items-center justify-center gap-3 text-center"
            style={{ height: MIN_HEIGHT }}
          >
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
          <div
            className="flex w-full items-center justify-center text-center text-sm text-muted-foreground"
            style={{ height: MIN_HEIGHT }}
          >
            Nenhum dado no período selecionado.
          </div>
        ) : (
          <div
            className="w-full overflow-y-auto"
            style={{ maxHeight: MAX_HEIGHT }}
          >
            <ChartContainer
              config={chartConfig}
              className="w-full"
              style={{ height: contentHeight }}
            >
              <BarChart accessibilityLayer data={state.rows} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" dataKey="total" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={4} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
