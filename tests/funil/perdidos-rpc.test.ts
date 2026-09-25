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
 * Integration tests for the `clientes_perdidos` RPC (28-01-PLAN.md,
 * PERD-02/PERD-03/PERD-04/PERD-05).
 *
 * NUNCA usar as contas semente antigas (`vendedor.a+test`/`vendedor.b+test`),
 * apagadas em 2026-08-19 (ver STATE.md) — este arquivo usa
 * `createTestMember`/`deleteTestMember` para fixtures descartáveis. O
 * projeto Supabase de teste É o de produção, com dados reais de clientes —
 * por isso este arquivo NUNCA imprime o resultado de uma leitura (nenhuma
 * chamada que exiba uma linha real no terminal), filtra toda leitura do
 * Supervisor pelos ids semeados neste arquivo (nunca baixa a carteira real)
 * e usa só razões sociais/nomes fantasia inventados (LGPD).
 *
 * Duas autenticações no arquivo inteiro: Vendedor A e Supervisor. Vendedor
 * B nunca faz login — os perdidos dele são semeados pelo cliente de
 * serviço, provando o caso "reabrir o perdido de outro vendedor" sem gastar
 * uma terceira tentativa de signInWithPassword (rate limit conhecido).
 *
 * Fica VERMELHO (função inexistente no banco) até a Tarefa 3 aplicar a
 * migration 0034 no projeto hospedado — mesmo padrão documentado em
 * tests/importacao/importar-ativos-lote.test.ts.
 */

type PerdidoRow = {
  cliente_id: string
  razao_social: string | null
  nome_fantasia: string | null
  motivo_perda_nome: string | null
  perdido_em: string
  responsavel: string
  responsavel_nome: string | null
}

type HistoricoRow = {
  tipo: string
  descricao: string
  criado_em: string
  autor_id: string | null
}

type ClienteRow = {
  id: string
  status_acompanhamento: string
  etapa: string
  etapa_alterada_em: string
  atualizado_em: string
  responsavel: string
}

