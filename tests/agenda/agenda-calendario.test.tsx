// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { AgendaCalendario } from "@/components/agenda/AgendaCalendario"
import type { AgendaItem } from "@/lib/agenda/itens"

// Sexta-feira 2026-08-14 — mesmo dia de referência usado nos testes das
// três visões (planos 20-02/20-03).
const NOW = new Date("2026-08-14T10:00:00")

function buildItem(partial: Partial<AgendaItem> = {}): AgendaItem {
  return {
    origem: "prospeccao",
    itemId: "item-1",
    clienteId: "cliente-1",
    razaoSocial: "Padaria Raiar Ltda",
    responsavel: "vendedor-1",
    responsavelNome: "Fulano de Tal",
    titulo: "Visitar",
    data: "2026-08-14",
    frequenciaVisita: null,
    proximaDataSugerida: null,
    ...partial,
  }
}

function renderCalendario(
  props: Partial<ComponentProps<typeof AgendaCalendario>> = {}
) {
  return render(
    <AgendaCalendario
      visao="mes"
      onVisaoChange={vi.fn()}
      itens={[]}
      showResponsavel={false}
      onOpenCliente={vi.fn()}
      onConcluirItem={vi.fn()}
      now={NOW}
      {...props}
    />
  )
}

function findCelulaDoDia(container: HTMLElement, trechoDaData: string) {
  const celulas = container.querySelectorAll('[role="button"]')
  const celula = Array.from(celulas).find((c) =>
    c.getAttribute("aria-label")?.includes(trechoDaData)
  )
  if (!celula) throw new Error(`célula não encontrada para "${trechoDaData}"`)
  return celula
}

