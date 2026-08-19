// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import {
  CIDADE_AUSENTE,
  ESTADO_AUSENTE,
  FiltersPopover,
  FILTROS_VAZIOS,
  clienteAtendeFiltros,
  contarFiltrosAtivos,
  type ClienteFiltros,
} from "@/components/clientes/FiltersPopover"
import { ROTULO_SEM_ESTADO } from "@/lib/clientes/rotuloLocalizacao"
import { RPC_CIDADES_COM_CLIENTES } from "@/lib/clientes/cidadesComClientes"

/**
 * Contract test for FiltersPopover (09-04, extended 260806-h8a) — proves the
 * two real bugs RESEARCH.md found are fixed plus the cascade behavior:
 *  - LOC-03: Estado renders BEFORE Cidade in DOM order (today it's backwards).
 *  - D-02/LOC-02: Cidade is disabled until an Estado is chosen (cascade).
 *  - Pitfall 4: clienteAtendeFiltros compares Cidade by exact value
 *    (case-insensitive), not substring ("Santos" must not match
 *    "Santos do Sul").
 *  - 260806-h8a D-03: Cidade is fed by buscarCidadesComClientes (the new
 *    system-wide, cliente-backed RPC), never the old IBGE seed-table RPC.
 *
 * Mocks `@/lib/supabase/client` because the Cidade Combobox now calls
 * buscarCidadesComClientes(draft.estado), which itself calls .rpc(...), once
 * an Estado is picked — the mock lets the component mount without a real
 * Supabase env/session.
 *
 * vi.mock is hoisted above imports, so the spy is declared via vi.hoisted()
 * to be available inside the mock factory below.
 */
const { rpcSpy } = vi.hoisted(() => ({
  rpcSpy: vi.fn().mockResolvedValue({
    data: [{ nome: "Santos" }, { nome: "São Paulo" }],
    error: null,
  }),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: rpcSpy }),
}))

function renderPopover(filtros: ClienteFiltros = FILTROS_VAZIOS) {
  return render(
    <FiltersPopover
      filtros={filtros}
      onApply={() => {}}
      onClear={() => {}}
      categoriaOptions={[]}
      produtoOptions={[]}
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

  it("busca cidades pela RPC nova (cidades_com_clientes_por_estado), não a antiga do IBGE (260806-h8a D-03)", async () => {
    rpcSpy.mockClear()
    renderPopover({ ...FILTROS_VAZIOS, estado: "SP" })
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }))

    await waitFor(() => {
      expect(rpcSpy).toHaveBeenCalledWith(RPC_CIDADES_COM_CLIENTES, {
        p_uf: "SP",
      })
    })
  })
})

describe("FiltersPopover - opções de ausência (D-03, quick task 260819-m8q)", () => {
  it("renderiza a opção 'Sem estado' no campo de Estado", async () => {
    renderPopover()
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }))
    fireEvent.click(screen.getByRole("combobox", { name: /estado/i }))

    expect(
      await screen.findByRole("option", { name: ROTULO_SEM_ESTADO })
    ).toBeInTheDocument()
  })

  it("não chama a RPC de cidades quando o Estado do rascunho é a sentinela de ausência (T-M8Q-05)", async () => {
    rpcSpy.mockClear()
    renderPopover({ ...FILTROS_VAZIOS, estado: ESTADO_AUSENTE })
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }))

    // Give any pending microtask a chance to run before asserting absence.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(rpcSpy).not.toHaveBeenCalled()
  })
})

describe("clienteAtendeFiltros - ausência de cidade/estado (D-03, quick task 260819-m8q)", () => {
  const base = {
    categoria_id: null,
    produtos: [] as { id: string; nome: string }[],
    responsavel: "vendedor-1",
  }

  it("com o filtro de estado na sentinela de ausência, casa só cliente sem estado", () => {
    const filtros: ClienteFiltros = { ...FILTROS_VAZIOS, estado: ESTADO_AUSENTE }

    expect(
      clienteAtendeFiltros({ ...base, cidade: "Santos", estado: null }, filtros)
    ).toBe(true)
    expect(
      clienteAtendeFiltros({ ...base, cidade: "Santos", estado: "SP" }, filtros)
    ).toBe(false)
  })

  it("com o filtro de cidade na sentinela de ausência, casa só cliente sem cidade", () => {
    const filtros: ClienteFiltros = { ...FILTROS_VAZIOS, cidade: CIDADE_AUSENTE }

    expect(
      clienteAtendeFiltros({ ...base, cidade: null, estado: "SP" }, filtros)
    ).toBe(true)
    expect(
      clienteAtendeFiltros({ ...base, cidade: "Santos", estado: "SP" }, filtros)
    ).toBe(false)
  })

  it("sem filtro nenhum, um cliente sem cidade/estado passa (D-03)", () => {
    expect(
      clienteAtendeFiltros(
        { ...base, cidade: null, estado: null },
        FILTROS_VAZIOS
      )
    ).toBe(true)
  })

  it("contarFiltrosAtivos conta a sentinela de ausência como filtro ativo", () => {
    expect(
      contarFiltrosAtivos({ ...FILTROS_VAZIOS, estado: ESTADO_AUSENTE })
    ).toBe(1)
    expect(
      contarFiltrosAtivos({ ...FILTROS_VAZIOS, cidade: CIDADE_AUSENTE })
    ).toBe(1)
  })
})
