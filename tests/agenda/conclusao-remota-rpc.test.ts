import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"
import { ETAPA_FINAL } from "../../lib/funil/etapas"

/**
 * Integration tests for the Fase 22 Plan 1 database write layer
 * (22-01-PLAN.md, migration 0022) — o parametro novo
 * `p_motivo_conclusao_remota_id` nas duas RPCs de conclusao
 * (`concluir_tarefa_prospeccao`, `concluir_visita`), a extensao dos dois
 * gatilhos de auditoria para resolver o motivo em nome legivel no
 * Diario, e a nao-regressao do caminho de conclusao presencial e da
 * chamada antiga sem o parametro novo (D-06).
 *
 * Copia estrutural literal de tests/agenda/concluir-rpc.test.ts: mesmos
 * helpers de razao social unica e campos base de cliente, mesma limpeza
 * apoiada no cascade (`on delete cascade` em tarefas.cliente_id/
 * visitas.cliente_id/historico.cliente_id cobre a limpeza dos itens
 * semeados junto do cliente), Vendedor A logado UMA vez no arquivo
 * (rate limit documentado em STATE.md).
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste ConclusaoRemota ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
const createdMotivoIds: string[] = []

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  const admin = serviceClient()
  // `on delete cascade` em tarefas.cliente_id/visitas.cliente_id/
  // historico.cliente_id cobre a limpeza dos itens semeados junto do
  // cliente.
  await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
})

afterAll(async () => {
  if (createdMotivoIds.length === 0) return
  const admin = serviceClient()
  await admin
    .from("motivos_conclusao_remota")
    .delete()
    .in("id", createdMotivoIds)
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

function uniqueMotivoNome(label: string): string {
  return `Teste Motivo Remoto RPC ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Semeia um motivo de conclusao remota ATIVO, via service role. */
async function seedMotivoAtivo(label: string): Promise<{ id: string; nome: string }> {
  const admin = serviceClient()
  const nome = uniqueMotivoNome(label)
  const { data, error } = await admin
    .from("motivos_conclusao_remota")
    .insert({ nome })
    .select("id, nome")
    .single()
  if (error || !data) {
    throw new Error(`Failed to seed test motivo: ${error?.message}`)
  }
  createdMotivoIds.push(data.id as string)
  return { id: data.id as string, nome: data.nome as string }
}

/** Semeia um motivo de conclusao remota DESATIVADO, via service role. */
async function seedMotivoDesativado(label: string): Promise<{ id: string }> {
  const admin = serviceClient()
  const nome = uniqueMotivoNome(label)
  const { data, error } = await admin
    .from("motivos_conclusao_remota")
    .insert({ nome, ativo: false })
    .select("id")
    .single()
  if (error || !data) {
    throw new Error(`Failed to seed inactive test motivo: ${error?.message}`)
  }
  createdMotivoIds.push(data.id as string)
  return { id: data.id as string }
}

/** Cliente ainda em prospeccao, com uma tarefa pendente com data. */
async function seedClienteProspeccao(
  client: SupabaseClient,
  responsavelId: string,
  label: string
): Promise<{ clienteId: string; tarefaId: string }> {
  const tipoTarefa = await getActiveTipoTarefa()
  const { data: cliente, error: clienteError } = await client
    .from("clientes")
    .insert(baseClienteFields(uniqueRazaoSocial(label), responsavelId))
    .select("id")
    .single()
  if (clienteError || !cliente) {
    throw new Error(`Failed to seed test cliente: ${clienteError?.message}`)
  }
  createdClienteIds.push(cliente.id)

  const { data: tarefa, error: tarefaError } = await client
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

  return { clienteId: cliente.id as string, tarefaId: tarefa.id as string }
}

/**
 * Cliente ja "ganho" com a frequencia dada, e uma visita pendente. Usa
 * serviceClient() para inserir direto — mais simples para montar o
 * cenario base de conclusao.
 */
