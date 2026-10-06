// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { Agenda2Calendario } from "@/components/agenda2/Agenda2Calendario"
import { TooltipProvider } from "@/components/ui/tooltip"
import { rotuloDoPeriodo } from "@/lib/agenda/itens"
import type { Agenda2Item } from "@/lib/agenda2/itens"

vi.mock("@/app/actions/agenda2", () => ({
  getAgenda2PeriodoAction: vi.fn(),
}))

import { getAgenda2PeriodoAction } from "@/app/actions/agenda2"
import type { GetAgenda2Result } from "@/app/actions/agenda2"

const mockedPeriodo = vi.mocked(getAgenda2PeriodoAction)

// Sexta-feira 2026-08-14. Mês visível: grade de 27/07 a 06/09 (42 células).
const NOW = new Date(2026, 7, 14, 10, 0)

function buildItem(partial: Partial<Agenda2Item> = {}): Agenda2Item {
  return {
    id: "i1",
    nomeCliente: "Mercado Bom Preço",
    bairro: "Centro",
    data: "2026-08-12",
    concluido: false,
    atualizadoEm: "2026-08-12T12:00:00.000Z",
    responsavel: "v1",
    responsavelNome: "Ana Souza",
    oQueFazer: null,
    oQueFoiFeito: null,
    ...partial,
  }
}

type Props = ComponentProps<typeof Agenda2Calendario>

function propsBase(partial: Partial<Props> = {}): Props {
  return {
    visao: "mes",
    onVisaoChange: vi.fn(),
    reloadKey: 0,
    vendedorFiltroId: null,
    showResponsavel: false,
    podeAlterar: true,
    salvandoId: null,
    onEditar: vi.fn(),
    onApagar: vi.fn(),
    onConcluir: vi.fn(),
    onDesmarcar: vi.fn(),
    now: NOW,
    ...partial,
  }
}

function ui(partial: Partial<Props> = {}) {
  return (
    <TooltipProvider>
      <Agenda2Calendario {...propsBase(partial)} />
    </TooltipProvider>
  )
}

function renderCalendario(partial: Partial<Props> = {}) {
  const resultado = render(ui(partial))
  return {
    ...resultado,
    rerenderCom: (novas: Partial<Props> = {}) =>
      resultado.rerender(ui(novas)),
  }
}

