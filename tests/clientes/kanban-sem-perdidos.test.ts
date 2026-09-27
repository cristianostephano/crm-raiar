import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Unit test for getClientesAgrupadosPorEtapa (Fase 28, PERD-01/D-06/D-08;
 * Fase 29, D-13) — prova, com mock de @/lib/supabase/server, que:
 *   (1) o leitor do Kanban manda o filtro de exclusão certo ao PostgREST
 *       (.not("status_acompanhamento", "in", "(ganho,perdido,encerrado)")),
 *       montado a partir de STATUS_FORA_DA_PROSPECCAO_LISTA
 *       (lib/funil/prospeccao.ts);
 *   (2) a guarda do laço de agrupamento descarta perdido/ganho/encerrado
 *       mesmo que o filtro SQL acima seja removido por engano numa edição
 *       futura — as duas aplicações da regra nunca podem divergir;
 *   (3) um cliente reaberto (em_andamento numa etapa do meio) reaparece na
 *       etapa em que já estava (D-08).
 *
 * Molde de tests/clientes/todas-cidades.test.ts: vi.hoisted() cria os
 * espiões antes do vi.mock içado, e o mock só expõe o método `not` na ponta
 * de select() — nenhum `.neq`/`.eq` de filtro de status no mock, então se o
 * código de produção voltar a usar uma desigualdade simples em vez do
 * `.not(..., "in", ...)`, a chamada estoura e o teste falha alto.
 */
const { notSpy, rangeSpy } = vi.hoisted(() => ({
  notSpy: vi.fn(),
  rangeSpy: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        not: (...args: unknown[]) => {
          notSpy(...args)
          return {
            order: () => ({
              order: () => ({
                range: rangeSpy,
              }),
            }),
          }
        },
      }),
    }),
  }),
}))

import { ETAPA_KEYS } from "@/lib/funil/etapas"
import { STATUS_FORA_DA_PROSPECCAO_LISTA } from "@/lib/funil/prospeccao"
import { getClientesAgrupadosPorEtapa } from "@/lib/supabase/queries/clientes"

type MockClienteRow = {
  id: string
  razao_social: string
  nome_fantasia: string | null
  categoria_id: string | null
  categorias: { nome: string } | null
  responsavel: string
  profiles: { nome: string; sobrenome: string } | null
  etapa: (typeof ETAPA_KEYS)[number]
  status_acompanhamento: "em_andamento" | "perdido" | "ganho" | "encerrado"
  cidade: string | null
  estado: string | null
  contato: string | null
  telefone: string | null
  email: string | null
  numero_de_lojas: number | null
  posicao: number
  etapa_alterada_em: string
  tarefas: never[]
  cliente_produtos: never[]
}

/** Fábrica de linha no formato `ClienteRow` completo, nomes inventados. */
function linha(overrides: Partial<MockClienteRow> = {}): MockClienteRow {
  return {
    id: `id-${Math.random().toString(36).slice(2, 8)}`,
    razao_social: "Distribuidora Fictícia",
    nome_fantasia: null,
    categoria_id: null,
    categorias: null,
    responsavel: "vendedor-ficticio",
    profiles: null,
    etapa: "aguardando_contato",
    status_acompanhamento: "em_andamento",
    cidade: null,
    estado: null,
    contato: null,
    telefone: null,
    email: null,
    numero_de_lojas: null,
    posicao: 1,
    etapa_alterada_em: new Date().toISOString(),
    tarefas: [],
    cliente_produtos: [],
    ...overrides,
  }
}

/** Faz rangeSpy devolver uma única página com `rows` (sempre < 1000, então
 * buscarPaginado termina a paginação numa só chamada). */
function simularUmaPagina(rows: MockClienteRow[]) {
  rangeSpy.mockReset()
  rangeSpy.mockResolvedValueOnce({ data: rows, error: null })
}

beforeEach(() => {
  notSpy.mockClear()
  rangeSpy.mockReset()
})

describe("getClientesAgrupadosPorEtapa (Fase 28, PERD-01/D-06/D-08)", () => {
  it("filtro-sql: chama o filtro de exclusão uma vez com os argumentos exatos", async () => {
    simularUmaPagina([])

    await getClientesAgrupadosPorEtapa()

    expect(notSpy).toHaveBeenCalledTimes(1)
    expect(notSpy).toHaveBeenCalledWith(
      "status_acompanhamento",
      "in",
      `(${STATUS_FORA_DA_PROSPECCAO_LISTA.join(",")})`
    )
    expect(notSpy).toHaveBeenCalledWith(
      "status_acompanhamento",
      "in",
      "(ganho,perdido,encerrado)"
    )
  })

  it("guarda-do-laco: com uma linha em_andamento, uma perdido, uma ganho e uma encerrada na mesma página, só a em_andamento aparece no agrupamento", async () => {
    simularUmaPagina([
      linha({
        id: "cliente-em-andamento",
        etapa: "aguardando_contato",
        status_acompanhamento: "em_andamento",
      }),
      linha({
        id: "cliente-perdido",
        etapa: "aguardando_contato",
        status_acompanhamento: "perdido",
      }),
      linha({
        id: "cliente-ganho",
        etapa: "aguardando_contato",
        status_acompanhamento: "ganho",
      }),
      linha({
        id: "cliente-encerrado",
        etapa: "aguardando_contato",
        status_acompanhamento: "encerrado",
      }),
    ])

    const grouped = await getClientesAgrupadosPorEtapa()

    expect(grouped.aguardando_contato.map((c) => c.id)).toEqual([
      "cliente-em-andamento",
    ])

    for (const key of ETAPA_KEYS) {
      if (key === "aguardando_contato") continue
      expect(grouped[key]).toEqual([])
    }
  })

  it("reaberto: um cliente em_andamento numa etapa do meio aparece na coluna dessa etapa (D-08)", async () => {
    simularUmaPagina([
      linha({
        id: "cliente-reaberto",
        etapa: "aguardando_feedback",
        status_acompanhamento: "em_andamento",
      }),
    ])

    const grouped = await getClientesAgrupadosPorEtapa()

    expect(grouped.aguardando_feedback.map((c) => c.id)).toEqual([
      "cliente-reaberto",
    ])
  })
})
