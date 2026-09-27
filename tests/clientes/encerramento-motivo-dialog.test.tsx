// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/app/actions/encerrados", () => ({
  getMotivosEncerramento: vi.fn(),
}))

import { getMotivosEncerramento } from "@/app/actions/encerrados"
import { EncerramentoMotivoDialog } from "@/components/clientes/EncerramentoMotivoDialog"

const mockedGetMotivosEncerramento = vi.mocked(getMotivosEncerramento)

const MOTIVOS = [
  { id: "m1", nome: "Fechou o estabelecimento" },
  { id: "m2", nome: "Trocou de fornecedor" },
]

function renderDialog(
  overrides: Partial<Parameters<typeof EncerramentoMotivoDialog>[0]> = {}
) {
  const onOpenChange = vi.fn()
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  render(
    <EncerramentoMotivoDialog
      open
      onOpenChange={onOpenChange}
      nomeCliente="Padaria Central Ltda"
      onConfirm={onConfirm}
      {...overrides}
    />
  )
  return { onOpenChange, onConfirm }
}

describe("EncerramentoMotivoDialog (Fase 29, ENCR-02, D-05)", () => {
  beforeEach(() => {
    mockedGetMotivosEncerramento.mockReset()
    mockedGetMotivosEncerramento.mockResolvedValue({ data: MOTIVOS })
  })

  it("titulo: aberto com nomeCliente 'Padaria Central Ltda', o título é 'Marcar Padaria Central Ltda como encerrado?'", async () => {
    renderDialog()

    expect(
      await screen.findByText("Marcar Padaria Central Ltda como encerrado?")
    ).toBeInTheDocument()
  })

  it("carrega-motivos: ao abrir, getMotivosEncerramento é chamada uma vez e os motivos devolvidos aparecem no Select 'Motivo do encerramento'", async () => {
    renderDialog()

    expect(await screen.findByText("Motivo do encerramento")).toBeInTheDocument()
    expect(mockedGetMotivosEncerramento).toHaveBeenCalledTimes(1)

    const select = await screen.findByRole("combobox")
    fireEvent.click(select)

    expect(
      await screen.findByRole("option", { name: "Fechou o estabelecimento" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Trocou de fornecedor" })
    ).toBeInTheDocument()
  })

  it("botao-desabilitado: sem motivo escolhido, o botão 'Confirmar encerramento' está desabilitado e o texto de apoio aparece", async () => {
    renderDialog()

    await screen.findByText("Motivo do encerramento")

    const confirmar = screen.getByRole("button", { name: "Confirmar encerramento" })
    expect(confirmar).toBeDisabled()
    expect(
      screen.getByText("Selecione o motivo do encerramento antes de salvar.")
    ).toBeInTheDocument()
  })

  it("confirma: escolher o primeiro motivo e clicar 'Confirmar encerramento' chama onConfirm uma vez com o id desse motivo; com sucesso o diálogo pede para fechar", async () => {
    const { onOpenChange, onConfirm } = renderDialog()

    const select = await screen.findByRole("combobox")
    fireEvent.click(select)
    fireEvent.click(
      await screen.findByRole("option", { name: "Fechou o estabelecimento" })
    )

    const confirmar = screen.getByRole("button", { name: "Confirmar encerramento" })
    expect(confirmar).not.toBeDisabled()

    fireEvent.click(confirmar)

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith("m1")

    await vi.waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("erro-carga: getMotivosEncerramento devolvendo erro mostra 'Não foi possível carregar os motivos de encerramento.'", async () => {
    mockedGetMotivosEncerramento.mockReset()
    mockedGetMotivosEncerramento.mockResolvedValue({
      error: { code: "unauthenticated" },
    })

    renderDialog()

    expect(
      await screen.findByText(
        "Não foi possível carregar os motivos de encerramento."
      )
    ).toBeInTheDocument()
  })

  it("erro-submit: onConfirm devolvendo { error: { message } } mostra a mensagem num alerta e NÃO fecha o diálogo", async () => {
    const onConfirm = vi
      .fn()
      .mockResolvedValue({ error: { message: "Falhou X" } })
    const onOpenChange = vi.fn()

    renderDialog({ onConfirm, onOpenChange })

    const select = await screen.findByRole("combobox")
    fireEvent.click(select)
    fireEvent.click(
      await screen.findByRole("option", { name: "Fechou o estabelecimento" })
    )

    fireEvent.click(screen.getByRole("button", { name: "Confirmar encerramento" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Falhou X")
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
