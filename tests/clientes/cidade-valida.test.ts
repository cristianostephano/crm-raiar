import { describe, expect, it } from "vitest"

import { cidadeCanonica, cidadeValida } from "../../lib/clientes/cidadeValida"

/**
 * Unit tests for the pure cidadeValida/cidadeCanonica helpers (Phase 9 Plan 6,
 * Task 1, RED). Fabricated lookup lists, no Supabase — mirrors
 * tests/importacao/dedupe.test.ts's pure-function style.
 */

const cidades = [
  { nome: "Campinas", uf: "SP" },
  { nome: "Santos", uf: "SP" },
]

describe("cidadeValida", () => {
  it("returns true when cidade belongs to estado", () => {
    expect(cidadeValida("Campinas", "SP", cidades)).toBe(true)
  })

  it("returns true case/trim/acento-insensitive", () => {
    expect(cidadeValida("campinas ", "SP", cidades)).toBe(true)
  })

  it("returns false when uf does not match", () => {
    expect(cidadeValida("Campinas", "RJ", [{ nome: "Campinas", uf: "SP" }])).toBe(
      false
    )
  })

  it("returns false when cidade does not exist in estado", () => {
    expect(cidadeValida("Cidade Inexistente", "SP", cidades)).toBe(false)
  })
})

describe("cidadeCanonica", () => {
  it("returns the canonical nome from the lookup when it matches", () => {
    expect(cidadeCanonica("campinas", "SP", cidades)).toBe("Campinas")
  })

  it("returns null when there is no match", () => {
    expect(cidadeCanonica("Cidade Inexistente", "SP", cidades)).toBeNull()
  })
})
