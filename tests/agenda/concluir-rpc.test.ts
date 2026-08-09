import { afterEach, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { addMonths, format, parseISO } from "date-fns"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"
import { ETAPA_FINAL } from "../../lib/funil/etapas"

/**
 * Integration tests for the Fase 15 Plan 1 database write layer
 * (15-01-PLAN.md, migration 0015) — as duas RPCs de conclusao
 * (`concluir_tarefa_prospeccao`, `concluir_visita`), a extensao dos
 * gatilhos de auditoria (CONC-01 criterio 5) e as duas colunas novas de
 * `agenda_do_vendedor()` (VIS-03, Pitfall 1).
 *
 * Mesmo padrao de todo teste de integracao deste projeto: sessoes reais
 * via signInAs()/SEED_ACCOUNTS, serviceClient() usado SOMENTE para semear
 * e limpar (nunca para afirmar comportamento de RLS). Vendedor A e logado
 * UMA vez neste arquivo (rate limit documentado em STATE.md) e reusado em
 * todos os casos abaixo.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste ConcluirRPC ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

/** Hoje no fuso de São Paulo, em YYYY-MM-DD — nunca a partir de string ISO crua (Pitfall 1). */
function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date())
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
 * serviceClient() para inserir direto (bypassa mover_card_funil, ja
 * provado por tests/clientes/frequencia-visita.test.ts) — mais simples
 * para montar o cenario base de conclusao. `frequenciaVisita` null simula
 * o cliente legado sem frequencia definida (VIS-04).
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

describe("conclusao: obrigatoriedade do resumo nos dois caminhos (CONC-01)", () => {
  it("resumocurto: resumo com 3 caracteres e recusado para tarefa e para visita, sem deixar efeito colateral", async () => {
    const { clienteId: clienteTarefaId, tarefaId } =
      await seedClienteProspeccao(vendedorA, vendedorAId, "resumocurto-tarefa")

    const { error: tarefaError } = await vendedorA.rpc(
      "concluir_tarefa_prospeccao",
      { p_tarefa_id: tarefaId, p_resumo: "abc" }
    )
    expect(tarefaError).not.toBeNull()

    const { data: tarefa } = await vendedorA
      .from("tarefas")
      .select("concluida, resumo")
      .eq("id", tarefaId)
      .single()
    expect(tarefa?.concluida).toBe(false)
    expect(tarefa?.resumo).toBeNull()

    const { data: historicoTarefa } = await vendedorA
      .from("historico")
      .select("id")
      .eq("cliente_id", clienteTarefaId)
    expect(historicoTarefa ?? []).toHaveLength(0)

    const { visitaId } = await seedClienteGanho(
      vendedorAId,
      "resumocurto-visita",
      "mensal"
    )

    const { error: visitaError } = await vendedorA.rpc("concluir_visita", {
      p_visita_id: visitaId,
      p_resumo: "abc",
      p_proxima_data: "2026-10-10",
    })
    expect(visitaError).not.toBeNull()

    const { data: visita } = await vendedorA
      .from("visitas")
      .select("data_realizada, resumo")
      .eq("id", visitaId)
      .single()
    expect(visita?.data_realizada).toBeNull()
    expect(visita?.resumo).toBeNull()
  })

  it("resumovazio: resumo so com espacos e recusado do mesmo jeito", async () => {
    const { tarefaId } = await seedClienteProspeccao(
      vendedorA,
      vendedorAId,
      "resumovazio"
    )

    const { error } = await vendedorA.rpc("concluir_tarefa_prospeccao", {
      p_tarefa_id: tarefaId,
      p_resumo: "          ",
    })
    expect(error).not.toBeNull()

    const { data: tarefa } = await vendedorA
      .from("tarefas")
      .select("concluida")
      .eq("id", tarefaId)
      .single()
    expect(tarefa?.concluida).toBe(false)
  })

  it("resumolongo: resumo com 501 caracteres e recusado", async () => {
    const { tarefaId } = await seedClienteProspeccao(
      vendedorA,
      vendedorAId,
      "resumolongo"
    )

    const { error } = await vendedorA.rpc("concluir_tarefa_prospeccao", {
      p_tarefa_id: tarefaId,
      p_resumo: "a".repeat(501),
    })
    expect(error).not.toBeNull()

    const { data: tarefa } = await vendedorA
      .from("tarefas")
      .select("concluida")
      .eq("id", tarefaId)
      .single()
    expect(tarefa?.concluida).toBe(false)
  })
})

