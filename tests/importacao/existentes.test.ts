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

    expect(result).toEqual({
      razoesSociais: [],
      nomesFantasia: [],
      razoesSociaisCnpj: [],
      nomesFantasiaCnpj: [],
    })
  })

  it("trims surrounding whitespace from usable values", () => {
    const result = nomesExistentesParaDedupe([
      { razao_social: "  Comércio XYZ  ", nome_fantasia: "  Fantasia XYZ  " },
    ])

    expect(result.razoesSociais).toEqual(["Comércio XYZ"])
    expect(result.nomesFantasia).toEqual(["Fantasia XYZ"])
  })

  // Quick task 260914-j8g: nomesExistentesParaDedupe passa a extrair também o
  // CNPJ de cada cliente já cadastrado, alinhado por índice com os nomes já
  // extraídos — insumo da regra de desambiguação de findDuplicates.

  it("aligns razoesSociaisCnpj and nomesFantasiaCnpj by index with razoesSociais/nomesFantasia, even after independent filtering of the two names", () => {
    const result = nomesExistentesParaDedupe([
      { razao_social: "Empresa A", nome_fantasia: "Fantasia A", cnpj: "11.111.111/0001-11" },
      { razao_social: null, nome_fantasia: "Fantasia B", cnpj: "22.222.222/0001-22" },
      { razao_social: "Empresa C", nome_fantasia: null, cnpj: "33.333.333/0001-33" },
    ])

    expect(result.razoesSociais).toEqual(["Empresa A", "Empresa C"])
    expect(result.razoesSociaisCnpj).toEqual([
      "11.111.111/0001-11",
      "33.333.333/0001-33",
    ])
    expect(result.nomesFantasia).toEqual(["Fantasia A", "Fantasia B"])
    expect(result.nomesFantasiaCnpj).toEqual([
      "11.111.111/0001-11",
      "22.222.222/0001-22",
    ])
  })

  it("turns a whitespace-only cnpj into null in the output list (same tolerance already tested for razão social/Nome Fantasia)", () => {
    const result = nomesExistentesParaDedupe([
      { razao_social: "Empresa A", cnpj: "   " },
      { razao_social: "Empresa B", cnpj: null },
      { razao_social: "Empresa C", cnpj: "44.444.444/0001-44" },
    ])

    expect(result.razoesSociaisCnpj).toEqual([
      null,
      null,
      "44.444.444/0001-44",
    ])
  })
})
