import * as XLSX from "@e965/xlsx"

import { SYSTEM_FIELDS_ATIVO } from "@/lib/importacao/typesAtivo"

/**
 * Gerador do modelo de planilha "Importar clientes ativos" para download
 * (Fase 25 Plano 2). Espelho literal de lib/importacao/modeloCnpj.ts: mesma
 * escrita em modo browser-safe `XLSX.write(wb, { type: "array" })` ->
 * Uint8Array (o botão "Baixar modelo de planilha" embrulha isso num Blob no
 * cliente, nada de Route Handler nem Buffer Node).
 *
 * Não sanitiza aqui (mesmo Pitfall A4 dos irmãos) — o modelo é gerado pelo
 * próprio sistema, nunca é input do usuário; a sanitização de
 * formula-injection é do lado de quem lê célula do usuário
 * (lib/importacao/annotarLinhaAtivo.ts).
 *
 * Cabeçalhos derivados dos rótulos do vocabulário (nunca digitados à mão) —
 * se `typesAtivo.ts` mudar um rótulo, o modelo acompanha automaticamente.
 * Valores de exemplo reusam os mesmos de lib/importacao/modelo.ts.
 */

const EXAMPLE_VALUES: Record<(typeof SYSTEM_FIELDS_ATIVO)[number]["key"], string> = {
  razaoSocial: "Distribuidora Exemplo Ltda",
  cnpj: "12.345.678/0001-90",
  nomeFantasia: "Distribuidora Exemplo",
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

export function buildModeloAtivos(): Uint8Array {
  const headers = SYSTEM_FIELDS_ATIVO.map((field) => field.label)
  const exampleRow = SYSTEM_FIELDS_ATIVO.map((field) => EXAMPLE_VALUES[field.key])

  const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo")

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array
}
