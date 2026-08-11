import { describe, expect, it } from "vitest"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { anonClient, serviceClient, signInAs } from "../helpers/supabase-test-clients"
import { ETAPA_FINAL } from "../../lib/funil/etapas"

/**
 * Integration test for the `atualizar_cnpj_lote` RPC (19-01 Task 1/3,
 * IMP-03). Molde literal de tests/importacao/rls-frequencia-lote.test.ts:
 * a chave de serviço é usada SÓ para semear e limpar; toda asserção roda
 * com sessão real do papel sob teste (Pitfall 2/10: um teste negativo com
 * a chave de serviço passaria sempre, já que ela ignora RLS).
 *
 * Prova os must-haves do 19-01-PLAN.md:
 *   1. Supervisor grava o CNPJ de vários clientes "ganho" numa única
 *      chamada, sobrescrevendo até CNPJ já existente (`supervisor`,
 *      `sobrescreve`).
 *   2. Vendedor é recusado ANTES de qualquer gravação — recusa E ausência
 *      de efeito (`vendedor`).
 *   3. Um cliente não-"ganho" no mesmo lote não é afetado (`naoganho`).
 *   4. Um identificador que não existe na base não derruba as demais
 *      linhas do lote (`inexistente`) nem cria cliente novo (`naocria`).
 *   5. Um chamador não autenticado é recusado (`anonimo`).
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste CnpjLote ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function baseClienteFields(razaoSocial: string, responsavelId: string) {
  return {
    razao_social: razaoSocial,
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: responsavelId,
  }
}

async function getUserId(client: Awaited<ReturnType<typeof signInAs>>): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
}

const createdClienteIds: string[] = []

async function cleanup() {
  if (createdClienteIds.length === 0) return
  await serviceClient().from("clientes").delete().in("id", createdClienteIds.splice(0))
}

/**
 * Semeia um cliente "ganho" (etapa final) diretamente com a chave de
 * serviço, contornando o RPC mover_card_funil — mesmo padrão de
 * rls-frequencia-lote.test.ts. `cnpjInicial` permite provar que a
 * operação em lote sobrescreve um valor já gravado.
 */
async function seedClienteGanho(
  responsavelId: string,
  label: string,
  cnpjInicial: string | null = null
): Promise<string> {
  const { data, error } = await serviceClient()
    .from("clientes")
    .insert({
      ...baseClienteFields(uniqueRazaoSocial(label), responsavelId),
      etapa: ETAPA_FINAL,
      status_acompanhamento: "ganho",
      cnpj: cnpjInicial,
    })
    .select("id")
    .single()
  if (error || !data) {
    throw new Error(`Failed to seed ganho cliente: ${error?.message}`)
  }
  createdClienteIds.push(data.id)
  return data.id
}

/** Semeia um cliente em andamento (não "ganho"), etapa/status padrão. */
async function seedClienteEmAndamento(responsavelId: string, label: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from("clientes")
    .insert(baseClienteFields(uniqueRazaoSocial(label), responsavelId))
    .select("id")
    .single()
  if (error || !data) {
    throw new Error(`Failed to seed em-andamento cliente: ${error?.message}`)
  }
  createdClienteIds.push(data.id)
  return data.id
}

