import { describe, expect, it } from "vitest"
import * as XLSX from "@e965/xlsx"

import { buildModeloAtivos } from "../../lib/importacao/modeloAtivo"
import {
  requiredFieldsFaltando,
  suggestMapping,
  type ColumnMapping,
} from "../../lib/importacao/mapping"
import { SYSTEM_FIELDS } from "../../lib/importacao/types"
import { SYSTEM_FIELDS_ATIVO } from "../../lib/importacao/typesAtivo"

/**
 * Unit tests for the quarto vocabulário de campos (planilha "Importar
 * clientes ativos") + o gerador do modelo de planilha (25-02 Task 1).
 * Pure-function style, no Supabase — espelha tests/importacao/
 * cnpj-vocabulario.test.ts's shape.
 */

const REQUIRED_KEYS = [
  "razaoSocial",
  "cnpj",
  "cep",
  "rua",
  "numero",
  "cidade",
  "estado",
  "responsavel",
  "contato",
]

function readRows(buffer: Uint8Array): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
}

describe("SYSTEM_FIELDS_ATIVO", () => {
  it("campos: mesmas 16 chaves/rotulos de SYSTEM_FIELDS, na mesma ordem, sem frequencia de visita nem dia fixo", () => {
    expect(SYSTEM_FIELDS_ATIVO).toHaveLength(16)
    expect(SYSTEM_FIELDS_ATIVO.map((f) => f.key)).toEqual(
      SYSTEM_FIELDS.map((f) => f.key)
    )
    expect(SYSTEM_FIELDS_ATIVO.map((f) => f.label)).toEqual(
      SYSTEM_FIELDS.map((f) => f.label)
    )
    expect(
      SYSTEM_FIELDS_ATIVO.some((f) =>
        /frequencia|frequência|dia ?fixo/i.test(`${f.key} ${f.label}`)
      )
    ).toBe(false)
  })

  it("obrigatorios: exatamente 9 definicoes sao required, as 9 do contrato ATIVO-01", () => {
    const required = SYSTEM_FIELDS_ATIVO.filter((f) => f.required)
    expect(required).toHaveLength(9)
    expect(required.map((f) => f.key).sort()).toEqual([...REQUIRED_KEYS].sort())
  })

  it("invariante: toda definicao obrigatoria tem frase de campo faltando nao vazia, nenhuma opcional tem", () => {
    for (const field of SYSTEM_FIELDS_ATIVO) {
      if (field.required) {
        expect(field.campoFaltandoReason).toBeTruthy()
      } else {
        expect(field.campoFaltandoReason).toBeUndefined()
      }
    }
  })

  it("naoregride: SYSTEM_FIELDS (lista antiga) continua com apenas 2 obrigatorias, intocada por este plano", () => {
    // Fase 26 Plano 2 (PROSP-02) trocou QUAIS 2 campos de SYSTEM_FIELDS são
    // obrigatórios (nomeFantasia + responsavel, no lugar de razaoSocial +
    // responsavel) — a invariante que este teste protege (SYSTEM_FIELDS_ATIVO
    // não regride a cardinalidade de obrigatórios de SYSTEM_FIELDS) continua
    // válida; só a lista esperada muda para acompanhar a mudança intencional.
    const required = SYSTEM_FIELDS.filter((f) => f.required)
    expect(required.map((f) => f.key).sort()).toEqual(
      ["nomeFantasia", "responsavel"].sort()
    )
  })

  it("sugestao: suggestMapping contra o vocabulario novo reconhece os mesmos apelidos de cabecalho de sempre", () => {
    expect(suggestMapping("vendedor", SYSTEM_FIELDS_ATIVO)).toBe("responsavel")
    expect(suggestMapping("municipio", SYSTEM_FIELDS_ATIVO)).toBe("cidade")
  })

  it("obrigatoriosfaltando: requiredFieldsFaltando com mapeamento vazio devolve as 9; com as 9 mapeadas devolve vazio", () => {
    const semNada = requiredFieldsFaltando(
      {} as ColumnMapping,
      SYSTEM_FIELDS_ATIVO
    )
    expect(semNada.map((f) => f.key).sort()).toEqual([...REQUIRED_KEYS].sort())

    const mapping: ColumnMapping = {}
    REQUIRED_KEYS.forEach((key, index) => {
      mapping[index] = key as ColumnMapping[number]
    })
    expect(requiredFieldsFaltando(mapping, SYSTEM_FIELDS_ATIVO)).toEqual([])
  })

  it("modelo: buildModeloAtivos gera 16 colunas com os rotulos do vocabulario (sufixados ' *' quando required), na ordem, mais uma linha de exemplo com 16 celulas", () => {
    const rows = readRows(buildModeloAtivos())

    expect(rows[0]).toEqual(
      SYSTEM_FIELDS_ATIVO.map((f) => (f.required ? `${f.label} *` : f.label))
    )
    expect(rows).toHaveLength(2)

    const exampleRow = rows[1] as string[]
    expect(exampleRow).toHaveLength(16)
    for (const cell of exampleRow) {
      expect(cell.length).toBeGreaterThan(0)
    }
  })

  it("modelo: cabecalho de CNPJ (campo required) sai sufixado como 'CNPJ *'", () => {
    const rows = readRows(buildModeloAtivos())
    const headerRow = rows[0] as string[]
    const cnpjIndex = SYSTEM_FIELDS_ATIVO.findIndex((f) => f.key === "cnpj")

    expect(cnpjIndex).toBeGreaterThanOrEqual(0)
    expect(headerRow[cnpjIndex]).toBe("CNPJ *")
  })

  it("modelo: round-trips every generated header back to its SYSTEM_FIELDS_ATIVO key via suggestMapping", () => {
    const headerRow = readRows(buildModeloAtivos())[0] as string[]
    headerRow.forEach((header, index) => {
      expect(suggestMapping(header, SYSTEM_FIELDS_ATIVO)).toBe(
        SYSTEM_FIELDS_ATIVO[index].key
      )
    })
  })
})
