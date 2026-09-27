import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  createTestMember,
  deleteTestMember,
  serviceClient,
  signInAs,
  type TestMember,
} from "../helpers/supabase-test-clients"

/**
 * Integration tests for the migration 0039 surface (30-01-PLAN.md, D-07):
 * `profiles.desativado_em`/`profiles.reativado_em`, carimbados só na troca
 * real de estado por `desativar_membro_equipe`/`reativar_membro_equipe`
 * (0008, corpo recriado idêntico exceto pelo carimbo).
 *
 * NUNCA usa as contas semente antigas (apagadas em 2026-08-19 — ver
 * STATE.md) — só fixtures descartáveis via `createTestMember`/
 * `deleteTestMember`. O projeto Supabase de teste É o de produção, com
 * dados reais de funcionários — por isso este arquivo NUNCA imprime uma
 * linha lida do banco no terminal e usa só razão social/nomes inventados
 * (LGPD).
 *
 * No máximo duas autenticações no arquivo inteiro: o Supervisor e o
 * Vendedor W. Vendedor V (o alvo de desativação/reativação) e o substituto
 * S nunca fazem login — a desativação/reativação é sempre chamada pelo
 * cliente autenticado do Supervisor via `.rpc(...)`.
 *
 * Fica VERMELHO (coluna inexistente no banco) até o plano 30-03 aplicar a
 * migration 0039 no projeto hospedado.
 */

type ProfileCarimbos = {
  ativo: boolean
  desativado_em: string | null
  reativado_em: string | null
}

