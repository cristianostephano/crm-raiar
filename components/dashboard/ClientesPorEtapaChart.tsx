"use client"

import { useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { getClientesPorEtapaAction } from "@/app/actions/dashboard"
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
import { ETAPAS } from "@/lib/funil/etapas"
import type { ClientesPorEtapaRow } from "@/lib/supabase/queries/dashboard"

const chartConfig = {
  total: {
    label: "Clientes",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

type ChartRow = { etapa: string; etapaLabel: string; total: number }

type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: ChartRow[] }

/** Always render every etapa, even ones with zero clientes right now. */
function buildChartRows(data: ClientesPorEtapaRow[]): ChartRow[] {
  const totals = new Map(data.map((row) => [row.etapa, row.total]))
  return ETAPAS.map((etapa) => ({
    etapa: etapa.key,
    etapaLabel: etapa.label,
    total: totals.get(etapa.key) ?? 0,
  }))
}

/**
 * "Clientes por etapa do funil" (DSH-01) — a live snapshot vertical bar
 * chart, deliberately NOT affected by the dashboard's period filter (D-08).
 * Fetches independently on mount via the 04-01 Server Action, and owns its
 * own loading/empty/error states so a failure here never blanks the rest of
 * the dashboard (UI-SPEC per-card error handling).
 */
export function ClientesPorEtapaChart() {
  const [state, setState] = useState<FetchState>({ status: "loading" })
  // Bumped by "Tentar novamente" to re-run the fetch effect below.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    // Same "fetch on mount" precedent as EditableListTab's fetch effect: the
    // loading state must be set synchronously so the Skeleton shows from the
    // very next render — there's no external system to synchronize with
    // instead of this fetch itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" })

    getClientesPorEtapaAction().then((result) => {
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
  }, [reloadKey])

  const totalClientes =
    state.status === "ready"
      ? state.rows.reduce((sum, row) => sum + row.total, 0)
      : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[20px] font-semibold">
          Clientes por etapa do funil
        </CardTitle>
        <CardDescription>
          Situação atual — não é afetado pelo filtro de período
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === "loading" ? (
          <Skeleton className="h-[280px] w-full" />
        ) : state.status === "error" ? (
          <div className="flex h-[280px] w-full flex-col items-center justify-center gap-3 text-center">
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
        ) : totalClientes === 0 ? (
          <div className="flex h-[280px] w-full items-center justify-center text-center text-sm text-muted-foreground">
            Nenhum cliente cadastrado ainda.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart accessibilityLayer data={state.rows}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="etapaLabel"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
