"use client"

import { useEffect, useState } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"

import { getTempoAteFechamentoAction } from "@/app/actions/dashboard"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { TempoAteFechamentoRow } from "@/lib/supabase/queries/dashboard"

type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: TempoAteFechamentoRow[] }

const mediaFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** FNL-02: absence of a row (no ganho/perdido event yet) renders as an em
 * dash, never "0,0 dias" — a fabricated zero would read as "we closed the
 * same day", the opposite of "nothing has closed yet". */
function formatMediaDias(mediaDias: number | null): string {
  if (mediaDias === null) return "—"
  return `${mediaFormatter.format(mediaDias)} dias`
}

/**
 * "Tempo até fechamento" KPI pair (FNL-02) — two big-number stat tiles: the
 * average number of days between a cliente entering the funil and it
 * turning "ganho", kept strictly separate from the average days until
 * "perdido" (never summed/combined into a single number). Always the
 * whole-history average — this component takes no period parameter, by
 * explicit scope decision (period filtering for this pair is out of scope
 * for this phase). Fetches independently via the 11-02
 * getTempoAteFechamentoAction and owns its own loading/error state, so a
 * failure here never blanks the rest of the dashboard, mirroring
 * GanhosPerdidosCards's fetch-effect pattern.
 *
 * FNL-03: no role is read or received here — Vendedor and Supervisor render
 * exactly this same component, with visibility already resolved by RLS
 * inside the dashboard_tempo_ate_fechamento() RPC.
 */
export function TempoAteFechamentoCards() {
  const [state, setState] = useState<FetchState>({ status: "loading" })
  // Bumped by "Tentar novamente" to re-run the fetch effect below.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    // Same "fetch on mount" precedent as GanhosPerdidosCards: the loading
    // state must be set synchronously so the Skeleton shows from the very
    // next render.
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
    // Only reloadKey — this RPC takes no period argument (FNL-02 is always
    // whole-history), so there is no inicio/fim to depend on here.
  }, [reloadKey])

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

  const mediaGanho =
    state.rows.find((row) => row.status === "ganho")?.mediaDias ?? null
  const mediaPerdido =
    state.rows.find((row) => row.status === "perdido")?.mediaDias ?? null

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="border-l-4 border-l-green-600">
        <CardContent className="flex flex-col gap-2 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <TrendingUp className="size-4 text-muted-foreground" />
            Média de dias até ganho
          </div>
          <p className="text-[36px] leading-[1.1] font-semibold text-foreground">
            {formatMediaDias(mediaGanho)}
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
            {formatMediaDias(mediaPerdido)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
