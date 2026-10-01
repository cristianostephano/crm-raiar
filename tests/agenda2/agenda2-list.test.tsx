// @vitest-environment jsdom
import { addDays, format } from "date-fns"
import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Agenda2List } from "@/components/agenda2/Agenda2List"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Agenda2Item } from "@/lib/agenda2/itens"

vi.mock("@/app/actions/agenda2", () => ({
  getAgenda2Action: vi.fn(),
  criarAgenda2Item: vi.fn(),
  atualizarAgenda2Item: vi.fn(),
  apagarAgenda2Item: vi.fn(),
  concluirAgenda2Item: vi.fn(),
  desmarcarAgenda2Item: vi.fn(),
}))

import {
  apagarAgenda2Item,
  concluirAgenda2Item,
  desmarcarAgenda2Item,
  getAgenda2Action,
} from "@/app/actions/agenda2"
import type { GetAgenda2Result } from "@/app/actions/agenda2"

const mockedGet = vi.mocked(getAgenda2Action)
const mockedConcluir = vi.mocked(concluirAgenda2Item)
const mockedDesmarcar = vi.mocked(desmarcarAgenda2Item)
const mockedApagar = vi.mocked(apagarAgenda2Item)

/** Datas relativas ao relógio real do teste (nunca literais fixas) — mesmo
 * precedente de tests/agenda/agenda-list.test.tsx. */
function dataRelativa(dias: number): string {
  return format(addDays(new Date(), dias), "yyyy-MM-dd")
}

function hoje(): string {
  return new Date().toISOString()
}

function antes(): string {
  return addDays(new Date(), -2).toISOString()
}

