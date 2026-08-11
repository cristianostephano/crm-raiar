import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { addDays, format, parseISO } from "date-fns"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"
import { ETAPA_FINAL } from "../../lib/funil/etapas"

/**
 * Integration tests for the Fase 13 database foundation (13-01-PLAN.md) —
 * `frequencia_visita_enum`, `proxima_data_visita`, and `mover_card_funil`'s
 * new `p_frequencia_visita` guard/seed behavior (VIS-01, VIS-04, ATV-03).
 *
 * Same pattern as every other clientes/* integration test in this project:
 * real signed-in sessions via signInAs()/SEED_ACCOUNTS (Pitfall 2),
 * serviceClient() used ONLY to seed/clean up test data, never to assert
 * behaviour (service-role bypasses RLS and would give a false pass).
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste FreqVisita ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

const createdClienteIds: string[] = []

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  const admin = serviceClient()
  // `on delete cascade` em visitas.cliente_id cobre a limpeza das visitas
  // semeadas por estes testes — só é preciso apagar o cliente.
  await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
})

async function getUserId(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
}

async function createTestCliente(
  client: SupabaseClient,
  responsavelId: string,
  label: string
): Promise<string> {
  const { data, error } = await client
    .from("clientes")
    .insert(baseClienteFields(uniqueRazaoSocial(label), responsavelId))
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(`Failed to seed test cliente: ${error?.message}`)
  }
  createdClienteIds.push(data.id)
  return data.id
}

/** Leva o cliente até a etapa final do funil (pré-requisito de "ganho"). */
async function levarAteEtapaFinal(
  client: SupabaseClient,
  clienteId: string
): Promise<void> {
  const { error } = await client
    .from("clientes")
    .update({ etapa: ETAPA_FINAL })
    .eq("id", clienteId)
  if (error) {
    throw new Error(`Failed to move cliente to etapa final: ${error.message}`)
  }
}

/**
 * Mirrors the exact call the ganho dialog (13-02/18-02) will send. Sempre
 * manda p_cnpj (Fase 18): a partir da migration 0018, o RPC recusa a
 * transição para ganho sem CNPJ, então todo caminho feliz destes testes
 * precisa de um valor não-vazio para continuar passando.
 */
async function marcarGanhoRpc(
  client: SupabaseClient,
  clienteId: string,
  frequenciaVisita?: "semanal" | "quinzenal" | "mensal" | "nenhuma"
) {
  const params: Record<string, unknown> = {
    p_cliente_id: clienteId,
    p_nova_etapa: ETAPA_FINAL,
    p_novo_status: "ganho",
    p_cnpj: "12.345.678/0001-99",
  }
  if (frequenciaVisita !== undefined) {
    params.p_frequencia_visita = frequenciaVisita
  }
  return client.rpc("mover_card_funil", params)
}

/** Hoje no fuso de São Paulo, em YYYY-MM-DD — nunca construindo a partir de uma string ISO (Pitfall 1). */
function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date()
  )
}

describe("proxima_data_visita: clamp de fim de mês (Pitfall 1)", () => {
  it("clamp: 31/01 + mensal cai em 28/02 (ano comum)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const { data, error } = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2026-01-31",
      p_frequencia: "mensal",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-02-28")
  })

  it("clamp: 31/01 + mensal cai em 29/02 em ano bissexto", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const { data, error } = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2028-01-31",
      p_frequencia: "mensal",
    })
    expect(error).toBeNull()
    expect(data).toBe("2028-02-29")
  })

  it("clamp: 31/03 + mensal cai em 30/04", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const { data, error } = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2026-03-31",
      p_frequencia: "mensal",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-04-30")
  })
})

describe("proxima_data_visita: intervalo semanal/quinzenal", () => {
  it("intervalo: 31/01 + semanal = 07/02", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const { data, error } = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2026-01-31",
      p_frequencia: "semanal",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-02-07")
  })

  it("intervalo: 31/01 + quinzenal = 14/02", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const { data, error } = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2026-01-31",
      p_frequencia: "quinzenal",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-02-14")
  })
})

describe("proxima_data_visita: 'nenhuma' devolve nulo", () => {
  it("nulo: frequencia 'nenhuma' devolve nulo", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const { data, error } = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2026-01-31",
      p_frequencia: "nenhuma",
    })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})

