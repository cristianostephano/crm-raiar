import { describe, expect, it } from "vitest"

import {
  agruparAgenda,
  bucketDoItem,
  filtrarPorVendedor,
  vendedoresDaAgenda,
  INICIO_DA_SEMANA,
  diasDaGradeDoMes,
  diasDaSemana,
  rotulosDosDiasDaSemana,
  navegarData,
  rotuloDoPeriodo,
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
    frequenciaVisita: null,
    proximaDataSugerida: null,
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

/**
 * Camada de calendário (14-01 -> 20-01 Task 1): grade de mês/semana,
 * navegação e rótulos de período. Datas sempre construídas com
 * ano/mês/dia (nunca a partir de string), pelo mesmo motivo que o
 * cabeçalho de lib/agenda/itens.ts documenta para a leitura de dados reais.
 */

describe("INICIO_DA_SEMANA", () => {
  it("vale segunda-feira (1, o codigo do date-fns para segunda)", () => {
    expect(INICIO_DA_SEMANA).toBe(1)
  })
})

describe("diasDaGradeDoMes", () => {
  it("agosto de 2026 (dia 1 cai num sabado): 42 celulas, de 27/07 a 06/09", () => {
    const grade = diasDaGradeDoMes(new Date(2026, 7, 15))

    expect(grade.length).toBe(42)
    expect(grade[0]).toEqual(new Date(2026, 6, 27))
    expect(grade[grade.length - 1]).toEqual(new Date(2026, 8, 6))
  })

  it("o comprimento da grade e sempre multiplo de 7", () => {
    const grade = diasDaGradeDoMes(new Date(2026, 0, 15))

    expect(grade.length % 7).toBe(0)
  })

  it("mes que comeca numa segunda-feira: dia 1 cai na primeira celula, sem semana vazia sobrando", () => {
    // Junho de 2026 comeca numa segunda-feira (01/06/2026).
    const grade = diasDaGradeDoMes(new Date(2026, 5, 10))

    expect(grade[0]).toEqual(new Date(2026, 5, 1))
  })
})

describe("diasDaSemana", () => {
  it("devolve 7 dias de segunda a domingo para uma referencia no meio da semana", () => {
    const dias = diasDaSemana(new Date(2026, 7, 12)) // quarta-feira

    expect(dias.length).toBe(7)
    expect(dias[0]).toEqual(new Date(2026, 7, 10)) // segunda
    expect(dias[6]).toEqual(new Date(2026, 7, 16)) // domingo
  })

  it("devolve os 7 dias corretos quando a referencia cai num domingo", () => {
    const dias = diasDaSemana(new Date(2026, 7, 2)) // domingo

    expect(dias.length).toBe(7)
    expect(dias[0]).toEqual(new Date(2026, 6, 27)) // segunda anterior
    expect(dias[6]).toEqual(new Date(2026, 7, 2)) // o proprio domingo
  })
})

describe("rotulosDosDiasDaSemana", () => {
  it("devolve 7 rotulos curtos comecando em segunda e terminando em domingo, derivados de diasDaSemana", () => {
    expect(rotulosDosDiasDaSemana()).toEqual([
      "Seg",
      "Ter",
      "Qua",
      "Qui",
      "Sex",
      "Sab",
      "Dom",
    ])
  })
})

describe("navegarData", () => {
  it("modo dia: avanca exatamente um dia", () => {
    expect(navegarData(new Date(2026, 7, 8), "dia", 1)).toEqual(
      new Date(2026, 7, 9)
    )
  })

  it("modo dia: volta exatamente um dia", () => {
    expect(navegarData(new Date(2026, 7, 8), "dia", -1)).toEqual(
      new Date(2026, 7, 7)
    )
  })

  it("modo semana: avanca exatamente sete dias", () => {
    expect(navegarData(new Date(2026, 7, 8), "semana", 1)).toEqual(
      new Date(2026, 7, 15)
    )
  })

  it("modo semana: volta exatamente sete dias", () => {
    expect(navegarData(new Date(2026, 7, 8), "semana", -1)).toEqual(
      new Date(2026, 7, 1)
    )
  })

  it("modo mes: avanca um mes", () => {
    expect(navegarData(new Date(2026, 6, 15), "mes", 1)).toEqual(
      new Date(2026, 7, 15)
    )
  })

  it("modo mes: 31 de janeiro avanca para o ultimo dia de fevereiro (comportamento de aparar do date-fns, pinado)", () => {
    expect(navegarData(new Date(2026, 0, 31), "mes", 1)).toEqual(
      new Date(2026, 1, 28)
    )
  })
})

describe("rotuloDoPeriodo", () => {
  it("modo mes: nome do mes com inicial maiuscula, 'de', e o ano", () => {
    expect(rotuloDoPeriodo(new Date(2026, 7, 1), "mes")).toBe("Agosto de 2026")
  })

  it("modo dia: dia da semana por extenso, dia, mes por extenso e ano, com inicial maiuscula", () => {
    expect(rotuloDoPeriodo(new Date(2026, 7, 14), "dia")).toBe(
      "Sexta-feira, 14 de agosto de 2026"
    )
  })

  it("modo semana: primeiro e ultimo dia no mesmo mes usa so o numero do primeiro", () => {
    expect(rotuloDoPeriodo(new Date(2026, 7, 5), "semana")).toBe(
      "3 - 9 de agosto de 2026"
    )
  })

  it("modo semana: atravessando meses usa os dois dias por extenso, ano so no fim", () => {
    expect(rotuloDoPeriodo(new Date(2026, 6, 30), "semana")).toBe(
      "27 de julho - 2 de agosto de 2026"
    )
  })
})
