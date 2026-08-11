import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"
import { ETAPA_FINAL } from "../../lib/funil/etapas"

/**
 * Integration tests for the Fase 18 database guard (18-01-PLAN.md) —
 * `mover_card_funil`'s new `p_cnpj` parameter and the guard that requires a
 * non-empty CNPJ exactly at the moment a cliente transitions to "ganho"
 * (CNPJ-01), while never blocking a cliente that already WAS "ganho" before
 * this version (CNPJ-02, grandfathering).
 *
 * Same pattern as every other clientes/* integration test in this project:
 * real signed-in sessions via signInAs()/SEED_ACCOUNTS (Pitfall 2),
 * serviceClient() used ONLY to seed/clean up test data (and, for the
 * "legado" case, to simulate a pre-existing row that never went through the
 * RPC), never to assert behaviour — the service role bypasses RLS and would
 * give a false positive.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste CnpjGanho ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
 * Chamada de ganho no formato do diálogo (13-02/18-02): sempre manda
 * frequência de visita não-nula (senão o guard existente de VIS-01 dispara
 * ANTES do guard novo de CNPJ e o teste não provaria o que se propõe a
 * provar), e opcionalmente manda p_cnpj — `undefined` omite o parâmetro,
 * uma string (mesmo vazia/em branco) manda o valor exato.
 */
async function marcarGanhoComCnpj(
  client: SupabaseClient,
  clienteId: string,
  cnpj: string | undefined
) {
  const params: Record<string, unknown> = {
    p_cliente_id: clienteId,
    p_nova_etapa: ETAPA_FINAL,
    p_novo_status: "ganho",
    p_frequencia_visita: "semanal",
  }
  if (cnpj !== undefined) {
    params.p_cnpj = cnpj
  }
  return client.rpc("mover_card_funil", params)
}

/** Mirrors the exact call the drag handler (arrastar card) sends: no p_novo_status, no p_cnpj. */
async function arrastarCard(
  client: SupabaseClient,
  clienteId: string,
  novaPosicao: number
) {
  return client.rpc("mover_card_funil", {
    p_cliente_id: clienteId,
    p_nova_etapa: ETAPA_FINAL,
    p_nova_posicao: novaPosicao,
  })
}

describe("mover_card_funil: CNPJ obrigatório ao ganho (CNPJ-01)", () => {
  it("obrigatorio: marcar ganho sem p_cnpj e sem CNPJ gravado e recusado, cliente continua nao-ganho", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "obrigatorio")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error } = await marcarGanhoComCnpj(vendedorA, clienteId, undefined)
    expect(error).not.toBeNull()

    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("status_acompanhamento")
      .eq("id", clienteId)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.status_acompanhamento).not.toBe("ganho")
  })

  it("vazio: marcar ganho com p_cnpj so de espacos em branco e recusado, cliente continua nao-ganho", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "vazio")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error } = await marcarGanhoComCnpj(vendedorA, clienteId, "   ")
    expect(error).not.toBeNull()

    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("status_acompanhamento")
      .eq("id", clienteId)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.status_acompanhamento).not.toBe("ganho")
  })

  it("feliz: marcar ganho com p_cnpj preenchido funciona e grava o valor (aparado) em clientes.cnpj", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "feliz")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error } = await marcarGanhoComCnpj(vendedorA, clienteId, "  12.345.678/0001-99  ")
    expect(error).toBeNull()

    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("status_acompanhamento, cnpj")
      .eq("id", clienteId)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.status_acompanhamento).toBe("ganho")
    expect(cliente?.cnpj).toBe("12.345.678/0001-99")
  })

  it("existente: cliente que ja tem cnpj gravado na ficha vira ganho sem reenviar p_cnpj", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "existente")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error: updateError } = await vendedorA
      .from("clientes")
      .update({ cnpj: "98.765.432/0001-10" })
      .eq("id", clienteId)
    expect(updateError).toBeNull()

    const { error } = await marcarGanhoComCnpj(vendedorA, clienteId, undefined)
    expect(error).toBeNull()

    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("status_acompanhamento, cnpj")
      .eq("id", clienteId)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.status_acompanhamento).toBe("ganho")
    expect(cliente?.cnpj).toBe("98.765.432/0001-10")
  })

  it("formato: um texto qualquer nao-vazio sem 14 digitos e aceito como CNPJ (fora de escopo validar formato, D-2)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "formato")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error } = await marcarGanhoComCnpj(vendedorA, clienteId, "123")
    expect(error).toBeNull()

    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("status_acompanhamento, cnpj")
      .eq("id", clienteId)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.status_acompanhamento).toBe("ganho")
    expect(cliente?.cnpj).toBe("123")
  })
})

describe("mover_card_funil: grandfathering de clientes ja ganho (CNPJ-02)", () => {
  it("legado: cliente ganho legado (inserido sem RPC) sem CNPJ continua legivel, editavel, e a transicao reafirmada nao e bloqueada", async () => {
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

    // (i) a linha e legivel pelo dono e cnpj vem nulo.
    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("cnpj")
      .eq("id", inserted!.id)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.cnpj).toBeNull()

    // (ii) um UPDATE comum em outro campo funciona sem erro.
    const { data: updated, error: updateError } = await vendedorA
      .from("clientes")
      .update({ observacao: "cliente legado, editado normalmente" })
      .eq("id", inserted!.id)
      .select("observacao")
      .single()
    expect(updateError).toBeNull()
    expect(updated?.observacao).toBe("cliente legado, editado normalmente")

    // (iii) chamar mover_card_funil reafirmando ganho, SEM p_cnpj, NAO
    // retorna erro — porque ele ja era ganho, nao houve transicao.
    const { error: rpcError } = await marcarGanhoComCnpj(vendedorA, inserted!.id, undefined)
    expect(rpcError).toBeNull()
  })

  it("arrasta: cliente ganho legado sem CNPJ nao e bloqueado numa chamada no formato de arrastar card", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const admin = serviceClient()

    const { data: inserted, error: insertError } = await admin
      .from("clientes")
      .insert({
        ...baseClienteFields(uniqueRazaoSocial("arrasta"), vendedorAId),
        etapa: ETAPA_FINAL,
        status_acompanhamento: "ganho",
      })
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { error } = await arrastarCard(vendedorA, inserted!.id, 42)
    expect(error).toBeNull()

    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("cnpj")
      .eq("id", inserted!.id)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.cnpj).toBeNull()
  })

  it("preserva: cliente ganho com CNPJ mantem o valor gravado numa chamada posterior sem p_cnpj", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "preserva")
    await levarAteEtapaFinal(vendedorA, clienteId)

    const { error: ganhoError } = await marcarGanhoComCnpj(vendedorA, clienteId, "11.222.333/0001-44")
    expect(ganhoError).toBeNull()

    const { error: reposicionaError } = await arrastarCard(vendedorA, clienteId, 7)
    expect(reposicionaError).toBeNull()

    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("cnpj")
      .eq("id", clienteId)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.cnpj).toBe("11.222.333/0001-44")
  })
})
