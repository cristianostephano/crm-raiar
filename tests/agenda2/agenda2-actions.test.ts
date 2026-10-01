import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Testes das seis Server Actions da Agenda 2 (Fase 31 Plano 4, Tarefa 2) —
 * mock de `next/cache` (revalidatePath) e de `@/lib/supabase/server`, mesmo
 * molde de tests/funil/reativar-guard.test.ts. O mock de `from()` cobre as
 * QUATRO formas de chamada usadas pelo arquivo de produção: leitura
 * (select/or/order/range, usada por getAgenda2Action através da leitura
 * real de lib/supabase/queries/agenda2.ts), insert (criar), e
 * update/delete seguidos de `.eq().select("id")` (editar/apagar/concluir/
 * desmarcar) — a mesma forma que o supabase-js real usa para devolver as
 * linhas afetadas (lista vazia = RLS barrou ou item não existe).
 */
const {
  getUserSpy,
  fromSpy,
  selectLeituraSpy,
  orSpy,
  orderSpy,
  rangeSpy,
  insertSpy,
  updateSpy,
  deleteSpy,
  eqSpy,
  selectEscritaSpy,
  rpcSpy,
  revalidateSpy,
} = vi.hoisted(() => ({
  getUserSpy: vi.fn(),
  fromSpy: vi.fn(),
  selectLeituraSpy: vi.fn(),
  orSpy: vi.fn(),
  orderSpy: vi.fn(),
  rangeSpy: vi.fn(),
  insertSpy: vi.fn(),
  updateSpy: vi.fn(),
  deleteSpy: vi.fn(),
  eqSpy: vi.fn(),
  selectEscritaSpy: vi.fn(),
  rpcSpy: vi.fn(),
  revalidateSpy: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: revalidateSpy,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserSpy },
    rpc: rpcSpy,
    from: (tabela: string) => {
      fromSpy(tabela)
      return {
        select: (colunas: string) => {
          selectLeituraSpy(colunas)
          const builder = {
            or: (filtro: string) => {
              orSpy(filtro)
              return builder
            },
            order: (...args: unknown[]) => {
              orderSpy(...args)
              return builder
            },
            range: (inicio: number, fim: number) => rangeSpy(inicio, fim),
          }
          return builder
        },
        insert: (valores: Record<string, unknown>) => insertSpy(valores),
        update: (valores: Record<string, unknown>) => {
          updateSpy(valores)
          return {
            eq: (campo: string, valor: unknown) => {
              eqSpy(campo, valor)
              return { select: (colunas: string) => selectEscritaSpy(colunas) }
            },
          }
        },
        delete: () => {
          deleteSpy()
          return {
            eq: (campo: string, valor: unknown) => {
              eqSpy(campo, valor)
              return { select: (colunas: string) => selectEscritaSpy(colunas) }
            },
          }
        },
      }
    },
  }),
}))

import {
  apagarAgenda2Item,
  atualizarAgenda2Item,
  concluirAgenda2Item,
  criarAgenda2Item,
  desmarcarAgenda2Item,
  getAgenda2Action,
} from "@/app/actions/agenda2"
import type { Agenda2ItemInput } from "@/lib/validations/agenda2"

const ITEM_ID = "11111111-1111-4111-8111-111111111111"
const SESSAO_EXPIRADA = "Sessão expirada."
const SALVAR_FALHOU_MSG = "Não foi possível salvar. Tente novamente."

const valoresValidos: Agenda2ItemInput = {
  nomeCliente: "Mercado Bom Preço",
  bairro: "Centro",
  data: "2026-09-28",
}

function resetTodosOsSpies() {
  getUserSpy.mockReset()
  fromSpy.mockReset()
  selectLeituraSpy.mockReset()
  orSpy.mockReset()
  orderSpy.mockReset()
  rangeSpy.mockReset()
  insertSpy.mockReset()
  updateSpy.mockReset()
  deleteSpy.mockReset()
  eqSpy.mockReset()
  selectEscritaSpy.mockReset()
  rpcSpy.mockReset()
  revalidateSpy.mockReset()
}

beforeEach(() => {
  resetTodosOsSpies()
})

