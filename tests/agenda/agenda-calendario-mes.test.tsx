// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { AgendaCalendarioMes } from "@/components/agenda/AgendaCalendarioMes"
import type { AgendaItem } from "@/lib/agenda/itens"

// Sexta-feira 2026-08-14 — mesmo dia de referência do caso-exemplo do esboço
// (dia movimentado do mês, usado no Pitfall 10/AGD-09).
const NOW = new Date("2026-08-14T10:00:00")
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
    data: "2026-08-14",
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

function renderMes(
  props: Partial<ComponentProps<typeof AgendaCalendarioMes>> = {}
) {
  return render(
    <AgendaCalendarioMes
      referencia={REFERENCIA}
      porData={new Map()}
      onSelecionarDia={vi.fn()}
      now={NOW}
      {...props}
    />
  )
}

describe("AgendaCalendarioMes", () => {
  it("cabeçalho mostra os 7 rótulos de segunda a domingo, começando em Seg", () => {
    renderMes()

    const cabecalho = screen.getAllByText(/^(Seg|Ter|Qua|Qui|Sex|Sab|Dom)$/)
    expect(cabecalho).toHaveLength(7)
    expect(cabecalho[0]).toHaveTextContent("Seg")
    expect(cabecalho[6]).toHaveTextContent("Dom")
  })

  it("agosto de 2026 renderiza 42 células (6 semanas completas)", () => {
    const { container } = renderMes()

    expect(container.querySelectorAll('[role="button"]')).toHaveLength(42)
  })

  it("um mês de 5 semanas renderiza o número correspondente de células", () => {
    // Fevereiro de 2026 começa num domingo e tem 28 dias -> 5 semanas completas = 35 células
    const { container } = renderMes({
      referencia: new Date("2026-02-10T10:00:00"),
    })

    expect(container.querySelectorAll('[role="button"]')).toHaveLength(35)
  })

  it("célula fora do mês visível é esmaecida", () => {
    const { container } = renderMes()

    const celulas = container.querySelectorAll('[role="button"]')
    // primeira célula da grade de agosto/2026 é 27/07, fora do mês
    expect(celulas[0]).toHaveClass("bg-muted/30")
  })

  it("a célula de hoje é destacada, derivada do now recebido", () => {
    renderMes()

    expect(screen.getByText("14")).toHaveClass("bg-primary")
  })

  it("trocar a referência troca as células esmaecidas sem trocar o número de colunas", () => {
    const { container, rerender } = renderMes()
    const primeiraCelulaAgosto = container.querySelectorAll(
      '[role="button"]'
    )[0]
    const labelAgosto = primeiraCelulaAgosto.getAttribute("aria-label")

    rerender(
      <AgendaCalendarioMes
        referencia={new Date("2026-09-01T10:00:00")}
        porData={new Map()}
        onSelecionarDia={vi.fn()}
        now={NOW}
      />
    )

    const cabecalho = screen.getAllByText(/^(Seg|Ter|Qua|Qui|Sex|Sab|Dom)$/)
    expect(cabecalho).toHaveLength(7)
    const primeiraCelulaSetembro = container.querySelectorAll(
      '[role="button"]'
    )[0]
    expect(primeiraCelulaSetembro.getAttribute("aria-label")).not.toBe(
      labelAgosto
    )
  })

  it("clicar numa célula dispara onSelecionarDia com a data certa, inclusive em célula de mês vizinho", () => {
    const onSelecionarDia = vi.fn()
    const { container } = renderMes({ onSelecionarDia })

    const celulas = container.querySelectorAll('[role="button"]')
    fireEvent.click(celulas[0]) // 27/07/2026, fora do mês

    expect(onSelecionarDia).toHaveBeenCalledTimes(1)
    expect(onSelecionarDia.mock.calls[0][0]).toBeInstanceOf(Date)
  })

  it("a célula responde a Enter e a espaço", () => {
    const onSelecionarDia = vi.fn()
    const { container } = renderMes({ onSelecionarDia })

    const celula = container.querySelectorAll('[role="button"]')[10]
    fireEvent.keyDown(celula, { key: "Enter" })
    fireEvent.keyDown(celula, { key: " " })

    expect(onSelecionarDia).toHaveBeenCalledTimes(2)
  })

  it("a célula tem rótulo acessível com a data e a quantidade de itens do dia", () => {
    const { container } = renderMes({
      porData: buildPorData([buildItem({ data: "2026-08-14" })]),
    })

    const celulas = container.querySelectorAll('[role="button"]')
    const celulaHoje = Array.from(celulas).find((c) =>
      c.getAttribute("aria-label")?.includes("14 de agosto")
    )

    expect(celulaHoje?.getAttribute("aria-label")).toMatch(/1 item/)
  })

  it("um dia com 1 item mostra 1 chip e nenhum indicador de excedente", () => {
    const item = buildItem({ razaoSocial: "Padaria A", data: "2026-08-14" })
    renderMes({ porData: buildPorData([item]) })

    expect(screen.getByText("Padaria A")).toBeInTheDocument()
    expect(screen.queryByText(/mais$/)).not.toBeInTheDocument()
  })

  it("um dia com exatamente 3 itens mostra 3 chips e nenhum indicador de excedente", () => {
    const itens = [1, 2, 3].map((n) =>
      buildItem({
        itemId: `i${n}`,
        razaoSocial: `Cliente ${n}`,
        data: "2026-08-14",
      })
    )
    renderMes({ porData: buildPorData(itens) })

    for (const n of [1, 2, 3]) {
      expect(screen.getByText(`Cliente ${n}`)).toBeInTheDocument()
    }
    expect(screen.queryByText(/mais$/)).not.toBeInTheDocument()
  })

  it('um dia com 7 itens mostra 3 chips e o indicador "+4 mais" (caso de referência do esboço)', () => {
    const itens = Array.from({ length: 7 }, (_, i) =>
      buildItem({
        itemId: `item-${i}`,
        razaoSocial: `Cliente ${i}`,
        data: "2026-08-14",
      })
    )
    renderMes({ porData: buildPorData(itens) })

    expect(screen.getByText("+4 mais")).toBeInTheDocument()
    for (let i = 0; i < 3; i++) {
      expect(screen.getByText(`Cliente ${i}`)).toBeInTheDocument()
    }
    for (let i = 3; i < 7; i++) {
      expect(screen.queryByText(`Cliente ${i}`)).not.toBeInTheDocument()
    }
  })

  it("um dia sem itens mostra só o número do dia, sem chip e sem indicador", () => {
    renderMes()

    expect(screen.queryByText(/mais$/)).not.toBeInTheDocument()
  })

  it("chip de prospecção é cinza e chip de visita é azul — mesma linguagem visual da Lista (AGD-12)", () => {
    const prospeccao = buildItem({
      itemId: "p",
      origem: "prospeccao",
      data: "2026-08-14",
    })
    const visita = buildItem({
      itemId: "v",
      origem: "visita",
      data: "2026-08-17",
    })
    const { container } = renderMes({
      porData: buildPorData([prospeccao, visita]),
    })

    expect(container.querySelectorAll(".border-l-muted-foreground")).toHaveLength(
      1
    )
    expect(container.querySelectorAll(".border-l-primary")).toHaveLength(1)
  })

  it("chip de item atrasado ganha o acento vermelho na borda sem apagar o ícone de origem", () => {
    const visitaAtrasada = buildItem({
      itemId: "v-atrasada",
      origem: "visita",
      razaoSocial: "Cliente Atrasado",
      data: "2026-08-10",
    })
    const { container } = renderMes({
      porData: buildPorData([visitaAtrasada]),
    })

    const chip = container.querySelector(".border-l-destructive")
    expect(chip).not.toBeNull()
    expect(chip?.querySelector("svg")).not.toBeNull()
  })

  it("Pitfall 9: item atrasado em célula de mês vizinho mantém o acento vermelho legível mesmo com a célula esmaecida", () => {
    const atrasado = buildItem({
      itemId: "borda",
      origem: "visita",
      razaoSocial: "Cliente Borda",
      data: "2026-07-27", // primeira célula da grade de agosto/2026, fora do mês
    })
    const { container } = renderMes({ porData: buildPorData([atrasado]) })

    const celulas = container.querySelectorAll('[role="button"]')
    const celulaBorda = celulas[0]
    expect(celulaBorda).toHaveClass("bg-muted/30")

    const chip = celulaBorda.querySelector(".border-l-destructive")
    expect(chip).not.toBeNull()
  })

  it("Pitfall 10: estreitar o agrupamento (simulando o filtro de vendedor) muda chips e excedente de forma coerente", () => {
    const itensAmplo = Array.from({ length: 7 }, (_, i) =>
      buildItem({
        itemId: `wide-${i}`,
        responsavel: i < 4 ? "vendedor-1" : "vendedor-2",
        razaoSocial: `Cliente ${i}`,
        data: "2026-08-14",
      })
    )
    const { rerender } = renderMes({ porData: buildPorData(itensAmplo) })
    expect(screen.getByText("+4 mais")).toBeInTheDocument()

    const itensEstreitos = itensAmplo.filter(
      (item) => item.responsavel === "vendedor-1"
    )
    rerender(
      <AgendaCalendarioMes
        referencia={REFERENCIA}
        porData={buildPorData(itensEstreitos)}
        onSelecionarDia={vi.fn()}
        now={NOW}
      />
    )

    expect(screen.queryByText("+4 mais")).not.toBeInTheDocument()
    expect(screen.getByText("+1 mais")).toBeInTheDocument()
  })

  it('clicar no indicador "+N mais" dispara a mesma seleção de dia que a célula', () => {
    const onSelecionarDia = vi.fn()
    const itens = Array.from({ length: 5 }, (_, i) =>
      buildItem({ itemId: `m-${i}`, data: "2026-08-14" })
    )
    renderMes({ porData: buildPorData(itens), onSelecionarDia })

    fireEvent.click(screen.getByText("+2 mais"))

    expect(onSelecionarDia).toHaveBeenCalledTimes(1)
    const diaSelecionado = onSelecionarDia.mock.calls[0][0] as Date
    expect(diaSelecionado.getFullYear()).toBe(2026)
    expect(diaSelecionado.getMonth()).toBe(7)
    expect(diaSelecionado.getDate()).toBe(14)
  })

  it("clicar num chip ainda dispara a seleção do dia — o clique sobe para a célula, o chip não tem tratador próprio", () => {
    const onSelecionarDia = vi.fn()
    const item = buildItem({ razaoSocial: "Cliente Único", data: "2026-08-14" })
    renderMes({ porData: buildPorData([item]), onSelecionarDia })

    fireEvent.click(screen.getByText("Cliente Único"))

    expect(onSelecionarDia).toHaveBeenCalledTimes(1)
  })

  it("chips não têm papel de botão nem índice de tabulação próprio", () => {
    const item = buildItem({ razaoSocial: "Cliente Único", data: "2026-08-14" })
    const { container } = renderMes({ porData: buildPorData([item]) })

    const chip = screen.getByText("Cliente Único").closest("div")
    expect(chip).not.toHaveAttribute("role", "button")
    expect(chip).not.toHaveAttribute("tabindex")
  })
})
