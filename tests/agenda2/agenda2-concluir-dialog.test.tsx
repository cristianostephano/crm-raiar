// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { Agenda2ConcluirDialog } from "@/components/agenda2/Agenda2ConcluirDialog"
import type { Agenda2Item } from "@/lib/agenda2/itens"

function buildItem(partial: Partial<Agenda2Item> = {}): Agenda2Item {
  return {
    id: "i1",
    nomeCliente: "Mercado Bom Preço",
    bairro: "Centro",
    data: "2026-10-01",
    concluido: false,
    atualizadoEm: "2026-10-01T12:00:00.000Z",
    responsavel: "v1",
    responsavelNome: "Ana Souza",
    oQueFazer: null,
    oQueFoiFeito: null,
    ...partial,
  }
}

function renderDialog(
  props: Partial<ComponentProps<typeof Agenda2ConcluirDialog>> = {}
) {
  return render(
    <Agenda2ConcluirDialog
      open={true}
      onOpenChange={vi.fn()}
      item={buildItem()}
      onConfirmar={vi.fn().mockResolvedValue(true)}
      {...props}
    />
  )
}

/**
 * Janela "Concluir visita" (quick 261006-ncy): campo opcional "O que foi
 * feito". A janela não chama ação nenhuma — quem chama é a Agenda2List.
 */
describe("Agenda2ConcluirDialog", () => {
  it("titulo-e-campo: título, linha da visita, rótulo, texto de apoio e os dois botões", () => {
    renderDialog()

    expect(screen.getByText("Concluir visita")).toBeInTheDocument()
    expect(
      screen.getByText("Visita de Mercado Bom Preço em 01/10.")
    ).toBeInTheDocument()
    expect(screen.getByLabelText("O que foi feito")).toHaveValue("")
    expect(
      screen.getByText("Opcional. Você pode concluir sem escrever nada.")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Concluir" })).toBeInTheDocument()
  })

  it("sem-aviso-de-numeros: nada na janela fala de números ou dados pessoais", () => {
    renderDialog()

    expect(screen.queryByText(/n[úu]mero/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/dados? pessoa/i)).not.toBeInTheDocument()
  })

  it("concluir-sem-texto: Concluir com a caixa vazia chama onConfirmar('') uma vez e fecha", async () => {
    const onOpenChange = vi.fn()
    const onConfirmar = vi.fn().mockResolvedValue(true)
    renderDialog({ onOpenChange, onConfirmar })

    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(onConfirmar).toHaveBeenCalledWith("")
  })

  it("concluir-com-texto: digitar e Concluir chama onConfirmar com o texto", async () => {
    const onConfirmar = vi.fn().mockResolvedValue(true)
    renderDialog({ onConfirmar })

    fireEvent.change(screen.getByLabelText("O que foi feito"), {
      target: { value: "Pedido fechado" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    await waitFor(() => expect(onConfirmar).toHaveBeenCalledTimes(1))
    expect(onConfirmar).toHaveBeenCalledWith("Pedido fechado")
  })

  it("prefill (P-03): item com 'O que foi feito' já salvo abre com a caixa preenchida", () => {
    renderDialog({ item: buildItem({ oQueFoiFeito: "Já anotado" }) })

    expect(screen.getByLabelText("O que foi feito")).toHaveValue("Já anotado")
  })

  it("cancelar: não chama onConfirmar e fecha", () => {
    const onOpenChange = vi.fn()
    const onConfirmar = vi.fn()
    renderDialog({ onOpenChange, onConfirmar })

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it("falha: onConfirmar devolve false mostra o alerta, continua aberta e mantém o texto digitado", async () => {
    const onOpenChange = vi.fn()
    const onConfirmar = vi.fn().mockResolvedValue(false)
    renderDialog({ onOpenChange, onConfirmar })

    fireEvent.change(screen.getByLabelText("O que foi feito"), {
      target: { value: "Pedido fechado" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    expect(
      await screen.findByText("Não foi possível salvar. Tente novamente.")
    ).toBeInTheDocument()
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByLabelText("O que foi feito")).toHaveValue("Pedido fechado")
  })

  it("salvando: enquanto não responde o botão mostra 'Concluindo...' e os dois botões ficam desabilitados", async () => {
    let resolver: (value: boolean) => void = () => {}
    const onConfirmar = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolver = resolve
        })
    )
    renderDialog({ onConfirmar })

    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    expect(
      await screen.findByRole("button", { name: "Concluindo..." })
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled()

    resolver(true)
  })

  it("sem-item: item null não quebra e não mostra nome de visita", () => {
    renderDialog({ item: null })

    expect(screen.getByText("Concluir visita")).toBeInTheDocument()
    expect(screen.queryByText(/Mercado Bom Preço/)).not.toBeInTheDocument()
  })
})
