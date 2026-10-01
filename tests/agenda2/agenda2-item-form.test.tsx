// @vitest-environment jsdom
import { format } from "date-fns"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/app/actions/agenda2", () => ({
  criarAgenda2Item: vi.fn(),
  atualizarAgenda2Item: vi.fn(),
}))

import { Agenda2ItemForm } from "@/components/agenda2/Agenda2ItemForm"
import {
  atualizarAgenda2Item,
  criarAgenda2Item,
} from "@/app/actions/agenda2"
import type { Agenda2Item } from "@/lib/agenda2/itens"

const mockedCriar = vi.mocked(criarAgenda2Item)
const mockedAtualizar = vi.mocked(atualizarAgenda2Item)

const GENERIC_ERROR = "Não foi possível salvar. Tente novamente."

/** "hoje" no formato ISO usado pelo payload/schema (AAAA-MM-DD). */
const hoje = format(new Date(), "yyyy-MM-dd")
const hojeDisplay = format(new Date(), "dd/MM")

/**
 * O `data-day` renderizado pelo `components/ui/calendar.tsx`
 * (`CalendarDayButton`) vem de `day.date.toLocaleDateString(locale?.code)`
 * SEM locale explícito — não é "AAAA-MM-DD" como uma leitura literal do
 * `<interfaces>` do plano sugeriria. Confirmado em runtime (probe isolado
 * com `npx vitest run` antes de escrever este arquivo): no ambiente deste
 * projeto isso resolve para o formato local da máquina (ex.: "01/10/2026"),
 * sempre IDÊNTICO a `new Date().toLocaleDateString()` chamado no mesmo
 * processo — por isso o seletor usa essa mesma chamada, nunca um literal
 * fixo, continuando portátil entre máquinas/CI com locales diferentes. O
 * elemento com o atributo já É o botão (não um `role="gridcell"` por fora
 * com um botão dentro).
 */
function seletorDoDia(data: Date): string {
  return `[data-day="${data.toLocaleDateString()}"]`
}

function selecionarDataNoCalendario(gatilhoTexto: string, data: Date) {
  fireEvent.click(screen.getByText(gatilhoTexto))
  const botaoDoDia = document.querySelector(seletorDoDia(data))
  if (!botaoDoDia) {
    throw new Error("Botão do dia não encontrado no calendário aberto.")
  }
  fireEvent.click(botaoDoDia)
}

function buildItem(partial: Partial<Agenda2Item> = {}): Agenda2Item {
  return {
    id: "i1",
    nomeCliente: "Padaria Central",
    bairro: "Vila Nova",
    data: "2026-10-05",
    concluido: true,
    atualizadoEm: new Date().toISOString(),
    responsavel: "vendedor-1",
    responsavelNome: "Vendedor Um",
    ...partial,
  }
}

function renderForm(
  overrides: Partial<ComponentProps<typeof Agenda2ItemForm>> = {}
) {
  const onOpenChange = vi.fn()
  const onSalvo = vi.fn()
  const utils = render(
    <Agenda2ItemForm
      open
      onOpenChange={onOpenChange}
      modo="criar"
      item={null}
      itensExistentes={[]}
      onSalvo={onSalvo}
      {...overrides}
    />
  )
  return { ...utils, onOpenChange, onSalvo }
}

