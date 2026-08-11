import { describe, expect, it } from "vitest"

import {
  NAO_IMPORTAR,
  applyMapping,
  requiredFieldsFaltando,
  suggestMapping,
} from "@/lib/importacao/mapping"
import { SYSTEM_FIELDS_FREQUENCIA } from "@/lib/importacao/typesFrequencia"

describe("suggestMapping", () => {
  it("suggests razaoSocial for 'razao_social' and 'Razão Social'", () => {
    expect(suggestMapping("razao_social")).toBe("razaoSocial")
    expect(suggestMapping("Razão Social")).toBe("razaoSocial")
  })

  it("suggests responsavel for 'vendedor' e 'responsavel' (IMP-04)", () => {
    expect(suggestMapping("vendedor")).toBe("responsavel")
    expect(suggestMapping("responsavel")).toBe("responsavel")
    expect(suggestMapping("Responsável")).toBe("responsavel")
  })

  it("suggests NAO_IMPORTAR for a header with no good match", () => {
    expect(suggestMapping("coluna estranha sem correspondencia")).toBe(
      NAO_IMPORTAR
    )
  })

  it("matches every SYSTEM_FIELDS label verbatim", () => {
    expect(suggestMapping("CEP")).toBe("cep")
    expect(suggestMapping("Número de lojas")).toBe("numeroDeLojas")
    expect(suggestMapping("Produtos consumidos")).toBe("produtos")
  })

  it("suggests cnpj for spelling variations of the header (IMP-01)", () => {
    expect(suggestMapping("CNPJ")).toBe("cnpj")
    expect(suggestMapping("cnpj")).toBe("cnpj")
    expect(suggestMapping("C.N.P.J.")).toBe("cnpj")
    expect(suggestMapping("Cnpj")).toBe("cnpj")
  })

  it("suggests nomeFantasia for spelling variations of the header (IMP-02)", () => {
    expect(suggestMapping("Nome Fantasia")).toBe("nomeFantasia")
    expect(suggestMapping("nome_fantasia")).toBe("nomeFantasia")
    expect(suggestMapping("NOME FANTASIA")).toBe("nomeFantasia")
    expect(suggestMapping("fantasia")).toBe("nomeFantasia")
  })

  it("does not leak the new cnpj/nomeFantasia aliases into the frequência vocabulary (Fase 17, D4)", () => {
    expect(suggestMapping("CNPJ", SYSTEM_FIELDS_FREQUENCIA)).toBe(NAO_IMPORTAR)
    expect(suggestMapping("Nome Fantasia", SYSTEM_FIELDS_FREQUENCIA)).toBe(
      NAO_IMPORTAR
    )
  })
})

describe("applyMapping", () => {
  const headers = ["Empresa", "Vendedor", "Coluna Ignorada", "Produtos"]
  const rows = [
    ["Distribuidora ABC", "vendedor@empresa.com", "lixo", "casca, óleo"],
    ["Outra Empresa", "Fulano de Tal", "lixo2", "pasteurizado"],
  ]

  it("transforms rows into MappedRow[], dropping NAO_IMPORTAR columns", () => {
    const mapping = {
      0: "razaoSocial" as const,
      1: "responsavel" as const,
      2: NAO_IMPORTAR,
      3: "produtos" as const,
    }

    const result = applyMapping(headers, rows, mapping)

    expect(result).toEqual([
      {
        razaoSocial: "Distribuidora ABC",
        responsavel: "vendedor@empresa.com",
        produtos: "casca, óleo",
      },
      {
        razaoSocial: "Outra Empresa",
        responsavel: "Fulano de Tal",
        produtos: "pasteurizado",
      },
    ])
  })

  it("preserves a multi-value produtos cell as a single raw string", () => {
    const mapping = { 3: "produtos" as const }
    const result = applyMapping(headers, rows, mapping)
    expect(result[0].produtos).toBe("casca, óleo")
  })

  it("returns empty MappedRow objects when every column is unmapped", () => {
    const result = applyMapping(headers, rows, {})
    expect(result).toEqual([{}, {}])
  })
})

describe("requiredFieldsFaltando", () => {
  it("lists required fields (e.g. Responsável) not yet mapped to any column", () => {
    const mapping = {
      0: "razaoSocial" as const,
      1: "cep" as const,
      2: "rua" as const,
      3: "numero" as const,
      4: "cidade" as const,
      5: "estado" as const,
      // responsavel intentionally left unmapped
    }

    const missing = requiredFieldsFaltando(mapping)

    expect(missing.map((field) => field.key)).toEqual(["responsavel"])
  })

  it("returns an empty list once every required field is mapped", () => {
    const mapping = {
      0: "razaoSocial" as const,
      1: "cep" as const,
      2: "rua" as const,
      3: "numero" as const,
      4: "cidade" as const,
      5: "estado" as const,
      6: "responsavel" as const,
    }

    expect(requiredFieldsFaltando(mapping)).toEqual([])
  })
})
