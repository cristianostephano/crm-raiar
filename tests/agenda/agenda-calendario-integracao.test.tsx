// @vitest-environment jsdom
import { addDays, format } from "date-fns"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AgendaList } from "@/components/agenda/AgendaList"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { AgendaItem } from "@/lib/agenda/itens"

// Molde de tests/agenda/agenda-list.test.tsx: mesma simulação das ações de
// servidor da agenda.
vi.mock("@/app/actions/agenda", () => ({
  getAgendaAction: vi.fn(),
  concluirTarefaProspeccao: vi.fn(),
  concluirVisita: vi.fn(),
}))

// Defensivo, mesma convenção de agenda-list.test.tsx: componentes internos
// da ficha do cliente criam o cliente de navegador via @/lib/supabase/client
// — nunca depender de env/sessão real.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  }),
}))

// A ficha do cliente (ClienteDetailSheet, montada uma única vez no fim de
// AgendaList e reusada pelas duas visões) busca cliente + tarefas +
// histórico + diário + frequências ao abrir. Mockado defensivamente com
// erro em todas as chamadas — este arquivo só precisa provar QUE a ficha
// abre a partir de um clique no calendário, não o conteúdo carregado dela
// (isso é responsabilidade dos testes da própria ClienteDetailSheet/tela de
// Clientes).
vi.mock("@/app/actions/clientes", () => ({
  getClienteDetalhe: vi.fn().mockResolvedValue({ error: { code: "not_found" } }),
  updateCliente: vi.fn(),
  deleteCliente: vi.fn(),
  getFrequenciasPedido: vi.fn().mockResolvedValue({ error: { code: "generic" } }),
  atualizarFrequenciaVisita: vi.fn(),
}))

vi.mock("@/app/actions/funil", () => ({
  getHistoricoAction: vi.fn().mockResolvedValue({ error: { code: "generic" } }),
  getDiarioAction: vi.fn().mockResolvedValue({ error: { code: "generic" } }),
  marcarStatus: vi.fn(),
}))

vi.mock("@/app/actions/tarefas", () => ({
  getTarefasAction: vi.fn().mockResolvedValue({ error: { code: "generic" } }),
  getTiposTarefa: vi.fn().mockResolvedValue({ error: { code: "generic" } }),
  adicionarTarefa: vi.fn(),
  atualizarDataTarefa: vi.fn(),
  removerTarefa: vi.fn(),
  toggleTarefa: vi.fn(),
}))

import {
  concluirTarefaProspeccao,
  concluirVisita,
  getAgendaAction,
} from "@/app/actions/agenda"
import type { GetAgendaResult } from "@/app/actions/agenda"

const mockedAction = vi.mocked(getAgendaAction)
const mockedConcluirTarefa = vi.mocked(concluirTarefaProspeccao)
const mockedConcluirVisita = vi.mocked(concluirVisita)

/** Mesmo molde de agenda-list.test.tsx: datas relativas ao relógio real do
 * teste, nunca literais fixas. */
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

