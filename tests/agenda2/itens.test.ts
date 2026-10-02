import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { differenceInCalendarDays, parseISO } from "date-fns"

import { chaveDoDia, filtrarPorVendedor } from "../../lib/agenda/itens"
import {
  agruparAgenda2,
  agruparPorDataAgenda2,
  dividirCelulaAgenda2,
  estaAtrasadoAgenda2,
  existeItemParecido,
  intervaloVisivelAgenda2,
  itensDaListaAgenda2,
  itensDoDiaAgenda2,
  vendedoresDaAgenda2,
  visivelNaListaAgenda2,
  type Agenda2Item,
} from "../../lib/agenda2/itens"
import { INTERVALO_HISTORICO_MAX_DIAS } from "../../lib/validations/agenda"

/**
 * Unit tests for the pure Lista layer of Agenda 2 (31-02 Tarefa 1). Puro,
 * sem Supabase, sem render — todo caso fixa `now` explicitamente, mesmo
 * convencao de tests/agenda/itens.test.ts.
 *
 * Relogio fixado com o construtor numerico LOCAL (ano, mes, dia, hora) —
 * nunca a partir de texto. "Hoje" = 2026-09-28 10:00 local.
 */

const NOW = new Date(2026, 8, 28, 10, 0) // 2026-09-28 10:00 local

function item(overrides: Partial<Agenda2Item> = {}): Agenda2Item {
  return {
    id: "item-1",
    nomeCliente: "Cliente Teste",
    bairro: "Centro",
    data: "2026-09-28",
    concluido: false,
    // 13:00 UTC = 10:00 em America/Sao_Paulo (UTC-3), mesmo dia local do
    // relogio fixado acima.
    atualizadoEm: "2026-09-28T13:00:00+00:00",
    responsavel: "vendedor-a",
    responsavelNome: "Ana Vendedora",
    ...overrides,
  }
}

describe("agruparAgenda2", () => {
  it("agrupa-tres-secoes", () => {
    const itens: Agenda2Item[] = [
      item({ id: "a", data: "2026-09-27" }),
      item({ id: "b", data: "2026-09-28" }),
      item({ id: "c", data: "2026-09-29" }),
    ]

    const agrupado = agruparAgenda2(itens, NOW)

    expect(agrupado.atrasado.map((i) => i.id)).toEqual(["a"])
    expect(agrupado.hoje.map((i) => i.id)).toEqual(["b"])
    expect(agrupado.proximos.map((i) => i.id)).toEqual(["c"])
  })

  it("proximos-sem-horizonte", () => {
    const itens: Agenda2Item[] = [item({ id: "distante", data: "2027-06-01" })]

    const agrupado = agruparAgenda2(itens, NOW)

    expect(agrupado.proximos.map((i) => i.id)).toEqual(["distante"])
  })

  it("particao-verdadeira", () => {
    const itens: Agenda2Item[] = [
      item({ id: "1", data: "2026-09-01" }),
      item({ id: "2", data: "2026-09-27" }),
      item({ id: "3", data: "2026-09-28" }),
      item({ id: "4", data: "2026-09-28" }),
      item({ id: "5", data: "2026-10-30" }),
    ]

    const agrupado = agruparAgenda2(itens, NOW)
    const total =
      agrupado.atrasado.length + agrupado.hoje.length + agrupado.proximos.length

    expect(total).toBe(itens.length)
  })

  it("preserva-ordem", () => {
    const itens: Agenda2Item[] = [
      item({ id: "B", data: "2026-09-29" }),
      item({ id: "A", data: "2026-09-29" }),
      item({ id: "C", data: "2026-09-29" }),
    ]

    const agrupado = agruparAgenda2(itens, NOW)

    expect(agrupado.proximos.map((i) => i.id)).toEqual(["B", "A", "C"])
  })
})

