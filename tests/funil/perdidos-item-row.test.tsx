// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { PerdidosItemRow } from "@/components/perdidos/PerdidosItemRow"
import { MOTIVO_PERDA_AUSENTE, type ClientePerdido } from "@/lib/perdidos/lista"
import { ROTULO_SEM_NOME } from "@/lib/clientes/nomeExibicao"

/**
 * Teste de tela da linha de cliente perdido (Fase 28, Plano 28-04, Tarefa 1).
 * Componente de apresentação puro — nenhum mock de Server Action necessário.
 */

let nextId = 0
function buildCliente(partial: Partial<ClientePerdido> = {}): ClientePerdido {
  nextId += 1
  return {
    clienteId: `cliente-${nextId}`,
    razaoSocial: `Cliente ${nextId}`,
    nomeFantasia: null,
    motivoPerdaNome: "Preço",
    perdidoEm: "2026-09-10T15:00:00.000Z",
    responsavel: "vendedor-1",
    responsavelNome: "Ana Souza",
    ...partial,
  }
}

describe("PerdidosItemRow", () => {
  it("titulo: razão social aparece e o título tem atributo title igual", () => {
    const cliente = buildCliente({ razaoSocial: "Padaria Central Ltda" })

    render(
      <PerdidosItemRow
        cliente={cliente}
        showResponsavel={false}
        reabrindo={false}
        onReabrir={vi.fn()}
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
      <PerdidosItemRow
        cliente={cliente}
        showResponsavel={false}
        reabrindo={false}
        onReabrir={vi.fn()}
      />
    )

    expect(screen.getByText("Mercado Bom Preço")).toBeInTheDocument()
  })

  it("titulo: os dois nulos mostram ROTULO_SEM_NOME", () => {
    const cliente = buildCliente({ razaoSocial: null, nomeFantasia: null })

    render(
      <PerdidosItemRow
        cliente={cliente}
        showResponsavel={false}
        reabrindo={false}
        onReabrir={vi.fn()}
      />
    )

    expect(screen.getByText(ROTULO_SEM_NOME)).toBeInTheDocument()
  })

  it("motivo: motivo aparece como texto puro, sem prefixo Motivo:", () => {
    const cliente = buildCliente({ motivoPerdaNome: "Preço" })

    render(
      <PerdidosItemRow
        cliente={cliente}
        showResponsavel={false}
        reabrindo={false}
        onReabrir={vi.fn()}
      />
    )

    expect(screen.getByText("Preço")).toBeInTheDocument()
    expect(screen.queryByText(/Motivo:/)).not.toBeInTheDocument()
  })

  it("motivo: motivo nulo mostra MOTIVO_PERDA_AUSENTE", () => {
    const cliente = buildCliente({ motivoPerdaNome: null })

    render(
      <PerdidosItemRow
        cliente={cliente}
        showResponsavel={false}
        reabrindo={false}
        onReabrir={vi.fn()}
      />
    )

    expect(screen.getByText(MOTIVO_PERDA_AUSENTE)).toBeInTheDocument()
  })

  it("data: perdidoEm mostra Perdido em 10/09/2026", () => {
    const cliente = buildCliente({ perdidoEm: "2026-09-10T15:00:00.000Z" })

    render(
      <PerdidosItemRow
        cliente={cliente}
        showResponsavel={false}
        reabrindo={false}
        onReabrir={vi.fn()}
      />
    )

    expect(screen.getByText("Perdido em 10/09/2026")).toBeInTheDocument()
  })

  it("responsavel: showResponsavel false não mostra o nome do vendedor", () => {
    const cliente = buildCliente({ responsavelNome: "Ana Souza" })

    render(
      <PerdidosItemRow
        cliente={cliente}
        showResponsavel={false}
        reabrindo={false}
        onReabrir={vi.fn()}
      />
    )

    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument()
  })

  it("responsavel: showResponsavel true mostra o nome do vendedor", () => {
    const cliente = buildCliente({ responsavelNome: "Ana Souza" })

    render(
      <PerdidosItemRow
        cliente={cliente}
        showResponsavel={true}
        reabrindo={false}
        onReabrir={vi.fn()}
      />
    )

    expect(screen.getByText("Ana Souza")).toBeInTheDocument()
  })

  it("reabrir: existe o botão com nome acessível, title e classe size-11; clicar chama onReabrir uma vez com o clienteId", () => {
    const onReabrir = vi.fn()
    const cliente = buildCliente({
      clienteId: "c1",
      razaoSocial: "Padaria Central Ltda",
    })

    render(
      <PerdidosItemRow
        cliente={cliente}
        showResponsavel={false}
        reabrindo={false}
        onReabrir={onReabrir}
      />
    )

    const botao = screen.getByRole("button", {
      name: "Reabrir Padaria Central Ltda",
    })
    expect(botao).toHaveAttribute("title", "Reabrir")
    expect(botao.className).toContain("size-11")

    fireEvent.click(botao)
    expect(onReabrir).toHaveBeenCalledTimes(1)
    expect(onReabrir).toHaveBeenCalledWith("c1")
  })

  it("reabrir: com reabrindo true o botão está desabilitado e o clique não chama onReabrir", () => {
    const onReabrir = vi.fn()
    const cliente = buildCliente({ razaoSocial: "Padaria Central Ltda" })

    render(
      <PerdidosItemRow
        cliente={cliente}
        showResponsavel={false}
        reabrindo={true}
        onReabrir={onReabrir}
      />
    )

    const botao = screen.getByRole("button", {
      name: "Reabrir Padaria Central Ltda",
    })
    expect(botao).toBeDisabled()

    fireEvent.click(botao)
    expect(onReabrir).not.toHaveBeenCalled()
  })

  it("sem-janela: depois do clique não existe nenhum elemento com papel dialog nem alertdialog (D-05)", () => {
    const cliente = buildCliente({ razaoSocial: "Padaria Central Ltda" })

    render(
      <PerdidosItemRow
        cliente={cliente}
        showResponsavel={false}
        reabrindo={false}
        onReabrir={vi.fn()}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Reabrir Padaria Central Ltda" })
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
