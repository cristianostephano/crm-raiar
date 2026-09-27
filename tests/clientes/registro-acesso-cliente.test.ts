import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Fase 30, Plano 04 (D-02/D-05) — createCliente, updateCliente e
 * atualizarFrequenciaVisita (app/actions/clientes.ts) registram o dia de uso
 * depois de uma gravação bem-sucedida, pela mesma RPC do acesso diário
 * (registrar_acesso_diario, migration 0038, plano 30-01). Molde de dublê de
 * tests/funil/reativar-guard.test.ts: `vi.hoisted` cria os espiões antes do
 * `vi.mock` içado; espiões limpos no `beforeEach`.
 *
 * `from(tabela)` devolve um construtor encadeável cujo `single`/`maybeSingle`
 * e o próprio `await` resolvem para a resposta configurada daquela tabela em
 * `estado.respostas`; `rpc(nome, args)` delega a um espião que responde por
 * nome — "cidades_por_estado" devolve uma cidade válida e
 * "registrar_acesso_diario" devolve `{ error: null }` por padrão.
 */

type RespostaTabela = { data: unknown; error: unknown }

interface ConstrutorTabela {
  select: (colunas?: string) => ConstrutorTabela
  eq: (coluna: string, valor: unknown) => ConstrutorTabela
  insert: (valores: unknown) => ConstrutorTabela
  update: (valores: unknown) => ConstrutorTabela
  delete: () => ConstrutorTabela
  single: () => Promise<RespostaTabela>
  maybeSingle: () => Promise<RespostaTabela>
  then: <TResult1 = RespostaTabela, TResult2 = never>(
    onfulfilled?:
      | ((value: RespostaTabela) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => PromiseLike<TResult1 | TResult2>
}

const {
  rpcSpy,
  revalidateSpy,
  clientesInsertSpy,
  clientesUpdateSpy,
  estado,
} = vi.hoisted(() => ({
  rpcSpy: vi.fn(),
  revalidateSpy: vi.fn(),
  clientesInsertSpy: vi.fn(),
  clientesUpdateSpy: vi.fn(),
  estado: {
    respostas: {} as Record<string, RespostaTabela>,
    rpcRespostas: {} as Record<string, { data?: unknown; error: unknown }>,
    rpcExcecoes: {} as Record<string, Error>,
  },
}))

function criarConstrutorTabela(nomeTabela: string): ConstrutorTabela {
  const resposta = (): Promise<RespostaTabela> =>
    Promise.resolve(estado.respostas[nomeTabela] ?? { data: null, error: null })

  const construtor: ConstrutorTabela = {
    select: () => construtor,
    eq: () => construtor,
    insert: (valores) => {
      if (nomeTabela === "clientes") clientesInsertSpy(valores)
      return construtor
    },
    update: (valores) => {
      if (nomeTabela === "clientes") clientesUpdateSpy(valores)
      return construtor
    },
    delete: () => construtor,
    single: () => resposta(),
    maybeSingle: () => resposta(),
    then: (onfulfilled, onrejected) => resposta().then(onfulfilled, onrejected),
  }

  return construtor
}

vi.mock("next/cache", () => ({
  revalidatePath: revalidateSpy,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "vendedor-1" } } }),
    },
    from: (tabela: string) => criarConstrutorTabela(tabela),
    rpc: (nome: string, args?: unknown) => {
      rpcSpy(nome, args)

      if (estado.rpcExcecoes[nome]) {
        return Promise.reject(estado.rpcExcecoes[nome])
      }

      if (estado.rpcRespostas[nome]) {
        return Promise.resolve(estado.rpcRespostas[nome])
      }

      if (nome === "cidades_por_estado") {
        return Promise.resolve({ data: [{ nome: "São Paulo" }], error: null })
      }

      if (nome === "registrar_acesso_diario") {
        return Promise.resolve({ error: null })
      }

      return Promise.resolve({ data: null, error: null })
    },
  }),
}))

import { createCliente, updateCliente, atualizarFrequenciaVisita } from "@/app/actions/clientes"

