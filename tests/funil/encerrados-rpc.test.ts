import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  createTestMember,
  deleteTestMember,
  serviceClient,
  signInAs,
  type TestMember,
} from "../helpers/supabase-test-clients"

/**
 * Integration tests for the migration 0036 surface (29-01-PLAN.md,
 * ENCR-01..05): motivos_encerramento (7a lista editável), mover_card_funil
 * de 8 parâmetros (encerrar/reativar), agenda_do_vendedor filtrando
 * encerrado, e a leitura clientes_encerrados.
 *
 * NUNCA usar as contas semente antigas (`vendedor.a+test`/`vendedor.b+test`),
 * apagadas em 2026-08-19 (ver STATE.md) — este arquivo usa
 * `createTestMember`/`deleteTestMember` para fixtures descartáveis. O
 * projeto Supabase de teste É o de produção, com dados reais de clientes —
 * por isso este arquivo NUNCA imprime uma linha real no terminal (nenhuma
 * chamada de saída de depuração exibindo dado lido do banco), filtra toda
 * leitura do Supervisor pelos ids semeados neste arquivo (nunca baixa a
 * carteira real) e usa só razões sociais/nomes fantasia/CNPJs inventados
 * (LGPD).
 *
 * Duas autenticações no arquivo inteiro: Vendedor A e Supervisor. Vendedor
 * B nunca faz login — os encerrados/ganhos dele são semeados pelo cliente
 * de serviço, provando os casos "outro vendedor" sem gastar uma terceira
 * tentativa de signInWithPassword (rate limit conhecido).
 *
 * Fica VERMELHO (valor de enum/tabela/função inexistentes no banco) até o
 * plano 29-03 aplicar as migrations 0035/0036 no projeto hospedado — mesmo
 * padrão de tests/funil/perdidos-rpc.test.ts (Fase 28).
 */

type EncerradoRow = {
  cliente_id: string
  razao_social: string | null
  nome_fantasia: string | null
  motivo_encerramento_nome: string | null
  encerrado_em: string
  responsavel: string
  responsavel_nome: string | null
}

type AgendaRow = {
  origem: string
  item_id: string
  cliente_id: string
}

type HistoricoRow = {
  id: string
  tipo: string
  descricao: string
  criado_em: string
  autor_id: string | null
}

type ClienteRow = {
  id: string
  status_acompanhamento: string
  etapa: string
  motivo_encerramento_id: string | null
  frequencia_visita: string | null
  responsavel: string
}

let cnpjCounter = 0

function uniqueRazaoSocial(label: string): string {
  return `Teste Encerrados ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function uniqueMotivoNome(label: string): string {
  return `Teste Motivo Encerramento ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 14 dígitos derivados do timestamp + contador — evita colidir com a
 * trava de razão social+CNPJ da migration 0030 entre fixtures do arquivo. */
function uniqueCnpj(): string {
  cnpjCounter += 1
  return `${Date.now()}${cnpjCounter}`.slice(-14).padStart(14, "0")
}

function hojeYyyyMmDd(): string {
  return new Date().toISOString().slice(0, 10)
}

function baseClienteFields(
  razaoSocial: string,
  responsavelId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    razao_social: razaoSocial,
    nome_fantasia: `Fantasia ${razaoSocial}`,
    cnpj: uniqueCnpj(),
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: responsavelId,
    ...overrides,
  }
}

const createdClienteIds: string[] = []
const createdMotivoIds: string[] = []

let vendedorA: TestMember
let vendedorB: TestMember
let supervisor: TestMember
let clientA: SupabaseClient
let supervisorClient: SupabaseClient
let motivoEncerramentoId: string
let motivoEncerramentoNome: string
let tipoTarefaId: string