let nextId = 0
function buildItem(partial: Partial<Agenda2Item> = {}): Agenda2Item {
  nextId += 1
  return {
    id: `item-${nextId}`,
    nomeCliente: `Cliente ${nextId}`,
    bairro: "Centro",
    data: dataRelativa(0),
    concluido: false,
    atualizadoEm: hoje(),
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

function deferredResult() {
  let resolve!: (value: GetAgenda2Result) => void
  const promise = new Promise<GetAgenda2Result>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

/** Interação com o Select da Base UI: clicar no combobox, depois
 * pointerDown + click na opção — mesmo precedente de
 * tests/agenda/agenda-list.test.tsx. */
async function selecionarVendedor(nome: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Vendedor" }))
  const opcao = await screen.findByRole("option", { name: nome })
  fireEvent.pointerDown(opcao)
  fireEvent.click(opcao)
}

describe("Agenda2List", () => {
  beforeEach(() => {
    mockedGet.mockReset()
    mockedConcluir.mockReset()
    mockedDesmarcar.mockReset()
    mockedApagar.mockReset()
  })

  it("carregando-e-erro: 3 Skeletons enquanto carrega; erro mostra a copy e Tentar novamente recarrega", async () => {
    const { promise, resolve } = deferredResult()
    mockedGet.mockReturnValueOnce(promise)

    const { container } = renderList()

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThanOrEqual(3)

    resolve({
      error: { code: "fetch_falhou", message: "erro interno qualquer" },
    })

    expect(
      await screen.findByText(
        "Não foi possível carregar sua Agenda 2. Tente novamente."
      )
    ).toBeInTheDocument()

    mockedGet.mockResolvedValueOnce({ data: [] })
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))

    expect(
      await screen.findByText("Sua Agenda 2 está vazia")
    ).toBeInTheDocument()
    expect(mockedGet).toHaveBeenCalledTimes(2)
  })

  it("titulo: aparece o título Agenda 2", async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    renderList()

    expect(await screen.findByText("Agenda 2")).toBeInTheDocument()
  })

  it("agrupa-secoes (D-01): ontem/hoje/amanhã viram Atrasado (1)/Hoje (1)/Próximos dias (1) nessa ordem", async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        buildItem({ data: dataRelativa(-1) }),
        buildItem({ data: dataRelativa(0) }),
        buildItem({ data: dataRelativa(1) }),
      ],
    })

    renderList()

    const atrasado = await screen.findByText("Atrasado (1)")
    const hojeTitulo = screen.getByText("Hoje (1)")
    const proximos = screen.getByText("Próximos dias (1)")

    expect(
      atrasado.compareDocumentPosition(hojeTitulo) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      hojeTitulo.compareDocumentPosition(proximos) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("atrasado-destacado (D-02): o cartão do item de ontem tem border-l-red-500", async () => {
    mockedGet.mockResolvedValueOnce({
      data: [buildItem({ nomeCliente: "Padaria Atrasada", data: dataRelativa(-1) })],
    })

    renderList()

    const titulo = await screen.findByText("Padaria Atrasada")
    const card = titulo.closest('[data-slot="card"]')
    expect(card).toHaveClass("border-l-red-500")
  })

  it("ordem-preservada (D-08): dois itens de hoje recebidos como Zeta, Alfa aparecem nessa ordem", async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        buildItem({ nomeCliente: "Zeta" }),
        buildItem({ nomeCliente: "Alfa" }),
      ],
    })

    renderList()

    const zeta = await screen.findByText("Zeta")
    const alfa = screen.getByText("Alfa")

    expect(
      zeta.compareDocumentPosition(alfa) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("concluido-hoje-riscado (D-04): concluído de hoje aparece em Hoje, riscado, com Desmarcar", async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        buildItem({
          nomeCliente: "Mercado Concluído",
          concluido: true,
          atualizadoEm: hoje(),
        }),
      ],
    })

    renderList()

    await screen.findByText("Hoje (1)")
    const titulo = screen.getByText("Mercado Concluído")
    expect(titulo).toHaveClass("line-through")
    expect(
      screen.getByRole("button", { name: "Desmarcar" })
    ).toBeInTheDocument()
  })

  it("concluido-passado-oculto (correção 7): concluído de ontem alterado antes não aparece", async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        buildItem({
          nomeCliente: "Sumido",
          data: dataRelativa(-1),
          concluido: true,
          atualizadoEm: antes(),
        }),
      ],
    })

    renderList()

    await screen.findByText("Sua Agenda 2 está vazia")
    expect(screen.queryByText("Sumido")).not.toBeInTheDocument()
  })

  it("vazio-vendedor (D-10): leitura vazia mostra o estado vazio com botão Adicionar visita", async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    renderList()

    expect(
      await screen.findByText("Sua Agenda 2 está vazia")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Anote aqui quem você vai visitar em cada dia — nome do cliente, bairro e data."
      )
    ).toBeInTheDocument()

    const botoes = screen.getAllByRole("button", { name: "Adicionar visita" })
    expect(botoes.length).toBeGreaterThanOrEqual(1)

    fireEvent.click(botoes[botoes.length - 1])

    expect(await screen.findByLabelText("Nome do cliente")).toBeInTheDocument()
  })

  it("adicionar-pelo-cabecalho: com itens, o botão do cabeçalho abre a janela Adicionar visita", async () => {
    mockedGet.mockResolvedValueOnce({ data: [buildItem()] })

    renderList()

    await screen.findByText("Hoje (1)")
    fireEvent.click(screen.getByRole("button", { name: "Adicionar visita" }))

    expect(await screen.findByLabelText("Nome do cliente")).toBeInTheDocument()
  })

  it("concluir-recarrega (AGD2-05): Concluir chama concluirAgenda2Item uma vez e recarrega", async () => {
    mockedGet.mockResolvedValueOnce({
      data: [buildItem({ nomeCliente: "Padaria Central" })],
    })
    mockedConcluir.mockResolvedValueOnce({ data: true })
    mockedGet.mockResolvedValueOnce({ data: [] })

    renderList()

    await screen.findByText("Padaria Central")
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    await vi.waitFor(() => {
      expect(mockedConcluir).toHaveBeenCalledTimes(1)
    })
    await vi.waitFor(() => {
      expect(mockedGet).toHaveBeenCalledTimes(2)
    })
  })

  it("desmarcar-recarrega (D-05): em concluído de hoje, Desmarcar chama desmarcarAgenda2Item e recarrega", async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        buildItem({
          nomeCliente: "Padaria Concluída",
          concluido: true,
          atualizadoEm: hoje(),
        }),
      ],
    })
    mockedDesmarcar.mockResolvedValueOnce({ data: true })
    mockedGet.mockResolvedValueOnce({ data: [] })

    renderList()

    await screen.findByText("Padaria Concluída")
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar" }))

    await vi.waitFor(() => {
      expect(mockedDesmarcar).toHaveBeenCalledTimes(1)
    })
    await vi.waitFor(() => {
      expect(mockedGet).toHaveBeenCalledTimes(2)
    })
  })

  it("apagar-com-confirmacao (AGD2-04): Apagar abre confirmação; confirmar chama a action e recarrega; Cancelar não chama", async () => {
    mockedGet.mockResolvedValueOnce({
      data: [buildItem({ nomeCliente: "Padaria Para Apagar" })],
    })

    renderList()

    await screen.findByText("Padaria Para Apagar")
    fireEvent.click(screen.getByRole("button", { name: "Apagar" }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Apagar item")).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }))
    expect(mockedApagar).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Apagar" }))
    mockedApagar.mockResolvedValueOnce({ data: true })
    mockedGet.mockResolvedValueOnce({ data: [] })

    const dialog2 = await screen.findByRole("dialog")
    fireEvent.click(within(dialog2).getByRole("button", { name: "Apagar" }))

    await vi.waitFor(() => {
      expect(mockedApagar).toHaveBeenCalledTimes(1)
    })
    await vi.waitFor(() => {
      expect(mockedGet).toHaveBeenCalledTimes(2)
    })
  })

  it("editar-concluido (AGD2-03/D-06): Editar num concluído abre Editar item com o nome preenchido", async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        buildItem({
          nomeCliente: "Padaria Editável",
          concluido: true,
          atualizadoEm: hoje(),
        }),
      ],
    })

    renderList()

    await screen.findByText("Padaria Editável")
    fireEvent.click(screen.getByRole("button", { name: "Editar" }))

    expect(await screen.findByText("Editar item")).toBeInTheDocument()
    expect(screen.getByLabelText("Nome do cliente")).toHaveValue(
      "Padaria Editável"
    )
  })

  it("falha-acao: concluirAgenda2Item com erro mostra role=alert com a mensagem genérica", async () => {
    mockedGet.mockResolvedValueOnce({
      data: [buildItem({ nomeCliente: "Padaria Falha" })],
    })
    mockedConcluir.mockResolvedValueOnce({
      error: { code: "salvar_falhou", message: "erro cru do banco" },
    })

    renderList()

    await screen.findByText("Padaria Falha")
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível salvar. Tente novamente."
    )
  })

  it("sem-busca-e-extras (D-11): não há busca, exportar nem abas de calendário", async () => {
    mockedGet.mockResolvedValueOnce({ data: [buildItem()] })

    renderList()

    await screen.findByText("Hoje (1)")
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
    expect(screen.queryByText(/Exportar/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Mês" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Semana" })
    ).not.toBeInTheDocument()
  })

  it("supervisor-filtro (AGD2-07/D-17/D-18): rótulo Vendedor, Todos os vendedores, os dois itens com nome, e filtrar por Bruno Lima", async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
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
      ],
    })

    renderList({ isSupervisor: true })

    await screen.findByText("Vendedor")
    expect(screen.getByText("Todos os vendedores")).toBeInTheDocument()
    expect(screen.getByText("Cliente da Ana")).toBeInTheDocument()
    expect(screen.getByText("Cliente do Bruno")).toBeInTheDocument()
    expect(screen.getAllByText("Ana Souza").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Bruno Lima").length).toBeGreaterThan(0)

    await selecionarVendedor("Bruno Lima")

    expect(screen.getByText("Cliente do Bruno")).toBeInTheDocument()
    expect(screen.queryByText("Cliente da Ana")).not.toBeInTheDocument()
  })

  it("supervisor-somente-leitura (D-16): nenhum botão de escrita aparece para o Supervisor", async () => {
    mockedGet.mockResolvedValueOnce({
      data: [
        buildItem({
          nomeCliente: "Cliente do Time",
          responsavel: "v-ana",
          responsavelNome: "Ana Souza",
        }),
      ],
    })

    renderList({ isSupervisor: true })

    await screen.findByText("Cliente do Time")
    expect(
      screen.queryByRole("button", { name: "Adicionar visita" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Editar" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Apagar" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Concluir" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Desmarcar" })
    ).not.toBeInTheDocument()
  })

  it("supervisor-vazio: leitura vazia para o Supervisor mostra a copy do time sem botão de adicionar", async () => {
    mockedGet.mockResolvedValueOnce({ data: [] })

    renderList({ isSupervisor: true })

    expect(
      await screen.findByText("Nenhum item na Agenda 2 do time")
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Adicionar visita" })
    ).not.toBeInTheDocument()
  })
})