describe("mover_card_funil: frequência de visita obrigatória ao ganho (VIS-01)", () => {
  it("obrigatoria: marcar ganho sem p_frequencia_visita e recusado, cliente continua nao-ganho", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "obrigatoria")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error } = await marcarGanhoRpc(vendedorA, clienteId)

    expect(error).not.toBeNull()

    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("status_acompanhamento")
      .eq("id", clienteId)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.status_acompanhamento).not.toBe("ganho")
  })

  it("semeia: ganho com frequência 'semanal' grava a coluna e semeia exatamente uma visita pendente", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "semeia")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error } = await marcarGanhoRpc(vendedorA, clienteId, "semanal")
    expect(error).toBeNull()

    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("frequencia_visita")
      .eq("id", clienteId)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.frequencia_visita).toBe("semanal")

    const { data: visitas, error: visitasError } = await vendedorA
      .from("visitas")
      .select("id, data_prevista, data_realizada")
      .eq("cliente_id", clienteId)
    expect(visitasError).toBeNull()
    expect(visitas ?? []).toHaveLength(1)
    expect(visitas?.[0]?.data_realizada).toBeNull()

    const esperado = format(addDays(parseISO(hojeSaoPaulo()), 7), "yyyy-MM-dd")
    expect(visitas?.[0]?.data_prevista).toBe(esperado)
  })

  it("nenhuma: ganho com frequência 'nenhuma' grava a coluna e nao cria nenhuma visita", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "sem-frequencia")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error } = await marcarGanhoRpc(vendedorA, clienteId, "nenhuma")
    expect(error).toBeNull()

    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("frequencia_visita")
      .eq("id", clienteId)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.frequencia_visita).toBe("nenhuma")

    const { data: visitas, error: visitasError } = await vendedorA
      .from("visitas")
      .select("id")
      .eq("cliente_id", clienteId)
    expect(visitasError).toBeNull()
    expect(visitas ?? []).toHaveLength(0)
  })

  it("duplica: remarcar ganho duas vezes seguidas nao duplica a visita pendente", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "duplica")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const primeiro = await marcarGanhoRpc(vendedorA, clienteId, "semanal")
    expect(primeiro.error).toBeNull()

    // Volta para em_andamento (mesma etapa final, mudando só o status) e
    // remarca ganho de novo.
    const { error: voltaError } = await vendedorA.rpc("mover_card_funil", {
      p_cliente_id: clienteId,
      p_nova_etapa: ETAPA_FINAL,
      p_novo_status: "em_andamento",
    })
    expect(voltaError).toBeNull()

    const segundo = await marcarGanhoRpc(vendedorA, clienteId, "semanal")
    expect(segundo.error).toBeNull()

    const { data: visitas, error: visitasError } = await vendedorA
      .from("visitas")
      .select("id")
      .eq("cliente_id", clienteId)
      .is("data_realizada", null)
    expect(visitasError).toBeNull()
    expect(visitas ?? []).toHaveLength(1)
  })
})

describe("VIS-04: clientes já 'ganho' antes desta versão continuam válidos", () => {
  it("legado: cliente ganho legado (inserido sem RPC) tem frequência/colunas novas nulas, e legivel e editavel pelo dono", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const admin = serviceClient()

    const { data: inserted, error: insertError } = await admin
      .from("clientes")
      .insert({
        ...baseClienteFields(uniqueRazaoSocial("legado"), vendedorAId),
        etapa: ETAPA_FINAL,
        status_acompanhamento: "ganho",
      })
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("frequencia_visita, nome_fantasia, cnpj, frequencia_pedidos")
      .eq("id", inserted!.id)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.frequencia_visita).toBeNull()
    expect(cliente?.nome_fantasia).toBeNull()
    expect(cliente?.cnpj).toBeNull()
    expect(cliente?.frequencia_pedidos).toBeNull()

    const { data: updated, error: updateError } = await vendedorA
      .from("clientes")
      .update({ observacao: "cliente legado, editado normalmente" })
      .eq("id", inserted!.id)
      .select("observacao")
      .single()
    expect(updateError).toBeNull()
    expect(updated?.observacao).toBe("cliente legado, editado normalmente")
  })
})

describe("ATV-03: frequencia_visita é uma única coluna, RPC e edição direta escrevem no mesmo campo", () => {
  it("coluna: um UPDATE comum sobrescreve o valor gravado pelo RPC no ganho", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "coluna")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error: rpcError } = await marcarGanhoRpc(vendedorA, clienteId, "semanal")
    expect(rpcError).toBeNull()

    const { data: updated, error: updateError } = await vendedorA
      .from("clientes")
      .update({ frequencia_visita: "mensal" })
      .eq("id", clienteId)
      .select("frequencia_visita")
      .single()
    expect(updateError).toBeNull()
    expect(updated?.frequencia_visita).toBe("mensal")

    const { data: reread, error: rereadError } = await vendedorA
      .from("clientes")
      .select("frequencia_visita")
      .eq("id", clienteId)
      .single()
    expect(rereadError).toBeNull()
    expect(reread?.frequencia_visita).toBe("mensal")
  })
})
