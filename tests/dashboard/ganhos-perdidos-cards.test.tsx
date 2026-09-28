// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { getGanhosPerdidosAction } from "@/app/actions/dashboard"
import { GanhosPerdidosCards } from "@/components/dashboard/GanhosPerdidosCards"

vi.mock("@/app/actions/dashboard", () => ({
  getGanhosPerdidosAction: vi.fn(),
}))

const mockedAction = vi.mocked(getGanhosPerdidosAction)

describe("GanhosPerdidosCards - borda colorida do card Taxa de conversão (quick 260928-ilo)", () => {
  it("todos os 3 cards de número têm borda lateral colorida, cada um com a sua própria cor", async () => {
    mockedAction.mockResolvedValue({
      data: [
        { status: "ganho", total: 3 },
        { status: "perdido", total: 1 },
      ],
    })

    const { container } = render(
      <GanhosPerdidosCards
        inicio={new Date("2026-09-01T00:00:00Z")}
        fim={new Date("2026-09-30T23:59:59Z")}
      />
    )

    const taxaLabel = await screen.findByText("Taxa de conversão")
    const taxaCard = taxaLabel.closest(".border-l-4")
    expect(taxaCard).not.toBeNull()
    expect(taxaCard?.className).toContain("border-l-primary")

    const ganhoLabel = screen.getByText("Ganhos")
    const ganhoCard = ganhoLabel.closest(".border-l-4")
    expect(ganhoCard?.className).toContain("border-l-green-600")

    const perdidoLabel = screen.getByText("Perdidos")
    const perdidoCard = perdidoLabel.closest(".border-l-4")
    expect(perdidoCard?.className).toContain("border-l-destructive")

    expect(container.querySelector(".border-l-border")).toBeNull()
  })
})