function uniqueRazaoSocial(label: string): string {
  return `Teste Perdidos ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function baseClienteFields(
  razaoSocial: string,
  responsavelId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    razao_social: razaoSocial,
    nome_fantasia: `Fantasia ${razaoSocial}`,
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

let vendedorA: TestMember
let vendedorB: TestMember
let supervisor: TestMember
let clientA: SupabaseClient
let supervisorClient: SupabaseClient
let motivoPerdaId: string

beforeAll(async () => {
  vendedorA = await createTestMember("vendedor", "perdidos-a")
  vendedorB = await createTestMember("vendedor", "perdidos-b")
  supervisor = await createTestMember("supervisor", "perdidos")
  clientA = await signInAs(vendedorA.email, vendedorA.password)
  supervisorClient = await signInAs(supervisor.email, supervisor.password)
  motivoPerdaId = await firstMotivoPerdaId()
})

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  await serviceClient().from("clientes").delete().in("id", createdClienteIds.splice(0))
})

afterAll(async () => {
  // Ordem obrigatória: clientes primeiro (FK sem ON DELETE), membros depois.
  await deleteTestMember(vendedorA.id)
  await deleteTestMember(vendedorB.id)
  await deleteTestMember(supervisor.id)
})

async function firstMotivoPerdaId(): Promise<string> {
  const { data, error } = await serviceClient()
    .from("motivos_perda")
    .select("id")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error("Nenhum motivo de perda ativo encontrado para o teste")
  }
  return data.id as string
}

/**
 * Semeia um cliente já perdido: insere pelo cliente de serviço e depois
 * marca perdido com um UPDATE separado (nunca um insert direto em
 * `historico`) — é o gatilho `clientes_after_update_historico` (migration
 * 0002) que escreve a linha de histórico ao detectar a troca de status.
 */
async function seedPerdido(
  responsavelId: string,
  label: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; razaoSocial: string }> {
  const razaoSocial = uniqueRazaoSocial(label)
  const admin = serviceClient()
  const { data: inserted, error: insertError } = await admin
    .from("clientes")
    .insert(baseClienteFields(razaoSocial, responsavelId))
    .select("id")
    .single()
  if (insertError || !inserted) {
    throw new Error(`Falha ao semear cliente: ${insertError?.message}`)
  }
  createdClienteIds.push(inserted.id as string)

  const { error: updateError } = await admin
    .from("clientes")
    .update({
      status_acompanhamento: "perdido",
      motivo_perda_id: motivoPerdaId,
      ...overrides,
    })
    .eq("id", inserted.id)
  if (updateError) {
    throw new Error(`Falha ao marcar cliente como perdido: ${updateError.message}`)
  }

  return { id: inserted.id as string, razaoSocial }
}

/** Espelha exatamente o que marcarStatus() envia para reabrir um perdido. */
async function reabrirComo(client: SupabaseClient, clienteId: string, etapaAtual: string) {
  return client.rpc("mover_card_funil", {
    p_cliente_id: clienteId,
    p_nova_etapa: etapaAtual,
    p_novo_status: "em_andamento",
    p_motivo_perda_id: null,
  })
}

async function historicoDoCliente(clienteId: string): Promise<HistoricoRow[]> {
  const { data, error } = await serviceClient()
    .from("historico")
    .select("tipo, descricao, criado_em, autor_id")
    .eq("cliente_id", clienteId)
    .order("criado_em", { ascending: false })
  if (error) throw new Error(`Falha ao ler histórico: ${error.message}`)
  return (data ?? []) as HistoricoRow[]
}

async function clientePorId(clienteId: string): Promise<ClienteRow> {
  const { data, error } = await serviceClient()
    .from("clientes")
    .select("id, status_acompanhamento, etapa, etapa_alterada_em, atualizado_em, responsavel")
    .eq("id", clienteId)
    .single()
  if (error || !data) throw new Error(`Falha ao ler cliente: ${error?.message}`)
  return data as ClienteRow
}

describe("clientes_perdidos (28-01, PERD-02/PERD-03/PERD-04/PERD-05)", () => {
  it("motivo-data-vendedor: devolve motivo, data de perda e responsável do perdido do Vendedor A", async () => {
    const { id, razaoSocial } = await seedPerdido(vendedorA.id, "motivo-data-vendedor")

    const { data, error } = await clientA.rpc("clientes_perdidos", {})
    expect(error).toBeNull()

    const linha = ((data ?? []) as PerdidoRow[]).find((r) => r.cliente_id === id)
    expect(linha).toBeDefined()
    expect(linha!.razao_social).toBe(razaoSocial)
    expect(linha!.motivo_perda_nome).toBeTruthy()
    expect(linha!.perdido_em).toBeTruthy()
    expect(linha!.responsavel).toBe(vendedorA.id)
    expect(linha!.responsavel_nome).toBe(`Fixture ${vendedorA.sobrenome}`)
  })

  it("lgpd-colunas: as chaves de cada linha são exatamente as 7 colunas combinadas, sem dado de contato", async () => {
    await seedPerdido(vendedorA.id, "lgpd-colunas")

    const { data, error } = await clientA.rpc("clientes_perdidos", {})
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)

    const chaves = Object.keys(data![0]).sort()
    expect(chaves).toEqual(
      [
        "cliente_id",
        "motivo_perda_nome",
        "nome_fantasia",
        "perdido_em",
        "razao_social",
        "responsavel",
        "responsavel_nome",
      ].sort()
    )
  })

  it("rls-vendedor: A recebe o próprio perdido e NÃO recebe o perdido de B", async () => {
    const { id: idA } = await seedPerdido(vendedorA.id, "rls-vendedor-a")
    const { id: idB } = await seedPerdido(vendedorB.id, "rls-vendedor-b")

    const { data, error } = await clientA.rpc("clientes_perdidos", {})
    expect(error).toBeNull()

    const ids = ((data ?? []) as PerdidoRow[]).map((r) => r.cliente_id)
    expect(ids).toContain(idA)
    expect(ids).not.toContain(idB)
  })

  it("rls-supervisor: o Supervisor recebe os perdidos de A e de B", async () => {
    const { id: idA } = await seedPerdido(vendedorA.id, "rls-supervisor-a")
    const { id: idB } = await seedPerdido(vendedorB.id, "rls-supervisor-b")

    const { data, error } = await supervisorClient
      .rpc("clientes_perdidos", {})
      .in("cliente_id", [idA, idB])
    expect(error).toBeNull()

    const ids = ((data ?? []) as PerdidoRow[]).map((r) => r.cliente_id)
    expect(ids).toContain(idA)
    expect(ids).toContain(idB)
  })

  it("periodo: filtra pela janela ao redor de agora, com margem de tolerância de relógio", async () => {
    const { id } = await seedPerdido(vendedorA.id, "periodo")
    const agora = Date.now()

    const dentro = await clientA.rpc("clientes_perdidos", {
      p_inicio: new Date(agora - 10 * 60_000).toISOString(),
      p_fim: new Date(agora + 10 * 60_000).toISOString(),
    })
    expect(dentro.error).toBeNull()
    expect(((dentro.data ?? []) as PerdidoRow[]).map((r) => r.cliente_id)).toContain(id)

    const antesDaJanela = await clientA.rpc("clientes_perdidos", {
      p_inicio: new Date(agora + 60 * 60_000).toISOString(),
      p_fim: null,
    })
    expect(antesDaJanela.error).toBeNull()
    expect(((antesDaJanela.data ?? []) as PerdidoRow[]).map((r) => r.cliente_id)).not.toContain(id)

    const depoisDaJanela = await clientA.rpc("clientes_perdidos", {
      p_inicio: null,
      p_fim: new Date(agora - 60 * 60_000).toISOString(),
    })
    expect(depoisDaJanela.error).toBeNull()
    expect(((depoisDaJanela.data ?? []) as PerdidoRow[]).map((r) => r.cliente_id)).not.toContain(id)

    const semLimite = await clientA.rpc("clientes_perdidos", {})
    expect(semLimite.error).toBeNull()
    expect(((semLimite.data ?? []) as PerdidoRow[]).map((r) => r.cliente_id)).toContain(id)
  })

  it("data-da-perda: a data de perda vem do histórico, nunca de etapa_alterada_em/criado_em recuados (D-11)", async () => {
    const razaoSocial = uniqueRazaoSocial("data-da-perda")
    const admin = serviceClient()
    const { data: inserted, error: insertError } = await admin
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorA.id))
      .select("id")
      .single()
    expect(insertError).toBeNull()
    const id = inserted!.id as string
    createdClienteIds.push(id)

    // Recua etapa_alterada_em e criado_em SEM mudar a etapa — o gatilho de
    // antes da atualização só renova etapa_alterada_em quando a etapa muda,
    // então o valor recuado sobrevive a este UPDATE.
    const { error: recuoError } = await admin
      .from("clientes")
      .update({
        etapa_alterada_em: "2020-01-01T00:00:00Z",
        criado_em: "2020-01-01T00:00:00Z",
      })
      .eq("id", id)
    expect(recuoError).toBeNull()

    const { error: perdidoError } = await admin
      .from("clientes")
      .update({ status_acompanhamento: "perdido", motivo_perda_id: motivoPerdaId })
      .eq("id", id)
    expect(perdidoError).toBeNull()

    const historico = await historicoDoCliente(id)
    const linhaPerda = historico.find(
      (h) => h.tipo === "status_acompanhamento" && h.descricao.includes('"perdido"')
    )
    expect(linhaPerda).toBeDefined()

    const janela2020 = await clientA.rpc("clientes_perdidos", {
      p_inicio: "2019-12-31T00:00:00Z",
      p_fim: "2020-01-02T00:00:00Z",
    })
    expect(janela2020.error).toBeNull()
    expect(((janela2020.data ?? []) as PerdidoRow[]).map((r) => r.cliente_id)).not.toContain(id)

    const agora = Date.now()
    const janelaAgora = await clientA.rpc("clientes_perdidos", {
      p_inicio: new Date(agora - 10 * 60_000).toISOString(),
      p_fim: new Date(agora + 10 * 60_000).toISOString(),
    })
    expect(janelaAgora.error).toBeNull()
    const linhaAgora = ((janelaAgora.data ?? []) as PerdidoRow[]).find((r) => r.cliente_id === id)
    expect(linhaAgora).toBeDefined()
    expect(new Date(linhaAgora!.perdido_em).getTime()).toBe(new Date(linhaPerda!.criado_em).getTime())
  })

  it("ultima-perda: perdido, reaberto e perdido de novo devolve uma linha só com a data da perda mais recente", async () => {
    const { id } = await seedPerdido(vendedorA.id, "ultima-perda")
    const antes = await clientePorId(id)

    const reabrir = await reabrirComo(clientA, id, antes.etapa)
    expect(reabrir.error).toBeNull()

    const admin = serviceClient()
    const { error: perdidoDeNovoError } = await admin
      .from("clientes")
      .update({ status_acompanhamento: "perdido", motivo_perda_id: motivoPerdaId })
      .eq("id", id)
    expect(perdidoDeNovoError).toBeNull()

    const historico = await historicoDoCliente(id)
    const linhasPerda = historico.filter(
      (h) => h.tipo === "status_acompanhamento" && h.descricao.includes('"perdido"')
    )
    expect(linhasPerda.length).toBeGreaterThanOrEqual(2)
    const maiorCriadoEm = linhasPerda.reduce(
      (max, h) => (h.criado_em > max ? h.criado_em : max),
      linhasPerda[0].criado_em
    )

    const { data, error } = await clientA.rpc("clientes_perdidos", {})
    expect(error).toBeNull()
    const linhas = ((data ?? []) as PerdidoRow[]).filter((r) => r.cliente_id === id)
    expect(linhas.length).toBe(1)
    expect(new Date(linhas[0].perdido_em).getTime()).toBe(new Date(maiorCriadoEm).getTime())
  })

  it("reabrir: reabrir some da leitura, mantém a etapa e registra o histórico com o vendedor como autor", async () => {
    const { id } = await seedPerdido(vendedorA.id, "reabrir")
    const antes = await clientePorId(id)

    const { error } = await reabrirComo(clientA, id, antes.etapa)
    expect(error).toBeNull()

    const depois = await clientePorId(id)
    expect(depois.status_acompanhamento).toBe("em_andamento")
    expect(depois.etapa).toBe(antes.etapa)

    const { data } = await clientA.rpc("clientes_perdidos", {})
    const ids = ((data ?? []) as PerdidoRow[]).map((r) => r.cliente_id)
    expect(ids).not.toContain(id)

    const historico = await historicoDoCliente(id)
    const linhaReabrir = historico.find(
      (h) => h.tipo === "status_acompanhamento" && h.descricao === 'Status alterado para "em_andamento"'
    )
    expect(linhaReabrir).toBeDefined()
    expect(linhaReabrir!.autor_id).toBe(vendedorA.id)
  })

  it("reabrir-outro-vendedor: A não consegue reabrir o perdido de B, que continua perdido", async () => {
    const { id: idB } = await seedPerdido(vendedorB.id, "reabrir-outro-vendedor")
    const antes = await clientePorId(idB)

    // mover_card_funil não eleva privilégio (0002/0026): o UPDATE roda sob a
    // RLS de A e afeta 0 linhas em silêncio para um cliente que A não
    // enxerga — sem erro, mas sem efeito nenhum.
    const { error } = await reabrirComo(clientA, idB, antes.etapa)
    expect(error).toBeNull()

    const depois = await clientePorId(idB)
    expect(depois.status_acompanhamento).toBe("perdido")

    const { data, error: supervisorError } = await supervisorClient
      .rpc("clientes_perdidos", {})
      .in("cliente_id", [idB])
    expect(supervisorError).toBeNull()
    expect(((data ?? []) as PerdidoRow[]).map((r) => r.cliente_id)).toContain(idB)
  })

  it("sem-historico: cliente inserido já perdido, sem linha de histórico, aparece com perdido_em de reserva", async () => {
    const razaoSocial = uniqueRazaoSocial("sem-historico")
    const admin = serviceClient()
    const { data: inserted, error } = await admin
      .from("clientes")
      .insert(
        baseClienteFields(razaoSocial, vendedorA.id, {
          status_acompanhamento: "perdido",
          motivo_perda_id: motivoPerdaId,
        })
      )
      .select("id")
      .single()
    expect(error).toBeNull()
    const id = inserted!.id as string
    createdClienteIds.push(id)

    const historico = await historicoDoCliente(id)
    expect(historico.filter((h) => h.tipo === "status_acompanhamento").length).toBe(0)

    const { data: leitura, error: rpcError } = await clientA.rpc("clientes_perdidos", {})
    expect(rpcError).toBeNull()
    const linha = ((leitura ?? []) as PerdidoRow[]).find((r) => r.cliente_id === id)
    expect(linha).toBeDefined()
    expect(linha!.perdido_em).toBeTruthy()
  })

  it("paginacao: a mesma ordenação (data desc, id asc) sustenta o recorte de página feito por fora", async () => {
    const { id: id1 } = await seedPerdido(vendedorA.id, "paginacao-1")
    const { id: id2 } = await seedPerdido(vendedorA.id, "paginacao-2")

    const pagina0 = await clientA
      .rpc("clientes_perdidos", {})
      .in("cliente_id", [id1, id2])
      .order("perdido_em", { ascending: false })
      .order("cliente_id", { ascending: true })
      .range(0, 0)
    expect(pagina0.error).toBeNull()
    expect((pagina0.data ?? []).length).toBe(1)

    const pagina1 = await clientA
      .rpc("clientes_perdidos", {})
      .in("cliente_id", [id1, id2])
      .order("perdido_em", { ascending: false })
      .order("cliente_id", { ascending: true })
      .range(1, 1)
    expect(pagina1.error).toBeNull()
    expect((pagina1.data ?? []).length).toBe(1)

    const idsPaginados = [
      ...((pagina0.data ?? []) as PerdidoRow[]),
      ...((pagina1.data ?? []) as PerdidoRow[]),
    ].map((r) => r.cliente_id)
    expect(new Set(idsPaginados)).toEqual(new Set([id1, id2]))
  })
})
