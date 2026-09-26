import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Testes do leitor paginado getClientesEncerrados, do catálogo
 * getMotivosEncerramentoAtivos e das Server Actions
 * getClientesEncerradosAction/getMotivosEncerramento (Fase 29 Plano 5) —
 * mocka "@/lib/supabase/server" inteiro, mesmo molde de
 * tests/funil/perdidos-query.test.ts. Casos batem com o bloco <behavior> do
 * 29-05-PLAN.md: leitor-rpc, leitor-mapeamento, leitor-paginado, leitor-erro,
 * acao-sem-sessao, acao-periodo-invalido, acao-ok, acao-falha,
 * motivos-ativos, motivos-sem-sessao.
 */
const { getUserSpy, rpcSpy, orderSpy, rangeSpy, fromSpy, selectSpy, eqSpy, fromOrderSpy } =
  vi.hoisted(() => ({
    getUserSpy: vi.fn(),
    rpcSpy: vi.fn(),
    orderSpy: vi.fn(),
    rangeSpy: vi.fn(),
    fromSpy: vi.fn(),
    selectSpy: vi.fn(),
    eqSpy: vi.fn(),
    fromOrderSpy: vi.fn(),
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
    from: (...args: unknown[]) => {
      fromSpy(...args)
      return {
        select: (...selectArgs: unknown[]) => {
          selectSpy(...selectArgs)
          return {
            eq: (...eqArgs: unknown[]) => {
              eqSpy(...eqArgs)
              return {
                order: (...orderArgs: unknown[]) => fromOrderSpy(...orderArgs),
              }
            },
          }
        },
      }
    },
  }),
}))

import { getClientesEncerradosAction, getMotivosEncerramento } from "@/app/actions/encerrados"
import {
  getClientesEncerrados,
  getMotivosEncerramentoAtivos,
} from "@/lib/supabase/queries/encerrados"

function fakeRow(clienteId: string) {
  return {
    cliente_id: clienteId,
    razao_social: "Cliente Teste",
    nome_fantasia: null,
    motivo_encerramento_nome: "Motivo",
    encerrado_em: "2026-01-01T00:00:00+00:00",
    responsavel: "v1",
    responsavel_nome: "Vendedor Um",
  }
}

describe("getClientesEncerrados", () => {
  beforeEach(() => {
    getUserSpy.mockReset()
    rpcSpy.mockReset()
    orderSpy.mockReset()
    rangeSpy.mockReset()
  })

  it("leitor-rpc: chama a RPC uma vez com p_inicio/p_fim, ordena encerrado_em desc + cliente_id asc, e o primeiro recorte é (0, 999)", async () => {
    rangeSpy.mockResolvedValue({ data: [], error: null })

    await getClientesEncerrados({
      inicio: "2026-09-01T03:00:00.000Z",
      fim: null,
    })

    expect(rpcSpy).toHaveBeenCalledTimes(1)
    expect(rpcSpy).toHaveBeenCalledWith("clientes_encerrados", {
      p_inicio: "2026-09-01T03:00:00.000Z",
      p_fim: null,
    })
    expect(orderSpy.mock.calls[0]).toEqual(["encerrado_em", { ascending: false }])
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
          motivo_encerramento_nome: null,
          encerrado_em: "2026-09-20T15:00:00+00:00",
          responsavel: "v1",
          responsavel_nome: "Ana Souza",
        },
      ],
      error: null,
    })

    const resultado = await getClientesEncerrados({ inicio: null, fim: null })

    expect(resultado).toEqual([
      {
        clienteId: "c1",
        razaoSocial: null,
        nomeFantasia: "Mercado Bom Preço",
        motivoEncerramentoNome: null,
        encerradoEm: "2026-09-20T15:00:00+00:00",
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

    const resultado = await getClientesEncerrados({ inicio: null, fim: null })

    expect(resultado).toHaveLength(1005)
    expect(rangeSpy.mock.calls[1]).toEqual([1000, 1999])
  })

  it("leitor-erro: página com erro faz getClientesEncerrados rejeitar", async () => {
    rangeSpy.mockResolvedValueOnce({
      data: null,
      error: { message: "falha simulada" },
    })

    await expect(
      getClientesEncerrados({ inicio: null, fim: null })
    ).rejects.toThrow()
  })
})

