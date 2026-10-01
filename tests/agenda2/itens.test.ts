import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { filtrarPorVendedor } from "../../lib/agenda/itens"
import {
  agruparAgenda2,
  existeItemParecido,
  itensDaListaAgenda2,
  vendedoresDaAgenda2,
  visivelNaListaAgenda2,
  type Agenda2Item,
} from "../../lib/agenda2/itens"

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
