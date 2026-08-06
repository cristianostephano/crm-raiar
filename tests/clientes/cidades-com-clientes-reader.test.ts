import { describe, expect, it, vi } from "vitest"

/**
 * Unit test for buscarCidadesComClientes (quick task 260806-h8a) — no
 * database, mocks @/lib/supabase/client entirely.
 *
 * vi.mock is hoisted above imports, so a spy declared with `const` at
 * module scope would not be initialized yet when the mock factory runs.
 * vi.hoisted() runs its callback in that same hoisted position, giving the
 * factory (and the test body below) a shared reference.
 */
const { rpcSpy } = vi.hoisted(() => ({ rpcSpy: vi.fn() }))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: rpcSpy }),
}))

import {
  RPC_CIDADES_COM_CLIENTES,
  buscarCidadesComClientes,
} from "@/lib/clientes/cidadesComClientes"

describe("buscarCidadesComClientes (260806-h8a)", () => {
  it("chama a RPC nomeada por RPC_CIDADES_COM_CLIENTES com { p_uf: uf }", async () => {
    rpcSpy.mockResolvedValueOnce({ data: [], error: null })

    await buscarCidadesComClientes("SP")

    expect(rpcSpy).toHaveBeenCalledWith(RPC_CIDADES_COM_CLIENTES, {
      p_uf: "SP",
    })
  })

  it("mapeia [{ nome }] para string[]", async () => {
    rpcSpy.mockResolvedValueOnce({
      data: [{ nome: "Santos" }, { nome: "Campinas" }],
      error: null,
    })

    const resultado = await buscarCidadesComClientes("SP")

    expect(resultado).toEqual(["Santos", "Campinas"])
  })

  it("devolve [] quando data é null, nunca lança nem devolve null", async () => {
    rpcSpy.mockResolvedValueOnce({ data: null, error: null })

    const resultado = await buscarCidadesComClientes("TO")

    expect(resultado).toEqual([])
  })
})
