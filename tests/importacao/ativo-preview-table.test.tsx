// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ValidatedRowAtivo } from "@/app/actions/importacaoAtivos"
import { AtivoPreviewTable } from "@/components/importacao/AtivoPreviewTable"

function linha(
  overrides: Omit<Partial<ValidatedRowAtivo>, "resolved"> & {
    resolved?: Partial<ValidatedRowAtivo["resolved"]>
  } = {}
): ValidatedRowAtivo {
  return {
    row: 0,
    status: "ok",
    reasons: [],
    ...overrides,
    resolved: {
      razaoSocial: "Distribuidora Exemplo Ltda",
      cnpj: "12.345.678/0001-90",
      nomeFantasia: null,
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      complemento: null,
      cidade: "São Paulo",
      estado: "SP",
      categoriaId: null,
      contato: "Fulano de Tal",
      telefone: null,
      email: null,
      produtoIds: [],
      responsavelId: "vendedor-1",
      numeroDeLojas: null,
      ...overrides.resolved,
    },
  }
}

describe("AtivoPreviewTable", () => {
  it("colunas: os seis cabecalhos aparecem na ordem do contrato, com CNPJ entre razao social e cidade/UF", () => {
    render(
      <AtivoPreviewTable linhas={[linha()]} decisions={{}} onDecisionChange={vi.fn()} />
    )

    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent)
    expect(headers).toEqual([
      "Linha",
      "Razão social",
      "CNPJ",
      "Cidade/UF",
      "Status",
      "Ação",
    ])
  })

  it("cnpj: o cnpj resolvido aparece na coluna de CNPJ; quando ausente, mostra travessao", () => {
    render(
      <AtivoPreviewTable
        linhas={[linha({ resolved: { cnpj: "98.765.432/0001-10" } })]}
        decisions={{}}
        onDecisionChange={vi.fn()}
      />
    )

    expect(screen.getByText("98.765.432/0001-10")).toBeInTheDocument()
  })

  it("resumo: a linha de resumo mostra os quatro numeros com o texto do contrato", () => {
    render(
      <AtivoPreviewTable
        linhas={[
          linha({ row: 0, status: "ok" }),
          linha({
            row: 1,
            status: "erro",
            reasons: ["CNPJ não informado"],
          }),
          linha({
            row: 2,
            status: "duplicado",
            reasons: ['Possível duplicado de "Distribuidora Exemplo Ltda"'],
            similarTo: "Distribuidora Exemplo Ltda",
          }),
        ]}
        decisions={{}}
        onDecisionChange={vi.fn()}
      />
    )

    expect(
      screen.getByText(
        "3 linhas no total — 1 OK · 1 com erro · 1 possíveis duplicados"
      )
    ).toBeInTheDocument()
  })

  it("motivos: uma linha de erro mostra os motivos junto do selo de situacao", () => {
    render(
      <AtivoPreviewTable
        linhas={[
          linha({
            status: "erro",
            reasons: ["CNPJ não informado", "Cidade não informada"],
          }),
        ]}
        decisions={{}}
        onDecisionChange={vi.fn()}
      />
    )

    expect(
      screen.getByText("CNPJ não informado · Cidade não informada")
    ).toBeInTheDocument()
  })

  it("acaosoduplicado: os botoes de acao aparecem so em linha de possivel duplicado", () => {
    render(
      <AtivoPreviewTable
        linhas={[
          linha({ row: 0, status: "ok" }),
          linha({ row: 1, status: "erro", reasons: ["CNPJ não informado"] }),
          linha({
            row: 2,
            status: "duplicado",
            reasons: ['Possível duplicado de "X"'],
            similarTo: "X",
          }),
        ]}
        decisions={{}}
        onDecisionChange={vi.fn()}
      />
    )

    const rows = screen.getAllByRole("row")
    const okCells = within(rows[1]).queryAllByRole("button")
    const erroCells = within(rows[2]).queryAllByRole("button")
    const duplicadoCells = within(rows[3]).queryAllByRole("button")

    expect(okCells).toHaveLength(0)
    expect(erroCells).toHaveLength(0)
    expect(duplicadoCells).toHaveLength(2)
    expect(
      within(rows[3]).getByRole("button", { name: "Importar mesmo assim" })
    ).toBeInTheDocument()
    expect(
      within(rows[3]).getByRole("button", { name: "Pular" })
    ).toBeInTheDocument()
  })

  it("decisaocontrolada: clicar em importar mesmo assim dispara onDecisionChange com o indice da linha e a escolha, sem estado proprio", () => {
    const onDecisionChange = vi.fn()

    render(
      <AtivoPreviewTable
        linhas={[
          linha({
            row: 4,
            status: "duplicado",
            reasons: ['Possível duplicado de "X"'],
            similarTo: "X",
          }),
        ]}
        decisions={{}}
        onDecisionChange={onDecisionChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Importar mesmo assim" }))

    expect(onDecisionChange).toHaveBeenCalledWith(4, "importar")
  })

  it("vazio: lote sem linha mostra o estado vazio, nunca uma tabela sem corpo", () => {
    render(<AtivoPreviewTable linhas={[]} decisions={{}} onDecisionChange={vi.fn()} />)

    expect(
      screen.getByText("Nenhuma linha encontrada nesta planilha")
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("paginacao: com mais de 50 linhas a barra aparece; com 50 ou menos, nao aparece", () => {
    const muitasLinhas = Array.from({ length: 55 }, (_, index) =>
      linha({ row: index, resolved: { razaoSocial: `Cliente ${index}` } })
    )

    const { rerender } = render(
      <AtivoPreviewTable linhas={muitasLinhas} decisions={{}} onDecisionChange={vi.fn()} />
    )

    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }))
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument()

    rerender(
      <AtivoPreviewTable linhas={[linha()]} decisions={{}} onDecisionChange={vi.fn()} />
    )
    expect(screen.queryByText(/Página/)).not.toBeInTheDocument()
  })
})
