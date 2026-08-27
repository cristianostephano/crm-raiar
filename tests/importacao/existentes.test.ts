import { describe, expect, it } from "vitest"

import { nomesExistentesParaDedupe } from "../../lib/importacao/existentes"

/**
 * Unit tests for the null-safe "clientes já cadastrados" reader (Fase 26
 * Plano 3, Task 1, T-26-08). Pure-function style, following
 * tests/importacao/dedupe.test.ts — no Supabase, no server context.
 */

describe("nomesExistentesParaDedupe", () => {
  it("returns razões sociais without rows whose razão social is null, without throwing", () => {
    const result = nomesExistentesParaDedupe([
      { razao_social: "Distribuidora ABC Ltda" },
      { razao_social: null },
      { razao_social: "Mercado do João" },
    ])

    expect(result.razoesSociais).toEqual([
      "Distribuidora ABC Ltda",
      "Mercado do João",
    ])
  })

  it("discards a razão social that is only whitespace", () => {
    const result = nomesExistentesParaDedupe([
      { razao_social: "   " },
      { razao_social: "Padaria do Zé" },
    ])

    expect(result.razoesSociais).toEqual(["Padaria do Zé"])
  })

  it("discards a Nome Fantasia that is null, undefined, or only whitespace", () => {
    const result = nomesExistentesParaDedupe([
      { razao_social: "Empresa A", nome_fantasia: null },
      { razao_social: "Empresa B", nome_fantasia: undefined },
      { razao_social: "Empresa C", nome_fantasia: "   " },
      { razao_social: "Empresa D", nome_fantasia: "Fantasia D" },
    ])

    expect(result.nomesFantasia).toEqual(["Fantasia D"])
  })

  it("returns an empty Nome Fantasia list when the query never brought that field at all (fluxo de clientes ativos)", () => {
    const result = nomesExistentesParaDedupe([
      { razao_social: "Empresa A" },
      { razao_social: "Empresa B" },
    ])

    expect(result.nomesFantasia).toEqual([])
  })

  it("returns two empty lists for an empty read", () => {
    const result = nomesExistentesParaDedupe([])

    expect(result).toEqual({ razoesSociais: [], nomesFantasia: [] })
  })

  it("trims surrounding whitespace from usable values", () => {
    const result = nomesExistentesParaDedupe([
      { razao_social: "  Comércio XYZ  ", nome_fantasia: "  Fantasia XYZ  " },
    ])

    expect(result.razoesSociais).toEqual(["Comércio XYZ"])
    expect(result.nomesFantasia).toEqual(["Fantasia XYZ"])
  })
})
