// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { Agenda2CalendarioMes } from "@/components/agenda2/Agenda2CalendarioMes"
import { chaveDoDia } from "@/lib/agenda/itens"
import { agruparPorDataAgenda2, type Agenda2Item } from "@/lib/agenda2/itens"

// Sexta-feira 2026-08-14.
const NOW = new Date(2026, 7, 14, 10, 0)

function buildItem(partial: Partial<Agenda2Item> = {}): Agenda2Item {
  return {
    id: "i1",
    nomeCliente: "Padaria Raiar",
    bairro: "Centro",
    data: "2026-08-14",
    concluido: false,
    atualizadoEm: "2026-08-14T12:00:00.000Z",
    responsavel: "v1",
    responsavelNome: "Ana Souza",
    ...partial,
  }
}

function renderMes(
  itens: Agenda2Item[] = [],
  props: Partial<ComponentProps<typeof Agenda2CalendarioMes>> = {}
) {
  return render(
    <Agenda2CalendarioMes
      referencia={NOW}
      porData={agruparPorDataAgenda2(itens)}
      onSelecionarDia={vi.fn()}
      now={NOW}
      {...props}
    />
  )
}

function celulaDoDia(container: HTMLElement, trecho: string): Element {
  const achada = Array.from(
    container.querySelectorAll('[role="button"]')
  ).find((c) => c.getAttribute("aria-label")?.includes(trecho))
  if (!achada) throw new Error(`célula não encontrada: ${trecho}`)
  return achada
}

