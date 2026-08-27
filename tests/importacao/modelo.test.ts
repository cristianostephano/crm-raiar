import { describe, expect, it } from "vitest"
import * as XLSX from "@e965/xlsx"

import { buildModeloImportacao } from "../../lib/importacao/modelo"
import { suggestMapping } from "../../lib/importacao/mapping"
import { SYSTEM_FIELDS } from "../../lib/importacao/types"

/**
 * Unit tests for the IMP-02 model-spreadsheet generator (06-01 Task 3).
 * Pure-function style, following tests/clientes/exportacao.test.ts —
 * reconstitutes the workbook with XLSX.read({ type: "array" }) and asserts
 * against SYSTEM_FIELDS as ground truth so the model can never silently
 * diverge from the mapping vocabulary.
 *
 * Fase 26 Plano 2 (PROSP-02): cabeçalhos obrigatórios ganham um sufixo
 * visível (" *") — as asserções abaixo derivam a expectativa de
 * SYSTEM_FIELDS.required, nunca listando os 16 textos à mão.
 */

function readRows(buffer: Uint8Array): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "array" })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
}

describe("buildModeloImportacao", () => {
  it("produces a header row matching SYSTEM_FIELDS labels, marked with ' *' for required fields", () => {
    const rows = readRows(buildModeloImportacao())
    expect(rows[0]).toEqual(
      SYSTEM_FIELDS.map((field) =>
        field.required ? `${field.label} *` : field.label
      )
    )
  })

  it("round-trips every generated header back to its SYSTEM_FIELDS key via suggestMapping", () => {
    const headerRow = readRows(buildModeloImportacao())[0] as string[]
    headerRow.forEach((header, index) => {
      expect(suggestMapping(header)).toBe(SYSTEM_FIELDS[index].key)
    })
  })

  it("produces exactly one example row", () => {
    const rows = readRows(buildModeloImportacao())
    expect(rows).toHaveLength(2)
  })

  it("never includes a funnel-stage column", () => {
    const rows = readRows(buildModeloImportacao())
    const headerRow = rows[0] as string[]
    expect(headerRow).not.toContain("Etapa")
    expect(headerRow.some((label) => /etapa|estágio|funil/i.test(label))).toBe(false)
  })

  it("round-trips the example row with plausible non-empty values for every column", () => {
    const rows = readRows(buildModeloImportacao())
    const exampleRow = rows[1] as string[]
    expect(exampleRow).toHaveLength(SYSTEM_FIELDS.length)
    exampleRow.forEach((value) => {
      expect(String(value ?? "").length).toBeGreaterThan(0)
    })
  })
})
