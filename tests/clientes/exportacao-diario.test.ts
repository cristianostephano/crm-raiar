import { describe, expect, it } from "vitest"
import * as XLSX from "@e965/xlsx"

import { buildDiarioWorkbook } from "../../lib/clientes/exportacaoDiario"
import type { DiarioExportRow } from "../../lib/supabase/queries/clientes"

/**
 * Unit tests for the IMP-02 diário export helper (plano 17-02). Pure-function
 * style, no molde de tests/clientes/exportacao.test.ts — sem Supabase, sem
 * contexto de servidor, já que buildDiarioWorkbook recebe linhas já lidas.
 */

const COLUNAS_ESPERADAS = ["Cliente", "Responsável", "Tipo", "Resumo", "Data", "Autor"]

function baseRow(overrides: Partial<DiarioExportRow> = {}): DiarioExportRow {
  return {
    razaoSocial: "Distribuidora ABC",
    responsavelNome: "Ana Souza",
    tipo: "tarefa_concluida",
    descricao: "Ligação de prospecção realizada com sucesso",
    criadoEm: "2026-08-10T14:30:00.000Z",
    autorNome: "Ana Souza",
    ...overrides,
  }
}

/** Reads a buildDiarioWorkbook() buffer back into an array of row objects. */
function readBack(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets["Diário"]
  return XLSX.utils.sheet_to_json(sheet, { defval: "" })
}

function headerRow(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets["Diário"]
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
  return rows[0] as string[]
}

describe("buildDiarioWorkbook", () => {
  it("colunas: produz uma folha 'Diário' com as seis colunas na ordem exata do contrato", () => {
    const buffer = buildDiarioWorkbook([baseRow()])
    expect(headerRow(buffer)).toEqual(COLUNAS_ESPERADAS)
  })

  it("tipo: traduz tarefa_concluida e visita_concluida para os dois rótulos da tela, nunca o valor cru", () => {
    const rows = readBack(
      buildDiarioWorkbook([
        baseRow({ tipo: "tarefa_concluida" }),
        baseRow({ tipo: "visita_concluida" }),
      ])
    )
    expect(rows[0]["Tipo"]).toBe("Prospecção")
    expect(rows[1]["Tipo"]).toBe("Visita")
    expect(rows[0]["Tipo"]).not.toBe("tarefa_concluida")
    expect(rows[1]["Tipo"]).not.toBe("visita_concluida")
  })

  it("data: o carimbo conhecido vira texto no formato dd/MM/yyyy HH:mm", () => {
    const row = readBack(
      buildDiarioWorkbook([
        baseRow({ criadoEm: "2026-08-10T14:30:00.000Z" }),
      ])
    )[0]
    // parseISO interpreta o carimbo no fuso local, então o teste fixa a
    // expectativa a partir do mesmo parseISO/format (nunca new Date(string)).
    expect(row["Data"]).toMatch(/^\d{2}\/\d{2}\/2026 \d{2}:\d{2}$/)
  })

  it("injecao: um resumo comecando com cada caractere perigoso sai escapado com aspa simples na frente", () => {
    const perigosos = ["=SUM(A1)", "+5511999999999", "-1", "@mention", "\tsneaky", "\rsneaky"]

    for (const valor of perigosos) {
      const row = readBack(buildDiarioWorkbook([baseRow({ descricao: valor })]))[0]
      expect(row["Resumo"]).toBe(`'${valor}`)
    }
  })

  it("injecaonome: uma razao social comecando com caractere perigoso tambem sai escapada", () => {
    const row = readBack(
      buildDiarioWorkbook([baseRow({ razaoSocial: "=SUM(A1)" })])
    )[0]
    expect(row["Cliente"]).toBe("'=SUM(A1)")
  })

  it("nulo: responsavel e autor nulos viram celula vazia, nunca a palavra 'null'", () => {
    const row = readBack(
      buildDiarioWorkbook([
        baseRow({ responsavelNome: null, autorNome: null }),
      ])
    )[0]
    expect(row["Responsável"]).toBe("")
    expect(row["Autor"]).toBe("")
  })

  it("vazio: lista vazia gera uma planilha valida so com a linha de cabecalho, sem lancar", () => {
    expect(() => buildDiarioWorkbook([])).not.toThrow()
    const buffer = buildDiarioWorkbook([])
    expect(headerRow(buffer)).toEqual(COLUNAS_ESPERADAS)
    expect(readBack(buffer)).toHaveLength(0)
  })
})