describe("AgendaCalendario", () => {
  it("visão lista: renderiza só a barra de ferramentas, sem grade nenhuma", () => {
    const { container } = renderCalendario({ visao: "lista" })

    expect(screen.getByRole("button", { name: "Lista" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(0)
    expect(screen.queryByText("Prospecção")).not.toBeInTheDocument()
  })

  it("visão mês: mostra o rótulo do mês e a grade de mês (42 células em agosto de 2026)", () => {
    const { container } = renderCalendario({ visao: "mes" })

    expect(screen.getByText("Agosto de 2026")).toBeInTheDocument()
    expect(container.querySelectorAll('[role="button"]')).toHaveLength(42)
  })

  it("visão semana: mostra o rótulo da semana e as 7 colunas", () => {
    renderCalendario({ visao: "semana" })

    expect(screen.getByText("10 - 16 de agosto de 2026")).toBeInTheDocument()
    expect(screen.getAllByText("—")).toHaveLength(7)
  })

  it("visão dia: mostra o cabeçalho com a data por extenso e a lista do dia", () => {
    renderCalendario({ visao: "dia" })

    expect(
      screen.getByRole("heading", { name: "Sexta-feira, 14 de agosto de 2026" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Nada pendente para este dia.")
    ).toBeInTheDocument()
  })

  it("avançar/voltar no modo mês movem o rótulo um mês por vez", () => {
    renderCalendario({ visao: "mes" })

    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))
    expect(screen.getByText("Setembro de 2026")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Período anterior" }))
    expect(screen.getByText("Agosto de 2026")).toBeInTheDocument()
  })

  it("avançar no modo semana move o rótulo uma semana", () => {
    renderCalendario({ visao: "semana" })

    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))
    expect(screen.getByText("17 - 23 de agosto de 2026")).toBeInTheDocument()
  })

  it("avançar no modo dia move o rótulo um dia", () => {
    renderCalendario({ visao: "dia" })

    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))
    expect(
      screen.getByRole("heading", { name: "Sábado, 15 de agosto de 2026" })
    ).toBeInTheDocument()
  })

  it("clicar em Hoje devolve a referência para a data de now depois de navegar para longe", () => {
    renderCalendario({ visao: "mes" })

    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))
    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))
    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))
    expect(screen.getByText("Novembro de 2026")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }))
    expect(screen.getByText("Agosto de 2026")).toBeInTheDocument()
  })

  it("trocar de visão preserva a data de referência", () => {
    const { rerender } = renderCalendario({ visao: "mes" })

    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))
    expect(screen.getByText("Setembro de 2026")).toBeInTheDocument()

    rerender(
      <AgendaCalendario
        visao="dia"
        onVisaoChange={vi.fn()}
        itens={[]}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
        onConcluirItem={vi.fn()}
        now={NOW}
      />
    )

    // referência preservada em 14/09/2026 (segunda-feira), não voltou para
    // o now (14/08/2026).
    expect(
      screen.getByRole("heading", {
        name: "Segunda-feira, 14 de setembro de 2026",
      })
    ).toBeInTheDocument()
  })

  it("o mesmo agrupamento alimenta a visão de mês e a de semana para o mesmo dia", () => {
    const itens = [buildItem({ razaoSocial: "Padaria A", data: "2026-08-14" })]
    const { rerender } = renderCalendario({ visao: "mes", itens })

    expect(screen.getByText("Padaria A")).toBeInTheDocument()

    rerender(
      <AgendaCalendario
        visao="semana"
        onVisaoChange={vi.fn()}
        itens={itens}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
        onConcluirItem={vi.fn()}
        now={NOW}
      />
    )

    expect(screen.getByText("Padaria A")).toBeInTheDocument()
  })

  it("clicar num dia da grade de mês abre o diálogo com o título e a lista daquele dia", () => {
    const itens = [buildItem({ razaoSocial: "Padaria A", data: "2026-08-14" })]
    const { container } = renderCalendario({ visao: "mes", itens })

    fireEvent.click(findCelulaDoDia(container, "14 de agosto"))

    const dialog = screen.getByRole("dialog")
    expect(
      within(dialog).getByText("Sexta-feira, 14 de agosto de 2026")
    ).toBeInTheDocument()
    expect(within(dialog).getByText("Padaria A")).toBeInTheDocument()
  })

  it("o diálogo de um dia sem itens mostra a mensagem de dia vazio", () => {
    const { container } = renderCalendario({ visao: "mes" })

    fireEvent.click(findCelulaDoDia(container, "14 de agosto"))

    expect(
      within(screen.getByRole("dialog")).getByText(
        "Nada pendente para este dia."
      )
    ).toBeInTheDocument()
  })

  it("fechar o diálogo o remove", () => {
    const { container } = renderCalendario({ visao: "mes" })

    fireEvent.click(findCelulaDoDia(container, "14 de agosto"))
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /close/i }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("concluir um item de dentro do diálogo dispara onConcluirItem com o item certo", () => {
    const onConcluirItem = vi.fn()
    const item = buildItem({ razaoSocial: "Padaria A", data: "2026-08-14" })
    const { container } = renderCalendario({
      visao: "mes",
      itens: [item],
      onConcluirItem,
    })

    fireEvent.click(findCelulaDoDia(container, "14 de agosto"))
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Concluir",
      })
    )

    expect(onConcluirItem).toHaveBeenCalledWith(item)
  })

  it("abrir um item de dentro do diálogo dispara onOpenCliente com o identificador certo", () => {
    const onOpenCliente = vi.fn()
    const item = buildItem({
      razaoSocial: "Padaria A",
      clienteId: "cliente-42",
      data: "2026-08-14",
    })
    const { container } = renderCalendario({
      visao: "mes",
      itens: [item],
      onOpenCliente,
    })

    fireEvent.click(findCelulaDoDia(container, "14 de agosto"))
    fireEvent.click(within(screen.getByRole("dialog")).getByText("Padaria A"))

    expect(onOpenCliente).toHaveBeenCalledWith("cliente-42")
  })

  it("clicar num cartão da semana dispara onOpenCliente com o identificador certo", () => {
    const onOpenCliente = vi.fn()
    const item = buildItem({
      razaoSocial: "Padaria A",
      clienteId: "cliente-42",
      data: "2026-08-14",
    })
    renderCalendario({ visao: "semana", itens: [item], onOpenCliente })

    fireEvent.click(screen.getByText("Padaria A"))

    expect(onOpenCliente).toHaveBeenCalledWith("cliente-42")
  })
})