async function seedClienteGanho(
  responsavelId: string,
  label: string,
  frequenciaVisita: "semanal" | "quinzenal" | "mensal" | "nenhuma" | null
): Promise<{ clienteId: string; visitaId: string }> {
  const admin = serviceClient()
  const { data: cliente, error: clienteError } = await admin
    .from("clientes")
    .insert({
      ...baseClienteFields(uniqueRazaoSocial(label), responsavelId),
      etapa: ETAPA_FINAL,
      status_acompanhamento: "ganho",
      frequencia_visita: frequenciaVisita,
    })
    .select("id")
    .single()
  if (clienteError || !cliente) {
    throw new Error(
      `Failed to seed test cliente ganho: ${clienteError?.message}`
    )
  }
  createdClienteIds.push(cliente.id)

  const { data: visita, error: visitaError } = await admin
    .from("visitas")
    .insert({ cliente_id: cliente.id, data_prevista: "2026-09-10" })
    .select("id")
    .single()
  if (visitaError || !visita) {
    throw new Error(`Failed to seed test visita: ${visitaError?.message}`)
  }

  return { clienteId: cliente.id as string, visitaId: visita.id as string }
}

let vendedorA: SupabaseClient
let vendedorAId: string

beforeAll(async () => {
  vendedorA = await signInAs(
    SEED_ACCOUNTS.vendedorA.email,
    SEED_ACCOUNTS.vendedorA.password
  )
  vendedorAId = await getUserId(vendedorA)
})

describe("concluir_tarefa_prospeccao: conclusao remota grava o motivo e resolve o nome no Diario (CONC-02/CONC-05)", () => {
  it("prospeccao: concluir uma tarefa passando o motivo grava a coluna, marca concluida, e o Diario traz o nome entre colchetes seguido do resumo", async () => {
    const motivo = await seedMotivoAtivo("prospeccao")
    const { clienteId, tarefaId } = await seedClienteProspeccao(
      vendedorA,
      vendedorAId,
      "prospeccao"
    )
    const resumo = "Cliente confirmou o pedido pelo telefone."

    const { error } = await vendedorA.rpc("concluir_tarefa_prospeccao", {
      p_tarefa_id: tarefaId,
      p_resumo: resumo,
      p_motivo_conclusao_remota_id: motivo.id,
    })
    expect(error).toBeNull()

    const { data: tarefa } = await vendedorA
      .from("tarefas")
      .select("concluida, motivo_conclusao_remota_id")
      .eq("id", tarefaId)
      .single()
    expect(tarefa?.concluida).toBe(true)
    expect(tarefa?.motivo_conclusao_remota_id).toBe(motivo.id)

    const { data: historicoRows } = await vendedorA
      .from("historico")
      .select("descricao")
      .eq("cliente_id", clienteId)
      .eq("tipo", "tarefa_concluida")
      .order("criado_em", { ascending: false })
      .limit(1)
    expect(historicoRows?.[0]?.descricao).toBe(`[${motivo.nome}] ${resumo}`)
  })
})

describe("concluir_visita: conclusao remota de visita continua criando a proxima visita pela frequencia (CONC-04)", () => {
  it("visita: cliente mensal, concluir remotamente com proxima data grava a coluna, o Diario traz o nome, e a proxima visita e criada com a data confirmada", async () => {
    const motivo = await seedMotivoAtivo("visita")
    const { clienteId, visitaId } = await seedClienteGanho(
      vendedorAId,
      "visita",
      "mensal"
    )
    const resumo = "Pedido confirmado por WhatsApp para o mes que vem."
    const proximaData = "2026-12-25"

    const { error } = await vendedorA.rpc("concluir_visita", {
      p_visita_id: visitaId,
      p_resumo: resumo,
      p_proxima_data: proximaData,
      p_motivo_conclusao_remota_id: motivo.id,
    })
    expect(error).toBeNull()

    const { data: visitaFechada } = await vendedorA
      .from("visitas")
      .select("data_realizada, motivo_conclusao_remota_id")
      .eq("id", visitaId)
      .single()
    expect(visitaFechada?.data_realizada).not.toBeNull()
    expect(visitaFechada?.motivo_conclusao_remota_id).toBe(motivo.id)

    const { data: historicoRows } = await vendedorA
      .from("historico")
      .select("descricao")
      .eq("cliente_id", clienteId)
      .eq("tipo", "visita_concluida")
      .order("criado_em", { ascending: false })
      .limit(1)
    expect(historicoRows?.[0]?.descricao).toBe(`[${motivo.nome}] ${resumo}`)

    const { data: pendentes } = await vendedorA
      .from("visitas")
      .select("id, data_prevista")
      .eq("cliente_id", clienteId)
      .is("data_realizada", null)
    expect(pendentes ?? []).toHaveLength(1)
    expect(pendentes?.[0]?.data_prevista).toBe(proximaData)
  })
})

