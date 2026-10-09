// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DashboardClient } from "@/components/dashboard/DashboardClient"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * Testes da tela do Dashboard com o seletor "Vendedor" (quick 261009-npp).
 * Renderiza o DashboardClient REAL (quadros reais); so as Server Actions sao
 * dubles que devolvem { data: [] }. Vendedores inventados: "Alice Teste" e
 * "Bruno Teste". Nenhum banco e tocado.
 */
vi.mock("@/app/actions/dashboard", () => ({
  getClientesPorEtapaAction: vi.fn(),
  getFunilDetalhadoAction: vi.fn(),
  getTempoAteFechamentoAction: vi.fn(),
  getGanhosPerdidosAction: vi.fn(),
  getDesempenhoVendedorAction: vi.fn(),
  getProspeccaoPorProdutoAction: vi.fn(),
  getProspeccaoPorCategoriaAction: vi.fn(),
  getComparativoVendedorAction: vi.fn(),
}))

import {
  getClientesPorEtapaAction,
  getComparativoVendedorAction,
  getDesempenhoVendedorAction,
  getFunilDetalhadoAction,
  getGanhosPerdidosAction,
  getProspeccaoPorCategoriaAction,
  getProspeccaoPorProdutoAction,
  getTempoAteFechamentoAction,
} from "@/app/actions/dashboard"

const ID_ALICE = "11111111-1111-4111-8111-111111111111"
const ID_BRUNO = "22222222-2222-4222-8222-222222222222"
const VENDEDORES = [
  { id: ID_ALICE, nome: "Alice Teste" },
  { id: ID_BRUNO, nome: "Bruno Teste" },
]
const AVISO =
  "Comparativo por vendedor e Desempenho por vendedor continuam mostrando todos os vendedores."

const acoes = {
  clientes: vi.mocked(getClientesPorEtapaAction),
  funil: vi.mocked(getFunilDetalhadoAction),
  tempo: vi.mocked(getTempoAteFechamentoAction),
  ganhos: vi.mocked(getGanhosPerdidosAction),
  desempenho: vi.mocked(getDesempenhoVendedorAction),
  produto: vi.mocked(getProspeccaoPorProdutoAction),
  categoria: vi.mocked(getProspeccaoPorCategoriaAction),
  comparativo: vi.mocked(getComparativoVendedorAction),
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  for (const acao of Object.values(acoes)) {
    acao.mockReset()
    // Dublê generico: todas as acoes devolvem { data: [] }.
    ;(acao as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] })
  }
})

function renderDashboard(props: { isSupervisor: boolean }) {
  return render(
    <TooltipProvider>
      <DashboardClient {...props} vendedorOptions={VENDEDORES} />
    </TooltipProvider>
  )
}

async function escolher(nome: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Vendedor" }))
  const opcao = await screen.findByRole("option", { name: nome })
  // Base UI so comete o clique quando precedido de pointerdown no mesmo item.
  fireEvent.pointerDown(opcao)
  fireEvent.click(opcao)
}

function ultima(mock: { mock: { calls: unknown[][] } }): unknown[] {
  return mock.mock.calls[mock.mock.calls.length - 1]
}

async function esperarSeisQuadrosCom(vendedor: string | null) {
  await waitFor(() => {
    expect(ultima(acoes.clientes)).toEqual([vendedor])
    expect(ultima(acoes.funil)).toEqual([vendedor])
    expect(ultima(acoes.tempo)).toEqual([vendedor])
    for (const periodo of [acoes.ganhos, acoes.produto, acoes.categoria]) {
      const argumentos = ultima(periodo)
      expect(argumentos).toHaveLength(3)
      expect(argumentos[0]).toBeInstanceOf(Date)
      expect(argumentos[1]).toBeInstanceOf(Date)
      expect(argumentos[2]).toBe(vendedor)
    }
  })
}

describe("dashboard-filtro-vendedor: seletor Vendedor no Dashboard (so Supervisor)", () => {
  it("vendedor-nao-ve-filtro", async () => {
    renderDashboard({ isSupervisor: false })

    expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument()
    expect(screen.queryByText("Todos os vendedores")).not.toBeInTheDocument()
    expect(screen.getByText("Seus números de vendas")).toBeInTheDocument()
    await esperarSeisQuadrosCom(null)
  })

  it("supervisor-ve-todos-e-ativos", async () => {
    renderDashboard({ isSupervisor: true })

    const seletor = screen.getByRole("combobox", { name: "Vendedor" })
    expect(seletor).toHaveTextContent("Todos os vendedores")
    expect(screen.getByText("Números da equipe")).toBeInTheDocument()

    fireEvent.click(seletor)
    const opcoes = await screen.findAllByRole("option")
    expect(opcoes.map((opcao) => opcao.textContent)).toEqual([
      "Todos os vendedores",
      "Alice Teste",
      "Bruno Teste",
    ])
  })

  it("escolher-vendedor-filtra-seis-quadros", async () => {
    renderDashboard({ isSupervisor: true })
    await esperarSeisQuadrosCom(null)
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()

    await escolher("Alice Teste")

    await esperarSeisQuadrosCom(ID_ALICE)
    expect(screen.getByText("Números de Alice Teste")).toBeInTheDocument()
    expect(screen.getByText(AVISO)).toBeInTheDocument()
  })

  it("comparacoes-nao-filtram", async () => {
    renderDashboard({ isSupervisor: true })
    await escolher("Alice Teste")
    await esperarSeisQuadrosCom(ID_ALICE)

    expect(acoes.comparativo).toHaveBeenCalled()
    for (const chamada of acoes.comparativo.mock.calls) {
      expect(chamada).toHaveLength(0)
    }
    expect(acoes.desempenho).toHaveBeenCalled()
    for (const chamada of acoes.desempenho.mock.calls) {
      expect(chamada).toHaveLength(2)
    }
  })

  it("voltar-para-todos", async () => {
    renderDashboard({ isSupervisor: true })
    await escolher("Alice Teste")
    await esperarSeisQuadrosCom(ID_ALICE)

    await escolher("Todos os vendedores")

    await esperarSeisQuadrosCom(null)
    expect(screen.getByText("Números da equipe")).toBeInTheDocument()
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument()
  })

  it("vazio-do-vendedor", async () => {
    renderDashboard({ isSupervisor: true })

    expect(await screen.findAllByText("Nenhum cliente cadastrado ainda.")).toHaveLength(2)

    await escolher("Alice Teste")

    await waitFor(() => {
      expect(screen.getAllByText("Nenhum cliente deste vendedor.")).toHaveLength(2)
    })
    expect(screen.queryByText("Nenhum cliente cadastrado ainda.")).not.toBeInTheDocument()
  })
})
