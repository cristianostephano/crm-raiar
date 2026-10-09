import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Testes do leitor paginado getClientesGanhos e da Server Action
 * getClientesGanhosAction (quick 261008-rxw) - mocka
 * "@/lib/supabase/server" inteiro, mesmo molde de
 * tests/funil/perdidos-query.test.ts. Casos: leitor-rpc, leitor-mapeamento,
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

import { getClientesGanhosAction } from "@/app/actions/ganhos"
import { getClientesGanhos } from "@/lib/supabase/queries/ganhos"

function fakeRow(clienteId: string) {
  return {
    cliente_id: clienteId,
    razao_social: "Cliente Teste",
    nome_fantasia: null,
    ganho_em: "2026-01-01",
    responsavel: "v1",
    responsavel_nome: "Vendedor Um",
  }
}

describe("getClientesGanhos", () => {
  beforeEach(() => {
    getUserSpy.mockReset()
    rpcSpy.mockReset()
    orderSpy.mockReset()
    rangeSpy.mockReset()
  })

  it("leitor-rpc: chama a RPC uma vez com p_inicio/p_fim, ordena ganho_em desc (vazios por último) + cliente_id asc, e o primeiro recorte é (0, 999)", async () => {
    rangeSpy.mockResolvedValue({ data: [], error: null })

    await getClientesGanhos({
      inicio: "2026-09-01T03:00:00.000Z",
      fim: null,
    })

    expect(rpcSpy).toHaveBeenCalledTimes(1)
    expect(rpcSpy).toHaveBeenCalledWith("clientes_ganhos", {
      p_inicio: "2026-09-01T03:00:00.000Z",
      p_fim: null,
    })
    expect(orderSpy.mock.calls[0]).toEqual(["ganho_em", { ascending: false, nullsFirst: false }])
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
          ganho_em: "2025-06-10",
          responsavel: "v1",
          responsavel_nome: "Ana Souza",
        },
      ],
      error: null,
    })

    const resultado = await getClientesGanhos({ inicio: null, fim: null })

    expect(resultado).toEqual([
      {
        clienteId: "c1",
        razaoSocial: null,
        nomeFantasia: "Mercado Bom Preço",
        ganhoEm: "2025-06-10",
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

    const resultado = await getClientesGanhos({ inicio: null, fim: null })

    expect(resultado).toHaveLength(1005)
    expect(rangeSpy.mock.calls[1]).toEqual([1000, 1999])
  })

  it("leitor-erro: página com erro faz getClientesGanhos rejeitar", async () => {
    rangeSpy.mockResolvedValueOnce({
      data: null,
      error: { message: "falha simulada" },
    })

    await expect(
      getClientesGanhos({ inicio: null, fim: null })
    ).rejects.toThrow()
  })
})

describe("getClientesGanhosAction", () => {
  beforeEach(() => {
    getUserSpy.mockReset()
    rpcSpy.mockReset()
    orderSpy.mockReset()
    rangeSpy.mockReset()
  })

  it("acao-sem-sessao: sem usuário devolve unauthenticated e não chama a RPC", async () => {
    getUserSpy.mockResolvedValue({ data: { user: null } })

    const resultado = await getClientesGanhosAction({ inicio: null, fim: null })

    expect(resultado).toEqual({
      error: { code: "unauthenticated", message: "Sessão expirada." },
    })
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("acao-periodo-invalido: período inválido devolve periodo_invalido e não chama a RPC", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })

    const resultado = await getClientesGanhosAction({
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
          ganho_em: null,
          responsavel: "v1",
          responsavel_nome: "Ana Souza",
        },
      ],
      error: null,
    })

    const resultado = await getClientesGanhosAction({ inicio: null, fim: null })

    expect(resultado).toEqual({
      data: [
        {
          clienteId: "c1",
          razaoSocial: "Padaria Central Ltda",
          nomeFantasia: null,
          ganhoEm: null,
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

    const resultado = await getClientesGanhosAction({ inicio: null, fim: null })

    expect(resultado).toEqual({
      error: {
        code: "fetch_falhou",
        message: "Não foi possível carregar os clientes ganhos. Tente novamente.",
      },
    })
  })
})