describe("visivelNaListaAgenda2", () => {
  it("visivel-pendente-passado", () => {
    const pendente = item({ data: "2026-09-20", concluido: false })

    expect(visivelNaListaAgenda2(pendente, NOW)).toBe(true)
  })

  it("visivel-concluido-hoje-e-futuro", () => {
    const concluidoHoje = item({ data: "2026-09-28", concluido: true })
    const concluidoFuturo = item({ data: "2026-10-02", concluido: true })

    expect(visivelNaListaAgenda2(concluidoHoje, NOW)).toBe(true)
    expect(visivelNaListaAgenda2(concluidoFuturo, NOW)).toBe(true)
  })

  it("oculto-concluido-de-dia-passado", () => {
    const concluidoPassado = item({
      data: "2026-09-27",
      concluido: true,
      atualizadoEm: "2026-09-27T20:00:00+00:00",
    })

    expect(visivelNaListaAgenda2(concluidoPassado, NOW)).toBe(false)
  })

  it("visivel-concluido-passado-alterado-hoje", () => {
    const concluidoAlteradoHoje = item({
      data: "2026-09-20",
      concluido: true,
      atualizadoEm: "2026-09-28T13:00:00+00:00",
    })

    expect(visivelNaListaAgenda2(concluidoAlteradoHoje, NOW)).toBe(true)
  })
})

describe("itensDaListaAgenda2", () => {
  it("itens-da-lista-filtra-e-preserva-ordem", () => {
    const visivel1 = item({ id: "1", data: "2026-09-20", concluido: false })
    const oculto = item({
      id: "2",
      data: "2026-09-27",
      concluido: true,
      atualizadoEm: "2026-09-27T20:00:00+00:00",
    })
    const visivel2 = item({ id: "3", data: "2026-09-29", concluido: false })
    const itens: Agenda2Item[] = [visivel1, oculto, visivel2]

    const resultado = itensDaListaAgenda2(itens, NOW)

    expect(resultado.map((i) => i.id)).toEqual(["1", "3"])
  })
})

describe("vendedoresDaAgenda2", () => {
  it("vendedores-distintos", () => {
    const itens: Agenda2Item[] = [
      item({ id: "1", responsavel: "v2", responsavelNome: "Bruno Lima" }),
      item({ id: "2", responsavel: "v1", responsavelNome: "Ana Souza" }),
      item({ id: "3", responsavel: "v2", responsavelNome: "Bruno Lima" }),
      item({ id: "4", responsavel: null, responsavelNome: null }),
    ]

    expect(vendedoresDaAgenda2(itens)).toEqual([
      { id: "v1", nome: "Ana Souza" },
      { id: "v2", nome: "Bruno Lima" },
    ])
  })
})

describe("filtrarPorVendedor aplicado a Agenda2Item (D-17)", () => {
  it("filtro-reusa-filtrarPorVendedor", () => {
    const itens: Agenda2Item[] = [
      item({ id: "1", responsavel: "v1" }),
      item({ id: "2", responsavel: "v2" }),
      item({ id: "3", responsavel: "v1" }),
    ]

    expect(filtrarPorVendedor(itens, "v1").map((i) => i.id)).toEqual([
      "1",
      "3",
    ])
    expect(filtrarPorVendedor(itens, null)).toEqual(itens)
  })
})

