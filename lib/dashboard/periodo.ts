import { startOfMonth, startOfYear, subDays } from "date-fns"

/**
 * Pure period-math utility for the Dashboard Gerencial (D-01). No Supabase
 * or next/headers import — mirrors lib/funil/etapas.ts / lib/funil/staleness.ts's
 * dependency-free-module convention, so Client Components can import this
 * directly without pulling server-only code into the browser bundle.
 */

export type PeriodoPreset = "30dias" | "este_mes" | "este_ano" | "personalizado"

/**
 * Resolves a period preset (or an explicit custom range) into a concrete
 * {inicio, fim} Date pair. `fim` is always "now" for every non-personalizado
 * preset — these are rolling windows, not fixed historical buckets.
 */
export function resolvePeriodo(
  preset: PeriodoPreset,
  custom?: { from: Date; to: Date }
): { inicio: Date; fim: Date } {
  const now = new Date()
  switch (preset) {
    case "30dias":
      return { inicio: subDays(now, 30), fim: now }
    case "este_mes":
      return { inicio: startOfMonth(now), fim: now }
    case "este_ano":
      return { inicio: startOfYear(now), fim: now }
    case "personalizado":
      if (!custom) throw new Error("Período personalizado requer from/to")
      return { inicio: custom.from, fim: custom.to }
  }
}

/**
 * Conversion rate from a ganho/perdido pair (DSH-04). Returns `null` (not
 * NaN/Infinity) when there's no data yet — avoids a divide-by-zero
 * rendering as a broken "NaN%" in the UI.
 */
export function taxaConversao(ganho: number, perdido: number): number | null {
  const total = ganho + perdido
  if (total === 0) return null
  return ganho / total
}
