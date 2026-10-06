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
    oQueFazer: null,
    oQueFoiFeito: null,
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

  it("responsavel-ausente: nome null ou vazio com showResponsavel não cria parágrafo extra nem escreve 'null'", () => {
    const base = renderRow({
      showResponsavel: false,
      item: buildItem({ responsavelNome: "Ana Souza" }),
    })
    const quantidade = base.container.querySelectorAll("p").length
    base.unmount()

    const comNull = renderRow({
      showResponsavel: true,
      item: buildItem({ responsavelNome: null }),
    })
    expect(comNull.container.querySelectorAll("p")).toHaveLength(quantidade)
    expect(screen.queryByText("null")).not.toBeInTheDocument()
    comNull.unmount()

    const vazio = renderRow({
      showResponsavel: true,
      item: buildItem({ responsavelNome: "" }),
    })
    expect(vazio.container.querySelectorAll("p")).toHaveLength(quantidade)
  })

  it("salvando: os botões existentes ficam desabilitados", () => {
    renderRow({ salvando: true })

    expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Apagar" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Concluir" })).toBeDisabled()
  })
})

describe("Agenda2ItemRow — textos opcionais da visita (quick 261006-ncy)", () => {
  it("mostra-os-textos: 'Motivo da visita:' e 'O que foi feito:' com os textos, discretos e no máximo 3 linhas", () => {
    const { container } = renderRow({
      item: buildItem({
        oQueFazer: "Levar amostras",
        oQueFoiFeito: "Pedido combinado",
      }),
    })

    const motivo = container.querySelector('[data-slot="agenda2-o-que-fazer"]')
    const feito = container.querySelector('[data-slot="agenda2-o-que-foi-feito"]')
    expect(motivo).not.toBeNull()
    expect(feito).not.toBeNull()
    expect(motivo).toHaveTextContent("Motivo da visita:")
    expect(motivo).toHaveTextContent("Levar amostras")
    expect(feito).toHaveTextContent("O que foi feito:")
    expect(feito).toHaveTextContent("Pedido combinado")
    expect(motivo).toHaveClass("line-clamp-3")
    expect(feito).toHaveClass("line-clamp-3")
  })

  it("so-um-texto: mostra só o que existe", () => {
    const { container } = renderRow({
      item: buildItem({ oQueFazer: "Levar amostras" }),
    })

    expect(container.querySelector('[data-slot="agenda2-o-que-fazer"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="agenda2-o-que-foi-feito"]')).toBeNull()
    expect(screen.queryByText(/O que foi feito/)).not.toBeInTheDocument()
  })

  it("sem-texto-sem-linha: com os dois nulos não existe nenhum elemento nem rótulo desses campos", () => {
    const { container } = renderRow()

    expect(container.querySelector('[data-slot="agenda2-o-que-fazer"]')).toBeNull()
    expect(container.querySelector('[data-slot="agenda2-o-que-foi-feito"]')).toBeNull()
    expect(screen.queryByText(/Motivo da visita/)).not.toBeInTheDocument()
    expect(screen.queryByText(/O que foi feito/)).not.toBeInTheDocument()
  })

  it("supervisor-ve-textos: podeAlterar false mostra os textos e nenhum botão", () => {
    const { container } = renderRow({
      podeAlterar: false,
      item: buildItem({
        oQueFazer: "Levar amostras",
        oQueFoiFeito: "Pedido combinado",
      }),
    })

    expect(container.querySelector('[data-slot="agenda2-o-que-fazer"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="agenda2-o-que-foi-feito"]')).not.toBeNull()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("texto-puro: o texto é mostrado como texto, nunca como HTML", () => {
    const { container } = renderRow({
      item: buildItem({ oQueFazer: "<b>negrito</b>" }),
    })

    expect(container.querySelector("b")).toBeNull()
    expect(screen.getByText(/<b>negrito<\/b>/)).toBeInTheDocument()
  })
})
