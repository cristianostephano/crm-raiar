// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
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
  getMotivosEncerramento: vi.fn().mockResolvedValue({ data: [] }),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }),
}))

import { getClienteDetalhe, updateCliente } from "@/app/actions/clientes"
import { marcarStatus } from "@/app/actions/funil"
import { ClienteDetailSheet } from "@/components/clientes/ClienteDetailSheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import { hojeEmSaoPaulo } from "@/lib/clientes/dataDoGanho"
import type { ClienteDetalhe } from "@/lib/supabase/queries/clientes"

/**
 * Quick 261008-rxw (D-17, P-14, P-15, P-18): campo "Data do ganho" na ficha.
 * So aparece para cliente ganho; o valor so vai para o servidor quando foi
 * mexido (um "Salvar alterações" qualquer nunca grava nem apaga a data); data
 * futura e barrada na tela; o codigo de recusa do servidor vira mensagem; e,
 * depois de marcar ganho pela propria ficha, a ficha le de novo o cliente e
 * mostra a data gravada. Somente dubles - nenhum banco.
 */

const mockedGetClienteDetalhe = vi.mocked(getClienteDetalhe)
const mockedUpdateCliente = vi.mocked(updateCliente)
const mockedMarcarStatus = vi.mocked(marcarStatus)

function diaSeguinte(hoje: string): string {
  const [ano, mes, dia] = hoje.split("-").map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().slice(0, 10)
}

function buildCliente(overrides: Partial<ClienteDetalhe> = {}): ClienteDetalhe {
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
    ganhoEm: null,
    ...overrides,
  }
}

function renderSheet(cliente: ClienteDetalhe) {
  mockedGetClienteDetalhe.mockResolvedValue({ data: cliente })

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
        onStatusChanged={vi.fn()}
      />
    </TooltipProvider>
  )
}

async function campoData(): Promise<HTMLInputElement> {
  return (await screen.findByLabelText("Data do ganho")) as HTMLInputElement
}

describe("ClienteDetailSheet - Data do ganho (quick 261008-rxw)", () => {
  beforeEach(() => {
    mockedGetClienteDetalhe.mockReset()
    mockedUpdateCliente.mockReset()
    mockedMarcarStatus.mockReset()
    mockedUpdateCliente.mockResolvedValue({ data: { id: "c1" } })
  })

  it("campo-so-quando-ganho: cliente ganho mostra o campo com o valor; cliente em andamento nao mostra", async () => {
    renderSheet(buildCliente({ ganhoEm: "2024-05-20" }))

    const campo = await campoData()
    expect(campo.value).toBe("2024-05-20")
  })

  it("campo-so-quando-ganho (outro status): cliente em_andamento nao mostra o campo", async () => {
    renderSheet(buildCliente({ statusAcompanhamento: "em_andamento", etapa: "aguardando_contato" }))

    await screen.findByLabelText("Razão social")
    expect(screen.queryByLabelText("Data do ganho")).not.toBeInTheDocument()
  })

  it("campo-vazio-importado: cliente ganho sem data mostra o campo vazio", async () => {
    renderSheet(buildCliente({ ganhoEm: null }))

    const campo = await campoData()
    expect(campo.value).toBe("")
  })

  it("salvar-envia-data-editada: mudar a data e salvar manda ganhoEm para a ação", async () => {
    renderSheet(buildCliente({ ganhoEm: null }))

    fireEvent.change(await campoData(), { target: { value: "2024-05-20" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))

    await waitFor(() => expect(mockedUpdateCliente).toHaveBeenCalledTimes(1))
    expect(mockedUpdateCliente.mock.calls[0][0].ganhoEm).toBe("2024-05-20")
  })

  it("salvar-sem-mexer-nao-envia: mudar só o telefone e salvar manda ganhoEm indefinido", async () => {
    renderSheet(buildCliente({ ganhoEm: "2024-05-20" }))

    await campoData()
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "11999990000" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))

    await waitFor(() => expect(mockedUpdateCliente).toHaveBeenCalledTimes(1))
    expect(mockedUpdateCliente.mock.calls[0][0].ganhoEm).toBeUndefined()
    expect(mockedUpdateCliente.mock.calls[0][0].telefone).toBe("11999990000")
  })

  it("limpar-envia-vazio: apagar a data e salvar manda ganhoEm vazio", async () => {
    renderSheet(buildCliente({ ganhoEm: "2024-05-20" }))

    fireEvent.change(await campoData(), { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))

    await waitFor(() => expect(mockedUpdateCliente).toHaveBeenCalledTimes(1))
    expect(mockedUpdateCliente.mock.calls[0][0].ganhoEm).toBe("")
  })

  it("erro-fora-de-ganho: o codigo do servidor vira a mensagem clara", async () => {
    mockedUpdateCliente.mockResolvedValue({ error: { code: "ganho_em_fora_de_ganho" } })
    renderSheet(buildCliente({ ganhoEm: null }))

    fireEvent.change(await campoData(), { target: { value: "2024-05-20" } })
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))

    expect(
      await screen.findByText("A data do ganho só pode ser informada para clientes ganhos.")
    ).toBeInTheDocument()
  })

  it("data-futura-bloqueia: amanha mostra a mensagem e a ação não é chamada", async () => {
    renderSheet(buildCliente({ ganhoEm: null }))

    fireEvent.change(await campoData(), {
      target: { value: diaSeguinte(hojeEmSaoPaulo()) },
    })
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))

    expect(await screen.findByText("A data do ganho não pode ser no futuro.")).toBeInTheDocument()
    expect(mockedUpdateCliente).not.toHaveBeenCalled()
  })

  it("marcar-ganho-mostra-data: depois de marcar ganho, a ficha le de novo e mostra a data gravada; salvar sem mexer nao envia ganhoEm", async () => {
    mockedMarcarStatus.mockResolvedValue({ data: true })
    renderSheet(buildCliente({ statusAcompanhamento: "em_andamento", ganhoEm: null }))

    const status = await screen.findByRole("combobox", { name: "Status" })
    // A releitura (depois do ganho) devolve o cliente ja ganho, com a data
    // que o gatilho do banco gravou.
    mockedGetClienteDetalhe.mockResolvedValue({
      data: buildCliente({ statusAcompanhamento: "ganho", ganhoEm: "2026-10-08" }),
    })
    fireEvent.click(status)
    fireEvent.click(await screen.findByRole("option", { name: /^Ganho$/ }))

    fireEvent.click(await screen.findByRole("combobox", { name: "Frequência de visita" }))
    fireEvent.click(await screen.findByRole("option", { name: "Semanal" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirmar ganho" }))

    await waitFor(() => expect(mockedMarcarStatus).toHaveBeenCalledTimes(1))
    const campo = await campoData()
    await waitFor(() => expect(campo.value).toBe("2026-10-08"))

    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))
    await waitFor(() => expect(mockedUpdateCliente).toHaveBeenCalledTimes(1))
    expect(mockedUpdateCliente.mock.calls[0][0].ganhoEm).toBeUndefined()
  })
})
