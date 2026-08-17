// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { AgendaCalendarioToolbar } from "@/components/agenda/AgendaCalendarioToolbar"

function renderToolbar(
  props: Partial<ComponentProps<typeof AgendaCalendarioToolbar>> = {}
) {
  return render(
    <AgendaCalendarioToolbar
      visao="mes"
      onVisaoChange={vi.fn()}
      rotulo="Agosto de 2026"
      onAnterior={vi.fn()}
      onProximo={vi.fn()}
      onHoje={vi.fn()}
      {...props}
    />
  )
}

describe("AgendaCalendarioToolbar", () => {
  it("renderiza os quatro botões de visão na ordem Lista, Dia, Semana, Mês", () => {
    renderToolbar()

    const botoes = [
      screen.getByRole("button", { name: "Lista" }),
      screen.getByRole("button", { name: "Dia" }),
      screen.getByRole("button", { name: "Semana" }),
      screen.getByRole("button", { name: "Mês" }),
    ]

    expect(botoes.every(Boolean)).toBe(true)
  })

  it("o botão da visão ativa anuncia seleção de forma acessível, os demais não", () => {
    renderToolbar({ visao: "semana" })

    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "Lista" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    expect(screen.getByRole("button", { name: "Dia" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    expect(screen.getByRole("button", { name: "Mês" })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  it("clicar num botão de visão dispara onVisaoChange com o valor daquela visão", () => {
    const onVisaoChange = vi.fn()
    renderToolbar({ onVisaoChange })

    fireEvent.click(screen.getByRole("button", { name: "Dia" }))

    expect(onVisaoChange).toHaveBeenCalledTimes(1)
    expect(onVisaoChange).toHaveBeenCalledWith("dia")
  })

  it("com rótulo nulo (visão de Lista), navegação e legenda não aparecem, mas o seletor continua visível", () => {
    renderToolbar({ rotulo: null, visao: "lista" })

    expect(
      screen.queryByRole("button", { name: "Período anterior" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Próximo período" })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Hoje" })).not.toBeInTheDocument()
    expect(screen.queryByText("Prospecção")).not.toBeInTheDocument()

    expect(screen.getByRole("button", { name: "Lista" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mês" })).toBeInTheDocument()
  })

  it("com rótulo, aparecem o rótulo do período, os botões de navegação e o botão Hoje", () => {
    renderToolbar({ rotulo: "Agosto de 2026" })

    expect(screen.getByText("Agosto de 2026")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Período anterior" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Próximo período" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Hoje" })).toBeInTheDocument()
  })

  it("cada botão de navegação dispara só o seu próprio retorno de chamada", () => {
    const onAnterior = vi.fn()
    const onProximo = vi.fn()
    const onHoje = vi.fn()
    renderToolbar({ onAnterior, onProximo, onHoje })

    fireEvent.click(screen.getByRole("button", { name: "Período anterior" }))
    expect(onAnterior).toHaveBeenCalledTimes(1)
    expect(onProximo).not.toHaveBeenCalled()
    expect(onHoje).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))
    expect(onProximo).toHaveBeenCalledTimes(1)
    expect(onAnterior).toHaveBeenCalledTimes(1)
    expect(onHoje).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }))
    expect(onHoje).toHaveBeenCalledTimes(1)
    expect(onAnterior).toHaveBeenCalledTimes(1)
    expect(onProximo).toHaveBeenCalledTimes(1)
  })

  it("a legenda mostra as três marcas — prospecção, visita e atrasado", () => {
    renderToolbar()

    expect(screen.getByText("Prospecção")).toBeInTheDocument()
    expect(screen.getByText("Visita")).toBeInTheDocument()
    expect(screen.getByText("Atrasado")).toBeInTheDocument()
  })
})
