import { describe, expect, it } from "vitest"
import * as XLSX from "@e965/xlsx"

import { buildModeloCnpj } from "../../lib/importacao/modeloCnpj"
import {
  NAO_IMPORTAR,
  applyMapping,
  requiredFieldsFaltando,
  suggestMapping,
  type ColumnMappingOf,
} from "../../lib/importacao/mapping"
import {
  SYSTEM_FIELDS_CNPJ,
  type SystemFieldCnpj,
} from "../../lib/importacao/typesCnpj"

/**
 * Unit tests for the terceiro vocabulário de campos + o gerador do modelo de
 * planilha "CNPJ em massa" (19-03 Task 1). Pure-function style, no Supabase —
 * espelha tests/importacao/frequencia-vocabulario.test.ts's shape.
 */

function readRows(buffer: Uint8Array): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
}

describe("SYSTEM_FIELDS_CNPJ", () => {
  it("campos: o terceiro vocabulario tem exatamente duas definicoes, ambas obrigatorias, com chaves/rotulos do contrato", () => {
    expect(SYSTEM_FIELDS_CNPJ).toHaveLength(2)
    expect(SYSTEM_FIELDS_CNPJ.every((field) => field.required)).toBe(true)
    expect(SYSTEM_FIELDS_CNPJ.map((field) => field.key)).toEqual([
      "razaoSocial",
      "cnpj",
    ])
    expect(SYSTEM_FIELDS_CNPJ.map((field) => field.label)).toEqual([
      "Razão social",
      "CNPJ",
    ])
  })
})

describe("suggestMapping contra o terceiro vocabulario", () => {
  it("sugestao: um cabecalho escrito como o rotulo do campo (com variacao de caixa/acento/pontuacao) e sugerido corretamente", () => {
    expect(suggestMapping("razao social", SYSTEM_FIELDS_CNPJ)).toBe(
      "razaoSocial"
    )
    expect(suggestMapping("RAZÃO SOCIAL", SYSTEM_FIELDS_CNPJ)).toBe(
      "razaoSocial"
    )
    expect(suggestMapping("C.N.P.J.", SYSTEM_FIELDS_CNPJ)).toBe("cnpj")
    expect(suggestMapping("cnpj", SYSTEM_FIELDS_CNPJ)).toBe("cnpj")
  })

  it("apelidoforadalista: um cabecalho conhecido pela tabela de apelidos mas fora deste vocabulario sugere nao importar", () => {
    expect(suggestMapping("CEP", SYSTEM_FIELDS_CNPJ)).toBe(NAO_IMPORTAR)
    expect(suggestMapping("vendedor", SYSTEM_FIELDS_CNPJ)).toBe(NAO_IMPORTAR)
    expect(suggestMapping("Nome Fantasia", SYSTEM_FIELDS_CNPJ)).toBe(
      NAO_IMPORTAR
    )
  })

  it("apelidopreservado: os mesmos cabecalhos avaliados contra o vocabulario de 16 campos continuam sendo sugeridos para as chaves de sempre", () => {
    expect(suggestMapping("CEP")).toBe("cep")
    expect(suggestMapping("vendedor")).toBe("responsavel")
    expect(suggestMapping("Nome Fantasia")).toBe("nomeFantasia")
  })
})

describe("requiredFieldsFaltando contra o terceiro vocabulario", () => {
  it("obrigatorios: sem nenhuma coluna mapeada devolve as duas definicoes; com as duas mapeadas devolve lista vazia", () => {
    const semNada = requiredFieldsFaltando<SystemFieldCnpj>(
      {},
      SYSTEM_FIELDS_CNPJ
    )
    expect(semNada.map((field) => field.key)).toEqual(["razaoSocial", "cnpj"])

    const mapping: ColumnMappingOf<SystemFieldCnpj> = {
      0: "razaoSocial",
      1: "cnpj",
    }
    expect(requiredFieldsFaltando(mapping, SYSTEM_FIELDS_CNPJ)).toEqual([])
  })
})

describe("applyMapping contra o terceiro vocabulario", () => {
  it("aplicar: a aplicacao do mapeamento sobre linhas cruas produz objetos so com as duas chaves, descartando nao importar", () => {
    const headers = ["Empresa", "Coluna Ignorada", "Documento"]
    const rows = [["Distribuidora ABC", "lixo", "12.345.678/0001-90"]]
    const mapping: ColumnMappingOf<SystemFieldCnpj> = {
      0: "razaoSocial",
      1: NAO_IMPORTAR,
      2: "cnpj",
    }

    const result = applyMapping<SystemFieldCnpj>(headers, rows, mapping)

    expect(result).toEqual([
      { razaoSocial: "Distribuidora ABC", cnpj: "12.345.678/0001-90" },
    ])
  })
})

describe("buildModeloCnpj", () => {
  it("modelo: o modelo gerado tem exatamente duas colunas com os rotulos do contrato e uma linha de exemplo, com duas celulas", () => {
    const rows = readRows(buildModeloCnpj())

    expect(rows[0]).toEqual(["Razão social", "CNPJ"])
    expect(rows).toHaveLength(2)

    const exampleRow = rows[1] as string[]
    expect(exampleRow).toHaveLength(2)
    expect(exampleRow[0].length).toBeGreaterThan(0)
    expect(exampleRow[1].length).toBeGreaterThan(0)
  })
})