function deferred() {
  let resolve!: (valor: GetAgenda2Result) => void
  const promise = new Promise<GetAgenda2Result>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function celulasDoMes() {
  return screen.queryAllByRole("button", { name: /visitas?$/ })
}

describe("Agenda2Calendario — leitura do período visível", () => {
  beforeEach(() => {
    mockedPeriodo.mockReset()
    mockedPeriodo.mockResolvedValue({ data: [] })
  })

  it("lista-nao-busca: só o seletor e nenhuma leitura", async () => {
    const { container } = renderCalendario({ visao: "lista" })

    for (const nome of ["Lista", "Dia", "Semana", "Mês"]) {
      expect(screen.getByRole("button", { name: nome })).toBeInTheDocument()
    }
    expect(
      screen.queryByRole("button", { name: "Hoje" })
    ).not.toBeInTheDocument()
    expect(celulasDoMes()).toHaveLength(0)
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull()

    await Promise.resolve()
    expect(mockedPeriodo).not.toHaveBeenCalled()
  })

  it("mes-pede-periodo-visivel: pede só a grade do mês e mostra 42 células", async () => {
    renderCalendario({ visao: "mes" })

    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(1))
    expect(mockedPeriodo).toHaveBeenCalledWith("2026-07-27", "2026-09-06")

    expect(await screen.findAllByRole("button", { name: /visitas?$/ })).toHaveLength(
      42
    )
    expect(screen.getByText("Agosto de 2026")).toBeInTheDocument()
  })

  it("semana-e-dia: cada visão pede só o seu intervalo", async () => {
    const semana = renderCalendario({ visao: "semana" })

    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(1))
    expect(mockedPeriodo).toHaveBeenCalledWith("2026-08-10", "2026-08-16")
    const cabecalho = await screen.findAllByText(
      /^(Seg|Ter|Qua|Qui|Sex|Sab|Dom)$/
    )
    expect(cabecalho[0]).toHaveTextContent("Seg")

    semana.unmount()
    mockedPeriodo.mockClear()

    renderCalendario({ visao: "dia" })

    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(1))
    expect(mockedPeriodo).toHaveBeenCalledWith("2026-08-14", "2026-08-14")
    expect(
      await screen.findByRole("heading", { name: rotuloDoPeriodo(NOW, "dia") })
    ).toBeInTheDocument()
  })

  it("uma-busca-por-periodo (Pitfall 5): re-render sem mudar o período não refaz a leitura", async () => {
    const { rerenderCom } = renderCalendario({ visao: "mes" })
    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(1))
    await screen.findAllByRole("button", { name: /visitas?$/ })

    rerenderCom({ visao: "mes", now: new Date(NOW.getTime()) })
    await Promise.resolve()

    expect(mockedPeriodo).toHaveBeenCalledTimes(1)
  })

  it("reloadKey-refaz-sem-piscar: a recarga mantém os itens na tela até a resposta chegar", async () => {
    mockedPeriodo.mockResolvedValueOnce({
      data: [buildItem({ nomeCliente: "Cliente Antigo" })],
    })
    const { container, rerenderCom } = renderCalendario({ visao: "mes" })
    expect(await screen.findByText("Cliente Antigo")).toBeInTheDocument()

    const pendente = deferred()
    mockedPeriodo.mockReturnValueOnce(pendente.promise)
    rerenderCom({ visao: "mes", reloadKey: 1 })

    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(2))
    expect(screen.getByText("Cliente Antigo")).toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull()

    pendente.resolve({ data: [buildItem({ nomeCliente: "Cliente Novo" })] })
    expect(await screen.findByText("Cliente Novo")).toBeInTheDocument()
    expect(screen.queryByText("Cliente Antigo")).not.toBeInTheDocument()
  })

  it("esqueleto: enquanto não há dado do período atual, mostra o Skeleton", async () => {
    const pendente = deferred()
    mockedPeriodo.mockReturnValueOnce(pendente.promise)
    const { container } = renderCalendario({ visao: "mes" })

    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(1))
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()
    expect(celulasDoMes()).toHaveLength(0)

    pendente.resolve({ data: [] })
    await screen.findAllByRole("button", { name: /visitas?$/ })
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull()
  })

  it("navegar-e-hoje: Próximo período pede setembro e Hoje volta a agosto", async () => {
    renderCalendario({ visao: "mes" })
    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))

    expect(await screen.findByText("Setembro de 2026")).toBeInTheDocument()
    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(2))
    expect(mockedPeriodo).toHaveBeenLastCalledWith("2026-08-31", "2026-10-04")

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }))
    expect(await screen.findByText("Agosto de 2026")).toBeInTheDocument()
  })

  it("trocar-visao-preserva-data: ir para setembro e trocar para semana mantém setembro", async () => {
    const { rerenderCom } = renderCalendario({ visao: "mes" })
    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))
    expect(await screen.findByText("Setembro de 2026")).toBeInTheDocument()

    rerenderCom({ visao: "semana" })

    // Referência 14/09/2026 (segunda): semana de 14 a 20 de setembro.
    await waitFor(() =>
      expect(mockedPeriodo).toHaveBeenLastCalledWith("2026-09-14", "2026-09-20")
    )
    expect(screen.getByText(/setembro/i)).toBeInTheDocument()
  })

  it("resposta-atrasada (Pitfall 6): a resposta de agosto não sobrescreve setembro", async () => {
    const agosto = deferred()
    const setembro = deferred()
    mockedPeriodo
      .mockReturnValueOnce(agosto.promise)
      .mockReturnValueOnce(setembro.promise)

    renderCalendario({ visao: "mes" })
    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))
    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(2))

    setembro.resolve({
      data: [buildItem({ id: "s", nomeCliente: "Cliente Setembro", data: "2026-09-10" })],
    })
    expect(await screen.findByText("Cliente Setembro")).toBeInTheDocument()

    agosto.resolve({
      data: [buildItem({ id: "a", nomeCliente: "Cliente Agosto", data: "2026-08-12" })],
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(screen.queryByText("Cliente Agosto")).not.toBeInTheDocument()
    expect(screen.getByText("Cliente Setembro")).toBeInTheDocument()
  })

  it("erro-e-tentar: mensagem fixa, nova leitura ao clicar e grade ao resolver", async () => {
    mockedPeriodo.mockResolvedValueOnce({
      error: { code: "fetch_falhou", message: "detalhe interno que não deve aparecer" },
    })
    renderCalendario({ visao: "mes" })

    expect(
      await screen.findByText(
        "Não foi possível carregar o calendário deste período."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByText("detalhe interno que não deve aparecer")
    ).not.toBeInTheDocument()

    mockedPeriodo.mockResolvedValueOnce({
      data: [buildItem({ nomeCliente: "Cliente Voltou" })],
    })
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))

    await waitFor(() => expect(mockedPeriodo).toHaveBeenCalledTimes(2))
    expect(await screen.findByText("Cliente Voltou")).toBeInTheDocument()
    expect(
      screen.queryByText("Não foi possível carregar o calendário deste período.")
    ).not.toBeInTheDocument()
  })

  it("concluido-passado-visivel (D-28/D-29): concluído de dia passado aparece riscado na célula do dia", async () => {
    mockedPeriodo.mockResolvedValueOnce({
      data: [
        buildItem({
          nomeCliente: "Cliente Feito",
          data: "2026-08-04",
          concluido: true,
        }),
      ],
    })
    renderCalendario({ visao: "mes" })

    const nome = await screen.findByText("Cliente Feito")
    expect(nome).toHaveClass("line-through")
  })

  it("filtro-vendedor (D-30): estreita localmente sem nova leitura", async () => {
    mockedPeriodo.mockResolvedValueOnce({
      data: [
        buildItem({ id: "a", nomeCliente: "Cliente Ana", responsavel: "v-ana" }),
        buildItem({
          id: "b",
          nomeCliente: "Cliente Bruno",
          responsavel: "v-bruno",
        }),
      ],
    })
    const { rerenderCom } = renderCalendario({
      visao: "mes",
      vendedorFiltroId: "v-bruno",
    })

    expect(await screen.findByText("Cliente Bruno")).toBeInTheDocument()
    expect(screen.queryByText("Cliente Ana")).not.toBeInTheDocument()

    rerenderCom({ visao: "mes", vendedorFiltroId: null })

    expect(screen.getByText("Cliente Ana")).toBeInTheDocument()
    expect(screen.getByText("Cliente Bruno")).toBeInTheDocument()
    expect(mockedPeriodo).toHaveBeenCalledTimes(1)
  })
})