describe("existeItemParecido", () => {
  const existente = item({
    id: "existente",
    nomeCliente: "Mercado Bom Preço",
    data: "2026-10-01",
  })

  it("parecido-ignora-caixa-e-espacos", () => {
    const candidato = { nomeCliente: "  mercado   bom preço ", data: "2026-10-01" }

    expect(existeItemParecido([existente], candidato)).toBe(true)
  })

  it("parecido-data-diferente", () => {
    const candidato = { nomeCliente: "Mercado Bom Preço", data: "2026-10-02" }

    expect(existeItemParecido([existente], candidato)).toBe(false)
  })

  it("parecido-nome-diferente", () => {
    const candidato = { nomeCliente: "Mercado Bom Preço 2", data: "2026-10-01" }

    expect(existeItemParecido([existente], candidato)).toBe(false)
  })

  it("parecido-ignora-o-proprio", () => {
    const candidato = { nomeCliente: "Mercado Bom Preço", data: "2026-10-01" }

    expect(existeItemParecido([existente], candidato, "existente")).toBe(false)

    const outroIgual = item({
      id: "outro",
      nomeCliente: "Mercado Bom Preço",
      data: "2026-10-01",
    })

    expect(
      existeItemParecido([existente, outroIgual], candidato, "existente")
    ).toBe(true)
  })
})

describe("fonte-sem-data-propria", () => {
  it("fonte-sem-data-propria", () => {
    const fonte = readFileSync(
      path.join(__dirname, "../../lib/agenda2/itens.ts"),
      "utf8"
    )

    expect(fonte).toContain('from "@/lib/agenda/itens"')
    expect(fonte).not.toContain("differenceInCalendarDays")
    expect(fonte).not.toContain("parseISO")
    // Nenhuma chamada do construtor de data com argumento (new Date(texto)) —
    // só o default param `now: Date = new Date()`, sem nada dentro dos parenteses.
    expect(fonte).not.toMatch(/new Date\([^)]+\)/)
    // O metodo de ordenacao de array aparece no maximo uma vez (dentro de
    // vendedoresDaAgenda2, para as opcoes do filtro).
    const chamadasDeSort = fonte.match(/\.sort\(/g) ?? []
    expect(chamadasDeSort.length).toBeLessThanOrEqual(1)
  })
})

/**
 * Calendario da Agenda 2 (32-02 Tarefa 1, AGD2-08) — copias tipadas das
 * funcoes de calendario da Agenda atual (D-27). Relogio fixado em
 * 14/08/2026 (sexta-feira), 10:00 local, com o construtor numerico.
 */
const NOW_CAL = new Date(2026, 7, 14, 10, 0)

describe("estaAtrasadoAgenda2", () => {
  it("pendente-de-ontem-e-atrasado", () => {
    expect(
      estaAtrasadoAgenda2(item({ data: "2026-08-13", concluido: false }), NOW_CAL)
    ).toBe(true)
  })

  it("concluido-nunca-e-atrasado (D-29)", () => {
    expect(
      estaAtrasadoAgenda2(item({ data: "2026-08-13", concluido: true }), NOW_CAL)
    ).toBe(false)
  })

  it("pendente-de-hoje-e-do-futuro-nao-e-atrasado", () => {
    expect(
      estaAtrasadoAgenda2(item({ data: "2026-08-14", concluido: false }), NOW_CAL)
    ).toBe(false)
    expect(
      estaAtrasadoAgenda2(item({ data: "2026-08-20", concluido: false }), NOW_CAL)
    ).toBe(false)
  })
})

describe("agruparPorDataAgenda2", () => {
  it("chave-e-a-data-verbatim-e-ordem-preservada", () => {
    const itens = [
      item({ id: "zeta", nomeCliente: "Zeta", data: "2026-08-14" }),
      item({ id: "alfa", nomeCliente: "Alfa", data: "2026-08-14" }),
      item({ id: "beta", nomeCliente: "Beta", data: "2026-08-14" }),
    ]

    const porData = agruparPorDataAgenda2(itens)

    expect(Array.from(porData.keys())).toEqual(["2026-08-14"])
    expect(porData.get("2026-08-14")?.map((i) => i.id)).toEqual([
      "zeta",
      "alfa",
      "beta",
    ])
  })

  it("soma-dos-tamanhos-igual-a-entrada", () => {
    const itens = [
      item({ id: "1", data: "2026-08-14" }),
      item({ id: "2", data: "2026-08-15" }),
      item({ id: "3", data: "2026-08-14" }),
    ]

    const porData = agruparPorDataAgenda2(itens)
    const total = Array.from(porData.values()).reduce((s, l) => s + l.length, 0)

    expect(total).toBe(itens.length)
  })

  it("lista-vazia-gera-mapa-vazio", () => {
    expect(agruparPorDataAgenda2([]).size).toBe(0)
  })
})