function uniqueRazaoSocial(label: string): string {
  return `Teste Carimbos ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

let supervisor: TestMember
let vendedorV: TestMember
let substitutoS: TestMember
let vendedorW: TestMember
let supervisorClient: SupabaseClient
let clientW: SupabaseClient
let clienteEmAndamentoId: string

beforeAll(async () => {
  supervisor = await createTestMember("supervisor", "carimbos")
  vendedorV = await createTestMember("vendedor", "carimbos-v")
  substitutoS = await createTestMember("vendedor", "carimbos-s")
  vendedorW = await createTestMember("vendedor", "carimbos-w")
  supervisorClient = await signInAs(supervisor.email, supervisor.password)
  clientW = await signInAs(vendedorW.email, vendedorW.password)

  const { data, error } = await serviceClient()
    .from("clientes")
    .insert(baseClienteFields(uniqueRazaoSocial("cliente-de-v"), vendedorV.id))
    .select("id")
    .single()
  if (error || !data) {
    throw new Error(`Falha ao semear cliente em andamento de V: ${error?.message}`)
  }
  clienteEmAndamentoId = data.id as string
})

afterAll(async () => {
  const admin = serviceClient()
  // O cliente pode ter passado a ter `responsavel = substitutoS` (Tarefa
  // desativar-ainda-reatribui) — apagar por id cobre os dois casos.
  await admin.from("clientes").delete().eq("id", clienteEmAndamentoId)
  await deleteTestMember(supervisor.id)
  await deleteTestMember(vendedorV.id)
  await deleteTestMember(substitutoS.id)
  await deleteTestMember(vendedorW.id)
})

async function carimbosDe(profileId: string): Promise<ProfileCarimbos> {
  const { data, error } = await serviceClient()
    .from("profiles")
    .select("ativo, desativado_em, reativado_em")
    .eq("id", profileId)
    .single()
  if (error || !data) {
    throw new Error(`Falha ao ler carimbos de ${profileId}: ${error?.message}`)
  }
  return data as ProfileCarimbos
}

async function clienteResponsavel(clienteId: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from("clientes")
    .select("responsavel")
    .eq("id", clienteId)
    .single()
  if (error || !data) {
    throw new Error(`Falha ao ler responsável do cliente: ${error?.message}`)
  }
  return data.responsavel as string
}

describe("Carimbos de desativação/reativação (D-07)", () => {
  it("carimbos-nascem-nulos: V recém-criado tem desativado_em e reativado_em nulos", async () => {
    const carimbos = await carimbosDe(vendedorV.id)
    expect(carimbos.ativo).toBe(true)
    expect(carimbos.desativado_em).toBeNull()
    expect(carimbos.reativado_em).toBeNull()
  })

  it("desativar-carimba: o Supervisor desativa V com substituto S — V fica inativo, desativado_em preenchido (±10 min) e reativado_em ainda nulo", async () => {
    const antes = Date.now()
    const { error } = await supervisorClient.rpc("desativar_membro_equipe", {
      p_profile_id: vendedorV.id,
      p_novo_responsavel_id: substitutoS.id,
    })
    expect(error).toBeNull()

    const carimbos = await carimbosDe(vendedorV.id)
    expect(carimbos.ativo).toBe(false)
    expect(carimbos.desativado_em).not.toBeNull()
    expect(carimbos.reativado_em).toBeNull()

    const desativadoEmMs = new Date(carimbos.desativado_em as string).getTime()
    expect(Math.abs(desativadoEmMs - antes)).toBeLessThan(10 * 60 * 1000)
  })

  it("desativar-ainda-reatribui: o cliente em andamento de V passa a ter responsável S (regressão do corpo copiado da 0008)", async () => {
    const responsavel = await clienteResponsavel(clienteEmAndamentoId)
    expect(responsavel).toBe(substitutoS.id)
  })

  it("desativar-de-novo-nao-recarimba: desativar V de novo mantém o mesmo desativado_em", async () => {
    const antes = await carimbosDe(vendedorV.id)

    const { error } = await supervisorClient.rpc("desativar_membro_equipe", {
      p_profile_id: vendedorV.id,
      p_novo_responsavel_id: substitutoS.id,
    })
    expect(error).toBeNull()

    const depois = await carimbosDe(vendedorV.id)
    expect(depois.desativado_em).toBe(antes.desativado_em)
  })

  it("reativar-carimba: o Supervisor reativa V — V fica ativo, reativado_em preenchido e maior ou igual a desativado_em", async () => {
    const antes = await carimbosDe(vendedorV.id)

    const { error } = await supervisorClient.rpc("reativar_membro_equipe", {
      p_profile_id: vendedorV.id,
    })
    expect(error).toBeNull()

    const depois = await carimbosDe(vendedorV.id)
    expect(depois.ativo).toBe(true)
    expect(depois.reativado_em).not.toBeNull()

    const desativadoEmMs = new Date(antes.desativado_em as string).getTime()
    const reativadoEmMs = new Date(depois.reativado_em as string).getTime()
    expect(reativadoEmMs).toBeGreaterThanOrEqual(desativadoEmMs)
  })

  it("reativar-de-novo-nao-recarimba: reativar V de novo mantém o mesmo reativado_em", async () => {
    const antes = await carimbosDe(vendedorV.id)

    const { error } = await supervisorClient.rpc("reativar_membro_equipe", {
      p_profile_id: vendedorV.id,
    })
    expect(error).toBeNull()

    const depois = await carimbosDe(vendedorV.id)
    expect(depois.reativado_em).toBe(antes.reativado_em)
  })

  it('vendedor-nao-desativa: W tenta desativar S e recebe erro contendo "Somente supervisores"; S continua ativo', async () => {
    const { error } = await clientW.rpc("desativar_membro_equipe", {
      p_profile_id: substitutoS.id,
      p_novo_responsavel_id: vendedorV.id,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toContain("Somente supervisores")

    const carimbos = await carimbosDe(substitutoS.id)
    expect(carimbos.ativo).toBe(true)
  })

  it("vendedor-nao-altera-carimbo: W tenta atualizar o próprio reativado_em direto na tabela profiles e nada muda", async () => {
    const { data } = await clientW
      .from("profiles")
      .update({ reativado_em: new Date().toISOString() })
      .eq("id", vendedorW.id)
      .select("id")
    expect(data ?? []).toHaveLength(0)

    const carimbos = await carimbosDe(vendedorW.id)
    expect(carimbos.reativado_em).toBeNull()
  })
})