describe("concluir_tarefa_prospeccao: conclusao valida (CONC-01)", () => {
  it("tarefa: resumo valido marca a tarefa concluida, grava o resumo aparado, preenche o carimbo, e some da agenda", async () => {
    const { tarefaId } = await seedClienteProspeccao(
      vendedorA,
      vendedorAId,
      "tarefa"
    )

    const { error } = await vendedorA.rpc("concluir_tarefa_prospeccao", {
      p_tarefa_id: tarefaId,
      p_resumo: "  Cliente confirmou pedido para a proxima semana.  ",
    })
    expect(error).toBeNull()

    const { data: tarefa } = await vendedorA
      .from("tarefas")
      .select("concluida, resumo, concluida_em")
      .eq("id", tarefaId)
      .single()
    expect(tarefa?.concluida).toBe(true)
    expect(tarefa?.resumo).toBe(
      "Cliente confirmou pedido para a proxima semana."
    )
    expect(tarefa?.concluida_em).not.toBeNull()

    const { data: agenda } = await vendedorA.rpc("agenda_do_vendedor")
    const ids = ((agenda ?? []) as { item_id: string }[]).map(
      (r) => r.item_id
    )
    expect(ids).not.toContain(tarefaId)
  })
})

describe("historico: resumo grava exatamente com autor e data (CONC-01 criterio 5)", () => {
  it("historico: apos concluir tarefa e visita, historico traz descricao identica ao resumo, autor e data preenchida", async () => {
    const { clienteId: clienteTarefaId, tarefaId } =
      await seedClienteProspeccao(vendedorA, vendedorAId, "historico-tarefa")
    const { clienteId: clienteVisitaId, visitaId } = await seedClienteGanho(
      vendedorAId,
      "historico-visita",
      "nenhuma"
    )

    const resumoTarefa = "Conversa boa, cliente vai confirmar ate sexta."
    const resumoVisita = "Visita realizada, tudo certo com o pedido atual."

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

    const { data: historicoTarefa } = await vendedorA
      .from("historico")
      .select("descricao, autor_id, criado_em")
      .eq("cliente_id", clienteTarefaId)
      .eq("tipo", "tarefa_concluida")
      .order("criado_em", { ascending: false })
      .limit(1)
    expect(historicoTarefa?.[0]?.descricao).toBe(resumoTarefa)
    expect(historicoTarefa?.[0]?.autor_id).toBe(vendedorAId)
    expect(historicoTarefa?.[0]?.criado_em).not.toBeNull()

    const { data: historicoVisita } = await vendedorA
      .from("historico")
      .select("descricao, autor_id, criado_em")
      .eq("cliente_id", clienteVisitaId)
      .eq("tipo", "visita_concluida")
      .order("criado_em", { ascending: false })
      .limit(1)
    expect(historicoVisita?.[0]?.descricao).toBe(resumoVisita)
    expect(historicoVisita?.[0]?.autor_id).toBe(vendedorAId)
    expect(historicoVisita?.[0]?.criado_em).not.toBeNull()
  })
})

describe("concluir_visita: fecha a atual e cria a proxima com a data confirmada (VIS-03)", () => {
  it("visita: cliente mensal fecha a visita, grava resumo, cria exatamente 1 proxima visita com a data enviada (nao a sugerida)", async () => {
    const { visitaId, clienteId } = await seedClienteGanho(
      vendedorAId,
      "visita",
      "mensal"
    )
    const dataEnviada = "2026-12-25"

    const { error } = await vendedorA.rpc("concluir_visita", {
      p_visita_id: visitaId,
      p_resumo: "Visita realizada, cliente satisfeito com o atendimento.",
      p_proxima_data: dataEnviada,
    })
    expect(error).toBeNull()

    const { data: visitaFechada } = await vendedorA
      .from("visitas")
      .select("data_realizada, resumo")
      .eq("id", visitaId)
      .single()
    expect(visitaFechada?.data_realizada).not.toBeNull()
    expect(visitaFechada?.resumo).not.toBeNull()

    const { data: pendentes } = await vendedorA
      .from("visitas")
      .select("id, data_prevista")
      .eq("cliente_id", clienteId)
      .is("data_realizada", null)
    expect(pendentes ?? []).toHaveLength(1)
    expect(pendentes?.[0]?.data_prevista).toBe(dataEnviada)

    const { data: agenda } = await vendedorA.rpc("agenda_do_vendedor")
    const rows = (agenda ?? []) as { item_id: string; cliente_id: string }[]
    const idsDoCliente = rows
      .filter((r) => r.cliente_id === clienteId)
      .map((r) => r.item_id)
    expect(idsDoCliente).not.toContain(visitaId)
    expect(idsDoCliente).toContain(pendentes?.[0]?.id)
  })
})