describe("itensDoDiaAgenda2", () => {
  it("dia-sem-itens-devolve-lista-vazia", () => {
    const porData = agruparPorDataAgenda2([item({ data: "2026-08-14" })])

    expect(itensDoDiaAgenda2(porData, new Date(2026, 7, 15))).toEqual([])
  })

  it("dia-com-itens-devolve-a-lista-do-mapa", () => {
    const itens = [item({ id: "a", data: "2026-08-14" })]
    const porData = agruparPorDataAgenda2(itens)
    const dia = new Date(2026, 7, 14)

    expect(itensDoDiaAgenda2(porData, dia)).toBe(porData.get(chaveDoDia(dia)))
  })
})

describe("dividirCelulaAgenda2", () => {
  const cinco = ["1", "2", "3", "4", "5"].map((id) => item({ id }))

  it("padrao-tres-visiveis-e-excedente", () => {
    const { visiveis, excedente } = dividirCelulaAgenda2(cinco)

    expect(visiveis).toHaveLength(3)
    expect(excedente).toBe(2)
  })

  it("tres-itens-nao-tem-excedente", () => {
    const { visiveis, excedente } = dividirCelulaAgenda2(cinco.slice(0, 3))

    expect(visiveis).toHaveLength(3)
    expect(excedente).toBe(0)
  })

  it("maximo-explicito", () => {
    const { visiveis, excedente } = dividirCelulaAgenda2(cinco, 1)

    expect(visiveis).toHaveLength(1)
    expect(excedente).toBe(4)
  })
})

describe("intervaloVisivelAgenda2", () => {
  it("mes-agosto-2026", () => {
    expect(intervaloVisivelAgenda2(new Date(2026, 7, 14), "mes")).toEqual({
      inicio: "2026-07-27",
      fim: "2026-09-06",
    })
  })

  it("mes-setembro-2026", () => {
    expect(intervaloVisivelAgenda2(new Date(2026, 8, 10), "mes")).toEqual({
      inicio: "2026-08-31",
      fim: "2026-10-04",
    })
  })

  it("semana-de-segunda-a-domingo", () => {
    const esperado = { inicio: "2026-08-10", fim: "2026-08-16" }

    expect(intervaloVisivelAgenda2(new Date(2026, 7, 14), "semana")).toEqual(
      esperado
    )
    // Domingo 16/08 continua na mesma semana (segunda 10 a domingo 16).
    expect(intervaloVisivelAgenda2(new Date(2026, 7, 16), "semana")).toEqual(
      esperado
    )
  })

  it("dia-e-um-so-dia", () => {
    expect(intervaloVisivelAgenda2(new Date(2026, 7, 14), "dia")).toEqual({
      inicio: "2026-08-14",
      fim: "2026-08-14",
    })
  })

  it("futuro-nao-e-aparado", () => {
    const { inicio, fim } = intervaloVisivelAgenda2(new Date(2026, 11, 10), "mes")

    expect(inicio).toBe("2026-11-30")
    expect(fim).toBe("2027-01-03")
  })

  it("grade-cabe-no-teto", () => {
    for (let ano = 2026; ano <= 2027; ano++) {
      for (let mes = 0; mes < 12; mes++) {
        const { inicio, fim } = intervaloVisivelAgenda2(new Date(ano, mes, 1), "mes")
        const dias = differenceInCalendarDays(parseISO(fim), parseISO(inicio))

        expect(dias).toBeLessThanOrEqual(INTERVALO_HISTORICO_MAX_DIAS)
      }
    }
  })
})
