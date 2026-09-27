// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/app/actions/encerrados", () => ({
  getClientesEncerradosAction: vi.fn(),
  getMotivosEncerramento: vi.fn(),
}))

vi.mock("@/app/actions/funil", () => ({
  marcarStatus: vi.fn(),
}))

import { getClientesEncerradosAction } from "@/app/actions/encerrados"
import { marcarStatus } from "@/app/actions/funil"
import { EncerradosList } from "@/components/encerrados/EncerradosList"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ClienteEncerrado } from "@/lib/encerrados/lista"

const mockedAction = vi.mocked(getClientesEncerradosAction)
const mockedMarcarStatus = vi.mocked(marcarStatus)

let nextId = 0
function buildCliente(partial: Partial<ClienteEncerrado> = {}): ClienteEncerrado {
  nextId += 1
  return {
    clienteId: `cliente-${nextId}`,
    razaoSocial: `Cliente ${nextId}`,
    nomeFantasia: null,
    motivoEncerramentoNome: "Fechou o estabelecimento",
    encerradoEm: "2026-09-20T15:00:00.000Z",
    responsavel: "vendedor-1",
    responsavelNome: "Ana Souza",
    ...partial,
  }
}

function renderList(isSupervisor = false) {
  return render(
    <TooltipProvider>
      <EncerradosList isSupervisor={isSupervisor} />
    </TooltipProvider>
  )
}

/**
 * Teste de tela de components/encerrados/EncerradosList.tsx (Fase 29, Plano
 * 29-07, Tarefa 2). Cópia estrutural de tests/funil/perdidos-list.test.tsx,
 * nomes trocados; "Reativar" chama `marcarStatus(clienteId, "ganho")` em vez
 * de uma ação própria (D-10).
 */
