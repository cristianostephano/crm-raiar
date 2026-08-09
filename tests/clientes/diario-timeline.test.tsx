// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DiarioTimeline } from "@/components/clientes/DiarioTimeline"
import type { DiarioEntry } from "@/lib/supabase/queries/clientes"

function buildEntry(partial: Partial<DiarioEntry> = {}): DiarioEntry {
  return {
    id: "entry-1",
    tipo: "tarefa_concluida",
    descricao: "Ligou para confirmar pedido",
    criadoEm: "2026-01-15T14:30:00",
    autorNome: "Fulano de Tal",
    ...partial,
  }
}

describe("DiarioTimeline", () => {
  it("vazio: lista vazia renderiza a copy exata do estado vazio e nenhum item de lista", () => {
    const { container } = render(<DiarioTimeline entries={[]} />)

    expect(
      screen.getByText("Nenhuma visita ou tarefa concluída ainda.")
    ).toBeInTheDocument()
    expect(container.querySelectorAll("li")).toHaveLength(0)
  })

  it("prospeccao: uma entrada de tarefa concluída renderiza o rótulo Prospecção", () => {
    render(
      <DiarioTimeline
        entries={[buildEntry({ tipo: "tarefa_concluida" })]}
      />
    )

    expect(screen.getByText("Prospecção")).toBeInTheDocument()
  })

  it("visita: uma entrada de visita concluída renderiza o rótulo Visita", () => {
    render(
      <DiarioTimeline entries={[buildEntry({ tipo: "visita_concluida" })]} />
    )

    expect(screen.getByText("Visita")).toBeInTheDocument()
  })

  it("data: a data renderizada corresponde exatamente ao formato do contrato para uma string ISO conhecida", () => {
    render(
      <DiarioTimeline
        entries={[buildEntry({ criadoEm: "2026-01-31T09:05:00" })]}
      />
    )

    expect(screen.getByText("31/01/2026 09:05")).toBeInTheDocument()
  })

  it("resumo: o texto da descrição aparece verbatim, e uma entrada com o texto genérico do caminho antigo aparece do mesmo jeito, sem aviso adicional", () => {
    render(
      <DiarioTimeline
        entries={[
          buildEntry({
            id: "entry-real",
            descricao: "Cliente confirmou pedido para a próxima semana",
          }),
          buildEntry({
            id: "entry-generico",
            descricao: "Tarefa marcada como concluída",
          }),
        ]}
      />
    )

    expect(
      screen.getByText("Cliente confirmou pedido para a próxima semana")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Tarefa marcada como concluída")
    ).toBeInTheDocument()
    expect(screen.queryByText(/resumo faltando/i)).not.toBeInTheDocument()
  })

  it("autor: o nome do autor aparece quando preenchido", () => {
    render(<DiarioTimeline entries={[buildEntry({ autorNome: "Ciclana" })]} />)

    expect(screen.getByText("Ciclana")).toBeInTheDocument()
  })

  it("autornulo: a copy exata Autor não identificado aparece quando o nome do autor vier nulo", () => {
    render(<DiarioTimeline entries={[buildEntry({ autorNome: null })]} />)

    expect(screen.getByText("Autor não identificado")).toBeInTheDocument()
  })

  it("ordem: a ordem renderizada é exatamente a ordem recebida por propriedade", () => {
    const { container } = render(
      <DiarioTimeline
        entries={[
          buildEntry({ id: "primeiro", descricao: "Primeira entrada" }),
          buildEntry({ id: "segundo", descricao: "Segunda entrada" }),
          buildEntry({ id: "terceiro", descricao: "Terceira entrada" }),
        ]}
      />
    )

    const textos = Array.from(container.querySelectorAll("li")).map(
      (li) => li.textContent
    )

    expect(textos[0]).toContain("Primeira entrada")
    expect(textos[1]).toContain("Segunda entrada")
    expect(textos[2]).toContain("Terceira entrada")
  })
})
