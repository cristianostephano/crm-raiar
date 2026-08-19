// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ConfiguracoesTabs } from "@/components/configuracoes/ConfiguracoesTabs"

/**
 * Prova de renderização das 6 abas de "Configurações" (Fase 22, CONC-03) —
 * não exercita nenhum gesto de clique (a biblioteca de abas tem quirks
 * conhecidos de ponteiro no ambiente simulado deste projeto, precedente em
 * tests/agenda/agenda-list.test.tsx), já que o painel é mantido montado
 * (`keepMounted`) e por isso as 6 buscas disparam na montagem, sem
 * interação nenhuma.
 *
 * O módulo inteiro de ações de lista é simulado (precedente de
 * tests/agenda/agenda-list.test.tsx para módulos de Server Action inteiros
 * em teste de renderização): a ação de listar devolve sucesso com lista
 * vazia, e as outras três (criar/renomear/ativar-desativar) nunca são
 * chamadas por este teste — não há interação de formulário aqui.
 */
vi.mock("@/app/actions/listas", () => ({
  getListaValores: vi.fn().mockResolvedValue({ data: [] }),
  createListaValor: vi.fn(),
  updateListaValor: vi.fn(),
  setListaValorAtivo: vi.fn(),
}))

import { getListaValores } from "@/app/actions/listas"

const mockedGetListaValores = vi.mocked(getListaValores)

const ROTULOS_NA_ORDEM = [
  "Categoria",
  "Produtos consumidos",
  "Tipos de tarefa",
  "Motivos de perda",
  "Frequência de pedidos",
  "Motivos de conclusão remota",
]

const TABELAS_NA_ORDEM = [
  "categorias",
  "produtos_consumidos",
  "tipos_tarefa",
  "motivos_perda",
  "frequencias_pedido",
  "motivos_conclusao_remota",
]

describe("ConfiguracoesTabs (6 abas, Fase 22)", () => {
  beforeEach(() => {
    mockedGetListaValores.mockClear()
  })

  it("seisabas: os seis rótulos aparecem, e o rótulo da aba nova é o texto literal do requisito", async () => {
    render(<ConfiguracoesTabs />)

    for (const rotulo of ROTULOS_NA_ORDEM) {
      expect(await screen.findByRole("tab", { name: rotulo })).toBeInTheDocument()
    }

    expect(
      screen.getByRole("tab", { name: "Motivos de conclusão remota" })
    ).toBeInTheDocument()
  })

  it("ordem: os seis rótulos aparecem NA ORDEM esperada, com o novo por último", async () => {
    render(<ConfiguracoesTabs />)

    await screen.findByRole("tab", { name: "Motivos de conclusão remota" })

    const tabs = screen.getAllByRole("tab")
    const rotulosEncontrados = tabs.map((tab) => tab.textContent)

    expect(rotulosEncontrados).toEqual(ROTULOS_NA_ORDEM)
  })

  it("ligada: a ação de listar foi chamada uma vez para CADA um dos seis nomes de tabela", async () => {
    render(<ConfiguracoesTabs />)

    await screen.findByRole("tab", { name: "Motivos de conclusão remota" })

    // O painel é mantido montado (keepMounted) — se não estivesse, só o
    // painel ativo teria buscado, e esta asserção falharia com 1 chamada
    // em vez de 6.
    expect(mockedGetListaValores).toHaveBeenCalledTimes(TABELAS_NA_ORDEM.length)

    for (const tabela of TABELAS_NA_ORDEM) {
      expect(mockedGetListaValores).toHaveBeenCalledWith(tabela)
    }
  })
})
