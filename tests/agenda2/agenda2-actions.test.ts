import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
  gteSpy,
  lteSpy,
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
  gteSpy: vi.fn(),
  lteSpy: vi.fn(),
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
            gte: (coluna: string, valor: string) => {
              gteSpy(coluna, valor)
              return builder
            },
            lte: (coluna: string, valor: string) => {
              lteSpy(coluna, valor)
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
        insert: (valores: Array<Record<string, unknown>>) => insertSpy(valores),
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
  getAgenda2PeriodoAction,
} from "@/app/actions/agenda2"
import type {
  Agenda2CriarItemInput,
  Agenda2ItemInput,
} from "@/lib/validations/agenda2"

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
  gteSpy.mockReset()
  lteSpy.mockReset()
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

describe("sem sessão — todas as sete ações", () => {
  it("sem-sessao: sem usuário devolve unauthenticated e 'from' nunca é chamado, para as sete ações", async () => {
    getUserSpy.mockResolvedValue({ data: { user: null } })

    const acoes: Array<() => Promise<{ error?: { code: string; message: string } }>> = [
      () => getAgenda2Action(),
      () => getAgenda2PeriodoAction("2026-08-01", "2026-08-31"),
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
        message: "Não foi possível carregar sua Agenda. Tente novamente.",
      },
    })
  })
})

