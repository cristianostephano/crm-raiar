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
 * Integration tests for the migration 0040 surface (30-02-PLAN.md,
 * ADER-01..03, D-02/D-03/D-06/D-07/D-08/D-09): a função agregada
 * `dashboard_aderencia_uso()`.
 *
 * NUNCA usa as contas semente antigas (apagadas em 2026-08-19 — ver
 * STATE.md) — só fixtures descartáveis via `createTestMember`/
 * `deleteTestMember`. O projeto Supabase de teste É o de produção, com
 * dados reais de funcionários e clientes — por isso este arquivo NUNCA
 * imprime uma linha lida do banco no terminal, toda leitura do Supervisor
 * é filtrada pelos ids de fixture semeados aqui, e os nomes/razões sociais
 * são todos inventados (LGPD). A comparação de conjuntos com
 * `dashboard_comparativo_vendedor()` usa só contagens de diferença, para
 * que uma falha nunca imprima ids de vendedores reais.
 *
 * No máximo duas autenticações no arquivo inteiro: o Supervisor e o
 * Vendedor V1 (Supabase Auth tem rate limit conhecido de
 * signInWithPassword — ver STATE.md).
 *
 * Fica VERMELHO (função inexistente no banco) até o plano 30-03 aplicar as
 * migrations 0038/0039/0040 no projeto hospedado. Durante a execução, as
 * linhas de fixture podem, por alguns segundos, antecipar o fim da coleta
 * no painel real — aceitável, e desfeito na limpeza (afterAll).
 */

type AderenciaRow = {
  responsavel: string
  dias_usados: number | string
  dias_uteis: number | string
  aderencia_pct: number | string | null
  coletando_desde: string | null
}

type ComparativoRow = {
  responsavel: string
}

// ───────────────────────────────────────────────────────────────────────
// Helpers de data — sempre por parseISO/aritmética de data, nunca
// `new Date(texto)` (Pitfall 1 da 30-RESEARCH: interpretaria o texto no
// fuso local do processo de teste, não no de São Paulo).
// ───────────────────────────────────────────────────────────────────────

/** Hoje no fuso de São Paulo, em AAAA-MM-DD. */
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

/** `n` dias antes de hoje em São Paulo, em AAAA-MM-DD. */
function diaMenos(n: number): string {
  return format(addDays(parseISO(hojeSaoPaulo()), -n), "yyyy-MM-dd")
}

/** `n` dias depois de hoje em São Paulo, em AAAA-MM-DD. */
function diaMais(n: number): string {
  return format(addDays(parseISO(hojeSaoPaulo()), n), "yyyy-MM-dd")
}

/** Todos os offsets (n, contados como "hoje menos n") que caem em dia útil
 * (segunda a sexta), varrendo de `nAntigo` até `nRecente` (nAntigo >=
 * nRecente >= 1 — nunca inclui hoje). */
function diasUteisEntre(nAntigo: number, nRecente: number): number[] {
  const offsets: number[] = []
  for (let n = nAntigo; n >= nRecente; n--) {
    if (getISODay(parseISO(diaMenos(n))) < 6) offsets.push(n)
  }
  return offsets
}

/** O primeiro offset entre `nAntigo` e `nRecente` cujo dia da semana ISO
 * (1=segunda ... 7=domingo) é exatamente `isoDia`. */
function diaDaSemanaEntre(isoDia: number, nAntigo: number, nRecente: number): number {
  for (let n = nAntigo; n >= nRecente; n--) {
    if (getISODay(parseISO(diaMenos(n))) === isoDia) return n
  }
  throw new Error(`Nenhum dia com isodow=${isoDia} entre hoje-${nAntigo} e hoje-${nRecente}`)
}

/** Instante em São Paulo (sem horário de verão desde 2019 — offset -03:00
 * sempre fixo) para uma data AAAA-MM-DD e um horário HH:mm. */
function instanteSaoPaulo(dia: string, horaMinuto: string): string {
  return `${dia}T${horaMinuto}:00-03:00`
}

/** Deslocamento de `n` dias a partir de agora, em instante ISO — usado só
 * para colunas de instante (created_at/desativado_em/reativado_em), nunca
 * para o `dia` gravado em acessos_diarios (esse é sempre AAAA-MM-DD). */
function haDias(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString()
}

// ───────────────────────────────────────────────────────────────────────
// Semeadura
// ───────────────────────────────────────────────────────────────────────

