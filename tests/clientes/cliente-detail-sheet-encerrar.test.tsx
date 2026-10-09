// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/app/actions/clientes", () => ({
  getClienteDetalhe: vi.fn(),
  getFrequenciasPedido: vi.fn().mockResolvedValue({ data: [] }),
  updateCliente: vi.fn(),
  deleteCliente: vi.fn(),
  atualizarFrequenciaVisita: vi.fn(),
}))

vi.mock("@/app/actions/funil", () => ({
  getHistoricoAction: vi.fn().mockResolvedValue({ data: [] }),
  getDiarioAction: vi.fn().mockResolvedValue({ data: [] }),
  getMotivosPerda: vi.fn().mockResolvedValue({ data: [] }),
  marcarStatus: vi.fn(),
}))

vi.mock("@/app/actions/tarefas", () => ({
  getTarefasAction: vi.fn().mockResolvedValue({ data: [] }),
  getTiposTarefa: vi.fn().mockResolvedValue({ data: [] }),
  adicionarTarefa: vi.fn(),
  atualizarDataTarefa: vi.fn(),
  removerTarefa: vi.fn(),
  toggleTarefa: vi.fn(),
}))

vi.mock("@/app/actions/encerrados", () => ({
  getMotivosEncerramento: vi
    .fn()
    .mockResolvedValue({ data: [{ id: "m1", nome: "Fechou o estabelecimento" }] }),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }),
}))

import { getClienteDetalhe } from "@/app/actions/clientes"
import { marcarStatus } from "@/app/actions/funil"
import { ClienteDetailSheet } from "@/components/clientes/ClienteDetailSheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ClienteDetalhe, StatusAcompanhamento } from "@/lib/supabase/queries/clientes"

const mockedGetClienteDetalhe = vi.mocked(getClienteDetalhe)
const mockedMarcarStatus = vi.mocked(marcarStatus)

function buildCliente(
  overrides: Partial<ClienteDetalhe> = {}
): ClienteDetalhe {
  return {
    id: "c1",
    razaoSocial: "Padaria Central Ltda",
    cep: "",
    rua: "",
    numero: "",
    complemento: "",
    cidade: "",
    estado: "",
    responsavel: "vendedor-1",
    responsavelNome: "Vendedor Um",
    categoriaId: null,
    contato: "",
    telefone: "",
    email: "",
    numeroDeLojas: null,
    produtoIds: [],
    etapa: "primeira_venda",
    statusAcompanhamento: "ganho",
    motivoPerdaId: null,
    observacao: "",
    frequenciaVisita: "mensal",
    diaSemanaVisita: null,
    semanaDoMesVisita: null,
    nomeFantasia: "",
    cnpj: "12.345.678/0001-90",
    frequenciaPedidos: "",
    // Quick 261008-rxw: ClienteDetalhe ganhou ganhoEm
    ganhoEm: null,
    ...overrides,
  }
}

function renderSheet(
  cliente: ClienteDetalhe,
  overrides: { onStatusChanged?: (status: StatusAcompanhamento) => void } = {}
) {
  mockedGetClienteDetalhe.mockResolvedValue({ data: cliente })
  const onStatusChanged = overrides.onStatusChanged ?? vi.fn()

  render(
    <TooltipProvider>
      <ClienteDetailSheet
        clienteId="c1"
        open
        onOpenChange={vi.fn()}
        isSupervisor={false}
        categoriaOptions={[]}
        produtoOptions={[]}
        vendedorOptions={[]}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
        onStatusChanged={onStatusChanged}
      />
    </TooltipProvider>
  )

  return { onStatusChanged }
}

async function abrirComboboxStatus() {
  const select = await screen.findByRole("combobox", { name: "Status" })
  fireEvent.click(select)
  return select
}

