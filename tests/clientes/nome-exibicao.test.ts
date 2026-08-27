import { describe, expect, it } from "vitest"

import {
  ROTULO_SEM_NOME,
  nomeExibicaoCliente,
} from "../../lib/clientes/nomeExibicao"

/**
 * Unit tests for the single source of truth for the "nome exibido" of a
 * cliente (Fase 26 Plano 4, T-26-15). Pure-function style, no Supabase, no
 * server context — mesma forma de tests/clientes/rotulo-localizacao.test.ts.
 */

describe("nomeExibicaoCliente", () => {
  it("shows the razão social when it is filled in", () => {
    expect(nomeExibicaoCliente("Distribuidora ABC", "ABC Alimentos")).toBe(
      "Distribuidora ABC"
    )
  })

  it("falls back to Nome Fantasia when razão social is null", () => {
    expect(nomeExibicaoCliente(null, "ABC Alimentos")).toBe("ABC Alimentos")
  })

  it("falls back to Nome Fantasia when razão social is missing (undefined)", () => {
    expect(nomeExibicaoCliente(undefined, "ABC Alimentos")).toBe(
      "ABC Alimentos"
    )
  })

  it("falls back to Nome Fantasia when razão social is only whitespace", () => {
    expect(nomeExibicaoCliente("   ", "ABC Alimentos")).toBe("ABC Alimentos")
  })

  it("falls back to the single absence label when neither is filled in", () => {
    expect(nomeExibicaoCliente(null, null)).toBe(ROTULO_SEM_NOME)
    expect(nomeExibicaoCliente(undefined, undefined)).toBe(ROTULO_SEM_NOME)
    expect(nomeExibicaoCliente("   ", "   ")).toBe(ROTULO_SEM_NOME)
  })

  it("tolerates null/undefined in both arguments without throwing", () => {
    expect(() => nomeExibicaoCliente(null, undefined)).not.toThrow()
    expect(() => nomeExibicaoCliente(undefined, null)).not.toThrow()
  })
})