describe("Agenda2CalendarioMes", () => {
  it("cabecalho-segunda: 7 rótulos, o primeiro é Seg", () => {
    renderMes()

    const cabecalho = screen.getAllByText(/^(Seg|Ter|Qua|Qui|Sex|Sab|Dom)$/)
    expect(cabecalho).toHaveLength(7)
    expect(cabecalho[0]).toHaveTextContent("Seg")
    expect(cabecalho[6]).toHaveTextContent("Dom")
  })

  it("42-celulas: agosto de 2026 renderiza 42 células clicáveis", () => {
    const { container } = renderMes()

    expect(container.querySelectorAll('[role="button"]')).toHaveLength(42)
  })

  it("rotulo-acessivel: a célula informa o dia e a quantidade de visitas", () => {
    const { container } = renderMes([
      buildItem({ id: "a" }),
      buildItem({ id: "b", nomeCliente: "Outra" }),
      buildItem({ id: "c", nomeCliente: "Uma só", data: "2026-08-18" }),
    ])

    const dois = celulaDoDia(container, "14 de agosto")
    expect(dois.getAttribute("aria-label")).toMatch(/2 visitas$/)
    const um = celulaDoDia(container, "18 de agosto")
    expect(um.getAttribute("aria-label")).toMatch(/1 visita$/)
  })

  it("chip-nome: o chip mostra o nome do cliente", () => {
    renderMes([buildItem({ nomeCliente: "Mercado Bom Preço" })])

    expect(screen.getByText("Mercado Bom Preço")).toBeInTheDocument()
  })

  it("chip-concluido-riscado (D-29): nome riscado, borda verde e sem acento de atraso", () => {
    renderMes([
      buildItem({ nomeCliente: "Feito", data: "2026-08-10", concluido: true }),
    ])

    const nome = screen.getByText("Feito")
    expect(nome).toHaveClass("line-through")
    const chip = nome.closest("div")
    expect(chip).toHaveClass("border-l-emerald-600")
    expect(chip).not.toHaveClass("border-l-destructive")
  })

  it("chip-atrasado: pendente passado é vermelho, pendente futuro é primário", () => {
    renderMes([
      buildItem({ id: "a", nomeCliente: "Atrasada", data: "2026-08-13" }),
      buildItem({ id: "f", nomeCliente: "Futura", data: "2026-08-20" }),
    ])

    expect(screen.getByText("Atrasada").closest("div")).toHaveClass(
      "border-l-destructive"
    )
    expect(screen.getByText("Futura").closest("div")).toHaveClass(
      "border-l-primary"
    )
  })

  it("atrasado-em-celula-vizinha (Pitfall 9): célula esmaecida mantém o acento vermelho", () => {
    const { container } = renderMes([
      buildItem({ nomeCliente: "Borda", data: "2026-07-29" }),
    ])

    const celula = celulaDoDia(container, "29 de julho")
    expect(celula).toHaveClass("bg-muted/30")
    expect(celula.querySelector(".border-l-destructive")).not.toBeNull()
  })

  it("mais-n: 7 itens no mesmo dia mostram 3 chips e +4 mais", () => {
    const itens = Array.from({ length: 7 }, (_, i) =>
      buildItem({ id: `i${i}`, nomeCliente: `Cliente ${i}` })
    )
    renderMes(itens)

    expect(screen.getByText("+4 mais")).toBeInTheDocument()
    for (let i = 0; i < 3; i++) {
      expect(screen.getByText(`Cliente ${i}`)).toBeInTheDocument()
    }
    for (let i = 3; i < 7; i++) {
      expect(screen.queryByText(`Cliente ${i}`)).not.toBeInTheDocument()
    }
  })

  it("responsavel-supervisor: com showResponsavel, 2ª linha cortável com o vendedor, no mesmo chip", () => {
    renderMes([buildItem({ nomeCliente: "Mercado Bom Preço" })], {
      showResponsavel: true,
    })

    const nome = screen.getByText("Mercado Bom Preço")
    const vendedor = screen.getByText("Ana Souza")
    expect(vendedor).toHaveAttribute("data-slot", "agenda2-responsavel")
    expect(vendedor).toHaveClass("truncate")
    expect(
      nome.compareDocumentPosition(vendedor) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(nome.closest("div")).toBe(vendedor.closest("div"))
  })

  it("responsavel-vendedor: sem a prop (padrão) ou com false, o nome do vendedor não aparece", () => {
    const { container, unmount } = renderMes([buildItem()])
    expect(screen.queryByText("Ana Souza")).toBeNull()
    expect(container.querySelector('[data-slot="agenda2-responsavel"]')).toBeNull()
    unmount()

    const segundo = renderMes([buildItem()], { showResponsavel: false })
    expect(screen.queryByText("Ana Souza")).toBeNull()
    expect(
      segundo.container.querySelector('[data-slot="agenda2-responsavel"]')
    ).toBeNull()
  })

  it("responsavel-ausente: nome null, vazio ou só espaços não cria linha nem escreve 'null'", () => {
    const { container } = renderMes(
      [
        buildItem({ id: "a", nomeCliente: "Cliente A", responsavelNome: null }),
        buildItem({ id: "b", nomeCliente: "Cliente B", responsavelNome: "" }),
        buildItem({ id: "c", nomeCliente: "Cliente C", responsavelNome: "   " }),
      ],
      { showResponsavel: true }
    )

    expect(container.querySelectorAll('[data-slot="agenda2-responsavel"]')).toHaveLength(0)
    expect(screen.queryByText("null")).toBeNull()
    for (const texto of ["Cliente A", "Cliente B", "Cliente C"]) {
      expect(screen.getByText(texto)).toBeInTheDocument()
    }
  })

  it("responsavel-mais-n-e-rotulo: continua 3 chips + '+4 mais' e o rótulo da célula não cita o vendedor", () => {
    const itens = Array.from({ length: 7 }, (_, i) =>
      buildItem({ id: `i${i}`, nomeCliente: `Cliente ${i}` })
    )
    const { container } = renderMes(itens, { showResponsavel: true })

    expect(screen.getByText("+4 mais")).toBeInTheDocument()
    expect(
      container.querySelectorAll('[data-slot="agenda2-responsavel"]')
    ).toHaveLength(3)
    const rotulo = celulaDoDia(container, "14 de agosto").getAttribute(
      "aria-label"
    )
    expect(rotulo).toMatch(/7 visitas$/)
    expect(rotulo).not.toContain("Ana Souza")
  })

  it("responsavel-concluido: o chip mantém a borda verde e a linha do vendedor não é riscada", () => {
    renderMes(
      [buildItem({ nomeCliente: "Feito", data: "2026-08-10", concluido: true })],
      { showResponsavel: true }
    )

    expect(screen.getByText("Feito").closest("div")).toHaveClass(
      "border-l-emerald-600"
    )
    expect(screen.getByText("Ana Souza")).not.toHaveClass("line-through")
  })

  it("sem-icone-de-repeticao (D-26): nenhum ícone de repetição nem de origem", () => {
    const { container } = renderMes([
      buildItem({ id: "a" }),
      buildItem({ id: "b", nomeCliente: "Feito", concluido: true }),
    ])

    expect(container.querySelector(".lucide-repeat")).toBeNull()
    expect(container.querySelector(".lucide-clipboard-check")).toBeNull()
  })

  it("clique-e-teclado: a célula abre o dia por clique, Enter e espaço", () => {
    const onSelecionarDia = vi.fn()
    const { container } = renderMes([], { onSelecionarDia })

    const celula = celulaDoDia(container, "14 de agosto")
    fireEvent.click(celula)
    fireEvent.keyDown(celula, { key: "Enter" })
    fireEvent.keyDown(celula, { key: " " })

    expect(onSelecionarDia).toHaveBeenCalledTimes(3)
    for (const chamada of onSelecionarDia.mock.calls) {
      expect(chaveDoDia(chamada[0] as Date)).toBe("2026-08-14")
    }
  })
})