describe("Agenda2Calendario — diálogo do dia e ações do dono", () => {
  const item12 = buildItem({
    id: "d12",
    nomeCliente: "Cliente do dia 12",
    data: "2026-08-12",
  })

  beforeEach(() => {
    mockedPeriodo.mockReset()
    mockedPeriodo.mockResolvedValue({ data: [item12] })
  })

  async function abrirDiaPeloMes(dia = "12 de agosto") {
    await screen.findByText("Cliente do dia 12")
    fireEvent.click(screen.getByRole("button", { name: new RegExp(dia) }))
    return screen.getByRole("dialog")
  }

  it("dialogo-pelo-mes: clicar na célula abre o diálogo do dia com o item", async () => {
    renderCalendario({ visao: "mes" })

    const dialogo = await abrirDiaPeloMes()

    expect(
      within(dialogo).getByText(rotuloDoPeriodo(new Date(2026, 7, 12), "dia"))
    ).toBeInTheDocument()
    expect(within(dialogo).getByText("Cliente do dia 12")).toBeInTheDocument()
  })

  it("dialogo-pelo-mes: dia sem itens mostra a mensagem de dia vazio", async () => {
    renderCalendario({ visao: "mes" })

    const dialogo = await abrirDiaPeloMes("13 de agosto")

    expect(
      within(dialogo).getByText("Nenhuma visita neste dia.")
    ).toBeInTheDocument()
  })

  it("dialogo-pela-semana (Pitfall 9): clicar no chip abre o mesmo diálogo", async () => {
    renderCalendario({ visao: "semana" })

    const chip = (await screen.findByText("Cliente do dia 12")).closest(
      '[role="button"]'
    ) as HTMLElement
    fireEvent.click(chip)

    const dialogo = screen.getByRole("dialog")
    expect(
      within(dialogo).getByText(rotuloDoPeriodo(new Date(2026, 7, 12), "dia"))
    ).toBeInTheDocument()
    expect(within(dialogo).getByText("Cliente do dia 12")).toBeInTheDocument()
  })

  it("fechar-dialogo: fechar remove o diálogo", async () => {
    renderCalendario({ visao: "mes" })
    await abrirDiaPeloMes()

    fireEvent.click(screen.getByRole("button", { name: /close/i }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("concluir-fecha-dialogo-desmarcar-fica (P-04): Desmarcar age ali mesmo e o diálogo continua aberto; Concluir fecha o diálogo do dia e chama a tela com o item", async () => {
    const onConcluir = vi.fn()
    const onDesmarcar = vi.fn()
    const feito = buildItem({
      id: "d12b",
      nomeCliente: "Cliente Feito",
      data: "2026-08-12",
      concluido: true,
    })
    mockedPeriodo.mockResolvedValue({ data: [item12, feito] })
    renderCalendario({ visao: "mes", onConcluir, onDesmarcar })

    const dialogo = await abrirDiaPeloMes()
    // Desmarcar ANTES de Concluir: Concluir fecha o diálogo do dia.
    fireEvent.click(within(dialogo).getByRole("button", { name: "Desmarcar" }))

    expect(onDesmarcar).toHaveBeenCalledWith(feito)
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    fireEvent.click(within(dialogo).getByRole("button", { name: "Concluir" }))

    expect(onConcluir).toHaveBeenCalledWith(item12)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("editar-fecha-dialogo: Editar e Apagar fecham o diálogo e chamam a tela com o item", async () => {
    const onEditar = vi.fn()
    const onApagar = vi.fn()
    renderCalendario({ visao: "mes", onEditar, onApagar })

    let dialogo = await abrirDiaPeloMes()
    fireEvent.click(within(dialogo).getByRole("button", { name: "Editar" }))

    expect(onEditar).toHaveBeenCalledWith(item12)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /12 de agosto/ }))
    dialogo = screen.getByRole("dialog")
    fireEvent.click(within(dialogo).getByRole("button", { name: "Apagar" }))

    expect(onApagar).toHaveBeenCalledWith(item12)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("supervisor-somente-leitura: sem botões de escrita, com o nome do vendedor", async () => {
    renderCalendario({ visao: "mes", podeAlterar: false, showResponsavel: true })

    const dialogo = await abrirDiaPeloMes()

    for (const nome of ["Editar", "Apagar", "Concluir", "Desmarcar"]) {
      expect(
        within(dialogo).queryByRole("button", { name: nome })
      ).not.toBeInTheDocument()
    }
    expect(within(dialogo).getByText("Ana Souza")).toBeInTheDocument()
  })

  it("supervisor-somente-leitura: a visão de dia também não mostra botões de escrita", async () => {
    mockedPeriodo.mockResolvedValue({
      data: [buildItem({ data: "2026-08-14", nomeCliente: "Cliente de hoje" })],
    })
    renderCalendario({ visao: "dia", podeAlterar: false, showResponsavel: true })

    await screen.findByText("Cliente de hoje")

    for (const nome of ["Editar", "Apagar", "Concluir", "Desmarcar"]) {
      expect(
        screen.queryByRole("button", { name: nome })
      ).not.toBeInTheDocument()
    }
    expect(screen.getByText("Ana Souza")).toBeInTheDocument()
  })

  it("responsavel-nas-grades-semana: com showResponsavel, a Semana mostra o vendedor sem abrir o diálogo", async () => {
    renderCalendario({ visao: "semana", showResponsavel: true })

    await screen.findByText("Cliente do dia 12")

    expect(screen.getByText("Ana Souza")).toBeInTheDocument()
  })

  it("responsavel-nas-grades-mes: com showResponsavel, o Mês mostra o vendedor sem abrir o diálogo", async () => {
    renderCalendario({ visao: "mes", showResponsavel: true })

    await screen.findByText("Cliente do dia 12")

    expect(screen.getByText("Ana Souza")).toBeInTheDocument()
  })

  it("responsavel-nas-grades-desligado: com showResponsavel false, Semana e Mês não mostram o vendedor", async () => {
    const semana = renderCalendario({ visao: "semana", showResponsavel: false })
    await screen.findByText("Cliente do dia 12")
    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument()
    expect(
      semana.container.querySelector('[data-slot="agenda2-responsavel"]')
    ).toBeNull()
    semana.unmount()

    const mes = renderCalendario({ visao: "mes", showResponsavel: false })
    await screen.findByText("Cliente do dia 12")
    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument()
    expect(
      mes.container.querySelector('[data-slot="agenda2-responsavel"]')
    ).toBeNull()
  })

  it("dia-com-acoes: na visão de dia Concluir repassa o item e salvandoId desabilita o botão", async () => {
    const hoje = buildItem({
      id: "h1",
      data: "2026-08-14",
      nomeCliente: "Cliente de hoje",
    })
    mockedPeriodo.mockResolvedValue({ data: [hoje] })
    const onConcluir = vi.fn()
    const { rerenderCom } = renderCalendario({ visao: "dia", onConcluir })

    await screen.findByText("Cliente de hoje")
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))
    expect(onConcluir).toHaveBeenCalledWith(hoje)

    rerenderCom({ visao: "dia", onConcluir, salvandoId: "h1" })
    expect(screen.getByRole("button", { name: "Concluir" })).toBeDisabled()
  })
})