describe("RLS/behavior: atualizar_cnpj_lote RPC (IMP-03)", () => {
  it("supervisor: grava o cnpj de varios clientes ganho de uma vez", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const clienteA = await seedClienteGanho(vendedorAId, "supervisor-a")
    const clienteB = await seedClienteGanho(vendedorAId, "supervisor-b")

    const { data, error } = await supervisor.rpc("atualizar_cnpj_lote", {
      p_atualizacoes: [
        { id: clienteA, cnpj: "11.111.111/0001-11" },
        { id: clienteB, cnpj: "22.222.222/0001-22" },
      ],
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(2)
    const idsRetornados = data!.map((row: { id: string }) => row.id)
    expect(idsRetornados).toContain(clienteA)
    expect(idsRetornados).toContain(clienteB)

    const { data: releitura, error: releituraError } = await serviceClient()
      .from("clientes")
      .select("id, cnpj")
      .in("id", [clienteA, clienteB])
    expect(releituraError).toBeNull()
    const cnpjPorId = new Map(releitura!.map((row) => [row.id, row.cnpj]))
    expect(cnpjPorId.get(clienteA)).toBe("11.111.111/0001-11")
    expect(cnpjPorId.get(clienteB)).toBe("22.222.222/0001-22")

    await cleanup()
  })

  it("sobrescreve: um cliente que ja tem cnpj tem o valor substituido", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const clienteId = await seedClienteGanho(vendedorAId, "sobrescreve", "00.000.000/0001-00")

    const { data, error } = await supervisor.rpc("atualizar_cnpj_lote", {
      p_atualizacoes: [{ id: clienteId, cnpj: "33.333.333/0001-33" }],
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(1)

    const { data: releitura, error: releituraError } = await serviceClient()
      .from("clientes")
      .select("cnpj")
      .eq("id", clienteId)
      .single()
    expect(releituraError).toBeNull()
    expect(releitura?.cnpj).toBe("33.333.333/0001-33")

    await cleanup()
  })

  it("vendedor: a chamada e recusada e nenhum cnpj muda", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await seedClienteGanho(vendedorAId, "vendedor-recusado")

    const { data, error } = await vendedorA.rpc("atualizar_cnpj_lote", {
      p_atualizacoes: [{ id: clienteId, cnpj: "44.444.444/0001-44" }],
    })

    expect(error).not.toBeNull()
    expect(data).toBeNull()

    const { data: releitura, error: releituraError } = await serviceClient()
      .from("clientes")
      .select("cnpj")
      .eq("id", clienteId)
      .single()
    expect(releituraError).toBeNull()
    expect(releitura?.cnpj).toBeNull()

    await cleanup()
  })

  it("naoganho: um cliente em andamento no mesmo lote passa incolume", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const clienteGanho = await seedClienteGanho(vendedorAId, "naoganho-ganho")
    const clienteEmAndamento = await seedClienteEmAndamento(vendedorAId, "naoganho-andamento")

    const { data, error } = await supervisor.rpc("atualizar_cnpj_lote", {
      p_atualizacoes: [
        { id: clienteGanho, cnpj: "55.555.555/0001-55" },
        { id: clienteEmAndamento, cnpj: "55.555.555/0001-55" },
      ],
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(1)
    expect(data![0].id).toBe(clienteGanho)

    const { data: releitura, error: releituraError } = await serviceClient()
      .from("clientes")
      .select("cnpj, status_acompanhamento")
      .eq("id", clienteEmAndamento)
      .single()
    expect(releituraError).toBeNull()
    expect(releitura?.cnpj).toBeNull()
    expect(releitura?.status_acompanhamento).not.toBe("ganho")

    await cleanup()
  })

  it("inexistente: um identificador que nao existe na base nao derruba as demais linhas do lote", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const clienteValido = await seedClienteGanho(vendedorAId, "inexistente-valido")
    const idInexistente = "00000000-0000-0000-0000-000000000000"

    const { data, error } = await supervisor.rpc("atualizar_cnpj_lote", {
      p_atualizacoes: [
        { id: clienteValido, cnpj: "66.666.666/0001-66" },
        { id: idInexistente, cnpj: "77.777.777/0001-77" },
      ],
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(1)
    expect(data![0].id).toBe(clienteValido)

    const { data: releitura, error: releituraError } = await serviceClient()
      .from("clientes")
      .select("cnpj")
      .eq("id", clienteValido)
      .single()
    expect(releituraError).toBeNull()
    expect(releitura?.cnpj).toBe("66.666.666/0001-66")

    await cleanup()
  })

  it("naocria: um lote com identificador inexistente nao cria cliente novo", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const idInexistente = "11111111-1111-1111-1111-111111111111"

    const { count: antes, error: antesError } = await serviceClient()
      .from("clientes")
      .select("id", { count: "exact", head: true })
    expect(antesError).toBeNull()

    const { error } = await supervisor.rpc("atualizar_cnpj_lote", {
      p_atualizacoes: [{ id: idInexistente, cnpj: "88.888.888/0001-88" }],
    })
    expect(error).toBeNull()

    const { count: depois, error: depoisError } = await serviceClient()
      .from("clientes")
      .select("id", { count: "exact", head: true })
    expect(depoisError).toBeNull()

    expect(depois).toBe(antes)
  })

  it("anonimo: um cliente nao autenticado chamando a operacao e recusado", async () => {
    const anon = anonClient()
    const { data, error } = await anon.rpc("atualizar_cnpj_lote", {
      p_atualizacoes: [],
    })

    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })
})
