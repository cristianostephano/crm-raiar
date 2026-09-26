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
 * Prova o critério 5 da Fase 29 (ENCR-03/ENCR-05) contra o banco real: os
 * números históricos do Dashboard — ganhos x perdidos, taxa de conversão,
 * desempenho por vendedor, tempo até fechamento, comparativo por vendedor
 * (ganho e ciclo médio) e funil detalhado — não mudam porque um cliente foi
 * encerrado depois de ganho, nem porque foi reativado depois.
 *
 * NUNCA usar as contas semente antigas (`vendedor.a+test`/`vendedor.b+test`),
 * apagadas em 2026-08-19 (ver STATE.md) — este arquivo usa
 * `createTestMember`/`deleteTestMember` para uma fixture descartável. Uma
 * autenticação só (Vendedor A) — as funções do Dashboard rodam como o
 * chamador (SECURITY INVOKER), então A enxerga só os próprios clientes e os
 * totais lidos ficam exatos sem depender do resto da carteira real.
 *
 * `dashboard_comparativo_vendedor()` devolve uma linha por vendedor ATIVO
 * (não filtrada por período nem por chamador), então o resultado é
 * filtrado para a linha de A imediatamente após cada chamada e nada do
 * conteúdo de uma leitura é impresso no terminal (LGPD) — o projeto de
 * teste é o mesmo projeto Supabase de produção, com dados reais de
 * clientes.
 *
 * Fica VERMELHO (valor de enum/tabela/função ainda inexistentes) até o
 * push do plano 29-03, que aplica 0035, 0036 e 0037 nesta ordem.
 */

const DIA_MS = 24 * 60 * 60 * 1000

type GanhosPerdidosRow = { status: string; total: number | string }
type DesempenhoVendedorRow = {
  responsavel: string
  responsavel_nome: string | null
  ganho: number | string
  perdido: number | string
}
type TempoAteFechamentoRow = {
  status: string
  media_dias: number | string | null
}
type ComparativoVendedorRow = {
  responsavel: string
  responsavel_nome: string | null
  negocios_iniciados: number | string
  ganho: number | string
  perdido: number | string
  ciclo_medio_dias: number | string | null
}
type FunilDetalhadoRow = {
  etapa: string
  quantidade: number | string
  avancou_count: number | string
  avancou_pct: number | string | null
  perdidos_count: number | string
  perdidos_pct: number | string | null
  tempo_medio_dias: number | string | null
  gargalo: boolean
}

type Retrato = {
  ganhosPerdidos: GanhosPerdidosRow[]
  desempenhoVendedor: DesempenhoVendedorRow[]
  tempoAteFechamento: TempoAteFechamentoRow[]
  comparativoVendedor: ComparativoVendedorRow | undefined
  funilDetalhado: FunilDetalhadoRow[]
}

