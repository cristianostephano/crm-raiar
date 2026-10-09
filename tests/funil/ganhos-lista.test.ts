import { describe, expect, it } from "vitest"

import {
  DATA_GANHO_AUSENTE,
  PERIODO_PADRAO_GANHOS,
  PERIODO_PRESETS_GANHOS,
  filtrarGanhosPorNome,
  resolvePeriodoGanhos,
  temRecortePeriodoGanhos,
  validarPeriodoGanhos,
  type ClienteGanho,
} from "@/lib/ganhos/lista"

/**
 * Testes unitarios puros da camada de dados da tela Ganhos (quick
 * 261008-rxw) - sem Supabase, sem next/headers. Irma deliberada de
 * lib/perdidos/lista.ts: mesmos presets, mesma resolucao de periodo, mesma
 * validacao e mesma busca; a diferenca e a data (ganhoEm, "AAAA-MM-DD" ou
 * nulo) e a constante DATA_GANHO_AUSENTE.
 */

describe("PERIODO_PRESETS_GANHOS (presets)", () => {
  it("tem exatamente os 4 presets, nesta ordem", () => {
    expect(PERIODO_PRESETS_GANHOS).toEqual([
      { value: "tudo", label: "Tudo" },
      { value: "30dias", label: "Últimos 30 dias" },
      { value: "90dias", label: "Últimos 90 dias" },
      { value: "personalizado", label: "Personalizado" },
    ])
  })

  it("o preset padrão é 'tudo'", () => {
    expect(PERIODO_PADRAO_GANHOS).toBe("tudo")
  })
})

describe("resolvePeriodoGanhos", () => {
  it("tudo: devolve inicio e fim nulos, sem recorte", () => {
    expect(resolvePeriodoGanhos("tudo")).toEqual({ inicio: null, fim: null })
  })

  it("30dias: janela móvel de 30 dias atrás sem limite superior", () => {
    const agora = new Date(2026, 8, 25, 15, 0, 0)
    expect(resolvePeriodoGanhos("30dias", undefined, agora)).toEqual({
      inicio: new Date(2026, 7, 26, 15, 0, 0).toISOString(),
      fim: null,
    })
  })

  it("90dias: janela móvel de 90 dias atrás sem limite superior", () => {
    const agora = new Date(2026, 8, 25, 15, 0, 0)
    expect(resolvePeriodoGanhos("90dias", undefined, agora)).toEqual({
      inicio: new Date(2026, 5, 27, 15, 0, 0).toISOString(),
      fim: null,
    })
  })

  it("personalizado: do início do primeiro dia à meia-noite do dia seguinte ao último (fim exclusivo)", () => {
    const from = new Date(2026, 8, 1, 14, 30)
    const to = new Date(2026, 8, 10, 9, 0)
    expect(resolvePeriodoGanhos("personalizado", { from, to })).toEqual({
      inicio: new Date(2026, 8, 1).toISOString(),
      fim: new Date(2026, 8, 11).toISOString(),
    })
  })

  it("personalizado-sem-intervalo: sem custom, devolve nulos", () => {
    expect(resolvePeriodoGanhos("personalizado")).toEqual({ inicio: null, fim: null })
  })
})

describe("temRecortePeriodoGanhos (recorte)", () => {
  it("tudo nunca tem recorte", () => {
    expect(temRecortePeriodoGanhos("tudo")).toBe(false)
  })

  it("30dias e 90dias sempre têm recorte", () => {
    expect(temRecortePeriodoGanhos("30dias")).toBe(true)
    expect(temRecortePeriodoGanhos("90dias")).toBe(true)
  })

  it("personalizado com intervalo tem recorte; sem intervalo não tem", () => {
    expect(
      temRecortePeriodoGanhos("personalizado", {
        from: new Date(2026, 8, 1),
        to: new Date(2026, 8, 10),
      })
    ).toBe(true)
    expect(temRecortePeriodoGanhos("personalizado")).toBe(false)
  })
})

describe("validarPeriodoGanhos (validacao)", () => {
  it("inicio e fim nulos é válido", () => {
    expect(validarPeriodoGanhos({ inicio: null, fim: null })).toEqual({
      valido: true,
      intervalo: { inicio: null, fim: null },
    })
  })

  it("inicio ISO válido e fim nulo é válido e devolve o mesmo intervalo", () => {
    const inicio = "2026-09-01T03:00:00.000Z"
    expect(validarPeriodoGanhos({ inicio, fim: null })).toEqual({
      valido: true,
      intervalo: { inicio, fim: null },
    })
  })

  it("entrada sem as chaves ({}) é válida, normalizada para nulos", () => {
    expect(validarPeriodoGanhos({})).toEqual({
      valido: true,
      intervalo: { inicio: null, fim: null },
    })
  })

  it("inicio 'nao-e-data' é inválido", () => {
    expect(validarPeriodoGanhos({ inicio: "nao-e-data", fim: null }).valido).toBe(false)
  })

  it("inicio maior ou igual ao fim é inválido, com a mensagem de ordem", () => {
    const resultado = validarPeriodoGanhos({
      inicio: "2026-09-10T00:00:00.000Z",
      fim: "2026-09-01T00:00:00.000Z",
    })
    expect(resultado).toEqual({
      valido: false,
      message: "A data inicial precisa ser anterior à final.",
    })
  })

  it("entradas que não são objeto são inválidas", () => {
    expect(validarPeriodoGanhos(null).valido).toBe(false)
    expect(validarPeriodoGanhos(42).valido).toBe(false)
    expect(validarPeriodoGanhos("qualquer coisa").valido).toBe(false)
  })

  it("inicio número (não texto) é inválido", () => {
    expect(validarPeriodoGanhos({ inicio: 123456, fim: null }).valido).toBe(false)
  })
})

describe("filtrarGanhosPorNome (busca)", () => {
  const lista: ClienteGanho[] = [
    {
      clienteId: "c1",
      razaoSocial: "Padaria Central Ltda",
      nomeFantasia: null,
      ganhoEm: "2026-09-10",
      responsavel: "v1",
      responsavelNome: "Ana Souza",
    },
    {
      clienteId: "c2",
      razaoSocial: null,
      nomeFantasia: "Mercado Bom Preço",
      ganhoEm: null,
      responsavel: "v2",
      responsavelNome: "João Lima",
    },
  ]

  it("busca vazia ou só com espaços devolve a lista inteira", () => {
    expect(filtrarGanhosPorNome(lista, "")).toEqual(lista)
    expect(filtrarGanhosPorNome(lista, "   ")).toEqual(lista)
  })

  it("encontra pela razão social, sem diferenciar maiúsculas", () => {
    expect(filtrarGanhosPorNome(lista, "PADARIA")).toEqual([lista[0]])
  })

  it("cliente sem razão social é encontrado pelo Nome Fantasia", () => {
    expect(filtrarGanhosPorNome(lista, "bom preço")).toEqual([lista[1]])
  })

  it("termo sem correspondência devolve lista vazia", () => {
    expect(filtrarGanhosPorNome(lista, "inexistente")).toEqual([])
  })

  it("não altera a lista de entrada", () => {
    const copia = [...lista]
    filtrarGanhosPorNome(lista, "padaria")
    expect(lista).toEqual(copia)
  })
})

describe("DATA_GANHO_AUSENTE", () => {
  it("é o texto único para data do ganho não informada", () => {
    expect(DATA_GANHO_AUSENTE).toBe("Data não informada")
  })
})
