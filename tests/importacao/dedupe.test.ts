import { describe, expect, it } from "vitest"

import { findDuplicates, normalizeRazaoSocial } from "../../lib/importacao/dedupe"

/**
 * Unit tests for the razão-social normalization + duplicate-detection
 * primitives (06-02 Task 1, IMP-07/D-03). Pure-function style, following
 * tests/importacao/parseArquivo.test.ts — no Supabase, no server context.
 */

describe("normalizeRazaoSocial", () => {
  it("collapses case, accent, punctuation, and suffix variations to the same key", () => {
    const a = normalizeRazaoSocial("Distribuidora ABC Ltda")
    const b = normalizeRazaoSocial("DISTRIBUIDORA ABC LTDA.")
    const c = normalizeRazaoSocial("Distribuidóra  ABC")

    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it("removes common corporate suffixes (s/a, s.a., sa, me, eireli, epp, mei)", () => {
    expect(normalizeRazaoSocial("Comércio XYZ S/A")).toBe(
      normalizeRazaoSocial("Comércio XYZ")
    )
    expect(normalizeRazaoSocial("Comércio XYZ S.A.")).toBe(
      normalizeRazaoSocial("Comércio XYZ")
    )
    expect(normalizeRazaoSocial("Comércio XYZ SA")).toBe(
      normalizeRazaoSocial("Comércio XYZ")
    )
    expect(normalizeRazaoSocial("Comércio XYZ ME")).toBe(
      normalizeRazaoSocial("Comércio XYZ")
    )
    expect(normalizeRazaoSocial("Comércio XYZ EIRELI")).toBe(
      normalizeRazaoSocial("Comércio XYZ")
    )
    expect(normalizeRazaoSocial("Comércio XYZ EPP")).toBe(
      normalizeRazaoSocial("Comércio XYZ")
    )
    expect(normalizeRazaoSocial("Comércio XYZ MEI")).toBe(
      normalizeRazaoSocial("Comércio XYZ")
    )
  })

  it("produces different keys for genuinely different companies", () => {
    expect(normalizeRazaoSocial("Padaria do Zé")).not.toBe(
      normalizeRazaoSocial("Mercado do João")
    )
  })

  it("returns an empty string for null or undefined, without throwing (Bug B da pesquisa da Fase 26)", () => {
    expect(normalizeRazaoSocial(null)).toBe("")
    expect(normalizeRazaoSocial(undefined)).toBe("")
  })
})

describe("findDuplicates", () => {
  it("flags a batch row whose normalized name matches an existing DB name (IMP-07)", () => {
    const batch = [{ row: 0, razaoSocial: "DISTRIBUIDORA ABC LTDA." }]
    const existentes = ["Distribuidora ABC Ltda"]

    const result = findDuplicates(batch, existentes)

    expect(result.get(0)).toBe("Distribuidora ABC Ltda")
  })

  it("flags two rows within the same batch as duplicates of each other (D-03)", () => {
    const batch = [
      { row: 0, razaoSocial: "Distribuidora ABC Ltda" },
      { row: 1, razaoSocial: "DISTRIBUIDORA ABC LTDA." },
    ]

    const result = findDuplicates(batch, [])

    expect(result.get(1)).toBe("Distribuidora ABC Ltda")
    expect(result.get(0)).toBe("DISTRIBUIDORA ABC LTDA.")
  })

  it("does not flag a razão social that is unique in both the batch and the DB", () => {
    const batch = [{ row: 0, razaoSocial: "Padaria do Zé" }]
    const existentes = ["Mercado do João"]

    const result = findDuplicates(batch, existentes)

    expect(result.has(0)).toBe(false)
  })

  it("does not flag two genuinely different companies within the same batch", () => {
    const batch = [
      { row: 0, razaoSocial: "Padaria do Zé" },
      { row: 1, razaoSocial: "Mercado do João" },
    ]

    const result = findDuplicates(batch, [])

    expect(result.has(0)).toBe(false)
    expect(result.has(1)).toBe(false)
  })

  it("does not throw when the existentes list contains null razões sociais (Bug B da pesquisa da Fase 26)", () => {
    const batch = [{ row: 0, razaoSocial: "Padaria do Zé" }]
    const existentes = [null, "Mercado do João", null]

    expect(() => findDuplicates(batch, existentes)).not.toThrow()
    expect(findDuplicates(batch, existentes).has(0)).toBe(false)
  })

  it("flags two batch rows without razão social but with the same Nome Fantasia as duplicates of each other (chave de reserva, PROSP-02)", () => {
    const batch = [
      { row: 0, razaoSocial: null, nomeFantasia: "Distribuidora Exemplo" },
      { row: 1, razaoSocial: null, nomeFantasia: "DISTRIBUIDORA EXEMPLO" },
    ]

    const result = findDuplicates(batch, [])

    expect(result.get(0)).toBe("DISTRIBUIDORA EXEMPLO")
    expect(result.get(1)).toBe("Distribuidora Exemplo")
  })

  it("does not flag two batch rows without razão social when their Nome Fantasia differ (chave de reserva, PROSP-02)", () => {
    const batch = [
      { row: 0, razaoSocial: null, nomeFantasia: "Distribuidora A" },
      { row: 1, razaoSocial: null, nomeFantasia: "Distribuidora B" },
    ]

    const result = findDuplicates(batch, [])

    expect(result.has(0)).toBe(false)
    expect(result.has(1)).toBe(false)
  })

  it("skips a batch row with neither razão social nor Nome Fantasia, exactly like before (chave de reserva, PROSP-02)", () => {
    const batch = [
      { row: 0, razaoSocial: null, nomeFantasia: null },
      { row: 1, razaoSocial: "Padaria do Zé" },
    ]

    const result = findDuplicates(batch, [])

    expect(result.has(0)).toBe(false)
    expect(result.has(1)).toBe(false)
  })

  it("does not let a razão social collide with a same-text Nome Fantasia reserve key (separate namespaces, PROSP-02)", () => {
    const batch = [
      { row: 0, razaoSocial: "Distribuidora Exemplo" },
      { row: 1, razaoSocial: null, nomeFantasia: "Distribuidora Exemplo" },
    ]

    const result = findDuplicates(batch, [])

    expect(result.has(0)).toBe(false)
    expect(result.has(1)).toBe(false)
  })
})
