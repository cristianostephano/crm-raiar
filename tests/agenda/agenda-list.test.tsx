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
  concluirTarefaProspeccao: vi.fn(),
  concluirVisita: vi.fn(),
  getAgendaConcluidosAction: vi.fn().mockResolvedValue({ data: [] }),
  getClientesSemDiaFixoAction: vi.fn().mockResolvedValue({ data: [] }),
}))

// Molde de tests/clientes/filters-popover.test.tsx: a ficha do cliente
// (ClienteDetailSheet) e componentes internos criam o cliente de navegador
// via @/lib/supabase/client — mockado defensivamente para que o teste
// nunca dependa de um env/sessão real.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: vi.fn().mockResolvedValue({ data: [], error: null }) }),
}))

import {
  concluirTarefaProspeccao,
  concluirVisita,
  getAgendaAction,
  getClientesSemDiaFixoAction,
} from "@/app/actions/agenda"
import type { GetAgendaResult } from "@/app/actions/agenda"

const mockedAction = vi.mocked(getAgendaAction)
const mockedConcluirTarefa = vi.mocked(concluirTarefaProspeccao)
const mockedConcluirVisita = vi.mocked(concluirVisita)
const mockedSemDiaFixo = vi.mocked(getClientesSemDiaFixoAction)

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
        motivoConclusaoRemotaOptions={[]}
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
    mockedConcluirTarefa.mockClear()
    mockedConcluirVisita.mockClear()
    mockedSemDiaFixo.mockClear()
    mockedSemDiaFixo.mockResolvedValue({ data: [] })
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

  it("abre: clicar em Concluir numa linha abre a janela com o título correspondente ao cliente e à origem", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({
          origem: "visita",
          razaoSocial: "Padaria Central",
          titulo: "Visita",
        }),
      ],
    })

    renderList()

    await screen.findByText("Padaria Central")
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    expect(
      screen.getByText("Concluir visita de Padaria Central?")
    ).toBeInTheDocument()
  })

  it("recarrega: uma confirmação bem-sucedida dispara uma nova leitura da agenda", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({
          origem: "prospeccao",
          razaoSocial: "Padaria Central",
          itemId: "tarefa-1",
        }),
      ],
    })
    mockedConcluirTarefa.mockResolvedValueOnce({ data: true })
    mockedAction.mockResolvedValueOnce({ data: [] })

    renderList()

    await screen.findByText("Padaria Central")
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Cliente confirmou pedido para a próxima semana." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Concluir tarefa" }))

    await vi.waitFor(() => {
      expect(mockedConcluirTarefa).toHaveBeenCalledTimes(1)
    })
    await vi.waitFor(() => {
      expect(mockedAction).toHaveBeenCalledTimes(2)
    })
  })

  it("roteia (prospecção): o identificador do motivo chega à ação de prospecção, no fim da lista de argumentos", async () => {
    const motivoOptions = [{ id: "motivo-1", nome: "Pedido pelo WhatsApp" }]
    const RESUMO = "Cliente confirmou pedido para a próxima semana."

    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({
          origem: "prospeccao",
          razaoSocial: "Padaria Central",
          itemId: "tarefa-1",
        }),
      ],
    })
    mockedConcluirTarefa.mockResolvedValueOnce({ data: true })
    mockedAction.mockResolvedValueOnce({ data: [] })

    renderList({ motivoConclusaoRemotaOptions: motivoOptions })

    await screen.findByText("Padaria Central")
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: RESUMO },
    })
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Não foi presencial" })
    )
    fireEvent.click(await screen.findByRole("combobox", { name: "Motivo" }))
    const opcaoTarefa = await screen.findByRole("option", {
      name: "Pedido pelo WhatsApp",
    })
    fireEvent.pointerDown(opcaoTarefa)
    fireEvent.click(opcaoTarefa)
    fireEvent.click(screen.getByRole("button", { name: "Concluir tarefa" }))

    await vi.waitFor(() => {
      expect(mockedConcluirTarefa).toHaveBeenCalledTimes(1)
    })
    expect(mockedConcluirTarefa).toHaveBeenCalledWith(
      "tarefa-1",
      RESUMO,
      "motivo-1"
    )
    // Espera a recarga disparada pelo sucesso também se completar — sem
    // isso, a 2ª leitura enfileirada para ESTE teste ainda pode não ter
    // sido consumida quando o teste termina, e sobra para o próximo teste
    // do arquivo consumir no lugar errado (mockClear não limpa a fila de
    // mockResolvedValueOnce ainda não consumida).
    await vi.waitFor(() => {
      expect(mockedAction).toHaveBeenCalledTimes(2)
    })
  })

  it("roteia (visita): o identificador do motivo chega à ação de visita, no fim da lista de argumentos", async () => {
    const motivoOptions = [{ id: "motivo-1", nome: "Pedido pelo WhatsApp" }]
    const RESUMO = "Cliente confirmou pedido para a próxima semana."

    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({
          origem: "visita",
          razaoSocial: "Padaria Central",
          itemId: "visita-1",
        }),
      ],
    })
    mockedConcluirVisita.mockResolvedValueOnce({ data: true })
    mockedAction.mockResolvedValueOnce({ data: [] })

    renderList({ motivoConclusaoRemotaOptions: motivoOptions })

    await screen.findByText("Padaria Central")
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: RESUMO },
    })
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Não foi presencial" })
    )
    fireEvent.click(await screen.findByRole("combobox", { name: "Motivo" }))
    const opcaoVisita = await screen.findByRole("option", {
      name: "Pedido pelo WhatsApp",
    })
    fireEvent.pointerDown(opcaoVisita)
    fireEvent.click(opcaoVisita)
    fireEvent.click(screen.getByRole("button", { name: "Concluir visita" }))

    await vi.waitFor(() => {
      expect(mockedConcluirVisita).toHaveBeenCalledTimes(1)
    })
    // Mesma cautela do teste irmão acima (prospecção): espera a recarga
    // terminar antes do teste encerrar.
    await vi.waitFor(() => {
      expect(mockedAction).toHaveBeenCalledTimes(2)
    })
    expect(mockedConcluirVisita).toHaveBeenCalledWith(
      "visita-1",
      RESUMO,
      null,
      null,
      "motivo-1"
    )
  })

  it("aviso de dia fixo (AGENDA-01): a seção aparece na Lista quando a ação devolve clientes, e não aparece na visão de Calendário", async () => {
    mockedAction.mockResolvedValueOnce({ data: [] })
    mockedSemDiaFixo.mockResolvedValueOnce({
      data: [
        {
          clienteId: "cliente-sem-frequencia",
          razaoSocial: "Padaria Sem Frequência",
          responsavel: "vendedor-1",
          responsavelNome: "Vendedor Um",
          frequenciaVisita: null,
        },
      ],
    })

    renderList()

    expect(
      await screen.findByText("Sem dia fixo definido (1)")
    ).toBeInTheDocument()
    expect(screen.getByText("Padaria Sem Frequência")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Mês" }))

    expect(
      screen.queryByText("Sem dia fixo definido (1)")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("Padaria Sem Frequência")
    ).not.toBeInTheDocument()
  })
})
