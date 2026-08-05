// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ComparativoVendedorTable } from "@/components/dashboard/ComparativoVendedorTable"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ComparativoVendedorRow } from "@/lib/supabase/queries/dashboard"

vi.mock("@/app/actions/dashboard", () => ({
  getComparativoVendedorAction: vi.fn(),
}))

import { getComparativoVendedorAction } from "@/app/actions/dashboard"

const mockedAction = vi.mocked(getComparativoVendedorAction)

/** Builds a ComparativoVendedorRow from partial values, defaulting everything
 * else to a "vendedor sem nada ainda" shape (counts at 0, ratio/average null).
 * `responsavel` defaults to a distinct id per call so rows never collide. */
let nextResponsavelId = 0
function buildRow(
  partial: Partial<ComparativoVendedorRow> = {}
): ComparativoVendedorRow {
  nextResponsavelId += 1
  return {
    responsavel: `vendedor-${nextResponsavelId}`,
    responsavelNome: `Vendedor ${nextResponsavelId}`,
    negociosIniciados: 0,
    ganho: 0,
    perdido: 0,
    cicloMedioDias: null,
    taxaConversao: null,
    ...partial,
  }
}

function renderTable() {
  return render(
    <TooltipProvider>
      <ComparativoVendedorTable />
    </TooltipProvider>
  )
}

describe("ComparativoVendedorTable", () => {
  it("preserva a ordem recebida das linhas, sem reordenar no cliente", async () => {
    // Ordem deliberadamente NAO alfabetica e NAO ordenada por nenhuma
    // metrica: prova que o componente renderiza exatamente na ordem
    // recebida, porque a ordenacao e responsabilidade exclusiva do SQL.
    mockedAction.mockResolvedValueOnce({
      data: [
        buildRow({ responsavel: "v-zeta", responsavelNome: "Zeta", negociosIniciados: 1 }),
        buildRow({ responsavel: "v-alfa", responsavelNome: "Alfa", negociosIniciados: 999 }),
        buildRow({ responsavel: "v-meio", responsavelNome: "Meio", negociosIniciados: 5 }),
      ],
    })

    renderTable()

    const table = await screen.findByRole("table")
    const rows = within(table).getAllByRole("row").slice(1) // drop header row
    expect(rows).toHaveLength(3)

    const firstCellTexts = rows.map(
      (row) => within(row).getAllByRole("cell")[0].textContent
    )
    expect(firstCellTexts).toEqual(["Zeta", "Alfa", "Meio"])
  })

  it("formata a taxa de conversao multiplicando a razao por 100", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildRow({ taxaConversao: 0.625 })],
    })

    renderTable()

    const table = await screen.findByRole("table")
    expect(within(table).getByText("62,5%")).toBeInTheDocument()
    // Prova negativa do bug conhecido: sem a multiplicacao por 100 o mesmo
    // valor renderizaria "0,6%".
    expect(within(table).queryByText("0,6%")).not.toBeInTheDocument()
  })

  it("distingue zero real de valor indefinido na mesma linha, sem esconder a linha", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildRow({
          responsavelNome: "Sem Nada Ainda",
          negociosIniciados: 0,
          ganho: 0,
          taxaConversao: null,
          cicloMedioDias: null,
        }),
      ],
    })

    renderTable()

    const table = await screen.findByRole("table")
    const rows = within(table).getAllByRole("row").slice(1)
    expect(rows).toHaveLength(1)

    const cells = within(rows[0]).getAllByRole("cell")
    // Vendedor, Taxa de conversão, Negócios iniciados, Negócios ganhos, Ciclo médio (dias)
    expect(cells[0].textContent).toBe("Sem Nada Ainda")
    expect(cells[1].textContent).toBe("—") // Taxa de conversão
    expect(cells[2].textContent).toBe("0") // Negócios iniciados
    expect(cells[3].textContent).toBe("0") // Negócios ganhos
    expect(cells[4].textContent).toContain("—") // Ciclo médio (dias)

    // As duas colunas de contagem nunca produzem travessão.
    expect(cells[2].textContent).not.toBe("—")
    expect(cells[3].textContent).not.toBe("—")
  })

  it("formata o ciclo medio em dias", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildRow({ cicloMedioDias: 12.5 })],
    })

    renderTable()

    const table = await screen.findByRole("table")
    expect(within(table).getByText("12,5 dias")).toBeInTheDocument()
  })

  it("expoe o rotulo acessivel exato do tooltip de ciclo medio", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildRow()],
    })

    renderTable()

    await screen.findByRole("table")
    expect(
      screen.getByLabelText(
        "Considera só os negócios ganhos — não inclui os negócios perdidos."
      )
    ).toBeInTheDocument()
  })

  it("mostra o estado vazio quando nenhum vendedor ativo e devolvido", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [],
    })

    renderTable()

    expect(
      await screen.findByText("Nenhum vendedor ativo no momento.")
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