describe("sem sessão — todas as seis ações", () => {
  it("sem-sessao: sem usuário devolve unauthenticated e 'from' nunca é chamado, para as seis ações", async () => {
    getUserSpy.mockResolvedValue({ data: { user: null } })

    const acoes: Array<() => Promise<{ error?: { code: string; message: string } }>> = [
      () => getAgenda2Action(),
      () => criarAgenda2Item(valoresValidos),
      () => atualizarAgenda2Item(ITEM_ID, valoresValidos),
      () => apagarAgenda2Item(ITEM_ID),
      () => concluirAgenda2Item(ITEM_ID),
      () => desmarcarAgenda2Item(ITEM_ID),
    ]

    for (const acao of acoes) {
      fromSpy.mockClear()
      const resultado = await acao()
      expect(resultado).toEqual({
        error: { code: "unauthenticated", message: SESSAO_EXPIRADA },
      })
      expect(fromSpy).not.toHaveBeenCalled()
    }
  })
})

describe("getAgenda2Action", () => {
  it("listar-ok: devolve os itens mapeados quando a leitura funciona", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
    rangeSpy.mockResolvedValueOnce({
      data: [
        {
          id: "item-1",
          vendedor_id: "u1",
          nome_cliente: "Mercado Bom Preço",
          bairro: "Centro",
          data: "2026-09-28",
          concluido: false,
          atualizado_em: "2026-09-28T10:00:00+00:00",
          profiles: { nome: "Ana", sobrenome: "Souza" },
        },
      ],
      error: null,
    })

    const resultado = await getAgenda2Action()

    expect(resultado).toEqual({
      data: [
        {
          id: "item-1",
          nomeCliente: "Mercado Bom Preço",
          bairro: "Centro",
          data: "2026-09-28",
          concluido: false,
          atualizadoEm: "2026-09-28T10:00:00+00:00",
          responsavel: "u1",
          responsavelNome: "Ana Souza",
        },
      ],
    })
  })

  it("listar-falha: leitura lançando devolve fetch_falhou com a mensagem fixa de carregar", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
    rangeSpy.mockResolvedValueOnce({
      data: null,
      error: { message: "detalhe interno" },
    })

    const resultado = await getAgenda2Action()

    expect(resultado).toEqual({
      error: {
        code: "fetch_falhou",
        message: "Não foi possível carregar sua Agenda 2. Tente novamente.",
      },
    })
  })
})

describe("criarAgenda2Item", () => {
  beforeEach(() => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
  })

  it("criar-validacao: nome vazio devolve validacao e nunca chama insert", async () => {
    const resultado = await criarAgenda2Item({
      nomeCliente: "",
      bairro: "Centro",
      data: "2026-09-28",
    })

    expect(resultado).toEqual({
      error: { code: "validacao", message: SALVAR_FALHOU_MSG },
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it("criar-dono-do-servidor (T-31-03): campos extras da tela são ignorados; vendedor_id é sempre o da sessão", async () => {
    insertSpy.mockResolvedValueOnce({ error: null })

    const valoresComExtras = {
      nomeCliente: "Mercado Bom Preço",
      bairro: "Centro",
      data: "2026-09-28",
      vendedorId: "outro",
      vendedor_id: "outro",
      concluido: true,
    } as unknown as Agenda2ItemInput

    const resultado = await criarAgenda2Item(valoresComExtras)

    expect(resultado).toEqual({ data: true })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(insertSpy).toHaveBeenCalledWith({
      nome_cliente: "Mercado Bom Preço",
      bairro: "Centro",
      data: "2026-09-28",
      vendedor_id: "u1",
    })
  })

  it("criar-aparado: nome com espaços nas pontas é gravado aparado", async () => {
    insertSpy.mockResolvedValueOnce({ error: null })

    await criarAgenda2Item({
      nomeCliente: "  Mercado  ",
      bairro: "Centro",
      data: "2026-09-28",
    })

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ nome_cliente: "Mercado" })
    )
  })

  it("criar-falha: erro do banco devolve salvar_falhou com mensagem genérica (nunca a crua)", async () => {
    insertSpy.mockResolvedValueOnce({ error: { message: "detalhe interno" } })

    const resultado = await criarAgenda2Item(valoresValidos)

    expect(resultado).toEqual({
      error: { code: "salvar_falhou", message: SALVAR_FALHOU_MSG },
    })
  })

  it("revalida-so-no-sucesso: revalidatePath é chamado em '/agenda-2' só no sucesso", async () => {
    insertSpy.mockResolvedValueOnce({ error: { message: "detalhe interno" } })
    await criarAgenda2Item(valoresValidos)
    expect(revalidateSpy).not.toHaveBeenCalled()

    insertSpy.mockResolvedValueOnce({ error: null })
    await criarAgenda2Item(valoresValidos)
    expect(revalidateSpy).toHaveBeenCalledWith("/agenda-2")
  })
})

