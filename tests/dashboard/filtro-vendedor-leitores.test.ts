import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Testes da regra pura do vendedor e dos leitores do Dashboard com o recorte
 * opcional p_vendedor (quick 261009-npp). Mocka "@/lib/supabase/server" com
 * rpc e from encadeavel (nenhum banco real e tocado).
 *
 * "Todos" (sem vendedor) mantem as chamadas IDENTICAS as de hoje: sem segundo
 * argumento nas 3 leituras sem periodo, so { p_inicio, p_fim } nas outras. A
 * validacao do id e higiene de entrada, nao autorizacao: quem decide o que cada
 * pessoa ve e a RLS do banco.
 */
const { rpcSpy, fromSpy, selectSpy, eqSpy, orderSpy } = vi.hoisted(() => ({
  rpcSpy: vi.fn(),
  fromSpy: vi.fn(),
  selectSpy: vi.fn(),
  eqSpy: vi.fn(),
  orderSpy: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: rpcSpy,
    from: fromSpy,
  }),
}))

import { normalizarVendedorFiltro } from "@/lib/dashboard/vendedorFiltro"
import {
  getClientesPorEtapa,
  getComparativoVendedor,
  getDesempenhoVendedor,
  getFunilDetalhado,
  getGanhosPerdidos,
  getProspeccaoPorCategoria,
  getProspeccaoPorProduto,
  getTempoAteFechamento,
  getVendedoresAtivosFiltro,
} from "@/lib/supabase/queries/dashboard"

const ID = "123e4567-e89b-12d3-a456-426614174000"
const INICIO = new Date("2026-10-01T00:00:00.000Z")
const FIM = new Date("2026-11-01T00:00:00.000Z")
const PERIODO = { p_inicio: INICIO.toISOString(), p_fim: FIM.toISOString() }

beforeEach(() => {
  rpcSpy.mockReset()
  rpcSpy.mockResolvedValue({ data: [], error: null })
  fromSpy.mockReset()
  selectSpy.mockReset()
  eqSpy.mockReset()
  orderSpy.mockReset()
  const cadeia = { select: selectSpy, eq: eqSpy, order: orderSpy }
  fromSpy.mockReturnValue(cadeia)
  selectSpy.mockReturnValue(cadeia)
  eqSpy.mockReturnValue(cadeia)
})

describe("filtro-vendedor-leitores: regra pura", () => {
  it("regra-vazio-e-todos", () => {
    for (const valor of [null, undefined, "", "   "]) {
      expect(normalizarVendedorFiltro(valor)).toEqual({ ok: true, vendedorId: null })
    }
  })

  it("regra-uuid-valido", () => {
    const minusculo = "123e4567-e89b-12d3-a456-426614174000"
    const maiusculo = "123E4567-E89B-12D3-A456-426614174000"
    expect(normalizarVendedorFiltro(minusculo)).toEqual({ ok: true, vendedorId: minusculo })
    expect(normalizarVendedorFiltro(maiusculo)).toEqual({ ok: true, vendedorId: maiusculo })
  })

  it("regra-invalido", () => {
    for (const valor of [
      "abc",
      "123",
      "123e4567-e89b-12d3-a456-4266141740000",
      "x'; drop table clientes;--",
    ]) {
      expect(normalizarVendedorFiltro(valor)).toEqual({ ok: false })
    }
  })
})

describe("filtro-vendedor-leitores: leitores com p_vendedor opcional", () => {
  it("leitores-sem-vendedor-chamada-de-hoje", async () => {
    await getClientesPorEtapa()
    await getFunilDetalhado()
    await getTempoAteFechamento()
    await getClientesPorEtapa(null)
    await getFunilDetalhado(null)
    await getTempoAteFechamento(null)

    const semPeriodo = [
      "dashboard_clientes_por_etapa",
      "dashboard_funil_detalhado",
      "dashboard_tempo_ate_fechamento",
    ]
    for (let i = 0; i < 6; i += 1) {
      expect(rpcSpy.mock.calls[i]).toEqual([semPeriodo[i % 3]])
      expect(rpcSpy.mock.calls[i].length).toBe(1)
    }

    rpcSpy.mockClear()
    await getGanhosPerdidos(INICIO, FIM)
    await getProspeccaoPorProduto(INICIO, FIM)
    await getProspeccaoPorCategoria(INICIO, FIM)
    await getGanhosPerdidos(INICIO, FIM, null)
    await getProspeccaoPorProduto(INICIO, FIM, null)
    await getProspeccaoPorCategoria(INICIO, FIM, null)

    const comPeriodo = [
      "dashboard_ganhos_perdidos",
      "dashboard_prospeccao_por_produto",
      "dashboard_prospeccao_por_categoria",
    ]
    for (let i = 0; i < 6; i += 1) {
      expect(rpcSpy.mock.calls[i][0]).toBe(comPeriodo[i % 3])
      expect(rpcSpy.mock.calls[i][1]).toEqual(PERIODO)
      expect(Object.keys(rpcSpy.mock.calls[i][1] as object)).not.toContain("p_vendedor")
    }
  })

  it("leitores-com-vendedor", async () => {
    await getClientesPorEtapa(ID)
    await getFunilDetalhado(ID)
    await getTempoAteFechamento(ID)
    expect(rpcSpy.mock.calls).toEqual([
      ["dashboard_clientes_por_etapa", { p_vendedor: ID }],
      ["dashboard_funil_detalhado", { p_vendedor: ID }],
      ["dashboard_tempo_ate_fechamento", { p_vendedor: ID }],
    ])

    rpcSpy.mockClear()
    await getGanhosPerdidos(INICIO, FIM, ID)
    await getProspeccaoPorProduto(INICIO, FIM, ID)
    await getProspeccaoPorCategoria(INICIO, FIM, ID)
    expect(rpcSpy.mock.calls).toEqual([
      ["dashboard_ganhos_perdidos", { ...PERIODO, p_vendedor: ID }],
      ["dashboard_prospeccao_por_produto", { ...PERIODO, p_vendedor: ID }],
      ["dashboard_prospeccao_por_categoria", { ...PERIODO, p_vendedor: ID }],
    ])
  })

  it("comparacoes-inalteradas", async () => {
    await getDesempenhoVendedor(INICIO, FIM)
    await getComparativoVendedor()
    expect(rpcSpy.mock.calls).toEqual([
      ["dashboard_desempenho_vendedor", PERIODO],
      ["dashboard_comparativo_vendedor"],
    ])
  })

  it("vendedores-ativos", async () => {
    orderSpy.mockResolvedValue({
      data: [
        { id: "id-1", nome: "Alice", sobrenome: "Teste" },
        { id: "id-2", nome: "Bruno", sobrenome: "" },
        { id: "id-3", nome: "Carla", sobrenome: null },
      ],
      error: null,
    })

    const lista = await getVendedoresAtivosFiltro()

    expect(fromSpy).toHaveBeenCalledWith("profiles")
    expect(selectSpy).toHaveBeenCalledWith("id, nome, sobrenome")
    expect(eqSpy).toHaveBeenCalledWith("role", "vendedor")
    expect(eqSpy).toHaveBeenCalledWith("ativo", true)
    expect(orderSpy).toHaveBeenCalledWith("nome", { ascending: true })
    expect(lista).toEqual([
      { id: "id-1", nome: "Alice Teste" },
      { id: "id-2", nome: "Bruno" },
      { id: "id-3", nome: "Carla" },
    ])

    orderSpy.mockResolvedValue({ data: null, error: { message: "falha simulada" } })
    await expect(getVendedoresAtivosFiltro()).rejects.toThrow()
  })
})
