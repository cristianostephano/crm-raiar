// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { Agenda2ItemRow } from "@/components/agenda2/Agenda2ItemRow"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Agenda2Item } from "@/lib/agenda2/itens"

function buildItem(partial: Partial<Agenda2Item> = {}): Agenda2Item {
  return {
    id: "i1",
    nomeCliente: "Mercado Bom Preço",
    bairro: "Centro",
    data: "2026-09-28",
    concluido: false,
    atualizadoEm: "2026-09-28T12:00:00.000Z",
    responsavel: "v1",
    responsavelNome: "Ana Souza",
    ...partial,
  }
}

function renderRow(props: Partial<ComponentProps<typeof Agenda2ItemRow>> = {}) {
  return render(
    <TooltipProvider>
      <Agenda2ItemRow
        item={buildItem()}
        atrasado={false}
        showResponsavel={false}
        podeAlterar={true}
        onEditar={vi.fn()}
        onApagar={vi.fn()}
        onConcluir={vi.fn()}
        onDesmarcar={vi.fn()}
        {...props}
      />
    </TooltipProvider>
  )
}

describe("Agenda2ItemRow", () => {
  it("pendente-no-prazo: sem risco no título, sem selo Concluído, Editar/Apagar/Concluir presentes, Desmarcar ausente, sem borda vermelha", () => {
    const { container } = renderRow()

    const title = screen.getByText("Mercado Bom Preço")
    expect(title).not.toHaveClass("line-through")
    expect(screen.queryByText("Concluído")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Apagar" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Concluir" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Desmarcar" })
    ).not.toBeInTheDocument()

    const card = container.querySelector('[data-slot="card"]')
    expect(card).not.toHaveClass("border-l-red-500")
  })

  it("mostra-bairro-e-data: exibe o bairro e a data formatada sem deslocar o dia", () => {
    renderRow({ item: buildItem({ data: "2026-09-28" }) })

    expect(screen.getByText("Centro")).toBeInTheDocument()
    expect(screen.getByText("28/09")).toBeInTheDocument()
  })

  it("pendente-atrasado (D-02): atrasado=true mostra borda vermelha e gatilho 'Atrasado desde 28/09.'", () => {
    const { container } = renderRow({
      atrasado: true,
      item: buildItem({ data: "2026-09-28" }),
    })

    const card = container.querySelector('[data-slot="card"]')
    expect(card).toHaveClass("border-l-4")
    expect(card).toHaveClass("border-l-red-500")
    expect(screen.getByLabelText("Atrasado desde 28/09.")).toBeInTheDocument()
  })

  it("concluido-riscado (D-04): título riscado, selo Concluído presente, Desmarcar presente, Concluir ausente", () => {
    renderRow({ item: buildItem({ concluido: true }) })

    const title = screen.getByText("Mercado Bom Preço")
    expect(title).toHaveClass("line-through")
    expect(title).toHaveClass("text-muted-foreground")
    expect(screen.getByText("Concluído")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Desmarcar" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Concluir" })
    ).not.toBeInTheDocument()
  })

  it("concluido-editavel (D-06): Editar e Apagar continuam presentes quando concluído", () => {
    renderRow({ item: buildItem({ concluido: true }) })

    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Apagar" })).toBeInTheDocument()
  })

  it("concluido-sem-atraso: item concluído nunca mostra atraso mesmo com atrasado=true", () => {
    const { container } = renderRow({
      atrasado: true,
      item: buildItem({ concluido: true, data: "2026-09-28" }),
    })

    const card = container.querySelector('[data-slot="card"]')
    expect(card).not.toHaveClass("border-l-red-500")
    expect(screen.queryByLabelText(/^Atrasado desde/)).not.toBeInTheDocument()
  })

  it("sem-esmaecimento: o cartão nunca recebe a classe de opacidade 60, pendente ou concluído", () => {
    const { container: pendente } = renderRow()
    const { container: concluido } = renderRow({
      item: buildItem({ concluido: true }),
    })

    expect(
      pendente.querySelector('[data-slot="card"]')?.className
    ).not.toContain("opacity-60")
    expect(
      concluido.querySelector('[data-slot="card"]')?.className
    ).not.toContain("opacity-60")
  })

  it("callbacks: Editar, Apagar, Concluir (pendente) e Desmarcar (concluído) chamam o callback certo uma vez", () => {
    const onEditar = vi.fn()
    const onApagar = vi.fn()
    const onConcluir = vi.fn()
    const pendente = renderRow({ onEditar, onApagar, onConcluir })

    fireEvent.click(screen.getByRole("button", { name: "Editar" }))
    fireEvent.click(screen.getByRole("button", { name: "Apagar" }))
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    expect(onEditar).toHaveBeenCalledTimes(1)
    expect(onApagar).toHaveBeenCalledTimes(1)
    expect(onConcluir).toHaveBeenCalledTimes(1)

    pendente.unmount()

    const onDesmarcar = vi.fn()
    renderRow({ item: buildItem({ concluido: true }), onDesmarcar })
    fireEvent.click(screen.getByRole("button", { name: "Desmarcar" }))

    expect(onDesmarcar).toHaveBeenCalledTimes(1)
  })

  it("somente-leitura (D-16): podeAlterar=false não renderiza nenhum botão, nos dois estados", () => {
    const pendente = renderRow({ podeAlterar: false })

    expect(
      screen.queryByRole("button", { name: "Editar" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Apagar" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Concluir" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Desmarcar" })
    ).not.toBeInTheDocument()

    pendente.unmount()

    renderRow({ podeAlterar: false, item: buildItem({ concluido: true }) })

    expect(
      screen.queryByRole("button", { name: "Editar" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Apagar" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Desmarcar" })
    ).not.toBeInTheDocument()
    expect(screen.getByText("Concluído")).toBeInTheDocument()
    expect(screen.getByText("Mercado Bom Preço")).toHaveClass("line-through")
  })

  it("responsavel: o nome só aparece quando showResponsavel é verdadeiro", () => {
    const semResponsavel = renderRow({ showResponsavel: false })
    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument()

    semResponsavel.unmount()

    renderRow({ showResponsavel: true })
    expect(screen.getByText("Ana Souza")).toBeInTheDocument()
  })

  it("salvando: os botões existentes ficam desabilitados", () => {
    renderRow({ salvando: true })

    expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Apagar" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Concluir" })).toBeDisabled()
  })
})
