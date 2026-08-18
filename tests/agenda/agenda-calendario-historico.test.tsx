// @vitest-environment jsdom
import { addMonths } from "date-fns"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AgendaCalendario } from "@/components/agenda/AgendaCalendario"
import { intervaloDeHistorico, type AgendaItem } from "@/lib/agenda/itens"

// Molde de tests/agenda/agenda-list.test.tsx: substitui o módulo de ações
// da agenda por um dublê declarando só a função nova que este arquivo
// exercita — este arquivo importa AgendaCalendario diretamente, nunca
// AgendaList.
vi.mock("@/app/actions/agenda", () => ({
  getAgendaConcluidosAction: vi.fn(),
}))

import { getAgendaConcluidosAction } from "@/app/actions/agenda"

const mockedAction = vi.mocked(getAgendaConcluidosAction)

// Sexta-feira 2026-08-14 — mesmo dia de referência usado nos demais testes
// do calendário (planos 20-02/20-03/21-03), fixado explicitamente.
const NOW = new Date("2026-08-14T10:00:00")

function buildItem(partial: Partial<AgendaItem> = {}): AgendaItem {
  return {
    origem: "prospeccao",
    itemId: "item-1",
    clienteId: "cliente-1",
    razaoSocial: "Padaria Raiar Ltda",
    responsavel: "vendedor-1",
    responsavelNome: "Fulano de Tal",
    titulo: "Visitar",
    data: "2026-08-14",
    frequenciaVisita: null,
    proximaDataSugerida: null,
    ...partial,
  }
}

function renderCalendario(
  props: Partial<ComponentProps<typeof AgendaCalendario>> = {}
) {
  return render(
    <AgendaCalendario
      visao="mes"
      onVisaoChange={vi.fn()}
      itens={[]}
      showResponsavel={false}
      vendedorFiltroId={null}
      onOpenCliente={vi.fn()}
      onConcluirItem={vi.fn()}
      now={NOW}
      {...props}
    />
  )
}

