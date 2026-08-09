// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { AgendaItemRow } from "@/components/agenda/AgendaItemRow"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { AgendaItem } from "@/lib/agenda/itens"

function buildItem(partial: Partial<AgendaItem> = {}): AgendaItem {
  return {
    origem: "prospeccao",
    itemId: "item-1",
    clienteId: "cliente-1",
    razaoSocial: "Padaria Raiar Ltda",
    responsavel: "vendedor-1",
    responsavelNome: "Fulano de Tal",
    titulo: "Visitar",
    data: "2026-01-15",
    frequenciaVisita: null,
    proximaDataSugerida: null,
    ...partial,
  }
}

function renderRow(props: Partial<ComponentProps<typeof AgendaItemRow>> = {}) {
  return render(
    <TooltipProvider>
      <AgendaItemRow
        item={buildItem()}
        atrasado={false}
        showResponsavel={false}
        onConcluir={vi.fn()}
        {...props}
      />
    </TooltipProvider>
  )
}

describe("AgendaItemRow", () => {
  it("prospeccao: renderiza razão social, o título recebido e o selo Prospecção", () => {
    renderRow({ item: buildItem({ origem: "prospeccao", titulo: "Visitar" }) })

    expect(screen.getByText("Padaria Raiar Ltda")).toBeInTheDocument()
    expect(screen.getByText("Visitar")).toBeInTheDocument()
    expect(screen.getByText("Prospecção")).toBeInTheDocument()
  })

  it("visita: renderiza um selo com o texto Visita", () => {
    renderRow({
      item: buildItem({ origem: "visita", titulo: "Retorno pós-venda" }),
    })

    expect(screen.getByText("Visita")).toBeInTheDocument()
  })

  it("atrasado: card ganha border-l-4/border-l-red-500 e tooltip 'Atrasado desde'", () => {
    const { container } = renderRow({
      atrasado: true,
      item: buildItem({ data: "2026-01-15" }),
    })

    const card = container.querySelector('[role="button"]')
    expect(card).not.toBeNull()
    expect(card).toHaveClass("border-l-4")
    expect(card).toHaveClass("border-l-red-500")
    expect(screen.getByLabelText(/^Atrasado desde/)).toBeInTheDocument()
  })

  it("normal: sem atrasado, não tem border-l-red-500 nem rótulo 'Atrasado desde'", () => {
    const { container } = renderRow({ atrasado: false })

    const card = container.querySelector('[role="button"]')
    expect(card).not.toHaveClass("border-l-red-500")
    expect(screen.queryByLabelText(/^Atrasado desde/)).not.toBeInTheDocument()
  })

  it("data: um item de 2026-01-31 renderiza 31/01, sem deslocar o dia", () => {
    renderRow({ item: buildItem({ data: "2026-01-31" }) })

    expect(screen.getByText("31/01")).toBeInTheDocument()
  })

  it("responsavel: nome só aparece quando showResponsavel é verdadeiro", () => {
    const { rerender } = renderRow({ showResponsavel: false })
    expect(screen.queryByText("Fulano de Tal")).not.toBeInTheDocument()

    rerender(
      <TooltipProvider>
        <AgendaItemRow
          item={buildItem()}
          atrasado={false}
          showResponsavel={true}
          onConcluir={vi.fn()}
        />
      </TooltipProvider>
    )
    expect(screen.getByText("Fulano de Tal")).toBeInTheDocument()
  })

  it("teclado: Enter no cartão chama onOpen uma vez", () => {
    const onOpen = vi.fn()
    const { container } = renderRow({ onOpen })

    const card = container.querySelector('[role="button"]') as HTMLElement
    fireEvent.keyDown(card, { key: "Enter" })

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it("concluir: o botão aparece com o rótulo do contrato e clicar nele chama onConcluir", () => {
    const onConcluir = vi.fn()
    renderRow({ onConcluir })

    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    expect(onConcluir).toHaveBeenCalledTimes(1)
  })

  it("propagacao: clicar no botão de concluir não dispara onOpen (abertura da ficha do cliente)", () => {
    const onOpen = vi.fn()
    const onConcluir = vi.fn()
    renderRow({ onOpen, onConcluir })

    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    expect(onConcluir).toHaveBeenCalledTimes(1)
    expect(onOpen).not.toHaveBeenCalled()
  })
})
