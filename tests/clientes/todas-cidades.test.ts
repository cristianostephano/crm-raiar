import { describe, expect, it, vi } from "vitest"

/**
 * Unit test for getTodasCidades (quick task 260819-l6o, bug de truncamento
 * em 1000 linhas na tela de Importar clientes) — no database, mocks
 * @/lib/supabase/server inteiramente.
 *
 * vi.mock é içado acima dos imports, então um espião declarado com `const`
 * em escopo de módulo ainda não estaria inicializado quando a fábrica do
 * mock rodar. vi.hoisted() roda seu callback nessa mesma posição içada,
 * dando à fábrica (e ao corpo dos testes abaixo) uma referência
 * compartilhada — mesmo padrão de
 * tests/clientes/cidades-com-clientes-reader.test.ts. O espião fica na
 * ponta `range` da cadeia from -> select -> order -> range.
 */
const { rangeSpy } = vi.hoisted(() => ({ rangeSpy: vi.fn() }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          range: rangeSpy,
        }),
      }),
    }),
  }),
}))

import { cidadeValida } from "@/lib/clientes/cidadeValida"
import {
  TAMANHO_PAGINA_CIDADES,
  getTodasCidades,
} from "@/lib/supabase/queries/cidades"

function gerarCidades(total: number): { nome: string; uf: string }[] {
  return Array.from({ length: total }, (_, i) => ({
    nome: `Cidade ${i}`,
    uf: "XX",
  }))
}

/** Faz o espião de `range` fatiar `dataset` pela faixa recebida, igual ao
 * PostgREST real faria contra a tabela `cidades`. Limpa o histórico de
 * chamadas do espião antes de reconfigurar — os testes deste arquivo
 * compartilham o mesmo `rangeSpy` içado por `vi.hoisted()`, então sem essa
 * limpeza as chamadas de um teste vazariam para a contagem do próximo. */
function simularPaginacao(dataset: { nome: string; uf: string }[]) {
  rangeSpy.mockReset()
  rangeSpy.mockImplementation(async (inicio: number, fim: number) => ({
    data: dataset.slice(inicio, fim + 1),
    error: null,
  }))
}

describe("getTodasCidades (260819-l6o)", () => {
  it("com 5571 linhas simuladas, devolve as 5571 (nunca 1000)", async () => {
    simularPaginacao(gerarCidades(5571))

    const resultado = await getTodasCidades()

    expect(resultado).not.toBeNull()
    expect(resultado).toHaveLength(5571)
  })

  it("com 5571 linhas simuladas, pede exatamente 6 páginas nas faixas (0,999)..(5000,5999)", async () => {
    simularPaginacao(gerarCidades(5571))

    await getTodasCidades()

    expect(rangeSpy).toHaveBeenCalledTimes(6)
    expect(rangeSpy.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [3000, 3999],
      [4000, 4999],
      [5000, 5999],
    ])
  })

  it("uma cidade na posição 5000 (fora das primeiras 1000) é encontrada por cidadeValida", async () => {
    const dataset = gerarCidades(5571)
    dataset[5000] = { nome: "São Paulo", uf: "SP" }
    simularPaginacao(dataset)

    const resultado = await getTodasCidades()

    expect(resultado).not.toBeNull()
    expect(cidadeValida("São Paulo", "SP", resultado!)).toBe(true)
  })

  it("com um total múltiplo exato do tamanho de página, para depois da página vazia sem laço infinito nem repetição", async () => {
    const dataset = gerarCidades(2 * TAMANHO_PAGINA_CIDADES)
    simularPaginacao(dataset)

    const resultado = await getTodasCidades()

    expect(resultado).toHaveLength(2 * TAMANHO_PAGINA_CIDADES)
    expect(rangeSpy).toHaveBeenCalledTimes(3)
  })

  it("se qualquer página devolver erro, o retorno é null — nunca uma lista parcial", async () => {
    const dataset = gerarCidades(2500)
    let chamada = 0
    rangeSpy.mockReset()
    rangeSpy.mockImplementation(async (inicio: number, fim: number) => {
      chamada += 1
      if (chamada === 2) {
        return { data: null, error: { message: "falha simulada" } }
      }
      return { data: dataset.slice(inicio, fim + 1), error: null }
    })

    const resultado = await getTodasCidades()

    expect(resultado).toBeNull()
  })

  it("com zero linhas, devolve lista vazia ([]), não null", async () => {
    simularPaginacao([])

    const resultado = await getTodasCidades()

    expect(resultado).toEqual([])
  })
})
