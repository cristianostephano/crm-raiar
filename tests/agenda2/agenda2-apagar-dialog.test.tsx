// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { Agenda2ApagarDialog } from "@/components/agenda2/Agenda2ApagarDialog"
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
  props: Partial<ComponentProps<typeof Agenda2ApagarDialog>> = {}
) {
  return render(
    <Agenda2ApagarDialog
      open={true}
      onOpenChange={vi.fn()}
      item={buildItem()}
      onConfirmar={vi.fn().mockResolvedValue(true)}
      {...props}
    />
  )
}

describe("Agenda2ApagarDialog", () => {
  it("texto: aberto mostra o título e o corpo com nome e data dd/MM", () => {
    renderDialog()

    expect(screen.getByText("Apagar item")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Tem certeza que deseja apagar o item de Mercado Bom Preço em 01/10? Essa ação não pode ser desfeita."
      )
    ).toBeInTheDocument()
  })

  it("cancelar: clicar em Cancelar chama onOpenChange(false) e nunca chama onConfirmar", () => {
    const onOpenChange = vi.fn()
    const onConfirmar = vi.fn()
    renderDialog({ onOpenChange, onConfirmar })

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirmar).not.toHaveBeenCalled()
  })

  it("confirmar-sucesso: clicar em Apagar chama onConfirmar uma vez, mostra 'Apagando...' enquanto pendente, e fecha ao resolver true", async () => {
    const onOpenChange = vi.fn()
    let resolver: (value: boolean) => void = () => {}
    const onConfirmar = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolver = resolve
        })
    )
    renderDialog({ onOpenChange, onConfirmar })

    fireEvent.click(screen.getByRole("button", { name: "Apagar" }))

    expect(onConfirmar).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByRole("button", { name: "Apagando..." })
    ).toBeDisabled()

    resolver(true)

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it("confirmar-falha: onConfirmar resolve false mostra erro e não fecha a janela", async () => {
    const onOpenChange = vi.fn()
    const onConfirmar = vi.fn().mockResolvedValue(false)
    renderDialog({ onOpenChange, onConfirmar })

    fireEvent.click(screen.getByRole("button", { name: "Apagar" }))

    expect(
      await screen.findByText("Não foi possível salvar. Tente novamente.")
    ).toBeInTheDocument()
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("sem-item: item null não quebra e não mostra texto de item", () => {
    renderDialog({ item: null })

    expect(screen.getByText("Apagar item")).toBeInTheDocument()
    expect(screen.queryByText(/Mercado Bom Preço/)).not.toBeInTheDocument()
  })
})
