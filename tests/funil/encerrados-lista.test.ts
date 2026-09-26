import { describe, expect, it } from "vitest"

import {
  MOTIVO_ENCERRAMENTO_AUSENTE,
  PERIODO_PADRAO_ENCERRADOS,
  PERIODO_PRESETS_ENCERRADOS,
  filtrarEncerradosPorNome,
  resolvePeriodoEncerrados,
  temRecortePeriodoEncerrados,
  validarPeriodoEncerrados,
  type ClienteEncerrado,
} from "@/lib/encerrados/lista"

/**
 * Testes unitários puros da camada de dados da tela Encerrados (Fase 29
 * Plano 5) — sem Supabase, sem next/headers. Casos batem com o bloco
 * <behavior> do 29-05-PLAN.md: presets, tudo, 30dias, 90dias, personalizado,
 * personalizado-sem-intervalo, recorte, validacao, busca. Módulo irmão de
 * lib/perdidos/lista.ts (Pitfall 4 da pesquisa) — não importa nada de lá.
 */

describe("PERIODO_PRESETS_ENCERRADOS (presets)", () => {
  it("tem exatamente os 4 presets, nesta ordem", () => {
    expect(PERIODO_PRESETS_ENCERRADOS).toEqual([
      { value: "tudo", label: "Tudo" },
      { value: "30dias", label: "Últimos 30 dias" },
      { value: "90dias", label: "Últimos 90 dias" },
      { value: "personalizado", label: "Personalizado" },
    ])
  })

  it("o preset padrão é 'tudo'", () => {
    expect(PERIODO_PADRAO_ENCERRADOS).toBe("tudo")
  })
})

describe("resolvePeriodoEncerrados", () => {
  it("tudo: devolve inicio e fim nulos, sem recorte", () => {
    expect(resolvePeriodoEncerrados("tudo")).toEqual({ inicio: null, fim: null })
  })

  it("30dias: janela móvel de 30 dias atrás sem limite superior", () => {
    const agora = new Date(2026, 8, 26, 15, 0, 0)
    const resultado = resolvePeriodoEncerrados("30dias", undefined, agora)

    expect(resultado).toEqual({
      inicio: new Date(2026, 7, 27, 15, 0, 0).toISOString(),
      fim: null,
    })
  })

  it("90dias: janela móvel de 90 dias atrás sem limite superior", () => {
    const agora = new Date(2026, 8, 26, 15, 0, 0)
    const resultado = resolvePeriodoEncerrados("90dias", undefined, agora)

    expect(resultado).toEqual({
      inicio: new Date(2026, 5, 28, 15, 0, 0).toISOString(),
      fim: null,
    })
  })

  it("personalizado: recorta do início do primeiro dia ao fim do último dia (limite superior exclusivo no banco)", () => {
    const from = new Date(2026, 8, 1, 14, 30)
    const to = new Date(2026, 8, 10, 9, 0)
    const resultado = resolvePeriodoEncerrados("personalizado", { from, to })

    expect(resultado).toEqual({
      inicio: new Date(2026, 8, 1).toISOString(),
      fim: new Date(2026, 8, 11).toISOString(),
    })
  })

  it("personalizado-sem-intervalo: sem custom, devolve nulos", () => {
    expect(resolvePeriodoEncerrados("personalizado")).toEqual({
      inicio: null,
      fim: null,
    })
  })
})

describe("temRecortePeriodoEncerrados (recorte)", () => {
  it("tudo nunca tem recorte", () => {
    expect(temRecortePeriodoEncerrados("tudo")).toBe(false)
  })

  it("30dias sempre tem recorte", () => {
    expect(temRecortePeriodoEncerrados("30dias")).toBe(true)
  })

  it("90dias sempre tem recorte", () => {
    expect(temRecortePeriodoEncerrados("90dias")).toBe(true)
  })

  it("personalizado com intervalo tem recorte", () => {
    expect(
      temRecortePeriodoEncerrados("personalizado", {
        from: new Date(2026, 8, 1),
        to: new Date(2026, 8, 10),
      })
    ).toBe(true)
  })

  it("personalizado sem intervalo não tem recorte", () => {
    expect(temRecortePeriodoEncerrados("personalizado")).toBe(false)
  })
})

