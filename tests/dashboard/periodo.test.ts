import { describe, expect, it } from "vitest"
import { startOfMonth, startOfYear } from "date-fns"

import { resolvePeriodo, taxaConversao } from "@/lib/dashboard/periodo"

/**
 * Pure unit tests for lib/dashboard/periodo.ts — no Supabase usage (mirrors
 * the dependency-free-module convention already tested this way for
 * lib/funil/staleness.ts). Boundary assertions use derived comparisons
 * (e.g. `startOfMonth(fim)`) rather than a fixed injected "now", since
 * resolvePeriodo() has no `now` parameter (04-RESEARCH.md Code Examples).
 */

describe("resolvePeriodo", () => {
  it("30dias resolves to a 30-day window ending near now", () => {
    const before = Date.now()
    const { inicio, fim } = resolvePeriodo("30dias")
    const after = Date.now()

    expect(fim.getTime()).toBeGreaterThanOrEqual(before)
    expect(fim.getTime()).toBeLessThanOrEqual(after)

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
    expect(
      Math.abs(fim.getTime() - inicio.getTime() - THIRTY_DAYS_MS)
    ).toBeLessThan(1000)
  })

  it("este_mes resolves to the start of the current month through now", () => {
    const { inicio, fim } = resolvePeriodo("este_mes")
    expect(inicio.getTime()).toBe(startOfMonth(fim).getTime())
  })

  it("este_ano resolves to the start of the current year through now", () => {
    const { inicio, fim } = resolvePeriodo("este_ano")
    expect(inicio.getTime()).toBe(startOfYear(fim).getTime())
  })

  it("personalizado returns the exact custom range", () => {
    const from = new Date("2026-01-01T00:00:00Z")
    const to = new Date("2026-02-01T00:00:00Z")
    const { inicio, fim } = resolvePeriodo("personalizado", { from, to })

    expect(inicio).toEqual(from)
    expect(fim).toEqual(to)
  })

  it("personalizado without a custom range throws", () => {
    expect(() => resolvePeriodo("personalizado")).toThrow()
  })
})

describe("taxaConversao", () => {
  it("computes ganho / (ganho + perdido)", () => {
    expect(taxaConversao(3, 1)).toBeCloseTo(0.75)
  })

  it("returns null when ganho + perdido is 0 (avoid divide-by-zero, DSH-04)", () => {
    expect(taxaConversao(0, 0)).toBeNull()
  })
})
