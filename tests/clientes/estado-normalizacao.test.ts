import { describe, expect, it } from "vitest"

import { normalizarEstado } from "../../lib/clientes/normalizarEstado"
import { UFS } from "../../lib/clientes/ufs"

/**
 * Unit tests for the Estado normalization pure function (09-02 Task 1,
 * LOC-04) + the UFS constant's contract (LOC-01). Pure-function style,
 * following tests/importacao/dedupe.test.ts — no Supabase, no server
 * context, no .env.local.
 */

describe("UFS", () => {
  it("has exactly 27 siglas, includes known UFs, and has no duplicates", () => {
    expect(UFS.length).toBe(27)
    expect(UFS).toContain("SP")
    expect(UFS).toContain("RJ")
    expect(UFS).toContain("DF")
    expect(UFS).toContain("MG")
    expect(new Set(UFS).size).toBe(UFS.length)
  })

  it("does not contain an invalid sigla", () => {
    expect(UFS.includes("XX" as never)).toBe(false)
  })
})

describe("normalizarEstado", () => {
  it("maps a direct sigla, case/whitespace-insensitive, to the upper sigla", () => {
    expect(normalizarEstado("SP")).toBe("SP")
    expect(normalizarEstado("sp")).toBe("SP")
    expect(normalizarEstado(" sp ")).toBe("SP")
  })

  it("maps a full state name (accent/case-insensitive, LOC-04) to the correct sigla", () => {
    expect(normalizarEstado("São Paulo")).toBe("SP")
    expect(normalizarEstado("Sao Paulo")).toBe("SP")
    expect(normalizarEstado("rio de janeiro")).toBe("RJ")
  })

  it("falls back to trim+upper for an unrecognized value, without throwing (D-01)", () => {
    expect(() => normalizarEstado("Estado Inexistente")).not.toThrow()
    expect(normalizarEstado("Estado Inexistente")).toBe("ESTADO INEXISTENTE")
  })
})
