// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AtivoImportSummary } from "@/components/importacao/AtivoImportSummary"

describe("AtivoImportSummary", () => {
  it("conclusaocontagem: os dois numeros aparecem, e o de puladas e a soma das quantidades dos grupos", () => {
    render(
      <AtivoImportSummary
        importadosCount={4}
        puladas={[
          { motivo: "CNPJ não informado", quantidade: 2 },
          { motivo: "Cidade não informada", quantidade: 3 },
        ]}
        onVerClientes={vi.fn()}
        onImportarOutra={vi.fn()}
      />
    )

    expect(screen.getByText("Clientes ativos importados")).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()
    // 2 grupos, soma = 5 - se o componente mostrasse o numero de grupos por
    // engano, este teste falharia.
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(
      screen.getByText("Motivos das linhas puladas")
    ).toBeInTheDocument()
    expect(
      screen.getByText("CNPJ não informado — 2 linhas")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Cidade não informada — 3 linhas")
    ).toBeInTheDocument()
  })

  it("titulo: o cabecalho fala em importacao de clientes ativos concluida", () => {
    render(
      <AtivoImportSummary
        importadosCount={0}
        puladas={[]}
        onVerClientes={vi.fn()}
        onImportarOutra={vi.fn()}
      />
    )

    expect(
      screen.getByText("Importação de clientes ativos concluída")
    ).toBeInTheDocument()
  })

  it("semmotivos: sem grupos, a secao de motivos nao e renderizada", () => {
    render(
      <AtivoImportSummary
        importadosCount={2}
        puladas={[]}
        onVerClientes={vi.fn()}
        onImportarOutra={vi.fn()}
      />
    )

    expect(
      screen.queryByText("Motivos das linhas puladas")
    ).not.toBeInTheDocument()
  })

  it("conclusaoaviso: o aviso de frequencia de visita sempre aparece, inclusive sem linhas puladas", () => {
    render(
      <AtivoImportSummary
        importadosCount={1}
        puladas={[]}
        onVerClientes={vi.fn()}
        onImportarOutra={vi.fn()}
      />
    )

    expect(
      screen.getByText(/não define a frequência de visita/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Sem dia fixo definido/i)
    ).toBeInTheDocument()
  })

  it("conclusaobotoes: os dois botoes de acao disparam os retornos recebidos por propriedade", () => {
    const onVerClientes = vi.fn()
    const onImportarOutra = vi.fn()

    render(
      <AtivoImportSummary
        importadosCount={1}
        puladas={[]}
        onVerClientes={onVerClientes}
        onImportarOutra={onImportarOutra}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Ver clientes" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Importar outra planilha" })
    )

    expect(onVerClientes).toHaveBeenCalledTimes(1)
    expect(onImportarOutra).toHaveBeenCalledTimes(1)
  })
})
