"use client"

import { useEffect, useState } from "react"
import { Percent, TrendingDown, TrendingUp } from "lucide-react"

import { getGanhosPerdidosAction } from "@/app/actions/dashboard"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { taxaConversao } from "@/lib/dashboard/periodo"
import type { GanhosPerdidosRow } from "@/lib/supabase/queries/dashboard"

type GanhosPerdidosCardsProps = {
  inicio: Date
  fim: Date
}

type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: GanhosPerdidosRow[] }

const integerFormatter = new Intl.NumberFormat("pt-BR")
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** DSH-04: taxaConversao returns null (never NaN) when ganho+perdido is 0 —
 * rendered as an em dash, never "0,0%". */
function formatConversao(rate: number | null): string {
  if (rate === null) return "—"
  return `${percentFormatter.format(rate * 100)}%`
}

/**
 * "Ganhos x Perdidos + Taxa de conversão" KPI row (DSH-02/DSH-04) — 3
 * period-reactive big-number stat tiles (36px Stat waiver, UI-SPEC). Fetches
 * independently whenever {inicio, fim} changes via the 04-01
 * getGanhosPerdidosAction, and owns its own loading/error states so a
 * failure here never blanks the rest of the dashboard, mirroring
 * ClientesPorEtapaChart's fetch-effect pattern.
 *
 * Ganhos/Perdidos and Taxa de conversão are always rendered as tiles (never
 * replaced by a generic "no data" banner) — a zero count is itself the
 * informative answer for a period-scoped KPI, and Taxa de conversão renders
 * its own em dash via taxaConversao's null guard when there is nothing to
 * divide (ganho+perdido === 0).
 *
 * T-04-06: counts come straight from the RLS-scoped 04-01
 * getGanhosPerdidosAction — no client-side responsavel/role filtering here.
 */
export function GanhosPerdidosCards({ inicio, fim }: GanhosPerdidosCardsProps) {
  const [state, setState] = useState<FetchState>({ status: "loading" })
  // Bumped by "Tentar novamente" to re-run the fetch effect below.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    // Same "fetch on mount/prop change" precedent as ClientesPorEtapaChart:
    // the loading state must be set synchronously so the Skeleton shows
    // from the very next render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading" })

    getGanhosPerdidosAction(inicio, fim).then((result) => {
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
  }, [inicio, fim, reloadKey])

  if (state.status === "loading") {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-[140px] w-full" />
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
          <Button
            type="button"
            variant="outline"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  const ganho =
    state.rows.find((row) => row.status === "ganho")?.total ?? 0
  const perdido =
    state.rows.find((row) => row.status === "perdido")?.total ?? 0
  const conversao = taxaConversao(ganho, perdido)

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardContent className="flex flex-col gap-2 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <TrendingUp className="size-4 text-green-600 dark:text-green-500" />
            Ganhos
          </div>
          <p className="text-[36px] leading-[1.1] font-semibold text-green-600 dark:text-green-500">
            {integerFormatter.format(ganho)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-2 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <TrendingDown className="size-4 text-destructive" />
            Perdidos
          </div>
          <p className="text-[36px] leading-[1.1] font-semibold text-destructive">
            {integerFormatter.format(perdido)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-col gap-2 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Percent className="size-4 text-muted-foreground" />
            Taxa de conversão
          </div>
          <p className="text-[36px] leading-[1.1] font-semibold text-foreground">
            {formatConversao(conversao)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
