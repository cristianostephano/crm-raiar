// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ClienteCard, type ClienteCardData } from "@/components/clientes/ClienteCard"
import type { EtapaKey } from "@/lib/funil/etapas"

function buildCliente(overrides: Partial<ClienteCardData> = {}): ClienteCardData {
  return {
    id: "cliente-1",
    razaoSocial: "Padaria Central",
    nomeFantasia: null,
    categoriaNome: "FS",
    responsavelNome: "Fulano",
    etapa: "aguardando_data_reuniao",
    statusAcompanhamento: "em_andamento",
    cidade: "São Paulo",
    estado: "SP",
    telefone: "11999999999",
    taskStatus: "on_time",
    ...overrides,
  }
}

const VOLTAR_LABEL = "Voltar para a etapa anterior"
const AVANCAR_LABEL = "Avançar para a próxima etapa"

describe("ClienteCard — setas de avançar/voltar etapa (D-01, D-02, D-03)", () => {
  it("card numa etapa do meio, com onMoverEtapa: renderiza as duas setas", () => {
    render(
      <ClienteCard
        cliente={buildCliente()}
        showResponsavel={false}
        onMoverEtapa={vi.fn()}
      />
    )

    expect(screen.getByLabelText(VOLTAR_LABEL)).toBeInTheDocument()
    expect(screen.getByLabelText(AVANCAR_LABEL)).toBeInTheDocument()
  })

  it("card em aguardando_contato: só a seta de avançar existe no DOM", () => {
    render(
      <ClienteCard
        cliente={buildCliente({ etapa: "aguardando_contato" })}
        showResponsavel={false}
        onMoverEtapa={vi.fn()}
      />
    )

    expect(screen.queryByLabelText(VOLTAR_LABEL)).not.toBeInTheDocument()
    expect(screen.getByLabelText(AVANCAR_LABEL)).toBeInTheDocument()
  })

  it("card em primeira_venda: só a seta de voltar existe no DOM", () => {
    render(
      <ClienteCard
        cliente={buildCliente({ etapa: "primeira_venda" })}
        showResponsavel={false}
        onMoverEtapa={vi.fn()}
      />
    )

    expect(screen.getByLabelText(VOLTAR_LABEL)).toBeInTheDocument()
    expect(screen.queryByLabelText(AVANCAR_LABEL)).not.toBeInTheDocument()
  })

  it("card sem a prop onMoverEtapa: nenhuma das duas setas é renderizada", () => {
    render(<ClienteCard cliente={buildCliente()} showResponsavel={false} />)

    expect(screen.queryByLabelText(VOLTAR_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(AVANCAR_LABEL)).not.toBeInTheDocument()
  })

  it("clicar em avançar chama onMoverEtapa exatamente uma vez com a etapa seguinte", () => {
    const onMoverEtapa = vi.fn()
    render(
      <ClienteCard
        cliente={buildCliente()}
        showResponsavel={false}
        onMoverEtapa={onMoverEtapa}
      />
    )

    fireEvent.click(screen.getByLabelText(AVANCAR_LABEL))

    expect(onMoverEtapa).toHaveBeenCalledTimes(1)
    expect(onMoverEtapa).toHaveBeenCalledWith<[EtapaKey]>("aguardando_feedback")
  })

  it("clicar em voltar chama onMoverEtapa exatamente uma vez com a etapa anterior", () => {
    const onMoverEtapa = vi.fn()
    render(
      <ClienteCard
        cliente={buildCliente()}
        showResponsavel={false}
        onMoverEtapa={onMoverEtapa}
      />
    )

    fireEvent.click(screen.getByLabelText(VOLTAR_LABEL))

    expect(onMoverEtapa).toHaveBeenCalledTimes(1)
    expect(onMoverEtapa).toHaveBeenCalledWith<[EtapaKey]>("conversa_comprador")
  })

  it("clicar numa seta não chama onOpen (o clique não abre a ficha do cliente)", () => {
    const onOpen = vi.fn()
    const onMoverEtapa = vi.fn()
    render(
      <ClienteCard
        cliente={buildCliente()}
        showResponsavel={false}
        onOpen={onOpen}
        onMoverEtapa={onMoverEtapa}
      />
    )

    fireEvent.click(screen.getByLabelText(AVANCAR_LABEL))
    fireEvent.click(screen.getByLabelText(VOLTAR_LABEL))

    expect(onOpen).not.toHaveBeenCalled()
    expect(onMoverEtapa).toHaveBeenCalledTimes(2)
  })

  it("com movendoEtapa verdadeiro: as duas setas ficam disabled e o clique não chama onMoverEtapa", () => {
    const onMoverEtapa = vi.fn()
    render(
      <ClienteCard
        cliente={buildCliente()}
        showResponsavel={false}
        onMoverEtapa={onMoverEtapa}
        movendoEtapa
      />
    )

    const voltar = screen.getByLabelText(VOLTAR_LABEL)
    const avancar = screen.getByLabelText(AVANCAR_LABEL)

    expect(voltar).toBeDisabled()
    expect(avancar).toBeDisabled()

    fireEvent.click(voltar)
    fireEvent.click(avancar)

    expect(onMoverEtapa).not.toHaveBeenCalled()
  })
})
