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
 *
 * Correção de bug (quick task 260827-nh4): o cabeçalho de todo campo
 * `required: true` de SYSTEM_FIELDS_ATIVO agora ganha o mesmo sufixo visível
 * `REQUIRED_MARKER` (" *") que `buildModeloImportacao`
 * (lib/importacao/modelo.ts, Fase 26 Plano 2) já usa — este gerador nunca
 * tinha recebido o mesmo tratamento, então nenhum dos 9 campos obrigatórios
 * (incluindo CNPJ) era sinalizado no modelo baixado. Isso é seguro porque
 * `suggestMapping` (lib/importacao/mapping.ts) normaliza o cabeçalho
 * descartando tudo que não é letra ou número antes de comparar contra o
 * label de SYSTEM_FIELDS_ATIVO — o asterisco (e o espaço) somem na
 * normalização, então "CNPJ *" continua batendo com o label "CNPJ". Um
 * modelo baixado, preenchido e reenviado continua sendo mapeado sozinho.
 */

/** Sufixo visível de obrigatoriedade — único lugar do arquivo que o declara. */
const REQUIRED_MARKER = " *"

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
  const headers = SYSTEM_FIELDS_ATIVO.map((field) =>
    field.required ? `${field.label}${REQUIRED_MARKER}` : field.label
  )
  const exampleRow = SYSTEM_FIELDS_ATIVO.map((field) => EXAMPLE_VALUES[field.key])

  const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo")

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array
}
