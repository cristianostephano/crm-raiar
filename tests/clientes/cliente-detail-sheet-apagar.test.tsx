// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Quick task 261006-gvo (D-06/D-07) — visibilidade do botão "Apagar cliente"
 * na ficha, texto do diálogo de confirmação e mensagens de erro. A tela só
 * esconde o botão por conforto; quem decide é a policy de DELETE da 0050.
 */

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

import { deleteCliente, getClienteDetalhe } from "@/app/actions/clientes"
import { ClienteDetailSheet } from "@/components/clientes/ClienteDetailSheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ClienteDetalhe, StatusAcompanhamento } from "@/lib/supabase/queries/clientes"

const mockedGetClienteDetalhe = vi.mocked(getClienteDetalhe)
const mockedDeleteCliente = vi.mocked(deleteCliente)

const FRASE_DEFINITIVO =
  /Essa ação não pode ser desfeita e vai remover todo o histórico do funil\./
const MSG_FORBIDDEN = "Você não tem permissão para apagar este cliente, ou ele já foi apagado."
const MSG_GENERICA = "Não foi possível apagar o cliente. Tente novamente."

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
    etapa: "aguardando_contato",
    statusAcompanhamento: "em_andamento",
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

type OpcoesRender = {
  isSupervisor?: boolean
  currentUserId?: string
  onDeleted?: (id: string) => void
  onOpenChange?: (open: boolean) => void
}

function renderSheet(cliente: ClienteDetalhe, opcoes: OpcoesRender = {}) {
  mockedGetClienteDetalhe.mockResolvedValue({ data: cliente })
  const onDeleted = opcoes.onDeleted ?? vi.fn()
  const onOpenChange = opcoes.onOpenChange ?? vi.fn()

  render(
    <TooltipProvider>
      <ClienteDetailSheet
        clienteId="c1"
        open
        onOpenChange={onOpenChange}
        isSupervisor={opcoes.isSupervisor ?? false}
        currentUserId={opcoes.currentUserId}
        categoriaOptions={[]}
        produtoOptions={[]}
        vendedorOptions={[]}
        onSaved={vi.fn()}
        onDeleted={onDeleted}
      />
    </TooltipProvider>
  )

  return { onDeleted, onOpenChange }
}

/** Espera a ficha carregar (o combobox de Status só existe depois disso). */
async function esperarFichaCarregada() {
  await screen.findByRole("combobox", { name: "Status" })
}

const queryBotaoApagar = () => screen.queryByRole("button", { name: "Apagar cliente" })

const STATUS_FORA_DE_PROSPECCAO: { status: StatusAcompanhamento; etapa: ClienteDetalhe["etapa"] }[] = [
  { status: "ganho", etapa: "primeira_venda" },
  { status: "perdido", etapa: "aguardando_contato" },
  { status: "encerrado", etapa: "primeira_venda" },
]

describe("cliente-detail-sheet-apagar: botão Apagar cliente (D-06)", () => {
  beforeEach(() => {
    mockedGetClienteDetalhe.mockReset()
    mockedDeleteCliente.mockReset()
  })

  it("vendedor-dono-em-andamento-ve-botao", async () => {
    renderSheet(buildCliente({ responsavel: "vendedor-1", statusAcompanhamento: "em_andamento" }), {
      isSupervisor: false,
      currentUserId: "vendedor-1",
    })

    expect(await screen.findByRole("button", { name: "Apagar cliente" })).toBeInTheDocument()
  })

  it.each(STATUS_FORA_DE_PROSPECCAO)(
    "vendedor-dono-fora-de-prospeccao-nao-ve ($status)",
    async ({ status, etapa }) => {
      renderSheet(
        buildCliente({
          responsavel: "vendedor-1",
          statusAcompanhamento: status,
          etapa,
          motivoPerdaId: status === "perdido" ? "mp1" : null,
        }),
        { isSupervisor: false, currentUserId: "vendedor-1" }
      )

      await esperarFichaCarregada()
      expect(queryBotaoApagar()).not.toBeInTheDocument()
    }
  )

  it("vendedor-nao-dono-nao-ve", async () => {
    renderSheet(buildCliente({ responsavel: "vendedor-2", statusAcompanhamento: "em_andamento" }), {
      isSupervisor: false,
      currentUserId: "vendedor-1",
    })

    await esperarFichaCarregada()
    expect(queryBotaoApagar()).not.toBeInTheDocument()
  })

  it("sem-currentUserId-vendedor-nao-ve (caminho da Agenda)", async () => {
    renderSheet(buildCliente({ responsavel: "vendedor-1", statusAcompanhamento: "em_andamento" }), {
      isSupervisor: false,
    })

    await esperarFichaCarregada()
    expect(queryBotaoApagar()).not.toBeInTheDocument()
  })

  it.each([
    { status: "em_andamento" as const, etapa: "aguardando_contato" as const },
    ...STATUS_FORA_DE_PROSPECCAO,
  ])("supervisor-sempre-ve ($status)", async ({ status, etapa }) => {
    renderSheet(
      buildCliente({
        responsavel: "vendedor-2",
        statusAcompanhamento: status,
        etapa,
        motivoPerdaId: status === "perdido" ? "mp1" : null,
      }),
      { isSupervisor: true }
    )

    expect(await screen.findByRole("button", { name: "Apagar cliente" })).toBeInTheDocument()
  })
})

describe("cliente-detail-sheet-apagar: diálogo e erros (D-06/D-07)", () => {
  beforeEach(() => {
    mockedGetClienteDetalhe.mockReset()
    mockedDeleteCliente.mockReset()
  })

  async function abrirDialogo() {
    fireEvent.click(await screen.findByRole("button", { name: "Apagar cliente" }))
    return screen.findByText(FRASE_DEFINITIVO)
  }

  it("dialogo-definitivo", async () => {
    renderSheet(buildCliente(), { currentUserId: "vendedor-1" })

    expect(await abrirDialogo()).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Apagar" })).toBeInTheDocument()
  })

  it("erro-amigavel-forbidden", async () => {
    mockedDeleteCliente.mockResolvedValue({ error: { code: "forbidden" } })
    const { onDeleted } = renderSheet(buildCliente(), { currentUserId: "vendedor-1" })

    await abrirDialogo()
    fireEvent.click(screen.getByRole("button", { name: "Apagar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(MSG_FORBIDDEN)
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it("erro-generico", async () => {
    mockedDeleteCliente.mockResolvedValue({ error: { code: "generic" } })
    const { onDeleted } = renderSheet(buildCliente(), { currentUserId: "vendedor-1" })

    await abrirDialogo()
    fireEvent.click(screen.getByRole("button", { name: "Apagar" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(MSG_GENERICA)
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it("apagou-chama-onDeleted", async () => {
    mockedDeleteCliente.mockResolvedValue({ data: { id: "c1" } })
    const { onDeleted, onOpenChange } = renderSheet(buildCliente(), {
      currentUserId: "vendedor-1",
    })

    await abrirDialogo()
    fireEvent.click(screen.getByRole("button", { name: "Apagar" }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("c1"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
