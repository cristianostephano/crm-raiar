import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { addDays, format, getISODay, parseISO } from "date-fns"

import {
  anonClient,
  createTestMember,
  deleteTestMember,
  serviceClient,
  signInAs,
  type TestMember,
} from "../helpers/supabase-test-clients"

/**
 * Testes ao vivo da regra PARCIAL da migration 0052 (quick 261008-mrf,
 * 2026-10-08): `dashboard_aderencia_uso()` conta, enquanto a medicao tem
 * menos de 28 dias, so os dias uteis desde o inicio da medicao (ou desde a
 * entrada do vendedor, se mais recente).
 *
 * O projeto Supabase de teste E o de producao, com dados reais de
 * funcionarios e clientes (LGPD). Por isso este arquivo:
 *  - so usa fixtures descartaveis (nunca as contas semente antigas), com
 *    nomes e razoes sociais inventados;
 *  - faz exatamente duas autenticacoes (o Supervisor e o Vendedor P1);
 *  - nunca imprime nada, e toda leitura do Supervisor e filtrada pelos ids
 *    de fixture;
 *  - NUNCA grava em acessos_diarios um dia anterior ao menor dia real: o
 *    inicio da medicao e GLOBAL (menor dia de acessos_diarios do projeto
 *    inteiro), entao gravar antes mudaria o inicio da medicao do time todo.
 *    Toda gravacao passa por `semearAcessosSeguro`, e o menor dia e relido
 *    depois da semeadura, no caso `medicao-intocada` e no fim.
 *
 * Fica VERMELHO enquanto a 0052 nao for aplicada E a medicao tiver menos de
 * 28 dias (ate ~25/10/2026) - vermelho ESPERADO e nao medido na quick task:
 * este arquivo so roda DEPOIS de o dono aplicar a 0052. Depois de ~25/10 os
 * mesmos casos caem sozinhos no ramo de janela cheia do modelo.
 *
 * A identidade com a 0040 na janela cheia e provada ESTRUTURALMENTE (teste
 * aderencia-parcial-migracao: corpo da 0052 = corpo da 0040 + 3 trocas),
 * NAO aqui - prova-la ao vivo exigiria gravar um dia anterior ao inicio real
 * da medicao no banco de producao.
 *
 * Nao rodar perto da meia-noite de Sao Paulo (a data de "hoje" e lida uma
 * vez por chamada e o banco calcula a sua propria).
 */

type AderenciaRow = {
  responsavel: string
  dias_usados: number | string
  dias_uteis: number | string
  aderencia_pct: number | string | null
  coletando_desde: string | null
}

type Esperado = {
  coletando: boolean
  uteis: number
  usados: number
  pct: number | null
  coletandoDesde: string | null
  calendario: string[]
}

// ---------------------------------------------------------------------------
// Helpers de data - sempre por parseISO/aritmetica de data, nunca
// `new Date(texto)` (interpretaria o texto no fuso local do processo).
// ---------------------------------------------------------------------------

/** Hoje no fuso de Sao Paulo, em AAAA-MM-DD. */
function hojeSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const parte = (tipo: string) => parts.find((p) => p.type === tipo)?.value ?? ""
  return `${parte("year")}-${parte("month")}-${parte("day")}`
}

/** `n` dias antes de hoje em Sao Paulo, em AAAA-MM-DD. */
function diaMenos(n: number): string {
  return format(addDays(parseISO(hojeSaoPaulo()), -n), "yyyy-MM-dd")
}

/** `n` dias depois de hoje em Sao Paulo, em AAAA-MM-DD. */
function diaMais(n: number): string {
  return format(addDays(parseISO(hojeSaoPaulo()), n), "yyyy-MM-dd")
}

/** Offsets (hoje menos n) que caem em dia util, de `nAntigo` ate `nRecente`
 * (nAntigo >= nRecente >= 1 - nunca inclui hoje). */
function diasUteisEntre(nAntigo: number, nRecente: number): number[] {
  const offsets: number[] = []
  for (let n = nAntigo; n >= nRecente; n--) {
    if (getISODay(parseISO(diaMenos(n))) < 6) offsets.push(n)
  }
  return offsets
}

/** Dias uteis (segunda a sexta) de `inicio` ate hoje, inclusive, em
 * AAAA-MM-DD. Comparacao de datas por texto (AAAA-MM-DD ordena certo). */
function diasUteisDesde(inicio: string): string[] {
  const hoje = hojeSaoPaulo()
  const dias: string[] = []
  for (let dia = parseISO(inicio); format(dia, "yyyy-MM-dd") <= hoje; dia = addDays(dia, 1)) {
    if (getISODay(dia) < 6) dias.push(format(dia, "yyyy-MM-dd"))
  }
  return dias
}

