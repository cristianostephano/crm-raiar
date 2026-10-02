// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { Agenda2CalendarioDia } from "@/components/agenda2/Agenda2CalendarioDia"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Agenda2Item } from "@/lib/agenda2/itens"

const NOW = new Date(2026, 7, 14, 10, 0)

function buildItem(partial: Partial<Agenda2Item> = {}): Agenda2Item {
  return {
    id: "i1",
    nomeCliente: "Mercado Bom Preço",
    bairro: "Centro",
    data: "2026-08-14",
    concluido: false,
    atualizadoEm: "2026-08-14T12:00:00.000Z",
    responsavel: "v1",
    responsavelNome: "Ana Souza",
    ...partial,
  }
}

function renderDia(
  props: Partial<ComponentProps<typeof Agenda2CalendarioDia>> = {}
) {
  return render(
    <TooltipProvider>
      <Agenda2CalendarioDia
        itens={[]}
        showResponsavel={false}
        podeAlterar={true}
        salvandoId={null}
        onEditar={vi.fn()}
        onApagar={vi.fn()}
        onConcluir={vi.fn()}
        onDesmarcar={vi.fn()}
        now={NOW}
        {...props}
      />
    </TooltipProvider>
  )
}

describe("Agenda2CalendarioDia", () => {
  it("vazio: mostra o bloco tracejado com a mensagem", () => {
    renderDia({ itens: [] })

    const msg = screen.getByText("Nenhuma visita neste dia.")
    expect(msg).toHaveClass("border-dashed")
  })

  it("ordem-e-nomes: mantém a ordem recebida", () => {
    renderDia({
      itens: [
        buildItem({ id: "z", nomeCliente: "Zeta" }),
        buildItem({ id: "a", nomeCliente: "Alfa" }),
      ],
    })

    const zeta = screen.getByText("Zeta")
    const alfa = screen.getByText("Alfa")
    expect(
      zeta.compareDocumentPosition(alfa) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("concluido-riscado (D-29): título riscado, botão Desmarcar e sem borda vermelha", () => {
    const { container } = renderDia({
      itens: [
        buildItem({ nomeCliente: "Feito", data: "2026-08-10", concluido: true }),
      ],
    })

    expect(screen.getByText("Feito")).toHaveClass("line-through")
    expect(
      screen.getByRole("button", { name: "Desmarcar" })
    ).toBeInTheDocument()
    expect(container.querySelector(".border-l-red-500")).toBeNull()
  })

  it("pendente-atrasado: pendente de data passada tem borda vermelha", () => {
    const { container } = renderDia({
      itens: [buildItem({ data: "2026-08-13" })],
    })

    expect(container.querySelector(".border-l-red-500")).not.toBeNull()
  })

  it("somente-leitura: podeAlterar false esconde todos os botões de escrita", () => {
    renderDia({
      podeAlterar: false,
      itens: [
        buildItem({ id: "p" }),
        buildItem({ id: "c", nomeCliente: "Feito", concluido: true }),
      ],
    })

    for (const nome of ["Editar", "Apagar", "Concluir", "Desmarcar"]) {
      expect(
        screen.queryByRole("button", { name: nome })
      ).not.toBeInTheDocument()
    }
  })

  it("acoes-recebem-item: Concluir, Editar e Apagar repassam o próprio item", () => {
    const item = buildItem()
    const onConcluir = vi.fn()
    const onEditar = vi.fn()
    const onApagar = vi.fn()
    renderDia({ itens: [item], onConcluir, onEditar, onApagar })

    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))
    fireEvent.click(screen.getByRole("button", { name: "Editar" }))
    fireEvent.click(screen.getByRole("button", { name: "Apagar" }))

    expect(onConcluir).toHaveBeenCalledWith(item)
    expect(onEditar).toHaveBeenCalledWith(item)
    expect(onApagar).toHaveBeenCalledWith(item)
  })

  it("desmarcar repassa o próprio item", () => {
    const item = buildItem({ concluido: true })
    const onDesmarcar = vi.fn()
    renderDia({ itens: [item], onDesmarcar })

    fireEvent.click(screen.getByRole("button", { name: "Desmarcar" }))

    expect(onDesmarcar).toHaveBeenCalledWith(item)
  })

  it("responsavel: showResponsavel true mostra o nome do dono", () => {
    renderDia({ itens: [buildItem()], showResponsavel: true })

    expect(screen.getByText("Ana Souza")).toBeInTheDocument()
  })
})
