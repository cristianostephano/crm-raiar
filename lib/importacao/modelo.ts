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
 *
 * Fase 26 Plano 2 (PROSP-02): o cabeçalho de todo campo `required: true`
 * ganha o sufixo `REQUIRED_MARKER` (" *"), declarado uma única vez abaixo —
 * nunca digitado solto em mais de um lugar. Isso é seguro porque
 * `suggestMapping` (lib/importacao/mapping.ts) normaliza o cabeçalho
 * descartando tudo que não é letra ou número antes de comparar contra o
 * label de SYSTEM_FIELDS — o asterisco (e o espaço) somem na normalização,
 * então "Nome Fantasia *" continua batendo com o label "Nome Fantasia". Um
 * modelo baixado, preenchido e reenviado continua sendo mapeado sozinho.
 */

/** Sufixo visível de obrigatoriedade — único lugar do arquivo que o declara. */
const REQUIRED_MARKER = " *"

/** Uma única linha de exemplo (IMP-02: "vazio + uma linha de exemplo"), com valores plausíveis por campo. */
const EXAMPLE_VALUES: Record<(typeof SYSTEM_FIELDS)[number]["key"], string> = {
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

export function buildModeloImportacao(): Uint8Array {
  const headers = SYSTEM_FIELDS.map((field) =>
    field.required ? `${field.label}${REQUIRED_MARKER}` : field.label
  )
  const exampleRow = SYSTEM_FIELDS.map((field) => EXAMPLE_VALUES[field.key])

  const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo")

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array
}
