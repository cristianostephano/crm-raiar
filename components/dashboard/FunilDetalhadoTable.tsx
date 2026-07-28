"use client"

import { useEffect, useState } from "react"
import { CircleHelp, TriangleAlert } from "lucide-react"

import { getFunilDetalhadoAction } from "@/app/actions/dashboard"
import { Badge } from "@/components/ui/badge"
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
import { ETAPAS, type EtapaKey } from "@/lib/funil/etapas"
import type { FunilDetalhadoRow } from "@/lib/supabase/queries/dashboard"

const integerFormatter = new Intl.NumberFormat("pt-BR")
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Null-guard-returns-em-dash: never fabricate "0,0%" for a stage nobody entered. */
function formatPct(value: number | null): string {
  if (value === null) return "—"
  return `${percentFormatter.format(value)}%`
}

/** Same null-guard convention applied to the "Tempo médio parado" day count. */
function formatDias(value: number | null): string {
  if (value === null) return "—"
  return `${percentFormatter.format(value)} dias`
}

/** "3 (12,5%)"; a genuine zero never gets a fabricated "(0,0%)" suffix. */
function formatPerdidos(
  quantidade: number,
  perdidosCount: number,
  perdidosPct: number | null
): string {
  if (quantidade === 0) return "—"
  if (perdidosCount === 0) return "0"
  return `${integerFormatter.format(perdidosCount)} (${formatPct(perdidosPct)})`
}

type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: FunilDetalhadoRow[] }

/** Always merge by etapa key — the 7-row iteration below stays in ETAPAS' fixed order. */
function buildRowsByEtapa(
  data: FunilDetalhadoRow[]
): Map<EtapaKey, FunilDetalhadoRow> {
  return new Map(data.map((row) => [row.etapa, row]))
}

/**
 * "Funil de conversão detalhado" (FNL-01, D-01) — a NEW dashboard section, a
 * table with one row per etapa (always all 7, in lib/funil/etapas.ts's fixed
 * order, never re-sorted by column value) with 5 columns: Etapa, Quantidade,
 * % Avançou, Perdidos, Tempo médio parado. This is separate from and does
 * NOT replace ClientesPorEtapaChart above it — that chart is a live snapshot
 * of where clientes are *right now*; "Quantidade" here is the historical
 * "ever entered this stage" count (including whoever is still parked in it
 * today), which is why the two numbers can legitimately differ (D-01/Pitfall
 * 5). D-03's bottleneck ("gargalo") rows get BOTH an amber left border AND a
 * "Gargalo" badge with an icon — never color alone, so the distinction still
 * works for a colorblind viewer scanning all 7 rows.
 *
 * Fetches independently on mount via getFunilDetalhadoAction() and owns its
 * own loading/error/empty states, mirroring ClientesPorEtapaChart's posture,
 * so a failure here never blanks the rest of the dashboard.
 *
 * FNL-03: this component takes no role prop and reads no role anywhere —
 * Vendedor and Supervisor render the exact same markup; visibility is
 * entirely resolved by RLS inside the dashboard_funil_detalhado() RPC.
 */
export function FunilDetalhadoTable() {
  const [state, setState] = useState<FetchState>({ status: "loading" })
  // Bumped by "Tentar novamente" to re-run the fetch effect below.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    // Same "fetch on mount" precedent as ClientesPorEtapaChart: the loading
    // state must be set synchronously so the Skeleton shows from the very
    // next render — there's no external system to synchronize with instead
    // of this fetch itself.
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

  const totalQuantidade =
    state.status === "ready"
      ? state.rows.reduce((sum, row) => sum + row.quantidade, 0)
      : 0

  const rowsByEtapa =
    state.status === "ready" ? buildRowsByEtapa(state.rows) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[20px] font-semibold">
          Funil de conversão detalhado
        </CardTitle>
        <CardDescription>
          Histórico completo — não é afetado pelo filtro de período
        </CardDescription>
      </CardHeader>
      <CardContent>
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
        ) : totalQuantidade === 0 ? (
          <div className="flex h-[320px] w-full items-center justify-center text-center text-sm text-muted-foreground">
            Nenhum cliente cadastrado ainda.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etapa</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    Quantidade
                    <Tooltip>
                      <TooltipTrigger
                        className="inline-flex shrink-0 items-center bg-transparent p-0"
                        aria-label="Total de clientes que já passaram por esta etapa, incluindo os que estão parados nela agora."
                      >
                        <CircleHelp className="size-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        Total de clientes que já passaram por esta etapa,
                        incluindo os que estão parados nela agora.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
                <TableHead>% Avançou</TableHead>
                <TableHead>Perdidos</TableHead>
                <TableHead>Tempo médio parado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ETAPAS.map((etapa) => {
                const row = rowsByEtapa?.get(etapa.key)
                const quantidade = row?.quantidade ?? 0
                const avancouPct = row?.avancouPct ?? null
                const perdidosCount = row?.perdidosCount ?? 0
                const perdidosPct = row?.perdidosPct ?? null
                const tempoMedioDias = row?.tempoMedioDias ?? null
                const gargalo = row?.gargalo ?? false

                return (
                  <TableRow
                    key={etapa.key}
                    className={gargalo ? "border-l-4 border-l-amber-500" : undefined}
                  >
                    <TableCell className="font-medium">{etapa.label}</TableCell>
                    <TableCell>{integerFormatter.format(quantidade)}</TableCell>
                    <TableCell>{formatPct(avancouPct)}</TableCell>
                    <TableCell>
                      {formatPerdidos(quantidade, perdidosCount, perdidosPct)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {formatDias(tempoMedioDias)}
                        {gargalo ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-amber-500/40 text-amber-500"
                          >
                            <TriangleAlert className="size-3" />
                            Gargalo
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
