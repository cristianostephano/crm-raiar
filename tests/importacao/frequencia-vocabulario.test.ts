import { describe, expect, it } from "vitest"
import * as XLSX from "@e965/xlsx"

import { FREQUENCIA_VISITA_LABELS } from "../../lib/funil/frequencia"
import { buildModeloFrequencia } from "../../lib/importacao/modeloFrequencia"
import {
  NAO_IMPORTAR,
  applyMapping,
  requiredFieldsFaltando,
  suggestMapping,
  type ColumnMappingOf,
} from "../../lib/importacao/mapping"
import {
  SYSTEM_FIELDS_FREQUENCIA,
  type SystemFieldFrequencia,
} from "../../lib/importacao/typesFrequencia"

/**
 * Unit tests for the D4 mapping-layer generalization + the second field list
 * + the frequency-import model generator (17-03 Task 1). Pure-function
 * style, no Supabase — mirrors tests/importacao/mapping.test.ts's shape.
 */

function readRows(buffer: Uint8Array): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
}

describe("SYSTEM_FIELDS_FREQUENCIA", () => {
  it("campos: a segunda lista tem exatamente duas definicoes, ambas obrigatorias, com chaves/rotulos do contrato", () => {
    expect(SYSTEM_FIELDS_FREQUENCIA).toHaveLength(2)
    expect(SYSTEM_FIELDS_FREQUENCIA.every((field) => field.required)).toBe(true)
    expect(SYSTEM_FIELDS_FREQUENCIA.map((field) => field.key)).toEqual([
      "razaoSocial",
      "frequenciaVisita",
    ])
    expect(SYSTEM_FIELDS_FREQUENCIA.map((field) => field.label)).toEqual([
      "Razão social",
      "Frequência de visita",
    ])
  })
})

describe("suggestMapping contra a segunda lista (D4)", () => {
  it("sugestao: um cabecalho escrito como o rotulo do campo (com variacao de caixa/acento/pontuacao) e sugerido corretamente", () => {
    expect(suggestMapping("razao social", SYSTEM_FIELDS_FREQUENCIA)).toBe(
      "razaoSocial"
    )
    expect(
      suggestMapping("FREQUÊNCIA DE VISITA", SYSTEM_FIELDS_FREQUENCIA)
    ).toBe("frequenciaVisita")
    expect(suggestMapping("frequencia-de-visita", SYSTEM_FIELDS_FREQUENCIA)).toBe(
      "frequenciaVisita"
    )
  })

  it("apelidoforadalista: um cabecalho conhecido pela tabela de apelidos mas fora da segunda lista sugere nao importar", () => {
    expect(suggestMapping("CEP", SYSTEM_FIELDS_FREQUENCIA)).toBe(NAO_IMPORTAR)
    expect(suggestMapping("vendedor", SYSTEM_FIELDS_FREQUENCIA)).toBe(
      NAO_IMPORTAR
    )
  })

  it("apelidopreservado: o mesmo cabecalho avaliado contra a lista de 14 continua sendo sugerido para a chave de sempre", () => {
    expect(suggestMapping("CEP")).toBe("cep")
    expect(suggestMapping("vendedor")).toBe("responsavel")
  })
})

describe("requiredFieldsFaltando contra a segunda lista", () => {
  it("obrigatorios: sem nenhuma coluna mapeada devolve as duas definicoes; com as duas mapeadas devolve lista vazia", () => {
    const semNada = requiredFieldsFaltando<SystemFieldFrequencia>(
      {},
      SYSTEM_FIELDS_FREQUENCIA
    )
    expect(semNada.map((field) => field.key)).toEqual([
      "razaoSocial",
      "frequenciaVisita",
    ])

    const mapping: ColumnMappingOf<SystemFieldFrequencia> = {
      0: "razaoSocial",
      1: "frequenciaVisita",
    }
    expect(requiredFieldsFaltando(mapping, SYSTEM_FIELDS_FREQUENCIA)).toEqual(
      []
    )
  })
})

describe("applyMapping contra a segunda lista", () => {
  it("aplicar: a aplicacao do mapeamento sobre linhas cruas produz objetos so com as duas chaves, descartando nao importar", () => {
    const headers = ["Empresa", "Coluna Ignorada", "Frequência"]
    const rows = [["Distribuidora ABC", "lixo", "Mensal"]]
    const mapping: ColumnMappingOf<SystemFieldFrequencia> = {
      0: "razaoSocial",
      1: NAO_IMPORTAR,
      2: "frequenciaVisita",
    }

    const result = applyMapping<SystemFieldFrequencia>(headers, rows, mapping)

    expect(result).toEqual([
      { razaoSocial: "Distribuidora ABC", frequenciaVisita: "Mensal" },
    ])
  })
})

describe("buildModeloFrequencia", () => {
  it("modelo: o modelo gerado tem exatamente duas colunas com os rotulos do contrato, uma linha de exemplo, e o exemplo de frequencia e um rotulo valido", () => {
    const rows = readRows(buildModeloFrequencia())

    expect(rows[0]).toEqual(["Razão social", "Frequência de visita"])
    expect(rows).toHaveLength(2)

    const exampleRow = rows[1] as string[]
    expect(exampleRow).toHaveLength(2)
    expect(Object.values(FREQUENCIA_VISITA_LABELS)).toContain(exampleRow[1])
  })
})
