import { SYSTEM_FIELDS, type SystemField, type SystemFieldDefinition } from "@/lib/importacao/types"
import type { MappedRow } from "@/lib/importacao/annotarLinha"

/**
 * Pure column-mapping logic for the import wizard's Step 2 (IMP-03/IMP-04).
 * No "use client"/"use server" directive, no Supabase import — unit-testable
 * in isolation, mirroring lib/importacao/dedupe.ts's shape (06-PATTERNS.md).
 */

/** Sentinel mapping target meaning "this column should not be imported" —
 * always the last option in ColumnMappingTable's per-column Select. */
export const NAO_IMPORTAR = "nao_importar" as const

export type MappingTarget = SystemField | typeof NAO_IMPORTAR

/** Keyed by column INDEX (not header text) — spreadsheet headers can repeat
 * or be blank, so the index is the only unambiguous column identity. */
export type ColumnMapping = Record<number, MappingTarget>

/** Strips diacritics (NFD + explicit combining-mark code-point filter, same
 * approach as dedupe.ts's normalizeRazaoSocial — avoids embedding a literal
 * combining character in a regex literal), lowercases, and drops every
 * non-alphanumeric character so "Razão Social", "razao_social" and
 * "RAZAO-SOCIAL" all normalize identically. */
function normalizeHeader(value: string): string {
  const stripped = Array.from(value.normalize("NFD"))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return !(code >= 0x0300 && code <= 0x036f)
    })
    .join("")

  return stripped.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** Extra normalized aliases beyond each SYSTEM_FIELDS label itself — covers
 * the common spreadsheet header variations this phase must recognize,
 * notably "vendedor" for responsavel (IMP-04). */
const ALIASES: Record<string, SystemField> = {
  razaosocial: "razaoSocial",
  empresa: "razaoSocial",
  nomeempresa: "razaoSocial",
  cep: "cep",
  rua: "rua",
  logradouro: "rua",
  endereco: "rua",
  numero: "numero",
  nro: "numero",
  complemento: "complemento",
  cidade: "cidade",
  municipio: "cidade",
  estado: "estado",
  uf: "estado",
  categoria: "categoria",
  contato: "contato",
  nomecontato: "contato",
  telefone: "telefone",
  celular: "telefone",
  fone: "telefone",
  email: "email",
  produtos: "produtos",
  produtosconsumidos: "produtos",
  produto: "produtos",
  responsavel: "responsavel",
  vendedor: "responsavel",
  responsavelvendedor: "responsavel",
  numerodelojas: "numeroDeLojas",
  lojas: "numeroDeLojas",
  qtddelojas: "numeroDeLojas",
}

/**
 * Best-guess mapping target for one raw spreadsheet header. Matches first
 * against each SYSTEM_FIELDS label (normalized), then against the ALIASES
 * table; a header with no good match suggests NAO_IMPORTAR rather than
 * guessing wrong.
 */
export function suggestMapping(
  header: string,
  fields: SystemFieldDefinition[] = SYSTEM_FIELDS
): MappingTarget {
  const normalized = normalizeHeader(header)

  const byLabel = fields.find(
    (field) => normalizeHeader(field.label) === normalized
  )
  if (byLabel) return byLabel.key

  const alias = ALIASES[normalized]
  if (alias) return alias

  return NAO_IMPORTAR
}

/**
 * Transforms parsed spreadsheet rows (string[][]) into MappedRow[] using the
 * Supervisor's column mapping — columns marked NAO_IMPORTAR are dropped.
 * `produtos` (multi-value) is preserved as a single raw string per cell;
 * splitting into individual product tokens happens later in annotarLinha
 * (06-02), not here.
 */
export function applyMapping(
  headers: string[],
  rows: string[][],
  mapping: ColumnMapping
): MappedRow[] {
  return rows.map((row) => {
    const mappedRow: MappedRow = {}

    headers.forEach((_header, columnIndex) => {
      const target = mapping[columnIndex]
      if (!target || target === NAO_IMPORTAR) return

      const value = row[columnIndex]
      if (value === undefined) return

      mappedRow[target] = value
    })

    return mappedRow
  })
}

/**
 * Required SYSTEM_FIELDS (e.g. Responsável) not yet associated with any
 * column in the current mapping — drives Step 2's inline warning and the
 * "Continuar" disabled state.
 */
export function requiredFieldsFaltando(
  mapping: ColumnMapping,
  fields: SystemFieldDefinition[] = SYSTEM_FIELDS
): SystemFieldDefinition[] {
  const mappedFields = new Set(
    Object.values(mapping).filter(
      (target): target is SystemField => target !== NAO_IMPORTAR
    )
  )

  return fields.filter(
    (field) => field.required && !mappedFields.has(field.key)
  )
}
