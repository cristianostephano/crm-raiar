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

/** DSH-04/D-03 twin of GanhosPerdidosCards.formatConversao — taxaConversao()
 * returns a RAW RATIO (0 to 1), never a percentage, so the multiplication by
 * 100 below is mandatory: without it 0.625 would render "0,6%" instead of
 * "62,5%". Named formatConversao (not formatPct) to keep that distinction
 * visible — this is the same formatter GanhosPerdidosCards already uses, not
 * FunilDetalhadoTable's unrelated formatPct. */
function formatConversao(rate: number | null): string {
  if (rate === null) return "—"
  return `${percentFormatter.format(rate * 100)}%`
}

/** Same null-guard convention applied to "Ciclo médio (dias)" — the value
 * already arrives in days, no multiplication here. */
function formatDias(value: number | null): string {
  if (value === null) return "—"
  return `${percentFormatter.format(value)} dias`
}

type FetchState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: ComparativoVendedorRow[] }

/**
 * "Comparativo por vendedor" (VEND-01) — read-only history table, one row
 * per ACTIVE vendedor as decided entirely by the RPC's own `vendedores_ativos`
 * CTE and `order by v.nome` (alphabetical). This component never re-sorts or
 * re-filters the rows it receives — that responsibility belongs exclusively
 * to dashboard_comparativo_vendedor().
 *
 * Whether this component is mounted at all is decided by DashboardClient
 * (plan 04), gated on the caller's role — this component performs no role
 * check of its own and takes no role prop, matching DesempenhoVendedorChart's
 * established precedent. RLS on the underlying RPC is the real authorization
 * boundary; the role gate in DashboardClient is a UX nicety on top of it,
 * never the guarantee.
 *
 * Fetches independently on mount via getComparativoVendedorAction() and owns
 * its own loading/error/empty states, mirroring FunilDetalhadoTable's
 * posture, so a failure here never blanks the rest of the dashboard.
 */
export function ComparativoVendedorTable() {
  const [state, setState] = useState<FetchState>({ status: "loading" })
  // Bumped by "Tentar novamente" to re-run the fetch effect below.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    // Same "fetch on mount" precedent as FunilDetalhadoTable: the loading
    // state must be set synchronously so the Skeleton shows from the very
    // next render — there's no external system to synchronize with instead
    // of this fetch itself.
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[20px] font-semibold">
          Comparativo por vendedor
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
        ) : state.rows.length === 0 ? (
          <div className="flex h-[320px] w-full items-center justify-center text-center text-sm text-muted-foreground">
            Nenhum vendedor ativo no momento.
          </div>
        ) : (
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
                        Considera só os negócios ganhos — não inclui os
                        negócios perdidos.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.rows.map((row) => (
                <TableRow key={row.responsavel}>
                  <TableCell className="font-medium">
                    {row.responsavelNome}
                  </TableCell>
                  <TableCell>{formatConversao(row.taxaConversao)}</TableCell>
                  <TableCell>
                    {integerFormatter.format(row.negociosIniciados)}
                  </TableCell>
                  <TableCell>{integerFormatter.format(row.ganho)}</TableCell>
                  <TableCell>{formatDias(row.cicloMedioDias)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
