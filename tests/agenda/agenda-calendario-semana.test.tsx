// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { AgendaCalendarioSemana } from "@/components/agenda/AgendaCalendarioSemana"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { AgendaItem } from "@/lib/agenda/itens"

// Quarta-feira 2026-01-21 — semana Monday 2026-01-19 a Sunday 2026-01-25.
const NOW = new Date("2026-01-21T10:00:00")
const REFERENCIA = NOW

function buildItem(partial: Partial<AgendaItem> = {}): AgendaItem {
  return {
    origem: "prospeccao",
    itemId: "item-1",
    clienteId: "cliente-1",
    razaoSocial: "Padaria Raiar Ltda",
    responsavel: "vendedor-1",
    responsavelNome: "Fulano de Tal",
    titulo: "Visitar",
    data: "2026-01-21",
    frequenciaVisita: null,
    proximaDataSugerida: null,
    ...partial,
  }
}

function buildPorData(itens: AgendaItem[]): Map<string, AgendaItem[]> {
  const porData = new Map<string, AgendaItem[]>()
  for (const item of itens) {
    const lista = porData.get(item.data)
    if (lista) {
      lista.push(item)
    } else {
      porData.set(item.data, [item])
    }
  }
  return porData
}

function renderSemana(
  props: Partial<ComponentProps<typeof AgendaCalendarioSemana>> = {}
) {
  return render(
    <TooltipProvider>
      <AgendaCalendarioSemana
        referencia={REFERENCIA}
        porData={new Map()}
        onOpenItem={vi.fn()}
        now={NOW}
        {...props}
      />
    </TooltipProvider>
  )
}

describe("AgendaCalendarioSemana", () => {
  it("renderiza exatamente 7 colunas, segunda a domingo, com o número do dia certo", () => {
    renderSemana()

    for (const dia of ["19", "20", "21", "22", "23", "24", "25"]) {
      expect(screen.getByText(dia)).toBeInTheDocument()
    }
  })

  it("referência num domingo produz a mesma semana que a referência na segunda anterior", () => {
    const { unmount } = renderSemana({
      referencia: new Date("2026-01-25T10:00:00"),
    })
    for (const dia of ["19", "20", "21", "22", "23", "24", "25"]) {
      expect(screen.getByText(dia)).toBeInTheDocument()
    }
    unmount()

    renderSemana({ referencia: new Date("2026-01-19T10:00:00") })
    for (const dia of ["19", "20", "21", "22", "23", "24", "25"]) {
      expect(screen.getByText(dia)).toBeInTheDocument()
    }
  })

  it("os itens do dia vêm do agrupamento recebido, sem teto de quantidade", () => {
    const itens = [
      buildItem({ itemId: "a", razaoSocial: "Padaria A", data: "2026-01-22" }),
      buildItem({ itemId: "b", razaoSocial: "Mercado B", data: "2026-01-22" }),
      buildItem({
        itemId: "c",
        razaoSocial: "Distribuidora C",
        data: "2026-01-22",
      }),
      buildItem({
        itemId: "d",
        razaoSocial: "Empório D",
        data: "2026-01-22",
      }),
    ]
    renderSemana({ porData: buildPorData(itens) })

    expect(screen.getByText("Padaria A")).toBeInTheDocument()
    expect(screen.getByText("Mercado B")).toBeInTheDocument()
    expect(screen.getByText("Distribuidora C")).toBeInTheDocument()
    expect(screen.getByText("Empório D")).toBeInTheDocument()
  })

  it("cartão pequeno mostra a razão social e o título do item", () => {
    const item = buildItem({
      razaoSocial: "Padaria Raiar Ltda",
      titulo: "Mandar mensagem",
      data: "2026-01-22",
    })
    renderSemana({ porData: buildPorData([item]) })

    expect(screen.getByText("Padaria Raiar Ltda")).toBeInTheDocument()
    expect(screen.getByText("Mandar mensagem")).toBeInTheDocument()
  })

  it("item de prospecção tem borda cinza (muted); item de visita tem borda azul (primary)", () => {
    const prospeccao = buildItem({
      itemId: "p",
      origem: "prospeccao",
      data: "2026-01-22",
    })
    const visita = buildItem({
      itemId: "v",
      origem: "visita",
      data: "2026-01-23",
    })
    const { container } = renderSemana({
      porData: buildPorData([prospeccao, visita]),
    })

    const cards = container.querySelectorAll('[role="button"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveClass("border-l-muted-foreground")
    expect(cards[1]).toHaveClass("border-l-primary")
  })

  it("item atrasado ganha acento vermelho na borda sem apagar a informação de origem (ícone de visita continua visível)", () => {
    const visitaAtrasada = buildItem({
      itemId: "v-atrasada",
      origem: "visita",
      data: "2026-01-19",
    })
    const { container } = renderSemana({
      porData: buildPorData([visitaAtrasada]),
    })

    const card = container.querySelector('[role="button"]') as HTMLElement
    expect(card).toHaveClass("border-l-destructive")
    expect(card.querySelector("svg")).not.toBeNull()
  })

  it("a coluna de hoje é destacada", () => {
    const { container } = renderSemana()

    expect(container.querySelector(".border-primary")).not.toBeNull()
  })

  it("coluna sem itens mostra um marcador de vazio", () => {
    renderSemana()

    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
  })

  it("clicar num cartão dispara onOpenItem com o item correto", () => {
    const onOpenItem = vi.fn()
    const item = buildItem({ itemId: "x", data: "2026-01-22" })
    renderSemana({ porData: buildPorData([item]), onOpenItem })

    fireEvent.click(screen.getByText(item.razaoSocial))

    expect(onOpenItem).toHaveBeenCalledTimes(1)
    expect(onOpenItem).toHaveBeenCalledWith(item)
  })
})
