import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Testes de `getAgenda2Periodo` (Fase 32 Plano 2, Tarefa 2, AGD2-08) — mock
 * de `@/lib/supabase/server` no molde de tests/agenda2/agenda2-query.test.ts
 * (vi.hoisted + builder encadeavel; `range` e o terminal). O builder tem
 * `gte`/`lte` alem de `or`/`eq`/`order` justamente para provar que `or` e
 * `eq` NUNCA sao chamados: o calendario nao tem o corte da Lista (D-28) e a
 * fronteira de dono e so a RLS (D-30).
 */
const { fromSpy, selectSpy, gteSpy, lteSpy, orSpy, eqSpy, orderSpy, rangeSpy } =
  vi.hoisted(() => ({
    fromSpy: vi.fn(),
    selectSpy: vi.fn(),
    gteSpy: vi.fn(),
    lteSpy: vi.fn(),
    orSpy: vi.fn(),
    eqSpy: vi.fn(),
    orderSpy: vi.fn(),
    rangeSpy: vi.fn(),
  }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (tabela: string) => {
      fromSpy(tabela)
      return {
        select: (colunas: string) => {
          selectSpy(colunas)

          const builder = {
            gte: (...args: unknown[]) => {
              gteSpy(...args)
              return builder
            },
            lte: (...args: unknown[]) => {
              lteSpy(...args)
              return builder
            },
            or: (...args: unknown[]) => {
              orSpy(...args)
              return builder
            },
            eq: (...args: unknown[]) => {
              eqSpy(...args)
              return builder
            },
            order: (...args: unknown[]) => {
              orderSpy(...args)
              return builder
            },
            range: (inicio: number, fim: number) => rangeSpy(inicio, fim),
          }
          return builder
        },
      }
    },
  }),
}))

import { getAgenda2Periodo } from "@/lib/supabase/queries/agenda2"

function fakeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    vendedor_id: "v1",
    nome_cliente: "Mercado Bom Preço",
    bairro: "Centro",
    data: "2026-08-14",
    concluido: false,
    atualizado_em: "2026-08-14T10:00:00+00:00",
    o_que_fazer: null,
    o_que_foi_feito: null,
    profiles: { nome: "Ana", sobrenome: "Souza" },
    ...overrides,
  }
}

describe("getAgenda2Periodo", () => {
  beforeEach(() => {
    fromSpy.mockReset()
    selectSpy.mockReset()
    gteSpy.mockReset()
    lteSpy.mockReset()
    orSpy.mockReset()
    eqSpy.mockReset()
    orderSpy.mockReset()
    rangeSpy.mockReset()
  })

  it("periodo-filtros: tabela, colunas, gte/lte em data, sem or, sem eq, ordem estavel", async () => {
    rangeSpy.mockResolvedValueOnce({ data: [fakeRow()], error: null })

    await getAgenda2Periodo("2026-07-27", "2026-09-06")

    expect(fromSpy).toHaveBeenCalledWith("agenda2_itens")
    expect(selectSpy).toHaveBeenCalledWith(
      "id, vendedor_id, nome_cliente, bairro, data, concluido, atualizado_em, o_que_fazer, o_que_foi_feito, profiles(nome, sobrenome)"
    )
    expect(gteSpy).toHaveBeenCalledWith("data", "2026-07-27")
    expect(lteSpy).toHaveBeenCalledWith("data", "2026-09-06")
    expect(orSpy).not.toHaveBeenCalled()
    expect(eqSpy).not.toHaveBeenCalled()
    expect(orderSpy).toHaveBeenCalledTimes(3)
    expect(orderSpy.mock.calls[0]).toEqual(["data", { ascending: true }])
    expect(orderSpy.mock.calls[1]).toEqual(["criado_em", { ascending: true }])
    expect(orderSpy.mock.calls[2]).toEqual(["id", { ascending: true }])
    expect(rangeSpy).toHaveBeenCalledWith(0, 999)
  })

  it("periodo-mapeia: concluido de data passada e profiles nulo", async () => {
    rangeSpy.mockResolvedValueOnce({
      data: [
        fakeRow({ id: "a", data: "2026-08-01", concluido: true }),
        fakeRow({ id: "b", profiles: null }),
      ],
      error: null,
    })

    const itens = await getAgenda2Periodo("2026-07-27", "2026-09-06")

    expect(itens).toHaveLength(2)
    expect(itens[0]).toMatchObject({
      id: "a",
      data: "2026-08-01",
      concluido: true,
      responsavel: "v1",
      responsavelNome: "Ana Souza",
    })
    expect(itens[1].responsavelNome).toBeNull()
    expect(itens[0].oQueFazer).toBeNull()
    expect(itens[0].oQueFoiFeito).toBeNull()
  })

  it("periodo-mapeia-textos: os dois textos preenchidos viram oQueFazer e oQueFoiFeito", async () => {
    rangeSpy.mockResolvedValueOnce({
      data: [
        fakeRow({
          o_que_fazer: "Levar amostras",
          o_que_foi_feito: "Pedido combinado",
        }),
      ],
      error: null,
    })

    const itens = await getAgenda2Periodo("2026-07-27", "2026-09-06")

    expect(itens[0].oQueFazer).toBe("Levar amostras")
    expect(itens[0].oQueFoiFeito).toBe("Pedido combinado")
  })

  it("periodo-pagina (Pitfall 4): junta paginas, nunca devolve lista truncada", async () => {
    const primeiraPagina = Array.from({ length: 1000 }, (_, i) =>
      fakeRow({ id: `item-${i}` })
    )
    rangeSpy
      .mockResolvedValueOnce({ data: primeiraPagina, error: null })
      .mockResolvedValueOnce({ data: [fakeRow({ id: "item-1000" })], error: null })

    const itens = await getAgenda2Periodo("2026-07-27", "2026-09-06")

    expect(itens).toHaveLength(1001)
    expect(rangeSpy).toHaveBeenNthCalledWith(1, 0, 999)
    expect(rangeSpy).toHaveBeenNthCalledWith(2, 1000, 1999)
  })

  it("periodo-erro: falha de leitura rejeita com mensagem do calendario", async () => {
    rangeSpy.mockResolvedValueOnce({ data: null, error: { message: "boom" } })

    await expect(
      getAgenda2Periodo("2026-07-27", "2026-09-06")
    ).rejects.toThrow(/calendário/)
  })
})
