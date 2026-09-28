// @vitest-environment jsdom
/**
 * KAN-03 (Fase 27, plano 27-03) — prova de paridade de estrutura e conteúdo
 * entre o card do Kanban sem filtro (ramo com arrastar, DraggableClienteCard)
 * e o card com algum filtro/busca/aba ativo (ramo StaticClienteCard).
 *
 * Por que a BUSCA é usada aqui em vez do filtro de vendedor (FiltersPopover):
 * - hasActiveFilters (KanbanBoard.tsx, linhas 331-332) liga igualmente com
 *   busca, filtro de vendedor ou aba Incompletos;
 * - todos eles levam dragDisabled (linha 334) ao MESMO ramo, StaticClienteCard;
 * - o campo de busca é controlável no jsdom de forma determinística, e o
 *   combobox do FiltersPopover não é.
 *
 * Dados de teste: só nomes/cidades/telefones inventados (LGPD) — nenhum
 * cliente, vendedor ou telefone real aparece neste arquivo.
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/actions/funil", () => ({
  moverCard: vi.fn(),
}))

vi.mock("@/components/clientes/ClienteDetailSheet", () => ({
  ClienteDetailSheet: () => null,
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}))

import { KanbanBoard } from "@/components/clientes/KanbanBoard"
import { rotuloCidadeEstado } from "@/lib/clientes/rotuloLocalizacao"
import { ETAPA_KEYS } from "@/lib/funil/etapas"
import type {
  ClienteListItem,
  ClientesAgrupadosPorEtapa,
} from "@/lib/supabase/queries/clientes"

function buildClienteListItem(
  overrides: Partial<ClienteListItem> = {}
): ClienteListItem {
  return {
    id: "cliente-1",
    razao_social: "Padaria Central",
    nome_fantasia: null,
    categoria_id: "cat-1",
    categoria_nome: "FS",
    responsavel: "vendedor-a",
    responsavel_nome: "Ana Vendedora",
    etapa: "aguardando_data_reuniao",
    status_acompanhamento: "em_andamento",
    cidade: "São Paulo",
    estado: "SP",
    contato: null,
    telefone: "11999999999",
    email: null,
    numero_de_lojas: null,
    produtos: [],
    posicao: 1,
    etapa_alterada_em: new Date().toISOString(),
    tarefas_abertas: [],
    isOverdue: false,
    overdue_tooltip: null,
    incompleto: false,
    ...overrides,
  }
}

function buildGrouped(clientes: ClienteListItem[]): ClientesAgrupadosPorEtapa {
  const grouped = {} as ClientesAgrupadosPorEtapa
  for (const key of ETAPA_KEYS) {
    grouped[key] = []
  }
  grouped.aguardando_data_reuniao = clientes
  return grouped
}

function renderBoard() {
  const grouped = buildGrouped([
    buildClienteListItem(),
    buildClienteListItem({
      id: "cliente-2",
      razao_social: "Mercado Bom Preço",
      responsavel: "vendedor-b",
      responsavel_nome: "Beto Vendedor",
      posicao: 2,
    }),
  ])

  return render(
    <KanbanBoard
      grouped={grouped}
      callerRole="supervisor"
      categoriaOptions={[]}
      produtoOptions={[]}
    />
  )
}

/** Sobe do título (encontrado por `getByTitle`) até o ancestral
 * `[data-slot="card"]` — a mesma raiz que `ClienteCard` marca. */
function cardDe(nome: string): HTMLElement {
  const title = screen.getByTitle(nome)
  const card = title.closest('[data-slot="card"]')
  if (!card) throw new Error(`Card "${nome}" não encontrado`)
  return card as HTMLElement
}

function ativarBusca() {
  const campo = screen.getByLabelText("Buscar por razão social")
  fireEvent.change(campo, { target: { value: "Padaria" } })
}

describe("KAN-03 — paridade entre card sem filtro e card filtrado", () => {
  it("Caso 1 (sem filtro, ramo com arrastar): o card nunca é filho direto da coluna de rolagem", () => {
    renderBoard()

    const card = cardDe("Padaria Central")
    const pai = card.parentElement
    const avo = pai?.parentElement

    expect(pai).not.toBeNull()
    expect(pai?.className).not.toContain("overflow-y-auto")
    expect(avo?.className).toContain("overflow-y-auto")
  })

  it("Caso 2 (busca ativa, mesmo ramo dragDisabled que o filtro de vendedor liga): o card também não é filho direto da coluna de rolagem", () => {
    renderBoard()

    ativarBusca()

    const card = cardDe("Padaria Central")
    const pai = card.parentElement
    const avo = pai?.parentElement

    expect(pai).not.toBeNull()
    expect(pai?.className).not.toContain("overflow-y-auto")
    expect(avo?.className).toContain("overflow-y-auto")
  })

  it("Caso 3 (mesmo conteúdo): o card tem o mesmo texto, as mesmas classes e os mesmos rótulos antes e depois da busca", () => {
    renderBoard()

    const cardAntes = cardDe("Padaria Central")
    const textoAntes = cardAntes.textContent
    const classesAntes = Array.from(cardAntes.classList)
    const ariaLabelsAntes = Array.from(
      cardAntes.querySelectorAll("[aria-label]")
    ).map((el) => el.getAttribute("aria-label"))

    ativarBusca()

    const cardDepois = cardDe("Padaria Central")
    const textoDepois = cardDepois.textContent
    const classesDepois = Array.from(cardDepois.classList)
    const ariaLabelsDepois = Array.from(
      cardDepois.querySelectorAll("[aria-label]")
    ).map((el) => el.getAttribute("aria-label"))

    expect(textoDepois).toBe(textoAntes)
    expect(classesDepois).toEqual(classesAntes)
    expect(ariaLabelsDepois).toEqual(ariaLabelsAntes)

    expect(cardDepois.textContent).toContain("FS")
    expect(cardDepois.textContent).toContain("Ana Vendedora")
    expect(cardDepois.textContent).toContain(
      rotuloCidadeEstado("São Paulo", "SP")
    )
    expect(
      cardDepois.querySelector('[aria-label="Voltar para a etapa anterior"]')
    ).not.toBeNull()
    expect(
      cardDepois.querySelector('[aria-label="Avançar para a próxima etapa"]')
    ).not.toBeNull()
  })

  it("Caso 4 (arrastar continua desligado com filtro): o card perde aria-roledescription depois da busca", () => {
    renderBoard()

    const cardAntes = cardDe("Padaria Central")
    expect(cardAntes.hasAttribute("aria-roledescription")).toBe(true)

    ativarBusca()

    const cardDepois = cardDe("Padaria Central")
    expect(cardDepois.hasAttribute("aria-roledescription")).toBe(false)
  })
})