function maiorData(...datas: string[]): string {
  return datas.reduce((a, b) => (a >= b ? a : b))
}

/** Instante em Sao Paulo (sem horario de verao desde 2019 - offset -03:00
 * fixo) para uma data AAAA-MM-DD e um horario HH:mm. */
function instanteSaoPaulo(dia: string, horaMinuto: string): string {
  return `${dia}T${horaMinuto}:00-03:00`
}

/** Deslocamento de `n` dias a partir de agora, em instante ISO - so para
 * colunas de instante (created_at), nunca para o `dia` de acessos_diarios. */
function haDias(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString()
}

/**
 * Modelo de referencia da regra da 0052 (sem a lacuna de desativacao, que
 * nao e exercitada aqui). `m` e o inicio da medicao (menor dia global).
 */
function esperado(admissaoDia: string, diasComUso: string[], m: string): Esperado {
  const inicioJanela = diaMenos(27)
  const coletando = m > inicioJanela
  const calendario = diasUteisDesde(maiorData(inicioJanela, m, admissaoDia))
  const uteis = calendario.length
  const usados = calendario.filter((dia) => diasComUso.includes(dia)).length
  const pct = uteis === 0 ? null : Math.round((1000 * usados) / uteis) / 10
  let coletandoDesde: string | null
  if (uteis === 0) coletandoDesde = coletando ? m : admissaoDia
  else coletandoDesde = coletando ? calendario[0] : null
  return { coletando, uteis, usados, pct, coletandoDesde, calendario }
}

function comoEsperado(linha: AderenciaRow) {
  return {
    dias_uteis: Number(linha.dias_uteis),
    dias_usados: Number(linha.dias_usados),
    aderencia_pct: linha.aderencia_pct === null ? null : Number(linha.aderencia_pct),
    coletando_desde: linha.coletando_desde,
  }
}

function modeloComoLinha(e: Esperado) {
  return {
    dias_uteis: e.uteis,
    dias_usados: e.usados,
    aderencia_pct: e.pct,
    coletando_desde: e.coletandoDesde,
  }
}

// ---------------------------------------------------------------------------
// Semeadura e leitura
// ---------------------------------------------------------------------------