describe("EncerradosList", () => {
  beforeEach(() => {
    mockedAction.mockClear()
    mockedMarcarStatus.mockClear()
  })

  it("carga-inicial: ao montar, getClientesEncerradosAction é chamada uma vez com { inicio: null, fim: null }", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildCliente({ clienteId: "c1", razaoSocial: "Padaria Central Ltda" }),
        buildCliente({ clienteId: "c2", razaoSocial: "Mercado Bom Preço" }),
      ],
    })

    renderList()

    expect(await screen.findByText("Padaria Central Ltda")).toBeInTheDocument()
    expect(screen.getByText("Mercado Bom Preço")).toBeInTheDocument()
    expect(mockedAction).toHaveBeenCalledTimes(1)
    expect(mockedAction).toHaveBeenCalledWith({ inicio: null, fim: null })
  })

  it("vendedor-nome: com isSupervisor true o nome do vendedor aparece; com false não aparece", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildCliente({
          clienteId: "c1",
          razaoSocial: "Padaria Central Ltda",
          responsavelNome: "Ana Souza",
        }),
      ],
    })

    renderList(true)

    await screen.findByText("Padaria Central Ltda")
    expect(screen.getByText("Ana Souza")).toBeInTheDocument()
  })

  it("vendedor-nome-oculto: com isSupervisor false o nome do vendedor não aparece", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildCliente({
          clienteId: "c1",
          razaoSocial: "Padaria Central Ltda",
          responsavelNome: "Ana Souza",
        }),
      ],
    })

    renderList(false)

    await screen.findByText("Padaria Central Ltda")
    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument()
  })

  it("reativar: clicar em Reativar chama marcarStatus com ganho, releitura, e a linha some", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildCliente({ clienteId: "c1", razaoSocial: "Padaria Central Ltda" }),
      ],
    })
    mockedMarcarStatus.mockResolvedValueOnce({ data: true })
    mockedAction.mockResolvedValueOnce({ data: [] })

    renderList()

    await screen.findByText("Padaria Central Ltda")
    fireEvent.click(
      screen.getByRole("button", { name: "Reativar Padaria Central Ltda" })
    )

    await waitFor(() => {
      expect(mockedMarcarStatus).toHaveBeenCalledTimes(1)
    })
    expect(mockedMarcarStatus).toHaveBeenCalledWith("c1", "ganho")

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    await waitFor(() => {
      expect(mockedAction).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(
        screen.queryByText("Padaria Central Ltda")
      ).not.toBeInTheDocument()
    })
  })

  it("reativar-erro: com marcarStatus devolvendo erro, aparece alerta, a linha continua e a leitura não é chamada de novo", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildCliente({ clienteId: "c1", razaoSocial: "Padaria Central Ltda" }),
      ],
    })
    mockedMarcarStatus.mockResolvedValueOnce({
      error: {
        code: "ficha_incompleta",
        message: "Complete a ficha do cliente antes.",
      },
    })

    renderList()

    await screen.findByText("Padaria Central Ltda")
    fireEvent.click(
      screen.getByRole("button", { name: "Reativar Padaria Central Ltda" })
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Complete a ficha do cliente antes."
    )
    expect(screen.getByText("Padaria Central Ltda")).toBeInTheDocument()
    expect(mockedAction).toHaveBeenCalledTimes(1)
  })

  it("vazio: resposta vazia com Tudo mostra os textos de lista vazia sem recorte", async () => {
    mockedAction.mockResolvedValueOnce({ data: [] })

    renderList()

    expect(
      await screen.findByText("Nenhum cliente encerrado")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Quando um cliente for encerrado, ele aparece aqui.")
    ).toBeInTheDocument()
  })

  it("vazio-periodo: escolher Últimos 30 dias dispara nova leitura com inicio preenchido; resposta vazia mostra o texto de período", async () => {
    mockedAction.mockResolvedValueOnce({ data: [] })
    mockedAction.mockResolvedValueOnce({ data: [] })

    renderList()

    await screen.findByText("Nenhum cliente encerrado")

    fireEvent.click(screen.getByRole("combobox", { name: "Período" }))
    const opcao = await screen.findByRole("option", {
      name: "Últimos 30 dias",
    })
    fireEvent.pointerDown(opcao)
    fireEvent.click(opcao)

    await waitFor(() => {
      expect(mockedAction).toHaveBeenCalledTimes(2)
    })
    const ultimaChamada = mockedAction.mock.calls[1][0]
    expect(ultimaChamada.inicio).not.toBeNull()
    expect(ultimaChamada.fim).toBeNull()

    expect(
      await screen.findByText("Nenhum cliente encerrado nesse período")
    ).toBeInTheDocument()
  })

  it("busca: filtra a lista já carregada sem nova leitura; sem resultado mostra o texto de busca", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildCliente({ clienteId: "c1", razaoSocial: "Padaria Central Ltda" }),
        buildCliente({
          clienteId: "c2",
          razaoSocial: null,
          nomeFantasia: "Mercado Bom Preço",
        }),
      ],
    })

    renderList()

    await screen.findByText("Padaria Central Ltda")
    expect(mockedAction).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByLabelText("Buscar por nome"), {
      target: { value: "mercado" },
    })

    expect(
      screen.queryByText("Padaria Central Ltda")
    ).not.toBeInTheDocument()
    expect(screen.getByText("Mercado Bom Preço")).toBeInTheDocument()
    expect(mockedAction).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByLabelText("Buscar por nome"), {
      target: { value: "zzz" },
    })

    expect(
      screen.getByText("Nenhum cliente encerrado com esse nome")
    ).toBeInTheDocument()
  })

  it("busca-limpa: com texto na busca, trocar o período limpa o campo de busca", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildCliente({ clienteId: "c1", razaoSocial: "Padaria Central Ltda" }),
      ],
    })
    mockedAction.mockResolvedValueOnce({ data: [] })

    renderList()

    await screen.findByText("Padaria Central Ltda")
    const campoBusca = screen.getByLabelText(
      "Buscar por nome"
    ) as HTMLInputElement
    fireEvent.change(campoBusca, { target: { value: "padaria" } })
    expect(campoBusca.value).toBe("padaria")

    fireEvent.click(screen.getByRole("combobox", { name: "Período" }))
    const opcao = await screen.findByRole("option", {
      name: "Últimos 30 dias",
    })
    fireEvent.pointerDown(opcao)
    fireEvent.click(opcao)

    await waitFor(() => {
      expect(
        (screen.getByLabelText("Buscar por nome") as HTMLInputElement).value
      ).toBe("")
    })
  })

  it("erro-carga: resposta de erro mostra a copy de erro; Tentar novamente chama a leitura de novo", async () => {
    mockedAction.mockResolvedValueOnce({
      error: { code: "fetch_falhou", message: "erro interno qualquer" },
    })

    renderList()

    expect(
      await screen.findByText(
        "Não foi possível carregar os clientes encerrados. Tente novamente."
      )
    ).toBeInTheDocument()

    mockedAction.mockResolvedValueOnce({ data: [] })
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))

    await waitFor(() => {
      expect(mockedAction).toHaveBeenCalledTimes(2)
    })
  })
})
