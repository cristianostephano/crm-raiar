import { describe, expect, it } from "vitest"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { anonClient, serviceClient, signInAs } from "../helpers/supabase-test-clients"
import { ETAPA_FINAL } from "../../lib/funil/etapas"

/**
 * Integration test for the `atualizar_frequencia_visita_lote` RPC (17-01
 * Task 1/3, IMP-01). Molde literal de
 * tests/importacao/rls-importar-lote.test.ts: a chave de serviço é usada
 * SÓ para semear e limpar; toda asserção roda com sessão real do papel sob
 * teste (Pitfall 2/10: um teste negativo com a chave de serviço passaria
 * sempre, já que ela ignora RLS).
 *
 * Prova os must-haves do 17-01-PLAN.md:
 *   1. Supervisor grava a frequência de vários clientes "ganho" numa única
 *      chamada, sobrescrevendo até frequência já existente (`supervisor`).
 *   2. Vendedor é recusado ANTES de qualquer gravação — recusa E ausência
 *      de efeito (`vendedor`).
 *   3. Um cliente não-"ganho" no mesmo lote não é afetado (`naoganho`) —
 *      segunda metade do critério de sucesso 3.
 *   4. Um identificador que não existe na base não derruba as demais
 *      linhas do lote (`inexistente`) nem cria cliente novo (`naocria`) —
 *      critério de sucesso 4 e primeira metade do critério de sucesso 3.
 *   5. A operação nunca agenda visita (`semvisita`) — lacuna L3 do plano.
 *   6. Um chamador não autenticado é recusado (`anonimo`).
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste FreqLote ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
 * serviço, contornando o RPC mover_card_funil — mesmo padrão do caso
 * "legado" em tests/clientes/frequencia-visita.test.ts. `frequenciaInicial`
 * permite provar que a operação em lote sobrescreve um valor já gravado.
 */
async function seedClienteGanho(
  responsavelId: string,
  label: string,
  frequenciaInicial: "semanal" | "quinzenal" | "mensal" | "nenhuma" | null = null
): Promise<string> {
  const { data, error } = await serviceClient()
    .from("clientes")
    .insert({
      ...baseClienteFields(uniqueRazaoSocial(label), responsavelId),
      etapa: ETAPA_FINAL,
      status_acompanhamento: "ganho",
      frequencia_visita: frequenciaInicial,
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

describe("RLS/behavior: atualizar_frequencia_visita_lote RPC (IMP-01)", () => {
  it("supervisor: grava a frequencia de varios clientes ganho de uma vez, sobrescrevendo valor existente", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const clienteSemFrequencia = await seedClienteGanho(vendedorAId, "supervisor-sem-freq")
    const clienteComFrequencia = await seedClienteGanho(
      vendedorAId,
      "supervisor-com-freq",
      "mensal"
    )

    const { data, error } = await supervisor.rpc("atualizar_frequencia_visita_lote", {
      p_atualizacoes: [
        { id: clienteSemFrequencia, frequencia_visita: "semanal" },
        { id: clienteComFrequencia, frequencia_visita: "semanal" },
      ],
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(2)
    const idsRetornados = data!.map((row: { id: string }) => row.id)
    expect(idsRetornados).toContain(clienteSemFrequencia)
    expect(idsRetornados).toContain(clienteComFrequencia)

    const { data: releitura, error: releituraError } = await serviceClient()
      .from("clientes")
      .select("id, frequencia_visita")
      .in("id", [clienteSemFrequencia, clienteComFrequencia])
    expect(releituraError).toBeNull()
    for (const row of releitura!) {
      expect(row.frequencia_visita).toBe("semanal")
    }

    await cleanup()
  })

  it("vendedor: a chamada e recusada e nenhuma frequencia muda", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await seedClienteGanho(vendedorAId, "vendedor-recusado")

    const { data, error } = await vendedorA.rpc("atualizar_frequencia_visita_lote", {
      p_atualizacoes: [{ id: clienteId, frequencia_visita: "semanal" }],
    })

    expect(error).not.toBeNull()
    expect(data).toBeNull()

    const { data: releitura, error: releituraError } = await serviceClient()
      .from("clientes")
      .select("frequencia_visita")
      .eq("id", clienteId)
      .single()
    expect(releituraError).toBeNull()
    expect(releitura?.frequencia_visita).toBeNull()

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

    const { data, error } = await supervisor.rpc("atualizar_frequencia_visita_lote", {
      p_atualizacoes: [
        { id: clienteGanho, frequencia_visita: "quinzenal" },
        { id: clienteEmAndamento, frequencia_visita: "quinzenal" },
      ],
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(1)
    expect(data![0].id).toBe(clienteGanho)

    const { data: releitura, error: releituraError } = await serviceClient()
      .from("clientes")
      .select("frequencia_visita, status_acompanhamento")
      .eq("id", clienteEmAndamento)
      .single()
    expect(releituraError).toBeNull()
    expect(releitura?.frequencia_visita).toBeNull()
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

    const { data, error } = await supervisor.rpc("atualizar_frequencia_visita_lote", {
      p_atualizacoes: [
        { id: clienteValido, frequencia_visita: "mensal" },
        { id: idInexistente, frequencia_visita: "mensal" },
      ],
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(1)
    expect(data![0].id).toBe(clienteValido)

    const { data: releitura, error: releituraError } = await serviceClient()
      .from("clientes")
      .select("frequencia_visita")
      .eq("id", clienteValido)
      .single()
    expect(releituraError).toBeNull()
    expect(releitura?.frequencia_visita).toBe("mensal")

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

    const { error } = await supervisor.rpc("atualizar_frequencia_visita_lote", {
      p_atualizacoes: [{ id: idInexistente, frequencia_visita: "nenhuma" }],
    })
    expect(error).toBeNull()

    const { count: depois, error: depoisError } = await serviceClient()
      .from("clientes")
      .select("id", { count: "exact", head: true })
    expect(depoisError).toBeNull()

    expect(depois).toBe(antes)
  })

  it("semvisita: definir frequencia em massa nao agenda visita nenhuma", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const clienteId = await seedClienteGanho(vendedorAId, "semvisita")

    const { error } = await supervisor.rpc("atualizar_frequencia_visita_lote", {
      p_atualizacoes: [{ id: clienteId, frequencia_visita: "semanal" }],
    })
    expect(error).toBeNull()

    const { data: visitas, error: visitasError } = await serviceClient()
      .from("visitas")
      .select("id")
      .eq("cliente_id", clienteId)
    expect(visitasError).toBeNull()
    expect(visitas ?? []).toHaveLength(0)

    await cleanup()
  })

  it("anonimo: um cliente nao autenticado chamando a operacao e recusado", async () => {
    const anon = anonClient()
    const { data, error } = await anon.rpc("atualizar_frequencia_visita_lote", {
      p_atualizacoes: [],
    })

    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })
})