describe("AgendaCalendario — histórico do período visível (AGD-13, Fase 21)", () => {
  beforeEach(() => {
    mockedAction.mockReset()
    mockedAction.mockResolvedValue({ data: [] })
  })

  it("visão Lista: nenhuma busca de histórico acontece", async () => {
    renderCalendario({ visao: "lista" })

    await Promise.resolve()
    expect(mockedAction).not.toHaveBeenCalled()
  })

  it("hoje: nada estritamente passado visível, nenhuma busca", async () => {
    renderCalendario({ visao: "dia" }) // referência = NOW = hoje

    await Promise.resolve()
    expect(mockedAction).not.toHaveBeenCalled()
  })

  it("amanhã: nenhuma busca", async () => {
    renderCalendario({ visao: "dia" })
    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))

    await Promise.resolve()
    expect(mockedAction).not.toHaveBeenCalled()
  })

  it("uma semana futura: nenhuma busca nova além da do período inicial (a semana em curso contém dias antes de hoje)", async () => {
    renderCalendario({ visao: "semana" })
    // A semana em curso (10-16 de agosto) contém dias antes de hoje —
    // dispara a busca do período inicial, provada no caso acima.
    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))

    // A semana seguinte (17-23) é inteiramente futura: nenhuma busca nova.
    await Promise.resolve()
    expect(mockedAction).toHaveBeenCalledTimes(1)
  })

  it("um mês futuro: nenhuma busca nova além da do período inicial (o mês em curso contém dias antes de hoje)", async () => {
    renderCalendario({ visao: "mes" })
    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))

    // Setembro de 2026 é inteiramente futuro: nenhuma busca nova.
    await Promise.resolve()
    expect(mockedAction).toHaveBeenCalledTimes(1)
  })

  it("um mês passado (o mês em curso, que contém dias antes de hoje) dispara exatamente uma busca, com o intervalo exato", async () => {
    renderCalendario({ visao: "mes" })

    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(1))
    const esperado = intervaloDeHistorico(NOW, "mes", NOW)
    expect(esperado).not.toBeNull()
    expect(mockedAction).toHaveBeenCalledWith(esperado?.inicio, esperado?.fim)
  })

  it("navegar para outro período dispara exatamente uma busca nova, com o intervalo novo", async () => {
    renderCalendario({ visao: "mes" })
    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole("button", { name: "Período anterior" }))

    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(2))
    const referenciaAnterior = addMonths(NOW, -1)
    const esperado = intervaloDeHistorico(referenciaAnterior, "mes", NOW)
    expect(esperado).not.toBeNull()
    expect(mockedAction).toHaveBeenNthCalledWith(
      2,
      esperado?.inicio,
      esperado?.fim
    )
  })

  it("re-render sem mudança de período não dispara busca nova (dependências são texto, não objeto)", async () => {
    const { rerender } = renderCalendario({ visao: "mes" })
    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(1))

    rerender(
      <AgendaCalendario
        visao="mes"
        onVisaoChange={vi.fn()}
        itens={[]}
        showResponsavel
        vendedorFiltroId={null}
        onOpenCliente={vi.fn()}
        onConcluirItem={vi.fn()}
        now={NOW}
      />
    )

    await Promise.resolve()
    expect(mockedAction).toHaveBeenCalledTimes(1)
  })

  it("os itens concluídos recebidos aparecem na grade no dia da conclusão", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({
          itemId: "concluido-1",
          razaoSocial: "Padaria Concluída",
          data: "2026-08-05",
          concluido: true,
        }),
      ],
    })

    renderCalendario({ visao: "mes" })

    expect(await screen.findByText("Padaria Concluída")).toBeInTheDocument()
  })

  it("trocar o vendedor filtrado estreita também os concluídos", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({
          itemId: "concluido-alice",
          responsavel: "v-alice",
          responsavelNome: "Alice",
          razaoSocial: "Padaria da Alice",
          data: "2026-08-05",
          concluido: true,
        }),
        buildItem({
          itemId: "concluido-bruno",
          responsavel: "v-bruno",
          responsavelNome: "Bruno",
          razaoSocial: "Mercado do Bruno",
          data: "2026-08-06",
          concluido: true,
        }),
      ],
    })

    const { rerender } = renderCalendario({ visao: "mes", vendedorFiltroId: null })

    expect(await screen.findByText("Padaria da Alice")).toBeInTheDocument()
    expect(screen.getByText("Mercado do Bruno")).toBeInTheDocument()

    // MESMA instância, só o filtro muda — sem exigir uma segunda busca, já
    // que o filtro é aplicado localmente sobre o histórico já recebido.
    rerender(
      <AgendaCalendario
        visao="mes"
        onVisaoChange={vi.fn()}
        itens={[]}
        showResponsavel={false}
        vendedorFiltroId="v-alice"
        onOpenCliente={vi.fn()}
        onConcluirItem={vi.fn()}
        now={NOW}
      />
    )

    expect(screen.getByText("Padaria da Alice")).toBeInTheDocument()
    expect(screen.queryByText("Mercado do Bruno")).not.toBeInTheDocument()
    expect(mockedAction).toHaveBeenCalledTimes(1)
  })

  it("uma resposta de erro mantém os pendentes visíveis e mostra o aviso", async () => {
    mockedAction.mockResolvedValueOnce({
      error: { code: "fetch_falhou", message: "erro qualquer" },
    })

    const pendente = buildItem({
      razaoSocial: "Padaria Pendente",
      data: "2026-08-14",
    })
    renderCalendario({ visao: "mes", itens: [pendente] })

    expect(
      await screen.findByText(
        "Não foi possível carregar o histórico deste período."
      )
    ).toBeInTheDocument()
    expect(screen.getByText("Padaria Pendente")).toBeInTheDocument()
  })

  it("sair de um período com histórico para um período sem histórico limpa os concluídos anteriores", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildItem({
          itemId: "concluido-1",
          razaoSocial: "Padaria Concluída",
          data: "2026-08-05",
          concluido: true,
        }),
      ],
    })

    renderCalendario({ visao: "mes" })
    expect(await screen.findByText("Padaria Concluída")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))
    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))
    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }))

    await waitFor(() =>
      expect(screen.queryByText("Padaria Concluída")).not.toBeInTheDocument()
    )
  })
})
