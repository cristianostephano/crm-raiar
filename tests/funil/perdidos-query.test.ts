import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Testes do leitor paginado getClientesPerdidos e da Server Action
 * getClientesPerdidosAction (Fase 28 Plano 3) — mocka
 * "@/lib/supabase/server" inteiro, mesmo molde de
 * tests/agenda/clientes-sem-dia-fixo-query.test.ts. Casos batem com o bloco
 * <behavior> do 28-03-PLAN.md: leitor-rpc, leitor-mapeamento,
 * leitor-paginado, leitor-erro, acao-sem-sessao, acao-periodo-invalido,
 * acao-ok, acao-falha.
 */
const { getUserSpy, rpcSpy, orderSpy, rangeSpy } = vi.hoisted(() => ({
  getUserSpy: vi.fn(),
  rpcSpy: vi.fn(),
  orderSpy: vi.fn(),
  rangeSpy: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserSpy },
    rpc: (...args: unknown[]) => {
      rpcSpy(...args)
      const chain = {
        order: (...orderArgs: unknown[]) => {
          orderSpy(...orderArgs)
          return chain
        },
        range: rangeSpy,
      }
      return chain
    },
  }),
}))

import { getClientesPerdidosAction } from "@/app/actions/perdidos"
import { getClientesPerdidos } from "@/lib/supabase/queries/perdidos"

function fakeRow(clienteId: string) {
  return {
    cliente_id: clienteId,
    razao_social: "Cliente Teste",
    nome_fantasia: null,
    motivo_perda_nome: "Motivo",
    perdido_em: "2026-01-01T00:00:00+00:00",
    responsavel: "v1",
    responsavel_nome: "Vendedor Um",
  }
}

describe("getClientesPerdidos", () => {
  beforeEach(() => {
    getUserSpy.mockReset()
    rpcSpy.mockReset()
    orderSpy.mockReset()
    rangeSpy.mockReset()
  })

  it("leitor-rpc: chama a RPC uma vez com p_inicio/p_fim, ordena perdido_em desc + cliente_id asc, e o primeiro recorte é (0, 999)", async () => {
    rangeSpy.mockResolvedValue({ data: [], error: null })

    await getClientesPerdidos({
      inicio: "2026-09-01T03:00:00.000Z",
      fim: null,
    })

    expect(rpcSpy).toHaveBeenCalledTimes(1)
    expect(rpcSpy).toHaveBeenCalledWith("clientes_perdidos", {
      p_inicio: "2026-09-01T03:00:00.000Z",
      p_fim: null,
    })
    expect(orderSpy.mock.calls[0]).toEqual(["perdido_em", { ascending: false }])
    expect(orderSpy.mock.calls[1]).toEqual(["cliente_id", { ascending: true }])
    expect(rangeSpy).toHaveBeenCalledWith(0, 999)
  })

  it("leitor-mapeamento: mapeia a linha snake_case para o formato camelCase, sem alterar nulos", async () => {
    rangeSpy.mockResolvedValue({
      data: [
        {
          cliente_id: "c1",
          razao_social: null,
          nome_fantasia: "Mercado Bom Preço",
          motivo_perda_nome: null,
          perdido_em: "2026-09-10T15:00:00+00:00",
          responsavel: "v1",
          responsavel_nome: "Ana Souza",
        },
      ],
      error: null,
    })

    const resultado = await getClientesPerdidos({ inicio: null, fim: null })

    expect(resultado).toEqual([
      {
        clienteId: "c1",
        razaoSocial: null,
        nomeFantasia: "Mercado Bom Preço",
        motivoPerdaNome: null,
        perdidoEm: "2026-09-10T15:00:00+00:00",
        responsavel: "v1",
        responsavelNome: "Ana Souza",
      },
    ])
  })

  it("leitor-paginado: junta 1000 + 5 linhas em 1005 itens, e o segundo recorte é (1000, 1999)", async () => {
    const primeiraPagina = Array.from({ length: 1000 }, (_, i) => fakeRow(`c${i}`))
    const segundaPagina = Array.from({ length: 5 }, (_, i) => fakeRow(`c${1000 + i}`))

    rangeSpy
      .mockResolvedValueOnce({ data: primeiraPagina, error: null })
      .mockResolvedValueOnce({ data: segundaPagina, error: null })

    const resultado = await getClientesPerdidos({ inicio: null, fim: null })

    expect(resultado).toHaveLength(1005)
    expect(rangeSpy.mock.calls[1]).toEqual([1000, 1999])
  })

  it("leitor-erro: página com erro faz getClientesPerdidos rejeitar", async () => {
    rangeSpy.mockResolvedValueOnce({
      data: null,
      error: { message: "falha simulada" },
    })

    await expect(
      getClientesPerdidos({ inicio: null, fim: null })
    ).rejects.toThrow()
  })
})

describe("getClientesPerdidosAction", () => {
  beforeEach(() => {
    getUserSpy.mockReset()
    rpcSpy.mockReset()
    orderSpy.mockReset()
    rangeSpy.mockReset()
  })

  it("acao-sem-sessao: sem usuário devolve unauthenticated e não chama a RPC", async () => {
    getUserSpy.mockResolvedValue({ data: { user: null } })

    const resultado = await getClientesPerdidosAction({ inicio: null, fim: null })

    expect(resultado).toEqual({
      error: { code: "unauthenticated", message: "Sessão expirada." },
    })
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("acao-periodo-invalido: período inválido devolve periodo_invalido e não chama a RPC", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })

    const resultado = await getClientesPerdidosAction({
      inicio: "nao-e-data",
      fim: null,
    })

    expect(resultado.error?.code).toBe("periodo_invalido")
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("acao-ok: com usuário e intervalo válido devolve os itens mapeados", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
    rangeSpy.mockResolvedValue({
      data: [
        {
          cliente_id: "c1",
          razao_social: "Padaria Central Ltda",
          nome_fantasia: null,
          motivo_perda_nome: "Preço",
          perdido_em: "2026-09-10T15:00:00+00:00",
          responsavel: "v1",
          responsavel_nome: "Ana Souza",
        },
      ],
      error: null,
    })

    const resultado = await getClientesPerdidosAction({ inicio: null, fim: null })

    expect(resultado).toEqual({
      data: [
        {
          clienteId: "c1",
          razaoSocial: "Padaria Central Ltda",
          nomeFantasia: null,
          motivoPerdaNome: "Preço",
          perdidoEm: "2026-09-10T15:00:00+00:00",
          responsavel: "v1",
          responsavelNome: "Ana Souza",
        },
      ],
    })
  })

  it("acao-falha: falha na leitura devolve fetch_falhou com mensagem fixa", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
    rangeSpy.mockResolvedValue({
      data: null,
      error: { message: "falha simulada" },
    })

    const resultado = await getClientesPerdidosAction({ inicio: null, fim: null })

    expect(resultado).toEqual({
      error: {
        code: "fetch_falhou",
        message: "Não foi possível carregar os clientes perdidos. Tente novamente.",
      },
    })
  })
})
