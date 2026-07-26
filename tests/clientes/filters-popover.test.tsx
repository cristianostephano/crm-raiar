// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  FiltersPopover,
  FILTROS_VAZIOS,
  clienteAtendeFiltros,
  type ClienteFiltros,
} from "@/components/clientes/FiltersPopover"

/**
 * Contract test for FiltersPopover (09-04) — proves the two real bugs
 * RESEARCH.md found are fixed plus the new cascade behavior:
 *  - LOC-03: Estado renders BEFORE Cidade in DOM order (today it's backwards).
 *  - D-02/LOC-02: Cidade is disabled until an Estado is chosen (cascade).
 *  - Pitfall 4: clienteAtendeFiltros compares Cidade by exact value
 *    (case-insensitive), not substring ("Santos" must not match
 *    "Santos do Sul").
 *
 * Mocks `@/lib/supabase/client` because the Cidade Combobox calls
 * cidades_por_estado(draft.estado) once an Estado is picked — the mock lets
 * the component mount without a real Supabase env/session.
 */
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: vi.fn().mockResolvedValue({
      data: [{ nome: "Santos" }, { nome: "São Paulo" }],
      error: null,
    }),
  }),
}))

function renderPopover(filtros: ClienteFiltros = FILTROS_VAZIOS) {
  return render(
    <FiltersPopover
      filtros={filtros}
      onApply={() => {}}
      onClear={() => {}}
      categoriaOptions={[]}
      produtoOptions={[]}
      // TODO(09-04 Task 2): drop once FiltersPopover stops accepting
      // estadoOptions (replaced by the fixed UFS constant, LOC-01).
      estadoOptions={[]}
      vendedorOptions={[]}
      isSupervisor={false}
    />
  )
}

describe("FiltersPopover - ordem Estado/Cidade, cascade e exact-match (09-04)", () => {
  it("renderiza o bloco de Estado antes do bloco de Cidade (LOC-03)", async () => {
    renderPopover()
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }))

    const estadoLabel = await screen.findByText("Estado")
    const cidadeLabel = await screen.findByText("Cidade")

    // estadoLabel must precede cidadeLabel in DOM order.
    expect(
      estadoLabel.compareDocumentPosition(cidadeLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("mantém Cidade desabilitada até um Estado ser escolhido (D-02)", async () => {
    renderPopover()
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }))

    const cidadeInput = await screen.findByPlaceholderText(
      "Escolha o Estado primeiro"
    )
    expect(cidadeInput).toBeDisabled()
  })

  it("clienteAtendeFiltros compara Cidade por igualdade exata, não substring (Pitfall 4)", () => {
    const base = {
      categoria_id: null,
      produtos: [] as { id: string; nome: string }[],
      estado: "SP",
      responsavel: "vendedor-1",
    }
    const filtros: ClienteFiltros = { ...FILTROS_VAZIOS, cidade: "santos" }

    expect(clienteAtendeFiltros({ ...base, cidade: "Santos" }, filtros)).toBe(
      true
    )
    expect(
      clienteAtendeFiltros({ ...base, cidade: "Santos do Sul" }, filtros)
    ).toBe(false)
  })
})