function uniqueRazaoSocial(label: string): string {
  return `Teste Aderencia ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
    throw new Error(`Falha ao semear cliente de fixture (${label}): ${error?.message}`)
  }
  return { id: data.id as string }
}

async function seedHistorico(
  clienteId: string,
  tipo: string,
  autorId: string | null,
  criadoEm: string
): Promise<void> {
  const { error } = await serviceClient().from("historico").insert({
    cliente_id: clienteId,
    tipo,
    descricao: "Teste aderência",
    autor_id: autorId,
    criado_em: criadoEm,
  })
  if (error) {
    throw new Error(`Falha ao semear historico (${tipo}): ${error.message}`)
  }
}

/** `created_at` sempre existe (migration 0001) — falha aqui é bug real,
 * nunca RED esperado. */
async function definirAdmissao(id: string, instante: string): Promise<void> {
  const { error } = await serviceClient().from("profiles").update({ created_at: instante }).eq("id", id)
  if (error) {
    throw new Error(`Falha ao definir created_at de ${id}: ${error.message}`)
  }
}

/** Melhor esforço: desativado_em/reativado_em (migration 0039) e a tabela
 * acessos_diarios (migration 0038) só existem a partir do plano 30-03 —
 * falhar aqui é o RED esperado e não deve travar a suíte inteira; os
 * casos que dependem destes dados falham sozinhos, isolados, mais adiante. */
async function tentarDefinirCarimbos(
  id: string,
  campos: Partial<{ desativado_em: string; reativado_em: string }>
): Promise<void> {
  await serviceClient().from("profiles").update(campos).eq("id", id)
}

async function seedAcesso(usuarioId: string, dia: string): Promise<void> {
  await serviceClient().from("acessos_diarios").upsert({ usuario_id: usuarioId, dia })
}

/** Menor `dia` de acessos_diarios no projeto inteiro (não escopado pelas
 * fixtures deste arquivo) — mede o início real da coleta, igual a
 * `dashboard_aderencia_uso()` faz. `null` em RED (tabela ainda não existe). */
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

async function linhasAderencia(): Promise<AderenciaRow[]> {
  const { data, error } = await supervisorClient.rpc("dashboard_aderencia_uso")
  if (error) {
    throw new Error(`dashboard_aderencia_uso falhou: ${error.message}`)
  }
  return (data ?? []) as AderenciaRow[]
}

async function linhaDe(id: string): Promise<AderenciaRow | undefined> {
  const linhas = await linhasAderencia()
  return linhas.find((r) => r.responsavel === id)
}

let v1: TestMember
let v2: TestMember
let v3: TestMember
let v4: TestMember
let v5: TestMember
let v6: TestMember
let v7: TestMember
let supervisor: TestMember
let clientV1: SupabaseClient
let supervisorClient: SupabaseClient
let clienteV2Id: string
let clienteV7Id: string

beforeAll(async () => {
  // Criação dos 8 membros em paralelo — sequencial estourava o
  // hookTimeout padrão de 10s desta suíte (8 fixtures, bem mais que o
  // usual de 2-4 nos outros arquivos deste projeto).
  ;[v1, v2, v3, v4, v5, v6, v7, supervisor] = await Promise.all([
    createTestMember("vendedor", "aderencia-v1"),
    createTestMember("vendedor", "aderencia-v2"),
    createTestMember("vendedor", "aderencia-v3"),
    createTestMember("vendedor", "aderencia-v4"),
    createTestMember("vendedor", "aderencia-v5"),
    createTestMember("vendedor", "aderencia-v6"),
    createTestMember("vendedor", "aderencia-v7"),
    createTestMember("supervisor", "aderencia"),
  ])

  const diasUteisV1 = diasUteisEntre(9, 1)
  const diasUteisV2 = diasUteisEntre(9, 1)
  const [d1, d2, d3, d4] = diasUteisV2
  const diasUteisV3 = diasUteisEntre(6, 1)
  const diaAntesAdmissaoV3 = diasUteisEntre(13, 7)[0]
  const diaForaLacunaV4 = diasUteisEntre(27, 21)[0]
  const diaDentroLacunaV4 = diasUteisEntre(20, 7)[0]
  const sextaV7 = diaDaSemanaEntre(5, 27, 1)

  const [clienteV2, clienteV7] = await Promise.all([
    seedCliente(v2.id, "v2"),
    seedCliente(v7.id, "v7"),
  ])
  clienteV2Id = clienteV2.id
  clienteV7Id = clienteV7.id

  await Promise.all([
    // Admissão de cada vendedor de fixture (D-07).
    definirAdmissao(v1.id, haDias(-60)),
    definirAdmissao(v2.id, haDias(-60)),
    definirAdmissao(v3.id, haDias(-6)),
    definirAdmissao(v4.id, haDias(-60)),
    definirAdmissao(v5.id, haDias(3)),
    definirAdmissao(v6.id, haDias(-60)),
    definirAdmissao(v7.id, haDias(-60)),

    // Lacuna de desativação/reativação (D-07, migration 0039 — melhor
    // esforço, RED até o 30-03).
    tentarDefinirCarimbos(v4.id, { desativado_em: haDias(-20), reativado_em: haDias(-6) }),
    tentarDefinirCarimbos(v6.id, { reativado_em: haDias(-6) }),

    // V1: 3 acessos em dia útil + 1 sábado + 1 domingo — fim de semana
    // não conta nem penaliza (correção 5 do 30-01).
    seedAcesso(v1.id, diaMenos(diasUteisV1[0])),
    seedAcesso(v1.id, diaMenos(diasUteisV1[1])),
    seedAcesso(v1.id, diaMenos(diasUteisV1[2])),
    seedAcesso(v1.id, diaMenos(diaDaSemanaEntre(6, 7, 1))),
    seedAcesso(v1.id, diaMenos(diaDaSemanaEntre(7, 7, 1))),

    // V2: histórico com autor (união com acesso, sem duplicar o mesmo
    // dia), um evento com autor nulo (Pitfall 2) e um evento fora da
    // janela — os três ignorados, só os 3 dias úteis reais (d1/d2/d3)
    // contam.
    seedHistorico(clienteV2Id, "tarefa_concluida", v2.id, instanteSaoPaulo(diaMenos(d1), "09:00")),
    seedHistorico(clienteV2Id, "visita_concluida", v2.id, instanteSaoPaulo(diaMenos(d1), "10:00")),
    seedHistorico(clienteV2Id, "etapa", v2.id, instanteSaoPaulo(diaMenos(d2), "09:00")),
    seedHistorico(clienteV2Id, "status_acompanhamento", v2.id, instanteSaoPaulo(diaMenos(d3), "09:00")),
    seedAcesso(v2.id, diaMenos(d2)),
    seedHistorico(clienteV2Id, "etapa", null, instanteSaoPaulo(diaMenos(d4), "09:00")),
    seedHistorico(clienteV2Id, "etapa", v2.id, instanteSaoPaulo(diaMenos(30), "09:00")),

    // V3: admitido há 6 dias — 2 acessos dentro da janela ativa, e 1
    // acesso sintético ANTES da admissão (deve ser ignorado, D-07).
    seedAcesso(v3.id, diaMenos(diasUteisV3[0])),
    seedAcesso(v3.id, diaMenos(diasUteisV3[1])),
    seedAcesso(v3.id, diaMenos(diaAntesAdmissaoV3)),

    // V4: 1 acesso fora da lacuna de desativação (conta) e 1 acesso
    // sintético DENTRO da lacuna (deve ser ignorado, D-07).
    seedAcesso(v4.id, diaMenos(diaForaLacunaV4)),
    seedAcesso(v4.id, diaMenos(diaDentroLacunaV4)),

    // V7: um único evento de sexta-feira às 23:30 em São Paulo (02:30
    // UTC de sábado) — o fuso nunca pode empurrar isso para sábado
    // (Pitfall 1).
    seedHistorico(clienteV7Id, "tarefa_concluida", v7.id, instanteSaoPaulo(diaMenos(sextaV7), "23:30")),
  ])

  // Duas autenticações reais no arquivo inteiro, sequenciais (rate limit
  // conhecido de signInWithPassword — ver STATE.md).
  clientV1 = await signInAs(v1.email, v1.password)
  supervisorClient = await signInAs(supervisor.email, supervisor.password)
}, 60000)

afterAll(async () => {
  const admin = serviceClient()
  const clienteIds = [clienteV2Id, clienteV7Id].filter((id): id is string => Boolean(id))
  if (clienteIds.length > 0) {
    // O histórico vai por cascata (historico.cliente_id references
    // clientes(id) on delete cascade).
    await admin.from("clientes").delete().in("id", clienteIds)
  }
  const idsFixture = [v1?.id, v2?.id, v3?.id, v4?.id, v5?.id, v6?.id, v7?.id].filter(
    (id): id is string => Boolean(id)
  )
  if (idsFixture.length > 0) {
    await admin.from("acessos_diarios").delete().in("usuario_id", idsFixture)
  }
  await Promise.all(
    [v1, v2, v3, v4, v5, v6, v7, supervisor]
      .filter((membro): membro is TestMember => Boolean(membro?.id))
      .map((membro) => deleteTestMember(membro.id))
  )
}, 60000)

describe("Bloco A — cálculo antes de semear a borda da janela (ADER-01..03)", () => {
  it("colunas-contrato: as chaves da linha de V1, ordenadas, são exatamente as 5 colunas do contrato", async () => {
    const linha = await linhaDe(v1.id)
    expect(linha).toBeDefined()
    expect(Object.keys(linha as AderenciaRow).sort()).toEqual(
      ["aderencia_pct", "coletando_desde", "dias_usados", "dias_uteis", "responsavel"].sort()
    )
  })

  it("janela-cheia-20-dias-uteis: V1, V2 e V7, admitidos há 60 dias, têm o denominador cheio de 20 dias úteis", async () => {
    for (const id of [v1.id, v2.id, v7.id]) {
      const linha = await linhaDe(id)
      expect(linha).toBeDefined()
      expect(Number(linha!.dias_uteis)).toBe(20)
    }
  })

  it("acessos-contam: V1 tem 3 dias usados (os 3 acessos em dia útil) e 15% de aderência", async () => {
    const linha = await linhaDe(v1.id)
    expect(linha).toBeDefined()
    expect(Number(linha!.dias_usados)).toBe(3)
    expect(Number(linha!.aderencia_pct)).toBe(15)
  })

  it("fim-de-semana-nao-conta: os acessos de sábado e domingo de V1 não mudam dias_usados e o percentual nunca passa de 100%", async () => {
    const linha = await linhaDe(v1.id)
    expect(linha).toBeDefined()
    expect(Number(linha!.dias_usados)).toBe(3)
    expect(Number(linha!.aderencia_pct)).toBeLessThanOrEqual(100)
  })

  it("historico-conta: V2 tem 3 dias usados a partir só do histórico com autor e do acesso combinados", async () => {
    const linha = await linhaDe(v2.id)
    expect(linha).toBeDefined()
    expect(Number(linha!.dias_usados)).toBe(3)
  })

  it("uniao-sem-duplicar: V2 continua com 3 dias usados mesmo com dois eventos no mesmo dia e evento+acesso no mesmo dia", async () => {
    const linha = await linhaDe(v2.id)
    expect(linha).toBeDefined()
    expect(Number(linha!.dias_usados)).toBe(3)
  })

  it("autor-nulo-e-fora-da-janela-ignorados: o evento sem autor e o evento de hoje-30 de V2 não mudam dias_usados", async () => {
    const linha = await linhaDe(v2.id)
    expect(linha).toBeDefined()
    expect(Number(linha!.dias_usados)).toBe(3)
  })

  it("fuso-sao-paulo: o evento de sexta às 23:30 em São Paulo conta como sexta para V7, nunca como sábado", async () => {
    const linha = await linhaDe(v7.id)
    expect(linha).toBeDefined()
    expect(Number(linha!.dias_usados)).toBe(1)
  })

  it("admissao-no-meio: V3, admitido há 6 dias, tem denominador 5, 2 dias usados e 40% — o acesso sintético anterior à admissão é ignorado", async () => {
    const linha = await linhaDe(v3.id)
    expect(linha).toBeDefined()
    expect(Number(linha!.dias_uteis)).toBe(5)
    expect(Number(linha!.dias_usados)).toBe(2)
    expect(Number(linha!.aderencia_pct)).toBe(40)
  })

  it("lacuna-de-desativacao: V4 exclui do numerador e do denominador a lacuna entre a desativação e a reativação (10 dias úteis, 1 usado, 10%)", async () => {
    const linha = await linhaDe(v4.id)
    expect(linha).toBeDefined()
    expect(Number(linha!.dias_uteis)).toBe(10)
    expect(Number(linha!.dias_usados)).toBe(1)
    expect(Number(linha!.aderencia_pct)).toBe(10)
  })

  it("reativado-sem-carimbo-de-desativacao: V6, só com reativado_em, conta apenas os dias a partir da reativação (5 dias úteis, 0 usados, 0%)", async () => {
    const linha = await linhaDe(v6.id)
    expect(linha).toBeDefined()
    expect(Number(linha!.dias_uteis)).toBe(5)
    expect(Number(linha!.dias_usados)).toBe(0)
    expect(Number(linha!.aderencia_pct)).toBe(0)
  })

  it("denominador-zero: V5, admitido no futuro, tem denominador zero, percentual nulo e o aviso de coleta preenchido", async () => {
    const linha = await linhaDe(v5.id)
    expect(linha).toBeDefined()
    expect(Number(linha!.dias_uteis)).toBe(0)
    expect(Number(linha!.dias_usados)).toBe(0)
    expect(linha!.aderencia_pct).toBeNull()
    expect(linha!.coletando_desde).not.toBeNull()
  })

  it("coletando-desde-coerente: o aviso de coleta é o mesmo dia (o menor já gravado) para toda fixture quando a medição é recente, e some para quem tem 28 dias completos quando não é", async () => {
    const m = await menorDiaGlobal()
    const idsComJanelaCompleta = [v1.id, v2.id, v3.id, v4.id, v6.id, v7.id]
    if (m !== null && m > diaMenos(27)) {
      for (const id of [...idsComJanelaCompleta, v5.id]) {
        const linha = await linhaDe(id)
        expect(linha).toBeDefined()
        expect(linha!.coletando_desde).toBe(m)
      }
    } else {
      for (const id of idsComJanelaCompleta) {
        const linha = await linhaDe(id)
        expect(linha).toBeDefined()
        expect(linha!.coletando_desde).toBeNull()
      }
      const linhaV5 = await linhaDe(v5.id)
      expect(linhaV5).toBeDefined()
      expect(linhaV5!.coletando_desde).toBe(diaMais(3))
    }
  })

  it("rls-vendedor-zero-linhas: a sessão de V1 chama a RPC e recebe zero linhas, sem erro (D-08)", async () => {
    const { data, error } = await clientV1.rpc("dashboard_aderencia_uso")
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it("anonimo-zero-linhas: o cliente anônimo recebe zero linhas ou erro, nunca dados (D-08)", async () => {
    const { data, error } = await anonClient().rpc("dashboard_aderencia_uso")
    if (error) {
      expect(data).toBeFalsy()
    } else {
      expect(data ?? []).toHaveLength(0)
    }
  })

  it("mesmo-conjunto-do-comparativo: para o Supervisor, os conjuntos de responsavel de dashboard_aderencia_uso e dashboard_comparativo_vendedor são idênticos", async () => {
    const [aderencia, comparativo] = await Promise.all([
      supervisorClient.rpc("dashboard_aderencia_uso"),
      supervisorClient.rpc("dashboard_comparativo_vendedor"),
    ])
    expect(aderencia.error).toBeNull()
    expect(comparativo.error).toBeNull()

    const conjuntoAderencia = new Set(((aderencia.data ?? []) as AderenciaRow[]).map((r) => r.responsavel))
    const conjuntoComparativo = new Set(
      ((comparativo.data ?? []) as ComparativoRow[]).map((r) => r.responsavel)
    )
    const soEmAderencia = [...conjuntoAderencia].filter((id) => !conjuntoComparativo.has(id)).length
    const soEmComparativo = [...conjuntoComparativo].filter((id) => !conjuntoAderencia.has(id)).length
    expect(soEmAderencia + soEmComparativo).toBe(0)
  })
})

describe("Bloco B — depois de semear um acesso de V1 fora da janela (hoje-28)", () => {
  beforeAll(async () => {
    await seedAcesso(v1.id, diaMenos(28))
  })

  it("janela-completa-some-o-aviso: com um dia gravado fora da janela, V1/V2/V7 perdem o aviso de coleta e V5 mantém o próprio (admissão futura)", async () => {
    for (const id of [v1.id, v2.id, v7.id]) {
      const linha = await linhaDe(id)
      expect(linha).toBeDefined()
      expect(linha!.coletando_desde).toBeNull()
    }
    const linhaV5 = await linhaDe(v5.id)
    expect(linhaV5).toBeDefined()
    expect(linhaV5!.coletando_desde).toBe(diaMais(3))
  })

  it("fora-da-janela-nao-conta: o acesso de hoje-28 de V1 continua fora da janela de 28 dias e não muda dias_usados", async () => {
    const linha = await linhaDe(v1.id)
    expect(linha).toBeDefined()
    expect(Number(linha!.dias_usados)).toBe(3)
  })
})
