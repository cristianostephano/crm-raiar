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
      c.getAttribute("aria-label")?.startsWith("Sexta")
    )

    expect(celulaHoje?.getAttribute("aria-label")).toMatch(/1 item/)
  })
})
