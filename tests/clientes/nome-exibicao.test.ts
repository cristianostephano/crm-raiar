import { describe, expect, it } from "vitest"

import {
  ROTULO_SEM_NOME,
  nomeExibicaoCliente,
} from "../../lib/clientes/nomeExibicao"

/**
 * Unit tests for the single source of truth for the "nome exibido" of a
 * cliente (Fase 26 Plano 4, T-26-15). Pure-function style, no Supabase, no
 * server context — mesma forma de tests/clientes/rotulo-localizacao.test.ts.
 *
 * Prioridade invertida na quick task 260928-fqk (2026-09-28): Nome Fantasia
 * vem primeiro, depois razão social, depois ROTULO_SEM_NOME.
 */

describe("nomeExibicaoCliente", () => {
  it("shows the Nome Fantasia when both are filled in", () => {
    expect(nomeExibicaoCliente("Distribuidora ABC", "ABC Alimentos")).toBe(
      "ABC Alimentos"
    )
  })

  it("falls back to razão social when Nome Fantasia is null", () => {
    expect(nomeExibicaoCliente("Distribuidora ABC", null)).toBe(
      "Distribuidora ABC"
    )
  })

  it("falls back to razão social when Nome Fantasia is missing (undefined)", () => {
    expect(nomeExibicaoCliente("Distribuidora ABC", undefined)).toBe(
      "Distribuidora ABC"
    )
  })

  it("falls back to razão social when Nome Fantasia is an empty string", () => {
    expect(nomeExibicaoCliente("Distribuidora ABC", "")).toBe(
      "Distribuidora ABC"
    )
  })

  it("falls back to razão social when Nome Fantasia is only whitespace", () => {
    expect(nomeExibicaoCliente("Distribuidora ABC", "   ")).toBe(
      "Distribuidora ABC"
    )
  })

  it("shows the Nome Fantasia when razão social is null", () => {
    expect(nomeExibicaoCliente(null, "ABC Alimentos")).toBe("ABC Alimentos")
  })

  it("shows the Nome Fantasia when razão social is missing (undefined)", () => {
    expect(nomeExibicaoCliente(undefined, "ABC Alimentos")).toBe(
      "ABC Alimentos"
    )
  })

  it("shows the Nome Fantasia when razão social is only whitespace", () => {
    expect(nomeExibicaoCliente("   ", "ABC Alimentos")).toBe("ABC Alimentos")
  })

  it("shows the Nome Fantasia even when razão social looks like a MEI document-prefixed name (regression, dado fictício)", () => {
    expect(
      nomeExibicaoCliente("00.000.000 FULANO DE TAL", "Mercearia Exemplo")
    ).toBe("Mercearia Exemplo")
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
