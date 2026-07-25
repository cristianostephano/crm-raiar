// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ImportSummary } from "@/components/importacao/ImportSummary"

describe("ImportSummary", () => {
  it("renders both stat tiles, the count, and the reason-grouped breakdown when there are puladas", () => {
    render(
      <ImportSummary
        importadosCount={5}
        puladas={[
          { motivo: "Razão social não informada", quantidade: 2 },
        ]}
        onVerClientes={vi.fn()}
        onImportarOutra={vi.fn()}
      />
    )

    expect(screen.getByText("Clientes importados")).toBeInTheDocument()
    expect(screen.getByText("Linhas puladas")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(
      screen.getByText("Motivos das linhas puladas")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Razão social não informada — 2 linhas")
    ).toBeInTheDocument()
  })

  it("omits the breakdown heading entirely when puladas is empty", () => {
    render(
      <ImportSummary
        importadosCount={3}
        puladas={[]}
        onVerClientes={vi.fn()}
        onImportarOutra={vi.fn()}
      />
    )

    expect(
      screen.queryByText("Motivos das linhas puladas")
    ).not.toBeInTheDocument()
  })
})
