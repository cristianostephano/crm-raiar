import * as XLSX from "@e965/xlsx"

import { ETAPAS } from "@/lib/funil/etapas"
import type { ClienteExportRow } from "@/lib/supabase/queries/clientes"

/**
 * Dependency-free .xlsx export transform (05-01 Task 3, D-01/D-02) — a pure
 * function taking already-fetched export rows (getClientesParaExportacao,
 * lib/supabase/queries/clientes.ts) and returning a workbook Buffer. No
 * Supabase import, no "use server"/"use client" directive, so it stays
 * unit-testable in isolation and safe to import from either a Route
 * Handler or a future Client Component (mirrors lib/clientes/completude.ts's
 * shape).
 */

const ETAPA_LABELS: Record<string, string> = Object.fromEntries(
  ETAPAS.map((etapa) => [etapa.key, etapa.label])
)

const STATUS_LABELS: Record<ClienteExportRow["statusAcompanhamento"], string> = {
  em_andamento: "Em andamento",
  ganho: "Ganho",
  perdido: "Perdido",
}

/**
 * Formula-injection guard (Pitfall A4 / T-05-01): a string whose first
 * character is =, +, -, @, tab, or carriage return is prefixed with a
 * leading single quote so it opens as text rather than a formula. A normal
 * value is returned unchanged. This is the ONE shared path every string
 * cell buildClientesWorkbook writes goes through — never re-implemented
 * per column.
 */
export function sanitizeCell(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`
  }
  return value
}

/** Coerces a nullable cadastro field to its exported cell text, sanitized. */
function cell(value: string | number | null): string {
  if (value === null) return ""
  return sanitizeCell(String(value))
}

/**
 * Builds the "Clientes" .xlsx workbook (D-01/D-02) from export-shaped
 * cliente rows. Column order is fixed by the key order of the row objects
 * below (json_to_sheet preserves first-row key order): cadastro fields
 * first, then the funil fields (Etapa/Status/Observação). Every string
 * cell is routed through `cell()` -> `sanitizeCell()`, so a future new
 * column can never silently reopen the formula-injection hole (T-05-01).
 */
export function buildClientesWorkbook(rows: ClienteExportRow[]): Buffer {
  const sheetRows = rows.map((row) => ({
    "Razão Social": cell(row.razaoSocial),
    CEP: cell(row.cep),
    Rua: cell(row.rua),
    Número: cell(row.numero),
    Complemento: cell(row.complemento),
    Cidade: cell(row.cidade),
    Estado: cell(row.estado),
    Categoria: cell(row.categoriaNome),
    Contato: cell(row.contato),
    Telefone: cell(row.telefone),
    Email: cell(row.email),
    "Produtos Consumidos": cell(row.produtos.join(", ")),
    "Número de Lojas": cell(row.numeroDeLojas),
    Responsável: cell(row.responsavelNome),
    Etapa: cell(ETAPA_LABELS[row.etapa] ?? row.etapa),
    Status: cell(STATUS_LABELS[row.statusAcompanhamento]),
    Observação: cell(row.observacao),
  }))

  const worksheet = XLSX.utils.json_to_sheet(sheetRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes")

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}
