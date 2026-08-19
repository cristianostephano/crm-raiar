import { describe, expect, it } from "vitest"

import {
  ROTULO_SEM_CIDADE,
  ROTULO_SEM_ESTADO,
  rotuloCidadeEstado,
} from "../../lib/clientes/rotuloLocalizacao"

/**
 * Unit tests for the single source of truth for the "Sem cidade"/"Sem
 * estado" absence labels (quick task 260819-m8q, D-03). Pure-function
 * style, no Supabase, no server context.
 */

describe("rotuloCidadeEstado", () => {
  it("joins both values with a slash when both are present", () => {
    expect(rotuloCidadeEstado("São Paulo", "SP")).toBe("São Paulo/SP")
  })

  it("replaces a null cidade with the absence label, keeping the real estado", () => {
    expect(rotuloCidadeEstado(null, "SP")).toBe(`${ROTULO_SEM_CIDADE}/SP`)
  })

  it("replaces a null estado with the absence label, keeping the real cidade", () => {
    expect(rotuloCidadeEstado("Santos", null)).toBe(`Santos/${ROTULO_SEM_ESTADO}`)
  })

  it("replaces both with their absence labels when both are null", () => {
    expect(rotuloCidadeEstado(null, null)).toBe(
      `${ROTULO_SEM_CIDADE}/${ROTULO_SEM_ESTADO}`
    )
  })

  it("treats a whitespace-only cidade the same as null", () => {
    expect(rotuloCidadeEstado("   ", "SP")).toBe(`${ROTULO_SEM_CIDADE}/SP`)
  })

  it("treats a whitespace-only estado the same as null", () => {
    expect(rotuloCidadeEstado("Santos", "   ")).toBe(
      `Santos/${ROTULO_SEM_ESTADO}`
    )
  })

  it("treats whitespace-only values on both sides the same as both null", () => {
    expect(rotuloCidadeEstado("  ", "  ")).toBe(
      `${ROTULO_SEM_CIDADE}/${ROTULO_SEM_ESTADO}`
    )
  })
})
