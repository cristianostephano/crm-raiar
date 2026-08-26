// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AgendaSemDiaFixo } from "@/components/agenda/AgendaSemDiaFixo"
import type { ClienteSemDiaFixo } from "@/lib/agenda/itens"

/**
 * Teste de tela do componente novo do aviso de dia fixo (AGENDA-01, Fase 24,
 * Plano 24-03). Componente de apresentação puro — nenhum mock de ação de
 * servidor é necessário aqui.
 */

let nextId = 0
function buildCliente(partial: Partial<ClienteSemDiaFixo> = {}): ClienteSemDiaFixo {
  nextId += 1
  return {
    clienteId: `cliente-${nextId}`,
    razaoSocial: `Cliente ${nextId}`,
    responsavel: "vendedor-1",
    responsavelNome: "Vendedor Um",
    frequenciaVisita: null,
    ...partial,
  }
}

describe("AgendaSemDiaFixo", () => {
  it("lista vazia nao desenha nada (nem titulo, nem moldura)", () => {
    const { container } = render(
      <AgendaSemDiaFixo
        clientes={[]}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("dois clientes (um sem frequencia, um com frequencia sem dia fixo) desenham duas linhas com os dois textos de motivo diferentes", () => {
    const clientes = [
      buildCliente({
        razaoSocial: "Padaria Sem Frequência",
        frequenciaVisita: null,
      }),
      buildCliente({
        razaoSocial: "Mercado Sem Dia Fixo",
        frequenciaVisita: "semanal",
      }),
    ]

    render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
      />
    )

    expect(screen.getByText("Padaria Sem Frequência")).toBeInTheDocument()
    expect(screen.getByText("Mercado Sem Dia Fixo")).toBeInTheDocument()
    expect(
      screen.getByText("Ainda não tem frequência de visita definida.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Falta escolher o dia fixo da recorrência.")
    ).toBeInTheDocument()
  })

  it("o titulo mostra a contagem de clientes", () => {
    const clientes = [buildCliente(), buildCliente(), buildCliente()]

    render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
      />
    )

    expect(screen.getByText("Sem dia fixo definido (3)")).toBeInTheDocument()
  })

  it("clicar numa linha chama o pedido de abrir ficha com o identificador daquele cliente", () => {
    const onOpenCliente = vi.fn()
    const clientes = [
      buildCliente({ clienteId: "cliente-alvo", razaoSocial: "Padaria Alvo" }),
    ]

    render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={false}
        onOpenCliente={onOpenCliente}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Padaria Alvo/ }))

    expect(onOpenCliente).toHaveBeenCalledWith("cliente-alvo")
  })

  it("o nome do responsavel aparece so quando showResponsavel e verdadeiro", () => {
    const clientes = [
      buildCliente({ razaoSocial: "Padaria Central", responsavelNome: "Ana" }),
    ]

    const { rerender } = render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
      />
    )

    expect(screen.queryByText("Ana")).not.toBeInTheDocument()

    rerender(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={true}
        onOpenCliente={vi.fn()}
      />
    )

    expect(screen.getByText("Ana")).toBeInTheDocument()
  })
})