beforeAll(async () => {
  vendedorA = await createTestMember("vendedor", "encerrados-a")
  vendedorB = await createTestMember("vendedor", "encerrados-b")
  supervisor = await createTestMember("supervisor", "encerrados")
  clientA = await signInAs(vendedorA.email, vendedorA.password)
  supervisorClient = await signInAs(supervisor.email, supervisor.password)

  const motivo = await firstMotivoEncerramentoAtivo()
  motivoEncerramentoId = motivo.id
  motivoEncerramentoNome = motivo.nome
  tipoTarefaId = await firstTipoTarefaAtivoId()
})

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  await serviceClient().from("clientes").delete().in("id", createdClienteIds.splice(0))
})

afterAll(async () => {
  if (createdMotivoIds.length > 0) {
    await serviceClient().from("motivos_encerramento").delete().in("id", createdMotivoIds.splice(0))
  }
  // Ordem obrigatória: clientes primeiro (FK sem ON DELETE), membros depois.
  await deleteTestMember(vendedorA.id)
  await deleteTestMember(vendedorB.id)
  await deleteTestMember(supervisor.id)
})

async function firstMotivoEncerramentoAtivo(): Promise<{ id: string; nome: string }> {
  const { data, error } = await serviceClient()
    .from("motivos_encerramento")
    .select("id, nome")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error("Nenhum motivo de encerramento ativo encontrado para o teste")
  }
  return { id: data.id as string, nome: data.nome as string }
}

async function firstTipoTarefaAtivoId(): Promise<string> {
  const { data, error } = await serviceClient()
    .from("tipos_tarefa")
    .select("id")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error("Nenhum tipo de tarefa ativo encontrado para o teste")
  }
  return data.id as string
}

/** Insere pelo cliente de serviço. `overrides` define etapa/status/
 * frequencia_visita/motivo_encerramento_id conforme o caso precisar. */
async function seedCliente(
  responsavelId: string,
  label: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; razaoSocial: string }> {
  const razaoSocial = uniqueRazaoSocial(label)
  const { data, error } = await serviceClient()
    .from("clientes")
    .insert(baseClienteFields(razaoSocial, responsavelId, overrides))
    .select("id")
    .single()
  if (error || !data) {
    throw new Error(`Falha ao semear cliente: ${error?.message}`)
  }
  createdClienteIds.push(data.id as string)
  return { id: data.id as string, razaoSocial }
}

/** Atalho: etapa "primeira_venda" + status "ganho" (+ overrides, ex.
 * frequencia_visita). */
async function seedGanho(
  responsavelId: string,
  label: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; razaoSocial: string }> {
  return seedCliente(responsavelId, label, {
    etapa: "primeira_venda",
    status_acompanhamento: "ganho",
    ...overrides,
  })
}

async function seedVisitaPendente(clienteId: string, responsavelId: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from("visitas")
    .insert({ cliente_id: clienteId, data_prevista: hojeYyyyMmDd(), criado_por: responsavelId })
    .select("id")
    .single()
  if (error || !data) {
    throw new Error(`Falha ao semear visita: ${error?.message}`)
  }
  return data.id as string
}

async function seedTarefaAberta(clienteId: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from("tarefas")
    .insert({
      cliente_id: clienteId,
      tipo_tarefa_id: tipoTarefaId,
      data_conclusao: hojeYyyyMmDd(),
      concluida: false,
    })
    .select("id")
    .single()
  if (error || !data) {
    throw new Error(`Falha ao semear tarefa: ${error?.message}`)
  }
  return data.id as string
}

/** Espelha exatamente o que marcarStatus() manda para encerrar (29-04). */
async function encerrarComo(client: SupabaseClient, clienteId: string, motivoId: string | null) {
  return client.rpc("mover_card_funil", {
    p_cliente_id: clienteId,
    p_nova_etapa: "primeira_venda",
    p_novo_status: "encerrado",
    p_motivo_encerramento_id: motivoId,
  })
}

