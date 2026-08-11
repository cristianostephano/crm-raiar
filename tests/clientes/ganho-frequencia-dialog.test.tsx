// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { GanhoFrequenciaDialog } from "@/components/clientes/GanhoFrequenciaDialog"
import { FREQUENCIA_VISITA_ITEMS } from "@/lib/funil/frequencia"

function renderDialog(overrides: Partial<Parameters<typeof GanhoFrequenciaDialog>[0]> = {}) {
  const onOpenChange = vi.fn()
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  render(
    <GanhoFrequenciaDialog
      open
      onOpenChange={onOpenChange}
      razaoSocial="Padaria Central"
      cnpjAtual=""
      exigirCnpj
      onConfirm={onConfirm}
      {...overrides}
    />
  )
  return { onOpenChange, onConfirm }
}

describe("GanhoFrequenciaDialog (VIS-01, 260807-13-02)", () => {
  it("copy: mostra título, label e texto de apoio do Copywriting Contract", () => {
    renderDialog()

    expect(
      screen.getByText("Marcar Padaria Central como ganho?")
    ).toBeInTheDocument()
    expect(screen.getByText("Frequência de visita")).toBeInTheDocument()
    expect(
      screen.getByText("Escolha a frequência de visita para este cliente.")
    ).toBeInTheDocument()
  })

  it("desabilitado: com nada escolhido, Confirmar ganho está desabilitado e Cancelar não está", () => {
    renderDialog()

    const confirmar = screen.getByRole("button", { name: "Confirmar ganho" })
    const cancelar = screen.getByRole("button", { name: "Cancelar" })

    expect(confirmar).toBeDisabled()
    expect(cancelar).not.toBeDisabled()
  })

  it("variante: o botão Confirmar ganho não usa a variante destrutiva", () => {
    renderDialog()

    // The base Button class always carries "destructive" tokens for the
    // aria-invalid state regardless of variant — the actual variant marker
    // is the "bg-destructive" background class, present only when
    // variant="destructive" is passed.
    const confirmar = screen.getByRole("button", { name: "Confirmar ganho" })
    expect(confirmar.className).not.toContain("bg-destructive")
  })

  it("cancelar: clicar em Cancelar chama onOpenChange(false) e nunca onConfirm", () => {
    const { onOpenChange, onConfirm } = renderDialog()

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("vocabulario: FREQUENCIA_VISITA_ITEMS tem os quatro itens na ordem travada", () => {
    expect(FREQUENCIA_VISITA_ITEMS.map((item) => item.label)).toEqual([
      "Semanal",
      "Quinzenal",
      "Mensal",
      "Nenhuma",
    ])
    expect(FREQUENCIA_VISITA_ITEMS.map((item) => item.value)).toEqual([
      "semanal",
      "quinzenal",
      "mensal",
      "nenhuma",
    ])
  })

  it("cnpjvazio: com CNPJ vazio e exigirCnpj, Confirmar ganho está desabilitado e mostra o texto de apoio do CNPJ", () => {
    renderDialog({ exigirCnpj: true, cnpjAtual: "" })

    const confirmar = screen.getByRole("button", { name: "Confirmar ganho" })
    expect(confirmar).toBeDisabled()
    expect(
      screen.getByText("Informe o CNPJ para concluir o ganho deste cliente.")
    ).toBeInTheDocument()
  })

  it("cnpjpreenchido: com cnpjAtual não-vazio, o campo já renderiza preenchido e o texto de apoio não aparece", () => {
    renderDialog({ exigirCnpj: true, cnpjAtual: "12.345.678/0001-90" })

    const cnpjInput = screen.getByLabelText("CNPJ") as HTMLInputElement
    expect(cnpjInput.value).toBe("12.345.678/0001-90")
    expect(
      screen.queryByText("Informe o CNPJ para concluir o ganho deste cliente.")
    ).not.toBeInTheDocument()
  })

  it("cnpjdispensado: com exigirCnpj falso e CNPJ vazio, a tela não cobra CNPJ de quem já é ganho", async () => {
    const { onConfirm } = renderDialog({ exigirCnpj: false, cnpjAtual: "" })

    const select = screen.getByRole("combobox", { name: "Frequência de visita" })
    fireEvent.click(select)
    fireEvent.click(await screen.findByRole("option", { name: "Semanal" }))

    const confirmar = screen.getByRole("button", { name: "Confirmar ganho" })
    expect(confirmar).not.toBeDisabled()

    fireEvent.click(confirmar)

    expect(onConfirm).toHaveBeenCalledWith("semanal", "")
  })

  it("cnpjrepassa: confirmar com CNPJ digitado com espaços nas pontas chama onConfirm com o CNPJ aparado", async () => {
    const { onConfirm } = renderDialog({ exigirCnpj: true, cnpjAtual: "" })

    const select = screen.getByRole("combobox", { name: "Frequência de visita" })
    fireEvent.click(select)
    fireEvent.click(await screen.findByRole("option", { name: "Semanal" }))

    const cnpjInput = screen.getByLabelText("CNPJ")
    fireEvent.change(cnpjInput, { target: { value: "  12.345.678/0001-90  " } })

    const confirmar = screen.getByRole("button", { name: "Confirmar ganho" })
    expect(confirmar).not.toBeDisabled()

    fireEvent.click(confirmar)

    expect(onConfirm).toHaveBeenCalledWith("semanal", "12.345.678/0001-90")
  })

  it("cnpjformato (Out of Scope, decisão travada): um CNPJ obviamente inválido habilita o botão e é aceito normalmente — nenhuma validação de formato existe no frontend", async () => {
    const { onConfirm } = renderDialog({ exigirCnpj: true, cnpjAtual: "" })

    const select = screen.getByRole("combobox", { name: "Frequência de visita" })
    fireEvent.click(select)
    fireEvent.click(await screen.findByRole("option", { name: "Semanal" }))

    const cnpjInput = screen.getByLabelText("CNPJ")
    fireEvent.change(cnpjInput, { target: { value: "123" } })

    const confirmar = screen.getByRole("button", { name: "Confirmar ganho" })
    expect(confirmar).not.toBeDisabled()

    fireEvent.click(confirmar)

    expect(onConfirm).toHaveBeenCalledWith("semanal", "123")
  })
})
