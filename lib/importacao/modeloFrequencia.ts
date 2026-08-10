import * as XLSX from "@e965/xlsx"

import { FREQUENCIA_VISITA_LABELS } from "@/lib/funil/frequencia"
import { SYSTEM_FIELDS_FREQUENCIA } from "@/lib/importacao/typesFrequencia"

/**
 * Gerador do modelo de planilha de frequências de visita para download
 * (IMP-01). Espelho literal de lib/importacao/modelo.ts: mesma escrita em
 * modo browser-safe `XLSX.write(wb, { type: "array" })` -> Uint8Array (o
 * botão "Baixar modelo de planilha" embrulha isso num Blob no cliente, nada
 * de Route Handler nem Buffer Node).
 *
 * Não sanitiza aqui (mesmo Pitfall A4 do irmão) — o modelo é gerado pelo
 * próprio sistema, nunca é input do usuário; a sanitização de
 * formula-injection é do lado de quem lê valores do usuário
 * (lib/importacao/annotarLinhaFrequencia.ts).
 *
 * O rótulo de exemplo de frequência vem do módulo único
 * (lib/funil/frequencia.ts) — nunca digitado à mão aqui, porque o Supervisor
 * vai preencher a planilha lendo o RÓTULO exibido, não o valor interno.
 */

const EXAMPLE_RAZAO_SOCIAL = "Distribuidora Exemplo Ltda"

export function buildModeloFrequencia(): Uint8Array {
  const headers = SYSTEM_FIELDS_FREQUENCIA.map((field) => field.label)
  const exampleRow = [EXAMPLE_RAZAO_SOCIAL, FREQUENCIA_VISITA_LABELS.mensal]

  const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo")

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array
}
