import * as XLSX from "@e965/xlsx"

import { SYSTEM_FIELDS } from "@/lib/importacao/types"

/**
 * Gerador do modelo de planilha para download (IMP-02). Módulo puro (sem
 * Supabase/diretivas), espelhando a forma de buildClientesWorkbook em
 * lib/clientes/exportacao.ts, mas: (1) derivando os cabeçalhos de
 * SYSTEM_FIELDS (labels, na ordem), para o modelo nunca divergir do
 * vocabulário de mapeamento (06-04); (2) escrevendo no modo browser-safe
 * `XLSX.write(wb, { type: "array" })` -> Uint8Array — o botão "Baixar
 * modelo de planilha" do 06-03 embrulha isso num Blob no cliente, nada de
 * Route Handler nem Buffer Node.
 *
 * Não sanitiza aqui (Pitfall A4) — o modelo é gerado pelo próprio sistema,
 * nunca é input do usuário; a sanitização de formula-injection é do lado de
 * quem lê valores do usuário (06-02).
 */

/** Uma única linha de exemplo (IMP-02: "vazio + uma linha de exemplo"), com valores plausíveis por campo. */
const EXAMPLE_VALUES: Record<(typeof SYSTEM_FIELDS)[number]["key"], string> = {
  razaoSocial: "Distribuidora Exemplo Ltda",
  cep: "01310-100",
  rua: "Av. Paulista",
  numero: "1000",
  complemento: "Sala 12",
  cidade: "São Paulo",
  estado: "SP",
  categoria: "Food Service",
  contato: "Fulano de Tal",
  telefone: "11999999999",
  email: "contato@exemplo.com",
  produtos: "Casca, Óleo",
  responsavel: "Ana Souza",
  numeroDeLojas: "1",
}

export function buildModeloImportacao(): Uint8Array {
  const headers = SYSTEM_FIELDS.map((field) => field.label)
  const exampleRow = SYSTEM_FIELDS.map((field) => EXAMPLE_VALUES[field.key])

  const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo")

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array
}
