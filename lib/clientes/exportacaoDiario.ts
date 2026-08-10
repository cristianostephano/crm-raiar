import * as XLSX from "@e965/xlsx"
import { format, parseISO } from "date-fns"

import { sanitizeCell } from "@/lib/clientes/exportacao"
// Import relativo de propósito, não pelo alias que aponta para a pasta de
// integração com o banco — é só um type-only import (apagado em tempo de
// compilação, zero custo em tempo de execução), mas mantém este arquivo
// livre de qualquer referência textual a esse caminho, reforçando
// visualmente que o gerador é puro.
import type { DiarioExportRow } from "../supabase/queries/clientes"

/**
 * Dependency-free .xlsx export transform for the diário download (IMP-02,
 * plano 17-02) — irmão puro de `lib/clientes/exportacao.ts`: sem cliente de
 * banco, sem diretiva de cliente ou de servidor no topo do arquivo,
 * importável tanto de uma rota quanto de um teste. Toma linhas já lidas por
 * `getDiarioParaExportacao()` (lib/supabase/queries/clientes.ts) e devolve
 * um workbook em Buffer, na mesma forma de `buildClientesWorkbook`.
 *
 * O saneador de célula (`sanitizeCell`) é IMPORTADO do módulo de exportação
 * de clientes, nunca reimplementado — aquele arquivo já declara esse
 * caminho como "o ÚNICO caminho compartilhado que toda célula de string
 * passa"; reimplementar aqui criaria dois saneadores que podem divergir,
 * exatamente o que aquele comentário existe para proibir.
 */

const TIPO_LABELS: Record<DiarioExportRow["tipo"], string> = {
  tarefa_concluida: "Prospecção",
  visita_concluida: "Visita",
}

/**
 * Cabeçalhos na ordem fixa do contrato de copy — usados tanto para o caso
 * vazio abaixo quanto como a única fonte da ordem de coluna (json_to_sheet
 * também segue essa mesma ordem porque é a ordem das chaves do objeto de
 * linha em sheetRows).
 */
const DIARIO_HEADERS = [
  "Cliente",
  "Responsável",
  "Tipo",
  "Resumo",
  "Data",
  "Autor",
] as const

/** Coerces a nullable diário field to its exported cell text, sanitized. */
function cell(value: string | null): string {
  if (value === null) return ""
  return sanitizeCell(value)
}

/**
 * Builds the "Diário" .xlsx workbook (IMP-02) from export-shaped diário
 * rows. Column order é fixa pela ordem das chaves do objeto de linha abaixo
 * (json_to_sheet preserva a ordem das chaves da primeira linha): Cliente,
 * Responsável, Tipo, Resumo, Data, Autor. TODA coluna, sem exceção —
 * inclusive as duas de nome e a de data, que não precisam de saneamento
 * hoje — passa pelo mesmo embrulho `cell()` -> `sanitizeCell()`: rotear
 * tudo uniformemente é o que impede que uma coluna futura reabra o buraco
 * de injeção em silêncio (T-17-11).
 */
export function buildDiarioWorkbook(rows: DiarioExportRow[]): Buffer {
  const sheetRows = rows.map((row) => ({
    Cliente: cell(row.razaoSocial),
    Responsável: cell(row.responsavelNome),
    Tipo: cell(TIPO_LABELS[row.tipo]),
    Resumo: cell(row.descricao),
    Data: cell(format(parseISO(row.criadoEm), "dd/MM/yyyy HH:mm")),
    Autor: cell(row.autorNome),
  }))

  // json_to_sheet([]) devolve uma folha sem NENHUMA célula (nem cabeçalho) —
  // um diário vazio precisa continuar baixando uma planilha com a linha de
  // cabeçalho (must_have do plano), nunca uma folha em branco. aoa_to_sheet
  // com só a linha de cabeçalho cobre esse caso sem duplicar a lista de
  // colunas em outro lugar.
  const worksheet =
    sheetRows.length === 0
      ? XLSX.utils.aoa_to_sheet([[...DIARIO_HEADERS]])
      : XLSX.utils.json_to_sheet(sheetRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Diário")

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer
}
