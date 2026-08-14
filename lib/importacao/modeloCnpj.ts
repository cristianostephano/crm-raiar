import * as XLSX from "@e965/xlsx"

import { SYSTEM_FIELDS_CNPJ } from "@/lib/importacao/typesCnpj"

/**
 * Gerador do modelo de planilha "CNPJ em massa" para download (IMP-03).
 * Espelho literal de lib/importacao/modeloFrequencia.ts: mesma escrita em
 * modo browser-safe `XLSX.write(wb, { type: "array" })` -> Uint8Array (o
 * botão "Baixar modelo de planilha" embrulha isso num Blob no cliente, nada
 * de Route Handler nem Buffer Node).
 *
 * Não sanitiza aqui (mesmo Pitfall A4 dos dois irmãos) — o modelo é gerado
 * pelo próprio sistema, nunca é input do usuário; a sanitização de
 * formula-injection é do lado de quem lê célula do usuário
 * (lib/importacao/annotarLinhaCnpj.ts).
 *
 * Cabeçalhos derivados dos rótulos do vocabulário (nunca digitados à mão) —
 * se `typesCnpj.ts` mudar um rótulo, o modelo acompanha automaticamente.
 */

const EXAMPLE_RAZAO_SOCIAL = "Distribuidora Exemplo Ltda"
const EXAMPLE_CNPJ = "12.345.678/0001-90"

export function buildModeloCnpj(): Uint8Array {
  const headers = SYSTEM_FIELDS_CNPJ.map((field) => field.label)
  const exampleRow = [EXAMPLE_RAZAO_SOCIAL, EXAMPLE_CNPJ]

  const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo")

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array
}
