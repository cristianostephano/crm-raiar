// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AgendaSemDiaFixo } from "@/components/agenda/AgendaSemDiaFixo"
import type { ClienteSemDiaFixo } from "@/lib/agenda/itens"
import { ROTULO_SEM_NOME } from "@/lib/clientes/nomeExibicao"

/**
 * Teste de tela do componente novo do aviso de dia fixo (AGENDA-01, Fase 24,
 * Plano 24-03). Componente de apresentação puro — nenhum mock de ação de
 * servidor é necessário aqui.
 */

let nextId = 0
function buildCliente(partial: Partial<ClienteSemDiaFixo> = {}): ClienteSemDiaFixo {
  nextId += 1
  return {
    clienteId: `cliente-${nextId}`,
    razaoSocial: `Cliente ${nextId}`,
    nomeFantasia: null,
    responsavel: "vendedor-1",
    responsavelNome: "Vendedor Um",
    frequenciaVisita: null,
    ...partial,
  }
}

describe("AgendaSemDiaFixo", () => {
  it("lista vazia nao desenha nada (nem titulo, nem moldura)", () => {
    const { container } = render(
      <AgendaSemDiaFixo
        clientes={[]}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("dois clientes (um sem frequencia, um com frequencia sem dia fixo) desenham duas linhas com os dois textos de motivo diferentes", () => {
    const clientes = [
      buildCliente({
        razaoSocial: "Padaria Sem Frequência",
        frequenciaVisita: null,
      }),
      buildCliente({
        razaoSocial: "Mercado Sem Dia Fixo",
        frequenciaVisita: "semanal",
      }),
    ]

    render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
      />
    )

    expect(screen.getByText("Padaria Sem Frequência")).toBeInTheDocument()
    expect(screen.getByText("Mercado Sem Dia Fixo")).toBeInTheDocument()
    expect(
      screen.getByText("Ainda não tem frequência de visita definida.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Falta escolher o dia fixo da recorrência.")
    ).toBeInTheDocument()
  })

  it("o titulo mostra a contagem de clientes", () => {
    const clientes = [buildCliente(), buildCliente(), buildCliente()]

    render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
      />
    )

    expect(screen.getByText("Sem dia fixo definido (3)")).toBeInTheDocument()
  })

  it("clicar numa linha chama o pedido de abrir ficha com o identificador daquele cliente", () => {
    const onOpenCliente = vi.fn()
    const clientes = [
      buildCliente({ clienteId: "cliente-alvo", razaoSocial: "Padaria Alvo" }),
    ]

    render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={false}
        onOpenCliente={onOpenCliente}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Padaria Alvo/ }))

    expect(onOpenCliente).toHaveBeenCalledWith("cliente-alvo")
  })

  it("o nome do responsavel aparece so quando showResponsavel e verdadeiro", () => {
    const clientes = [
      buildCliente({ razaoSocial: "Padaria Central", responsavelNome: "Ana" }),
    ]

    const { rerender } = render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
      />
    )

    expect(screen.queryByText("Ana")).not.toBeInTheDocument()

    rerender(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={true}
        onOpenCliente={vi.fn()}
      />
    )

    expect(screen.getByText("Ana")).toBeInTheDocument()
  })
})

/**
 * AGD-15 (Fase 27 Plano 1): o título da linha passa a sair de
 * nomeExibicaoCliente() em vez do campo cru de razão social, para que um
 * cliente sem razão social apareça pelo Nome Fantasia em vez de título
 * vazio. Não duplica a cobertura de nomeExibicaoCliente() em si
 * (tests/clientes/nome-exibicao.test.ts) — só prova o uso na tela.
 *
 * Prioridade invertida na quick task 260928-fqk (2026-09-28): Nome Fantasia
 * passou a vir primeiro.
 */
describe("AgendaSemDiaFixo — nome exibido (AGD-15)", () => {
  it("razão social e Nome Fantasia preenchidos: aparece pelo Nome Fantasia, e o title é igual", () => {
    const clientes = [
      buildCliente({
        razaoSocial: "Padaria Central Ltda",
        nomeFantasia: "Padaria Central",
      }),
    ]

    render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
      />
    )

    const titulo = screen.getByText("Padaria Central")
    expect(titulo).toBeInTheDocument()
    expect(titulo).toHaveAttribute("title", "Padaria Central")
    expect(
      screen.queryByText("Padaria Central Ltda")
    ).not.toBeInTheDocument()
  })

  it("razão social nula: aparece pelo Nome Fantasia, e o title é igual", () => {
    const clientes = [
      buildCliente({ razaoSocial: null, nomeFantasia: "Mercado Bom Preço" }),
    ]

    render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
      />
    )

    const titulo = screen.getByText("Mercado Bom Preço")
    expect(titulo).toBeInTheDocument()
    expect(titulo).toHaveAttribute("title", "Mercado Bom Preço")
  })

  it("razão social só com espaços: conta como ausente, aparece pelo Nome Fantasia", () => {
    const clientes = [
      buildCliente({ razaoSocial: "   ", nomeFantasia: "Mercado Bom Preço" }),
    ]

    render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
      />
    )

    expect(screen.getByText("Mercado Bom Preço")).toBeInTheDocument()
  })

  it("razão social e Nome Fantasia ausentes: aparece o rótulo único de ausência", () => {
    const clientes = [buildCliente({ razaoSocial: null, nomeFantasia: null })]

    render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={false}
        onOpenCliente={vi.fn()}
      />
    )

    expect(screen.getByText(ROTULO_SEM_NOME)).toBeInTheDocument()
  })

  it("D-03: com showResponsavel, o nome do vendedor aparece junto do nome do cliente, no mesmo botão da linha", () => {
    const clientes = [
      buildCliente({
        razaoSocial: null,
        nomeFantasia: "Mercado Bom Preço",
        responsavelNome: "Ana",
      }),
    ]

    render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={true}
        onOpenCliente={vi.fn()}
      />
    )

    const linha = within(screen.getByRole("button"))
    expect(linha.getByText("Mercado Bom Preço")).toBeInTheDocument()
    expect(linha.getByText("Ana")).toBeInTheDocument()
  })

  it("clicar na linha identificada pelo Nome Fantasia chama onOpenCliente com o clienteId daquela linha", () => {
    const onOpenCliente = vi.fn()
    const clientes = [
      buildCliente({
        clienteId: "cliente-nf-1",
        razaoSocial: null,
        nomeFantasia: "Mercado Bom Preço",
      }),
    ]

    render(
      <AgendaSemDiaFixo
        clientes={clientes}
        showResponsavel={false}
        onOpenCliente={onOpenCliente}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: /Mercado Bom Preço/ })
    )

    expect(onOpenCliente).toHaveBeenCalledWith("cliente-nf-1")
  })
})
