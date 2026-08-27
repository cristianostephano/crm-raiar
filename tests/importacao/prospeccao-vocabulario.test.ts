import { describe, expect, it } from "vitest"

import { SYSTEM_FIELDS } from "../../lib/importacao/types"
import { createImportRowSchema } from "../../lib/validations/importacao"

/**
 * Invariante mecânica do vocabulário da planilha de prospecção (Fase 26
 * Plano 2, PROSP-02) — espelha a forma de
 * tests/importacao/ativos-vocabulario.test.ts. Prova que as TRÊS
 * superfícies independentes de obrigatoriedade (SYSTEM_FIELDS,
 * createImportRowSchema, e — indiretamente, via annotarLinha.test.ts — o
 * ramo literal de mensagens) concordam: só Nome Fantasia e Responsável são
 * obrigatórios.
 */

describe("SYSTEM_FIELDS (prospecção)", () => {
  it("continua com 16 campos, mesmas chaves e mesma ordem de hoje", () => {
    expect(SYSTEM_FIELDS).toHaveLength(16)
    expect(SYSTEM_FIELDS.map((f) => f.key)).toEqual([
      "razaoSocial",
      "cnpj",
      "nomeFantasia",
      "cep",
      "rua",
      "numero",
      "complemento",
      "cidade",
      "estado",
      "categoria",
      "contato",
      "telefone",
      "email",
      "produtos",
      "responsavel",
      "numeroDeLojas",
    ])
  })

  it("exatamente 2 definições são obrigatórias: nomeFantasia + responsavel", () => {
    const required = SYSTEM_FIELDS.filter((f) => f.required)
    expect(required).toHaveLength(2)
    expect(required.map((f) => f.key).sort()).toEqual(
      ["nomeFantasia", "responsavel"].sort()
    )
  })
})

describe("createImportRowSchema (prospecção)", () => {
  it("aceita uma entrada só com Nome Fantasia e Responsável", () => {
    const result = createImportRowSchema.safeParse({
      nomeFantasia: "Distribuidora Exemplo",
      responsavel: "vendedora@raiar.local",
    })
    expect(result.success).toBe(true)
  })

  it("recusa uma entrada com Nome Fantasia em branco, com a frase de recusa de Nome Fantasia", () => {
    const result = createImportRowSchema.safeParse({
      nomeFantasia: "",
      responsavel: "vendedora@raiar.local",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "nomeFantasia")
      expect(issue?.message).toBe("Nome Fantasia não informado")
    }
  })

  it("aceita razão social ausente", () => {
    const result = createImportRowSchema.safeParse({
      nomeFantasia: "Distribuidora Exemplo",
      responsavel: "vendedora@raiar.local",
    })
    expect(result.success).toBe(true)
  })

  it("aceita razão social em branco", () => {
    const result = createImportRowSchema.safeParse({
      razaoSocial: "",
      nomeFantasia: "Distribuidora Exemplo",
      responsavel: "vendedora@raiar.local",
    })
    expect(result.success).toBe(true)
  })
})
