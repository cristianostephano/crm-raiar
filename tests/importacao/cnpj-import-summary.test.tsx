// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { CnpjImportSummary } from "@/components/importacao/CnpjImportSummary"

describe("CnpjImportSummary", () => {
  it("contagens: os dois numeros aparecem, e o de puladas e a soma das quantidades dos grupos (nao o numero de grupos)", () => {
    render(
      <CnpjImportSummary
        atualizadosCount={7}
        puladas={[
          { motivo: "Razão social não informada", quantidade: 2 },
          { motivo: "Cliente não encontrado com essa razão social", quantidade: 3 },
        ]}
        onVerClientes={vi.fn()}
        onEnviarOutra={vi.fn()}
      />
    )

    expect(screen.getByText("7")).toBeInTheDocument()
    // 2 grupos, soma = 5 — se o componente mostrasse o numero de grupos (2)
    // por engano, este teste falharia.
    expect(screen.getByText("5")).toBeInTheDocument()
  })

  it("motivos: cada grupo vira uma linha com o motivo e a quantidade, com singular e plural corretos", () => {
    render(
      <CnpjImportSummary
        atualizadosCount={0}
        puladas={[
          { motivo: "Razão social não informada", quantidade: 1 },
          { motivo: "Cliente não encontrado com essa razão social", quantidade: 4 },
        ]}
        onVerClientes={vi.fn()}
        onEnviarOutra={vi.fn()}
      />
    )

    expect(
      screen.getByText("Razão social não informada — 1 linha")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Cliente não encontrado com essa razão social — 4 linhas")
    ).toBeInTheDocument()
  })

  it("semmotivos: sem grupos, a secao de motivos nao e renderizada", () => {
    render(
      <CnpjImportSummary
        atualizadosCount={3}
        puladas={[]}
        onVerClientes={vi.fn()}
        onEnviarOutra={vi.fn()}
      />
    )

    expect(
      screen.queryByText("Motivos das linhas puladas")
    ).not.toBeInTheDocument()
  })

  it("botoes: os dois botoes existem com a copy do contrato e disparam as funcoes recebidas", () => {
    const onVerClientes = vi.fn()
    const onEnviarOutra = vi.fn()

    render(
      <CnpjImportSummary
        atualizadosCount={1}
        puladas={[]}
        onVerClientes={onVerClientes}
        onEnviarOutra={onEnviarOutra}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Ver clientes" }))
    fireEvent.click(screen.getByRole("button", { name: "Enviar outra planilha" }))

    expect(onVerClientes).toHaveBeenCalledTimes(1)
    expect(onEnviarOutra).toHaveBeenCalledTimes(1)
  })
})
