import { afterEach, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Integration tests for `agenda_concluidos_do_vendedor(p_inicio, p_fim)`
 * (AGD-13, Fase 21 Plan 1) — proves the shape of the new historical read:
 * origem/titulo per frente, a data devolvida sendo a data REAL de
 * conclusao (nunca a prevista), o fuso de Sao Paulo na virada do dia, o
 * corte por periodo cortando de verdade, a exclusao de itens ainda
 * pendentes, e as duas colunas de agendamento futuro sempre vazias.
 *
 * Estrutura identica a tests/agenda/agenda-rpc.test.ts: mesmos helpers de
 * semeadura/limpeza, mesmo cliente de servico so para semear/limpar,
 * login de Vendedor A feito UMA unica vez no beforeAll (nunca dentro de
 * um caso).
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste AgendaConcluidos ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

type AgendaConcluidoRow = {
  origem: string
  item_id: string
  cliente_id: string
  razao_social: string
  responsavel: string
  responsavel_nome: string | null
  titulo: string
  data: string
  frequencia_visita: string | null
  proxima_data_sugerida: string | null
}

const createdClienteIds: string[] = []

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  const admin = serviceClient()
  // `on delete cascade` em tarefas.cliente_id/visitas.cliente_id cobre a
  // limpeza dos itens semeados junto do cliente.
  await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
})

async function getUserId(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
}

async function getActiveTipoTarefa(): Promise<{ id: string; nome: string }> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from("tipos_tarefa")
    .select("id, nome")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error("Nenhum tipo de tarefa ativo encontrado para o teste")
  }
  return data as { id: string; nome: string }
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

/**
 * Semeia uma tarefa concluida com o carimbo de conclusao (concluida_em)
 * gravado EXATAMENTE no instante pedido. O gatilho de tarefas
 * (tarefas_before_update_historico, migration 0002/0015) so carimba
 * concluida_em quando `concluida` transiciona de false para true — por
 * isso o SEGUNDO update abaixo, feito depois que a tarefa ja esta
 * concluida, sobrescreve o carimbo sem o gatilho tentar recarimba-lo com
 * now() (a condicao dele exige a transicao, que ja aconteceu).
 */
async function seedTarefaConcluida(
  vendedor: SupabaseClient,
  responsavelId: string,
  tipoTarefaId: string,
  label: string,
  dataPrevista: string,
  concluidaEmIso: string
): Promise<{ clienteId: string; tarefaId: string }> {
  const clienteId = await createTestCliente(vendedor, responsavelId, label)
  const { data: tarefa, error: tarefaError } = await vendedor
    .from("tarefas")
    .insert({
      cliente_id: clienteId,
      tipo_tarefa_id: tipoTarefaId,
      data_conclusao: dataPrevista,
    })
    .select("id")
    .single()
  if (tarefaError || !tarefa) {
    throw new Error(`Failed to seed test tarefa: ${tarefaError?.message}`)
  }

  const admin = serviceClient()
  await admin.from("tarefas").update({ concluida: true }).eq("id", tarefa.id)
  await admin
    .from("tarefas")
    .update({ concluida_em: concluidaEmIso })
    .eq("id", tarefa.id)

  return { clienteId, tarefaId: tarefa.id as string }
}

/**
 * Semeia uma visita realizada com `data_realizada` gravada diretamente —
 * e coluna `date` pura, sem componente de fuso, entao nada a carimbar via
 * gatilho aqui.
 */
