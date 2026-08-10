// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ValidatedRowFrequencia } from "@/app/actions/importacaoFrequencia"
import { FrequenciaPreviewTable } from "@/components/importacao/FrequenciaPreviewTable"

function linha(
  overrides: Omit<Partial<ValidatedRowFrequencia>, "resolved"> & {
    resolved?: Partial<ValidatedRowFrequencia["resolved"]>
  } = {}
): ValidatedRowFrequencia {
  return {
    row: 0,
    status: "ok",
    reasons: [],
    ...overrides,
    resolved: {
      clienteId: "cliente-1",
      razaoSocial: "Distribuidora Exemplo Ltda",
      clienteEncontradoRazaoSocial: "Distribuidora Exemplo Ltda",
      frequenciaVisita: "mensal",
      ...overrides.resolved,
    },
  }
}

describe("FrequenciaPreviewTable", () => {
  it("colunas: os cinco cabecalhos aparecem na ordem do contrato, sem cabecalho de acao", () => {
    render(<FrequenciaPreviewTable linhas={[linha()]} />)

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent)
    expect(headers).toEqual([
      "Linha",
      "Razão social (na planilha)",
      "Cliente encontrado",
      "Nova frequência",
      "Status",
    ])
    expect(screen.queryByRole("columnheader", { name: "Ação" })).not.toBeInTheDocument()
  })

  it("encontrado: linha com casamento mostra a razao social do banco na coluna de cliente encontrado, diferente da coluna da planilha", () => {
    render(
      <FrequenciaPreviewTable
        linhas={[
          linha({
            resolved: {
              razaoSocial: "distribuidora exemplo",
              clienteEncontradoRazaoSocial: "Distribuidora Exemplo Ltda",
            },
          }),
        ]}
      />
    )

    const row = screen.getByRole("row", { name: /distribuidora exemplo/i })
    const cells = within(row).getAllByRole("cell")
    expect(cells[1]).toHaveTextContent("distribuidora exemplo")
    expect(cells[2]).toHaveTextContent("Distribuidora Exemplo Ltda")
    expect(cells[1].textContent).not.toBe(cells[2].textContent)
  })

  it("naoencontrado: linha sem casamento mostra travessao na coluna de cliente encontrado", () => {
    render(
      <FrequenciaPreviewTable
        linhas={[
          linha({
            status: "erro",
            reasons: ["Cliente não encontrado com essa razão social"],
            resolved: {
              clienteId: null,
              clienteEncontradoRazaoSocial: null,
              frequenciaVisita: null,
            },
          }),
        ]}
      />
    )

    const row = screen.getAllByRole("row")[1]
    const cells = within(row).getAllByRole("cell")
    expect(cells[2]).toHaveTextContent("—")
  })

  it("frequencia: a frequencia resolvida aparece pelo rotulo de exibicao, nunca pelo valor interno", () => {
    render(
      <FrequenciaPreviewTable
        linhas={[linha({ resolved: { frequenciaVisita: "quinzenal" } })]}
      />
    )

    expect(screen.getByText("Quinzenal")).toBeInTheDocument()
    expect(screen.queryByText("quinzenal")).not.toBeInTheDocument()
  })

  it("motivos: linha com dois motivos mostra os dois, juntados pelo separador", () => {
    render(
      <FrequenciaPreviewTable
        linhas={[
          linha({
            status: "erro",
            reasons: [
              "Razão social não informada",
              "Frequência de visita não informada",
            ],
            resolved: {
              clienteId: null,
              clienteEncontradoRazaoSocial: null,
              frequenciaVisita: null,
            },
          }),
        ]}
      />
    )

    expect(
      screen.getByText(
        "Razão social não informada · Frequência de visita não informada"
      )
    ).toBeInTheDocument()
  })

  it("resumo: a linha de resumo mostra os tres numeros com o texto do contrato", () => {
    render(
      <FrequenciaPreviewTable
        linhas={[
          linha({ row: 0, status: "ok" }),
          linha({
            row: 1,
            status: "erro",
            reasons: ["Razão social não informada"],
            resolved: {
              clienteId: null,
              clienteEncontradoRazaoSocial: null,
              frequenciaVisita: null,
            },
          }),
        ]}
      />
    )

    expect(
      screen.getByText("2 linhas no total — 1 prontas para atualizar · 1 com erro")
    ).toBeInTheDocument()
  })

  it("vazio: lista vazia mostra o estado vazio, nao uma tabela sem linhas", () => {
    render(<FrequenciaPreviewTable linhas={[]} />)

    expect(
      screen.getByText("Nenhuma linha encontrada nesta planilha")
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("paginacao: com mais linhas do que cabe numa pagina, a barra aparece e avancar mostra a pagina seguinte; com poucas, nao aparece", () => {
    const muitasLinhas = Array.from({ length: 55 }, (_, index) =>
      linha({ row: index, resolved: { razaoSocial: `Cliente ${index}` } })
    )

    const { rerender } = render(<FrequenciaPreviewTable linhas={muitasLinhas} />)

    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }))
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument()

    rerender(<FrequenciaPreviewTable linhas={[linha()]} />)
    expect(screen.queryByText(/Página/)).not.toBeInTheDocument()
  })
})