describe("conclusao presencial (sem motivo) continua identica a hoje — nao-regressao (D-01)", () => {
  it("presencial: concluir tarefa e visita SEM motivo deixa a coluna nova vazia e o Diario exatamente igual ao resumo, sem colchete", async () => {
    const { clienteId: clienteTarefaId, tarefaId } =
      await seedClienteProspeccao(vendedorA, vendedorAId, "presencial-tarefa")
    const { clienteId: clienteVisitaId, visitaId } = await seedClienteGanho(
      vendedorAId,
      "presencial-visita",
      "nenhuma"
    )
    const resumoTarefa = "Visita presencial realizada, tudo certo."
    const resumoVisita = "Visita presencial concluida sem intercorrencias."

    const { error: tarefaError } = await vendedorA.rpc(
      "concluir_tarefa_prospeccao",
      { p_tarefa_id: tarefaId, p_resumo: resumoTarefa }
    )
    expect(tarefaError).toBeNull()

    const { error: visitaError } = await vendedorA.rpc("concluir_visita", {
      p_visita_id: visitaId,
      p_resumo: resumoVisita,
      p_proxima_data: null,
    })
    expect(visitaError).toBeNull()

    const { data: tarefa } = await vendedorA
      .from("tarefas")
      .select("motivo_conclusao_remota_id")
      .eq("id", tarefaId)
      .single()
    expect(tarefa?.motivo_conclusao_remota_id).toBeNull()

    const { data: visita } = await vendedorA
      .from("visitas")
      .select("motivo_conclusao_remota_id")
      .eq("id", visitaId)
      .single()
    expect(visita?.motivo_conclusao_remota_id).toBeNull()

    const { data: historicoTarefa } = await vendedorA
      .from("historico")
      .select("descricao")
      .eq("cliente_id", clienteTarefaId)
      .eq("tipo", "tarefa_concluida")
      .order("criado_em", { ascending: false })
      .limit(1)
    expect(historicoTarefa?.[0]?.descricao).toBe(resumoTarefa)
    expect(historicoTarefa?.[0]?.descricao).not.toContain("[")

    const { data: historicoVisita } = await vendedorA
      .from("historico")
      .select("descricao")
      .eq("cliente_id", clienteVisitaId)
      .eq("tipo", "visita_concluida")
      .order("criado_em", { ascending: false })
      .limit(1)
    expect(historicoVisita?.[0]?.descricao).toBe(resumoVisita)
    expect(historicoVisita?.[0]?.descricao).not.toContain("[")
  })
})

describe("Diario nunca estampa o identificador cru do motivo — so o nome resolvido (CONC-05)", () => {
  it("identificador: o texto do Diario de uma conclusao remota NAO contem o identificador (uuid) do motivo", async () => {
    const motivo = await seedMotivoAtivo("identificador")
    const { clienteId, tarefaId } = await seedClienteProspeccao(
      vendedorA,
      vendedorAId,
      "identificador"
    )
    const resumo = "Pedido fechado por e-mail nesta semana."

    const { error } = await vendedorA.rpc("concluir_tarefa_prospeccao", {
      p_tarefa_id: tarefaId,
      p_resumo: resumo,
      p_motivo_conclusao_remota_id: motivo.id,
    })
    expect(error).toBeNull()

    const { data: historicoRows } = await vendedorA
      .from("historico")
      .select("descricao")
      .eq("cliente_id", clienteId)
      .eq("tipo", "tarefa_concluida")
      .order("criado_em", { ascending: false })
      .limit(1)
    expect(historicoRows?.[0]?.descricao).not.toContain(motivo.id)
    expect(historicoRows?.[0]?.descricao).toContain(motivo.nome)
  })
})

