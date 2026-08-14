// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { ValidatedRowCnpj } from "@/app/actions/importacaoCnpj"
import { CnpjPreviewTable } from "@/components/importacao/CnpjPreviewTable"

function linha(
  overrides: Omit<Partial<ValidatedRowCnpj>, "resolved"> & {
    resolved?: Partial<ValidatedRowCnpj["resolved"]>
  } = {}
): ValidatedRowCnpj {
  return {
    row: 0,
    status: "ok",
    reasons: [],
    ...overrides,
    resolved: {
      clienteId: "cliente-1",
      razaoSocial: "Distribuidora Exemplo Ltda",
      clienteEncontradoRazaoSocial: "Distribuidora Exemplo Ltda",
      cnpj: "12.345.678/0001-90",
      ...overrides.resolved,
    },
  }
}

describe("CnpjPreviewTable", () => {
  it("colunas: os cinco cabecalhos aparecem na ordem do contrato, sem cabecalho de acao", () => {
    render(<CnpjPreviewTable linhas={[linha()]} />)

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent)
    expect(headers).toEqual([
      "Linha",
      "Razão social (na planilha)",
      "Cliente encontrado",
      "CNPJ a gravar",
      "Status",
    ])
    expect(screen.queryByRole("columnheader", { name: "Ação" })).not.toBeInTheDocument()
  })

  it("encontrado: linha com casamento mostra a razao social do banco na coluna de cliente encontrado, diferente da coluna da planilha", () => {
    render(
      <CnpjPreviewTable
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
      <CnpjPreviewTable
        linhas={[
          linha({
            status: "erro",
            reasons: ["Cliente não encontrado com essa razão social"],
            resolved: {
              clienteId: null,
              clienteEncontradoRazaoSocial: null,
              cnpj: null,
            },
          }),
        ]}
      />
    )

    const row = screen.getAllByRole("row")[1]
    const cells = within(row).getAllByRole("cell")
    expect(cells[2]).toHaveTextContent("—")
  })

  it("cnpj: o cnpj resolvido aparece na coluna de cnpj a gravar; quando nulo, mostra travessao", () => {
    render(
      <CnpjPreviewTable
        linhas={[linha({ resolved: { cnpj: "98.765.432/0001-10" } })]}
      />
    )

    expect(screen.getByText("98.765.432/0001-10")).toBeInTheDocument()
  })

  it("ambiguo: linha de nome ambiguo aparece como erro com o motivo de ambiguidade legivel, e nao conta entre as prontas", () => {
    render(
      <CnpjPreviewTable
        linhas={[
          linha({
            status: "erro",
            reasons: [
              "Mais de um cliente encontrado com essa razão social — use o nome exato do cadastro",
            ],
            resolved: {
              clienteId: null,
              clienteEncontradoRazaoSocial: null,
              cnpj: null,
            },
          }),
        ]}
      />
    )

    expect(
      screen.getByText(
        "Mais de um cliente encontrado com essa razão social — use o nome exato do cadastro"
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText("1 linhas no total — 0 prontas para atualizar · 1 com erro")
    ).toBeInTheDocument()
  })

  it("motivos: linha com dois motivos mostra os dois, juntados pelo separador", () => {
    render(
      <CnpjPreviewTable
        linhas={[
          linha({
            status: "erro",
            reasons: ["Razão social não informada", "CNPJ não informado"],
            resolved: {
              clienteId: null,
              clienteEncontradoRazaoSocial: null,
              cnpj: null,
            },
          }),
        ]}
      />
    )

    expect(
      screen.getByText("Razão social não informada · CNPJ não informado")
    ).toBeInTheDocument()
  })

  it("resumo: a linha de resumo mostra os tres numeros com o texto do contrato", () => {
    render(
      <CnpjPreviewTable
        linhas={[
          linha({ row: 0, status: "ok" }),
          linha({
            row: 1,
            status: "erro",
            reasons: ["Razão social não informada"],
            resolved: {
              clienteId: null,
              clienteEncontradoRazaoSocial: null,
              cnpj: null,
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
    render(<CnpjPreviewTable linhas={[]} />)

    expect(
      screen.getByText("Nenhuma linha encontrada nesta planilha")
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("paginacao: com mais linhas do que cabe numa pagina, a barra aparece e avancar mostra a pagina seguinte; com poucas, nao aparece", () => {
    const muitasLinhas = Array.from({ length: 55 }, (_, index) =>
      linha({ row: index, resolved: { razaoSocial: `Cliente ${index}` } })
    )

    const { rerender } = render(<CnpjPreviewTable linhas={muitasLinhas} />)

    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }))
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument()

    rerender(<CnpjPreviewTable linhas={[linha()]} />)
    expect(screen.queryByText(/Página/)).not.toBeInTheDocument()
  })
})
