"use client"

import { useState } from "react"

import { ClientesPorEtapaChart } from "@/components/dashboard/ClientesPorEtapaChart"
import { PeriodoFilter } from "@/components/dashboard/PeriodoFilter"
import type { PeriodoPreset } from "@/lib/dashboard/periodo"

type DashboardClientProps = {
  isSupervisor: boolean
}

/**
 * Client orchestrator for the Dashboard (D-01/D-03). Holds período state and
 * will pass the resolved {inicio, fim} down to period-filtered metric
 * blocks — mirrors ConfiguracoesTabs' "shared state, independently-fetching
 * children" pattern, so one failed metric's error state never blanks the
 * whole page.
 *
 * ClientesPorEtapaChart (DSH-01) is the only metric wired so far and
 * deliberately does NOT receive período — it is always a live snapshot,
 * unaffected by the period filter (D-08). The KPI row, "Desempenho por
 * vendedor" (Supervisor-only, isSupervisor), and "Prospecção" blocks are
 * period-filtered and land in plans 04-04/04-05.
 */
export function DashboardClient({ isSupervisor }: DashboardClientProps) {
  const [preset, setPreset] = useState<PeriodoPreset>("30dias")
  const [customRange, setCustomRange] = useState<
    { from: Date; to: Date } | undefined
  >(undefined)

  // `preset`/`customRange` are the raw inputs a future period-filtered child
  // (04-04/04-05) will resolve via lib/dashboard/periodo.ts's resolvePeriodo
  // — deliberately not computed here yet since no period-filtered child
  // exists in this plan (ClientesPorEtapaChart below is a live snapshot and
  // never receives it, per D-08).

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
          KPI row (Ganhos / Perdidos / Taxa de conversão) — DSH-02/DSH-04,
          period-filtered via `periodo`. Wired in plan 04-04.
        */}

        {/*
          "Desempenho por vendedor" — DSH-03/D-07, Supervisor-only
          (isSupervisor), period-filtered via `periodo`. Wired in plan 04-04.
        */}

        {/*
          "Prospecção por produto" / "Prospecção por categoria" — DSH-05,
          period-filtered via `periodo`. Wired in plan 04-05.
        */}
      </div>
    </div>
  )
}