/** Espelha exatamente o que marcarStatus() manda para reativar (29-04). */
async function reativarComo(client: SupabaseClient, clienteId: string, frequencia: string | null) {
  return client.rpc("mover_card_funil", {
    p_cliente_id: clienteId,
    p_nova_etapa: "primeira_venda",
    p_novo_status: "ganho",
    p_frequencia_visita: frequencia,
  })
}

/** Encerrados do Vendedor B são semeados por UPDATE (nunca insert direto
 * em historico) — é o gatilho clientes_after_update_historico que escreve
 * a linha de histórico ao detectar a troca de status. */
async function encerrarViaUpdate(clienteId: string): Promise<void> {
  const { error } = await serviceClient()
    .from("clientes")
    .update({
      status_acompanhamento: "encerrado",
      motivo_encerramento_id: motivoEncerramentoId,
    })
    .eq("id", clienteId)
  if (error) {
    throw new Error(`Falha ao encerrar via update: ${error.message}`)
  }
}

async function historicoDoCliente(clienteId: string): Promise<HistoricoRow[]> {
  const { data, error } = await serviceClient()
    .from("historico")
    .select("id, tipo, descricao, criado_em, autor_id")
    .eq("cliente_id", clienteId)
    .order("criado_em", { ascending: false })
  if (error) throw new Error(`Falha ao ler histórico: ${error.message}`)
  return (data ?? []) as HistoricoRow[]
}

async function clientePorId(clienteId: string): Promise<ClienteRow> {
  const { data, error } = await serviceClient()
    .from("clientes")
    .select("id, status_acompanhamento, etapa, motivo_encerramento_id, frequencia_visita, responsavel")
    .eq("id", clienteId)
    .single()
  if (error || !data) throw new Error(`Falha ao ler cliente: ${error?.message}`)
  return data as ClienteRow
}

async function visitasPendentesDoCliente(clienteId: string): Promise<{ id: string; data_prevista: string }[]> {
  const { data, error } = await serviceClient()
    .from("visitas")
    .select("id, data_prevista")
    .eq("cliente_id", clienteId)
    .is("data_realizada", null)
  if (error) throw new Error(`Falha ao ler visitas: ${error.message}`)
  return (data ?? []) as { id: string; data_prevista: string }[]
}

