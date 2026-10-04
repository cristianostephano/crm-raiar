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
 * Prova AO VIVO da Fase 33 (AGD-16): a Agenda atual passa a mostrar SO a
 * prospeccao (tarefas abertas com data). As visitas automaticas dos clientes
 * ativos continuam sendo criadas escondidas e nada e apagado, mas
 * agenda_do_vendedor() (Lista, pendentes do Calendario e contador do menu
 * leem a mesma funcao) nao as devolve mais.
 *
 * Fica VERMELHO ate o plano 33-04 aplicar a migration 0049 no banco
 * hospedado - nao e falha do plano 33-01.
 *
 * NUNCA usar as contas semente antigas (apagadas em 2026-08-19, ver
 * STATE.md): este arquivo usa createTestMember/deleteTestMember para um
 * vendedor descartavel, com UM unico login (limite de login do Supabase
 * Auth). O projeto Supabase de teste E o de producao, com dados reais de
 * clientes - por isso este arquivo nunca imprime linha lida do banco, toda
 * leitura e filtrada por ids semeados aqui, a unica leitura global e uma
 * contagem (sem trazer linha nenhuma) e todos os nomes e CNPJs sao
 * inventados (LGPD).
 */

type AgendaRow = {
  origem: string
  item_id: string
  cliente_id: string
  razao_social: string | null
  responsavel: string
  responsavel_nome: string | null
  titulo: string
  data: string
  frequencia_visita: string | null
  proxima_data_sugerida: string | null
}

type VisitaRow = {
  id: string
  data_prevista: string
  data_realizada: string | null
}

const TEMPO_CASO_MS = 60_000
const TEMPO_PREPARO_MS = 60_000

let cnpjCounter = 0

const createdClienteIds: string[] = []

let vendedor: TestMember
let clientVendedor: SupabaseClient
let tipoTarefaId: string
let tipoTarefaNome: string
let motivoEncerramentoId: string

/** Data de hoje em Sao Paulo (YYYY-MM-DD), a mesma referencia da funcao. */
function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())
}

/** Soma dias a partir de "YYYY-MM-DD" calculando em UTC (nunca o construtor
 * de data com texto local). */
function somaDias(iso: string, n: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + n)).toISOString().slice(0, 10)
}

/** Nome inventado, sem sequencia de 8+ digitos corridos (precaucao da Fase
 * 31): o carimbo de tempo e quebrado a cada 3 digitos com "x". */
function nomeInventado(label: string): string {
  const carimbo = String(Date.now()).replace(/(\d{3})(?=\d)/g, "$1x")
  return `Teste SemVisitas ${label} ${carimbo}-${Math.random().toString(36).slice(2, 8)}`
}

/** 14 digitos derivados do timestamp + contador (CNPJ fictício) - evita
 * colidir com a trava de razao social + CNPJ entre fixtures do arquivo. */
function uniqueCnpj(): string {
  cnpjCounter += 1
  return `${Date.now()}${cnpjCounter}`.slice(-14).padStart(14, "0")
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
    cidade: "Sao Paulo",
    estado: "SP",
    responsavel: responsavelId,
    ...overrides,
  }
}

/** Insere pelo cliente de servico (ignora RLS - so para semear/limpar). */
async function seedCliente(
  label: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; razaoSocial: string }> {
  const razaoSocial = nomeInventado(label)
  const { data, error } = await serviceClient()
    .from("clientes")
    .insert(baseClienteFields(razaoSocial, vendedor.id, overrides))
    .select("id")
    .single()
  if (error || !data) {
    throw new Error(`Falha ao semear cliente: ${error?.message}`)
  }
  createdClienteIds.push(data.id as string)
  return { id: data.id as string, razaoSocial }
}

/** Atalho: etapa "primeira_venda" + status "ganho" (+ overrides). */
async function seedGanho(
  label: string,
  overrides: Record<string, unknown> = {}
): Promise<{ id: string; razaoSocial: string }> {
  return seedCliente(label, {
    etapa: "primeira_venda",
    status_acompanhamento: "ganho",
    ...overrides,
  })
}

async function seedTarefa(
  clienteId: string,
  data: string | null,
  concluida: boolean
): Promise<string> {
  const { data: linha, error } = await serviceClient()
    .from("tarefas")
    .insert({
      cliente_id: clienteId,
      tipo_tarefa_id: tipoTarefaId,
      data_conclusao: data,
      concluida,
    })
    .select("id")
    .single()
  if (error || !linha) {
    throw new Error(`Falha ao semear tarefa: ${error?.message}`)
  }
  return linha.id as string
}

