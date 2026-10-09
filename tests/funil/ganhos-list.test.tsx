// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

type SheetProps = {
  clienteId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isSupervisor: boolean
  currentUserId?: string
  categoriaOptions: { id: string; nome: string }[]
  produtoOptions: { id: string; nome: string }[]
  vendedorOptions: { id: string; nome: string }[]
  onSaved: (values: Record<string, unknown>) => void
  onDeleted: (id: string) => void
  onStatusChanged?: (status: string) => void
}

const { sheetState } = vi.hoisted(() => ({
  sheetState: { props: null as null | SheetProps },
}))

vi.mock("@/app/actions/ganhos", () => ({
  getClientesGanhosAction: vi.fn(),
}))

// Duble da ficha do cliente: guarda as props e, quando aberta, mostra um
// marcador com o clienteId e tres botoes que simulam salvar, apagar e
// encerrar pela ficha.
vi.mock("@/components/clientes/ClienteDetailSheet", () => ({
  ClienteDetailSheet: (props: SheetProps) => {
    sheetState.props = props
    if (!props.open) return null
    return (
      <div data-testid="ficha-dublada">
        <span>{`ficha-aberta:${props.clienteId}`}</span>
        <button type="button" onClick={() => props.onStatusChanged?.("encerrado")}>
          ficha-encerrar
        </button>
        <button type="button" onClick={() => props.onSaved({})}>
          ficha-salvar
        </button>
        <button type="button" onClick={() => props.onDeleted(props.clienteId ?? "")}>
          ficha-apagar
        </button>
      </div>
    )
  },
}))

import { getClientesGanhosAction } from "@/app/actions/ganhos"
import { GanhosList } from "@/components/ganhos/GanhosList"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ClienteGanho } from "@/lib/ganhos/lista"

/**
 * Teste de tela da lista Ganhos (quick 261008-rxw): carga, nome do vendedor so
 * para o Supervisor, data e "Data nao informada", clique na linha abre a MESMA
 * ficha do funil (duble), salvar/apagar/encerrar pela ficha recarrega a lista,
 * aviso de que clientes sem data so aparecem em "Tudo", textos de lista vazia,
 * busca, erro de carga. Sem Reabrir.
 */

const mockedAction = vi.mocked(getClientesGanhosAction)

let nextId = 0
function buildCliente(partial: Partial<ClienteGanho> = {}): ClienteGanho {
  nextId += 1
  return {
    clienteId: `cliente-${nextId}`,
    razaoSocial: `Cliente ${nextId}`,
    nomeFantasia: null,
    ganhoEm: "2026-09-10",
    responsavel: "vendedor-1",
    responsavelNome: "Ana Souza",
    ...partial,
  }
}

const CATEGORIAS = [{ id: "cat1", nome: "FS" }]
const PRODUTOS = [{ id: "prod1", nome: "casca" }]
const VENDEDORES = [{ id: "v1", nome: "Ana Souza" }]

function renderList(isSupervisor = false) {
  return render(
    <TooltipProvider>
      <GanhosList
        isSupervisor={isSupervisor}
        categoriaOptions={CATEGORIAS}
        produtoOptions={PRODUTOS}
        vendedorOptions={VENDEDORES}
      />
    </TooltipProvider>
  )
}

async function escolherPeriodo(nome: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Período" }))
  const opcao = await screen.findByRole("option", { name: nome })
  fireEvent.pointerDown(opcao)
  fireEvent.click(opcao)
}

