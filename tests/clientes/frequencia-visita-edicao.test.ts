import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"
import { ETAPA_FINAL } from "../../lib/funil/etapas"

/**
 * Integration tests for the Fase 13-03 standing frequência-de-visita edit
 * (app/actions/clientes.ts's atualizarFrequenciaVisita) — VIS-02, VIS-04,
 * ATV-03.
 *
 * atualizarFrequenciaVisita calls lib/supabase/server.ts's createClient(),
 * which reads next/headers' cookies() and needs a live Next.js request
 * scope, so it cannot be invoked directly from Vitest (same convention
 * documented at the top of tests/clientes/funil-status.test.ts). The
 * behaviour it depends on is proven here by exercising the exact same
 * UPDATE the action sends to Postgres, as real signed-in Vendedor sessions
 * — serviceClient() is used ONLY to seed/clean up test data, never to
 * assert permission behaviour (it bypasses RLS and would give a false
 * positive).
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste FreqVisitaEdicao ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

async function marcarGanhoRpc(
  client: SupabaseClient,
  clienteId: string,
  frequenciaVisita: "semanal" | "quinzenal" | "mensal" | "nenhuma"
) {
  return client.rpc("mover_card_funil", {
    p_cliente_id: clienteId,
    p_nova_etapa: ETAPA_FINAL,
    p_novo_status: "ganho",
    p_frequencia_visita: frequenciaVisita,
  })
}

describe("atualizarFrequenciaVisita: edição/cancelamento da cadência (VIS-02)", () => {
  it("edita: Vendedor A troca a frequência do próprio cliente ganho de semanal para mensal", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "edita")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error: rpcError } = await marcarGanhoRpc(vendedorA, clienteId, "semanal")
    expect(rpcError).toBeNull()

    const { data: updated, error: updateError } = await vendedorA
      .from("clientes")
      .update({ frequencia_visita: "mensal" })
      .eq("id", clienteId)
      .select("id")
      .maybeSingle()
    expect(updateError).toBeNull()
    expect(updated).not.toBeNull()

    const { data: reread, error: rereadError } = await vendedorA
      .from("clientes")
      .select("frequencia_visita")
      .eq("id", clienteId)
      .single()
    expect(rereadError).toBeNull()
    expect(reread?.frequencia_visita).toBe("mensal")
  })

  it("cancela: trocar a frequência para nenhuma não exige nada além de um UPDATE comum", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "cancela")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error: rpcError } = await marcarGanhoRpc(vendedorA, clienteId, "semanal")
    expect(rpcError).toBeNull()

    const { data: updated, error: updateError } = await vendedorA
      .from("clientes")
      .update({ frequencia_visita: "nenhuma" })
      .eq("id", clienteId)
      .select("id")
      .maybeSingle()
    expect(updateError).toBeNull()
    expect(updated).not.toBeNull()

    const { data: reread, error: rereadError } = await vendedorA
      .from("clientes")
      .select("frequencia_visita")
      .eq("id", clienteId)
      .single()
    expect(rereadError).toBeNull()
    expect(reread?.frequencia_visita).toBe("nenhuma")
  })

  it("pendente: cancelar a cadência não remove nem fecha a visita já agendada", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "pendente")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error: rpcError } = await marcarGanhoRpc(vendedorA, clienteId, "semanal")
    expect(rpcError).toBeNull()

    const { data: visitaAntes, error: visitaAntesError } = await vendedorA
      .from("visitas")
      .select("id, data_prevista")
      .eq("cliente_id", clienteId)
      .is("data_realizada", null)
      .single()
    expect(visitaAntesError).toBeNull()
    expect(visitaAntes).not.toBeNull()

    const { error: updateError } = await vendedorA
      .from("clientes")
      .update({ frequencia_visita: "nenhuma" })
      .eq("id", clienteId)
      .select("id")
      .maybeSingle()
    expect(updateError).toBeNull()

    const { data: visitasDepois, error: visitasDepoisError } = await vendedorA
      .from("visitas")
      .select("id, data_prevista")
      .eq("cliente_id", clienteId)
      .is("data_realizada", null)
    expect(visitasDepoisError).toBeNull()
    expect(visitasDepois ?? []).toHaveLength(1)
    expect(visitasDepois?.[0]?.id).toBe(visitaAntes?.id)
    expect(visitasDepois?.[0]?.data_prevista).toBe(visitaAntes?.data_prevista)
  })

  it("outro: Vendedor B não consegue alterar a frequência de cliente do Vendedor A", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "outro")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error: rpcError } = await marcarGanhoRpc(vendedorA, clienteId, "semanal")
    expect(rpcError).toBeNull()

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )

    const { data: updateResult, error: updateError } = await vendedorB
      .from("clientes")
      .update({ frequencia_visita: "mensal" })
      .eq("id", clienteId)
      .select("id")

    expect(updateError).toBeNull()
    expect(updateResult ?? []).toHaveLength(0)

    const admin = serviceClient()
    const { data: reread, error: rereadError } = await admin
      .from("clientes")
      .select("frequencia_visita")
      .eq("id", clienteId)
      .single()
    expect(rereadError).toBeNull()
    expect(reread?.frequencia_visita).toBe("semanal")
  })

  it("legado: cliente ganho legado com frequência nula recebe a primeira cadência por este caminho (VIS-04)", async () => {
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

    const { data: antes, error: antesError } = await vendedorA
      .from("clientes")
      .select("frequencia_visita")
      .eq("id", inserted!.id)
      .single()
    expect(antesError).toBeNull()
    expect(antes?.frequencia_visita).toBeNull()

    const { data: updated, error: updateError } = await vendedorA
      .from("clientes")
      .update({ frequencia_visita: "quinzenal" })
      .eq("id", inserted!.id)
      .select("id")
      .maybeSingle()
    expect(updateError).toBeNull()
    expect(updated).not.toBeNull()

    const { data: depois, error: depoisError } = await vendedorA
      .from("clientes")
      .select("frequencia_visita")
      .eq("id", inserted!.id)
      .single()
    expect(depoisError).toBeNull()
    expect(depois?.frequencia_visita).toBe("quinzenal")
  })

  it("coluna: o RPC de ganho e a edição direta disputam o mesmo campo, o último a escrever vence (ATV-03)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const admin = serviceClient()

    const { data: inserted, error: insertError } = await admin
      .from("clientes")
      .insert({
        ...baseClienteFields(uniqueRazaoSocial("coluna"), vendedorAId),
        etapa: ETAPA_FINAL,
        status_acompanhamento: "ganho",
      })
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { error: updateError } = await vendedorA
      .from("clientes")
      .update({ frequencia_visita: "quinzenal" })
      .eq("id", inserted!.id)
      .select("id")
      .maybeSingle()
    expect(updateError).toBeNull()

    const { error: rpcError } = await marcarGanhoRpc(vendedorA, inserted!.id, "mensal")
    expect(rpcError).toBeNull()

    const { data: reread, error: rereadError } = await vendedorA
      .from("clientes")
      .select("frequencia_visita")
      .eq("id", inserted!.id)
      .single()
    expect(rereadError).toBeNull()
    expect(reread?.frequencia_visita).toBe("mensal")
  })
})
