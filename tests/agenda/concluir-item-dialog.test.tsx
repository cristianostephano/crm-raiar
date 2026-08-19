// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { ConcluirItemDialog } from "@/components/agenda/ConcluirItemDialog"

const RESUMO_VALIDO = "Cliente confirmou pedido para a próxima semana."

const MOTIVOS_PADRAO = [
  { id: "motivo-1", nome: "Pedido pelo WhatsApp" },
  { id: "motivo-2", nome: "Ligação telefônica" },
]

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
      motivoOptions={MOTIVOS_PADRAO}
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
    expect(onConfirm).toHaveBeenCalledWith(RESUMO_VALIDO, null, null)
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
    expect(onConfirm).toHaveBeenCalledWith(RESUMO_VALIDO, "2026-03-15", null)
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
        motivoOptions={MOTIVOS_PADRAO}
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

  // Fase 22 (CONC-02/CONC-04) — marcação "Não foi presencial" e motivo,
  // válidos para as DUAS origens (D-01).

  it("presencial: sem tocar na marcação, confirmar chama onConfirm com vazio no terceiro argumento, e nenhum campo de motivo aparece", async () => {
    const { onConfirm } = renderDialog()

    expect(screen.queryByText("Motivo")).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: RESUMO_VALIDO },
    })
    fireEvent.click(screen.getByRole("button", { name: "Concluir tarefa" }))

    await vi.waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
    expect(onConfirm).toHaveBeenCalledWith(RESUMO_VALIDO, null, null)
  })

  it("remoto: marcar 'Não foi presencial' faz o campo de motivo aparecer; sem motivo escolhido o botão continua indisponível; escolhido, confirmar entrega o identificador no terceiro argumento", async () => {
    const { onConfirm } = renderDialog()

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: RESUMO_VALIDO },
    })

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Não foi presencial" })
    )

    const motivoSelect = await screen.findByRole("combobox", {
      name: "Motivo",
    })
    const confirmar = screen.getByRole("button", { name: "Concluir tarefa" })
    expect(confirmar).toBeDisabled()

    fireEvent.click(motivoSelect)
    const opcao = await screen.findByRole("option", {
      name: "Ligação telefônica",
    })
    // Base UI's SelectItem só comete um "click" comum quando precedido de um
    // pointerdown no mesmo elemento (mesma ressalva já documentada em
    // tests/agenda/agenda-calendario-integracao.test.tsx).
    fireEvent.pointerDown(opcao)
    fireEvent.click(opcao)

    expect(confirmar).not.toBeDisabled()

    fireEvent.click(confirmar)

    await vi.waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
    expect(onConfirm).toHaveBeenCalledWith(RESUMO_VALIDO, null, "motivo-2")
  })

  it("desmarcar: marcar, escolher um motivo e desmarcar limpa a escolha — confirmar entrega vazio no terceiro argumento", async () => {
    const { onConfirm } = renderDialog()

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: RESUMO_VALIDO },
    })

    const checkbox = screen.getByRole("checkbox", {
      name: "Não foi presencial",
    })
    fireEvent.click(checkbox)

    fireEvent.click(await screen.findByRole("combobox", { name: "Motivo" }))
    const opcao = await screen.findByRole("option", {
      name: "Pedido pelo WhatsApp",
    })
    fireEvent.pointerDown(opcao)
    fireEvent.click(opcao)

    fireEvent.click(checkbox)
    expect(
      screen.queryByRole("combobox", { name: "Motivo" })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Concluir tarefa" }))

    await vi.waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
    expect(onConfirm).toHaveBeenCalledWith(RESUMO_VALIDO, null, null)
  })

  it("proximavisita: origem visita com cadência e marcação ligada — a seção de próxima visita continua presente, e confirmar entrega data e motivo juntos", async () => {
    const { onConfirm } = renderDialog({
      origem: "visita",
      frequenciaVisita: "mensal",
      proximaDataSugerida: "2026-03-15",
    })

    expect(screen.getByText("Próxima visita sugerida")).toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: RESUMO_VALIDO },
    })

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Não foi presencial" })
    )
    fireEvent.click(await screen.findByRole("combobox", { name: "Motivo" }))
    const opcao = await screen.findByRole("option", {
      name: "Pedido pelo WhatsApp",
    })
    fireEvent.pointerDown(opcao)
    fireEvent.click(opcao)

    expect(screen.getByText("Próxima visita sugerida")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Concluir visita" }))

    await vi.waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })
    expect(onConfirm).toHaveBeenCalledWith(
      RESUMO_VALIDO,
      "2026-03-15",
      "motivo-1"
    )
  })

  it("semlista: marcação ligada com catálogo vazio mostra a mensagem de nenhum motivo cadastrado e mantém o botão indisponível", async () => {
    renderDialog({ motivoOptions: [] })

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: RESUMO_VALIDO },
    })

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Não foi presencial" })
    )

    expect(
      await screen.findByText(
        "Ainda não há motivos cadastrados. Peça ao supervisor para cadastrá-los em Configurações."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", { name: "Motivo" })
    ).not.toBeInTheDocument()

    expect(
      screen.getByRole("button", { name: "Concluir tarefa" })
    ).toBeDisabled()
  })
})
