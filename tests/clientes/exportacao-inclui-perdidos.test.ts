import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Guarda de regressão do D-07 (Fase 28) — o Kanban de `/clientes` agora
 * esconde ganho E perdido (D-06); "Exportar todos" é hoje o único jeito de
 * tirar a base completa do sistema. A quick task 260915-ls7 já resolveu isso
 * para "ganho" com a bandeira `escopoTudo` + uma leitura de exportação SEM
 * filtro de status (`getClientesParaExportacao`) — este arquivo trava esse
 * contrato para não regredir silenciosamente quando "perdido" também sair do
 * Kanban nesta fase.
 *
 * Molde de mock de tests/clientes/todas-cidades.test.ts: `from().select()`
 * só expõe DOIS métodos — `order` (caminho sem ids, paginado) e `in`
 * (caminho com ids). Nenhum método de filtro de status no mock: se algum dia
 * alguém acrescentar um `.not`/`.neq` de status em qualquer caminho, a
 * chamada estoura e o teste falha alto.
 */
const { rangeSpy, inSpy } = vi.hoisted(() => ({
  rangeSpy: vi.fn(),
  inSpy: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          range: rangeSpy,
        }),
        in: inSpy,
      }),
    }),
  }),
}))

import { getClientesParaExportacao } from "@/lib/supabase/queries/clientes"

type ExportQueryRow = {
  razao_social: string
  cep: string | null
  rua: string | null
  numero: string | null
  complemento: string | null
  cidade: string | null
  estado: string | null
  categorias: { nome: string } | null
  profiles: { nome: string; sobrenome: string } | null
  contato: string | null
  telefone: string | null
  email: string | null
  numero_de_lojas: number | null
  cliente_produtos: never[]
  etapa: string
  status_acompanhamento: "em_andamento" | "perdido" | "ganho"
  observacao: string | null
}

function linha(overrides: Partial<ExportQueryRow> = {}): ExportQueryRow {
  return {
    razao_social: "Distribuidora Fictícia",
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    complemento: null,
    cidade: "São Paulo",
    estado: "SP",
    categorias: null,
    profiles: null,
    contato: null,
    telefone: null,
    email: null,
    numero_de_lojas: null,
    cliente_produtos: [],
    etapa: "aguardando_contato",
    status_acompanhamento: "em_andamento",
    observacao: null,
    ...overrides,
  }
}

beforeEach(() => {
  rangeSpy.mockReset()
  inSpy.mockReset()
})

describe("getClientesParaExportacao continua trazendo perdidos e ganhos (Fase 28, D-07)", () => {
  it("escopo-tudo: getClientesParaExportacao(null) devolve as 3 linhas, na mesma ordem", async () => {
    rangeSpy.mockResolvedValueOnce({
      data: [
        linha({ razao_social: "Em andamento", status_acompanhamento: "em_andamento" }),
        linha({ razao_social: "Perdido", status_acompanhamento: "perdido" }),
        linha({
          razao_social: "Ganho",
          etapa: "primeira_venda",
          status_acompanhamento: "ganho",
        }),
      ],
      error: null,
    })

    const rows = await getClientesParaExportacao(null)

    expect(rows.map((r) => r.statusAcompanhamento)).toEqual([
      "em_andamento",
      "perdido",
      "ganho",
    ])
    expect(inSpy).not.toHaveBeenCalled()
  })

  it("lista-vazia: getClientesParaExportacao([]) segue o mesmo caminho paginado e também devolve o perdido", async () => {
    rangeSpy.mockResolvedValueOnce({
      data: [
        linha({ razao_social: "Em andamento", status_acompanhamento: "em_andamento" }),
        linha({ razao_social: "Perdido", status_acompanhamento: "perdido" }),
      ],
      error: null,
    })

    const rows = await getClientesParaExportacao([])

    expect(rows.map((r) => r.statusAcompanhamento)).toEqual([
      "em_andamento",
      "perdido",
    ])
    expect(inSpy).not.toHaveBeenCalled()
  })

  it("com-ids: getClientesParaExportacao(['id-perdido']) devolve a linha perdida com statusAcompanhamento 'perdido'", async () => {
    inSpy.mockResolvedValueOnce({
      data: [linha({ razao_social: "Perdido", status_acompanhamento: "perdido" })],
      error: null,
    })

    const rows = await getClientesParaExportacao(["id-perdido"])

    expect(rows).toHaveLength(1)
    expect(rows[0].statusAcompanhamento).toBe("perdido")
    expect(rangeSpy).not.toHaveBeenCalled()
  })

  it("fonte-sem-regra: getClientesParaExportacao não importa a regra de prospecção, e a rota de exportação não importa o módulo", () => {
    const clientesSource = readFileSync(
      resolve(__dirname, "../../lib/supabase/queries/clientes.ts"),
      "utf8"
    )

    const startMarker = "export async function getClientesParaExportacao("
    const startIndex = clientesSource.indexOf(startMarker)
    expect(startIndex).toBeGreaterThanOrEqual(0)

    const nextExportIndex = clientesSource.indexOf("\nexport ", startIndex + startMarker.length)
    expect(nextExportIndex).toBeGreaterThan(startIndex)

    const functionBody = clientesSource.slice(startIndex, nextExportIndex)

    for (const proibido of [
      "STATUS_FORA_DA_PROSPECCAO",
      "apareceNaProspeccao",
      ".not(",
      ".neq(",
    ]) {
      expect(functionBody).not.toContain(proibido)
    }

    const routeSource = readFileSync(
      resolve(__dirname, "../../app/api/clientes/exportar/route.ts"),
      "utf8"
    )
    expect(routeSource).not.toContain("@/lib/funil/prospeccao")
  })
})
