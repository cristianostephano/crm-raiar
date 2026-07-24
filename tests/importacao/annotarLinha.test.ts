import { describe, expect, it } from "vitest"

import {
  annotarLinha,
  type AnnotarLinhaLookups,
} from "../../lib/importacao/annotarLinha"
import { createImportRowSchema } from "../../lib/validations/importacao"

/**
 * Unit tests for the per-row Zod schema + pure annotation function (06-02
 * Task 2, IMP-04/IMP-05/D-02). Pure-function style, fabricated lookup lists
 * — no Supabase, no .env.local, mirroring tests/importacao/dedupe.test.ts.
 */

function baseRow() {
  return {
    razaoSocial: "Distribuidora ABC Ltda",
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: "vendedora@raiar.local",
  }
}

const lookups: AnnotarLinhaLookups = {
  vendedores: [
    {
      id: "vendedor-1",
      nome: "Ana",
      sobrenome: "Souza",
      email: "vendedora@raiar.local",
    },
    {
      id: "vendedor-2",
      nome: "Bruno",
      sobrenome: "Lima",
      email: "bruno@raiar.local",
    },
  ],
  categorias: [
    { id: "cat-1", nome: "Food Service" },
    { id: "cat-2", nome: "Varejo tradicional" },
  ],
  produtos: [
    { id: "prod-1", nome: "Casca" },
    { id: "prod-2", nome: "Pasteurizado" },
  ],
}

describe("createImportRowSchema", () => {
  it("accepts a row with every required field filled", () => {
    const result = createImportRowSchema.safeParse(baseRow())
    expect(result.success).toBe(true)
  })

  it("rejects a row missing a required field, pointing at the field", () => {
    const { razaoSocial: _razaoSocial, ...rest } = baseRow()
    const result = createImportRowSchema.safeParse(rest)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "razaoSocial")).toBe(
        true
      )
    }
  })
})

describe("annotarLinha", () => {
  it("returns status ok when every required field and lookup resolves", () => {
    const result = annotarLinha(baseRow(), lookups)

    expect(result.status).toBe("ok")
    expect(result.reasons).toEqual([])
    expect(result.resolved.responsavelId).toBe("vendedor-1")
  })

  it("flags a row missing razão social, endereço, and responsável as erro", () => {
    const result = annotarLinha(
      {
        cep: "",
        rua: "",
        numero: "",
        cidade: "",
        estado: "",
      },
      lookups
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain("Razão social não informada")
    expect(result.reasons).toContain("Endereço não informado")
    expect(result.reasons).toContain("Responsável não informado")
    // Endereço reason must appear only once even though 5 fields are missing.
    expect(
      result.reasons.filter((r) => r === "Endereço não informado")
    ).toHaveLength(1)
  })

  it("flags a nonexistent categoria as erro, never resolving blank or auto-creating (D-02)", () => {
    const result = annotarLinha(
      { ...baseRow(), categoria: "Categoria Inexistente" },
      lookups
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain('Categoria "Categoria Inexistente" não existe')
    expect(result.resolved.categoriaId).toBeNull()
  })

  it("resolves an existing categoria case/accent-insensitively", () => {
    const result = annotarLinha(
      { ...baseRow(), categoria: "FOOD SERVICE" },
      lookups
    )

    expect(result.status).toBe("ok")
    expect(result.resolved.categoriaId).toBe("cat-1")
  })

  it("flags a nonexistent produto (multi-value) as erro (D-02)", () => {
    const result = annotarLinha(
      { ...baseRow(), produtos: "Casca, Óleo" },
      lookups
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain('Produto "Óleo" não existe')
    expect(result.resolved.produtoIds).toEqual(["prod-1"])
  })

  it("resolves multiple existing produtos", () => {
    const result = annotarLinha(
      { ...baseRow(), produtos: "Casca;Pasteurizado" },
      lookups
    )

    expect(result.status).toBe("ok")
    expect(result.resolved.produtoIds).toEqual(["prod-1", "prod-2"])
  })

  it("flags a responsável not found in lookups as erro (IMP-04)", () => {
    const result = annotarLinha(
      { ...baseRow(), responsavel: "ninguem@raiar.local" },
      lookups
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain("Responsável não informado")
    expect(result.resolved.responsavelId).toBeNull()
  })

  it("resolves responsável by exact email", () => {
    const result = annotarLinha(
      { ...baseRow(), responsavel: "bruno@raiar.local" },
      lookups
    )

    expect(result.status).toBe("ok")
    expect(result.resolved.responsavelId).toBe("vendedor-2")
  })

  it("resolves responsável by normalized full name", () => {
    const result = annotarLinha(
      { ...baseRow(), responsavel: "bruno lima" },
      lookups
    )

    expect(result.status).toBe("ok")
    expect(result.resolved.responsavelId).toBe("vendedor-2")
  })

  it("sanitizes every cell value before it enters resolved (A4)", () => {
    const result = annotarLinha(
      { ...baseRow(), contato: "=cmd|' /C calc'!A1" },
      lookups
    )

    expect(result.resolved.contato).toBe("'=cmd|' /C calc'!A1")
  })
})
