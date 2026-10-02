// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { Agenda2CalendarioToolbar } from "@/components/agenda2/Agenda2CalendarioToolbar"

function renderToolbar(
  props: Partial<ComponentProps<typeof Agenda2CalendarioToolbar>> = {}
) {
  return render(
    <Agenda2CalendarioToolbar
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

describe("Agenda2CalendarioToolbar", () => {
  it("lista-so-seletor: rotulo null mostra só o seletor, sem navegação nem legenda", () => {
    renderToolbar({ visao: "lista", rotulo: null })

    expect(screen.getByRole("button", { name: "Lista" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    for (const nome of ["Dia", "Semana", "Mês"]) {
      expect(screen.getByRole("button", { name: nome })).toHaveAttribute(
        "aria-pressed",
        "false"
      )
    }
    expect(
      screen.queryByRole("button", { name: "Hoje" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Período anterior" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Próximo período" })
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Pendente")).not.toBeInTheDocument()
    expect(screen.queryByText("Atrasado")).not.toBeInTheDocument()
    expect(screen.queryByText("Concluído")).not.toBeInTheDocument()
  })

  it("com-rotulo: mostra rótulo, setas, Hoje e a legenda de três itens (sem Prospecção/Visita)", () => {
    renderToolbar({ visao: "mes", rotulo: "Agosto de 2026" })

    expect(screen.getByText("Agosto de 2026")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Período anterior" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Próximo período" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Hoje" })).toBeInTheDocument()

    expect(screen.getByText("Pendente")).toBeInTheDocument()
    expect(screen.getByText("Atrasado")).toBeInTheDocument()
    expect(screen.getByText("Concluído")).toBeInTheDocument()
    expect(screen.queryByText("Prospecção")).not.toBeInTheDocument()
    expect(screen.queryByText("Visita")).not.toBeInTheDocument()
  })

  it("callbacks: setas, Hoje e seletor de visão disparam os retornos de chamada", () => {
    const onAnterior = vi.fn()
    const onProximo = vi.fn()
    const onHoje = vi.fn()
    const onVisaoChange = vi.fn()
    renderToolbar({ onAnterior, onProximo, onHoje, onVisaoChange })

    fireEvent.click(screen.getByRole("button", { name: "Período anterior" }))
    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }))
    fireEvent.click(screen.getByRole("button", { name: "Semana" }))

    expect(onAnterior).toHaveBeenCalledTimes(1)
    expect(onProximo).toHaveBeenCalledTimes(1)
    expect(onHoje).toHaveBeenCalledTimes(1)
    expect(onVisaoChange).toHaveBeenCalledTimes(1)
    expect(onVisaoChange).toHaveBeenCalledWith("semana")
  })
})