describe("atualizarAgenda2Item", () => {
  beforeEach(() => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
  })

  it("atualizar-ok (AGD2-03): update nunca inclui concluido (D-06); usa eq(id) e select(id)", async () => {
    selectEscritaSpy.mockResolvedValueOnce({ data: [{ id: ITEM_ID }], error: null })

    const resultado = await atualizarAgenda2Item(ITEM_ID, valoresValidos)

    expect(resultado).toEqual({ data: true })
    expect(updateSpy).toHaveBeenCalledWith({
      nome_cliente: "Mercado Bom Preço",
      bairro: "Centro",
      data: "2026-09-28",
    })
    expect(eqSpy).toHaveBeenCalledWith("id", ITEM_ID)
    expect(selectEscritaSpy).toHaveBeenCalledWith("id")
  })

  it("atualizar-zero-linhas: select devolve [] vira nao_encontrado", async () => {
    selectEscritaSpy.mockResolvedValueOnce({ data: [], error: null })

    const resultado = await atualizarAgenda2Item(ITEM_ID, valoresValidos)

    expect(resultado).toEqual({
      error: { code: "nao_encontrado", message: SALVAR_FALHOU_MSG },
    })
  })

  it("atualizar-id-invalido: itemId inválido devolve validacao e nunca chama update", async () => {
    const resultado = await atualizarAgenda2Item("abc", valoresValidos)

    expect(resultado).toEqual({
      error: { code: "validacao", message: SALVAR_FALHOU_MSG },
    })
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe("apagarAgenda2Item", () => {
  beforeEach(() => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
  })

  it("apagar-ok (AGD2-04): delete usa eq(id) e select(id)", async () => {
    selectEscritaSpy.mockResolvedValueOnce({ data: [{ id: ITEM_ID }], error: null })

    const resultado = await apagarAgenda2Item(ITEM_ID)

    expect(resultado).toEqual({ data: true })
    expect(deleteSpy).toHaveBeenCalledTimes(1)
    expect(eqSpy).toHaveBeenCalledWith("id", ITEM_ID)
  })

  it("apagar-zero-linhas: select devolve [] vira nao_encontrado", async () => {
    selectEscritaSpy.mockResolvedValueOnce({ data: [], error: null })

    const resultado = await apagarAgenda2Item(ITEM_ID)

    expect(resultado).toEqual({
      error: { code: "nao_encontrado", message: SALVAR_FALHOU_MSG },
    })
  })
})

describe("concluirAgenda2Item / desmarcarAgenda2Item", () => {
  beforeEach(() => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
  })

  it("concluir-ok (AGD2-05): update com exatamente { concluido: true }", async () => {
    selectEscritaSpy.mockResolvedValueOnce({ data: [{ id: ITEM_ID }], error: null })

    const resultado = await concluirAgenda2Item(ITEM_ID)

    expect(resultado).toEqual({ data: true })
    expect(updateSpy).toHaveBeenCalledWith({ concluido: true })
  })

  it("desmarcar-ok (D-05): update com exatamente { concluido: false }", async () => {
    selectEscritaSpy.mockResolvedValueOnce({ data: [{ id: ITEM_ID }], error: null })

    const resultado = await desmarcarAgenda2Item(ITEM_ID)

    expect(resultado).toEqual({ data: true })
    expect(updateSpy).toHaveBeenCalledWith({ concluido: false })
  })
})

describe("sem-rpc", () => {
  it("sem-rpc: nenhuma das seis ações chama rpc do cliente mockado", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
    insertSpy.mockResolvedValue({ error: null })
    selectEscritaSpy.mockResolvedValue({ data: [{ id: ITEM_ID }], error: null })
    rangeSpy.mockResolvedValue({ data: [], error: null })

    await getAgenda2Action()
    await criarAgenda2Item(valoresValidos)
    await atualizarAgenda2Item(ITEM_ID, valoresValidos)
    await apagarAgenda2Item(ITEM_ID)
    await concluirAgenda2Item(ITEM_ID)
    await desmarcarAgenda2Item(ITEM_ID)

    expect(rpcSpy).not.toHaveBeenCalled()
  })
})
