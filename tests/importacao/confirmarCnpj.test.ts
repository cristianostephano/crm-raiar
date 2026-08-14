import { describe, expect, it } from "vitest"

import {
  fundirGruposDeMotivos,
  planConfirmacaoCnpj,
  reconciliarCnpj,
  type RpcCnpjRow,
} from "../../lib/importacao/confirmarCnpj"
import type { ValidatedRowCnpj } from "../../app/actions/importacaoCnpj"
import type { ResolvedRowCnpj } from "../../lib/importacao/annotarLinhaCnpj"

/**
 * Unit tests for a contabilidade de confirmacao da planilha "CNPJ em massa"
 * (19-03 Task 3, IMP-03). Pure-function style, seguindo
 * tests/importacao/confirmarFrequencia.test.ts — no Supabase, no server
 * context.
 */

function makeResolved(
  overrides: Partial<ResolvedRowCnpj> = {}
): ResolvedRowCnpj {
  return {
    clienteId: "cliente-1",
    razaoSocial: "Distribuidora ABC Ltda",
    clienteEncontradoRazaoSocial: "Distribuidora ABC Ltda",
    cnpj: "12.345.678/0001-90",
    ...overrides,
  }
}

function makeRow(overrides: Partial<ValidatedRowCnpj> = {}): ValidatedRowCnpj {
  return {
    row: 0,
    status: "ok",
    reasons: [],
    resolved: makeResolved(),
    ...overrides,
  }
}

describe("planConfirmacaoCnpj", () => {
  it("carga: linhas ok viram entradas de carga com as chaves exatas que a rpc espera", () => {
    const linha = makeRow()

    const result = planConfirmacaoCnpj([linha])

    expect(result.carga).toEqual([
      { id: "cliente-1", cnpj: "12.345.678/0001-90" },
    ])
    expect(result.puladas).toEqual([])
    expect(result.puladasCount).toBe(0)
  })

  it("erro: linha com status de erro nao entra na carga; cada motivo vira grupo e a linha conta uma vez", () => {
    const linha = makeRow({
      status: "erro",
      reasons: ["Razão social não informada", "CNPJ não informado"],
    })

    const result = planConfirmacaoCnpj([linha])

    expect(result.carga).toEqual([])
    expect(result.puladasCount).toBe(1)
    expect(result.puladas).toEqual(
      expect.arrayContaining([
        { motivo: "Razão social não informada", quantidade: 1 },
        { motivo: "CNPJ não informado", quantidade: 1 },
      ])
    )
    expect(result.puladas).toHaveLength(2)
  })

  it("repetido: tres linhas apontando para o mesmo identificador — so a primeira entra na carga", () => {
    const linhas: ValidatedRowCnpj[] = [
      makeRow({ row: 0 }),
      makeRow({ row: 1 }),
      makeRow({ row: 2 }),
    ]

    const result = planConfirmacaoCnpj(linhas)

    expect(result.carga).toHaveLength(1)
    expect(result.carga[0].id).toBe("cliente-1")
    expect(result.puladas).toEqual([
      {
        motivo: "Cliente repetido na planilha — só a primeira linha foi considerada",
        quantidade: 2,
      },
    ])
  })

  it("incompleto: linha ok com identificador nulo nao entra na carga e vira pulada", () => {
    const linha = makeRow({ resolved: makeResolved({ clienteId: null }) })

    const result = planConfirmacaoCnpj([linha])

    expect(result.carga).toEqual([])
    expect(result.puladasCount).toBe(1)
  })

  it("incompleto: linha ok com cnpj nulo nao entra na carga e vira pulada", () => {
    const linha = makeRow({ resolved: makeResolved({ cnpj: null }) })

    const result = planConfirmacaoCnpj([linha])

    expect(result.carga).toEqual([])
    expect(result.puladasCount).toBe(1)
  })

  it("cnpjvazionaconfirmacao: linha ok com cnpj so de espacos na confirmacao nao entra na carga", () => {
    const linha = makeRow({ resolved: makeResolved({ cnpj: "   " }) })

    const result = planConfirmacaoCnpj([linha])

    expect(result.carga).toEqual([])
    expect(result.puladasCount).toBe(1)
  })

  it("vazio: nenhuma linha ok produz carga vazia e nenhuma excecao", () => {
    const linha = makeRow({
      status: "erro",
      reasons: ["Razão social não informada"],
    })

    expect(() => planConfirmacaoCnpj([linha])).not.toThrow()
    expect(planConfirmacaoCnpj([linha]).carga).toEqual([])
  })
})

describe("reconciliarCnpj", () => {
  it("reconcilia: enviadas tres, devolvidas duas — dois atualizados e um grupo extra de puladas", () => {
    const carga: RpcCnpjRow[] = [
      { id: "cliente-1", cnpj: "11.111.111/0001-11" },
      { id: "cliente-2", cnpj: "22.222.222/0001-22" },
      { id: "cliente-3", cnpj: "33.333.333/0001-33" },
    ]
    const retornados = [
      { id: "cliente-1", razaoSocial: "Distribuidora ABC" },
      { id: "cliente-2", razaoSocial: "Mercado XYZ" },
    ]

    const result = reconciliarCnpj(carga, retornados)

    expect(result.atualizados).toEqual([
      { razaoSocial: "Distribuidora ABC" },
      { razaoSocial: "Mercado XYZ" },
    ])
    expect(result.puladasExtra).toEqual([
      {
        motivo: "Cliente não estava mais apto no momento da gravação",
        quantidade: 1,
      },
    ])
  })
})

describe("fundirGruposDeMotivos (reusada de confirmarFrequencia.ts)", () => {
  it("funde: dois conjuntos com um motivo em comum viram um grupo so com as quantidades somadas", () => {
    const a = [{ motivo: "X", quantidade: 2 }]
    const b = [
      { motivo: "X", quantidade: 3 },
      { motivo: "Y", quantidade: 1 },
    ]

    expect(fundirGruposDeMotivos(a, b)).toEqual(
      expect.arrayContaining([
        { motivo: "X", quantidade: 5 },
        { motivo: "Y", quantidade: 1 },
      ])
    )
  })
})