async function seedVisitaRealizada(
  vendedor: SupabaseClient,
  responsavelId: string,
  label: string,
  dataPrevista: string,
  dataRealizada: string
): Promise<{ clienteId: string; visitaId: string }> {
  const clienteId = await createTestCliente(vendedor, responsavelId, label)
  const { data: visita, error: visitaError } = await vendedor
    .from("visitas")
    .insert({ cliente_id: clienteId, data_prevista: dataPrevista })
    .select("id")
    .single()
  if (visitaError || !visita) {
    throw new Error(`Failed to seed test visita: ${visitaError?.message}`)
  }

  const admin = serviceClient()
  await admin
    .from("visitas")
    .update({ data_realizada: dataRealizada })
    .eq("id", visita.id)

  return { clienteId, visitaId: visita.id as string }
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

describe("agenda_concluidos_do_vendedor: origem e titulo de cada frente", () => {
  it("origem: tarefa concluida e visita realizada, ambas dentro do intervalo, voltam com origem e titulo corretos", async () => {
    const tipoTarefa = await getActiveTipoTarefa()
    const seedTarefa = await seedTarefaConcluida(
      vendedorA,
      vendedorAId,
      tipoTarefa.id,
      "origem-tarefa",
      "2026-01-05",
      "2026-01-10T12:00:00-03:00"
    )
    const seedVisita = await seedVisitaRealizada(
      vendedorA,
      vendedorAId,
      "origem-visita",
      "2026-01-01",
      "2026-01-11"
    )

    const { data, error } = await vendedorA.rpc(
      "agenda_concluidos_do_vendedor",
      { p_inicio: "2026-01-01", p_fim: "2026-01-31" }
    )
    expect(error).toBeNull()
    const rows = (data ?? []) as AgendaConcluidoRow[]

    const tarefaRow = rows.find((r) => r.item_id === seedTarefa.tarefaId)
    const visitaRow = rows.find((r) => r.item_id === seedVisita.visitaId)
    expect(tarefaRow).toBeDefined()
    expect(tarefaRow?.origem).toBe("prospeccao")
    expect(tarefaRow?.titulo).toBe(tipoTarefa.nome)
    expect(visitaRow).toBeDefined()
    expect(visitaRow?.origem).toBe("visita")
    expect(visitaRow?.titulo).toBe("Visita")
  })
})

describe("agenda_concluidos_do_vendedor: a data devolvida e a data REAL de conclusao (D-04)", () => {
  it("datareal: a data devolvida e a da conclusao, nunca a data prevista original", async () => {
    const tipoTarefa = await getActiveTipoTarefa()
    const seedTarefa = await seedTarefaConcluida(
      vendedorA,
      vendedorAId,
      tipoTarefa.id,
      "datareal-tarefa",
      "2026-02-01",
      "2026-02-20T12:00:00-03:00"
    )
    const seedVisita = await seedVisitaRealizada(
      vendedorA,
      vendedorAId,
      "datareal-visita",
      "2026-02-02",
      "2026-02-21"
    )

    const { data, error } = await vendedorA.rpc(
      "agenda_concluidos_do_vendedor",
      { p_inicio: "2026-02-01", p_fim: "2026-02-28" }
    )
    expect(error).toBeNull()
    const rows = (data ?? []) as AgendaConcluidoRow[]

    const tarefaRow = rows.find((r) => r.item_id === seedTarefa.tarefaId)
    const visitaRow = rows.find((r) => r.item_id === seedVisita.visitaId)
    expect(tarefaRow?.data).toBe("2026-02-20")
    expect(visitaRow?.data).toBe("2026-02-21")
  })
})

describe("agenda_concluidos_do_vendedor: fuso de Sao Paulo na virada do dia (refinamento 2)", () => {
  it("fuso: tarefa concluida as 23h30 no horario de Sao Paulo cai no dia da conclusao, nunca no dia seguinte", async () => {
    const tipoTarefa = await getActiveTipoTarefa()
    const seedTarefa = await seedTarefaConcluida(
      vendedorA,
      vendedorAId,
      tipoTarefa.id,
      "fuso-tarefa",
      "2026-03-01",
      "2026-03-15T23:30:00-03:00"
    )

    const { data, error } = await vendedorA.rpc(
      "agenda_concluidos_do_vendedor",
      { p_inicio: "2026-03-01", p_fim: "2026-03-31" }
    )
    expect(error).toBeNull()
    const rows = (data ?? []) as AgendaConcluidoRow[]
    const tarefaRow = rows.find((r) => r.item_id === seedTarefa.tarefaId)
    expect(tarefaRow?.data).toBe("2026-03-15")
  })
})

describe("agenda_concluidos_do_vendedor: corte por periodo (D-02)", () => {
  it("intervalo: dois itens concluidos em dias diferentes — pedir um intervalo que contem so um deles nao devolve o outro", async () => {
    const tipoTarefa = await getActiveTipoTarefa()
    const dentro = await seedTarefaConcluida(
      vendedorA,
      vendedorAId,
      tipoTarefa.id,
      "intervalo-dentro",
      "2026-04-01",
      "2026-04-10T12:00:00-03:00"
    )
    const fora = await seedTarefaConcluida(
      vendedorA,
      vendedorAId,
      tipoTarefa.id,
      "intervalo-fora",
      "2026-04-01",
      "2026-05-10T12:00:00-03:00"
    )

    const { data, error } = await vendedorA.rpc(
      "agenda_concluidos_do_vendedor",
      { p_inicio: "2026-04-01", p_fim: "2026-04-30" }
    )
    expect(error).toBeNull()
    const ids = ((data ?? []) as AgendaConcluidoRow[]).map((r) => r.item_id)
    expect(ids).toContain(dentro.tarefaId)
    expect(ids).not.toContain(fora.tarefaId)
  })
})

describe("agenda_concluidos_do_vendedor: item ainda pendente nunca aparece nesta leitura", () => {
  it("pendente: tarefa nao concluida e visita sem data realizada nao aparecem, mesmo com o intervalo cobrindo as datas previstas delas", async () => {
    const tipoTarefa = await getActiveTipoTarefa()
    const clienteId = await createTestCliente(
      vendedorA,
      vendedorAId,
      "pendente"
    )

    const { data: tarefaPendente } = await vendedorA
      .from("tarefas")
      .insert({
        cliente_id: clienteId,
        tipo_tarefa_id: tipoTarefa.id,
        data_conclusao: "2026-05-10",
      })
      .select("id")
      .single()

    const { data: visitaPendente } = await vendedorA
      .from("visitas")
      .insert({ cliente_id: clienteId, data_prevista: "2026-05-11" })
      .select("id")
      .single()

    const { data, error } = await vendedorA.rpc(
      "agenda_concluidos_do_vendedor",
      { p_inicio: "2026-05-01", p_fim: "2026-05-31" }
    )
    expect(error).toBeNull()
    const ids = ((data ?? []) as AgendaConcluidoRow[]).map((r) => r.item_id)
    expect(ids).not.toContain(tarefaPendente!.id)
    expect(ids).not.toContain(visitaPendente!.id)
  })
})

describe("agenda_concluidos_do_vendedor: colunas de agendamento futuro sempre vazias", () => {
  it("vazias: toda linha devolvida traz frequencia_visita e proxima_data_sugerida vazias", async () => {
    const tipoTarefa = await getActiveTipoTarefa()
    const seedTarefa = await seedTarefaConcluida(
      vendedorA,
      vendedorAId,
      tipoTarefa.id,
      "vazias-tarefa",
      "2026-06-01",
      "2026-06-10T12:00:00-03:00"
    )
    const seedVisita = await seedVisitaRealizada(
      vendedorA,
      vendedorAId,
      "vazias-visita",
      "2026-06-02",
      "2026-06-11"
    )

    const { data, error } = await vendedorA.rpc(
      "agenda_concluidos_do_vendedor",
      { p_inicio: "2026-06-01", p_fim: "2026-06-30" }
    )
    expect(error).toBeNull()
    const rows = (data ?? []) as AgendaConcluidoRow[]
    const relevantes = rows.filter(
      (r) =>
        r.item_id === seedTarefa.tarefaId || r.item_id === seedVisita.visitaId
    )
    expect(relevantes).toHaveLength(2)
    for (const row of relevantes) {
      expect(row.frequencia_visita).toBeNull()
      expect(row.proxima_data_sugerida).toBeNull()
    }
  })
})
