import { describe, expect, it } from "vitest"

import { buildClientesWorkbook } from "../../lib/clientes/exportacao"
import type { ClienteExportRow } from "../../lib/supabase/queries/clientes"
import * as XLSX from "@e965/xlsx"

/**
 * Unit tests for D-01 (Fase 29, Plano 4): o rótulo "Encerrado" na planilha
 * de exportação, para o novo valor "encerrado" de StatusAcompanhamento.
 * Molde de tests/clientes/exportacao.test.ts (mesma fábrica/leitura de
 * workbook), sem tocar naquele arquivo.
 */

function baseRow(overrides: Partial<ClienteExportRow> = {}): ClienteExportRow {
  return {
    razaoSocial: "Distribuidora Fictícia Encerrada",
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    complemento: null,
    cidade: "São Paulo",
    estado: "SP",
    categoriaNome: "Food Service",
    contato: "Fulano de Tal",
    telefone: "11999999999",
    email: "fulano@example.com",
    produtos: ["Casca"],
    numeroDeLojas: 1,
    responsavelNome: "Ana Souza",
    etapa: "primeira_venda",
    statusAcompanhamento: "em_andamento",
    observacao: null,
    ...overrides,
  }
}

function readBack(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheet = workbook.Sheets["Clientes"]
  return XLSX.utils.sheet_to_json(sheet, { defval: "" })
}

describe("buildClientesWorkbook — status encerrado (Fase 29, D-01)", () => {
  it("rotulo-encerrado: uma linha com statusAcompanhamento 'encerrado' sai 'Encerrado' na coluna Status", () => {
    const row = readBack(
      buildClientesWorkbook([baseRow({ statusAcompanhamento: "encerrado" })])
    )[0]
    expect(row["Status"]).toBe("Encerrado")
  })

  it("rotulos-antigos: em_andamento, ganho e perdido continuam com o rótulo de sempre", () => {
    const rows = readBack(
      buildClientesWorkbook([
        baseRow({ statusAcompanhamento: "em_andamento" }),
        baseRow({ statusAcompanhamento: "ganho" }),
        baseRow({ statusAcompanhamento: "perdido" }),
      ])
    )
    expect(rows[0]["Status"]).toBe("Em andamento")
    expect(rows[1]["Status"]).toBe("Ganho")
    expect(rows[2]["Status"]).toBe("Perdido")
  })
})
