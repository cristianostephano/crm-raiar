import { describe, expect, it } from "vitest"
import * as XLSX from "@e965/xlsx"

import {
  parseArquivo,
  validateUploadFile,
} from "../../lib/importacao/parseArquivo"

/**
 * Unit tests for the client-side upload guard + parser (06-01 Task 2).
 * Pure-function style, following tests/clientes/exportacao.test.ts — no
 * Supabase, no server context needed.
 */

function xlsxFile(rows: string[][], name = "planilha.xlsx"): File {
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes")
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array
  return new File([new Uint8Array(buffer)], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

function csvFile(text: string, name = "planilha.csv"): File {
  return new File([text], name, { type: "text/csv" })
}

describe("validateUploadFile", () => {
  it("accepts a .xlsx file within the size limit", () => {
    const file = xlsxFile([["Razão social"], ["Cliente A"]])
    expect(validateUploadFile(file)).toEqual({ ok: true })
  })

  it("accepts a .csv file within the size limit", () => {
    const file = csvFile("Razão social\nCliente A")
    expect(validateUploadFile(file)).toEqual({ ok: true })
  })

  it("rejects a file with an extension outside the allowlist", () => {
    const file = new File(["conteudo"], "planilha.txt", { type: "text/plain" })
    expect(validateUploadFile(file)).toEqual({ ok: false, motivo: "tipo" })
  })

  it("rejects a file larger than 10 MB", () => {
    const bigContent = new Uint8Array(10 * 1024 * 1024 + 1)
    const file = new File([bigContent], "planilha.csv", { type: "text/csv" })
    expect(validateUploadFile(file)).toEqual({ ok: false, motivo: "tamanho" })
  })
})

describe("parseArquivo", () => {
  it("reads a .xlsx file into { headers, rows }", async () => {
    const file = xlsxFile([
      ["Razão social", "CEP", "Cidade"],
      ["Distribuidora ABC", "01310-100", "São Paulo"],
      ["Comércio XYZ", "20040-020", "Rio de Janeiro"],
    ])
    const result = await parseArquivo(file)
    expect(result.headers).toEqual(["Razão social", "CEP", "Cidade"])
    expect(result.rows).toEqual([
      ["Distribuidora ABC", "01310-100", "São Paulo"],
      ["Comércio XYZ", "20040-020", "Rio de Janeiro"],
    ])
  })

  it("reads a comma-delimited US-locale .csv file into { headers, rows }", async () => {
    const file = csvFile(
      "Razao social,CEP,Cidade\nDistribuidora ABC,01310-100,Sao Paulo"
    )
    const result = await parseArquivo(file)
    expect(result.headers).toEqual(["Razao social", "CEP", "Cidade"])
    expect(result.rows).toEqual([["Distribuidora ABC", "01310-100", "Sao Paulo"]])
  })

  it("reads a semicolon-delimited pt-BR .csv file with a UTF-8 BOM (Pitfall A2/A3)", async () => {
    const bom = "﻿"
    const file = csvFile(
      `${bom}razao_social;cep;cidade\nDistribuidora ABC;01310-100;São Paulo`
    )
    const result = await parseArquivo(file)
    expect(result.headers[0]).toBe("razao_social")
    expect(result.headers).toEqual(["razao_social", "cep", "cidade"])
    expect(result.rows).toEqual([["Distribuidora ABC", "01310-100", "São Paulo"]])
  })

  it("returns headers with an empty rows array for a header-only file (empty state)", async () => {
    const file = xlsxFile([["Razão social", "CEP", "Cidade"]])
    const result = await parseArquivo(file)
    expect(result.headers).toEqual(["Razão social", "CEP", "Cidade"])
    expect(result.rows).toEqual([])
  })
})
