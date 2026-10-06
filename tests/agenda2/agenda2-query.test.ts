import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Testes de `getAgenda2`/`getAgenda2PendentesCount` (Fase 31 Plano 4,
 * Tarefa 1) — mock completo de `@/lib/supabase/server`, mesmo molde de
 * tests/funil/encerrados-query.test.ts (vi.hoisted + rangeSpy/orderSpy
 * configuráveis por teste). `now` fixo = 2026-09-28 10:00 local (construtor
 * numérico, nunca string) para tornar `limiteData`/`limiteInstante`
 * determinísticos.
 *
 * `select()` do mock se comporta como a chamada real: sem opções de
 * contagem devolve o builder da leitura (`.or().order().order().order()
 * .range()`); com `{ count: "exact", head: true }` devolve o builder da
 * contagem (`.eq().eq()`, terminal na segunda chamada — mesma forma que o
 * supabase-js real, onde o builder é "thenable").
 */
const {
  getUserSpy,
  fromSpy,
  selectSpy,
  orSpy,
  orderSpy,
  rangeSpy,
  eqSpy,
  countEqFinalSpy,
} = vi.hoisted(() => ({
  getUserSpy: vi.fn(),
  fromSpy: vi.fn(),
  selectSpy: vi.fn(),
  orSpy: vi.fn(),
  orderSpy: vi.fn(),
  rangeSpy: vi.fn(),
  eqSpy: vi.fn(),
  countEqFinalSpy: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserSpy },
    from: (tabela: string) => {
      fromSpy(tabela)
      return {
        select: (colunas: string, opcoes?: { count?: string; head?: boolean }) => {
          selectSpy(colunas, opcoes)

          if (opcoes?.count) {
            return {
              eq: (campo1: string, valor1: unknown) => {
                eqSpy(campo1, valor1)
                return {
                  eq: (campo2: string, valor2: unknown) =>
                    countEqFinalSpy(campo2, valor2),
                }
              },
            }
          }

          const builder = {
            or: (filtro: string) => {
              orSpy(filtro)
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

import { getAgenda2, getAgenda2PendentesCount } from "@/lib/supabase/queries/agenda2"

const now = new Date(2026, 8, 28, 10, 0)
const limiteData = "2026-09-27"
const limiteInstante = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

function fakeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    vendedor_id: "v1",
    nome_cliente: "Mercado Bom Preço",
    bairro: "Centro",
    data: "2026-09-28",
    concluido: false,
    atualizado_em: "2026-09-28T10:00:00+00:00",
    o_que_fazer: null,
    o_que_foi_feito: null,
    profiles: { nome: "Ana", sobrenome: "Souza" },
    ...overrides,
  }
}

describe("getAgenda2", () => {
  beforeEach(() => {
    fromSpy.mockReset()
    selectSpy.mockReset()
    orSpy.mockReset()
    orderSpy.mockReset()
    rangeSpy.mockReset()
  })

  it("leitura-tabela-e-colunas: from('agenda2_itens') uma vez; select contém as colunas certas e não contém criado_em", async () => {
    rangeSpy.mockResolvedValueOnce({ data: [fakeRow()], error: null })

    await getAgenda2(now)

    expect(fromSpy).toHaveBeenCalledTimes(1)
    expect(fromSpy).toHaveBeenCalledWith("agenda2_itens")
    const colunas = selectSpy.mock.calls[0][0] as string
    expect(colunas).toContain("id")
    expect(colunas).toContain("vendedor_id")
    expect(colunas).toContain("nome_cliente")
    expect(colunas).toContain("bairro")
    expect(colunas).toContain("data")
    expect(colunas).toContain("concluido")
    expect(colunas).toContain("atualizado_em")
    expect(colunas).toContain("o_que_fazer")
    expect(colunas).toContain("o_que_foi_feito")
    expect(colunas).toContain("profiles(nome, sobrenome)")
    expect(colunas).not.toContain("criado_em")
  })

  it("leitura-sem-filtro-de-dono (AGD2-07): nenhuma chamada .eq('vendedor_id', ...) na leitura", async () => {
    rangeSpy.mockResolvedValueOnce({ data: [fakeRow()], error: null })

    await getAgenda2(now)

    expect(eqSpy).not.toHaveBeenCalled()
  })

  it("leitura-limite-recente (correção 7): .or(...) contém concluido.eq.false, data.gte.<ontem> e atualizado_em.gte.<now-48h>", async () => {
    rangeSpy.mockResolvedValueOnce({ data: [], error: null })

    await getAgenda2(now)

    expect(orSpy).toHaveBeenCalledTimes(1)
    const filtro = orSpy.mock.calls[0][0] as string
    expect(filtro).toContain("concluido.eq.false")
    expect(filtro).toContain(`data.gte.${limiteData}`)
    expect(filtro).toContain(`atualizado_em.gte.${limiteInstante}`)
  })

  it("leitura-ordem (D-08): order chamado na ordem data, criado_em, id, todos ascendentes", async () => {
    rangeSpy.mockResolvedValueOnce({ data: [], error: null })

    await getAgenda2(now)

    expect(orderSpy.mock.calls[0]).toEqual(["data", { ascending: true }])
    expect(orderSpy.mock.calls[1]).toEqual(["criado_em", { ascending: true }])
    expect(orderSpy.mock.calls[2]).toEqual(["id", { ascending: true }])
  })

  it("leitura-mapeamento: linha vira Agenda2Item; profiles nulo vira responsavelNome nulo", async () => {
    rangeSpy.mockResolvedValueOnce({
      data: [
        fakeRow(),
        fakeRow({ id: "item-2", vendedor_id: "v2", profiles: null }),
      ],
      error: null,
    })

    const resultado = await getAgenda2(now)

    expect(resultado).toEqual([
      {
        id: "item-1",
        nomeCliente: "Mercado Bom Preço",
        bairro: "Centro",
        data: "2026-09-28",
        concluido: false,
        atualizadoEm: "2026-09-28T10:00:00+00:00",
        oQueFazer: null,
        oQueFoiFeito: null,
        responsavel: "v1",
        responsavelNome: "Ana Souza",
      },
      {
        id: "item-2",
        nomeCliente: "Mercado Bom Preço",
        bairro: "Centro",
        data: "2026-09-28",
        concluido: false,
        atualizadoEm: "2026-09-28T10:00:00+00:00",
        oQueFazer: null,
        oQueFoiFeito: null,
        responsavel: "v2",
        responsavelNome: null,
      },
    ])
  })

  it("leitura-mapeamento-textos: os dois textos preenchidos viram oQueFazer e oQueFoiFeito", async () => {
    rangeSpy.mockResolvedValueOnce({
      data: [
        fakeRow({
          o_que_fazer: "Levar amostras",
          o_que_foi_feito: "Pedido combinado",
        }),
      ],
      error: null,
    })

    const resultado = await getAgenda2(now)

    expect(resultado[0].oQueFazer).toBe("Levar amostras")
    expect(resultado[0].oQueFoiFeito).toBe("Pedido combinado")
  })

  it("leitura-paginada: 1000 + 5 linhas viram 1005 itens; o segundo recorte é (1000, 1999)", async () => {
    const primeiraPagina = Array.from({ length: 1000 }, (_, i) =>
      fakeRow({ id: `item-${i}` })
    )
    const segundaPagina = Array.from({ length: 5 }, (_, i) =>
      fakeRow({ id: `item-${1000 + i}` })
    )

    rangeSpy
      .mockResolvedValueOnce({ data: primeiraPagina, error: null })
      .mockResolvedValueOnce({ data: segundaPagina, error: null })

    const resultado = await getAgenda2(now)

    expect(resultado).toHaveLength(1005)
    expect(rangeSpy.mock.calls[1]).toEqual([1000, 1999])
  })

  it("leitura-erro: página com erro faz getAgenda2 rejeitar", async () => {
    rangeSpy.mockResolvedValueOnce({
      data: null,
      error: { message: "falha simulada" },
    })

    await expect(getAgenda2(now)).rejects.toThrow()
  })
})

describe("getAgenda2PendentesCount", () => {
  beforeEach(() => {
    getUserSpy.mockReset()
    fromSpy.mockReset()
    selectSpy.mockReset()
    eqSpy.mockReset()
    countEqFinalSpy.mockReset()
  })

  it("contagem-filtro-explicito (D-13): usa count exact/head e filtra vendedor_id + concluido=false explicitamente", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
    countEqFinalSpy.mockResolvedValueOnce({ count: 3, error: null })

    const resultado = await getAgenda2PendentesCount()

    expect(fromSpy).toHaveBeenCalledWith("agenda2_itens")
    expect(selectSpy).toHaveBeenCalledWith("id", { count: "exact", head: true })
    expect(eqSpy).toHaveBeenCalledWith("vendedor_id", "u1")
    expect(countEqFinalSpy).toHaveBeenCalledWith("concluido", false)
    expect(resultado).toBe(3)
  })

  it("contagem-sem-usuario: sem usuário devolve 0 sem chamar from", async () => {
    getUserSpy.mockResolvedValue({ data: { user: null } })

    const resultado = await getAgenda2PendentesCount()

    expect(resultado).toBe(0)
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it("contagem-erro: erro na contagem faz getAgenda2PendentesCount rejeitar", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
    countEqFinalSpy.mockResolvedValueOnce({
      count: null,
      error: { message: "falha simulada" },
    })

    await expect(getAgenda2PendentesCount()).rejects.toThrow()
  })
})