function uniqueRazaoSocial(label: string): string {
  return `Teste Parcial ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function seedCliente(responsavelId: string, label: string): Promise<{ id: string }> {
  const { data, error } = await serviceClient()
    .from("clientes")
    .insert({
      razao_social: uniqueRazaoSocial(label),
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      cidade: "São Paulo",
      estado: "SP",
      responsavel: responsavelId,
    })
    .select("id")
    .single()
  if (error || !data) {
    throw new Error(`Falha ao semear cliente de fixture (${label}).`)
  }
  return { id: data.id as string }
}

async function seedHistorico(
  clienteId: string,
  tipo: string,
  autorId: string,
  criadoEm: string
): Promise<void> {
  const { error } = await serviceClient().from("historico").insert({
    cliente_id: clienteId,
    tipo,
    descricao: "Teste aderência parcial",
    autor_id: autorId,
    criado_em: criadoEm,
  })
  if (error) {
    throw new Error(`Falha ao semear historico (${tipo}).`)
  }
}

async function definirAdmissao(id: string, instante: string): Promise<void> {
  const { error } = await serviceClient().from("profiles").update({ created_at: instante }).eq("id", id)
  if (error) {
    throw new Error("Falha ao definir created_at de fixture.")
  }
}

/** Menor `dia` de acessos_diarios no projeto inteiro - o inicio real da
 * medicao, igual ao que `dashboard_aderencia_uso()` usa. */
async function menorDiaGlobal(): Promise<string | null> {
  const { data, error } = await serviceClient()
    .from("acessos_diarios")
    .select("dia")
    .order("dia", { ascending: true })
    .limit(1)
  if (error) return null
  const linha = (data ?? [])[0] as { dia: string } | undefined
  return linha?.dia ?? null
}

/**
 * A UNICA forma de gravar em acessos_diarios neste arquivo. Recusa (lanca
 * erro, sem gravar nada) qualquer dia anterior ao menor dia real lido antes
 * da semeadura. A mensagem nunca inclui o valor do menor dia real.
 */
async function semearAcessosSeguro(usuarioId: string, dias: string[]): Promise<void> {
  if (dias.length === 0) return
  if (dias.some((dia) => dia < menorDiaAntes)) {
    throw new Error("Recusado: dia anterior ao inicio real da medicao (nada foi gravado).")
  }
  const { error } = await serviceClient()
    .from("acessos_diarios")
    .upsert(dias.map((dia) => ({ usuario_id: usuarioId, dia })))
  if (error) {
    throw new Error("Falha ao semear acessos de fixture.")
  }
}

async function linhasAderencia(): Promise<AderenciaRow[]> {
  const { data, error } = await supervisorClient.rpc("dashboard_aderencia_uso")
  if (error) {
    throw new Error(`dashboard_aderencia_uso falhou: ${error.message}`)
  }
  return (data ?? []) as AderenciaRow[]
}

async function linhaDe(id: string): Promise<AderenciaRow> {
  const linha = (await linhasAderencia()).find((r) => r.responsavel === id)
  if (!linha) throw new Error("Linha de fixture nao encontrada na resposta do Supervisor.")
  return linha
}

let p1: TestMember
let p2: TestMember
let p3: TestMember
let p4: TestMember
let supervisor: TestMember
let clientP1: SupabaseClient
let supervisorClient: SupabaseClient
let clienteP2Id: string
let menorDiaAntes: string
let diaHistoricoP2: string
let diaAcessoP2: string | null = null

beforeAll(async () => {
  // Menor dia real ANTES de qualquer semeadura. Sem ele nao ha como garantir
  // que nada sera gravado antes do inicio real da medicao.
  const m = await menorDiaGlobal()
  if (m === null) {
    throw new Error("Pre-condicao: nao foi possivel ler o menor dia de acessos_diarios.")
  }
  menorDiaAntes = m

  ;[p1, p2, p3, p4, supervisor] = await Promise.all([
    createTestMember("vendedor", "parcial-p1"),
    createTestMember("vendedor", "parcial-p2"),
    createTestMember("vendedor", "parcial-p3"),
    createTestMember("vendedor", "parcial-p4"),
    createTestMember("supervisor", "parcial"),
  ])

  const inicioP1 = maiorData(menorDiaAntes, diaMenos(27))
  diaHistoricoP2 = diaMenos(diasUteisEntre(27, 21)[0])
  const candidatosAcessoP2 = diasUteisEntre(5, 1)
  const maisRecenteP2 = diaMenos(candidatosAcessoP2[candidatosAcessoP2.length - 1])
  diaAcessoP2 = maisRecenteP2 >= menorDiaAntes ? maisRecenteP2 : null

  const clienteP2 = await seedCliente(p2.id, "p2")
  clienteP2Id = clienteP2.id

  await Promise.all([
    // Admissoes (so profiles, nunca acessos).
    definirAdmissao(p1.id, haDias(-60)),
    definirAdmissao(p2.id, haDias(-60)),
    definirAdmissao(p3.id, haDias(3)),
    definirAdmissao(p4.id, haDias(-3)),

    // P1: acesso em TODO dia util desde o inicio da medicao (ou da janela).
    semearAcessosSeguro(p1.id, diasUteisDesde(inicioP1)),

    // P2: um evento de historico antes da medicao (historico nao mexe no
    // inicio da medicao, que so olha acessos_diarios) e, se for seguro, um
    // acesso recente.
    seedHistorico(clienteP2Id, "etapa", p2.id, instanteSaoPaulo(diaHistoricoP2, "10:00")),
    semearAcessosSeguro(p2.id, diaAcessoP2 === null ? [] : [diaAcessoP2]),
  ])

  // A semeadura nao pode ter mudado o inicio da medicao do time.
  const depois = await menorDiaGlobal()
  if (depois !== menorDiaAntes) {
    throw new Error("Pre-condicao: o menor dia de acessos_diarios mudou durante a semeadura.")
  }

  // Duas autenticacoes reais no arquivo inteiro, sequenciais (rate limit
  // conhecido do login do Supabase Auth - ver STATE.md).
  clientP1 = await signInAs(p1.email, p1.password)
  supervisorClient = await signInAs(supervisor.email, supervisor.password)
}, 60000)

afterAll(async () => {
  const admin = serviceClient()
  if (clienteP2Id) {
    // O historico vai por cascata (historico.cliente_id references
    // clientes(id) on delete cascade).
    await admin.from("clientes").delete().eq("id", clienteP2Id)
  }
  const idsVendedores = [p1?.id, p2?.id, p3?.id, p4?.id].filter((id): id is string => Boolean(id))
  if (idsVendedores.length > 0) {
    await admin.from("acessos_diarios").delete().in("usuario_id", idsVendedores)
  }
  await Promise.all(
    [p1, p2, p3, p4, supervisor]
      .filter((membro): membro is TestMember => Boolean(membro?.id))
      .map((membro) => deleteTestMember(membro.id))
  )
  // Ultima conferencia: o inicio da medicao do time continua o mesmo.
  if (menorDiaAntes !== undefined) {
    const fim = await menorDiaGlobal()
    if (fim !== menorDiaAntes) {
      throw new Error("ATENCAO: o menor dia de acessos_diarios mudou ao longo deste arquivo.")
    }
  }
}, 60000)

describe("Aderencia parcial (0052) - regra contra o banco real", () => {
  it("colunas-contrato: as chaves da linha de P1, ordenadas, sao exatamente as 5 colunas do contrato", async () => {
    const linha = await linhaDe(p1.id)
    expect(Object.keys(linha).sort()).toEqual(
      ["aderencia_pct", "coletando_desde", "dias_usados", "dias_uteis", "responsavel"].sort()
    )
  })

  it("parcial-cem-por-cento: P1, com uso em todo dia util desde o inicio da medicao, tem 100% e o primeiro dia contado e o inicio da coleta", async () => {
    const e = esperado(diaMenos(60), diasUteisDesde(maiorData(menorDiaAntes, diaMenos(27))), menorDiaAntes)
    const linha = await linhaDe(p1.id)
    expect(comoEsperado(linha)).toEqual(modeloComoLinha(e))
    expect(Number(linha.aderencia_pct)).toBe(100)
    expect(Number(linha.dias_usados)).toBe(Number(linha.dias_uteis))
    if (e.coletando) {
      expect(linha.coletando_desde).toBe(e.calendario[0])
      expect(Number(linha.dias_uteis)).toBeLessThan(20)
    }
  })

  it("antes-da-medicao-nao-conta: o evento de P2 anterior ao inicio da medicao nao entra no numerador nem no denominador", async () => {
    const usosP2 = diaAcessoP2 === null ? [diaHistoricoP2] : [diaHistoricoP2, diaAcessoP2]
    const e = esperado(diaMenos(60), usosP2, menorDiaAntes)
    const linha = await linhaDe(p2.id)
    expect(comoEsperado(linha)).toEqual(modeloComoLinha(e))

    if (e.coletando && diaHistoricoP2 < menorDiaAntes) {
      expect(Number(linha.dias_usados)).toBe(diaAcessoP2 === null ? 0 : 1)
      const linhaP1 = await linhaDe(p1.id)
      expect(Number(linha.dias_uteis)).toBe(Number(linhaP1.dias_uteis))
    }
  })

  it("denominador-zero-mantem-aviso: P3, admitido no futuro, tem denominador zero, percentual nulo e o aviso de coleta preenchido", async () => {
    const e = esperado(diaMais(3), [], menorDiaAntes)
    const linha = await linhaDe(p3.id)
    expect(Number(linha.dias_uteis)).toBe(0)
    expect(Number(linha.dias_usados)).toBe(0)
    expect(linha.aderencia_pct).toBeNull()
    expect(linha.coletando_desde).not.toBeNull()
    expect(linha.coletando_desde).toBe(e.coletando ? menorDiaAntes : diaMais(3))
  })

  it("admitido-depois-do-inicio: P4, admitido ha 3 dias, conta so os dias uteis desde a entrada e o 'desde' e o primeiro dia util contado", async () => {
    const e = esperado(diaMenos(3), [], menorDiaAntes)
    const linha = await linhaDe(p4.id)
    expect(comoEsperado(linha)).toEqual(modeloComoLinha(e))
    if (e.coletando && e.uteis > 0) {
      const primeiro = diasUteisDesde(maiorData(menorDiaAntes, diaMenos(3)))[0]
      expect(linha.coletando_desde).toBe(primeiro)
    }
  })

  it("rls-vendedor-zero-linhas: a sessao de P1 chama a RPC e recebe zero linhas, sem erro", async () => {
    const { data, error } = await clientP1.rpc("dashboard_aderencia_uso")
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it("anonimo-zero-linhas: o cliente anonimo recebe zero linhas ou erro, nunca dados", async () => {
    const { data, error } = await anonClient().rpc("dashboard_aderencia_uso")
    if (error) {
      expect(data).toBeFalsy()
    } else {
      expect(data ?? []).toHaveLength(0)
    }
  })

  it("medicao-intocada: o menor dia de acessos_diarios lido agora e o mesmo de antes da semeadura (o inicio da medicao do time nao mudou)", async () => {
    const agora = await menorDiaGlobal()
    // Nunca imprime o valor do menor dia real: so "mudou" / "nao mudou".
    expect(agora === menorDiaAntes, "o menor dia de acessos_diarios mudou").toBe(true)
  })
})
