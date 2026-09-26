// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { PerdidosPeriodoFilter } from "@/components/perdidos/PerdidosPeriodoFilter"

/**
 * Teste de tela do filtro de período da tela Perdidos (Fase 28, Plano 28-04,
 * Tarefa 1). Cópia estrutural de components/dashboard/PeriodoFilter.tsx, com
 * preset set próprio (PERIODO_PRESETS_PERDIDOS).
 */

describe("PerdidosPeriodoFilter", () => {
  it("opcoes: o combobox Período abre as opções Tudo, Últimos 30 dias, Últimos 90 dias, Personalizado, nesta ordem", async () => {
    render(
      <PerdidosPeriodoFilter
        preset="tudo"
        customRange={undefined}
        onPresetChange={vi.fn()}
        onCustomRangeApply={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("combobox", { name: "Período" }))

    const options = await screen.findAllByRole("option")
    expect(options.map((option) => option.textContent)).toEqual([
      "Tudo",
      "Últimos 30 dias",
      "Últimos 90 dias",
      "Personalizado",
    ])
  })

  it("troca: escolher Últimos 90 dias chama onPresetChange('90dias') uma vez", async () => {
    const onPresetChange = vi.fn()

    render(
      <PerdidosPeriodoFilter
        preset="tudo"
        customRange={undefined}
        onPresetChange={onPresetChange}
        onCustomRangeApply={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("combobox", { name: "Período" }))
    const opcao = await screen.findByRole("option", {
      name: "Últimos 90 dias",
    })
    fireEvent.pointerDown(opcao)
    fireEvent.click(opcao)

    expect(onPresetChange).toHaveBeenCalledTimes(1)
    expect(onPresetChange).toHaveBeenCalledWith("90dias")
  })

  it("personalizado-rotulo: sem intervalo mostra Selecionar período; com intervalo mostra as datas formatadas", () => {
    const { rerender } = render(
      <PerdidosPeriodoFilter
        preset="personalizado"
        customRange={undefined}
        onPresetChange={vi.fn()}
        onCustomRangeApply={vi.fn()}
      />
    )

    expect(screen.getByText("Selecionar período")).toBeInTheDocument()

    rerender(
      <PerdidosPeriodoFilter
        preset="personalizado"
        customRange={{
          from: new Date(2026, 8, 1),
          to: new Date(2026, 8, 10),
        }}
        onPresetChange={vi.fn()}
        onCustomRangeApply={vi.fn()}
      />
    )

    expect(screen.getByText("01/09/2026 - 10/09/2026")).toBeInTheDocument()
  })
})
