import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Quick task 261006-gvo (D-07) — deleteCliente (app/actions/clientes.ts) não
 * decide papel: só tenta apagar e deixa a policy de DELETE da migration 0050
 * ser a única autoridade. Zero linhas apagadas vira o erro "forbidden"; a ação
 * nunca consulta `profiles`. Molde de dublê de registro-acesso-cliente.test.ts:
 * `vi.hoisted` cria os espiões antes do `vi.mock` içado.
 */

type RespostaTabela = { data: unknown; error: unknown }

interface ConstrutorTabela {
  select: (colunas?: string) => ConstrutorTabela
  eq: (coluna: string, valor: unknown) => ConstrutorTabela
  delete: () => ConstrutorTabela
  maybeSingle: () => Promise<RespostaTabela>
}

const { revalidateSpy, tabelasConsultadas, estado } = vi.hoisted(() => ({
  revalidateSpy: vi.fn(),
  tabelasConsultadas: [] as string[],
  estado: {
    usuario: { id: "vendedor-1" } as { id: string } | null,
    respostaClientes: { data: null, error: null } as {
      data: unknown
      error: unknown
    },
  },
}))

function criarConstrutorTabela(): ConstrutorTabela {
  const construtor: ConstrutorTabela = {
    select: () => construtor,
    eq: () => construtor,
    delete: () => construtor,
    maybeSingle: () => Promise.resolve(estado.respostaClientes),
  }
  return construtor
}

vi.mock("next/cache", () => ({
  revalidatePath: revalidateSpy,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: estado.usuario } }),
    },
    from: (tabela: string) => {
      tabelasConsultadas.push(tabela)
      return criarConstrutorTabela()
    },
  }),
}))

import { deleteCliente } from "@/app/actions/clientes"

describe("apagar-cliente-action: deleteCliente confia só na RLS (D-07)", () => {
  beforeEach(() => {
    revalidateSpy.mockClear()
    tabelasConsultadas.length = 0
    estado.usuario = { id: "vendedor-1" }
    estado.respostaClientes = { data: null, error: null }
  })

  it("zero-linhas-vira-forbidden", async () => {
    const resultado = await deleteCliente("c1")

    expect(resultado.error?.code).toBe("forbidden")
    expect(resultado.data).toBeUndefined()
    expect(revalidateSpy).not.toHaveBeenCalled()
  })

  it("apagou-uma-linha", async () => {
    estado.respostaClientes = { data: { id: "c1" }, error: null }

    const resultado = await deleteCliente("c1")

    expect(resultado.error).toBeUndefined()
    expect(resultado.data?.id).toBe("c1")
    expect(revalidateSpy).toHaveBeenCalledWith("/clientes")
  })

  it("erro-do-banco-vira-generic", async () => {
    estado.respostaClientes = { data: null, error: { message: "falha qualquer" } }

    const resultado = await deleteCliente("c1")

    expect(resultado.error?.code).toBe("generic")
    expect(revalidateSpy).not.toHaveBeenCalled()
  })

  it("sem-sessao", async () => {
    estado.usuario = null

    const resultado = await deleteCliente("c1")

    expect(resultado.error?.code).toBe("unauthenticated")
    expect(tabelasConsultadas).toEqual([])
    expect(revalidateSpy).not.toHaveBeenCalled()
  })

  it("nao-le-perfil", async () => {
    await deleteCliente("c1")
    estado.respostaClientes = { data: { id: "c1" }, error: null }
    await deleteCliente("c1")
    estado.respostaClientes = { data: null, error: { message: "falha" } }
    await deleteCliente("c1")

    expect(tabelasConsultadas.length).toBeGreaterThan(0)
    expect(new Set(tabelasConsultadas)).toEqual(new Set(["clientes"]))
    expect(tabelasConsultadas).not.toContain("profiles")
  })
})
