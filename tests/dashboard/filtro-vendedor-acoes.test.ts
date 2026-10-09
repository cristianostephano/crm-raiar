import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Testes das Server Actions do Dashboard com vendedorId opcional (quick
 * 261009-npp). Mocka a sessao ("@/lib/supabase/server") e os leitores
 * ("@/lib/supabase/queries/dashboard", via importOriginal). A validacao do id
 * e higiene de entrada, nao autorizacao: a RLS decide o que cada um ve.
 */
const { getUserSpy } = vi.hoisted(() => ({ getUserSpy: vi.fn() }))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserSpy } }),
}))

const leitores = vi.hoisted(() => ({
  getClientesPorEtapa: vi.fn(),
  getFunilDetalhado: vi.fn(),
  getTempoAteFechamento: vi.fn(),
  getGanhosPerdidos: vi.fn(),
  getProspeccaoPorProduto: vi.fn(),
  getProspeccaoPorCategoria: vi.fn(),
  getDesempenhoVendedor: vi.fn(),
}))

vi.mock("@/lib/supabase/queries/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/queries/dashboard")>()),
  ...leitores,
}))

import {
  getClientesPorEtapaAction,
  getDesempenhoVendedorAction,
  getFunilDetalhadoAction,
  getGanhosPerdidosAction,
  getProspeccaoPorCategoriaAction,
  getProspeccaoPorProdutoAction,
  getTempoAteFechamentoAction,
} from "@/app/actions/dashboard"

const ID = "123e4567-e89b-12d3-a456-426614174000"
const INICIO = new Date("2026-10-01T00:00:00.000Z")
const FIM = new Date("2026-11-01T00:00:00.000Z")

type Caso = {
  nome: string
  leitor: keyof typeof leitores
  chamar: (vendedor?: string | null) => Promise<{ data?: unknown; error?: { code: string } }>
  comPeriodo: boolean
}

const CASOS: Caso[] = [
  {
    nome: "clientes por etapa",
    leitor: "getClientesPorEtapa",
    chamar: (v) => getClientesPorEtapaAction(v),
    comPeriodo: false,
  },
  {
    nome: "funil detalhado",
    leitor: "getFunilDetalhado",
    chamar: (v) => getFunilDetalhadoAction(v),
    comPeriodo: false,
  },
  {
    nome: "tempo ate fechamento",
    leitor: "getTempoAteFechamento",
    chamar: (v) => getTempoAteFechamentoAction(v),
    comPeriodo: false,
  },
  {
    nome: "ganhos e perdidos",
    leitor: "getGanhosPerdidos",
    chamar: (v) => getGanhosPerdidosAction(INICIO, FIM, v),
    comPeriodo: true,
  },
  {
    nome: "prospeccao por produto",
    leitor: "getProspeccaoPorProduto",
    chamar: (v) => getProspeccaoPorProdutoAction(INICIO, FIM, v),
    comPeriodo: true,
  },
  {
    nome: "prospeccao por categoria",
    leitor: "getProspeccaoPorCategoria",
    chamar: (v) => getProspeccaoPorCategoriaAction(INICIO, FIM, v),
    comPeriodo: true,
  },
]

function esperado(caso: Caso, vendedor: string | null): unknown[] {
  return caso.comPeriodo ? [INICIO, FIM, vendedor] : [vendedor]
}

beforeEach(() => {
  getUserSpy.mockReset()
  getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
  for (const leitor of Object.values(leitores)) {
    leitor.mockReset()
    leitor.mockResolvedValue([])
  }
})

describe("filtro-vendedor-acoes: vendedorId opcional nas 6 Server Actions", () => {
  it("repassa-vendedor", async () => {
    for (const caso of CASOS) {
      const resultado = await caso.chamar(ID)
      expect(resultado, caso.nome).toEqual({ data: [] })
      expect(leitores[caso.leitor], caso.nome).toHaveBeenCalledWith(...esperado(caso, ID))
    }
  })

  it("sem-vendedor-repassa-nulo", async () => {
    for (const caso of CASOS) {
      await caso.chamar()
      expect(leitores[caso.leitor], `${caso.nome} sem argumento`).toHaveBeenLastCalledWith(
        ...esperado(caso, null)
      )
      await caso.chamar(null)
      expect(leitores[caso.leitor], `${caso.nome} com nulo`).toHaveBeenLastCalledWith(
        ...esperado(caso, null)
      )
    }
  })

  it("vendedor-invalido-nao-chama-banco", async () => {
    for (const caso of CASOS) {
      const resultado = await caso.chamar("nao-e-um-uuid")
      expect(resultado.error?.code, caso.nome).toBe("fetch_falhou")
      expect(leitores[caso.leitor], caso.nome).not.toHaveBeenCalled()
    }
  })

  it("sem-sessao", async () => {
    getUserSpy.mockResolvedValue({ data: { user: null } })
    for (const caso of CASOS) {
      const resultado = await caso.chamar(ID)
      expect(resultado.error?.code, caso.nome).toBe("unauthenticated")
      expect(leitores[caso.leitor], caso.nome).not.toHaveBeenCalled()
    }
  })

  it("comparacoes-inalteradas", async () => {
    await getDesempenhoVendedorAction(INICIO, FIM)
    expect(leitores.getDesempenhoVendedor).toHaveBeenCalledWith(INICIO, FIM)
    expect(leitores.getDesempenhoVendedor.mock.calls[0].length).toBe(2)
  })
})