async function seedVisita(clienteId: string, dataPrevista: string): Promise<string> {
  const { data: linha, error } = await serviceClient()
    .from("visitas")
    .insert({ cliente_id: clienteId, data_prevista: dataPrevista, criado_por: vendedor.id })
    .select("id")
    .single()
  if (error || !linha) {
    throw new Error(`Falha ao semear visita: ${error?.message}`)
  }
  return linha.id as string
}

/** Espelha o encerrarViaUpdate de tests/funil/encerrados-rpc.test.ts. */
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

/** Lista completa do vendedor descartavel (RLS: so os clientes dele). */
async function agendaDoVendedor(): Promise<AgendaRow[]> {
  const { data, error } = await clientVendedor.rpc("agenda_do_vendedor")
  if (error) throw new Error(`Falha em agenda_do_vendedor: ${error.message}`)
  return (data ?? []) as AgendaRow[]
}

/** Contagem (sem trazer linhas) feita pelo vendedor descartavel. */
async function contagemDoVendedor(): Promise<number> {
  const { count, error } = await clientVendedor.rpc("agenda_do_vendedor", undefined, {
    count: "exact",
    head: true,
  })
  if (error) throw new Error(`Falha na contagem de agenda_do_vendedor: ${error.message}`)
  return count ?? 0
}

async function visitasDoCliente(clienteId: string): Promise<VisitaRow[]> {
  const { data, error } = await serviceClient()
    .from("visitas")
    .select("id, data_prevista, data_realizada")
    .eq("cliente_id", clienteId)
  if (error) throw new Error(`Falha ao ler visitas: ${error.message}`)
  return (data ?? []) as VisitaRow[]
}

beforeAll(async () => {
  vendedor = await createTestMember("vendedor", "sem-visitas")
  clientVendedor = await signInAs(vendedor.email, vendedor.password)

  const tipo = await serviceClient()
    .from("tipos_tarefa")
    .select("id, nome")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (tipo.error || !tipo.data) {
    throw new Error("Nenhum tipo de tarefa ativo encontrado para o teste")
  }
  tipoTarefaId = tipo.data.id as string
  tipoTarefaNome = tipo.data.nome as string

  const motivo = await serviceClient()
    .from("motivos_encerramento")
    .select("id")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (motivo.error || !motivo.data) {
    throw new Error("Nenhum motivo de encerramento ativo encontrado para o teste")
  }
  motivoEncerramentoId = motivo.data.id as string
}, TEMPO_PREPARO_MS)

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  // A exclusao do cliente leva junto tarefas, visitas e historico (cascata).
  await serviceClient().from("clientes").delete().in("id", createdClienteIds.splice(0))
}, TEMPO_PREPARO_MS)

afterAll(async () => {
  if (createdClienteIds.length > 0) {
    await serviceClient().from("clientes").delete().in("id", createdClienteIds.splice(0))
  }
  // Ordem obrigatoria: clientes primeiro (FK sem ON DELETE), membro depois.
  await deleteTestMember(vendedor.id)
}, TEMPO_PREPARO_MS)

