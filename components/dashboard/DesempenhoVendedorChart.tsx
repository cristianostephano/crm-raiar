"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { getDesempenhoVendedorAction } from "@/app/actions/dashboard"
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
import type { DesempenhoVendedorRow } from "@/lib/supabase/queries/dashboard"

const chartConfig = {
  ganho: {
    label: "Ganhos",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

type DesempenhoVendedorChartProps = {
  inicio: Date
  fim: Date
}

type ChartRow = { responsavel: string; nome: string; ganho: number }

type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: ChartRow[] }

const MIN_HEIGHT = 280
const ROW_HEIGHT = 40
const MAX_HEIGHT = 480

/** Same uncapped-content + max-height-scroll sizing rule as ProspeccaoChart
 * (UI-SPEC variable-row-count exception). */
function computeContentHeight(rowCount: number): number {
  return Math.max(MIN_HEIGHT, rowCount * ROW_HEIGHT)
}

/** Sorted descending by ganho so the top performer reads first (D-10). */
function buildChartRows(data: DesempenhoVendedorRow[]): ChartRow[] {
  return [...data]
    .sort((a, b) => b.ganho - a.ganho)
    .map((row) => ({
      responsavel: row.responsavel,
      nome: row.responsavelNome ?? row.responsavel,
      ganho: row.ganho,
    }))
}

/**
 * "Desempenho por vendedor" (DSH-03/D-10) — Supervisor-only horizontal-bar
 * chart, one bar per vendedor plotting their ganho count for the selected
 * period, sorted descending. This component assumes it is only ever
 * mounted for a Supervisor — DashboardClient owns the isSupervisor gate —
 * so it performs no role check of its own and must never be treated as the
 * authorization boundary itself; getDesempenhoVendedor is independently
 * RLS-scoped server-side (T-04-07/T-04-08).
 */
export function DesempenhoVendedorChart({
  inicio,
  fim,
}: DesempenhoVendedorChartProps) {
  const [state, setState] = useState<FetchState>({ status: "loading" })
  // Bumped by "Tentar novamente" to re-run the fetch effect below.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" })

    getDesempenhoVendedorAction(inicio, fim).then((result) => {
      if (cancelled) return

      if (result.error) {
        setState({ status: "error" })
        return
      }

      setState({ status: "ready", rows: buildChartRows(result.data) })
    })

    return () => {
      cancelled = true
    }
  }, [inicio, fim, reloadKey])

  const contentHeight =
    state.status === "ready"
      ? computeContentHeight(state.rows.length)
      : MIN_HEIGHT

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[20px] font-semibold">
          Desempenho por vendedor
        </CardTitle>
        <CardDescription>Ganhos no período, por responsável</CardDescription>
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
                <XAxis type="number" dataKey="ganho" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="ganho" fill="var(--color-ganho)" radius={4} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