describe("concluir_visita: frequencia 'nenhuma' nao cria proxima visita (VIS-03 criterio 4)", () => {
  it("nenhuma: concluir visita de cliente com frequencia nenhuma, mesmo enviando data, fecha a visita e nao cria nenhuma nova", async () => {
    const { visitaId, clienteId } = await seedClienteGanho(
      vendedorAId,
      "nenhuma",
      "nenhuma"
    )

    const { error } = await vendedorA.rpc("concluir_visita", {
      p_visita_id: visitaId,
      p_resumo: "Visita realizada, cliente sem cadencia definida agora.",
      p_proxima_data: "2026-12-25",
    })
    expect(error).toBeNull()

    const { data: todasVisitas } = await vendedorA
      .from("visitas")
      .select("id")
      .eq("cliente_id", clienteId)
    expect(todasVisitas ?? []).toHaveLength(1)
  })
})

describe("concluir_visita: cliente legado sem frequencia definida (VIS-04)", () => {
  it("semfrequencia: mesmo comportamento do 'nenhuma' para cliente legado sem frequencia definida", async () => {
    const { visitaId, clienteId } = await seedClienteGanho(
      vendedorAId,
      "semfrequencia",
      null
    )

    const { error } = await vendedorA.rpc("concluir_visita", {
      p_visita_id: visitaId,
      p_resumo: "Visita realizada, cliente legado sem frequencia definida.",
      p_proxima_data: "2026-12-25",
    })
    expect(error).toBeNull()

    const { data: todasVisitas } = await vendedorA
      .from("visitas")
      .select("id")
      .eq("cliente_id", clienteId)
    expect(todasVisitas ?? []).toHaveLength(1)
  })
})

describe("concluir_visita: falta de data confirmada com frequencia real falha alto (VIS-03)", () => {
  it("semdata: cliente com frequencia real e data nula e recusado, visita continua pendente", async () => {
    const { visitaId } = await seedClienteGanho(
      vendedorAId,
      "semdata",
      "mensal"
    )

    const { error } = await vendedorA.rpc("concluir_visita", {
      p_visita_id: visitaId,
      p_resumo: "Visita realizada, mas esqueci de confirmar a proxima data.",
      p_proxima_data: null,
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

describe("agenda_do_vendedor: colunas de sugestao coerentes (Pitfall 1)", () => {
  it("sugerida: cada linha de visita traz frequencia e uma data sugerida coerente; prospeccao vem sempre vazia", async () => {
    const { clienteId: clienteVisitaId } = await seedClienteGanho(
      vendedorAId,
      "sugerida-visita",
      "mensal"
    )
    const { tarefaId } = await seedClienteProspeccao(
      vendedorA,
      vendedorAId,
      "sugerida-tarefa"
    )

    const { data, error } = await vendedorA.rpc("agenda_do_vendedor")
    expect(error).toBeNull()
    const rows = (data ?? []) as {
      item_id: string
      cliente_id: string
      origem: string
      frequencia_visita: string | null
      proxima_data_sugerida: string | null
    }[]

    const linhaVisita = rows.find(
      (r) => r.cliente_id === clienteVisitaId && r.origem === "visita"
    )
    expect(linhaVisita).toBeDefined()
    expect(linhaVisita?.frequencia_visita).toBe("mensal")
    expect(linhaVisita?.proxima_data_sugerida).not.toBeNull()

    const esperado = format(
      addMonths(parseISO(hojeSaoPaulo()), 1),
      "yyyy-MM-dd"
    )
    expect(linhaVisita?.proxima_data_sugerida).toBe(esperado)

    const linhaTarefa = rows.find((r) => r.item_id === tarefaId)
    expect(linhaTarefa).toBeDefined()
    expect(linhaTarefa?.frequencia_visita).toBeNull()
    expect(linhaTarefa?.proxima_data_sugerida).toBeNull()
  })
})

describe("concluir_visita: idempotencia (nao conclui duas vezes)", () => {
  it("duplicada: concluir a mesma visita duas vezes seguidas - a segunda e recusada e nao cria uma terceira visita", async () => {
    const { visitaId, clienteId } = await seedClienteGanho(
      vendedorAId,
      "duplicada",
      "quinzenal"
    )

    const primeira = await vendedorA.rpc("concluir_visita", {
      p_visita_id: visitaId,
      p_resumo: "Primeira conclusao desta visita, tudo certo.",
      p_proxima_data: "2026-11-01",
    })
    expect(primeira.error).toBeNull()

    const segunda = await vendedorA.rpc("concluir_visita", {
      p_visita_id: visitaId,
      p_resumo: "Segunda tentativa, deveria ser recusada.",
      p_proxima_data: "2026-11-15",
    })
    expect(segunda.error).not.toBeNull()

    const { data: todasVisitas } = await vendedorA
      .from("visitas")
      .select("id")
      .eq("cliente_id", clienteId)
    expect(todasVisitas ?? []).toHaveLength(2)
  })
})
