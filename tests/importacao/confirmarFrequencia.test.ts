import { describe, expect, it } from "vitest"

import {
  fundirGruposDeMotivos,
  planConfirmacaoFrequencia,
  reconciliarFrequencia,
  type RpcFrequenciaRow,
} from "../../lib/importacao/confirmarFrequencia"
import type { ValidatedRowFrequencia } from "../../app/actions/importacaoFrequencia"
import type { ResolvedRowFrequencia } from "../../lib/importacao/annotarLinhaFrequencia"
import type { FrequenciaVisita } from "../../lib/funil/frequencia"

/**
 * Unit tests for the frequência-de-visita confirm-time accounting helper
 * (17-03 Task 3, IMP-01). Pure-function style, following
 * tests/importacao/confirmar.test.ts — no Supabase, no server context.
 */

function makeResolved(
  overrides: Partial<ResolvedRowFrequencia> = {}
): ResolvedRowFrequencia {
  return {
    clienteId: "cliente-1",
    razaoSocial: "Distribuidora ABC Ltda",
    frequenciaVisita: "mensal",
    ...overrides,
  }
}

function makeRow(
  overrides: Partial<ValidatedRowFrequencia> = {}
): ValidatedRowFrequencia {
  return {
    row: 0,
    status: "ok",
    reasons: [],
    resolved: makeResolved(),
    ...overrides,
  }
}

describe("planConfirmacaoFrequencia", () => {
  it("carga: linhas ok viram entradas de carga com as chaves exatas que a rpc espera", () => {
    const linha = makeRow()

    const result = planConfirmacaoFrequencia([linha])

    expect(result.carga).toEqual([{ id: "cliente-1", frequencia_visita: "mensal" }])
    expect(result.puladas).toEqual([])
    expect(result.puladasCount).toBe(0)
  })

  it("erro: linha com status de erro nao entra na carga; cada motivo vira grupo e a linha conta uma vez", () => {
    const linha = makeRow({
      status: "erro",
      reasons: ["Razão social não informada", "Frequência de visita não informada"],
    })

    const result = planConfirmacaoFrequencia([linha])

    expect(result.carga).toEqual([])
    expect(result.puladasCount).toBe(1)
    expect(result.puladas).toEqual(
      expect.arrayContaining([
        { motivo: "Razão social não informada", quantidade: 1 },
        { motivo: "Frequência de visita não informada", quantidade: 1 },
      ])
    )
    expect(result.puladas).toHaveLength(2)
  })

  it("repetido: tres linhas apontando para o mesmo identificador — so a primeira entra na carga (L2)", () => {
    const linhas: ValidatedRowFrequencia[] = [
      makeRow({ row: 0 }),
      makeRow({ row: 1 }),
      makeRow({ row: 2 }),
    ]

    const result = planConfirmacaoFrequencia(linhas)

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

    const result = planConfirmacaoFrequencia([linha])

    expect(result.carga).toEqual([])
    expect(result.puladasCount).toBe(1)
  })

  it("frequenciainvalida: linha ok com frequencia fora do vocabulario nao entra na carga", () => {
    const linha = makeRow({
      resolved: makeResolved({
        frequenciaVisita: "diaria" as FrequenciaVisita,
      }),
    })

    const result = planConfirmacaoFrequencia([linha])

    expect(result.carga).toEqual([])
    expect(result.puladasCount).toBe(1)
  })

  it("vazio: nenhuma linha ok produz carga vazia e nenhuma excecao", () => {
    const linha = makeRow({
      status: "erro",
      reasons: ["Razão social não informada"],
    })

    expect(() => planConfirmacaoFrequencia([linha])).not.toThrow()
    expect(planConfirmacaoFrequencia([linha]).carga).toEqual([])
  })
})

describe("reconciliarFrequencia", () => {
  it("reconcilia: enviadas tres, devolvidas duas — dois atualizados e um grupo extra de puladas", () => {
    const carga: RpcFrequenciaRow[] = [
      { id: "cliente-1", frequencia_visita: "mensal" },
      { id: "cliente-2", frequencia_visita: "semanal" },
      { id: "cliente-3", frequencia_visita: "quinzenal" },
    ]
    const retornados = [
      { id: "cliente-1", razaoSocial: "Distribuidora ABC" },
      { id: "cliente-2", razaoSocial: "Mercado XYZ" },
    ]

    const result = reconciliarFrequencia(carga, retornados)

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

describe("fundirGruposDeMotivos", () => {
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
