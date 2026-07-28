// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { FunilDetalhadoTable } from "@/components/dashboard/FunilDetalhadoTable"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ETAPAS, type EtapaKey } from "@/lib/funil/etapas"
import type { FunilDetalhadoRow } from "@/lib/supabase/queries/dashboard"

vi.mock("@/app/actions/dashboard", () => ({
  getFunilDetalhadoAction: vi.fn(),
}))

import { getFunilDetalhadoAction } from "@/app/actions/dashboard"

const mockedAction = vi.mocked(getFunilDetalhadoAction)

/** Builds a FunilDetalhadoRow from partial values, defaulting everything
 * else to a "nobody ever entered this stage" shape. */
function buildRow(
  etapa: EtapaKey,
  partial: Partial<Omit<FunilDetalhadoRow, "etapa">> = {}
): FunilDetalhadoRow {
  return {
    etapa,
    quantidade: 0,
    avancouCount: 0,
    avancouPct: null,
    perdidosCount: 0,
    perdidosPct: null,
    tempoMedioDias: null,
    gargalo: false,
    ...partial,
  }
}

function renderTable() {
  return render(
    <TooltipProvider>
      <FunilDetalhadoTable />
    </TooltipProvider>
  )
}

describe("FunilDetalhadoTable", () => {
  it("renderiza as 7 etapas na ordem fixa", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildRow(ETAPAS[0].key, { quantidade: 5, tempoMedioDias: 1 }),
        buildRow(ETAPAS[3].key, { quantidade: 2, tempoMedioDias: 2 }),
        // Purposely the largest tempo médio dias lives on the FIRST etapa in
        // the array order, to prove rows are never re-sorted by column value.
        buildRow(ETAPAS[6].key, { quantidade: 1, tempoMedioDias: 999 }),
      ],
    })

    renderTable()

    const table = await screen.findByRole("table")
    const rows = within(table).getAllByRole("row").slice(1) // drop header row
    expect(rows).toHaveLength(7)

    const firstCellTexts = rows.map(
      (row) => within(row).getAllByRole("cell")[0].textContent
    )
    expect(firstCellTexts).toEqual(ETAPAS.map((etapa) => etapa.label))

    // Quantidade column's info affordance: an aria-labeled tooltip trigger,
    // never a second visible line of helper text under the number.
    expect(
      screen.getByLabelText(
        "Total de clientes que já passaram por esta etapa, incluindo os que estão parados nela agora."
      )
    ).toBeInTheDocument()
  })

  it("marca a linha de gargalo com borda e badge", async () => {
    const gargaloEtapa = ETAPAS[2]
    const normalEtapa = ETAPAS[4]

    mockedAction.mockResolvedValueOnce({
      data: [
        buildRow(gargaloEtapa.key, {
          quantidade: 10,
          tempoMedioDias: 30,
          gargalo: true,
        }),
        buildRow(normalEtapa.key, {
          quantidade: 10,
          tempoMedioDias: 2,
          gargalo: false,
        }),
      ],
    })

    renderTable()

    const table = await screen.findByRole("table")
    const rows = within(table).getAllByRole("row").slice(1)

    const gargaloRows = rows.filter(
      (row) =>
        row.className.includes("border-l-4") &&
        row.className.includes("border-l-amber-500")
    )
    expect(gargaloRows).toHaveLength(1)
    expect(within(gargaloRows[0]).getAllByRole("cell")[0].textContent).toBe(
      gargaloEtapa.label
    )
    expect(within(gargaloRows[0]).getByText("Gargalo")).toBeInTheDocument()

    const normalRow = rows.find(
      (row) => within(row).getAllByRole("cell")[0].textContent === normalEtapa.label
    )
    expect(normalRow).toBeDefined()
    expect(normalRow?.className).not.toContain("border-l-amber-500")
    expect(within(normalRow!).queryByText("Gargalo")).not.toBeInTheDocument()
  })

  it("usa travessao para valor nulo", async () => {
    const nullEtapa = ETAPAS[1]

    mockedAction.mockResolvedValueOnce({
      data: [
        buildRow(ETAPAS[0].key, { quantidade: 5, tempoMedioDias: 3 }),
        buildRow(nullEtapa.key, {
          quantidade: 0,
          avancouPct: null,
          perdidosPct: null,
          tempoMedioDias: null,
        }),
      ],
    })

    renderTable()

    const table = await screen.findByRole("table")
    const rows = within(table).getAllByRole("row").slice(1)
    const nullRow = rows.find(
      (row) => within(row).getAllByRole("cell")[0].textContent === nullEtapa.label
    )
    expect(nullRow).toBeDefined()
    const cells = within(nullRow!).getAllByRole("cell")

    expect(cells[2].textContent).toBe("—") // % Avançou
    expect(cells[3].textContent).toBe("—") // Perdidos
    expect(cells[4].textContent).toContain("—") // Tempo médio parado

    expect(within(nullRow!).queryByText("0,0%")).not.toBeInTheDocument()
    expect(within(nullRow!).queryByText("0,0 dias")).not.toBeInTheDocument()
  })

  it("formata perdidos com contagem e taxa", async () => {
    const comPerdaEtapa = ETAPAS[0]
    const semPerdaEtapa = ETAPAS[1]

    mockedAction.mockResolvedValueOnce({
      data: [
        buildRow(comPerdaEtapa.key, {
          quantidade: 24,
          perdidosCount: 3,
          perdidosPct: 12.5,
        }),
        buildRow(semPerdaEtapa.key, {
          quantidade: 10,
          perdidosCount: 0,
          perdidosPct: 0,
        }),
      ],
    })

    renderTable()

    const table = await screen.findByRole("table")
    expect(within(table).getByText("3 (12,5%)")).toBeInTheDocument()

    const rows = within(table).getAllByRole("row").slice(1)
    const semPerdaRow = rows.find(
      (row) =>
        within(row).getAllByRole("cell")[0].textContent === semPerdaEtapa.label
    )
    expect(semPerdaRow).toBeDefined()
    expect(within(semPerdaRow!).getAllByRole("cell")[3].textContent).toBe("0")
  })

  it("mostra o estado vazio quando ninguem passou por nenhuma etapa", async () => {
    mockedAction.mockResolvedValueOnce({
      data: ETAPAS.map((etapa) => buildRow(etapa.key)),
    })

    renderTable()

    expect(
      await screen.findByText("Nenhum cliente cadastrado ainda.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("mostra o estado de erro com botao de nova tentativa", async () => {
    mockedAction.mockResolvedValueOnce({
      error: { code: "fetch_falhou", message: "erro interno qualquer" },
    })

    renderTable()

    expect(
      await screen.findByText(
        "Não foi possível carregar os dados do dashboard. Tente novamente."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Tentar novamente" })
    ).toBeInTheDocument()
  })
})
