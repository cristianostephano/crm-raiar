import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Testes do leitor getAderenciaUso (30-05-PLAN.md Tarefa 2) — mocka
 * "@/lib/supabase/server" inteiro, mesmo molde de
 * tests/funil/perdidos-query.test.ts / tests/funil/encerrados-query.test.ts,
 * mas sem chain de order()/range() porque dashboard_aderencia_uso() (como
 * dashboard_comparativo_vendedor()) devolve o resultado direto da chamada de
 * rpc(), sem paginação.
 */
const { rpcSpy } = vi.hoisted(() => ({
  rpcSpy: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: rpcSpy,
  }),
}))

import { getAderenciaUso } from "@/lib/supabase/queries/dashboard"

describe("getAderenciaUso", () => {
  beforeEach(() => {
    rpcSpy.mockReset()
  })

  it("chama-rpc-sem-parametros: chama a RPC dashboard_aderencia_uso sem segundo argumento", async () => {
    rpcSpy.mockResolvedValue({ data: [], error: null })

    await getAderenciaUso()

    expect(rpcSpy).toHaveBeenCalledTimes(1)
    expect(rpcSpy).toHaveBeenCalledWith("dashboard_aderencia_uso")
  })

  it("normaliza-numeros: campos numéricos em texto viram números de verdade", async () => {
    rpcSpy.mockResolvedValue({
      data: [
        {
          responsavel: "v1",
          dias_usados: "3",
          dias_uteis: "20",
          aderencia_pct: "15.0",
          coletando_desde: null,
        },
      ],
      error: null,
    })

    const resultado = await getAderenciaUso()

    expect(resultado).toEqual([
      {
        responsavel: "v1",
        diasUsados: 3,
        diasUteis: 20,
        aderenciaPct: 15,
        coletandoDesde: null,
      },
    ])
  })

  it("preserva-nulos: aderencia_pct e coletando_desde nulos permanecem nulos; data preenchida permanece igual", async () => {
    rpcSpy.mockResolvedValue({
      data: [
        {
          responsavel: "v1",
          dias_usados: "0",
          dias_uteis: "0",
          aderencia_pct: null,
          coletando_desde: null,
        },
        {
          responsavel: "v2",
          dias_usados: "5",
          dias_uteis: "20",
          aderencia_pct: "25.0",
          coletando_desde: "2026-09-27",
        },
      ],
      error: null,
    })

    const resultado = await getAderenciaUso()

    expect(resultado[0].aderenciaPct).toBeNull()
    expect(resultado[0].coletandoDesde).toBeNull()
    expect(resultado[1].coletandoDesde).toBe("2026-09-27")
  })

  it("erro-lanca: rpc devolve error e a promessa rejeita com mensagem contendo 'aderência de uso'", async () => {
    rpcSpy.mockResolvedValue({
      data: null,
      error: { message: "falha simulada" },
    })

    await expect(getAderenciaUso()).rejects.toThrow(/aderência de uso/)
  })
})
