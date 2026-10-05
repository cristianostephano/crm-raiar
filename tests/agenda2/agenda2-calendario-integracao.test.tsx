// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Agenda2List } from "@/components/agenda2/Agenda2List"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Agenda2Item } from "@/lib/agenda2/itens"

// Integração Lista <-> Calendário da Agenda 2 (AGD2-08, D-16/D-28/D-30).
// As sete ações de servidor são simuladas; o relógio falso é só para Date
// (sexta-feira 2026-08-14), o resto dos timers continua real.
vi.mock("@/app/actions/agenda2", () => ({
  getAgenda2Action: vi.fn(),
  getAgenda2PeriodoAction: vi.fn(),
  criarAgenda2Item: vi.fn(),
  atualizarAgenda2Item: vi.fn(),
  apagarAgenda2Item: vi.fn(),
  concluirAgenda2Item: vi.fn(),
  desmarcarAgenda2Item: vi.fn(),
}))

import {
  concluirAgenda2Item,
  getAgenda2Action,
  getAgenda2PeriodoAction,
} from "@/app/actions/agenda2"

const mockedGet = vi.mocked(getAgenda2Action)
const mockedPeriodo = vi.mocked(getAgenda2PeriodoAction)
const mockedConcluir = vi.mocked(concluirAgenda2Item)

let nextId = 0
function buildItem(partial: Partial<Agenda2Item> = {}): Agenda2Item {
  nextId += 1
  return {
    id: `item-${nextId}`,
    nomeCliente: `Cliente ${nextId}`,
    bairro: "Centro",
    data: "2026-08-14",
    concluido: false,
    atualizadoEm: "2026-08-14T12:00:00.000Z",
    responsavel: "vendedor-1",
    responsavelNome: "Vendedor Um",
    ...partial,
  }
}

function renderList(props: Partial<ComponentProps<typeof Agenda2List>> = {}) {
  return render(
    <TooltipProvider>
      <Agenda2List isSupervisor={false} {...props} />
    </TooltipProvider>
  )
}

/** Mesmas duas leituras (Lista e período) devolvem os mesmos itens. */
function simularLeituras(itens: Agenda2Item[]) {
  mockedGet.mockResolvedValue({ data: itens })
  mockedPeriodo.mockResolvedValue({ data: itens })
}

async function abrirDia(dia: string) {
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(dia) }))
  return screen.getByRole("dialog")
}

