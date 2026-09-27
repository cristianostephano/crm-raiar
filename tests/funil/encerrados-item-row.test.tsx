// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { EncerradosItemRow } from "@/components/encerrados/EncerradosItemRow"
import { MOTIVO_ENCERRAMENTO_AUSENTE, type ClienteEncerrado } from "@/lib/encerrados/lista"
import { ROTULO_SEM_NOME } from "@/lib/clientes/nomeExibicao"

/**
 * Teste de tela da linha de cliente encerrado (Fase 29, Plano 29-07, Tarefa
 * 1). Componente de apresentação puro — cópia estrutural de
 * tests/funil/perdidos-item-row.test.tsx, nomes trocados.
 */

let nextId = 0
function buildCliente(partial: Partial<ClienteEncerrado> = {}): ClienteEncerrado {
  nextId += 1
  return {
    clienteId: `cliente-${nextId}`,
    razaoSocial: `Cliente ${nextId}`,
    nomeFantasia: null,
    motivoEncerramentoNome: "Fechou o estabelecimento",
    encerradoEm: "2026-09-20T15:00:00.000Z",
    responsavel: "vendedor-1",
    responsavelNome: "Ana Souza",
    ...partial,
  }
}

describe("EncerradosItemRow", () => {
  it("titulo: razão social aparece e o título tem atributo title igual", () => {
    const cliente = buildCliente({ razaoSocial: "Padaria Central Ltda" })

    render(
      <EncerradosItemRow
        cliente={cliente}
        showResponsavel={false}
        reativando={false}
        onReativar={vi.fn()}
      />
    )

    const titulo = screen.getByText("Padaria Central Ltda")
    expect(titulo).toBeInTheDocument()
    expect(titulo).toHaveAttribute("title", "Padaria Central Ltda")
  })

  it("titulo: razão nula + Nome Fantasia mostra o Nome Fantasia", () => {
    const cliente = buildCliente({
      razaoSocial: null,
      nomeFantasia: "Mercado Bom Preço",
    })

    render(
      <EncerradosItemRow
        cliente={cliente}
        showResponsavel={false}
        reativando={false}
        onReativar={vi.fn()}
      />
    )

    expect(screen.getByText("Mercado Bom Preço")).toBeInTheDocument()
  })

  it("titulo: os dois nulos mostram ROTULO_SEM_NOME", () => {
    const cliente = buildCliente({ razaoSocial: null, nomeFantasia: null })

    render(
      <EncerradosItemRow
        cliente={cliente}
        showResponsavel={false}
        reativando={false}
        onReativar={vi.fn()}
      />
    )

    expect(screen.getByText(ROTULO_SEM_NOME)).toBeInTheDocument()
  })

  it("motivo: motivo aparece como texto puro, sem prefixo", () => {
    const cliente = buildCliente({
      motivoEncerramentoNome: "Fechou o estabelecimento",
    })

    render(
      <EncerradosItemRow
        cliente={cliente}
        showResponsavel={false}
        reativando={false}
        onReativar={vi.fn()}
      />
    )

    expect(screen.getByText("Fechou o estabelecimento")).toBeInTheDocument()
    expect(screen.queryByText(/Motivo:/)).not.toBeInTheDocument()
  })

  it("motivo: motivo nulo mostra MOTIVO_ENCERRAMENTO_AUSENTE", () => {
    const cliente = buildCliente({ motivoEncerramentoNome: null })

    render(
      <EncerradosItemRow
        cliente={cliente}
        showResponsavel={false}
        reativando={false}
        onReativar={vi.fn()}
      />
    )

    expect(screen.getByText(MOTIVO_ENCERRAMENTO_AUSENTE)).toBeInTheDocument()
  })

  it("data: encerradoEm mostra Encerrado em 20/09/2026", () => {
    const cliente = buildCliente({ encerradoEm: "2026-09-20T15:00:00.000Z" })

    render(
      <EncerradosItemRow
        cliente={cliente}
        showResponsavel={false}
        reativando={false}
        onReativar={vi.fn()}
      />
    )

    expect(screen.getByText("Encerrado em 20/09/2026")).toBeInTheDocument()
  })

  it("responsavel: showResponsavel false não mostra o nome do vendedor", () => {
    const cliente = buildCliente({ responsavelNome: "Ana Souza" })

    render(
      <EncerradosItemRow
        cliente={cliente}
        showResponsavel={false}
        reativando={false}
        onReativar={vi.fn()}
      />
    )

    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument()
  })

  it("responsavel: showResponsavel true mostra o nome do vendedor", () => {
    const cliente = buildCliente({ responsavelNome: "Ana Souza" })

    render(
      <EncerradosItemRow
        cliente={cliente}
        showResponsavel={true}
        reativando={false}
        onReativar={vi.fn()}
      />
    )

    expect(screen.getByText("Ana Souza")).toBeInTheDocument()
  })

  it("reativar: existe o botão com nome acessível, title e classe size-11; clicar chama onReativar uma vez com o clienteId", () => {
    const onReativar = vi.fn()
    const cliente = buildCliente({
      clienteId: "c1",
      razaoSocial: "Padaria Central Ltda",
    })

    render(
      <EncerradosItemRow
        cliente={cliente}
        showResponsavel={false}
        reativando={false}
        onReativar={onReativar}
      />
    )

    const botao = screen.getByRole("button", {
      name: "Reativar Padaria Central Ltda",
    })
    expect(botao).toHaveAttribute("title", "Reativar")
    expect(botao.className).toContain("size-11")

    fireEvent.click(botao)
    expect(onReativar).toHaveBeenCalledTimes(1)
    expect(onReativar).toHaveBeenCalledWith("c1")
  })

  it("reativar: com reativando true o botão está desabilitado e o clique não chama onReativar", () => {
    const onReativar = vi.fn()
    const cliente = buildCliente({ razaoSocial: "Padaria Central Ltda" })

    render(
      <EncerradosItemRow
        cliente={cliente}
        showResponsavel={false}
        reativando={true}
        onReativar={onReativar}
      />
    )

    const botao = screen.getByRole("button", {
      name: "Reativar Padaria Central Ltda",
    })
    expect(botao).toBeDisabled()

    fireEvent.click(botao)
    expect(onReativar).not.toHaveBeenCalled()
  })

  it("sem-janela: depois do clique não existe nenhum elemento com papel dialog nem alertdialog (D-09)", () => {
    const cliente = buildCliente({ razaoSocial: "Padaria Central Ltda" })

    render(
      <EncerradosItemRow
        cliente={cliente}
        showResponsavel={false}
        reativando={false}
        onReativar={vi.fn()}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Reativar Padaria Central Ltda" })
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