describe("motivos_encerramento (7a lista editável)", () => {
  it("motivos-seed: os cinco valores iniciais existem e estão ativos", async () => {
    const nomesEsperados = [
      "Parou de comprar sem motivo informado",
      "Fechou o estabelecimento",
      "Mudou de fornecedor",
      "Preço",
      "Insatisfação com produto ou entrega",
    ]

    const { data, error } = await clientA
      .from("motivos_encerramento")
      .select("nome, ativo")
      .in("nome", nomesEsperados)

    expect(error).toBeNull()
    expect(data).toHaveLength(nomesEsperados.length)
    for (const row of data ?? []) {
      expect(row.ativo).toBe(true)
    }
  })

  it("motivos-vendedor-le: uma sessão real de Vendedor A lê motivos_encerramento e recebe conjunto não vazio", async () => {
    const { data, error } = await clientA.from("motivos_encerramento").select("id")
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it("motivos-vendedor-nao-escreve: a sessão de Vendedor A tem insert/update/delete recusados, e a releitura confirma que nada mudou", async () => {
    const admin = serviceClient()
    const nomeOriginal = uniqueMotivoNome("vendedor-tenta-inserir")

    const { data: inserted, error: insertError } = await clientA
      .from("motivos_encerramento")
      .insert({ nome: nomeOriginal })
      .select("id")
    expect(inserted ?? []).toHaveLength(0)
    if (insertError) {
      expect(insertError).not.toBeNull()
    }
    const { data: rereadAfterInsert } = await admin
      .from("motivos_encerramento")
      .select("id")
      .eq("nome", nomeOriginal)
    expect(rereadAfterInsert ?? []).toHaveLength(0)

    const { data: seeded, error: seedError } = await supervisorClient
      .from("motivos_encerramento")
      .insert({ nome: uniqueMotivoNome("alvo-de-escrita-vendedor") })
      .select("id, nome")
      .single()
    expect(seedError).toBeNull()
    createdMotivoIds.push(seeded!.id)

    const { data: updated, error: updateError } = await clientA
      .from("motivos_encerramento")
      .update({ ativo: false })
      .eq("id", seeded!.id)
      .select("id")
    expect(updated ?? []).toHaveLength(0)
    if (updateError) {
      expect(updateError).not.toBeNull()
    }
    const { data: rereadAfterUpdate } = await admin
      .from("motivos_encerramento")
      .select("ativo")
      .eq("id", seeded!.id)
      .single()
    expect(rereadAfterUpdate?.ativo).toBe(true)

    const { data: deleted, error: deleteError } = await clientA
      .from("motivos_encerramento")
      .delete()
      .eq("id", seeded!.id)
      .select("id")
    expect(deleted ?? []).toHaveLength(0)
    if (deleteError) {
      expect(deleteError).not.toBeNull()
    }
    const { data: rereadAfterDelete } = await admin
      .from("motivos_encerramento")
      .select("id")
      .eq("id", seeded!.id)
    expect(rereadAfterDelete ?? []).toHaveLength(1)
  })

  it("motivos-supervisor-escreve: o Supervisor insere, renomeia e desativa um motivo inventado", async () => {
    const nomeOriginal = uniqueMotivoNome("supervisor-insert")

    const { data: inserted, error: insertError } = await supervisorClient
      .from("motivos_encerramento")
      .insert({ nome: nomeOriginal })
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdMotivoIds.push(inserted!.id)

    const nomeNovo = uniqueMotivoNome("supervisor-renomeado")
    const { data: renamed, error: renameError } = await supervisorClient
      .from("motivos_encerramento")
      .update({ nome: nomeNovo })
      .eq("id", inserted!.id)
      .select("id, nome")
      .single()
    expect(renameError).toBeNull()
    expect(renamed?.nome).toBe(nomeNovo)

    const { data: deactivated, error: deactivateError } = await supervisorClient
      .from("motivos_encerramento")
      .update({ ativo: false })
      .eq("id", inserted!.id)
      .select("id, ativo")
      .single()
    expect(deactivateError).toBeNull()
    expect(deactivated?.ativo).toBe(false)
  })
})

describe("mover_card_funil — encerrar (ENCR-01/02/04, D-03/D-04)", () => {
  it("encerrar-ganho / historico-intacto: A encerra um ganho próprio, guarda o motivo e preserva todo o histórico anterior", async () => {
    const { id } = await seedGanho(vendedorA.id, "encerrar-ganho")
    const historicoAntes = await historicoDoCliente(id)
    const idsAntes = historicoAntes.map((h) => h.id)

    const { error } = await encerrarComo(clientA, id, motivoEncerramentoId)
    expect(error).toBeNull()

    const depois = await clientePorId(id)
    expect(depois.status_acompanhamento).toBe("encerrado")
    expect(depois.motivo_encerramento_id).toBe(motivoEncerramentoId)
    expect(depois.etapa).toBe("primeira_venda")

    const historicoDepois = await historicoDoCliente(id)
    for (const idAntigo of idsAntes) {
      expect(historicoDepois.some((h) => h.id === idAntigo)).toBe(true)
    }

    const linhaEncerrado = historicoDepois.find(
      (h) => h.tipo === "status_acompanhamento" && h.descricao === 'Status alterado para "encerrado"'
    )
    expect(linhaEncerrado).toBeDefined()
    expect(linhaEncerrado!.autor_id).toBe(vendedorA.id)
  })

  it("encerrar-sem-motivo: sem motivo, mover_card_funil recusa e o status continua ganho", async () => {
    const { id } = await seedGanho(vendedorA.id, "encerrar-sem-motivo")
    const { error } = await encerrarComo(clientA, id, null)
    expect(error).not.toBeNull()
    expect(error!.message).toContain("Motivo de encerramento")

    const depois = await clientePorId(id)
    expect(depois.status_acompanhamento).toBe("ganho")
  })

  it("check-exige-motivo: a CHECK do banco recusa um UPDATE direto para encerrado sem motivo (23514)", async () => {
    const { id } = await seedGanho(vendedorA.id, "check-exige-motivo")
    const { error } = await serviceClient()
      .from("clientes")
      .update({ status_acompanhamento: "encerrado" })
      .eq("id", id)
    expect(error).not.toBeNull()
    expect(error!.code).toBe("23514")
  })

  it('check-etapa-final: a CHECK do banco recusa encerrar fora da etapa "1ª venda concluída" mesmo com motivo (23514)', async () => {
    const { id } = await seedCliente(vendedorA.id, "check-etapa-final")
    const { error } = await serviceClient()
      .from("clientes")
      .update({ status_acompanhamento: "encerrado", motivo_encerramento_id: motivoEncerramentoId })
      .eq("id", id)
    expect(error).not.toBeNull()
    expect(error!.code).toBe("23514")
  })

  it("encerrar-so-de-ganho: recusa encerrar um cliente em_andamento parado na etapa final", async () => {
    const { id } = await seedCliente(vendedorA.id, "encerrar-so-de-ganho", { etapa: "primeira_venda" })
    const { error } = await encerrarComo(clientA, id, motivoEncerramentoId)
    expect(error).not.toBeNull()
    expect(error!.message).toContain("já está como ganho")

    const depois = await clientePorId(id)
    expect(depois.status_acompanhamento).toBe("em_andamento")
  })

  it("encerrar-outro-vendedor: A não consegue encerrar o ganho de B, que continua ganho", async () => {
    const { id: idB } = await seedGanho(vendedorB.id, "encerrar-outro-vendedor")
    const { error } = await encerrarComo(clientA, idB, motivoEncerramentoId)
    expect(error).toBeNull()

    const depois = await clientePorId(idB)
    expect(depois.status_acompanhamento).toBe("ganho")
  })
})

describe("agenda_do_vendedor filtra encerrado (D-12, ENCR-03)", () => {
  it("agenda-some: encerrar tira o cliente da Lista, do Calendário pendente e do contador do menu", async () => {
    const { id } = await seedGanho(vendedorA.id, "agenda-some")
    await seedVisitaPendente(id, vendedorA.id)
    await seedTarefaAberta(id)

    const antes = await clientA.rpc("agenda_do_vendedor")
    expect(antes.error).toBeNull()
    const linhasAntes = ((antes.data ?? []) as AgendaRow[]).filter((r) => r.cliente_id === id)
    expect(linhasAntes.length).toBe(2)

    const contagemAntes = await clientA.rpc("agenda_do_vendedor", undefined, {
      count: "exact",
      head: true,
    })
    expect(contagemAntes.count).toBe(2)

    const { error } = await encerrarComo(clientA, id, motivoEncerramentoId)
    expect(error).toBeNull()

    const depois = await clientA.rpc("agenda_do_vendedor")
    expect(depois.error).toBeNull()
    const linhasDepois = ((depois.data ?? []) as AgendaRow[]).filter((r) => r.cliente_id === id)
    expect(linhasDepois.length).toBe(0)

    const contagemDepois = await clientA.rpc("agenda_do_vendedor", undefined, {
      count: "exact",
      head: true,
    })
    expect(contagemDepois.count).toBe(0)
  })
})

describe("clientes_encerrados (D-07/D-08, LGPD)", () => {
  it("lista-encerrados: clientes_encerrados devolve motivo, data do histórico e o responsável certo", async () => {
    const { id, razaoSocial } = await seedGanho(vendedorA.id, "lista-encerrados")
    const { error } = await encerrarComo(clientA, id, motivoEncerramentoId)
    expect(error).toBeNull()

    const historico = await historicoDoCliente(id)
    const linhaEncerrado = historico.find(
      (h) => h.tipo === "status_acompanhamento" && h.descricao.includes('"encerrado"')
    )
    expect(linhaEncerrado).toBeDefined()

    const { data, error: rpcError } = await clientA.rpc("clientes_encerrados", {})
    expect(rpcError).toBeNull()
    const linha = ((data ?? []) as EncerradoRow[]).find((r) => r.cliente_id === id)
    expect(linha).toBeDefined()
    expect(linha!.razao_social).toBe(razaoSocial)
    expect(linha!.motivo_encerramento_nome).toBe(motivoEncerramentoNome)
    expect(new Date(linha!.encerrado_em).getTime()).toBe(new Date(linhaEncerrado!.criado_em).getTime())
    expect(linha!.responsavel).toBe(vendedorA.id)
    expect(linha!.responsavel_nome).toBe(`Fixture ${vendedorA.sobrenome}`)
  })

  it("lgpd-colunas: as chaves de cada linha são exatamente as 7 colunas combinadas, sem dado de contato", async () => {
    const { id } = await seedGanho(vendedorA.id, "lgpd-colunas")
    await encerrarComo(clientA, id, motivoEncerramentoId)

    const { data, error } = await clientA.rpc("clientes_encerrados", {})
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)

    const chaves = Object.keys(data![0]).sort()
    expect(chaves).toEqual(
      [
        "cliente_id",
        "encerrado_em",
        "motivo_encerramento_nome",
        "nome_fantasia",
        "razao_social",
        "responsavel",
        "responsavel_nome",
      ].sort()
    )
  })

  it("rls-vendedor: A não recebe o encerrado de B", async () => {
    const { id: idA } = await seedGanho(vendedorA.id, "rls-vendedor-a")
    await encerrarComo(clientA, idA, motivoEncerramentoId)

    const { id: idB } = await seedGanho(vendedorB.id, "rls-vendedor-b")
    await encerrarViaUpdate(idB)

    const { data, error } = await clientA.rpc("clientes_encerrados", {})
    expect(error).toBeNull()
    const ids = ((data ?? []) as EncerradoRow[]).map((r) => r.cliente_id)
    expect(ids).toContain(idA)
    expect(ids).not.toContain(idB)
  })

  it("rls-supervisor: o Supervisor recebe os encerrados de A e de B", async () => {
    const { id: idA } = await seedGanho(vendedorA.id, "rls-supervisor-a")
    await encerrarComo(clientA, idA, motivoEncerramentoId)

    const { id: idB } = await seedGanho(vendedorB.id, "rls-supervisor-b")
    await encerrarViaUpdate(idB)

    const { data, error } = await supervisorClient
      .rpc("clientes_encerrados", {})
      .in("cliente_id", [idA, idB])
    expect(error).toBeNull()
    const ids = ((data ?? []) as EncerradoRow[]).map((r) => r.cliente_id)
    expect(ids).toContain(idA)
    expect(ids).toContain(idB)
  })

  it("periodo: filtra pela janela ao redor de agora, com margem de tolerância de relógio", async () => {
    const { id } = await seedGanho(vendedorA.id, "periodo")
    await encerrarComo(clientA, id, motivoEncerramentoId)
    const agora = Date.now()

    const dentro = await clientA.rpc("clientes_encerrados", {
      p_inicio: new Date(agora - 10 * 60_000).toISOString(),
      p_fim: new Date(agora + 10 * 60_000).toISOString(),
    })
    expect(dentro.error).toBeNull()
    expect(((dentro.data ?? []) as EncerradoRow[]).map((r) => r.cliente_id)).toContain(id)

    const antesDaJanela = await clientA.rpc("clientes_encerrados", {
      p_inicio: new Date(agora + 60 * 60_000).toISOString(),
      p_fim: null,
    })
    expect(antesDaJanela.error).toBeNull()
    expect(((antesDaJanela.data ?? []) as EncerradoRow[]).map((r) => r.cliente_id)).not.toContain(id)

    const depoisDaJanela = await clientA.rpc("clientes_encerrados", {
      p_inicio: null,
      p_fim: new Date(agora - 60 * 60_000).toISOString(),
    })
    expect(depoisDaJanela.error).toBeNull()
    expect(((depoisDaJanela.data ?? []) as EncerradoRow[]).map((r) => r.cliente_id)).not.toContain(id)

    const semLimite = await clientA.rpc("clientes_encerrados", {})
    expect(semLimite.error).toBeNull()
    expect(((semLimite.data ?? []) as EncerradoRow[]).map((r) => r.cliente_id)).toContain(id)
  })

  it("sem-historico: cliente inserido já encerrado, sem linha de histórico de status, aparece com encerrado_em de reserva", async () => {
    const { id } = await seedCliente(vendedorA.id, "sem-historico", {
      etapa: "primeira_venda",
      status_acompanhamento: "encerrado",
      motivo_encerramento_id: motivoEncerramentoId,
    })

    const historico = await historicoDoCliente(id)
    expect(historico.filter((h) => h.tipo === "status_acompanhamento").length).toBe(0)

    const { data, error } = await clientA.rpc("clientes_encerrados", {})
    expect(error).toBeNull()
    const linha = ((data ?? []) as EncerradoRow[]).find((r) => r.cliente_id === id)
    expect(linha).toBeDefined()
    expect(linha!.encerrado_em).toBeTruthy()
  })

  it("paginacao: a mesma ordenação (data desc, id asc) sustenta o recorte de página feito por fora", async () => {
    const { id: id1 } = await seedGanho(vendedorA.id, "paginacao-1")
    await encerrarComo(clientA, id1, motivoEncerramentoId)
    const { id: id2 } = await seedGanho(vendedorA.id, "paginacao-2")
    await encerrarComo(clientA, id2, motivoEncerramentoId)

    const pagina0 = await clientA
      .rpc("clientes_encerrados", {})
      .in("cliente_id", [id1, id2])
      .order("encerrado_em", { ascending: false })
      .order("cliente_id", { ascending: true })
      .range(0, 0)
    expect(pagina0.error).toBeNull()
    expect((pagina0.data ?? []).length).toBe(1)

    const pagina1 = await clientA
      .rpc("clientes_encerrados", {})
      .in("cliente_id", [id1, id2])
      .order("encerrado_em", { ascending: false })
      .order("cliente_id", { ascending: true })
      .range(1, 1)
    expect(pagina1.error).toBeNull()
    expect((pagina1.data ?? []).length).toBe(1)

    const idsPaginados = [
      ...((pagina0.data ?? []) as EncerradoRow[]),
      ...((pagina1.data ?? []) as EncerradoRow[]),
    ].map((r) => r.cliente_id)
    expect(new Set(idsPaginados)).toEqual(new Set([id1, id2]))
  })
})

describe("mover_card_funil — reativar (D-10/D-11, ENCR-05)", () => {
  it("reativar-com-frequencia: reativar com frequência informada preserva CNPJ/razão social/endereço e sai da lista de encerrados", async () => {
    const { id } = await seedGanho(vendedorA.id, "reativar-com-frequencia", { frequencia_visita: "semanal" })
    const encerrar = await encerrarComo(clientA, id, motivoEncerramentoId)
    expect(encerrar.error).toBeNull()

    const { error } = await reativarComo(clientA, id, "semanal")
    expect(error).toBeNull()

    const depois = await clientePorId(id)
    expect(depois.status_acompanhamento).toBe("ganho")

    const historico = await historicoDoCliente(id)
    const linhaReativado = historico.find(
      (h) => h.tipo === "status_acompanhamento" && h.descricao === 'Status alterado para "ganho"'
    )
    expect(linhaReativado).toBeDefined()
    expect(linhaReativado!.autor_id).toBe(vendedorA.id)

    const { data: encerrados } = await clientA.rpc("clientes_encerrados", {})
    expect(((encerrados ?? []) as EncerradoRow[]).map((r) => r.cliente_id)).not.toContain(id)
  })

  it("reativar-sem-frequencia-restaura: reativar sem frequência restaura o estado anterior (ganho sem frequência), sem travar", async () => {
    const { id } = await seedGanho(vendedorA.id, "reativar-sem-frequencia")
    await encerrarComo(clientA, id, motivoEncerramentoId)

    const { error } = await reativarComo(clientA, id, null)
    expect(error).toBeNull()

    const depois = await clientePorId(id)
    expect(depois.status_acompanhamento).toBe("ganho")
    expect(depois.frequencia_visita).toBeNull()

    const pendentes = await visitasPendentesDoCliente(id)
    expect(pendentes.length).toBe(0)
  })

  it("ganho-sem-frequencia-continua-bloqueado: o primeiro ganho de verdade continua exigindo frequência (VIS-01)", async () => {
    const { id } = await seedCliente(vendedorA.id, "ganho-sem-frequencia-continua-bloqueado", {
      etapa: "primeira_venda",
    })
    const { error } = await clientA.rpc("mover_card_funil", {
      p_cliente_id: id,
      p_nova_etapa: "primeira_venda",
      p_novo_status: "ganho",
      p_frequencia_visita: null,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toContain("Frequência de visita é obrigatória")

    const depois = await clientePorId(id)
    expect(depois.status_acompanhamento).toBe("em_andamento")
  })

  it("reativar-volta-agenda: reativar traz de volta a mesma visita pendente que já existia (idempotência)", async () => {
    const { id } = await seedGanho(vendedorA.id, "reativar-volta-agenda", { frequencia_visita: "semanal" })
    const visitaId = await seedVisitaPendente(id, vendedorA.id)

    await encerrarComo(clientA, id, motivoEncerramentoId)
    const semCliente = await clientA.rpc("agenda_do_vendedor")
    expect(((semCliente.data ?? []) as AgendaRow[]).some((r) => r.cliente_id === id)).toBe(false)

    const { error } = await reativarComo(clientA, id, "semanal")
    expect(error).toBeNull()

    const { data, error: agendaError } = await clientA.rpc("agenda_do_vendedor")
    expect(agendaError).toBeNull()
    const linhasVisita = ((data ?? []) as AgendaRow[]).filter(
      (r) => r.cliente_id === id && r.origem === "visita"
    )
    expect(linhasVisita.length).toBe(1)
    expect(linhasVisita[0].item_id).toBe(visitaId)

    const pendentes = await visitasPendentesDoCliente(id)
    expect(pendentes.length).toBe(1)
  })

  it("reativar-semeia-visita: reativar sem visita pendente anterior semeia uma nova", async () => {
    const { id } = await seedGanho(vendedorA.id, "reativar-semeia-visita", { frequencia_visita: "semanal" })
    await encerrarComo(clientA, id, motivoEncerramentoId)

    const { error } = await reativarComo(clientA, id, "semanal")
    expect(error).toBeNull()

    const pendentes = await visitasPendentesDoCliente(id)
    expect(pendentes.length).toBe(1)
    expect(pendentes[0].data_prevista).toBeTruthy()
  })

  it("reativar-outro-vendedor: A não consegue reativar o encerrado de B, que continua encerrado", async () => {
    const { id: idB } = await seedGanho(vendedorB.id, "reativar-outro-vendedor")
    await encerrarViaUpdate(idB)

    const { error } = await reativarComo(clientA, idB, "semanal")
    expect(error).toBeNull()

    const depois = await clientePorId(idB)
    expect(depois.status_acompanhamento).toBe("encerrado")
  })
})
