import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Testes de getComparativoVendedorAction (30-05-PLAN.md Tarefa 2) — mocka
 * "@/lib/supabase/server" (sessão) e "@/lib/supabase/queries/dashboard" via
 * importOriginal (preserva os demais exports reais, ex: ETAPA_KEYS, e troca
 * só getComparativoVendedor/getAderenciaUso por espiões). mesclarAderencia()
 * (lib/aderencia/exibicao.ts) roda de verdade, sem dublê — é o módulo puro
 * testado em aderencia-exibicao.test.ts.
 */
const { getUserSpy } = vi.hoisted(() => ({
  getUserSpy: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserSpy },
  }),
}))

const { getComparativoVendedorSpy, getAderenciaUsoSpy } = vi.hoisted(() => ({
  getComparativoVendedorSpy: vi.fn(),
  getAderenciaUsoSpy: vi.fn(),
}))

vi.mock("@/lib/supabase/queries/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/queries/dashboard")>()),
  getComparativoVendedor: getComparativoVendedorSpy,
  getAderenciaUso: getAderenciaUsoSpy,
}))

import { getComparativoVendedorAction } from "@/app/actions/dashboard"
import type {
  AderenciaUsoRow,
  ComparativoVendedorRow,
} from "@/lib/supabase/queries/dashboard"

function buildComparativo(
  partial: Partial<ComparativoVendedorRow> = {}
): ComparativoVendedorRow {
  return {
    responsavel: "v1",
    responsavelNome: "Vendedor Um",
    negociosIniciados: 0,
    ganho: 0,
    perdido: 0,
    cicloMedioDias: null,
    taxaConversao: null,
    ...partial,
  }
}

function buildAderencia(partial: Partial<AderenciaUsoRow> = {}): AderenciaUsoRow {
  return {
    responsavel: "v1",
    diasUsados: 0,
    diasUteis: 0,
    aderenciaPct: null,
    coletandoDesde: null,
    ...partial,
  }
}

describe("getComparativoVendedorAction", () => {
  beforeEach(() => {
    getUserSpy.mockReset()
    getComparativoVendedorSpy.mockReset()
    getAderenciaUsoSpy.mockReset()
  })

  it("sem-sessao: usuário nulo devolve unauthenticated e não chama nenhum dos dois leitores", async () => {
    getUserSpy.mockResolvedValue({ data: { user: null } })

    const resultado = await getComparativoVendedorAction()

    expect(resultado).toEqual({
      error: { code: "unauthenticated", message: "Sessão expirada." },
    })
    expect(getComparativoVendedorSpy).not.toHaveBeenCalled()
    expect(getAderenciaUsoSpy).not.toHaveBeenCalled()
  })

  it("mescla-as-duas-leituras: as duas leituras resolvem e a aderência é anexada por id, na ordem do comparativo", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
    getComparativoVendedorSpy.mockResolvedValue([
      buildComparativo({ responsavel: "v-zeta", responsavelNome: "Zeta" }),
      buildComparativo({ responsavel: "v-alfa", responsavelNome: "Alfa" }),
    ])
    getAderenciaUsoSpy.mockResolvedValue([
      buildAderencia({ responsavel: "v-alfa", aderenciaPct: 70 }),
    ])

    const resultado = await getComparativoVendedorAction()

    expect(resultado.data?.map((linha) => linha.responsavelNome)).toEqual([
      "Zeta",
      "Alfa",
    ])
    expect(resultado.data?.[0].aderencia).toBeNull()
    expect(resultado.data?.[1].aderencia?.aderenciaPct).toBe(70)
  })

  it("aderencia-falha-nao-derruba: getAderenciaUso rejeita e a tabela comparativa continua carregando, com aderência nula em todas as linhas", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
    getComparativoVendedorSpy.mockResolvedValue([
      buildComparativo({ responsavel: "v-alfa" }),
      buildComparativo({ responsavel: "v-beta" }),
    ])
    getAderenciaUsoSpy.mockRejectedValue(new Error("falha simulada na aderência"))

    const resultado = await getComparativoVendedorAction()

    expect(resultado.error).toBeUndefined()
    expect(resultado.data).toHaveLength(2)
    expect(resultado.data?.every((linha) => linha.aderencia === null)).toBe(true)
  })

  it("comparativo-falha-continua-erro: getComparativoVendedor rejeita e o erro é o mesmo de hoje", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
    getComparativoVendedorSpy.mockRejectedValue(new Error("falha simulada"))
    getAderenciaUsoSpy.mockResolvedValue([])

    const resultado = await getComparativoVendedorAction()

    expect(resultado).toEqual({
      error: {
        code: "fetch_falhou",
        message:
          "Não foi possível carregar os dados do dashboard. Tente novamente.",
      },
    })
  })
})
