import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Quick 261008-rxw (D-17, P-15, P-18): updateCliente grava clientes.ganho_em
 * SO quando ganhoEm vem presente no envio ("" vira nulo), recusa data futura
 * ou invalida (mesma regra do navegador) e, no servidor, so aceita a data
 * quando o status ATUAL do cliente e ganho - lido pelo cliente Supabase da
 * propria sessao (sob a RLS). Envio sem ganhoEm nao faz a leitura extra de
 * status, entao a cadeia de chamadas dos testes ja existentes nao muda.
 *
 * Dubles: "@/lib/supabase/server" (cadeias por tabela), "@/lib/aderencia/
 * registroDiario" e "next/cache". Nenhum banco. "Amanha" e "hoje" saem de
 * hojeEmSaoPaulo, nunca de literais que envelhecam.
 */

type Resposta = { data: unknown; error: unknown }

const { updateSpy, statusLeituraSpy, estado } = vi.hoisted(() => ({
  updateSpy: vi.fn(),
  statusLeituraSpy: vi.fn(),
  estado: {
    /** Resposta da leitura de status: { status } ou null (sem linha). */
    statusAtual: { status: "ganho" } as { status: string } | null,
  },
}))

function construtorClientes() {
  let modo: "leitura" | "update" = "leitura"
  const resposta = (): Promise<Resposta> => {
    if (modo === "update") return Promise.resolve({ data: { id: "c1" }, error: null })
    statusLeituraSpy()
    return Promise.resolve({
      data: estado.statusAtual ? { status_acompanhamento: estado.statusAtual.status } : null,
      error: null,
    })
  }
  const construtor = {
    select: () => construtor,
    eq: () => construtor,
    update: (valores: unknown) => {
      modo = "update"
      updateSpy(valores)
      return construtor
    },
    single: resposta,
    maybeSingle: resposta,
  }
  return construtor
}

function construtorGenerico(resposta: Resposta) {
  const construtor = {
    select: () => construtor,
    eq: () => construtor,
    delete: () => construtor,
    insert: () => construtor,
    single: () => Promise.resolve(resposta),
    maybeSingle: () => Promise.resolve(resposta),
    then: (
      onfulfilled?: ((value: Resposta) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null
    ) => Promise.resolve(resposta).then(onfulfilled, onrejected),
  }
  return construtor
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

vi.mock("@/lib/aderencia/registroDiario", () => ({
  registrarAcessoDiario: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "vendedor-1" } } }) },
    from: (tabela: string) => {
      if (tabela === "clientes") return construtorClientes()
      if (tabela === "profiles") {
        return construtorGenerico({ data: { role: "vendedor" }, error: null })
      }
      if (tabela === "frequencias_pedido") return construtorGenerico({ data: [], error: null })
      return construtorGenerico({ data: null, error: null })
    },
    rpc: async () => ({ data: [], error: null }),
  }),
}))

import { updateCliente } from "@/app/actions/clientes"
import { hojeEmSaoPaulo } from "@/lib/clientes/dataDoGanho"
import type { UpdateClienteInput } from "@/lib/validations/cliente"

function diaSeguinte(hoje: string): string {
  const [ano, mes, dia] = hoje.split("-").map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().slice(0, 10)
}

function envio(extra: Partial<UpdateClienteInput> = {}): UpdateClienteInput {
  return {
    id: "c1",
    razaoSocial: "Padaria Central Ltda",
    cep: "",
    rua: "",
    numero: "",
    cidade: "",
    estado: "",
    responsavel: "vendedor-1",
    ...extra,
  }
}

describe("updateCliente - Data do ganho (ganho_em)", () => {
  beforeEach(() => {
    updateSpy.mockReset()
    statusLeituraSpy.mockReset()
    estado.statusAtual = { status: "ganho" }
  })

  it("ausente-nao-grava: envio sem ganhoEm nao leva a chave ganho_em", async () => {
    const resultado = await updateCliente(envio())

    expect(resultado.error).toBeUndefined()
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect("ganho_em" in (updateSpy.mock.calls[0][0] as Record<string, unknown>)).toBe(false)
  })

  it("vazio-limpa: ganhoEm vazio grava ganho_em nulo", async () => {
    const resultado = await updateCliente(envio({ ganhoEm: "" }))

    expect(resultado.error).toBeUndefined()
    expect((updateSpy.mock.calls[0][0] as Record<string, unknown>).ganho_em).toBeNull()
  })

  it("data-grava: com o status atual ganho, ganhoEm 2024-05-20 grava ganho_em 2024-05-20", async () => {
    const resultado = await updateCliente(envio({ ganhoEm: "2024-05-20" }))

    expect(resultado.error).toBeUndefined()
    expect((updateSpy.mock.calls[0][0] as Record<string, unknown>).ganho_em).toBe("2024-05-20")
  })

  it("futura-recusa: data de amanha devolve validation e o update nunca e chamado", async () => {
    const resultado = await updateCliente(envio({ ganhoEm: diaSeguinte(hojeEmSaoPaulo()) }))

    expect(resultado.error?.code).toBe("validation")
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it("fora-de-ganho-recusa: status atual em_andamento devolve ganho_em_fora_de_ganho e o update nunca e chamado", async () => {
    estado.statusAtual = { status: "em_andamento" }

    const resultado = await updateCliente(envio({ ganhoEm: "2024-05-20" }))

    expect(resultado.error?.code).toBe("ganho_em_fora_de_ganho")
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it("status-nao-encontrado: sem linha (id inexistente ou fora da RLS) devolve not_found e o update nunca e chamado", async () => {
    estado.statusAtual = null

    const resultado = await updateCliente(envio({ ganhoEm: "2024-05-20" }))

    expect(resultado.error?.code).toBe("not_found")
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it("sem-campo-nao-le-status: envio sem ganhoEm NAO faz a leitura de status", async () => {
    await updateCliente(envio())

    expect(statusLeituraSpy).not.toHaveBeenCalled()
  })
})
