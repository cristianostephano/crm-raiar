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

  // Quick task 260914-j8g: falso positivo real e confirmado ao vivo — redes
  // com várias lojas (ex. Carrefour, Outback) têm filiais com razão social
  // igual e CNPJ diferente marcadas como "Possível duplicado" uma da outra,
  // quando são clientes PJ legitimamente diferentes. Regra travada: nome
  // igual só vira duplicado quando o CNPJ também bate OU quando falta CNPJ
  // em pelo menos um dos dois lados (sem CNPJ não há como desambiguar).

  it("(a1) flags nome igual + CNPJ igual as duplicate when comparing batch against existentes (regressão preservada)", () => {
    const batch = [
      { row: 0, razaoSocial: "Distribuidora ABC Ltda", cnpj: "12.345.678/0001-90" },
    ]
    const existentes = ["Distribuidora ABC Ltda"]
    const existentesCnpj = ["12345678000190"]

    const result = findDuplicates(batch, existentes, [], existentesCnpj)

    expect(result.get(0)).toBe("Distribuidora ABC Ltda")
  })

  it("(a2) flags nome igual + CNPJ igual as duplicate within the same batch (regressão preservada)", () => {
    const batch = [
      { row: 0, razaoSocial: "Distribuidora ABC Ltda", cnpj: "12.345.678/0001-90" },
      { row: 1, razaoSocial: "DISTRIBUIDORA ABC LTDA.", cnpj: "12345678000190" },
    ]

    const result = findDuplicates(batch, [])

    expect(result.get(1)).toBe("Distribuidora ABC Ltda")
    expect(result.get(0)).toBe("DISTRIBUIDORA ABC LTDA.")
  })

  it("(b1) does not flag nome igual + CNPJ diferente (ambos presentes) against existentes — filial de rede (o fix, ex. Carrefour)", () => {
    const batch = [
      {
        row: 0,
        razaoSocial: "CARREFOUR COMERCIO E INDUSTRIA LTDA",
        cnpj: "45.543.915/0001-70",
      },
    ]
    const existentes = ["Carrefour Comercio e Industria Ltda"]
    const existentesCnpj = ["45.543.915/0002-51"]

    const result = findDuplicates(batch, existentes, [], existentesCnpj)

    expect(result.has(0)).toBe(false)
  })

  it("(b2) does not flag nome igual + CNPJ diferente (ambos presentes) within the same batch — filiais de rede (o fix, ex. Outback)", () => {
    const batch = [
      {
        row: 0,
        razaoSocial: "OUTBACK STEAKHOUSE RESTAURANTES BRASIL S.A.",
        cnpj: "02.190.917/0001-52",
      },
      {
        row: 1,
        razaoSocial: "Outback Steakhouse Restaurantes Brasil S.A.",
        cnpj: "02.190.917/0002-33",
      },
    ]

    const result = findDuplicates(batch, [])

    expect(result.has(0)).toBe(false)
    expect(result.has(1)).toBe(false)
  })

  it("(c1) still flags nome igual when the DB side has no CNPJ (ambíguo = duplicado, regressão preservada)", () => {
    const batch = [
      { row: 0, razaoSocial: "Distribuidora ABC Ltda", cnpj: "12.345.678/0001-90" },
    ]
    const existentes = ["Distribuidora ABC Ltda"]

    const result = findDuplicates(batch, existentes, [], [null])

    expect(result.get(0)).toBe("Distribuidora ABC Ltda")
  })

  it("(c2) still flags nome igual when the batch side has no CNPJ (ambíguo = duplicado, regressão preservada)", () => {
    const batch = [{ row: 0, razaoSocial: "Distribuidora ABC Ltda", cnpj: "   " }]
    const existentes = ["Distribuidora ABC Ltda"]
    const existentesCnpj = ["12.345.678/0001-90"]

    const result = findDuplicates(batch, existentes, [], existentesCnpj)

    expect(result.get(0)).toBe("Distribuidora ABC Ltda")
  })

  it("(d) never flags a different razão social as duplicate, even with the same CNPJ (nome continua o filtro primário)", () => {
    const batch = [{ row: 0, razaoSocial: "Padaria do Zé", cnpj: "11.111.111/0001-11" }]
    const existentes = ["Mercado do João"]
    const existentesCnpj = ["11.111.111/0001-11"]

    const result = findDuplicates(batch, existentes, [], existentesCnpj)

    expect(result.has(0)).toBe(false)
  })

  it("(e) matches a batch row against only the existentes entry whose CNPJ actually bate, when duas filiais já cadastradas compartilham o mesmo nome", () => {
    const existentes = ["Rede XYZ Comercio Ltda", "Rede XYZ Comercio Ltda"]
    const existentesCnpj = ["10.000.000/0001-00", "10.000.000/0002-90"]

    const batchBateSegunda = [
      { row: 0, razaoSocial: "Rede XYZ Comercio Ltda", cnpj: "10.000.000/0002-90" },
    ]
    const resultBate = findDuplicates(batchBateSegunda, existentes, [], existentesCnpj)
    expect(resultBate.get(0)).toBe("Rede XYZ Comercio Ltda")

    const batchNaoBateNenhuma = [
      { row: 0, razaoSocial: "Rede XYZ Comercio Ltda", cnpj: "10.000.000/0003-71" },
    ]
    const resultNaoBate = findDuplicates(
      batchNaoBateNenhuma,
      existentes,
      [],
      existentesCnpj
    )
    expect(resultNaoBate.has(0)).toBe(false)
  })

  it("(f) treats CNPJ with different punctuation but the same digits as the same CNPJ (comparação por dígitos)", () => {
    const batch = [
      { row: 0, razaoSocial: "Distribuidora ABC Ltda", cnpj: "12345678000190" },
    ]
    const existentes = ["Distribuidora ABC Ltda"]
    const existentesCnpj = ["12.345.678/0001-90"]

    const result = findDuplicates(batch, existentes, [], existentesCnpj)

    expect(result.get(0)).toBe("Distribuidora ABC Ltda")
  })
})
