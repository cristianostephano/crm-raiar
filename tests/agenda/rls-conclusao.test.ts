import { afterEach, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import {
  anonClient,
  serviceClient,
  signInAs,
} from "../helpers/supabase-test-clients"
import { ETAPA_FINAL } from "../../lib/funil/etapas"

/**
 * RLS negative-case tests for the Fase 15 Plan 1 conclusion RPCs
 * (`concluir_tarefa_prospeccao`, `concluir_visita`, migration 0015) —
 * T-15-01/T-15-03: as duas RPCs rodam como o chamador (sem elevacao de
 * privilegio), entao a RLS de tarefas/visitas/clientes continua sendo a
 * unica fronteira de autorizacao da conclusao. Mesmo padrao de todo teste
 * RLS deste projeto: seed via service role, asserta sempre como uma sessao
 * real diferente (service-role bypassa RLS e daria falso positivo).
 *
 * Cada identidade (Vendedor A, Vendedor B, Supervisor) e logada UMA vez
 * neste arquivo (rate limit documentado em STATE.md) e reusada em todos os
 * casos abaixo.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste RLSConclusao ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
  // `on delete cascade` em tarefas.cliente_id/visitas.cliente_id/
  // historico.cliente_id cobre a limpeza dos itens semeados junto do
  // cliente.
  await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
})

async function getUserId(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
}

async function getActiveTipoTarefa(): Promise<{ id: string }> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from("tipos_tarefa")
    .select("id")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error("Nenhum tipo de tarefa ativo encontrado para o teste")
  }
  return data as { id: string }
}

/**
 * Semeia via serviceClient() um cliente ja "ganho" com frequencia mensal,
 * pertencente ao responsavel dado, com uma tarefa pendente e uma visita
 * pendente ao mesmo tempo.
 */
async function seedClienteComPendentes(
  responsavelId: string,
  label: string
): Promise<{ clienteId: string; tarefaId: string; visitaId: string }> {
  const admin = serviceClient()
  const tipoTarefa = await getActiveTipoTarefa()

  const { data: cliente, error: clienteError } = await admin
    .from("clientes")
    .insert({
      ...baseClienteFields(uniqueRazaoSocial(label), responsavelId),
      etapa: ETAPA_FINAL,
      status_acompanhamento: "ganho",
      frequencia_visita: "mensal",
    })
    .select("id")
    .single()
  if (clienteError || !cliente) {
    throw new Error(`Failed to seed test cliente: ${clienteError?.message}`)
  }
  createdClienteIds.push(cliente.id)

  const { data: tarefa, error: tarefaError } = await admin
    .from("tarefas")
    .insert({
      cliente_id: cliente.id,
      tipo_tarefa_id: tipoTarefa.id,
      data_conclusao: "2026-09-01",
    })
    .select("id")
    .single()
  if (tarefaError || !tarefa) {
    throw new Error(`Failed to seed test tarefa: ${tarefaError?.message}`)
  }

  const { data: visita, error: visitaError } = await admin
    .from("visitas")
    .insert({ cliente_id: cliente.id, data_prevista: "2026-09-10" })
    .select("id")
    .single()
  if (visitaError || !visita) {
    throw new Error(`Failed to seed test visita: ${visitaError?.message}`)
  }

  return {
    clienteId: cliente.id as string,
    tarefaId: tarefa.id as string,
    visitaId: visita.id as string,
  }
}

let vendedorA: SupabaseClient
let vendedorAId: string
let vendedorB: SupabaseClient
let supervisor: SupabaseClient

beforeAll(async () => {
  vendedorA = await signInAs(
    SEED_ACCOUNTS.vendedorA.email,
    SEED_ACCOUNTS.vendedorA.password
  )
  vendedorAId = await getUserId(vendedorA)
  vendedorB = await signInAs(
    SEED_ACCOUNTS.vendedorB.email,
    SEED_ACCOUNTS.vendedorB.password
  )
  supervisor = await signInAs(
    SEED_ACCOUNTS.supervisor.email,
    SEED_ACCOUNTS.supervisor.password
  )
})

describe("RLS conclusao: vendedor nao conclui item alheio (T-15-03, o caso mais grave da fase)", () => {
  it("vendedor: Vendedor B concluindo tarefa e visita do cliente de Vendedor A e recusado e nada muda", async () => {
    const { clienteId, tarefaId, visitaId } = await seedClienteComPendentes(
      vendedorAId,
      "vendedor"
    )

    const { error: tarefaError } = await vendedorB.rpc(
      "concluir_tarefa_prospeccao",
      {
        p_tarefa_id: tarefaId,
        p_resumo: "Vendedor B tentando concluir tarefa de outro vendedor.",
      }
    )
    expect(tarefaError).not.toBeNull()

    const { error: visitaError } = await vendedorB.rpc("concluir_visita", {
      p_visita_id: visitaId,
      p_resumo: "Vendedor B tentando concluir visita de outro vendedor.",
      p_proxima_data: "2026-10-01",
    })
    expect(visitaError).not.toBeNull()

    const admin = serviceClient()
    const { data: tarefa } = await admin
      .from("tarefas")
      .select("concluida, resumo")
      .eq("id", tarefaId)
      .single()
    expect(tarefa?.concluida).toBe(false)
    expect(tarefa?.resumo).toBeNull()

    const { data: visita } = await admin
      .from("visitas")
      .select("data_realizada, resumo")
      .eq("id", visitaId)
      .single()
    expect(visita?.data_realizada).toBeNull()
    expect(visita?.resumo).toBeNull()

    const { data: historico } = await admin
      .from("historico")
      .select("id")
      .eq("cliente_id", clienteId)
    expect(historico ?? []).toHaveLength(0)

    const { data: visitasDoCliente } = await admin
      .from("visitas")
      .select("id")
      .eq("cliente_id", clienteId)
    expect(visitasDoCliente ?? []).toHaveLength(1)
  })
})

describe("RLS conclusao: supervisor conclui item de qualquer vendedor", () => {
  it("supervisor: Supervisor conclui a tarefa de um cliente de Vendedor A, e vira autor no historico", async () => {
    const { tarefaId, clienteId } = await seedClienteComPendentes(
      vendedorAId,
      "supervisor"
    )

    const {
      data: { user: supervisorUser },
    } = await supervisor.auth.getUser()
    if (!supervisorUser) throw new Error("Expected supervisor session")

    const { error } = await supervisor.rpc("concluir_tarefa_prospeccao", {
      p_tarefa_id: tarefaId,
      p_resumo: "Supervisor concluindo tarefa de cliente do Vendedor A.",
    })
    expect(error).toBeNull()

    const { data: tarefa } = await supervisor
      .from("tarefas")
      .select("concluida")
      .eq("id", tarefaId)
      .single()
    expect(tarefa?.concluida).toBe(true)

    const { data: historico } = await supervisor
      .from("historico")
      .select("autor_id, descricao")
      .eq("cliente_id", clienteId)
      .eq("tipo", "tarefa_concluida")
      .order("criado_em", { ascending: false })
      .limit(1)
    expect(historico?.[0]?.autor_id).toBe(supervisorUser.id)
  })
})

describe("RLS conclusao: usuario anonimo nao conclui nada", () => {
  it("anonimo: chamada sem sessao nos dois caminhos de conclusao nao muda o estado das linhas semeadas", async () => {
    const { tarefaId, visitaId, clienteId } = await seedClienteComPendentes(
      vendedorAId,
      "anonimo"
    )

    const anon = anonClient()
    await anon.rpc("concluir_tarefa_prospeccao", {
      p_tarefa_id: tarefaId,
      p_resumo: "Usuario anonimo tentando concluir tarefa sem sessao.",
    })
    await anon.rpc("concluir_visita", {
      p_visita_id: visitaId,
      p_resumo: "Usuario anonimo tentando concluir visita sem sessao.",
      p_proxima_data: "2026-10-01",
    })

    const admin = serviceClient()
    const { data: tarefa } = await admin
      .from("tarefas")
      .select("concluida")
      .eq("id", tarefaId)
      .single()
    expect(tarefa?.concluida).toBe(false)

    const { data: visita } = await admin
      .from("visitas")
      .select("data_realizada")
      .eq("id", visitaId)
      .single()
    expect(visita?.data_realizada).toBeNull()

    const { data: visitasDoCliente } = await admin
      .from("visitas")
      .select("id")
      .eq("cliente_id", clienteId)
    expect(visitasDoCliente ?? []).toHaveLength(1)
  })
})
