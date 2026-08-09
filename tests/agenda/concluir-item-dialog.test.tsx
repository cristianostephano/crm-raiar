// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { ConcluirItemDialog } from "@/components/agenda/ConcluirItemDialog"

const RESUMO_VALIDO = "Cliente confirmou pedido para a próxima semana."

function renderDialog(
  overrides: Partial<ComponentProps<typeof ConcluirItemDialog>> = {}
) {
  const onOpenChange = vi.fn()
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  const { unmount } = render(
    <ConcluirItemDialog
      open
      onOpenChange={onOpenChange}
      origem="prospeccao"
      razaoSocial="Padaria Central"
      itemTitulo="Visitar"
      frequenciaVisita={null}
      proximaDataSugerida={null}
      onConfirm={onConfirm}
      {...overrides}
    />
  )
  return { onOpenChange, onConfirm, unmount }
}

describe("ConcluirItemDialog (CONC-01/VIS-03)", () => {
  it("prospeccao: título de tarefa, descrição com o título do item, nenhum campo de próxima data mesmo com frequência e data sugerida", () => {
    renderDialog({
      origem: "prospeccao",
      itemTitulo: "Mandar mensagem",
      frequenciaVisita: "mensal",
      proximaDataSugerida: "2026-03-15",
    })

    expect(
      screen.getByText("Concluir tarefa de Padaria Central?")
    ).toBeInTheDocument()
    expect(screen.getByText("Mandar mensagem")).toBeInTheDocument()
    expect(screen.queryByText("Próxima visita sugerida")).not.toBeInTheDocument()
    expect(screen.queryByText("15/03/2026")).not.toBeInTheDocument()
  })

  it("visita: título de visita, rótulo de próxima data aparece, e o gatilho mostra a data sugerida em dd/MM/yyyy sem deslocamento de fuso", () => {
    renderDialog({
      origem: "visita",
      itemTitulo: "Visita",
      frequenciaVisita: "mensal",
      proximaDataSugerida: "2026-01-31",
    })

    expect(
      screen.getByText("Concluir visita de Padaria Central?")
    ).toBeInTheDocument()
    expect(screen.getByText("Próxima visita sugerida")).toBeInTheDocument()
    expect(screen.getByText("31/01/2026")).toBeInTheDocument()
  })

  it("nenhuma: cliente sem cadência (frequência 'nenhuma' ou ausente) mostra o aviso e não mostra rótulo nem gatilho de próxima data", () => {
    const { unmount } = renderDialog({
      origem: "visita",
      frequenciaVisita: "nenhuma",
      proximaDataSugerida: null,
    })

    expect(
      screen.getByText(
        "Este cliente não tem frequência de visita definida — nenhuma próxima visita será agendada."
      )
    ).toBeInTheDocument()
    expect(screen.queryByText("Próxima visita sugerida")).not.toBeInTheDocument()
    unmount()

    renderDialog({
      origem: "visita",
      frequenciaVisita: null,
      proximaDataSugerida: null,
    })

    expect(
      screen.getByText(
        "Este cliente não tem frequência de visita definida — nenhuma próxima visita será agendada."
      )
    ).toBeInTheDocument()
    expect(screen.queryByText("Próxima visita sugerida")).not.toBeInTheDocument()
  })

  it("desabilitado: começa desabilitado, continua com 9 caracteres, habilita com 10", () => {
    renderDialog()

    const confirmar = screen.getByRole("button", { name: "Concluir tarefa" })
    const textarea = screen.getByRole("textbox")

    expect(confirmar).toBeDisabled()

    fireEvent.change(textarea, { target: { value: "123456789" } })
    expect(confirmar).toBeDisabled()

    fireEvent.change(textarea, { target: { value: "1234567890" } })
    expect(confirmar).not.toBeDisabled()
  })

  it("contador: mostra a quantidade escrita sobre o teto e acompanha a digitação", () => {
    renderDialog()

    expect(screen.getByText("0/500 caracteres")).toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "abc" },
    })

    expect(screen.getByText("3/500 caracteres")).toBeInTheDocument()
  })

  it("confirma: origem prospeccao chama onConfirm uma vez com o resumo aparado e próxima data vazia", async () => {
    const { onConfirm } = renderDialog({ origem: "prospeccao" })

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: `  ${RESUMO_VALIDO}  ` },
    })
    fireEvent.click(screen.getByRole("button", { name: "Concluir tarefa" }))

    await vi.waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
    expect(onConfirm).toHaveBeenCalledWith(RESUMO_VALIDO, null)
  })

  it("confirma: origem visita com cadência chama onConfirm com a data sugerida idêntica, sem alteração", async () => {
    const { onConfirm } = renderDialog({
      origem: "visita",
      frequenciaVisita: "mensal",
      proximaDataSugerida: "2026-03-15",
    })

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: RESUMO_VALIDO },
    })
    fireEvent.click(screen.getByRole("button", { name: "Concluir visita" }))

    await vi.waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
    expect(onConfirm).toHaveBeenCalledWith(RESUMO_VALIDO, "2026-03-15")
  })

  it("erro: quando onConfirm devolve erro, a mensagem aparece e a janela não fecha", async () => {
    const onOpenChange = vi.fn()
    const onConfirm = vi
      .fn()
      .mockResolvedValue({ error: { message: "Falha ao salvar." } })

    render(
      <ConcluirItemDialog
        open
        onOpenChange={onOpenChange}
        origem="prospeccao"
        razaoSocial="Padaria Central"
        itemTitulo="Visitar"
        frequenciaVisita={null}
        proximaDataSugerida={null}
        onConfirm={onConfirm}
      />
    )

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: RESUMO_VALIDO },
    })
    fireEvent.click(screen.getByRole("button", { name: "Concluir tarefa" }))

    expect(await screen.findByText("Falha ao salvar.")).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("limpa: clicar em Cancelar limpa o resumo digitado", () => {
    renderDialog()

    const textarea = screen.getByRole("textbox")
    fireEvent.change(textarea, { target: { value: RESUMO_VALIDO } })
    expect((textarea as HTMLTextAreaElement).value).toBe(RESUMO_VALIDO)

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect((textarea as HTMLTextAreaElement).value).toBe("")
  })
})
