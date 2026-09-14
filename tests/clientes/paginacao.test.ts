import { describe, expect, it, vi } from "vitest"

import {
  MAX_PAGINAS_PADRAO,
  TAMANHO_PAGINA_PADRAO,
  buscarPaginado,
  type ResultadoPagina,
} from "@/lib/supabase/queries/paginacao"

/**
 * Testes de unidade do paginador genérico (quick task 260914-ng5). Nenhum
 * mock de `@/lib/supabase/server` aqui — `buscarPaginado` recebe a função de
 * busca como parâmetro, então cada teste passa um dublê que fatia um array
 * em memória pela faixa recebida, exatamente como o PostgREST real faria.
 * Mesmo estilo de tests/clientes/todas-cidades.test.ts.
 */

function gerarItens(total: number): { id: number }[] {
  return Array.from({ length: total }, (_, i) => ({ id: i }))
}

function simularBusca<T>(dataset: T[]) {
  return vi.fn(
    async (inicio: number, fim: number): Promise<ResultadoPagina<T>> => ({
      data: dataset.slice(inicio, fim + 1),
      error: null,
    })
  )
}

describe("buscarPaginado (260914-ng5)", () => {
  it("une múltiplas páginas corretamente (2181 itens, página padrão 1000)", async () => {
    const dataset = gerarItens(2181)
    const buscarPagina = simularBusca(dataset)

    const resultado = await buscarPaginado(buscarPagina)

    expect(resultado).not.toBeNull()
    expect(resultado).toHaveLength(2181)
    expect(buscarPagina).toHaveBeenCalledTimes(3)
    expect(buscarPagina.mock.calls[0]).toEqual([0, 999])
    expect(buscarPagina.mock.calls[1]).toEqual([1000, 1999])
    expect(buscarPagina.mock.calls[2]).toEqual([2000, 2999])
  })

  it("para na primeira página menor que o tamanho de página (250 itens)", async () => {
    const dataset = gerarItens(250)
    const buscarPagina = simularBusca(dataset)

    const resultado = await buscarPaginado(buscarPagina)

    expect(resultado).toHaveLength(250)
    expect(buscarPagina).toHaveBeenCalledTimes(1)
  })

  it("com um total múltiplo exato do tamanho de página (2000 itens), pede 3 páginas sem laço infinito nem repetição", async () => {
    const dataset = gerarItens(2 * TAMANHO_PAGINA_PADRAO)
    const buscarPagina = simularBusca(dataset)

    const resultado = await buscarPaginado(buscarPagina)

    expect(resultado).toHaveLength(2 * TAMANHO_PAGINA_PADRAO)
    expect(buscarPagina).toHaveBeenCalledTimes(3)
  })

  it("se qualquer página devolver erro, o resultado inteiro é null — nunca uma lista parcial", async () => {
    const dataset = gerarItens(2500)
    let chamada = 0
    const buscarPagina = vi.fn(async (inicio: number, fim: number) => {
      chamada += 1
      if (chamada === 2) {
        return { data: null, error: { message: "falha simulada" } }
      }
      return { data: dataset.slice(inicio, fim + 1), error: null }
    })

    const resultado = await buscarPaginado(buscarPagina)

    expect(resultado).toBeNull()
  })

  it("com zero itens, devolve lista vazia ([]), nunca null", async () => {
    const buscarPagina = simularBusca<{ id: number }>([])

    const resultado = await buscarPaginado(buscarPagina)

    expect(resultado).toEqual([])
  })

  it("se o teto de páginas for atingido sem página curta, devolve null — nunca lista truncada disfarçada de completa", async () => {
    // dublê que sempre devolve uma página cheia, do tamanho da faixa pedida
    // — nunca sinaliza fim, forçando o teto de segurança a bater.
    const buscarPagina = vi.fn(async (inicio: number, fim: number) => ({
      data: gerarItens(fim - inicio + 1),
      error: null,
    }))

    const resultado = await buscarPaginado(buscarPagina, {
      tamanhoPagina: 10,
      maxPaginas: 3,
    })

    expect(resultado).toBeNull()
    expect(buscarPagina).toHaveBeenCalledTimes(3)
  })

  it("aceita tamanhoPagina e maxPaginas customizados via opções", async () => {
    const dataset = gerarItens(25)
    const buscarPagina = simularBusca(dataset)

    const resultado = await buscarPaginado(buscarPagina, {
      tamanhoPagina: 10,
      maxPaginas: MAX_PAGINAS_PADRAO,
    })

    expect(resultado).toHaveLength(25)
    expect(buscarPagina).toHaveBeenCalledTimes(3)
    expect(buscarPagina.mock.calls).toEqual([
      [0, 9],
      [10, 19],
      [20, 29],
    ])
  })
})