function uniqueRazaoSocial(label: string): string {
  return `Teste Dashboard Encerrado ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

let vendedorA: TestMember
let clientA: SupabaseClient
let motivoEncerramentoId: string

beforeAll(async () => {
  vendedorA = await createTestMember("vendedor", "dashboard-encerrado")
  clientA = await signInAs(vendedorA.email, vendedorA.password)
  motivoEncerramentoId = await primeiroMotivoEncerramentoId()
})

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  await serviceClient().from("clientes").delete().in("id", createdClienteIds.splice(0))
})

afterAll(async () => {
  await deleteTestMember(vendedorA.id)
})

async function primeiroMotivoEncerramentoId(): Promise<string> {
  const { data, error } = await serviceClient()
    .from("motivos_encerramento")
    .select("id")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error("Nenhum motivo de encerramento ativo encontrado para o teste")
  }
  return data.id as string
}

/**
 * Semeia um cliente de A já ganho há 10 dias (criado há 30 dias, entrou em
 * "primeira_venda" há 20 dias): insere pelo cliente de serviço, avança a
 * etapa e o status em dois UPDATEs separados (o gatilho
 * `clientes_after_update_historico`, 0002, só reage a UPDATE — nunca a
 * INSERT — daqui vêm as duas linhas de histórico), e por fim recua
 * `clientes.criado_em` e as duas linhas de histórico recém-escritas para as
 * datas do cenário. Nenhuma trigger reage a essas colunas de data — todas
 * são UPDATEs simples pelo cliente de serviço.
 */
async function seedGanhoAntigo(label: string): Promise<{ id: string; razaoSocial: string }> {
  const razaoSocial = uniqueRazaoSocial(label)
  const admin = serviceClient()

  const { data: inserted, error: insertError } = await admin
    .from("clientes")
    .insert(baseClienteFields(razaoSocial, vendedorA.id))
    .select("id")
    .single()
  if (insertError || !inserted) {
    throw new Error(`Falha ao semear cliente: ${insertError?.message}`)
  }
  const id = inserted.id as string
  createdClienteIds.push(id)

  const { error: etapaError } = await admin
    .from("clientes")
    .update({ etapa: "primeira_venda" })
    .eq("id", id)
  if (etapaError) {
    throw new Error(`Falha ao avançar a etapa: ${etapaError.message}`)
  }

  const { error: ganhoError } = await admin
    .from("clientes")
    .update({ status_acompanhamento: "ganho" })
    .eq("id", id)
  if (ganhoError) {
    throw new Error(`Falha ao marcar ganho: ${ganhoError.message}`)
  }

  const agora = Date.now()
  const criadoEm = new Date(agora - 30 * DIA_MS).toISOString()
  const etapaEm = new Date(agora - 20 * DIA_MS).toISOString()
  const ganhoEm = new Date(agora - 10 * DIA_MS).toISOString()

  const { error: backdateClienteError } = await admin
    .from("clientes")
    .update({ criado_em: criadoEm })
    .eq("id", id)
  if (backdateClienteError) {
    throw new Error(`Falha ao recuar clientes.criado_em: ${backdateClienteError.message}`)
  }

  const { data: historicoRows, error: historicoError } = await admin
    .from("historico")
    .select("id, tipo")
    .eq("cliente_id", id)
  if (historicoError) {
    throw new Error(`Falha ao ler histórico do cliente semeado: ${historicoError.message}`)
  }
  const etapaRow = (historicoRows ?? []).find((h) => h.tipo === "etapa")
  const statusRow = (historicoRows ?? []).find((h) => h.tipo === "status_acompanhamento")
  if (!etapaRow || !statusRow) {
    throw new Error("Histórico incompleto ao semear o cenário ganho-antigo (esperava 1 linha de etapa e 1 de status)")
  }

  const { error: backdateEtapaError } = await admin
    .from("historico")
    .update({ criado_em: etapaEm })
    .eq("id", etapaRow.id)
  if (backdateEtapaError) {
    throw new Error(`Falha ao recuar a linha de histórico de etapa: ${backdateEtapaError.message}`)
  }

  const { error: backdateGanhoError } = await admin
    .from("historico")
    .update({ criado_em: ganhoEm })
    .eq("id", statusRow.id)
  if (backdateGanhoError) {
    throw new Error(`Falha ao recuar a linha de histórico de ganho: ${backdateGanhoError.message}`)
  }

  return { id, razaoSocial }
}

/**
 * Trocas de status posteriores ao cenário-base são sempre UPDATEs pelo
 * cliente de serviço — este arquivo testa a LEITURA do Dashboard, não os
 * guards da RPC `mover_card_funil` (já provados em `encerrados-rpc.test.ts`,
 * plano 29-01).
 */
async function marcarStatusComoServico(
  clienteId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const { error } = await serviceClient().from("clientes").update(patch).eq("id", clienteId)
  if (error) {
    throw new Error(`Falha ao atualizar status do cliente ${clienteId}: ${error.message}`)
  }
}

async function encerrarComoServico(clienteId: string): Promise<void> {
  await marcarStatusComoServico(clienteId, {
    status_acompanhamento: "encerrado",
    motivo_encerramento_id: motivoEncerramentoId,
  })
}

async function reativarComoServico(clienteId: string): Promise<void> {
  await marcarStatusComoServico(clienteId, { status_acompanhamento: "ganho" })
}

async function reabrirComoServico(clienteId: string): Promise<void> {
  await marcarStatusComoServico(clienteId, { status_acompanhamento: "em_andamento" })
}

function janelaRetrato(): { p_inicio: string; p_fim: string } {
  const agora = Date.now()
  return {
    p_inicio: new Date(agora - 40 * DIA_MS).toISOString(),
    p_fim: new Date(agora + DIA_MS).toISOString(),
  }
}

/**
 * Lê, em paralelo e como A, as 5 funções do critério 5: ganhos x perdidos e
 * desempenho por vendedor na janela [agora-40d, agora+1d), tempo até
 * fechamento e funil detalhado (sem parâmetro de período) e o comparativo
 * por vendedor — já filtrado para a linha de A. Falha alto se qualquer
 * chamada devolver erro; ordena ganhos x perdidos por status para a
 * comparação com `toEqual` ficar determinística.
 */
async function retrato(): Promise<Retrato> {
  const janela = janelaRetrato()

  const [ganhosPerdidosRes, desempenhoRes, tempoRes, comparativoRes, funilRes] = await Promise.all([
    clientA.rpc("dashboard_ganhos_perdidos", janela),
    clientA.rpc("dashboard_desempenho_vendedor", janela),
    clientA.rpc("dashboard_tempo_ate_fechamento"),
    clientA.rpc("dashboard_comparativo_vendedor"),
    clientA.rpc("dashboard_funil_detalhado"),
  ])

  const chamadas = [
    ["dashboard_ganhos_perdidos", ganhosPerdidosRes] as const,
    ["dashboard_desempenho_vendedor", desempenhoRes] as const,
    ["dashboard_tempo_ate_fechamento", tempoRes] as const,
    ["dashboard_comparativo_vendedor", comparativoRes] as const,
    ["dashboard_funil_detalhado", funilRes] as const,
  ]
  for (const [nome, resposta] of chamadas) {
    if (resposta.error) {
      throw new Error(`${nome} falhou: ${resposta.error.message}`)
    }
  }

  const ganhosPerdidos = ((ganhosPerdidosRes.data ?? []) as GanhosPerdidosRow[])
    .slice()
    .sort((a, b) => a.status.localeCompare(b.status))
  const desempenhoVendedor = (desempenhoRes.data ?? []) as DesempenhoVendedorRow[]
  const tempoAteFechamento = (tempoRes.data ?? []) as TempoAteFechamentoRow[]
  const comparativoVendedor = ((comparativoRes.data ?? []) as ComparativoVendedorRow[]).find(
    (linha) => linha.responsavel === vendedorA.id
  )
  const funilDetalhado = (funilRes.data ?? []) as FunilDetalhadoRow[]

  return { ganhosPerdidos, desempenhoVendedor, tempoAteFechamento, comparativoVendedor, funilDetalhado }
}

describe("Dashboard sobrevive a encerrar/reativar (Fase 29, critério 5 / ENCR-03/ENCR-05)", () => {
  it("encerrar-nao-muda-numeros: encerrar um cliente ganho não muda nenhum número do Dashboard", async () => {
    const { id } = await seedGanhoAntigo("encerrar-nao-muda-numeros")

    const antes = await retrato()
    const ganhoAntes = antes.ganhosPerdidos.find((linha) => linha.status === "ganho")
    expect(ganhoAntes).toBeDefined()
    expect(Number(ganhoAntes!.total)).toBe(1)
    const tempoGanhoAntes = antes.tempoAteFechamento.find((linha) => linha.status === "ganho")
    expect(tempoGanhoAntes).toBeDefined()
    expect(Number(tempoGanhoAntes!.media_dias)).toBeCloseTo(20, 1)

    await encerrarComoServico(id)

    const depois = await retrato()
    expect(depois).toEqual(antes)
  })

  it("reativar-nao-redata: reativar (encerrado -> ganho) não conta um ganho novo nem muda a data do ganho original", async () => {
    const { id } = await seedGanhoAntigo("reativar-nao-redata")

    const original = await retrato()

    await encerrarComoServico(id)
    await reativarComoServico(id)

    const depois = await retrato()
    expect(depois).toEqual(original)

    const agora = Date.now()

    const janelaOriginal = await clientA.rpc("dashboard_ganhos_perdidos", {
      p_inicio: new Date(agora - 11 * DIA_MS).toISOString(),
      p_fim: new Date(agora - 9 * DIA_MS).toISOString(),
    })
    expect(janelaOriginal.error).toBeNull()
    const ganhoOriginal = ((janelaOriginal.data ?? []) as GanhosPerdidosRow[]).find(
      (linha) => linha.status === "ganho"
    )
    expect(ganhoOriginal).toBeDefined()
    expect(Number(ganhoOriginal!.total)).toBe(1)

    const janelaReativacao = await clientA.rpc("dashboard_ganhos_perdidos", {
      p_inicio: new Date(agora - 60 * 60 * 1000).toISOString(),
      p_fim: new Date(agora + 60 * 60 * 1000).toISOString(),
    })
    expect(janelaReativacao.error).toBeNull()
    const ganhoNaReativacao = ((janelaReativacao.data ?? []) as GanhosPerdidosRow[]).find(
      (linha) => linha.status === "ganho"
    )
    expect(ganhoNaReativacao).toBeUndefined()
  })

  it("novo-ciclo-conta: ganho -> encerrado -> em andamento -> ganho de novo conta o novo ciclo na data dele", async () => {
    const { id } = await seedGanhoAntigo("novo-ciclo-conta")

    await encerrarComoServico(id)
    await reabrirComoServico(id)
    await reativarComoServico(id)

    const agora = Date.now()
    const janela = await clientA.rpc("dashboard_ganhos_perdidos", {
      p_inicio: new Date(agora - 60 * 60 * 1000).toISOString(),
      p_fim: new Date(agora + 60 * 60 * 1000).toISOString(),
    })
    expect(janela.error).toBeNull()
    const ganhoNovo = ((janela.data ?? []) as GanhosPerdidosRow[]).find((linha) => linha.status === "ganho")
    expect(ganhoNovo).toBeDefined()
    expect(Number(ganhoNovo!.total)).toBe(1)
  })
})
