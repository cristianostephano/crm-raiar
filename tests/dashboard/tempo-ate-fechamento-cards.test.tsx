// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { getTempoAteFechamentoAction } from "@/app/actions/dashboard"
import { TempoAteFechamentoCards } from "@/components/dashboard/TempoAteFechamentoCards"

vi.mock("@/app/actions/dashboard", () => ({
  getTempoAteFechamentoAction: vi.fn(),
}))

const mockedAction = vi.mocked(getTempoAteFechamentoAction)

describe("TempoAteFechamentoCards", () => {
  it("mostra as duas medias separadas", async () => {
    mockedAction.mockResolvedValue({
      data: [
        { status: "ganho", mediaDias: 18.4 },
        { status: "perdido", mediaDias: 7 },
      ],
    })

    render(<TempoAteFechamentoCards />)

    expect(await screen.findByText("Média de dias até ganho")).toBeInTheDocument()
    expect(await screen.findByText("18,4 dias")).toBeInTheDocument()
    expect(
      await screen.findByText("Média de dias até perdido")
    ).toBeInTheDocument()
    expect(await screen.findByText("7,0 dias")).toBeInTheDocument()
  })

  it("mostra travessao quando ainda nao houve ganho", async () => {
    mockedAction.mockResolvedValue({
      data: [{ status: "perdido", mediaDias: 3.2 }],
    })

    render(<TempoAteFechamentoCards />)

    expect(await screen.findByText("3,2 dias")).toBeInTheDocument()
    expect(await screen.findByText("—")).toBeInTheDocument()
    expect(screen.queryByText("0,0 dias")).not.toBeInTheDocument()
  })

  it("mostra travessao nos dois quando nao houve fechamento nenhum", async () => {
    mockedAction.mockResolvedValue({ data: [] })

    render(<TempoAteFechamentoCards />)

    expect(await screen.findByText("Média de dias até ganho")).toBeInTheDocument()
    expect(
      await screen.findByText("Média de dias até perdido")
    ).toBeInTheDocument()
    const travessoes = await screen.findAllByText("—")
    expect(travessoes).toHaveLength(2)
  })

  it("mostra o estado de erro com botao de nova tentativa", async () => {
    mockedAction.mockResolvedValue({
      error: { code: "fetch_falhou", message: "erro qualquer" },
    })

    render(<TempoAteFechamentoCards />)

    expect(
      await screen.findByText(
        "Não foi possível carregar os dados do dashboard. Tente novamente."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Tentar novamente" })
    ).toBeInTheDocument()
    expect(screen.queryByText("Média de dias até ganho")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Média de dias até perdido")
    ).not.toBeInTheDocument()
  })

  it("usa a borda verde no ganho e a destructive no perdido", async () => {
    mockedAction.mockResolvedValue({
      data: [
        { status: "ganho", mediaDias: 18.4 },
        { status: "perdido", mediaDias: 7 },
      ],
    })

    const { container } = render(<TempoAteFechamentoCards />)

    const ganhoLabel = await screen.findByText("Média de dias até ganho")

    const greenCard = container.querySelector(".border-l-green-600")
    const destructiveCard = container.querySelector(".border-l-destructive")

    expect(greenCard).not.toBeNull()
    expect(destructiveCard).not.toBeNull()
    expect(greenCard?.contains(ganhoLabel)).toBe(true)

    const perdidoLabel = screen.getByText("Média de dias até perdido")
    expect(destructiveCard?.contains(perdidoLabel)).toBe(true)
  })
})
