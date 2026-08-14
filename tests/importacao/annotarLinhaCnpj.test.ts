import { describe, expect, it } from "vitest"

import {
  annotarLinhaCnpj,
  annotarLoteCnpj,
  type ClienteCnpjLookup,
  type MappedRowCnpj,
} from "../../lib/importacao/annotarLinhaCnpj"

/**
 * Unit tests for the anotação por linha da planilha "CNPJ em massa" (19-03
 * Task 2, IMP-03). Pure-function style, fabricated lookup lists — no
 * Supabase, no .env.local, espelha
 * tests/importacao/annotarLinhaFrequencia.test.ts.
 */

const clientes: ClienteCnpjLookup[] = [
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

function baseRow(): MappedRowCnpj {
  return { razaoSocial: "Distribuidora ABC Ltda", cnpj: "12.345.678/0001-90" }
}

describe("annotarLinhaCnpj", () => {
  it("ok: razao social casa exatamente um cliente ganho, cnpj saneado, razao social do banco preenchida", () => {
    const result = annotarLinhaCnpj(baseRow(), clientes)

    expect(result.status).toBe("ok")
    expect(result.reasons).toEqual([])
    expect(result.resolved.clienteId).toBe("cliente-1")
    expect(result.resolved.cnpj).toBe("12.345.678/0001-90")
    expect(result.resolved.clienteEncontradoRazaoSocial).toBe(
      "Distribuidora ABC Ltda"
    )
  })

  it("variacao: razao social com caixa/acento/sufixo diferentes continua ok", () => {
    const result = annotarLinhaCnpj(
      { razaoSocial: "distribuidora ABC", cnpj: "12345678000190" },
      clientes
    )

    expect(result.status).toBe("ok")
    expect(result.resolved.clienteId).toBe("cliente-1")
    expect(result.resolved.cnpj).toBe("12345678000190")
  })

  it("semrazao: razao social vazia vira erro com o motivo de nao informada, identificador nulo", () => {
    const result = annotarLinhaCnpj(
      { razaoSocial: "", cnpj: "12.345.678/0001-90" },
      clientes
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain("Razão social não informada")
    expect(result.resolved.clienteId).toBeNull()
  })

  it("naoencontrado: razao social que nao casa ninguem vira erro com o motivo de nao encontrado, identificador nulo", () => {
    const result = annotarLinhaCnpj(
      { razaoSocial: "Empresa Inexistente", cnpj: "12.345.678/0001-90" },
      clientes
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain(
      "Cliente não encontrado com essa razão social"
    )
    expect(result.resolved.clienteId).toBeNull()
  })

  it("ambiguo: dois clientes na lista normalizam para a mesma chave — erro, motivo de ambiguidade, identificador nulo", () => {
    const result = annotarLinhaCnpj(
      { razaoSocial: "Comercial Ambigua", cnpj: "12.345.678/0001-90" },
      clientes
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain(
      "Mais de um cliente encontrado com essa razão social — use o nome exato do cadastro"
    )
    expect(result.resolved.clienteId).toBeNull()
    expect(result.resolved.clienteEncontradoRazaoSocial).toBeNull()
  })

  it("naoganho: cliente encontrado com status em andamento vira erro, identificador nulo, mas com a razao social do banco preenchida", () => {
    const result = annotarLinhaCnpj(
      { razaoSocial: "Mercado XYZ", cnpj: "12.345.678/0001-90" },
      clientes
    )

    expect(result.status).toBe("erro")
    expect(
      result.reasons.some((reason) => reason.includes('não está com status'))
    ).toBe(true)
    expect(result.resolved.clienteId).toBeNull()
    expect(result.resolved.clienteEncontradoRazaoSocial).toBe("Mercado XYZ")
  })

  it("semcnpj: cnpj vazio vira erro com o motivo de nao informado", () => {
    const result = annotarLinhaCnpj(
      { razaoSocial: "Distribuidora ABC Ltda", cnpj: "" },
      clientes
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain("CNPJ não informado")
  })

  it("cnpjsoespacos: cnpj so com espacos vira erro com o motivo de nao informado", () => {
    const result = annotarLinhaCnpj(
      { razaoSocial: "Distribuidora ABC Ltda", cnpj: "   " },
      clientes
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain("CNPJ não informado")
  })

  it("cnpjformatolivre: qualquer valor nao-vazio de cnpj e aceito, independente de formato", () => {
    const result = annotarLinhaCnpj(
      { razaoSocial: "Distribuidora ABC Ltda", cnpj: "nao-e-um-cnpj-valido" },
      clientes
    )

    expect(result.status).toBe("ok")
    expect(result.resolved.cnpj).toBe("nao-e-um-cnpj-valido")
  })

  it("multiplosmotivos: linha sem razao social e sem cnpj tem dois motivos, sem repeticao", () => {
    const result = annotarLinhaCnpj({ razaoSocial: "", cnpj: "" }, clientes)

    expect(result.status).toBe("erro")
    expect(result.reasons).toEqual([
      "Razão social não informada",
      "CNPJ não informado",
    ])
  })

  it("saneamento: celula comecando por caractere perigoso nao escapa do saneamento, e a linha nao casa cliente nenhum", () => {
    const result = annotarLinhaCnpj(
      { razaoSocial: "=cmd|' /C calc'!A1", cnpj: "12.345.678/0001-90" },
      clientes
    )

    expect(result.resolved.razaoSocial.startsWith("'=")).toBe(true)
    expect(result.resolved.clienteId).toBeNull()
  })

  it("lote: a anotacao de lote sobre varias linhas devolve o mesmo resultado que chamar a anotacao por linha para cada uma", () => {
    const linhas: MappedRowCnpj[] = [
      baseRow(),
      { razaoSocial: "Mercado XYZ", cnpj: "12.345.678/0001-90" },
      { razaoSocial: "", cnpj: "" },
    ]

    const lote = annotarLoteCnpj(linhas, clientes)
    const individual = linhas.map((linha) => annotarLinhaCnpj(linha, clientes))

    expect(lote).toEqual(individual)
  })
})
