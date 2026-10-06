// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { Agenda2CalendarioSemana } from "@/components/agenda2/Agenda2CalendarioSemana"
import { chaveDoDia } from "@/lib/agenda/itens"
import { agruparPorDataAgenda2, type Agenda2Item } from "@/lib/agenda2/itens"

// Sexta-feira 2026-08-14; a semana vai de 10/08 (seg) a 16/08 (dom).
const NOW = new Date(2026, 7, 14, 10, 0)

function buildItem(partial: Partial<Agenda2Item> = {}): Agenda2Item {
  return {
    id: "i1",
    nomeCliente: "Padaria Raiar",
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

function renderSemana(
  itens: Agenda2Item[] = [],
  props: Partial<ComponentProps<typeof Agenda2CalendarioSemana>> = {}
) {
  return render(
    <Agenda2CalendarioSemana
      referencia={NOW}
      porData={agruparPorDataAgenda2(itens)}
      onSelecionarDia={vi.fn()}
      now={NOW}
      {...props}
    />
  )
}

describe("Agenda2CalendarioSemana", () => {
  it("sete-colunas: dias 10 a 16 de agosto, cabeçalhos de Seg a Dom", () => {
    renderSemana()

    const cabecalho = screen.getAllByText(/^(Seg|Ter|Qua|Qui|Sex|Sab|Dom)$/)
    expect(cabecalho).toHaveLength(7)
    expect(cabecalho[0]).toHaveTextContent("Seg")
    expect(cabecalho[6]).toHaveTextContent("Dom")
    for (const dia of ["10", "11", "12", "13", "14", "15", "16"]) {
      expect(screen.getByText(dia)).toBeInTheDocument()
    }
  })

  it("chip-nome-e-bairro: nome na primeira linha e bairro na segunda", () => {
    renderSemana([buildItem({ nomeCliente: "Mercado Bom", bairro: "Jardins" })])

    const nome = screen.getByText("Mercado Bom")
    const bairro = screen.getByText("Jardins")
    expect(
      nome.compareDocumentPosition(bairro) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(nome.closest('[role="button"]')).toBe(
      bairro.closest('[role="button"]')
    )
  })

  it("chip-concluido-riscado (D-29): nome riscado, borda verde e sem opacidade reduzida", () => {
    renderSemana([
      buildItem({ nomeCliente: "Feito", data: "2026-08-10", concluido: true }),
    ])

    const nome = screen.getByText("Feito")
    expect(nome).toHaveClass("line-through")
    const chip = nome.closest('[role="button"]')
    expect(chip).toHaveClass("border-l-emerald-600")
    expect(chip).not.toHaveClass("border-l-destructive")
    expect(chip).not.toHaveClass("opacity-60")
  })

  it("chip-atrasado: pendente de data passada tem borda vermelha", () => {
    renderSemana([buildItem({ nomeCliente: "Atrasada", data: "2026-08-13" })])

    expect(screen.getByText("Atrasada").closest('[role="button"]')).toHaveClass(
      "border-l-destructive"
    )
  })

  it("dia-vazio: colunas sem itens mostram o traço", () => {
    renderSemana([buildItem()])

    expect(screen.getAllByText("—")).toHaveLength(6)
  })

  it("hoje-destacado: a coluna do dia de hoje tem borda primária", () => {
    renderSemana()

    const colunaHoje = screen.getByText("14").closest(".rounded-lg")
    expect(colunaHoje).toHaveClass("border-primary")
    const colunaOutra = screen.getByText("13").closest(".rounded-lg")
    expect(colunaOutra).not.toHaveClass("border-primary")
  })

  it("chip-abre-dia (Pitfall 9): clique e Enter no chip chamam onSelecionarDia com o dia da coluna", () => {
    const onSelecionarDia = vi.fn()
    renderSemana([buildItem({ nomeCliente: "Cliente do dia 12" })], {
      onSelecionarDia,
    })

    const chip = screen
      .getByText("Cliente do dia 12")
      .closest('[role="button"]') as HTMLElement
    fireEvent.click(chip)
    fireEvent.keyDown(chip, { key: "Enter" })

    expect(onSelecionarDia).toHaveBeenCalledTimes(2)
    for (const chamada of onSelecionarDia.mock.calls) {
      expect(chaveDoDia(chamada[0] as Date)).toBe("2026-08-12")
    }
  })

  it("responsavel-supervisor: com showResponsavel, 3ª linha com o vendedor depois do bairro, no mesmo chip", () => {
    renderSemana(
      [
        buildItem({
          nomeCliente: "Mercado Bom",
          bairro: "Jardins",
          responsavelNome: "Ana Souza",
        }),
      ],
      { showResponsavel: true }
    )

    const vendedor = screen.getByText("Ana Souza")
    expect(vendedor).toHaveAttribute("data-slot", "agenda2-responsavel")
    const bairro = screen.getByText("Jardins")
    expect(
      bairro.compareDocumentPosition(vendedor) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(vendedor.closest('[role="button"]')).toBe(
      screen.getByText("Mercado Bom").closest('[role="button"]')
    )
  })

  it("responsavel-vendedor: sem a prop (padrão) ou com false, o nome do vendedor não aparece", () => {
    const { container, unmount } = renderSemana([buildItem()])
    expect(screen.queryByText("Ana Souza")).toBeNull()
    expect(container.querySelector('[data-slot="agenda2-responsavel"]')).toBeNull()
    unmount()

    const segundo = renderSemana([buildItem()], { showResponsavel: false })
    expect(screen.queryByText("Ana Souza")).toBeNull()
    expect(
      segundo.container.querySelector('[data-slot="agenda2-responsavel"]')
    ).toBeNull()
  })

  it("responsavel-ausente: nome null, vazio ou só espaços não cria linha nem escreve 'null'", () => {
    const { container } = renderSemana(
      [
        buildItem({
          id: "a",
          nomeCliente: "Cliente A",
          bairro: "Bairro A",
          data: "2026-08-10",
          responsavelNome: null,
        }),
        buildItem({
          id: "b",
          nomeCliente: "Cliente B",
          bairro: "Bairro B",
          data: "2026-08-11",
          responsavelNome: "",
        }),
        buildItem({
          id: "c",
          nomeCliente: "Cliente C",
          bairro: "Bairro C",
          data: "2026-08-12",
          responsavelNome: "   ",
        }),
      ],
      { showResponsavel: true }
    )

    expect(container.querySelectorAll('[data-slot="agenda2-responsavel"]')).toHaveLength(0)
    expect(screen.queryByText("null")).toBeNull()
    for (const texto of [
      "Cliente A",
      "Cliente B",
      "Cliente C",
      "Bairro A",
      "Bairro B",
      "Bairro C",
    ]) {
      expect(screen.getByText(texto)).toBeInTheDocument()
    }
  })

  it("responsavel-concluido: o nome do cliente fica riscado, a linha do vendedor não", () => {
    renderSemana(
      [buildItem({ nomeCliente: "Feito", concluido: true })],
      { showResponsavel: true }
    )

    expect(screen.getByText("Feito")).toHaveClass("line-through")
    expect(screen.getByText("Ana Souza")).not.toHaveClass("line-through")
  })

  it("sem-icone-de-repeticao (D-26): nenhum ícone de repetição nem de origem", () => {
    const { container } = renderSemana([
      buildItem({ id: "a" }),
      buildItem({ id: "b", nomeCliente: "Feito", concluido: true }),
    ])

    expect(container.querySelector(".lucide-repeat")).toBeNull()
    expect(container.querySelector(".lucide-clipboard-check")).toBeNull()
  })
})
