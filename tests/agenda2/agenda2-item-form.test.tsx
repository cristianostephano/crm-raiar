// @vitest-environment jsdom
import { format } from "date-fns"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

  it("criar-ok (AGD2-01): preenchimento válido chama criarAgenda2Item com os 3 campos e repetirSemanas 0 (Não repetir por padrão), depois onSalvo e fecha", async () => {
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
      repetirSemanas: 0,
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

/**
 * Fase 32 (AGD2-02) — campo "Repetir". Relógio falso SÓ para Date: 12:00 de
 * 07/10/2026 em São Paulo. O calendário abre em outubro/2026 e "hoje" para a
 * regra D-23 é 2026-10-07.
 */
const HOJE_FIXO = new Date(2026, 9, 7)
const PASSADO_FIXO = new Date(2026, 9, 5)
const ROTULO_4 = "Por 4 semanas (4 visitas, incluindo esta)"
const ROTULO_8 = "Por 8 semanas (8 visitas, incluindo esta)"
const ROTULO_12 = "Por 12 semanas (12 visitas, incluindo esta)"

/** Mesmo precedente do Select da Agenda2List: clicar no combobox, depois
 * pointerDown + click na opção. */
async function escolherRepeticao(rotulo: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Repetir" }))
  const opcao = await screen.findByRole("option", { name: rotulo })
  fireEvent.pointerDown(opcao)
  fireEvent.click(opcao)
}

function preencherNomeEBairro(
  nome = "Mercado Bom Preço",
  bairro = "Centro"
) {
  fireEvent.change(screen.getByLabelText("Nome do cliente"), {
    target: { value: nome },
  })
  fireEvent.change(screen.getByLabelText("Bairro"), {
    target: { value: bairro },
  })
}

describe("Agenda2ItemForm — campo Repetir (AGD2-02, D-23/D-24/D-25/D-31)", () => {
  beforeEach(() => {
    mockedCriar.mockReset()
    mockedAtualizar.mockReset()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-07T15:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("repetir-so-ao-criar (D-24): criar mostra o campo com 'Não repetir'; editar não tem o texto 'Repetir'", () => {
    const { unmount } = renderForm()

    expect(screen.getByText("Repetir")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Repetir" })).toHaveTextContent(
      "Não repetir"
    )
    unmount()

    renderForm({ modo: "editar", item: buildItem(), itensExistentes: [] })
    expect(screen.queryByText(/Repetir/)).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })

  it("repetir-desabilitado-sem-data (D-23): sem data o combobox fica desabilitado e explica", () => {
    renderForm()

    expect(screen.getByRole("combobox", { name: "Repetir" })).toBeDisabled()
    expect(screen.getByText("Escolha a data primeiro.")).toBeInTheDocument()
  })

  it("opcoes-com-total (D-31): as opções dizem o total de visitas", async () => {
    renderForm()
    selecionarDataNoCalendario("Selecionar data", HOJE_FIXO)

    fireEvent.click(screen.getByRole("combobox", { name: "Repetir" }))

    expect(
      await screen.findByRole("option", { name: "Não repetir" })
    ).toBeInTheDocument()
    expect(screen.getByRole("option", { name: ROTULO_4 })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: ROTULO_8 })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: ROTULO_12 })).toBeInTheDocument()
  })

  it("repetir-envia-4 (AGD2-02/D-31): 4 semanas envia repetirSemanas 4 com a data de hoje", async () => {
    mockedCriar.mockResolvedValueOnce({ data: true })
    renderForm()

    preencherNomeEBairro()
    selecionarDataNoCalendario("Selecionar data", HOJE_FIXO)
    await escolherRepeticao(ROTULO_4)
    fireEvent.click(screen.getByRole("button", { name: "Adicionar visita" }))

    await vi.waitFor(() => {
      expect(mockedCriar).toHaveBeenCalledTimes(1)
    })
    expect(mockedCriar).toHaveBeenCalledWith({
      nomeCliente: "Mercado Bom Preço",
      bairro: "Centro",
      data: "2026-10-07",
      repetirSemanas: 4,
    })
  })

  it("repetir-zera-no-passado (D-23): trocar para data passada volta a 'Não repetir', desabilita e explica; envia 0", async () => {
    mockedCriar.mockResolvedValueOnce({ data: true })
    renderForm()

    preencherNomeEBairro()
    selecionarDataNoCalendario("Selecionar data", HOJE_FIXO)
    await escolherRepeticao(ROTULO_8)
    expect(screen.getByRole("combobox", { name: "Repetir" })).toHaveTextContent(
      ROTULO_8
    )

    selecionarDataNoCalendario("07/10/2026", PASSADO_FIXO)

    const combo = screen.getByRole("combobox", { name: "Repetir" })
    expect(combo).toHaveTextContent("Não repetir")
    expect(combo).toBeDisabled()
    expect(
      screen.getByText("A repetição só vale para hoje ou datas futuras.")
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Adicionar visita" }))
    await vi.waitFor(() => {
      expect(mockedCriar).toHaveBeenCalledTimes(1)
    })
    expect(mockedCriar).toHaveBeenCalledWith({
      nomeCliente: "Mercado Bom Preço",
      bairro: "Centro",
      data: "2026-10-05",
      repetirSemanas: 0,
    })
  })

  it("editar-nunca-repete (D-24): editar envia exatamente nome, bairro e data e nunca cria", async () => {
    mockedAtualizar.mockResolvedValueOnce({ data: true })
    const item = buildItem({ concluido: true })
    renderForm({ modo: "editar", item, itensExistentes: [] })

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))

    await vi.waitFor(() => {
      expect(mockedAtualizar).toHaveBeenCalledTimes(1)
    })
    expect(mockedAtualizar).toHaveBeenCalledWith("i1", {
      nomeCliente: "Padaria Central",
      bairro: "Vila Nova",
      data: "2026-10-05",
    })
    expect(Object.keys(mockedAtualizar.mock.calls[0][1])).toEqual([
      "nomeCliente",
      "bairro",
      "data",
    ])
    expect(mockedCriar).not.toHaveBeenCalled()
  })
})
