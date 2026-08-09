// @vitest-environment jsdom
import { addDays, format } from "date-fns"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AgendaList } from "@/components/agenda/AgendaList"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { AgendaItem } from "@/lib/agenda/itens"

vi.mock("@/app/actions/agenda", () => ({
  getAgendaAction: vi.fn(),
}))

// Molde de tests/clientes/filters-popover.test.tsx: a ficha do cliente
// (ClienteDetailSheet) e componentes internos criam o cliente de navegador
// via @/lib/supabase/client — mockado defensivamente para que o teste
// nunca dependa de um env/sessão real.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }),
}))

import { getAgendaAction } from "@/app/actions/agenda"
import type { GetAgendaResult } from "@/app/actions/agenda"

const mockedAction = vi.mocked(getAgendaAction)

/** Datas montadas a partir do relógio real do teste (nunca literais fixas),
 * para que "hoje"/"atrasado"/"próximos" nunca apodreçam com o tempo. */
function dataRelativa(dias: number): string {
  return format(addDays(new Date(), dias), "yyyy-MM-dd")
}

let nextId = 0
function buildItem(partial: Partial<AgendaItem> = {}): AgendaItem {
  nextId += 1
  return {
    origem: "prospeccao",
    itemId: `item-${nextId}`,
    clienteId: `cliente-${nextId}`,
    razaoSocial: `Cliente ${nextId}`,
    responsavel: "vendedor-1",
    responsavelNome: "Vendedor Um",
    titulo: "Visitar",
    data: dataRelativa(0),
    frequenciaVisita: null,
    proximaDataSugerida: null,
    ...partial,
  }
}

function renderList(
  props: Partial<ComponentProps<typeof AgendaList>> = {}
) {
  return render(
    <TooltipProvider>
      <AgendaList
        isSupervisor={false}
        categoriaOptions={[]}
        produtoOptions={[]}
        vendedorOptions={[]}
        {...props}
      />
    </TooltipProvider>
  )
}

function deferredResult() {
  let resolve!: (value: GetAgendaResult) => void
  const promise = new Promise<GetAgendaResult>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe("AgendaList", () => {
  beforeEach(() => {
    mockedAction.mockClear()
  })

  it("carregando: no primeiro render, nem a copy de erro nem a de vazio aparecem", () => {
    const { promise } = deferredResult()
    mockedAction.mockReturnValueOnce(promise)

    renderList()

    expect(
      screen.queryByText("Não foi possível carregar sua agenda. Tente novamente.")
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Sua agenda está em dia")).not.toBeInTheDocument()
  })

  it("secoes: com itens passado/hoje/futuro, os tres cabecalhos aparecem com as contagens certas e na ordem Atrasado -> Hoje -> Proximos dias", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({ data: dataRelativa(-2) }),
        buildItem({ data: dataRelativa(0) }),
        buildItem({ data: dataRelativa(3) }),
      ],
    })

    renderList()

    const atrasado = await screen.findByText("Atrasado (1)")
    const hoje = screen.getByText("Hoje (1)")
    const proximos = screen.getByText("Próximos dias (1)")

    expect(
      atrasado.compareDocumentPosition(hoje) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      hoje.compareDocumentPosition(proximos) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("omite: com itens so de hoje, os cabecalhos de Atrasado e de Proximos dias nao existem", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildItem({ data: dataRelativa(0) })],
    })

    renderList()

    await screen.findByText("Hoje (1)")
    expect(screen.queryByText(/^Atrasado \(/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Próximos dias \(/)).not.toBeInTheDocument()
  })

  it("vazio: com lista vazia, aparece Sua agenda está em dia", async () => {
    mockedAction.mockResolvedValueOnce({ data: [] })

    renderList()

    expect(await screen.findByText("Sua agenda está em dia")).toBeInTheDocument()
  })

  it("erro: com a action devolvendo erro, aparece a copy e o botao Tentar novamente chama a action de novo", async () => {
    mockedAction.mockResolvedValueOnce({
      error: { code: "fetch_falhou", message: "erro interno qualquer" },
    })

    renderList()

    expect(
      await screen.findByText(
        "Não foi possível carregar sua agenda. Tente novamente."
      )
    ).toBeInTheDocument()

    mockedAction.mockResolvedValueOnce({ data: [] })
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))

    expect(await screen.findByText("Sua agenda está em dia")).toBeInTheDocument()
    expect(mockedAction).toHaveBeenCalledTimes(2)
  })

  it("filtro: com isSupervisor e itens de dois vendedores, o rotulo Vendedor e Todos os vendedores aparecem", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({ responsavel: "v-alice", responsavelNome: "Alice" }),
        buildItem({ responsavel: "v-bruno", responsavelNome: "Bruno" }),
      ],
    })

    renderList({ isSupervisor: true })

    await screen.findByText("Vendedor")
    expect(screen.getByText("Todos os vendedores")).toBeInTheDocument()
  })

  it("vendedor: com isSupervisor falso, nem o rotulo Vendedor nem a opcao Todos os vendedores aparecem", async () => {
    mockedAction.mockResolvedValueOnce({ data: [] })

    renderList({ isSupervisor: false })

    await screen.findByText("Sua agenda está em dia")
    expect(screen.queryByText("Vendedor")).not.toBeInTheDocument()
    expect(screen.queryByText("Todos os vendedores")).not.toBeInTheDocument()
  })
})