describe("validarPeriodoEncerrados (validacao)", () => {
  it("inicio e fim nulos é válido", () => {
    expect(validarPeriodoEncerrados({ inicio: null, fim: null })).toEqual({
      valido: true,
      intervalo: { inicio: null, fim: null },
    })
  })

  it("inicio ISO válido e fim nulo é válido e devolve o mesmo intervalo", () => {
    const inicio = "2026-09-01T03:00:00.000Z"
    expect(validarPeriodoEncerrados({ inicio, fim: null })).toEqual({
      valido: true,
      intervalo: { inicio, fim: null },
    })
  })

  it("entrada sem as chaves ({}) é válida, normalizada para nulos", () => {
    expect(validarPeriodoEncerrados({})).toEqual({
      valido: true,
      intervalo: { inicio: null, fim: null },
    })
  })

  it("inicio 'nao-e-data' é inválido", () => {
    const resultado = validarPeriodoEncerrados({ inicio: "nao-e-data", fim: null })
    expect(resultado.valido).toBe(false)
  })

  it("inicio maior ou igual ao fim é inválido", () => {
    const resultado = validarPeriodoEncerrados({
      inicio: "2026-09-10T00:00:00.000Z",
      fim: "2026-09-01T00:00:00.000Z",
    })
    expect(resultado.valido).toBe(false)
  })

  it("entrada null é inválida", () => {
    expect(validarPeriodoEncerrados(null).valido).toBe(false)
  })

  it("entrada número é inválida", () => {
    expect(validarPeriodoEncerrados(42).valido).toBe(false)
  })

  it("entrada texto é inválida", () => {
    expect(validarPeriodoEncerrados("qualquer coisa").valido).toBe(false)
  })

  it("inicio número (não texto) é inválido", () => {
    const resultado = validarPeriodoEncerrados({ inicio: 123456, fim: null })
    expect(resultado.valido).toBe(false)
  })
})

describe("filtrarEncerradosPorNome (busca)", () => {
  const lista: ClienteEncerrado[] = [
    {
      clienteId: "c1",
      razaoSocial: "Padaria Central Ltda",
      nomeFantasia: null,
      motivoEncerramentoNome: "Fechou a loja",
      encerradoEm: "2026-09-10T15:00:00+00:00",
      responsavel: "v1",
      responsavelNome: "Ana Souza",
    },
    {
      clienteId: "c2",
      razaoSocial: null,
      nomeFantasia: "Mercado Bom Preço",
      motivoEncerramentoNome: null,
      encerradoEm: "2026-09-05T12:00:00+00:00",
      responsavel: "v2",
      responsavelNome: "João Lima",
    },
  ]

  it("busca vazia devolve a lista inteira", () => {
    expect(filtrarEncerradosPorNome(lista, "")).toEqual(lista)
  })

  it("busca só com espaços devolve a lista inteira", () => {
    expect(filtrarEncerradosPorNome(lista, "   ")).toEqual(lista)
  })

  it("encontra pela razão social, sem diferenciar maiúsculas", () => {
    const resultado = filtrarEncerradosPorNome(lista, "PADARIA")
    expect(resultado).toEqual([lista[0]])
  })

  it("cliente sem razão social é encontrado pelo Nome Fantasia", () => {
    const resultado = filtrarEncerradosPorNome(lista, "bom preço")
    expect(resultado).toEqual([lista[1]])
  })

  it("termo sem correspondência devolve lista vazia", () => {
    expect(filtrarEncerradosPorNome(lista, "inexistente")).toEqual([])
  })

  it("não altera a lista de entrada", () => {
    const copia = [...lista]
    filtrarEncerradosPorNome(lista, "padaria")
    expect(lista).toEqual(copia)
  })
})

describe("MOTIVO_ENCERRAMENTO_AUSENTE", () => {
  it("é o texto único para motivo ausente", () => {
    expect(MOTIVO_ENCERRAMENTO_AUSENTE).toBe("Motivo não informado")
  })
})
