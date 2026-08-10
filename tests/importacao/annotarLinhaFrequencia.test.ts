import { describe, expect, it } from "vitest"

import {
  annotarLinhaFrequencia,
  annotarLoteFrequencia,
  type ClienteFrequenciaLookup,
  type MappedRowFrequencia,
} from "../../lib/importacao/annotarLinhaFrequencia"

/**
 * Unit tests for the frequência-de-visita per-row annotation (17-03 Task 2,
 * IMP-01). Pure-function style, fabricated lookup lists — no Supabase, no
 * .env.local, mirrors tests/importacao/annotarLinha.test.ts.
 */

const clientes: ClienteFrequenciaLookup[] = [
  {
    id: "cliente-1",
    razaoSocial: "Distribuidora ABC Ltda",
    statusAcompanhamento: "ganho",
  },
  {
    id: "cliente-2",
    razaoSocial: "Mercado XYZ",
    statusAcompanhamento: "em_andamento",
  },
  {
    id: "cliente-3",
    razaoSocial: "Comercial Ambigua Ltda",
    statusAcompanhamento: "ganho",
  },
  {
    id: "cliente-4",
    razaoSocial: "Comercial Ambigua S/A",
    statusAcompanhamento: "ganho",
  },
]

function baseRow(): MappedRowFrequencia {
  return { razaoSocial: "Distribuidora ABC Ltda", frequenciaVisita: "Mensal" }
}

describe("annotarLinhaFrequencia", () => {
  it("ok: razao social casa exatamente um cliente ganho e frequencia escrita pelo rotulo", () => {
    const result = annotarLinhaFrequencia(baseRow(), clientes)

    expect(result.status).toBe("ok")
    expect(result.reasons).toEqual([])
    expect(result.resolved.clienteId).toBe("cliente-1")
    expect(result.resolved.frequenciaVisita).toBe("mensal")
  })

  it("variacao: razao social com caixa/acento/sufixo diferentes e frequencia em caixa alta com espacos continua ok", () => {
    const result = annotarLinhaFrequencia(
      { razaoSocial: "distribuidora ABC", frequenciaVisita: "  MENSAL  " },
      clientes
    )

    expect(result.status).toBe("ok")
    expect(result.resolved.clienteId).toBe("cliente-1")
    expect(result.resolved.frequenciaVisita).toBe("mensal")
  })

  it("semrazao: razao social vazia vira erro com o motivo de nao informada, identificador nulo", () => {
    const result = annotarLinhaFrequencia(
      { razaoSocial: "", frequenciaVisita: "Mensal" },
      clientes
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain("Razão social não informada")
    expect(result.resolved.clienteId).toBeNull()
  })

  it("naoencontrado: razao social que nao casa ninguem vira erro com o motivo de nao encontrado, identificador nulo", () => {
    const result = annotarLinhaFrequencia(
      { razaoSocial: "Empresa Inexistente", frequenciaVisita: "Mensal" },
      clientes
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain(
      "Cliente não encontrado com essa razão social"
    )
    expect(result.resolved.clienteId).toBeNull()
  })

  it("ambiguo: dois clientes na lista normalizam para a mesma chave, erro com motivo de ambiguidade e identificador nulo (L1)", () => {
    const result = annotarLinhaFrequencia(
      { razaoSocial: "Comercial Ambigua", frequenciaVisita: "Mensal" },
      clientes
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain(
      "Mais de um cliente encontrado com essa razão social — use o nome exato do cadastro"
    )
    expect(result.resolved.clienteId).toBeNull()
  })

  it("naoganho: cliente encontrado com status em andamento vira erro, identificador explicitamente nulo", () => {
    const result = annotarLinhaFrequencia(
      { razaoSocial: "Mercado XYZ", frequenciaVisita: "Mensal" },
      clientes
    )

    expect(result.status).toBe("erro")
    expect(
      result.reasons.some((reason) => reason.includes("não está com status"))
    ).toBe(true)
    expect(result.resolved.clienteId).toBeNull()
  })

  it("semfrequencia: frequencia vazia vira erro com o motivo de nao informada", () => {
    const result = annotarLinhaFrequencia(
      { razaoSocial: "Distribuidora ABC Ltda", frequenciaVisita: "" },
      clientes
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain("Frequência de visita não informada")
  })

  it("frequenciainvalida: frequencia com um texto qualquer vira erro cujo motivo contem o valor cru interpolado", () => {
    const result = annotarLinhaFrequencia(
      { razaoSocial: "Distribuidora ABC Ltda", frequenciaVisita: "Diaria" },
      clientes
    )

    expect(result.status).toBe("erro")
    expect(
      result.reasons.some(
        (reason) => reason.includes("Diaria") && reason.includes("não reconhecida")
      )
    ).toBe(true)
  })

  it("multiplosmotivos: linha sem razao social e sem frequencia tem dois motivos, sem repeticao", () => {
    const result = annotarLinhaFrequencia(
      { razaoSocial: "", frequenciaVisita: "" },
      clientes
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toEqual([
      "Razão social não informada",
      "Frequência de visita não informada",
    ])
  })

  it("saneamento: celula comecando por caractere perigoso nao escapa do saneamento, e a linha nao casa cliente nenhum", () => {
    const result = annotarLinhaFrequencia(
      { razaoSocial: "=cmd|' /C calc'!A1", frequenciaVisita: "Mensal" },
      clientes
    )

    expect(result.resolved.razaoSocial.startsWith("'=")).toBe(true)
    expect(result.resolved.clienteId).toBeNull()
  })

  it("lote: a anotacao de lote sobre varias linhas devolve o mesmo resultado que chamar a anotacao por linha para cada uma", () => {
    const linhas: MappedRowFrequencia[] = [
      baseRow(),
      { razaoSocial: "Mercado XYZ", frequenciaVisita: "Mensal" },
      { razaoSocial: "", frequenciaVisita: "" },
    ]

    const lote = annotarLoteFrequencia(linhas, clientes)
    const individual = linhas.map((linha) =>
      annotarLinhaFrequencia(linha, clientes)
    )

    expect(lote).toEqual(individual)
  })
})
