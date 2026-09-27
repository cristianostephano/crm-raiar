// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ComparativoVendedorTable } from "@/components/dashboard/ComparativoVendedorTable"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  TEXTO_TOOLTIP_ADERENCIA,
  type ComparativoVendedorLinha,
} from "@/lib/aderencia/exibicao"
import type { AderenciaUsoRow } from "@/lib/supabase/queries/dashboard"

vi.mock("@/app/actions/dashboard", () => ({
  getComparativoVendedorAction: vi.fn(),
}))

import { getComparativoVendedorAction } from "@/app/actions/dashboard"

const mockedAction = vi.mocked(getComparativoVendedorAction)

/** Builds a ComparativoVendedorLinha from partial values, defaulting
 * everything else to a "vendedor sem nada ainda" shape (counts at 0,
 * ratio/average null, aderencia nula — a coluna nova é renderizada pelo
 * plano 30-06, este arquivo só precisa do tipo compilar).
 * `responsavel` defaults to a distinct id per call so rows never collide. */
let nextResponsavelId = 0
function buildRow(
  partial: Partial<ComparativoVendedorLinha> = {}
): ComparativoVendedorLinha {
  nextResponsavelId += 1
  return {
    responsavel: `vendedor-${nextResponsavelId}`,
    responsavelNome: `Vendedor ${nextResponsavelId}`,
    negociosIniciados: 0,
    ganho: 0,
    perdido: 0,
    cicloMedioDias: null,
    taxaConversao: null,
    aderencia: null,
    ...partial,
  }
}

/** Builds an AderenciaUsoRow from partial values for the "Aderência de uso"
 * column cases (plan 30-06) — defaults to a fully-collected, non-zero shape
 * so each test only needs to override the fields it cares about. */
function aderencia(partial: Partial<AderenciaUsoRow> = {}): AderenciaUsoRow {
  return {
    responsavel: "vendedor-aderencia",
    diasUsados: 0,
    diasUteis: 0,
    aderenciaPct: null,
    coletandoDesde: null,
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

  it("coluna-aderencia-cabecalho: o 6º cabeçalho contém 'Aderência de uso' e o rótulo acessível do tooltip existe na tela", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildRow()],
    })

    renderTable()

    const table = await screen.findByRole("table")
    const headers = within(table).getAllByRole("columnheader")
    expect(headers).toHaveLength(6)
    expect(headers[5].textContent).toContain("Aderência de uso")
    expect(screen.getByLabelText(TEXTO_TOOLTIP_ADERENCIA)).toBeInTheDocument()
  })

  it("aderencia-percentual: mostra o percentual com 1 casa e 'N de M dias úteis'", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildRow({
          aderencia: aderencia({
            aderenciaPct: 85,
            diasUsados: 17,
            diasUteis: 20,
            coletandoDesde: null,
          }),
        }),
      ],
    })

    renderTable()

    const table = await screen.findByRole("table")
    const rows = within(table).getAllByRole("row").slice(1)
    const cells = within(rows[0]).getAllByRole("cell")
    expect(cells[5].textContent).toContain("85,0%")
    expect(cells[5].textContent).toContain("17 de 20 dias úteis")
  })

  it("aderencia-coletando: mostra 'Coletando dados desde DD/MM/AAAA' e não mostra percentual", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildRow({
          aderencia: aderencia({
            aderenciaPct: 40,
            diasUsados: 8,
            diasUteis: 20,
            coletandoDesde: "2026-09-27",
          }),
        }),
      ],
    })

    renderTable()

    const table = await screen.findByRole("table")
    const rows = within(table).getAllByRole("row").slice(1)
    const cells = within(rows[0]).getAllByRole("cell")
    expect(cells[5].textContent).toContain("Coletando dados desde 27/09/2026")
    expect(cells[5].textContent).not.toContain("%")
  })

  it("aderencia-nula: aderência nula mostra travessão", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildRow({ aderencia: null })],
    })

    renderTable()

    const table = await screen.findByRole("table")
    const rows = within(table).getAllByRole("row").slice(1)
    const cells = within(rows[0]).getAllByRole("cell")
    expect(cells[5].textContent).toBe("—")
  })

  it("descricao-menciona-28-dias: a descrição do cartão contém 'últimos 28 dias'", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [buildRow()],
    })

    renderTable()

    await screen.findByRole("table")
    expect(screen.getByText(/últimos 28 dias/)).toBeInTheDocument()
  })

  it("colunas-antigas-intactas: com aderência preenchida, as células 0-4 continuam iguais ao caso 'distingue zero real'", async () => {
    mockedAction.mockResolvedValueOnce({
      data: [
        buildRow({
          responsavelNome: "Sem Nada Ainda",
          negociosIniciados: 0,
          ganho: 0,
          taxaConversao: null,
          cicloMedioDias: null,
          aderencia: aderencia({
            aderenciaPct: 85,
            diasUsados: 17,
            diasUteis: 20,
          }),
        }),
      ],
    })

    renderTable()

    const table = await screen.findByRole("table")
    const rows = within(table).getAllByRole("row").slice(1)
    expect(rows).toHaveLength(1)

    const cells = within(rows[0]).getAllByRole("cell")
    expect(cells[0].textContent).toBe("Sem Nada Ainda")
    expect(cells[1].textContent).toBe("—")
    expect(cells[2].textContent).toBe("0")
    expect(cells[3].textContent).toBe("0")
    expect(cells[4].textContent).toContain("—")
  })
})