/** Índice de invocação (para checar ordem) da primeira chamada de rpc(nome). */
function ordemChamadaRpc(nome: string): number {
  const indice = rpcSpy.mock.calls.findIndex((chamada) => chamada[0] === nome)
  if (indice === -1) throw new Error(`rpc "${nome}" não foi chamada`)
  return rpcSpy.mock.invocationCallOrder[indice]
}

function chamadasRegistrar(): number {
  return rpcSpy.mock.calls.filter(
    (chamada) => chamada[0] === "registrar_acesso_diario"
  ).length
}

beforeEach(() => {
  rpcSpy.mockReset()
  revalidateSpy.mockReset()
  clientesInsertSpy.mockReset()
  clientesUpdateSpy.mockReset()
  estado.respostas = {}
  estado.rpcRespostas = {}
  estado.rpcExcecoes = {}
})

describe("createCliente registra o dia de uso após o cadastro (D-02)", () => {
  const entradaValida = {
    razaoSocial: "Cliente Teste Cadastro",
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: "vendedor-1",
  }

  it("cadastro-registra: insert bem-sucedido devolve {data:{id}} e registra o dia uma vez, depois do insert", async () => {
    estado.respostas["clientes"] = { data: { id: "cliente-1" }, error: null }

    const resultado = await createCliente(entradaValida)

    expect(resultado).toEqual({ data: { id: "cliente-1" } })
    expect(chamadasRegistrar()).toBe(1)
    expect(clientesInsertSpy.mock.invocationCallOrder[0]).toBeLessThan(
      ordemChamadaRpc("registrar_acesso_diario")
    )
  })

  it("cadastro-falho-nao-registra: insert com 23505 devolve duplicate_razao_social e não registra", async () => {
    estado.respostas["clientes"] = {
      data: null,
      error: { code: "23505", message: "duplicado" },
    }

    const resultado = await createCliente(entradaValida)

    expect(resultado).toEqual({ error: { code: "duplicate_razao_social" } })
    expect(chamadasRegistrar()).toBe(0)
  })

  it("registro-falho-nao-muda-resultado: RPC de registro rejeitando não muda o sucesso do cadastro", async () => {
    estado.respostas["clientes"] = { data: { id: "cliente-2" }, error: null }
    estado.rpcExcecoes["registrar_acesso_diario"] = new Error("falha de rede")

    const resultado = await createCliente(entradaValida)

    expect(resultado).toEqual({ data: { id: "cliente-2" } })
  })
})

describe("updateCliente registra o dia de uso após a edição (D-02)", () => {
  const entradaEdicaoValida = {
    id: "cliente-1",
    razaoSocial: "Cliente Editado",
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "",
    estado: "",
    responsavel: "vendedor-1",
  }

  it("edicao-registra: update bem-sucedido devolve {data:{id}} e registra o dia uma vez", async () => {
    estado.respostas["clientes"] = { data: { id: "cliente-1" }, error: null }
    estado.respostas["cliente_produtos"] = { data: null, error: null }

    const resultado = await updateCliente(entradaEdicaoValida)

    expect(resultado).toEqual({ data: { id: "cliente-1" } })
    expect(chamadasRegistrar()).toBe(1)
    expect(clientesUpdateSpy.mock.invocationCallOrder[0]).toBeLessThan(
      ordemChamadaRpc("registrar_acesso_diario")
    )
  })

  it("edicao-nao-encontrada-nao-registra: update sem linha afetada devolve not_found e não registra", async () => {
    estado.respostas["clientes"] = { data: null, error: null }

    const resultado = await updateCliente(entradaEdicaoValida)

    expect(resultado).toEqual({ error: { code: "not_found" } })
    expect(chamadasRegistrar()).toBe(0)
  })
})

describe("atualizarFrequenciaVisita registra o dia de uso após salvar (D-02)", () => {
  it("frequencia-registra: update bem-sucedido devolve {data:{id}} e registra o dia uma vez", async () => {
    estado.respostas["clientes"] = { data: { id: "c1" }, error: null }

    const resultado = await atualizarFrequenciaVisita("c1", "semanal")

    expect(resultado).toEqual({ data: { id: "c1" } })
    expect(chamadasRegistrar()).toBe(1)
  })
})