describe("Agenda2ItemForm (AGD2-01/03, D-06/D-07/D-09)", () => {
  beforeEach(() => {
    mockedCriar.mockReset()
    mockedAtualizar.mockReset()
  })

  it("criar-campos: três campos, dica de LGPD, gatilho e botão corretos, nenhum campo de dono", () => {
    renderForm()

    expect(
      screen.getByRole("heading", { name: "Adicionar visita" })
    ).toBeInTheDocument()
    expect(screen.getByText("Nome do cliente")).toBeInTheDocument()
    expect(screen.getByText("Bairro")).toBeInTheDocument()
    expect(screen.getByText("Data")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Use o Nome Fantasia do cliente. Evite nome completo de pessoa e documentos."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Selecionar data")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Adicionar visita" })
    ).toBeInTheDocument()
    expect(screen.queryByText(/respons[áa]vel/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/vendedor/i)).not.toBeInTheDocument()
  })

  it("criar-validacao: envio vazio mostra os três erros e não chama a ação", async () => {
    renderForm()

    fireEvent.click(screen.getByRole("button", { name: "Adicionar visita" }))

    expect(
      await screen.findByText("Informe o nome do cliente.")
    ).toBeInTheDocument()
    expect(screen.getByText("Informe o bairro.")).toBeInTheDocument()
    expect(screen.getByText("Informe a data.")).toBeInTheDocument()
    expect(mockedCriar).not.toHaveBeenCalled()
  })

  it("criar-documento: número de documento no nome mostra o aviso do schema e não chama a ação", async () => {
    renderForm()

    fireEvent.change(screen.getByLabelText("Nome do cliente"), {
      target: { value: "Cliente 123.456.789-09" },
    })
    fireEvent.change(screen.getByLabelText("Bairro"), {
      target: { value: "Centro" },
    })
    selecionarDataNoCalendario("Selecionar data", new Date())
    fireEvent.click(screen.getByRole("button", { name: "Adicionar visita" }))

    expect(
      await screen.findByText(
        "Use só o nome do cliente, sem números de documento ou telefone."
      )
    ).toBeInTheDocument()
    expect(mockedCriar).not.toHaveBeenCalled()
  })

  it("criar-ok (AGD2-01): preenchimento válido chama criarAgenda2Item com exatamente os 3 campos, depois onSalvo e fecha", async () => {
    mockedCriar.mockResolvedValueOnce({ data: true })
    const { onSalvo, onOpenChange } = renderForm()

    fireEvent.change(screen.getByLabelText("Nome do cliente"), {
      target: { value: "Mercado Bom Preço" },
    })
    fireEvent.change(screen.getByLabelText("Bairro"), {
      target: { value: "Centro" },
    })
    selecionarDataNoCalendario("Selecionar data", new Date())
    fireEvent.click(screen.getByRole("button", { name: "Adicionar visita" }))

    await vi.waitFor(() => {
      expect(mockedCriar).toHaveBeenCalledTimes(1)
    })
    expect(mockedCriar).toHaveBeenCalledWith({
      nomeCliente: "Mercado Bom Preço",
      bairro: "Centro",
      data: hoje,
    })
    await vi.waitFor(() => {
      expect(onSalvo).toHaveBeenCalledTimes(1)
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("duplicado-avisa (D-07): item parecido não envia de primeira, mostra aviso não-bloqueante, e envia na segunda tentativa", async () => {
    mockedCriar.mockResolvedValueOnce({ data: true })
    const itensExistentes: Agenda2Item[] = [
      buildItem({ id: "existing", nomeCliente: "Mercado Bom Preço", data: hoje, concluido: false }),
    ]
    renderForm({ itensExistentes })

    fireEvent.change(screen.getByLabelText("Nome do cliente"), {
      target: { value: "  mercado bom preço" },
    })
    fireEvent.change(screen.getByLabelText("Bairro"), {
      target: { value: "Centro" },
    })
    selecionarDataNoCalendario("Selecionar data", new Date())
    fireEvent.click(screen.getByRole("button", { name: "Adicionar visita" }))

    const aviso = await screen.findByRole("status")
    expect(aviso).toHaveTextContent(
      `Já existe um item parecido para ${hojeDisplay}. Confirme se quer criar mesmo assim.`
    )
    expect(mockedCriar).not.toHaveBeenCalled()

    const botaoConfirmar = screen.getByRole("button", {
      name: "Criar mesmo assim",
    })
    fireEvent.click(botaoConfirmar)

    await vi.waitFor(() => {
      expect(mockedCriar).toHaveBeenCalledTimes(1)
    })
  })

  it("duplicado-limpa-ao-editar: alterar um campo depois do aviso o esconde e devolve o rótulo original do botão", async () => {
    const itensExistentes: Agenda2Item[] = [
      buildItem({ id: "existing", nomeCliente: "Mercado Bom Preço", data: hoje, concluido: false }),
    ]
    renderForm({ itensExistentes })

    fireEvent.change(screen.getByLabelText("Nome do cliente"), {
      target: { value: "Mercado Bom Preço" },
    })
    fireEvent.change(screen.getByLabelText("Bairro"), {
      target: { value: "Centro" },
    })
    selecionarDataNoCalendario("Selecionar data", new Date())
    fireEvent.click(screen.getByRole("button", { name: "Adicionar visita" }))

    await screen.findByRole("status")
    expect(
      screen.getByRole("button", { name: "Criar mesmo assim" })
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Bairro"), {
      target: { value: "Outro bairro" },
    })

    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Adicionar visita" })
    ).toBeInTheDocument()
  })

  it("editar-prefill (AGD2-03/D-06): abre pré-preenchido mesmo para item concluído e envia a edição", async () => {
    mockedAtualizar.mockResolvedValueOnce({ data: true })
    const item = buildItem({
      id: "i1",
      nomeCliente: "Padaria Central",
      bairro: "Vila Nova",
      data: "2026-10-05",
      concluido: true,
    })
    renderForm({ modo: "editar", item, itensExistentes: [] })

    expect(
      screen.getByRole("heading", { name: "Editar item" })
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Nome do cliente")).toHaveValue(
      "Padaria Central"
    )
    expect(screen.getByLabelText("Bairro")).toHaveValue("Vila Nova")
    expect(screen.getByText("05/10/2026")).toBeInTheDocument()

    const botaoSalvar = screen.getByRole("button", {
      name: "Salvar alterações",
    })
    fireEvent.click(botaoSalvar)

    await vi.waitFor(() => {
      expect(mockedAtualizar).toHaveBeenCalledTimes(1)
    })
    expect(mockedAtualizar).toHaveBeenCalledWith("i1", {
      nomeCliente: "Padaria Central",
      bairro: "Vila Nova",
      data: "2026-10-05",
    })
  })

  it("editar-ignora-o-proprio: editar sem mudar nada, com o próprio item na lista existente, envia de primeira", async () => {
    mockedAtualizar.mockResolvedValueOnce({ data: true })
    const item = buildItem({
      id: "i1",
      nomeCliente: "Padaria Central",
      bairro: "Vila Nova",
      data: "2026-10-05",
      concluido: false,
    })
    renderForm({ modo: "editar", item, itensExistentes: [item] })

    fireEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" })
    )

    await vi.waitFor(() => {
      expect(mockedAtualizar).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("data-passada (D-09): calendário não bloqueia data passada já salva, envio mantém a data", async () => {
    mockedAtualizar.mockResolvedValueOnce({ data: true })
    const item = buildItem({
      id: "i2",
      nomeCliente: "Cliente Antigo",
      bairro: "Centro Velho",
      data: "2025-01-10",
      concluido: false,
    })
    renderForm({ modo: "editar", item, itensExistentes: [] })

    fireEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" })
    )

    await vi.waitFor(() => {
      expect(mockedAtualizar).toHaveBeenCalledTimes(1)
    })
    expect(mockedAtualizar).toHaveBeenCalledWith(
      "i2",
      expect.objectContaining({ data: "2025-01-10" })
    )
  })

  it("falha: erro da ação mostra mensagem genérica, não chama onSalvo e mantém a janela aberta", async () => {
    mockedCriar.mockResolvedValueOnce({
      error: { code: "salvar_falhou", message: "x" },
    })
    const { onSalvo, onOpenChange } = renderForm()

    fireEvent.change(screen.getByLabelText("Nome do cliente"), {
      target: { value: "Mercado Bom Preço" },
    })
    fireEvent.change(screen.getByLabelText("Bairro"), {
      target: { value: "Centro" },
    })
    selecionarDataNoCalendario("Selecionar data", new Date())
    fireEvent.click(screen.getByRole("button", { name: "Adicionar visita" }))

    const alerta = await screen.findByRole("alert")
    expect(alerta).toHaveTextContent(GENERIC_ERROR)
    expect(onSalvo).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("enviando: botão fica desabilitado com 'Salvando...' enquanto a ação não resolve", async () => {
    let resolver: (value: { data: true }) => void = () => {}
    mockedCriar.mockReturnValueOnce(
      new Promise((resolve) => {
        resolver = resolve
      })
    )
    renderForm()

    fireEvent.change(screen.getByLabelText("Nome do cliente"), {
      target: { value: "Mercado Bom Preço" },
    })
    fireEvent.change(screen.getByLabelText("Bairro"), {
      target: { value: "Centro" },
    })
    selecionarDataNoCalendario("Selecionar data", new Date())
    fireEvent.click(screen.getByRole("button", { name: "Adicionar visita" }))

    const botaoSalvando = await screen.findByRole("button", {
      name: "Salvando...",
    })
    expect(botaoSalvando).toBeDisabled()

    resolver({ data: true })
  })
})
