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
  cidades: [
    { nome: "São Paulo", uf: "SP" },
    { nome: "Campinas", uf: "SP" },
  ],
}

describe("createImportRowSchema", () => {
  it("accepts a row with every required field filled", () => {
    const result = createImportRowSchema.safeParse(baseRow())
    expect(result.success).toBe(true)
  })

  it("rejects a row missing a required field, pointing at the field", () => {
    const rest: Record<string, unknown> = { ...baseRow() }
    delete rest.razaoSocial
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

  it("returns status ok with an empty reasons list when only razão social and responsável are filled and the 5 endereço cells are blank (D-01/D-02, quick task 260819-m8q)", () => {
    const result = annotarLinha(
      {
        razaoSocial: "Distribuidora ABC Ltda",
        responsavel: "vendedora@raiar.local",
      },
      lookups
    )

    expect(result.status).toBe("ok")
    expect(result.reasons).toEqual([])
  })

  it("resolves the 5 endereço fields to NULL (never empty string) when their cells are blank (D-04, quick task 260819-m8q)", () => {
    const result = annotarLinha(
      {
        razaoSocial: "Distribuidora ABC Ltda",
        responsavel: "vendedora@raiar.local",
      },
      lookups
    )

    expect(result.resolved.cep).toBeNull()
    expect(result.resolved.rua).toBeNull()
    expect(result.resolved.numero).toBeNull()
    expect(result.resolved.cidade).toBeNull()
    expect(result.resolved.estado).toBeNull()
  })

  it("still flags a row missing razão social as erro, with the same reason as before (endereço blank adds no reason)", () => {
    const result = annotarLinha(
      {
        cep: "",
        rua: "",
        numero: "",
        cidade: "",
        estado: "",
        responsavel: "vendedora@raiar.local",
      },
      lookups
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain("Razão social não informada")
    expect(result.reasons).not.toContain("Endereço não informado")
  })

  it("still flags a row missing responsável as erro, with the same reason as before (endereço blank adds no reason)", () => {
    const result = annotarLinha(
      {
        razaoSocial: "Distribuidora ABC Ltda",
        cep: "",
        rua: "",
        numero: "",
        cidade: "",
        estado: "",
      },
      lookups
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain("Responsável não informado")
    expect(result.reasons).not.toContain("Endereço não informado")
  })

  it("resolves a whitespace-only cep cell to null, not an empty string (D-04, quick task 260819-m8q)", () => {
    const result = annotarLinha({ ...baseRow(), cep: "   " }, lookups)

    expect(result.status).toBe("ok")
    expect(result.resolved.cep).toBeNull()
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

  it("flags an estado that is not one of the 27 UF siglas (LOC-01)", () => {
    const result = annotarLinha({ ...baseRow(), estado: "ZZ" }, lookups)

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain('Estado "ZZ" não é uma sigla de UF válida')
  })

  it("flags a cidade that does not belong to the chosen estado (LOC-02)", () => {
    const result = annotarLinha(
      { ...baseRow(), estado: "SP", cidade: "Cidade Inexistente" },
      lookups
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain(
      'Cidade "Cidade Inexistente" não encontrada para o estado SP'
    )
  })

  it("resolves estado to uppercase UF and cidade to the canonical IBGE nome (LOC-01/LOC-02)", () => {
    const result = annotarLinha(
      { ...baseRow(), estado: "sp", cidade: "campinas" },
      lookups
    )

    expect(result.status).toBe("ok")
    expect(result.resolved.estado).toBe("SP")
    expect(result.resolved.cidade).toBe("Campinas")
  })

  it("resolves cnpj and nomeFantasia from sanitized cells when present (IMP-01/IMP-02)", () => {
    const result = annotarLinha(
      {
        ...baseRow(),
        cnpj: "12.345.678/0001-90",
        nomeFantasia: "Distribuidora Exemplo",
      },
      lookups
    )

    expect(result.status).toBe("ok")
    expect(result.resolved.cnpj).toBe("12.345.678/0001-90")
    expect(result.resolved.nomeFantasia).toBe("Distribuidora Exemplo")
  })

  it("resolves cnpj and nomeFantasia to null when the cells are absent, never adding a reason (IMP-01/IMP-02)", () => {
    const result = annotarLinha(baseRow(), lookups)

    expect(result.status).toBe("ok")
    expect(result.reasons).toEqual([])
    expect(result.resolved.cnpj).toBeNull()
    expect(result.resolved.nomeFantasia).toBeNull()
  })

  it("resolves a whitespace-only cnpj cell to null, not an empty string", () => {
    const result = annotarLinha({ ...baseRow(), cnpj: "   " }, lookups)

    expect(result.status).toBe("ok")
    expect(result.resolved.cnpj).toBeNull()
  })

  it("accepts any non-empty cnpj value regardless of format — no format-validation reason exists", () => {
    const result = annotarLinha(
      { ...baseRow(), cnpj: "formato-qualquer-nao-e-cnpj-de-verdade" },
      lookups
    )

    expect(result.status).toBe("ok")
    expect(result.reasons).toEqual([])
    expect(result.resolved.cnpj).toBe("formato-qualquer-nao-e-cnpj-de-verdade")
  })

  it("sanitizes a formula-risk cnpj cell through the same row-wide sanitization path (T-19-11)", () => {
    const result = annotarLinha(
      { ...baseRow(), cnpj: "=cmd|' /C calc'!A1" },
      lookups
    )

    expect(result.resolved.cnpj).toBe("'=cmd|' /C calc'!A1")
  })
})
