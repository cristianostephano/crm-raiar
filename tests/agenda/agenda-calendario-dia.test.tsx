// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { AgendaCalendarioDia } from "@/components/agenda/AgendaCalendarioDia"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { AgendaItem } from "@/lib/agenda/itens"

const NOW = new Date("2026-01-20T12:00:00")

function buildItem(partial: Partial<AgendaItem> = {}): AgendaItem {
  return {
    origem: "prospeccao",
    itemId: "item-1",
    clienteId: "cliente-1",
    razaoSocial: "Padaria Raiar Ltda",
    responsavel: "vendedor-1",
    responsavelNome: "Fulano de Tal",
    titulo: "Visitar",
    data: "2026-01-20",
    frequenciaVisita: null,
    proximaDataSugerida: null,
    ...partial,
  }
}

function renderDia(
  props: Partial<ComponentProps<typeof AgendaCalendarioDia>> = {}
) {
  return render(
    <TooltipProvider>
      <AgendaCalendarioDia
        itens={[]}
        showResponsavel={false}
        onOpen={vi.fn()}
        onConcluir={vi.fn()}
        now={NOW}
        {...props}
      />
    </TooltipProvider>
  )
}

describe("AgendaCalendarioDia", () => {
  it("renderiza um cartão por item, na ordem recebida, cada um com a razão social", () => {
    const itens = [
      buildItem({ itemId: "a", razaoSocial: "Padaria A" }),
      buildItem({ itemId: "b", razaoSocial: "Mercado B" }),
      buildItem({ itemId: "c", razaoSocial: "Distribuidora C" }),
    ]
    renderDia({ itens })

    const nomes = screen.getAllByText(/Padaria A|Mercado B|Distribuidora C/)
    expect(nomes.map((el) => el.textContent)).toEqual([
      "Padaria A",
      "Mercado B",
      "Distribuidora C",
    ])
  })

  it("cada cartão é o componente de linha existente: selo e botão Concluir aparecem", () => {
    renderDia({
      itens: [
        buildItem({ itemId: "a", origem: "prospeccao" }),
        buildItem({ itemId: "b", origem: "visita" }),
      ],
    })

    expect(screen.getByText("Prospecção")).toBeInTheDocument()
    expect(screen.getByText("Visita")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Concluir" })).toHaveLength(
      2
    )
  })

  it("atrasado: item com data anterior ao now recebe a borda de atraso; item na data do now, não", () => {
    const { container } = renderDia({
      itens: [
        buildItem({ itemId: "atrasado", data: "2026-01-15" }),
        buildItem({ itemId: "em-dia", data: "2026-01-20" }),
      ],
    })

    const cards = container.querySelectorAll('[role="button"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveClass("border-l-red-500")
    expect(cards[1]).not.toHaveClass("border-l-red-500")
  })

  it("clicar no corpo do cartão chama onOpen com o item correto", () => {
    const onOpen = vi.fn()
    const item = buildItem({ itemId: "x" })
    const { container } = renderDia({ itens: [item], onOpen })

    const card = container.querySelector('[role="button"]') as HTMLElement
    fireEvent.click(card)

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith(item)
  })

  it("clicar em Concluir chama onConcluir com o item correto e NÃO chama onOpen", () => {
    const onOpen = vi.fn()
    const onConcluir = vi.fn()
    const item = buildItem({ itemId: "x" })
    renderDia({ itens: [item], onOpen, onConcluir })

    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    expect(onConcluir).toHaveBeenCalledTimes(1)
    expect(onConcluir).toHaveBeenCalledWith(item)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it("lista vazia: mostra a mensagem de dia vazio e nenhum cartão", () => {
    const { container } = renderDia({ itens: [] })

    expect(
      screen.getByText(/Nada pendente para este dia/)
    ).toBeInTheDocument()
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0)
  })

  it("showResponsavel é repassado sem alteração ao cartão", () => {
    const item = buildItem({ responsavelNome: "Ciclana" })
    const { rerender } = renderDia({ itens: [item], showResponsavel: false })
    expect(screen.queryByText("Ciclana")).not.toBeInTheDocument()

    rerender(
      <TooltipProvider>
        <AgendaCalendarioDia
          itens={[item]}
          showResponsavel={true}
          onOpen={vi.fn()}
          onConcluir={vi.fn()}
          now={NOW}
        />
      </TooltipProvider>
    )
    expect(screen.getByText("Ciclana")).toBeInTheDocument()
  })
})