describe("motivo invalido (inexistente ou desativado) e recusado pelo banco no momento da conclusao", () => {
  it("invalido: identificador inexistente derruba a conclusao da tarefa e a tarefa continua pendente", async () => {
    const { tarefaId } = await seedClienteProspeccao(
      vendedorA,
      vendedorAId,
      "invalido-inexistente"
    )
    const identificadorInexistente = "00000000-0000-0000-0000-000000000000"

    const { error } = await vendedorA.rpc("concluir_tarefa_prospeccao", {
      p_tarefa_id: tarefaId,
      p_resumo: "Este pedido nao deveria ser aceito pelo banco.",
      p_motivo_conclusao_remota_id: identificadorInexistente,
    })
    expect(error).not.toBeNull()

    const { data: tarefa } = await vendedorA
      .from("tarefas")
      .select("concluida")
      .eq("id", tarefaId)
      .single()
    expect(tarefa?.concluida).toBe(false)
  })

  it("invalido: identificador de motivo DESATIVADO derruba a conclusao da visita e a visita continua pendente", async () => {
    const motivoDesativado = await seedMotivoDesativado("invalido-desativado")
    const { visitaId } = await seedClienteGanho(
      vendedorAId,
      "invalido-desativado",
      "mensal"
    )

    const { error } = await vendedorA.rpc("concluir_visita", {
      p_visita_id: visitaId,
      p_resumo: "Este pedido tambem nao deveria ser aceito pelo banco.",
      p_proxima_data: "2026-12-25",
      p_motivo_conclusao_remota_id: motivoDesativado.id,
    })
    expect(error).not.toBeNull()

    const { data: visita } = await vendedorA
      .from("visitas")
      .select("data_realizada")
      .eq("id", visitaId)
      .single()
    expect(visita?.data_realizada).toBeNull()
  })
})

describe("chamar as duas funcoes na forma ANTIGA continua funcionando — prova mecanica de nao haver assinatura ambigua (D-06)", () => {
  it("assinatura: concluir_tarefa_prospeccao sem a chave do parametro novo no objeto de argumentos continua funcionando", async () => {
    const { tarefaId } = await seedClienteProspeccao(
      vendedorA,
      vendedorAId,
      "assinatura-tarefa"
    )

    const { error } = await vendedorA.rpc("concluir_tarefa_prospeccao", {
      p_tarefa_id: tarefaId,
      p_resumo: "Chamada no formato antigo, sem o parametro novo.",
    })
    expect(error).toBeNull()

    const { data: tarefa } = await vendedorA
      .from("tarefas")
      .select("concluida")
      .eq("id", tarefaId)
      .single()
    expect(tarefa?.concluida).toBe(true)
  })

  it("assinatura: concluir_visita sem a chave do parametro novo no objeto de argumentos continua funcionando", async () => {
    const { visitaId } = await seedClienteGanho(
      vendedorAId,
      "assinatura-visita",
      "nenhuma"
    )

    const { error } = await vendedorA.rpc("concluir_visita", {
      p_visita_id: visitaId,
      p_resumo: "Chamada no formato antigo, sem o parametro novo.",
      p_proxima_data: null,
    })
    expect(error).toBeNull()

    const { data: visita } = await vendedorA
      .from("visitas")
      .select("data_realizada")
      .eq("id", visitaId)
      .single()
    expect(visita?.data_realizada).not.toBeNull()
  })
})