describe("GanhosList", () => {
  beforeEach(() => {
    mockedAction.mockReset()
    sheetState.props = null
  })

  it("carga-inicial: ao montar, getClientesGanhosAction é chamada uma vez com { inicio: null, fim: null }", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildCliente({ clienteId: "c1", razaoSocial: "Padaria Central Ltda" }),
        buildCliente({ clienteId: "c2", razaoSocial: "Mercado Bom Preço" }),
      ],
    })

    renderList()

    expect(await screen.findByText("Padaria Central Ltda")).toBeInTheDocument()
    expect(screen.getByText("Mercado Bom Preço")).toBeInTheDocument()
    expect(mockedAction).toHaveBeenCalledTimes(1)
    expect(mockedAction).toHaveBeenCalledWith({ inicio: null, fim: null })
  })

  it("vendedor-nome: com isSupervisor true o nome do vendedor aparece", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildCliente({ razaoSocial: "Padaria Central Ltda", responsavelNome: "Ana Souza" })],
    })

    renderList(true)

    await screen.findByText("Padaria Central Ltda")
    expect(screen.getByText("Ana Souza")).toBeInTheDocument()
  })

  it("vendedor-nome-oculto: com isSupervisor false o nome do vendedor não aparece", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildCliente({ razaoSocial: "Padaria Central Ltda", responsavelNome: "Ana Souza" })],
    })

    renderList(false)

    await screen.findByText("Padaria Central Ltda")
    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument()
  })

  it("data-e-ausente: mostra 'Ganho em 10/06/2025' para a data e 'Data não informada' para a data vazia", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildCliente({ razaoSocial: "Com Data Ltda", ganhoEm: "2025-06-10" }),
        buildCliente({ razaoSocial: "Sem Data Ltda", ganhoEm: null }),
      ],
    })

    renderList()

    await screen.findByText("Com Data Ltda")
    expect(screen.getByText("Ganho em 10/06/2025")).toBeInTheDocument()
    expect(screen.getByText("Data não informada")).toBeInTheDocument()
  })

  it("abrir-ficha: clicar na linha abre a ficha com o clienteId, os catálogos e sem currentUserId", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildCliente({ clienteId: "c1", razaoSocial: "Padaria Central Ltda" })],
    })

    renderList(true)

    await screen.findByText("Padaria Central Ltda")
    fireEvent.click(screen.getByRole("button", { name: "Abrir ficha de Padaria Central Ltda" }))

    expect(await screen.findByText("ficha-aberta:c1")).toBeInTheDocument()
    expect(sheetState.props?.clienteId).toBe("c1")
    expect(sheetState.props?.open).toBe(true)
    expect(sheetState.props?.isSupervisor).toBe(true)
    expect(sheetState.props?.categoriaOptions).toEqual(CATEGORIAS)
    expect(sheetState.props?.produtoOptions).toEqual(PRODUTOS)
    expect(sheetState.props?.vendedorOptions).toEqual(VENDEDORES)
    expect(sheetState.props?.currentUserId).toBeUndefined()
  })

  it("ficha-encerrar-recarrega: encerrar pela ficha faz nova leitura e a linha some", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildCliente({ clienteId: "c1", razaoSocial: "Padaria Central Ltda" })],
    })
    mockedAction.mockResolvedValueOnce({ data: [] })

    renderList()

    await screen.findByText("Padaria Central Ltda")
    fireEvent.click(screen.getByRole("button", { name: "Abrir ficha de Padaria Central Ltda" }))
    fireEvent.click(await screen.findByRole("button", { name: "ficha-encerrar" }))

    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      expect(screen.queryByText("Padaria Central Ltda")).not.toBeInTheDocument()
    })
  })

  it("ficha-salvar-apagar-recarrega: salvar e apagar pela ficha recarregam a lista (3 leituras no total)", async () => {
    mockedAction.mockResolvedValue({
      data: [buildCliente({ clienteId: "c1", razaoSocial: "Padaria Central Ltda" })],
    })

    renderList()

    await screen.findByText("Padaria Central Ltda")
    fireEvent.click(screen.getByRole("button", { name: "Abrir ficha de Padaria Central Ltda" }))

    fireEvent.click(await screen.findByRole("button", { name: "ficha-salvar" }))
    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(2))

    fireEvent.click(await screen.findByRole("button", { name: "ficha-apagar" }))
    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(3))
  })

  it("sem-reabrir: a lista não tem botão Reabrir nem coluna de motivo", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildCliente({ razaoSocial: "Padaria Central Ltda" })],
    })

    renderList()

    await screen.findByText("Padaria Central Ltda")
    expect(screen.queryByText(/Reabrir/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Motivo/)).not.toBeInTheDocument()
  })

  it("aviso-sem-data: em Tudo não há aviso; com Últimos 30 dias o aviso de 'sem data só em Tudo' aparece", async () => {
    mockedAction.mockResolvedValue({
      data: [buildCliente({ razaoSocial: "Padaria Central Ltda" })],
    })

    renderList()

    await screen.findByText("Padaria Central Ltda")
    expect(screen.queryByText(/Clientes sem data do ganho aparecem só em/)).not.toBeInTheDocument()

    await escolherPeriodo("Últimos 30 dias")

    expect(
      await screen.findByText(/Clientes sem data do ganho aparecem só em/)
    ).toBeInTheDocument()
  })

  it("vazio: resposta vazia com Tudo mostra os textos de lista vazia sem recorte", async () => {
    mockedAction.mockResolvedValueOnce({ data: [] })

    renderList()

    expect(await screen.findByText("Nenhum cliente ganho")).toBeInTheDocument()
    expect(
      screen.getByText("Quando um cliente for marcado como ganho, ele aparece aqui.")
    ).toBeInTheDocument()
  })

  it("vazio-periodo: escolher Últimos 30 dias dispara nova leitura com inicio preenchido; resposta vazia mostra o texto de período", async () => {
    mockedAction.mockResolvedValueOnce({ data: [] })
    mockedAction.mockResolvedValueOnce({ data: [] })

    renderList()

    await screen.findByText("Nenhum cliente ganho")
    await escolherPeriodo("Últimos 30 dias")

    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(2))
    const ultimaChamada = mockedAction.mock.calls[1][0]
    expect(ultimaChamada.inicio).not.toBeNull()
    expect(ultimaChamada.fim).toBeNull()

    expect(await screen.findByText("Nenhum cliente ganho nesse período")).toBeInTheDocument()
  })

  it("busca: filtra a lista já carregada sem nova leitura; sem resultado mostra o texto de busca", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildCliente({ clienteId: "c1", razaoSocial: "Padaria Central Ltda" }),
        buildCliente({ clienteId: "c2", razaoSocial: null, nomeFantasia: "Mercado Bom Preço" }),
      ],
    })

    renderList()

    await screen.findByText("Padaria Central Ltda")
    fireEvent.change(screen.getByLabelText("Buscar por nome"), { target: { value: "mercado" } })

    expect(screen.queryByText("Padaria Central Ltda")).not.toBeInTheDocument()
    expect(screen.getByText("Mercado Bom Preço")).toBeInTheDocument()
    expect(mockedAction).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByLabelText("Buscar por nome"), { target: { value: "zzz" } })

    expect(screen.getByText("Nenhum cliente ganho com esse nome")).toBeInTheDocument()
  })

  it("busca-limpa: com texto na busca, trocar o período limpa o campo de busca", async () => {
    mockedAction.mockResolvedValue({
      data: [buildCliente({ clienteId: "c1", razaoSocial: "Padaria Central Ltda" })],
    })

    renderList()

    await screen.findByText("Padaria Central Ltda")
    const campoBusca = screen.getByLabelText("Buscar por nome") as HTMLInputElement
    fireEvent.change(campoBusca, { target: { value: "padaria" } })
    expect(campoBusca.value).toBe("padaria")

    await escolherPeriodo("Últimos 30 dias")

    await waitFor(() => {
      expect((screen.getByLabelText("Buscar por nome") as HTMLInputElement).value).toBe("")
    })
  })

  it("erro-carga: resposta de erro mostra a copy de erro; Tentar novamente chama a leitura de novo", async () => {
    mockedAction.mockResolvedValueOnce({
      error: { code: "fetch_falhou", message: "erro interno qualquer" },
    })

    renderList()

    expect(
      await screen.findByText("Não foi possível carregar os clientes ganhos. Tente novamente.")
    ).toBeInTheDocument()

    mockedAction.mockResolvedValueOnce({ data: [] })
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))

    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(2))
  })
})