describe("getAgenda2PeriodoAction (Fase 32, AGD2-08/D-28)", () => {
  const MSG_CALENDARIO = "Não foi possível carregar o calendário deste período."

  beforeEach(() => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
  })

  it("periodo-ok: devolve os itens do período (inclusive concluídos) sem usar .or", async () => {
    rangeSpy.mockResolvedValueOnce({
      data: [
        {
          id: "item-9",
          vendedor_id: "u1",
          nome_cliente: "Mercado Bom Preço",
          bairro: "Centro",
          data: "2026-08-03",
          concluido: true,
          atualizado_em: "2026-08-03T10:00:00+00:00",
          profiles: { nome: "Ana", sobrenome: "Souza" },
        },
      ],
      error: null,
    })

    const resultado = await getAgenda2PeriodoAction("2026-07-27", "2026-09-06")

    expect(resultado).toEqual({
      data: [
        {
          id: "item-9",
          nomeCliente: "Mercado Bom Preço",
          bairro: "Centro",
          data: "2026-08-03",
          concluido: true,
          atualizadoEm: "2026-08-03T10:00:00+00:00",
          responsavel: "u1",
          responsavelNome: "Ana Souza",
        },
      ],
    })
    expect(gteSpy).toHaveBeenCalledWith("data", "2026-07-27")
    expect(lteSpy).toHaveBeenCalledWith("data", "2026-09-06")
    expect(orSpy).not.toHaveBeenCalled()
  })

  it("periodo-intervalo-invalido (T-32-05): formato, ordem e mais de 45 dias são recusados antes de qualquer leitura", async () => {
    const intervalos: Array<[string, string]> = [
      ["2026-09-10", "2026-08-01"],
      ["2026-01-01", "2026-03-01"],
      ["ontem", "2026-08-01"],
    ]

    for (const [inicio, fim] of intervalos) {
      const resultado = await getAgenda2PeriodoAction(inicio, fim)
      expect(resultado).toEqual({
        error: { code: "validacao", message: MSG_CALENDARIO },
      })
    }
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it("periodo-falha (T-32-06): erro de leitura devolve fetch_falhou com a mensagem fixa", async () => {
    rangeSpy.mockResolvedValueOnce({
      data: null,
      error: { message: "detalhe interno" },
    })

    const resultado = await getAgenda2PeriodoAction("2026-08-01", "2026-08-31")

    expect(resultado).toEqual({
      error: { code: "fetch_falhou", message: MSG_CALENDARIO },
    })
  })

  it("periodo-nao-revalida: leitura nunca chama revalidatePath", async () => {
    rangeSpy.mockResolvedValueOnce({ data: [], error: null })

    const resultado = await getAgenda2PeriodoAction("2026-08-01", "2026-08-31")

    expect(resultado).toEqual({ data: [] })
    expect(revalidateSpy).not.toHaveBeenCalled()
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
      oQueFoiFeito: "Teste tentativa",
    } as unknown as Agenda2ItemInput

    const resultado = await criarAgenda2Item(valoresComExtras)

    expect(resultado).toEqual({ data: true })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    // Fase 32: o insert é SEMPRE um array (1 linha quando não repete).
    expect(insertSpy).toHaveBeenCalledWith([
      {
        nome_cliente: "Mercado Bom Preço",
        bairro: "Centro",
        data: "2026-09-28",
        o_que_fazer: null,
        vendedor_id: "u1",
      },
    ])
  })

  it("criar-aparado: nome com espaços nas pontas é gravado aparado", async () => {
    insertSpy.mockResolvedValueOnce({ error: null })

    await criarAgenda2Item({
      nomeCliente: "  Mercado  ",
      bairro: "Centro",
      data: "2026-09-28",
    })

    expect(insertSpy).toHaveBeenCalledWith([
      expect.objectContaining({ nome_cliente: "Mercado" }),
    ])
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

  it("criar-plano-aparado-e-vazio: plano com espaços é gravado aparado; só espaços e ausente gravam null", async () => {
    insertSpy.mockResolvedValue({ error: null })

    await criarAgenda2Item({ ...valoresValidos, oQueFazer: "  Levar catálogo  " })
    expect(insertSpy.mock.calls[0][0]).toEqual([
      expect.objectContaining({ o_que_fazer: "Levar catálogo" }),
    ])

    insertSpy.mockClear()
    await criarAgenda2Item({ ...valoresValidos, oQueFazer: "   " })
    expect(insertSpy.mock.calls[0][0]).toEqual([
      expect.objectContaining({ o_que_fazer: null }),
    ])

    insertSpy.mockClear()
    await criarAgenda2Item(valoresValidos)
    expect(insertSpy.mock.calls[0][0]).toEqual([
      expect.objectContaining({ o_que_fazer: null }),
    ])
  })

  it("criar-plano-longo: 501 caracteres devolve validacao e nunca chama insert", async () => {
    const resultado = await criarAgenda2Item({
      ...valoresValidos,
      oQueFazer: "a".repeat(501),
    })

    expect(resultado).toEqual({
      error: { code: "validacao", message: SALVAR_FALHOU_MSG },
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })
})

/** Datas (AAAA-MM-DD) das linhas do único insert feito. */
function datasDoInsert(): string[] {
  const linhas = insertSpy.mock.calls[0][0] as Array<{ data: string }>
  return linhas.map((linha) => linha.data)
}

describe("criarAgenda2Item — repetição semanal em lote (Fase 32)", () => {
  beforeEach(() => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
    // Só o relógio é falso: promises e microtasks continuam reais.
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-02T15:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("criar-sem-repeticao: sem repetirSemanas e com repetirSemanas 0 gravam uma linha só (data passada continua aceita — D-09)", async () => {
    insertSpy.mockResolvedValue({ error: null })

    const semCampo = await criarAgenda2Item(valoresValidos)
    expect(semCampo).toEqual({ data: true })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(insertSpy.mock.calls[0][0]).toHaveLength(1)
    expect(datasDoInsert()).toEqual(["2026-09-28"])

    insertSpy.mockClear()
    const comZero = await criarAgenda2Item({
      ...valoresValidos,
      repetirSemanas: 0,
    })
    expect(comZero).toEqual({ data: true })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(insertSpy.mock.calls[0][0]).toHaveLength(1)
    expect(datasDoInsert()).toEqual(["2026-09-28"])
  })

  it("criar-repete-4 (D-20/D-31/D-22/D-03): UM insert com 4 linhas semanais, todas do dono da sessão, com o mesmo plano e só com as 5 colunas (o resultado nunca entra)", async () => {
    insertSpy.mockResolvedValueOnce({ error: null })

    const valores = {
      nomeCliente: "Mercado Bom Preço",
      bairro: "Centro",
      data: "2026-10-05",
      repetirSemanas: 4,
      vendedorId: "outro",
      oQueFazer: "Levar amostras",
      oQueFoiFeito: "Teste tentativa",
    } as unknown as Agenda2CriarItemInput

    const resultado = await criarAgenda2Item(valores)

    expect(resultado).toEqual({ data: true })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(datasDoInsert()).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ])

    const linhas = insertSpy.mock.calls[0][0] as Array<Record<string, unknown>>
    for (const linha of linhas) {
      expect(linha.vendedor_id).toBe("u1")
      expect(linha.o_que_fazer).toBe("Levar amostras")
      expect(Object.keys(linha).sort()).toEqual([
        "bairro",
        "data",
        "nome_cliente",
        "o_que_fazer",
        "vendedor_id",
      ])
    }
    expect(linhas).toHaveLength(4)
    expect(revalidateSpy).toHaveBeenCalledWith("/agenda-2")
  })

  it("criar-repete-12: grava 12 linhas, a última em 2026-12-21, nunca 13", async () => {
    insertSpy.mockResolvedValueOnce({ error: null })

    const resultado = await criarAgenda2Item({
      ...valoresValidos,
      data: "2026-10-05",
      repetirSemanas: 12,
    })

    expect(resultado).toEqual({ data: true })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    const datas = datasDoInsert()
    expect(datas).toHaveLength(12)
    expect(datas[0]).toBe("2026-10-05")
    expect(datas[11]).toBe("2026-12-21")
  })

  it("criar-repete-passado-recusa (D-23): repetir com data anterior a hoje devolve validacao e não grava", async () => {
    const resultado = await criarAgenda2Item({
      ...valoresValidos,
      data: "2026-10-01",
      repetirSemanas: 4,
    })

    expect(resultado).toEqual({
      error: { code: "validacao", message: SALVAR_FALHOU_MSG },
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it("criar-repete-hoje-a-noite (Pitfall 2): às 22:30 de Brasília ainda é hoje, mesmo com UTC já no dia seguinte", async () => {
    vi.setSystemTime(new Date("2026-10-03T01:30:00Z"))
    insertSpy.mockResolvedValueOnce({ error: null })

    const resultado = await criarAgenda2Item({
      ...valoresValidos,
      data: "2026-10-02",
      repetirSemanas: 4,
    })

    expect(resultado).toEqual({ data: true })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    const datas = datasDoInsert()
    expect(datas).toHaveLength(4)
    expect(datas[0]).toBe("2026-10-02")
  })

  it("criar-repete-invalido (T-32-01): repetirSemanas 5, '4' e 1000 devolvem validacao e não gravam", async () => {
    for (const invalido of [5, "4", 1000]) {
      const resultado = await criarAgenda2Item({
        ...valoresValidos,
        data: "2026-10-05",
        repetirSemanas: invalido,
      } as unknown as Agenda2CriarItemInput)

      expect(resultado).toEqual({
        error: { code: "validacao", message: SALVAR_FALHOU_MSG },
      })
    }
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it("criar-lote-falha: erro do banco no lote devolve salvar_falhou com a mensagem fixa e não revalida", async () => {
    insertSpy.mockResolvedValueOnce({ error: { message: "detalhe interno" } })

    const resultado = await criarAgenda2Item({
      ...valoresValidos,
      data: "2026-10-05",
      repetirSemanas: 8,
    })

    expect(resultado).toEqual({
      error: { code: "salvar_falhou", message: SALVAR_FALHOU_MSG },
    })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(revalidateSpy).not.toHaveBeenCalled()
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

  it("atualizar-ignora-repeticao (D-24/Pitfall 7/T-32-12): repetirSemanas na edição é descartado e nenhuma linha é inserida", async () => {
    selectEscritaSpy.mockResolvedValueOnce({ data: [{ id: ITEM_ID }], error: null })

    const resultado = await atualizarAgenda2Item(ITEM_ID, {
      ...valoresValidos,
      repetirSemanas: 4,
    } as unknown as Agenda2ItemInput)

    expect(resultado).toEqual({ data: true })
    expect(updateSpy).toHaveBeenCalledWith({
      nome_cliente: "Mercado Bom Preço",
      bairro: "Centro",
      data: "2026-09-28",
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it("atualizar-com-textos: os dois textos enviados entram no update, aparados; só espaços vira null", async () => {
    selectEscritaSpy.mockResolvedValue({ data: [{ id: ITEM_ID }], error: null })

    await atualizarAgenda2Item(ITEM_ID, {
      ...valoresValidos,
      oQueFazer: "  Levar amostras ",
      oQueFoiFeito: "Pedido combinado",
    })
    expect(updateSpy).toHaveBeenLastCalledWith({
      nome_cliente: "Mercado Bom Preço",
      bairro: "Centro",
      data: "2026-09-28",
      o_que_fazer: "Levar amostras",
      o_que_foi_feito: "Pedido combinado",
    })

    await atualizarAgenda2Item(ITEM_ID, {
      ...valoresValidos,
      oQueFazer: "   ",
      oQueFoiFeito: null,
    })
    expect(updateSpy).toHaveBeenLastCalledWith({
      nome_cliente: "Mercado Bom Preço",
      bairro: "Centro",
      data: "2026-09-28",
      o_que_fazer: null,
      o_que_foi_feito: null,
    })
  })

  it("atualizar-texto-longo: 501 caracteres devolve validacao e nunca chama update", async () => {
    const resultado = await atualizarAgenda2Item(ITEM_ID, {
      ...valoresValidos,
      oQueFoiFeito: "a".repeat(501),
    })

    expect(resultado).toEqual({
      error: { code: "validacao", message: SALVAR_FALHOU_MSG },
    })
    expect(updateSpy).not.toHaveBeenCalled()
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

  it("concluir-com-resultado: update exatamente { concluido: true, o_que_foi_feito } com o texto aparado", async () => {
    selectEscritaSpy.mockResolvedValueOnce({ data: [{ id: ITEM_ID }], error: null })

    const resultado = await concluirAgenda2Item(ITEM_ID, "  Pedido fechado  ")

    expect(resultado).toEqual({ data: true })
    expect(updateSpy).toHaveBeenCalledWith({
      concluido: true,
      o_que_foi_feito: "Pedido fechado",
    })
  })

  it("concluir-sem-texto: vazio e só espaços concluem gravando o_que_foi_feito null", async () => {
    selectEscritaSpy.mockResolvedValue({ data: [{ id: ITEM_ID }], error: null })

    for (const vazio of ["", "   "]) {
      updateSpy.mockClear()
      const resultado = await concluirAgenda2Item(ITEM_ID, vazio)

      expect(resultado).toEqual({ data: true })
      expect(updateSpy).toHaveBeenCalledWith({
        concluido: true,
        o_que_foi_feito: null,
      })
    }
  })

  it("concluir-resultado-longo: 501 caracteres devolve validacao e nunca chama update", async () => {
    const resultado = await concluirAgenda2Item(ITEM_ID, "a".repeat(501))

    expect(resultado).toEqual({
      error: { code: "validacao", message: SALVAR_FALHOU_MSG },
    })
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it("desmarcar-ok (D-05): update com exatamente { concluido: false }", async () => {
    selectEscritaSpy.mockResolvedValueOnce({ data: [{ id: ITEM_ID }], error: null })

    const resultado = await desmarcarAgenda2Item(ITEM_ID)

    expect(resultado).toEqual({ data: true })
    expect(updateSpy).toHaveBeenCalledWith({ concluido: false })
  })
})

describe("sem-rpc", () => {
  it("sem-rpc: nenhuma das sete ações chama rpc do cliente mockado", async () => {
    getUserSpy.mockResolvedValue({ data: { user: { id: "u1" } } })
    insertSpy.mockResolvedValue({ error: null })
    selectEscritaSpy.mockResolvedValue({ data: [{ id: ITEM_ID }], error: null })
    rangeSpy.mockResolvedValue({ data: [], error: null })

    await getAgenda2Action()
    await getAgenda2PeriodoAction("2026-08-01", "2026-08-31")
    await criarAgenda2Item(valoresValidos)
    await atualizarAgenda2Item(ITEM_ID, valoresValidos)
    await apagarAgenda2Item(ITEM_ID)
    await concluirAgenda2Item(ITEM_ID)
    await desmarcarAgenda2Item(ITEM_ID)

    expect(rpcSpy).not.toHaveBeenCalled()
  })
})
