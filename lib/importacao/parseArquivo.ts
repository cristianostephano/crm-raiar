import * as XLSX from "@e965/xlsx"
import Papa from "papaparse"

import type { ParsedFile, UploadValidation } from "@/lib/importacao/types"

/**
 * Client-side parser for the import wizard's upload step (Fase 6, D-01: a
 * importação aceita .xlsx OU .csv). Módulo PURO — sem "use client"/"use
 * server", sem import de Supabase — mesma forma dependency-isolated de
 * lib/clientes/exportacao.ts, mas rodando no NAVEGADOR (ARCHITECTURE.md
 * Pattern 5 passo 1: o arquivo nunca sobe ao servidor nesta fase).
 *
 * Sempre usa `type: "array"` do @e965/xlsx (Uint8Array, browser-safe) —
 * NUNCA `type: "buffer"` (Node-only, usado apenas no export server-side de
 * lib/clientes/exportacao.ts).
 */

const ALLOWED_EXTENSIONS = [".xlsx", ".csv"] as const
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".")
  if (dotIndex === -1) return ""
  return fileName.slice(dotIndex).toLowerCase()
}

/**
 * Guarda de upload (Pitfall A7, mitigado no cliente): checa extensão
 * (allowlist .xlsx/.csv) e tamanho (10 MB) ANTES de qualquer parsing. Como o
 * arquivo nunca chega ao servidor nesta fase, checar no cliente é suficiente
 * — não há parsing server-side de bytes não confiáveis.
 */
export function validateUploadFile(file: File): UploadValidation {
  const extension = getExtension(file.name)
  if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    return { ok: false, motivo: "tipo" }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, motivo: "tamanho" }
  }
  return { ok: true }
}

/** Remove um BOM UTF-8 inicial (U+FEFF), se presente (Pitfall A3). */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function normalizeRows(rawRows: unknown[][]): ParsedFile {
  const [headerRow, ...dataRows] = rawRows
  const headers = (headerRow ?? []).map((cell) => String(cell ?? "").trim())
  const rows = dataRows
    .filter((row) => row.length > 0)
    .map((row) => row.map((cell) => String(cell ?? "")))
  return { headers, rows }
}

async function parseXlsx(file: File): Promise<ParsedFile> {
  const data = new Uint8Array(await file.arrayBuffer())
  const workbook = XLSX.read(data, { type: "array" })
  const firstSheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[firstSheetName]
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  })
  return normalizeRows(rawRows)
}

async function parseCsv(file: File): Promise<ParsedFile> {
  const rawText = await file.text()
  const text = stripBom(rawText)
  // Delimitador em auto-detecção (Pitfall A2 — Excel pt-BR exporta com ";").
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true })
  return normalizeRows(result.data)
}

/**
 * Lê um arquivo .xlsx ou .csv (incl. CSV pt-BR delimitado por ";" e
 * prefixado com BOM UTF-8) e devolve { headers, rows } normalizados: todo
 * cabeçalho trimado, toda célula de dado coagida a string.
 */
export async function parseArquivo(file: File): Promise<ParsedFile> {
  const extension = getExtension(file.name)
  if (extension === ".xlsx") {
    return parseXlsx(file)
  }
  return parseCsv(file)
}
