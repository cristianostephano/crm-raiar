import { describe, expect, it } from "vitest"

import {
  agruparAgenda,
  bucketDoItem,
  filtrarPorVendedor,
  vendedoresDaAgenda,
  type AgendaItem,
} from "../../lib/agenda/itens"

/**
 * Unit tests for the AGD-03/AGD-01/AGD-05(base)/AGD-06 pure logic layer
 * (14-02 Task 1). Pure, no Supabase, no render — every case fixes `now`
 * explicitly so results never depend on the real clock (mirrors
 * tests/clientes/staleness.test.ts's convention).
 */

const NOW = new Date(2026, 7, 8, 9, 0) // 2026-08-08 09:00 local

function item(overrides: Partial<AgendaItem> = {}): AgendaItem {
  return {
    origem: "prospeccao",
    itemId: "item-1",
    clienteId: "cliente-1",
    razaoSocial: "Cliente 1",
    responsavel: "vendedor-a",
    responsavelNome: "Ana Vendedora",
    titulo: "Visitar",
    data: "2026-08-08",
    ...overrides,
  }
}

describe("bucketDoItem", () => {
  it("classifica data anterior a hoje como atrasado", () => {
    expect(bucketDoItem("2026-08-07", NOW)).toBe("atrasado")
  })

  it("classifica data igual a hoje como hoje", () => {
    expect(bucketDoItem("2026-08-08", NOW)).toBe("hoje")
  })

  it("classifica data posterior a hoje como proximos", () => {
    expect(bucketDoItem("2026-08-09", NOW)).toBe("proximos")
  })

  it("um item de hoje continua hoje as 00h05 do mesmo dia (comparacao por dia de calendario)", () => {
    const madrugada = new Date(2026, 7, 8, 0, 5)
    expect(bucketDoItem("2026-08-08", madrugada)).toBe("hoje")
  })

  it("um item de hoje continua hoje as 23h30 do mesmo dia (comparacao por dia de calendario)", () => {
    const noiteAlta = new Date(2026, 7, 8, 23, 30)
    expect(bucketDoItem("2026-08-08", noiteAlta)).toBe("hoje")
  })
})

describe("agruparAgenda", () => {
  it("reparte uma lista mista nas tres secoes corretas", () => {
    const itens: AgendaItem[] = [
      item({ itemId: "a", data: "2026-08-07" }), // atrasado
      item({ itemId: "b", data: "2026-08-08" }), // hoje
      item({ itemId: "c", data: "2026-08-09" }), // proximos
    ]

    const agrupado = agruparAgenda(itens, NOW)

    expect(agrupado.atrasado.map((i) => i.itemId)).toEqual(["a"])
    expect(agrupado.hoje.map((i) => i.itemId)).toEqual(["b"])
    expect(agrupado.proximos.map((i) => i.itemId)).toEqual(["c"])
  })

  it("preserva a ordem de entrada dentro de cada secao (nao reordena)", () => {
    // Deliberadamente fora de ordem alfabetica e fora de ordem de data
    // dentro do mesmo bucket "proximos".
    const itens: AgendaItem[] = [
      item({ itemId: "z", razaoSocial: "Zeta Ltda", data: "2026-08-20" }),
      item({ itemId: "m", razaoSocial: "Manga SA", data: "2026-08-10" }),
      item({ itemId: "a", razaoSocial: "Acme Ltda", data: "2026-08-15" }),
    ]

    const agrupado = agruparAgenda(itens, NOW)

    expect(agrupado.proximos.map((i) => i.itemId)).toEqual(["z", "m", "a"])
  })

  it("particao: a soma das tres secoes bate com o total de entrada, para qualquer lista", () => {
    const itens: AgendaItem[] = [
      item({ itemId: "1", data: "2026-08-01" }),
      item({ itemId: "2", data: "2026-08-05" }),
      item({ itemId: "3", data: "2026-08-08" }),
      item({ itemId: "4", data: "2026-08-08" }),
      item({ itemId: "5", data: "2026-08-30" }),
    ]

    const agrupado = agruparAgenda(itens, NOW)
    const total =
      agrupado.atrasado.length + agrupado.hoje.length + agrupado.proximos.length

    expect(total).toBe(itens.length)
  })

  it("agruparAgenda([]) devolve as tres listas vazias", () => {
    const agrupado = agruparAgenda([], NOW)

    expect(agrupado.atrasado).toEqual([])
    expect(agrupado.hoje).toEqual([])
    expect(agrupado.proximos).toEqual([])
  })
})

describe("filtrarPorVendedor", () => {
  const itens: AgendaItem[] = [
    item({ itemId: "1", responsavel: "vendedor-a", responsavelNome: "Ana" }),
    item({ itemId: "2", responsavel: "vendedor-b", responsavelNome: "Bruno" }),
    item({ itemId: "3", responsavel: "vendedor-a", responsavelNome: "Ana" }),
  ]

  it("filtro com vendedorId null devolve a lista inteira, inalterada e na mesma ordem", () => {
    expect(filtrarPorVendedor(itens, null)).toEqual(itens)
  })

  it("filtro com um vendedorId valido devolve so os itens daquele responsavel", () => {
    const filtrado = filtrarPorVendedor(itens, "vendedor-a")
    expect(filtrado.map((i) => i.itemId)).toEqual(["1", "3"])
  })

  it("filtro com um vendedorId que nao existe devolve lista vazia", () => {
    expect(filtrarPorVendedor(itens, "vendedor-inexistente")).toEqual([])
  })
})

describe("vendedoresDaAgenda", () => {
  it("lista de vendedores: devolve uma opcao por vendedor distinto, ordenada por nome, sem repeticao", () => {
    const itens: AgendaItem[] = [
      item({ itemId: "1", responsavel: "vendedor-b", responsavelNome: "Bruno" }),
      item({ itemId: "2", responsavel: "vendedor-a", responsavelNome: "Ana" }),
      item({ itemId: "3", responsavel: "vendedor-a", responsavelNome: "Ana" }),
    ]

    expect(vendedoresDaAgenda(itens)).toEqual([
      { id: "vendedor-a", nome: "Ana" },
      { id: "vendedor-b", nome: "Bruno" },
    ])
  })

  it("lista de vendedores: ignora itens sem responsavel ou sem nome de responsavel", () => {
    const itens: AgendaItem[] = [
      item({ itemId: "1", responsavel: null, responsavelNome: null }),
      item({ itemId: "2", responsavel: "vendedor-a", responsavelNome: null }),
      item({ itemId: "3", responsavel: null, responsavelNome: "Sem Id" }),
      item({ itemId: "4", responsavel: "vendedor-c", responsavelNome: "Carla" }),
    ]

    expect(vendedoresDaAgenda(itens)).toEqual([{ id: "vendedor-c", nome: "Carla" }])
  })
})