describe("Agenda2List + Agenda2Calendario (integração, plano 32-07)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 7, 14, 10, 0))
    mockedGet.mockReset()
    mockedPeriodo.mockReset()
    mockedConcluir.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("alternar-visoes (AGD2-08): Lista por padrão; Mês esconde as seções e lê o período; Lista traz as seções de volta", async () => {
    simularLeituras([
      buildItem({ data: "2026-08-13" }),
      buildItem({ data: "2026-08-14" }),
      buildItem({ data: "2026-08-17" }),
    ])

    renderList()

    expect(await screen.findByText("Atrasado (1)")).toBeInTheDocument()
    expect(screen.getByText("Hoje (1)")).toBeInTheDocument()
    expect(screen.getByText("Próximos dias (1)")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Lista" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(mockedPeriodo).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Mês" }))

    expect(screen.queryByText("Atrasado (1)")).not.toBeInTheDocument()
    expect(screen.queryByText("Hoje (1)")).not.toBeInTheDocument()
    expect(screen.queryByText("Próximos dias (1)")).not.toBeInTheDocument()
    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(1))
    expect(mockedPeriodo).toHaveBeenCalledWith("2026-07-27", "2026-09-06")
    expect(await screen.findByText("Agosto de 2026")).toBeInTheDocument()
    // O seletor continua visível: é o caminho de volta.
    expect(screen.getByRole("button", { name: "Lista" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Lista" }))

    expect(screen.getByText("Atrasado (1)")).toBeInTheDocument()
    expect(screen.getByText("Hoje (1)")).toBeInTheDocument()
    expect(screen.getByText("Próximos dias (1)")).toBeInTheDocument()
  })

  it("concluido-passado-so-no-calendario (D-28/D-29): escondido na Lista, riscado no Mês", async () => {
    const antigo = buildItem({
      nomeCliente: "Padaria do Passado",
      data: "2026-08-04",
      concluido: true,
      atualizadoEm: "2026-08-05T12:00:00.000Z",
    })
    simularLeituras([antigo])

    renderList()

    await screen.findByText("Sua Agenda está vazia")
    expect(screen.queryByText("Padaria do Passado")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Mês" }))

    const nome = await screen.findByText("Padaria do Passado")
    expect(nome).toHaveClass("line-through")
  })

  it("filtro-nas-duas-visoes (D-30): o filtro Vendedor do Supervisor estreita a Lista e o Mês", async () => {
    simularLeituras([
      buildItem({
        nomeCliente: "Cliente da Ana",
        responsavel: "v-ana",
        responsavelNome: "Ana Souza",
      }),
      buildItem({
        nomeCliente: "Cliente do Bruno",
        responsavel: "v-bruno",
        responsavelNome: "Bruno Lima",
      }),
    ])

    renderList({ isSupervisor: true })

    await screen.findByText("Hoje (2)")

    fireEvent.click(screen.getByRole("button", { name: "Mês" }))
    expect(await screen.findByText("Cliente da Ana")).toBeInTheDocument()
    expect(screen.getByText("Cliente do Bruno")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("combobox", { name: "Vendedor" }))
    const opcao = await screen.findByRole("option", { name: "Bruno Lima" })
    fireEvent.pointerDown(opcao)
    fireEvent.click(opcao)

    expect(screen.getByText("Cliente do Bruno")).toBeInTheDocument()
    expect(screen.queryByText("Cliente da Ana")).not.toBeInTheDocument()

    // A mesma escolha vale na Lista.
    fireEvent.click(screen.getByRole("button", { name: "Lista" }))
    expect(await screen.findByText("Hoje (1)")).toBeInTheDocument()
    expect(screen.getByText("Cliente do Bruno")).toBeInTheDocument()
    expect(screen.queryByText("Cliente da Ana")).not.toBeInTheDocument()
  })

  it("concluir-no-calendario-recarrega: Concluir no diálogo do dia chama a ação uma vez e relê Lista e período (reloadKey)", async () => {
    simularLeituras([buildItem({ nomeCliente: "Padaria Central" })])
    mockedConcluir.mockResolvedValue({ data: true })

    renderList()

    await screen.findByText("Hoje (1)")
    fireEvent.click(screen.getByRole("button", { name: "Mês" }))
    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(1))

    const dialogo = await abrirDia("14 de agosto")
    fireEvent.click(within(dialogo).getByRole("button", { name: "Concluir" }))

    await waitFor(() => expect(mockedConcluir).toHaveBeenCalledTimes(1))
    expect(mockedConcluir).toHaveBeenCalledWith(expect.stringMatching(/^item-/))
    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(2))
  })

  it("editar-no-calendario-abre-formulario: Editar no diálogo do dia abre Editar item com o nome preenchido", async () => {
    simularLeituras([buildItem({ nomeCliente: "Padaria Editável" })])

    renderList()

    await screen.findByText("Hoje (1)")
    fireEvent.click(screen.getByRole("button", { name: "Mês" }))

    const dialogo = await abrirDia("14 de agosto")
    fireEvent.click(within(dialogo).getByRole("button", { name: "Editar" }))

    expect(await screen.findByText("Editar item")).toBeInTheDocument()
    expect(screen.getByLabelText("Nome do cliente")).toHaveValue(
      "Padaria Editável"
    )
  })

  it("adicionar-no-calendario: no Mês, Adicionar visita abre a janela com o campo Repetir", async () => {
    simularLeituras([buildItem()])

    renderList()

    await screen.findByText("Hoje (1)")
    fireEvent.click(screen.getByRole("button", { name: "Mês" }))
    await screen.findByText("Agosto de 2026")

    fireEvent.click(screen.getByRole("button", { name: "Adicionar visita" }))

    expect(await screen.findByLabelText("Nome do cliente")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Repetir" })).toBeInTheDocument()
  })

  it("supervisor-somente-leitura-no-calendario (D-16): sem Editar, Apagar, Concluir, Desmarcar nem Adicionar visita", async () => {
    simularLeituras([
      buildItem({
        nomeCliente: "Cliente do Time",
        responsavel: "v-ana",
        responsavelNome: "Ana Souza",
      }),
    ])

    renderList({ isSupervisor: true })

    await screen.findByText("Cliente do Time")
    fireEvent.click(screen.getByRole("button", { name: "Mês" }))

    const dialogo = await abrirDia("14 de agosto")
    expect(within(dialogo).getByText("Cliente do Time")).toBeInTheDocument()

    for (const nome of ["Editar", "Apagar", "Concluir", "Desmarcar"]) {
      expect(
        screen.queryByRole("button", { name: nome })
      ).not.toBeInTheDocument()
    }
    expect(
      screen.queryByRole("button", { name: "Adicionar visita" })
    ).not.toBeInTheDocument()
  })
})