describe("getClientesEncerradosAction", () => {
  beforeEach(() => {
    getUserSpy.mockReset()
    rpcSpy.mockReset()
    orderSpy.mockReset()
    rangeSpy.mockReset()
  })

  it("acao-sem-sessao: sem usuário devolve unauthenticated e não chama a RPC", async () => {
    getUserSpy.mockResolvedValue({ data: { user: null } })

    const resultado = await getClientesEncerradosAction({ inicio: null, fim: null })

    expect(resultado).toEqual({
      error: { code: "unauthenticated", message: "Sessão expirada." },
    })
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("acao-periodo-invalido: período inválido devolve periodo_invalido e não chama a RPC", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })

    const resultado = await getClientesEncerradosAction({
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
          motivo_encerramento_nome: "Fechou a loja",
          encerrado_em: "2026-09-10T15:00:00+00:00",
          responsavel: "v1",
          responsavel_nome: "Ana Souza",
        },
      ],
      error: null,
    })

    const resultado = await getClientesEncerradosAction({ inicio: null, fim: null })

    expect(resultado).toEqual({
      data: [
        {
          clienteId: "c1",
          razaoSocial: "Padaria Central Ltda",
          nomeFantasia: null,
          motivoEncerramentoNome: "Fechou a loja",
          encerradoEm: "2026-09-10T15:00:00+00:00",
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

    const resultado = await getClientesEncerradosAction({ inicio: null, fim: null })

    expect(resultado).toEqual({
      error: {
        code: "fetch_falhou",
        message: "Não foi possível carregar os clientes encerrados. Tente novamente.",
      },
    })
  })
})

describe("getMotivosEncerramentoAtivos / getMotivosEncerramento", () => {
  beforeEach(() => {
    getUserSpy.mockReset()
    fromSpy.mockReset()
    selectSpy.mockReset()
    eqSpy.mockReset()
    fromOrderSpy.mockReset()
  })

  it("motivos-ativos: getMotivosEncerramento() com usuário lê motivos_encerramento com ativo=true e ordem por nome", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
    fromOrderSpy.mockImplementation(() =>
      Promise.resolve({
        data: [{ id: "m1", nome: "Fechou a loja" }],
        error: null,
      })
    )

    const resultado = await getMotivosEncerramento()

    expect(fromSpy).toHaveBeenCalledWith("motivos_encerramento")
    expect(selectSpy).toHaveBeenCalledWith("id, nome")
    expect(eqSpy).toHaveBeenCalledWith("ativo", true)
    expect(fromOrderSpy).toHaveBeenCalledWith("nome", { ascending: true })
    expect(resultado).toEqual({ data: [{ id: "m1", nome: "Fechou a loja" }] })
  })

  it("motivos-sem-sessao: sem usuário devolve unauthenticated e não lê a tabela", async () => {
    getUserSpy.mockResolvedValue({ data: { user: null } })

    const resultado = await getMotivosEncerramento()

    expect(resultado).toEqual({ error: { code: "unauthenticated" } })
    expect(fromSpy).not.toHaveBeenCalled()
  })
})

describe("getMotivosEncerramentoAtivos (leitor direto)", () => {
  beforeEach(() => {
    fromSpy.mockReset()
    selectSpy.mockReset()
    eqSpy.mockReset()
    fromOrderSpy.mockReset()
  })

  it("lê motivos_encerramento com ativo=true, ordenado por nome, e devolve os dados", async () => {
    fromOrderSpy.mockImplementation(() =>
      Promise.resolve({
        data: [{ id: "m1", nome: "Fechou a loja" }],
        error: null,
      })
    )

    const resultado = await getMotivosEncerramentoAtivos()

    expect(fromSpy).toHaveBeenCalledWith("motivos_encerramento")
    expect(resultado).toEqual([{ id: "m1", nome: "Fechou a loja" }])
  })

  it("erro ou nulo devolve lista vazia", async () => {
    fromOrderSpy.mockImplementation(() =>
      Promise.resolve({ data: null, error: { message: "falha" } })
    )

    const resultado = await getMotivosEncerramentoAtivos()

    expect(resultado).toEqual([])
  })
})