function renderList(props: Partial<ComponentProps<typeof AgendaList>> = {}) {
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

describe("AgendaList + AgendaCalendario (integração, plano 20-05)", () => {
  beforeEach(() => {
    mockedAction.mockClear()
    mockedConcluirTarefa.mockClear()
    mockedConcluirVisita.mockClear()
  })

  it("visão inicial: abre em Lista, sem barra nem grade enquanto carrega, e com a barra assim que os dados chegam", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildItem({ data: dataRelativa(0) })],
    })

    renderList()

    // Carregando: nem a barra de alternância nem as seções aparecem ainda.
    expect(
      screen.queryByRole("button", { name: "Mês" })
    ).not.toBeInTheDocument()

    await screen.findByText("Hoje (1)")

    // Pronto: a barra aparece, com Lista ativa (aria-pressed) e sem grade
    // nenhuma renderizada (nenhum botão de navegação de período, que só
    // existe fora da visão de Lista).
    expect(screen.getByRole("button", { name: "Lista" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(screen.getByRole("button", { name: "Mês" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Período anterior" })
    ).not.toBeInTheDocument()
  })

  it("carregando e erro: a barra do calendário não aparece em nenhum dos dois estados", async () => {
    let resolve!: (value: GetAgendaResult) => void
    const pendente = new Promise<GetAgendaResult>((res) => {
      resolve = res
    })
    mockedAction.mockReturnValueOnce(pendente)

    renderList()

    expect(
      screen.queryByRole("button", { name: "Mês" })
    ).not.toBeInTheDocument()

    resolve({ error: { code: "fetch_falhou", message: "erro interno qualquer" } })

    expect(
      await screen.findByText(
        "Não foi possível carregar sua agenda. Tente novamente."
      )
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Mês" })
    ).not.toBeInTheDocument()
  })

  it("alternância: clicar em Mês esconde as seções e mostra a grade; clicar em Lista traz as mesmas contagens de volta", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({ data: dataRelativa(-2) }),
        buildItem({ data: dataRelativa(0) }),
        buildItem({ data: dataRelativa(3) }),
      ],
    })

    renderList()

    await screen.findByText("Atrasado (1)")
    expect(screen.getByText("Hoje (1)")).toBeInTheDocument()
    expect(screen.getByText("Próximos dias (1)")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Mês" }))

    expect(screen.queryByText("Atrasado (1)")).not.toBeInTheDocument()
    expect(screen.queryByText("Hoje (1)")).not.toBeInTheDocument()
    expect(screen.queryByText("Próximos dias (1)")).not.toBeInTheDocument()
    // A grade apareceu: agora existe navegação de período.
    expect(
      screen.getByRole("button", { name: "Período anterior" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Lista" }))

    expect(screen.getByText("Atrasado (1)")).toBeInTheDocument()
    expect(screen.getByText("Hoje (1)")).toBeInTheDocument()
    expect(screen.getByText("Próximos dias (1)")).toBeInTheDocument()
  })

  it("sem segunda busca: trocar de visão várias vezes não chama a leitura da agenda de novo", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildItem({ data: dataRelativa(0) })],
    })

    renderList()
    await screen.findByText("Hoje (1)")

    fireEvent.click(screen.getByRole("button", { name: "Mês" }))
    fireEvent.click(screen.getByRole("button", { name: "Semana" }))
    fireEvent.click(screen.getByRole("button", { name: "Dia" }))
    fireEvent.click(screen.getByRole("button", { name: "Lista" }))

    expect(mockedAction).toHaveBeenCalledTimes(1)
  })

  it("coerência com o filtro de vendedor: escolher um vendedor no filtro do Supervisor muda a Lista e a grade de mês juntas, e voltar para Todos restaura as duas", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({
          responsavel: "v-alice",
          responsavelNome: "Alice",
          razaoSocial: "Padaria da Alice",
          data: dataRelativa(0),
        }),
        buildItem({
          responsavel: "v-bruno",
          responsavelNome: "Bruno",
          razaoSocial: "Mercado do Bruno",
          data: dataRelativa(0),
        }),
      ],
    })

    renderList({ isSupervisor: true })

    await screen.findByText("Hoje (2)")

    fireEvent.click(screen.getByRole("combobox", { name: "Vendedor" }))
    const opcaoAlice = await screen.findByRole("option", { name: "Alice" })
    // Base UI's SelectItem só comete um "click" comum quando precedido de um
    // pointerdown no mesmo elemento (mesma ressalva já documentada em
    // tests/importacao/column-mapping-table.test.tsx) — sem isso, um clique
    // avulso em qualquer item que não seja o primeiro da lista é ignorado.
    fireEvent.pointerDown(opcaoAlice)
    fireEvent.click(opcaoAlice)

    // Lista estreitada: só o item da Alice.
    await screen.findByText("Hoje (1)")
    expect(screen.getByText("Padaria da Alice")).toBeInTheDocument()
    expect(screen.queryByText("Mercado do Bruno")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Mês" }))

    // A grade de mês concorda com a Lista: só o item da Alice aparece.
    expect(screen.getByText("Padaria da Alice")).toBeInTheDocument()
    expect(screen.queryByText("Mercado do Bruno")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("combobox", { name: "Vendedor" }))
    const opcaoTodos = await screen.findByRole("option", {
      name: "Todos os vendedores",
    })
    fireEvent.pointerDown(opcaoTodos)
    fireEvent.click(opcaoTodos)

    // De volta a "Todos": a grade volta a mostrar os dois vendedores.
    expect(screen.getByText("Padaria da Alice")).toBeInTheDocument()
    expect(screen.getByText("Mercado do Bruno")).toBeInTheDocument()
  })

  it("Lista vazia: quando o corte de vazio decide só o bloco da Lista, a barra do calendário continua visível (caminho de volta preservado)", async () => {
    // Mesmo risco de regressão descrito no plano: antes desta fase, o corte
    // de "nenhum item" encerrava a tela inteira — um Supervisor que
    // filtrasse (ou, como aqui, esvaziasse por conclusão) até zero itens
    // perdia a barra de alternância junto com a Lista, ficando sem caminho
    // de volta ao Calendário. Esvaziar via conclusão do único item pendente
    // é o caminho reproduzível sem depender de nenhuma interação adicional
    // do Select de vendedor (que tem uma ressalva de reconciliação própria,
    // documentada no `deferred-items.md` desta fase, e não faz parte do
    // escopo deste plano).
    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({
          origem: "prospeccao",
          razaoSocial: "Mercado do Bruno",
          itemId: "tarefa-bruno",
          data: dataRelativa(0),
        }),
      ],
    })

    renderList()

    await screen.findByText("Mercado do Bruno")
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    mockedConcluirTarefa.mockResolvedValueOnce({ data: true })
    mockedAction.mockResolvedValueOnce({ data: [] })

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Sem interesse por enquanto." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Concluir tarefa" }))

    expect(
      await screen.findByText("Sua agenda está em dia")
    ).toBeInTheDocument()
    // A barra continua visível — dá para trocar de visão mesmo com a Lista
    // vazia, exatamente o caminho de volta que o corte antigo (tela inteira)
    // teria escondido.
    expect(screen.getByRole("button", { name: "Lista" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mês" })).toBeInTheDocument()
  })

  it("concluir pela visão de Dia abre a mesma janela de conclusão que a Lista abre", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({
          origem: "visita",
          razaoSocial: "Padaria Central",
          titulo: "Visita",
          data: dataRelativa(0),
        }),
      ],
    })

    renderList()
    await screen.findByText("Padaria Central")

    fireEvent.click(screen.getByRole("button", { name: "Dia" }))

    await screen.findByText("Padaria Central")
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }))

    expect(
      screen.getByText("Concluir visita de Padaria Central?")
    ).toBeInTheDocument()
  })

  it("abrir pela visão de Semana abre a mesma ficha de cliente que a Lista abre", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({
          razaoSocial: "Padaria Central",
          data: dataRelativa(0),
        }),
      ],
    })

    renderList()
    await screen.findByText("Padaria Central")

    fireEvent.click(screen.getByRole("button", { name: "Semana" }))

    fireEvent.click(
      screen.getByRole("button", { name: /Padaria Central/ })
    )

    // A mesma ClienteDetailSheet (montada uma única vez, no fim de
    // AgendaList) abriu — a busca do cliente foi disparada.
    expect(
      await screen.findByText(
        "Não foi possível carregar os dados do cliente. Tente novamente."
      )
    ).toBeInTheDocument()
  })
})