describe("ClienteDetailSheet — opção Encerrado (Fase 29, D-01/D-04/D-05/D-06)", () => {
  beforeEach(() => {
    mockedGetClienteDetalhe.mockReset()
    mockedMarcarStatus.mockReset()
  })

  it("opcao-presente-habilitada: com a ficha de um cliente ganho aberta, o combobox de Status mostra Em andamento/Perdido/Ganho/Encerrado, e Encerrado não está desabilitada", async () => {
    renderSheet(buildCliente({ statusAcompanhamento: "ganho" }))

    await abrirComboboxStatus()

    const opcaoEncerrado = await screen.findByRole("option", { name: /Encerrado/ })
    expect(screen.getByRole("option", { name: "Em andamento" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Perdido" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /^Ganho$/ })).toBeInTheDocument()
    expect(opcaoEncerrado).not.toHaveAttribute("aria-disabled", "true")
  })

  it("opcao-desabilitada-fora-de-ganho: com um cliente em_andamento, Encerrado está desabilitada e existe o gatilho de tooltip", async () => {
    renderSheet(buildCliente({ statusAcompanhamento: "em_andamento", etapa: "aguardando_contato" }))

    await abrirComboboxStatus()

    const opcaoEncerrado = await screen.findByRole("option", { name: /Encerrado/ })
    expect(opcaoEncerrado).toHaveAttribute("aria-disabled", "true")
    expect(
      screen.getByLabelText('Disponível somente quando o cliente já está "Ganho".')
    ).toBeInTheDocument()
  })

  it("abre-dialogo: com cliente ganho, escolher Encerrado abre o diálogo 'Marcar Padaria Central Ltda como encerrado?'", async () => {
    renderSheet(buildCliente({ statusAcompanhamento: "ganho" }))

    await abrirComboboxStatus()
    const opcaoEncerrado = await screen.findByRole("option", { name: /Encerrado/ })
    fireEvent.pointerDown(opcaoEncerrado)
    fireEvent.click(opcaoEncerrado)

    expect(
      await screen.findByText("Marcar Padaria Central Ltda como encerrado?")
    ).toBeInTheDocument()
  })

  it("confirma-encerramento: escolhendo o primeiro motivo e confirmando, marcarStatus é chamada com os argumentos esperados e onStatusChanged é chamada com 'encerrado'", async () => {
    mockedMarcarStatus.mockResolvedValue({ data: true })
    const { onStatusChanged } = renderSheet(
      buildCliente({ statusAcompanhamento: "ganho" })
    )

    await abrirComboboxStatus()
    const opcaoEncerrado = await screen.findByRole("option", { name: /Encerrado/ })
    fireEvent.pointerDown(opcaoEncerrado)
    fireEvent.click(opcaoEncerrado)

    await screen.findByText("Marcar Padaria Central Ltda como encerrado?")

    // O Select de motivo do diálogo é identificado pelo placeholder do seu
    // trigger (nome acessível vazio, mesma convenção do PerdaMotivoDialog).
    const motivoTrigger = await screen.findByText("Selecione o motivo")
    fireEvent.click(motivoTrigger)
    fireEvent.click(
      await screen.findByRole("option", { name: "Fechou o estabelecimento" })
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar encerramento" })
    )

    await vi.waitFor(() => {
      expect(mockedMarcarStatus).toHaveBeenCalledWith(
        "c1",
        "encerrado",
        undefined,
        undefined,
        undefined,
        "m1"
      )
    })

    await vi.waitFor(() => {
      expect(onStatusChanged).toHaveBeenCalledWith("encerrado")
    })
  })

  it("erro-mantem-dialogo: marcarStatus devolvendo erro mostra a mensagem e o diálogo continua aberto; onStatusChanged não é chamada", async () => {
    mockedMarcarStatus.mockResolvedValue({
      error: { code: "encerramento_travado", message: "Mensagem X" },
    })
    const { onStatusChanged } = renderSheet(
      buildCliente({ statusAcompanhamento: "ganho" })
    )

    await abrirComboboxStatus()
    const opcaoEncerrado = await screen.findByRole("option", { name: /Encerrado/ })
    fireEvent.pointerDown(opcaoEncerrado)
    fireEvent.click(opcaoEncerrado)

    await screen.findByText("Marcar Padaria Central Ltda como encerrado?")

    const motivoTrigger = screen.getByText("Selecione o motivo")
    fireEvent.click(motivoTrigger)
    fireEvent.click(
      await screen.findByRole("option", { name: "Fechou o estabelecimento" })
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar encerramento" })
    )

    expect(await screen.findByRole("alert")).toHaveTextContent("Mensagem X")
    expect(
      screen.getByText("Marcar Padaria Central Ltda como encerrado?")
    ).toBeInTheDocument()
    expect(onStatusChanged).not.toHaveBeenCalled()
  })
})