describe("agenda-sem-visitas-automaticas: a Agenda atual so mostra prospeccao (AGD-16)", () => {
  it(
    "sem-visita-global: nenhuma linha de origem visita em todo o banco (so contagem)",
    async () => {
      // Premissa A1: contagem exata + cabecalho sem corpo aceita filtro
      // encadeado. So o numero volta - nenhuma linha real e lida.
      const { count, error } = await serviceClient()
        .rpc("agenda_do_vendedor", undefined, { count: "exact", head: true })
        .eq("origem", "visita")
      expect(error).toBeNull()
      expect(count).toBe(0)
    },
    TEMPO_CASO_MS
  )

  it(
    "ganho-vencido-nao-aparece: cliente ganho com visita vencida some, a tarefa de prospeccao fica (D-34, D-36)",
    async () => {
      const hoje = hojeSP()
      const ontem = somaDias(hoje, -1)
      const cliente = await seedGanho("ganho-vencido", {
        frequencia_visita: "semanal",
        dia_semana_visita: "quinta",
      })
      const visitaId = await seedVisita(cliente.id, ontem)
      const tarefaId = await seedTarefa(cliente.id, hoje, false)

      const linhas = (await agendaDoVendedor()).filter((l) => l.cliente_id === cliente.id)
      expect(linhas).toHaveLength(1)
      expect(linhas[0].origem).toBe("prospeccao")
      expect(linhas[0].item_id).toBe(tarefaId)
      expect(linhas.map((l) => l.item_id)).not.toContain(visitaId)

      // Nada apagado: a visita continua guardada, ainda pendente.
      const visitas = await visitasDoCliente(cliente.id)
      const guardada = visitas.find((v) => v.id === visitaId)
      expect(guardada).toBeDefined()
      expect(guardada?.data_realizada).toBeNull()
    },
    TEMPO_CASO_MS
  )

  it(
    "prospeccao-mesma-ordem-e-colunas: a prospeccao continua com as mesmas datas, ordem e colunas (critério 2, D-36)",
    async () => {
      const hoje = hojeSP()
      const ontem = somaDias(hoje, -1)
      const daqui10 = somaDias(hoje, 10)

      const a = await seedCliente("ordem-A", { status_acompanhamento: "em_andamento" })
      const b = await seedCliente("ordem-B", { status_acompanhamento: "em_andamento" })
      const c = await seedCliente("ordem-C", { status_acompanhamento: "em_andamento" })
      const d = await seedCliente("ordem-D", { status_acompanhamento: "em_andamento" })

      const tarefaC = await seedTarefa(c.id, daqui10, false)
      const tarefaD = await seedTarefa(d.id, ontem, false)
      const tarefaB = await seedTarefa(b.id, hoje, false)
      const tarefaA = await seedTarefa(a.id, hoje, false)
      // Fora da lista: concluida e aberta sem data, no cliente A.
      const tarefaConcluida = await seedTarefa(a.id, hoje, true)
      const tarefaSemData = await seedTarefa(a.id, null, false)

      // Quinto cliente: ganho que depois e encerrado, com tarefa aberta de hoje.
      const encerrado = await seedGanho("ordem-encerrado", { frequencia_visita: "mensal" })
      const tarefaEncerrado = await seedTarefa(encerrado.id, hoje, false)
      await encerrarViaUpdate(encerrado.id)

      const idsSemeados = new Set([a.id, b.id, c.id, d.id, encerrado.id])
      // Sem reordenar no teste: a ordem e a que a funcao devolveu.
      const linhas = (await agendaDoVendedor()).filter((l) => idsSemeados.has(l.cliente_id))

      expect(linhas.map((l) => l.item_id)).toEqual([tarefaD, tarefaA, tarefaB, tarefaC])
      const idsVistos = linhas.map((l) => l.item_id)
      expect(idsVistos).not.toContain(tarefaConcluida)
      expect(idsVistos).not.toContain(tarefaSemData)
      expect(idsVistos).not.toContain(tarefaEncerrado)

      const dataEsperada = new Map<string, string>([
        [tarefaD, ontem],
        [tarefaA, hoje],
        [tarefaB, hoje],
        [tarefaC, daqui10],
      ])
      for (const linha of linhas) {
        expect(linha.origem).toBe("prospeccao")
        expect(linha.titulo).toBe(tipoTarefaNome)
        expect(linha.data).toBe(dataEsperada.get(linha.item_id))
        expect(linha.frequencia_visita).toBeNull()
        expect(linha.proxima_data_sugerida).toBeNull()
        expect(linha.responsavel).toBe(vendedor.id)
        expect(linha.responsavel_nome).toBeTruthy()
      }
    },
    TEMPO_CASO_MS
  )

  it(
    "contador-igual-lista: o contador do menu e a lista concordam e caem juntos ao concluir (critérios 1 e 2)",
    async () => {
      const hoje = hojeSP()
      const ganho = await seedGanho("contador-ganho", { frequencia_visita: "mensal" })
      await seedVisita(ganho.id, hoje)

      const ativo = await seedCliente("contador-ativo", { status_acompanhamento: "em_andamento" })
      const tarefa1 = await seedTarefa(ativo.id, hoje, false)
      const tarefa2 = await seedTarefa(ativo.id, somaDias(hoje, 1), false)
      await seedTarefa(ativo.id, null, false)
      await seedTarefa(ativo.id, hoje, true)

      const lista = await agendaDoVendedor()
      expect(lista).toHaveLength(2)
      expect(await contagemDoVendedor()).toBe(2)

      const { error } = await clientVendedor.rpc("concluir_tarefa_prospeccao", {
        p_tarefa_id: tarefa1,
        p_resumo: "Contato feito com o comprador, retorno combinado para a semana que vem.",
      })
      expect(error).toBeNull()

      const listaDepois = await agendaDoVendedor()
      expect(listaDepois).toHaveLength(1)
      expect(await contagemDoVendedor()).toBe(1)
      expect(listaDepois.map((l) => l.item_id)).not.toContain(tarefa1)
      expect(listaDepois.map((l) => l.item_id)).toContain(tarefa2)
    },
    TEMPO_CASO_MS
  )

  it(
    "concluir-visita-silencioso: concluir a visita continua criando a proxima escondida e vai para o historico (D-33, D-34, critério 5)",
    async () => {
      const hoje = hojeSP()
      const proxima = somaDias(hoje, 14)
      const cliente = await seedGanho("concluir-visita", { frequencia_visita: "mensal" })
      const visitaId = await seedVisita(cliente.id, hoje)

      const { error } = await clientVendedor.rpc("concluir_visita", {
        p_visita_id: visitaId,
        p_resumo: "Visita realizada, cliente satisfeito com o atendimento.",
        p_proxima_data: proxima,
      })
      expect(error).toBeNull()

      // A original ficou concluida e existe exatamente 1 pendente nova.
      const visitas = await visitasDoCliente(cliente.id)
      const original = visitas.find((v) => v.id === visitaId)
      expect(original?.data_realizada).not.toBeNull()
      const pendentes = visitas.filter((v) => v.data_realizada === null)
      expect(pendentes).toHaveLength(1)
      expect(pendentes[0].data_prevista).toBe(proxima)

      // A Agenda atual nao mostra nada desse cliente.
      const linhas = (await agendaDoVendedor()).filter((l) => l.cliente_id === cliente.id)
      expect(linhas).toHaveLength(0)

      // O historico de concluidos do calendario segue mostrando a visita.
      const { data: concluidos, error: erroConcluidos } = await clientVendedor.rpc(
        "agenda_concluidos_do_vendedor",
        { p_inicio: somaDias(hoje, -1), p_fim: somaDias(hoje, 1) }
      )
      expect(erroConcluidos).toBeNull()
      const daVisita = ((concluidos ?? []) as AgendaRow[]).filter((l) => l.item_id === visitaId)
      expect(daVisita).toHaveLength(1)
      expect(daVisita[0].origem).toBe("visita")

      // O Diario segue com o registro da visita concluida.
      const { data: historico, error: erroHistorico } = await serviceClient()
        .from("historico")
        .select("tipo")
        .eq("cliente_id", cliente.id)
        .eq("tipo", "visita_concluida")
      expect(erroHistorico).toBeNull()
      expect((historico ?? []).length).toBeGreaterThanOrEqual(1)
    },
    TEMPO_CASO_MS
  )

  it(
    "ficha-mantem-frequencia: frequencia e dia fixo continuam na ficha e editaveis, sem trazer a visita de volta (D-37, critério 4)",
    async () => {
      const hoje = hojeSP()
      const cliente = await seedGanho("ficha", {
        frequencia_visita: "semanal",
        dia_semana_visita: "quinta",
      })
      await seedVisita(cliente.id, hoje)

      const antes = await serviceClient()
        .from("clientes")
        .select("frequencia_visita, dia_semana_visita")
        .eq("id", cliente.id)
        .single()
      expect(antes.error).toBeNull()
      expect(antes.data?.frequencia_visita).toBe("semanal")
      expect(antes.data?.dia_semana_visita).toBe("quinta")

      // Mesmo UPDATE que a ficha manda (app/actions/clientes.ts).
      const { data: atualizado, error } = await clientVendedor
        .from("clientes")
        .update({
          frequencia_visita: "quinzenal",
          dia_semana_visita: "terca",
          semana_do_mes_visita: null,
        })
        .eq("id", cliente.id)
        .select("id")
        .maybeSingle()
      expect(error).toBeNull()
      expect(atualizado?.id).toBe(cliente.id)

      const depois = await serviceClient()
        .from("clientes")
        .select("frequencia_visita, dia_semana_visita")
        .eq("id", cliente.id)
        .single()
      expect(depois.error).toBeNull()
      expect(depois.data?.frequencia_visita).toBe("quinzenal")
      expect(depois.data?.dia_semana_visita).toBe("terca")

      const linhas = (await agendaDoVendedor()).filter((l) => l.cliente_id === cliente.id)
      expect(linhas).toHaveLength(0)
    },
    TEMPO_CASO_MS
  )
})
