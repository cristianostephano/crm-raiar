// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { GanhosItemRow } from "@/components/ganhos/GanhosItemRow"
import { ROTULO_SEM_NOME } from "@/lib/clientes/nomeExibicao"
import { DATA_GANHO_AUSENTE, type ClienteGanho } from "@/lib/ganhos/lista"

/**
 * Teste de tela da linha de cliente ganho (quick 261008-rxw). Componente de
 * apresentacao puro: a linha inteira abre a ficha (papel button, Enter e
 * espaco), sem botao interno, sem motivo e sem dado de contato.
 */

let nextId = 0
function buildCliente(partial: Partial<ClienteGanho> = {}): ClienteGanho {
  nextId += 1
  return {
    clienteId: `cliente-${nextId}`,
    razaoSocial: `Cliente ${nextId}`,
    nomeFantasia: null,
    ganhoEm: "2026-09-10",
    responsavel: "vendedor-1",
    responsavelNome: "Ana Souza",
    ...partial,
  }
}

function renderRow(cliente: ClienteGanho, showResponsavel = false, onAbrir = vi.fn()) {
  render(<GanhosItemRow cliente={cliente} showResponsavel={showResponsavel} onAbrir={onAbrir} />)
  return onAbrir
}

describe("GanhosItemRow", () => {
  it("titulo-fantasia: Nome Fantasia aparece como título, com atributo title igual", () => {
    renderRow(buildCliente({ razaoSocial: "Padaria Central Ltda", nomeFantasia: "Padaria do Zé" }))

    const titulo = screen.getByText("Padaria do Zé")
    expect(titulo).toHaveAttribute("title", "Padaria do Zé")
    expect(screen.queryByText("Padaria Central Ltda")).not.toBeInTheDocument()
  })

  it("titulo-razao: sem Nome Fantasia mostra a razão social", () => {
    renderRow(buildCliente({ razaoSocial: "Padaria Central Ltda", nomeFantasia: null }))

    expect(screen.getByText("Padaria Central Ltda")).toBeInTheDocument()
  })

  it("titulo-sem-nome: os dois nulos mostram ROTULO_SEM_NOME", () => {
    renderRow(buildCliente({ razaoSocial: null, nomeFantasia: null }))

    expect(screen.getByText(ROTULO_SEM_NOME)).toBeInTheDocument()
  })

  it("data: ganhoEm 2026-09-10 mostra 'Ganho em 10/09/2026'", () => {
    renderRow(buildCliente({ ganhoEm: "2026-09-10" }))

    expect(screen.getByText("Ganho em 10/09/2026")).toBeInTheDocument()
  })

  it("data-ausente: ganhoEm nulo mostra 'Data não informada' e nenhum 'Ganho em'", () => {
    renderRow(buildCliente({ ganhoEm: null }))

    expect(screen.getByText(DATA_GANHO_AUSENTE)).toBeInTheDocument()
    expect(screen.queryByText(/Ganho em/)).not.toBeInTheDocument()
  })

  it("responsavel-oculto: showResponsavel falso não mostra o nome do vendedor", () => {
    renderRow(buildCliente({ responsavelNome: "Ana Souza" }), false)

    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument()
  })

  it("responsavel-visivel: showResponsavel verdadeiro mostra o nome do vendedor", () => {
    renderRow(buildCliente({ responsavelNome: "Ana Souza" }), true)

    expect(screen.getByText("Ana Souza")).toBeInTheDocument()
  })

  it("abrir-clique: a linha é um botão 'Abrir ficha de {nome}' e o clique chama onAbrir com o clienteId", () => {
    const cliente = buildCliente({ razaoSocial: "Padaria Central Ltda" })
    const onAbrir = renderRow(cliente)

    fireEvent.click(screen.getByRole("button", { name: "Abrir ficha de Padaria Central Ltda" }))

    expect(onAbrir).toHaveBeenCalledTimes(1)
    expect(onAbrir).toHaveBeenCalledWith(cliente.clienteId)
  })

  it("abrir-teclado: Enter e espaço abrem a ficha; outra tecla não", () => {
    const cliente = buildCliente({ razaoSocial: "Padaria Central Ltda" })
    const onAbrir = renderRow(cliente)
    const linha = screen.getByRole("button", { name: "Abrir ficha de Padaria Central Ltda" })

    fireEvent.keyDown(linha, { key: "Enter" })
    fireEvent.keyDown(linha, { key: " " })
    expect(onAbrir).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(linha, { key: "a" })
    expect(onAbrir).toHaveBeenCalledTimes(2)
  })

  it("sem-acao-extra: exatamente um botão, sem Reabrir e sem motivo", () => {
    renderRow(buildCliente())

    expect(screen.getAllByRole("button")).toHaveLength(1)
    expect(screen.queryByText(/Reabrir/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Motivo/)).not.toBeInTheDocument()
  })
})
