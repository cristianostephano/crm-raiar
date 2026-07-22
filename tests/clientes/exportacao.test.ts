import { describe, expect, it } from "vitest"
import * as XLSX from "@e965/xlsx"

import { buildClientesWorkbook, sanitizeCell } from "../../lib/clientes/exportacao"
import type { ClienteExportRow } from "../../lib/supabase/queries/clientes"

/**
 * Unit tests for the D-01/D-02 export helper (05-01 Task 3). Pure-function
 * style, following tests/clientes/incompleto.test.ts — no Supabase, no
 * server context needed since buildClientesWorkbook/sanitizeCell take
 * already-fetched rows.
 */

const D02_HEADERS = [
  "Razão Social",
  "CEP",
  "Rua",
  "Número",
  "Complemento",
  "Cidade",
  "Estado",
  "Categoria",
  "Contato",
  "Telefone",
  "Email",
  "Produtos Consumidos",
  "Número de Lojas",
  "Responsável",
  "Etapa",
  "Status",
  "Observação",
]

function baseRow(overrides: Partial<ClienteExportRow> = {}): ClienteExportRow {
  return {
    razaoSocial: "Distribuidora ABC",
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    complemento: null,
    cidade: "São Paulo",
    estado: "SP",
    categoriaNome: "Food Service",
    contato: "Fulano de Tal",
    telefone: "11999999999",
    email: "fulano@example.com",
    produtos: ["Casca", "Óleo"],
    numeroDeLojas: 3,
    responsavelNome: "Ana Souza",
    etapa: "aguardando_contato",
    statusAcompanhamento: "em_andamento",
    observacao: "Cliente promissor",
    ...overrides,
  }
}

/** Reads a buildClientesWorkbook() buffer back into an array of row objects. */
function readBack(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets["Clientes"]
  return XLSX.utils.sheet_to_json(sheet, { defval: "" })
}

function headerRow(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets["Clientes"]
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
  return rows[0] as string[]
}

describe("sanitizeCell", () => {
  it("neutralizes a value starting with =", () => {
    expect(sanitizeCell("=SUM(A1)")).toBe("'=SUM(A1)")
  })

  it("neutralizes a value starting with +", () => {
    expect(sanitizeCell("+5511999999999")).toBe("'+5511999999999")
  })

  it("neutralizes a value starting with -", () => {
    expect(sanitizeCell("-1")).toBe("'-1")
  })

  it("neutralizes a value starting with @", () => {
    expect(sanitizeCell("@mention")).toBe("'@mention")
  })

  it("neutralizes a value starting with a tab", () => {
    expect(sanitizeCell("\tsneaky")).toBe("'\tsneaky")
  })

  it("neutralizes a value starting with a carriage return", () => {
    expect(sanitizeCell("\rsneaky")).toBe("'\rsneaky")
  })

  it("leaves a normal string untouched", () => {
    expect(sanitizeCell("Distribuidora ABC")).toBe("Distribuidora ABC")
  })
})

describe("buildClientesWorkbook", () => {
  it("produces a 'Clientes' sheet whose header row matches D-02 column order", () => {
    const buffer = buildClientesWorkbook([baseRow()])
    expect(headerRow(buffer)).toEqual(D02_HEADERS)
  })

  it("resolves etapa to its ETAPAS pt-BR label and status to its pt-BR label", () => {
    const buffer = buildClientesWorkbook([
      baseRow({ etapa: "primeira_venda", statusAcompanhamento: "ganho" }),
    ])
    const [row] = readBack(buffer)
    expect(row["Etapa"]).toBe("1ª venda concluída")
    expect(row["Status"]).toBe("Ganho")
  })

  it("joins produtos consumidos with ', ' and leaves an empty list blank", () => {
    const withProdutos = readBack(
      buildClientesWorkbook([baseRow({ produtos: ["Casca", "Óleo"] })])
    )[0]
    expect(withProdutos["Produtos Consumidos"]).toBe("Casca, Óleo")

    const withoutProdutos = readBack(
      buildClientesWorkbook([baseRow({ produtos: [] })])
    )[0]
    expect(withoutProdutos["Produtos Consumidos"]).toBe("")
  })

  it("coalesces null optional fields to an empty cell, never the string 'null'", () => {
    const row = readBack(
      buildClientesWorkbook([
        baseRow({
          complemento: null,
          categoriaNome: null,
          contato: null,
          telefone: null,
          email: null,
          numeroDeLojas: null,
          responsavelNome: null,
          observacao: null,
        }),
      ])
    )[0]

    expect(row["Complemento"]).toBe("")
    expect(row["Categoria"]).toBe("")
    expect(row["Contato"]).toBe("")
    expect(row["Telefone"]).toBe("")
    expect(row["Email"]).toBe("")
    expect(row["Número de Lojas"]).toBe("")
    expect(row["Responsável"]).toBe("")
    expect(row["Observação"]).toBe("")
  })

  it("neutralizes an observacao starting with '=' in the round-tripped cell (Pitfall A4)", () => {
    const row = readBack(
      buildClientesWorkbook([baseRow({ observacao: "=SUM(A1)" })])
    )[0]
    expect(row["Observação"]).toBe("'=SUM(A1)")
  })

  it("neutralizes a telefone starting with '+' in the round-tripped cell", () => {
    const row = readBack(
      buildClientesWorkbook([baseRow({ telefone: "+5511999999999" })])
    )[0]
    expect(row["Telefone"]).toBe("'+5511999999999")
  })

  it("leaves a normal razão social untouched end to end", () => {
    const row = readBack(buildClientesWorkbook([baseRow()]))[0]
    expect(row["Razão Social"]).toBe("Distribuidora ABC")
  })

  it("produces one data row per input cliente", () => {
    const rows = readBack(
      buildClientesWorkbook([
        baseRow({ razaoSocial: "Cliente 1" }),
        baseRow({ razaoSocial: "Cliente 2" }),
      ])
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]["Razão Social"]).toBe("Cliente 1")
    expect(rows[1]["Razão Social"]).toBe("Cliente 2")
  })
})
