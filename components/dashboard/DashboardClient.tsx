"use client"

import { useMemo, useState } from "react"

import {
  getProspeccaoPorCategoriaAction,
  getProspeccaoPorProdutoAction,
} from "@/app/actions/dashboard"
import { ClientesPorEtapaChart } from "@/components/dashboard/ClientesPorEtapaChart"
import { DesempenhoVendedorChart } from "@/components/dashboard/DesempenhoVendedorChart"
import { FunilDetalhadoTable } from "@/components/dashboard/FunilDetalhadoTable"
import { GanhosPerdidosCards } from "@/components/dashboard/GanhosPerdidosCards"
import { PeriodoFilter } from "@/components/dashboard/PeriodoFilter"
import { ProspeccaoChart } from "@/components/dashboard/ProspeccaoChart"
import { TempoAteFechamentoCards } from "@/components/dashboard/TempoAteFechamentoCards"
import { resolvePeriodo, type PeriodoPreset } from "@/lib/dashboard/periodo"

type DashboardClientProps = {
  isSupervisor: boolean
}

/**
 * Client orchestrator for the Dashboard (D-01/D-03). Holds período state and
 * passes the resolved {inicio, fim} down to period-filtered metric blocks —
 * mirrors ConfiguracoesTabs' "shared state, independently-fetching
 * children" pattern, so one failed metric's error state never blanks the
 * whole page.
 *
 * ClientesPorEtapaChart (DSH-01), FunilDetalhadoTable (FNL-01) and
 * TempoAteFechamentoCards (FNL-02) deliberately do NOT receive período —
 * they are always whole-history/live snapshots, unaffected by the period
 * filter (D-08). GanhosPerdidosCards (DSH-02/DSH-04), DesempenhoVendedorChart
 * (DSH-03, Supervisor-only per D-07) and the two ProspeccaoChart instances
 * (DSH-05) are all period-filtered via the same resolved `periodo`.
 */
export function DashboardClient({ isSupervisor }: DashboardClientProps) {
  const [preset, setPreset] = useState<PeriodoPreset>("30dias")
  const [customRange, setCustomRange] = useState<
    { from: Date; to: Date } | undefined
  >(undefined)

  const periodo = useMemo(
    () => resolvePeriodo(preset, customRange),
    [preset, customRange]
  )

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {isSupervisor ? "Números da equipe" : "Seus números de vendas"}
        </p>
      </div>

      <PeriodoFilter
        preset={preset}
        customRange={customRange}
        onPresetChange={setPreset}
        onCustomRangeApply={setCustomRange}
      />

      <div className="flex flex-col gap-6">
        {/* DSH-01 — always-current snapshot, not period-filtered (D-08). */}
        <ClientesPorEtapaChart />

        {/*
          FNL-01/FNL-02 — "Funil de conversão detalhado" section. Both new
          components are whole-history snapshots with zero período
          parameters, so they're grouped right next to ClientesPorEtapaChart
          above (un-period-filtered) and before the period-filtered KPI row
          below (UI-SPEC §3). Table first (the detail), cards second (the
          summary) — same detail-then-summary order as ClientesPorEtapaChart
          already has today relative to the KPI row.
        */}
        <FunilDetalhadoTable />
        <TempoAteFechamentoCards />

        {/* KPI row (Ganhos / Perdidos / Taxa de conversão) — DSH-02/DSH-04,
          period-filtered via `periodo`. */}
        <GanhosPerdidosCards inicio={periodo.inicio} fim={periodo.fim} />

        {/*
          "Desempenho por vendedor" — DSH-03/D-07, Supervisor-only. This is
          a UX nicety over the RLS boundary (a Vendedor's own call to
          getDesempenhoVendedor already returns just their own row) — never
          the authorization boundary itself.
        */}
        {isSupervisor ? (
          <DesempenhoVendedorChart inicio={periodo.inicio} fim={periodo.fim} />
        ) : null}

        {/*
          "Prospecção por produto" / "Prospecção por categoria" — DSH-05,
          period-filtered via `periodo`, shown to both roles.
        */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ProspeccaoChart
            title="Prospecção por produto"
            caption="Clientes cadastrados no período, por produto consumido"
            inicio={periodo.inicio}
            fim={periodo.fim}
            action={getProspeccaoPorProdutoAction}
          />
          <ProspeccaoChart
            title="Prospecção por categoria"
            caption="Clientes cadastrados no período, por categoria"
            inicio={periodo.inicio}
            fim={periodo.fim}
            action={getProspeccaoPorCategoriaAction}
          />
        </div>
      </div>
    </div>
  )
}
