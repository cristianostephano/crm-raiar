import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Behavior tests for `dashboard_funil_detalhado()` (FNL-01, D-02, D-03) and
 * `dashboard_tempo_ate_fechamento()` (FNL-02).
 *
 * ISOLATION NOTE (differs from this folder's other test files): neither RPC
 * takes a period parameter (11-RESEARCH.md's explicit anti-pattern — a
 * period filter is out of scope for this milestone), so the before/after
 * delta comparison used by tests/dashboard/ganhos-perdidos.test.ts and
 * rls-dashboard.test.ts doesn't work here for averages (there is no window
 * to scope a mutation into). Instead, every test in this file runs against
 * a base that is wiped clean before each `it()`: a `beforeEach` deletes
 * every `clientes` row whose `responsavel` is the dedicated seed account
 * `vendedorB` (`historico` cascades via `on delete cascade`), and every
 * assertion reads the RPCs as `vendedorB`. This makes each test's numbers
 * fully deterministic instead of a before/after delta.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Dashboard ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function baseClienteFields(
  razaoSocial: string,
  responsavelId: string,
  etapa: string
) {
  return {
    razao_social: razaoSocial,
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: responsavelId,
    etapa,
  }
}

const createdClienteIds: string[] = []

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  const admin = serviceClient()
  await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
})

async function getUserId(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
}

async function getMotivoPerdaId(): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin
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
 * Backdates the most recently written `historico` row of the given `tipo`
 * for a cliente. Used to control exact stage-entry / closing-event
 * timestamps so this file's duration assertions are deterministic instead
 * of depending on real wall-clock test execution time.
 */
async function backdateLatestHistorico(
  admin: SupabaseClient,
  clienteId: string,
  tipo: string,
  criadoEm: string
): Promise<void> {
  const { data, error } = await admin
    .from("historico")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("tipo", tipo)
    .order("criado_em", { ascending: false })
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error(
      `Não foi possível localizar o historico mais recente (tipo=${tipo}) para o cliente ${clienteId}`
    )
  }
  const { error: updateError } = await admin
    .from("historico")
    .update({ criado_em: criadoEm })
    .eq("id", data.id as string)
  if (updateError) {
    throw new Error(`Falha ao backdatar historico: ${updateError.message}`)
  }
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

function toEtapaMap(
  rows: FunilDetalhadoRow[]
): Record<string, FunilDetalhadoRow> {
  return Object.fromEntries(rows.map((row) => [row.etapa, row]))
}

let vendedorB: SupabaseClient
let vendedorBId: string
let admin: SupabaseClient

beforeAll(async () => {
  vendedorB = await signInAs(
    SEED_ACCOUNTS.vendedorB.email,
    SEED_ACCOUNTS.vendedorB.password
  )
  vendedorBId = await getUserId(vendedorB)
  admin = serviceClient()
})

beforeEach(async () => {
  // See ISOLATION NOTE above — every test starts from zero vendedorB
  // clientes, since these two RPCs have no period parameter to scope a
  // before/after delta into.
  await admin.from("clientes").delete().eq("responsavel", vendedorBId)
})

describe("dashboard_funil_detalhado", () => {
  it("returns 7 rows; quantidade is the historic 'ever entered' count, avancou_pct uses the D-02 denominator, zero-count stages are null", async () => {
    const { data: inserted, error: insertError } = await vendedorB
      .from("clientes")
      .insert(
        baseClienteFields(
          uniqueRazaoSocial("quantidade"),
          vendedorBId,
          "aguardando_contato"
        )
      )
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { error: move1Error } = await admin
      .from("clientes")
      .update({ etapa: "conversa_comprador" })
      .eq("id", inserted!.id)
    expect(move1Error).toBeNull()

    const { error: move2Error } = await admin
      .from("clientes")
      .update({ etapa: "aguardando_data_reuniao" })
      .eq("id", inserted!.id)
    expect(move2Error).toBeNull()

    const { data, error } = await vendedorB.rpc("dashboard_funil_detalhado")
    expect(error).toBeNull()
    const rows = (data ?? []) as FunilDetalhadoRow[]
    expect(rows).toHaveLength(7)

    const byEtapa = toEtapaMap(rows)

    // Etapas 1-3: já passou por elas (quantidade histórica), 1 e 2 avançaram.
    expect(Number(byEtapa.aguardando_contato.quantidade)).toBe(1)
    expect(Number(byEtapa.aguardando_contato.avancou_pct)).toBe(100)
    expect(Number(byEtapa.conversa_comprador.quantidade)).toBe(1)
    expect(Number(byEtapa.conversa_comprador.avancou_pct)).toBe(100)
    // Etapa 3: está parado nela agora -> conta no denominador, não avançou.
    expect(Number(byEtapa.aguardando_data_reuniao.quantidade)).toBe(1)
    expect(Number(byEtapa.aguardando_data_reuniao.avancou_pct)).toBe(0)

    // Etapas 4-7: base vazia -> quantidade 0, percentuais/tempo nulos.
    for (const etapa of [
      "aguardando_feedback",
      "aguardando_aprovacao",
      "em_cadastro_produto",
      "primeira_venda",
    ]) {
      expect(Number(byEtapa[etapa].quantidade)).toBe(0)
      expect(byEtapa[etapa].avancou_pct).toBeNull()
      expect(byEtapa[etapa].perdidos_pct).toBeNull()
      expect(byEtapa[etapa].tempo_medio_dias).toBeNull()
    }
  })

  it("a client that is ainda parado (em_andamento, never advanced) counts as not-advanced and uses now() as the provisional exit for tempo_medio_dias", async () => {
    const diasAtras = 5
    const criadoEm = new Date(
      Date.now() - diasAtras * 86400 * 1000
    ).toISOString()

    const { data: inserted, error: insertError } = await vendedorB
      .from("clientes")
      .insert(
        baseClienteFields(
          uniqueRazaoSocial("ainda-parado"),
          vendedorBId,
          "aguardando_contato"
        )
      )
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { error: backdateError } = await admin
      .from("clientes")
      .update({ criado_em: criadoEm })
      .eq("id", inserted!.id)
    expect(backdateError).toBeNull()

    const { data, error } = await vendedorB.rpc("dashboard_funil_detalhado")
    expect(error).toBeNull()
    const byEtapa = toEtapaMap((data ?? []) as FunilDetalhadoRow[])

    expect(Number(byEtapa.aguardando_contato.quantidade)).toBe(1)
    expect(Number(byEtapa.aguardando_contato.avancou_count)).toBe(0)
    expect(Number(byEtapa.aguardando_contato.avancou_pct)).toBe(0)
    expect(byEtapa.aguardando_contato.tempo_medio_dias).not.toBeNull()
    const tempoMedio = Number(byEtapa.aguardando_contato.tempo_medio_dias)
    expect(tempoMedio).toBeGreaterThan(diasAtras - 0.2)
    expect(tempoMedio).toBeLessThan(diasAtras + 0.2)
  })

  it("a client marked perdido stops accruing tempo_medio_dias at the loss event, not at now()", async () => {
    const motivoPerdaId = await getMotivoPerdaId()
    const diasAteFechar = 3
    const diasTotalNoPassado = 10

    const criadoEm = new Date(Date.now() - diasTotalNoPassado * 86400 * 1000)
    const fechamentoEm = new Date(
      criadoEm.getTime() + diasAteFechar * 86400 * 1000
    )

    const { data: inserted, error: insertError } = await vendedorB
      .from("clientes")
      .insert(
        baseClienteFields(
          uniqueRazaoSocial("perdido"),
          vendedorBId,
          "aguardando_contato"
        )
      )
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { error: backdateCriadoError } = await admin
      .from("clientes")
      .update({ criado_em: criadoEm.toISOString() })
      .eq("id", inserted!.id)
    expect(backdateCriadoError).toBeNull()

    const { error: perdaError } = await admin
      .from("clientes")
      .update({ status_acompanhamento: "perdido", motivo_perda_id: motivoPerdaId })
      .eq("id", inserted!.id)
    expect(perdaError).toBeNull()

    await backdateLatestHistorico(
      admin,
      inserted!.id,
      "status_acompanhamento",
      fechamentoEm.toISOString()
    )

    const { data, error } = await vendedorB.rpc("dashboard_funil_detalhado")
    expect(error).toBeNull()
    const byEtapa = toEtapaMap((data ?? []) as FunilDetalhadoRow[])

    expect(Number(byEtapa.aguardando_contato.perdidos_count)).toBe(1)
    expect(Number(byEtapa.aguardando_contato.perdidos_pct)).toBe(100)

    // Bate com (evento de perda - entrada), NÃO com (agora - entrada), que
    // seria ~10 dias em vez de ~3.
    const tempoMedio = Number(byEtapa.aguardando_contato.tempo_medio_dias)
    expect(tempoMedio).toBeGreaterThan(diasAteFechar - 0.2)
    expect(tempoMedio).toBeLessThan(diasAteFechar + 0.2)

    for (const etapa of [
      "conversa_comprador",
      "aguardando_data_reuniao",
      "aguardando_feedback",
      "aguardando_aprovacao",
      "em_cadastro_produto",
      "primeira_venda",
    ]) {
      expect(Number(byEtapa[etapa].perdidos_count)).toBe(0)
    }
  })

  it("flags a stage with a much longer average dwell time as gargalo — relative comparison, never a fixed day threshold", async () => {
    const fastHoras = 4
    const lentoDias = 25
    const fechamentoHoras = 4
    const motivoPerdaId = await getMotivoPerdaId()

    const t0 = new Date(
      Date.now() -
        (lentoDias * 86400 * 1000 +
          fastHoras * 3600 * 1000 +
          fechamentoHoras * 3600 * 1000)
    )
    const t1 = new Date(t0.getTime() + fastHoras * 3600 * 1000)
    const t2 = new Date(t1.getTime() + lentoDias * 86400 * 1000)
    const t3 = new Date(t2.getTime() + fechamentoHoras * 3600 * 1000)

    const { data: inserted, error: insertError } = await vendedorB
      .from("clientes")
      .insert(
        baseClienteFields(
          uniqueRazaoSocial("gargalo"),
          vendedorBId,
          "aguardando_contato"
        )
      )
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { error: backdateCriadoError } = await admin
      .from("clientes")
      .update({ criado_em: t0.toISOString() })
      .eq("id", inserted!.id)
    expect(backdateCriadoError).toBeNull()

    // Etapa rápida: aguardando_contato -> conversa_comprador em ~4 horas.
    const { error: move1Error } = await admin
      .from("clientes")
      .update({ etapa: "conversa_comprador" })
      .eq("id", inserted!.id)
    expect(move1Error).toBeNull()
    await backdateLatestHistorico(admin, inserted!.id, "etapa", t1.toISOString())

    // Etapa lenta: conversa_comprador -> aguardando_data_reuniao em ~25 dias.
    const { error: move2Error } = await admin
      .from("clientes")
      .update({ etapa: "aguardando_data_reuniao" })
      .eq("id", inserted!.id)
    expect(move2Error).toBeNull()
    await backdateLatestHistorico(admin, inserted!.id, "etapa", t2.toISOString())

    // Fecha (perdido) ~4 horas depois, pra aguardando_data_reuniao também
    // sair rápido e não inflar a média das "outras etapas".
    const { error: perdaError } = await admin
      .from("clientes")
      .update({ status_acompanhamento: "perdido", motivo_perda_id: motivoPerdaId })
      .eq("id", inserted!.id)
    expect(perdaError).toBeNull()
    await backdateLatestHistorico(
      admin,
      inserted!.id,
      "status_acompanhamento",
      t3.toISOString()
    )

    const { data, error } = await vendedorB.rpc("dashboard_funil_detalhado")
    expect(error).toBeNull()
    const byEtapa = toEtapaMap((data ?? []) as FunilDetalhadoRow[])

    expect(byEtapa.conversa_comprador.gargalo).toBe(true)
    expect(byEtapa.aguardando_contato.gargalo).toBe(false)
    expect(byEtapa.aguardando_data_reuniao.gargalo).toBe(false)
  })
})

describe("dashboard_tempo_ate_fechamento", () => {
  it("returns separate ganho/perdido averages, each computed from clientes.criado_em to the respective closing event", async () => {
    const diasAteGanho = 7
    const diasAtePerdido = 3
    const motivoPerdaId = await getMotivoPerdaId()

    const criadoEmGanho = new Date(
      Date.now() - (diasAteGanho + 1) * 86400 * 1000
    )
    const fechamentoGanho = new Date(
      criadoEmGanho.getTime() + diasAteGanho * 86400 * 1000
    )

    // ganho só é permitido na etapa final (chk_ganho_somente_etapa_final).
    const { data: ganhoInserted, error: ganhoInsertError } = await vendedorB
      .from("clientes")
      .insert(
        baseClienteFields(
          uniqueRazaoSocial("fechamento-ganho"),
          vendedorBId,
          "primeira_venda"
        )
      )
      .select("id")
      .single()
    expect(ganhoInsertError).toBeNull()
    createdClienteIds.push(ganhoInserted!.id)

    const { error: backdateGanhoCriadoError } = await admin
      .from("clientes")
      .update({ criado_em: criadoEmGanho.toISOString() })
      .eq("id", ganhoInserted!.id)
    expect(backdateGanhoCriadoError).toBeNull()

    const { error: marcarGanhoError } = await admin
      .from("clientes")
      .update({ status_acompanhamento: "ganho" })
      .eq("id", ganhoInserted!.id)
    expect(marcarGanhoError).toBeNull()
    await backdateLatestHistorico(
      admin,
      ganhoInserted!.id,
      "status_acompanhamento",
      fechamentoGanho.toISOString()
    )

    const criadoEmPerdido = new Date(
      Date.now() - (diasAtePerdido + 1) * 86400 * 1000
    )
    const fechamentoPerdido = new Date(
      criadoEmPerdido.getTime() + diasAtePerdido * 86400 * 1000
    )

    const { data: perdidoInserted, error: perdidoInsertError } =
      await vendedorB
        .from("clientes")
        .insert(
          baseClienteFields(
            uniqueRazaoSocial("fechamento-perdido"),
            vendedorBId,
            "aguardando_contato"
          )
        )
        .select("id")
        .single()
    expect(perdidoInsertError).toBeNull()
    createdClienteIds.push(perdidoInserted!.id)

    const { error: backdatePerdidoCriadoError } = await admin
      .from("clientes")
      .update({ criado_em: criadoEmPerdido.toISOString() })
      .eq("id", perdidoInserted!.id)
    expect(backdatePerdidoCriadoError).toBeNull()

    const { error: marcarPerdidoError } = await admin
      .from("clientes")
      .update({
        status_acompanhamento: "perdido",
        motivo_perda_id: motivoPerdaId,
      })
      .eq("id", perdidoInserted!.id)
    expect(marcarPerdidoError).toBeNull()
    await backdateLatestHistorico(
      admin,
      perdidoInserted!.id,
      "status_acompanhamento",
      fechamentoPerdido.toISOString()
    )

    const { data, error } = await vendedorB.rpc(
      "dashboard_tempo_ate_fechamento"
    )
    expect(error).toBeNull()
    const rows = (data ?? []) as { status: string; media_dias: number | string }[]
    const byStatus = Object.fromEntries(
      rows.map((row) => [row.status, Number(row.media_dias)])
    )

    expect(byStatus.ganho).toBeGreaterThan(diasAteGanho - 0.2)
    expect(byStatus.ganho).toBeLessThan(diasAteGanho + 0.2)
    expect(byStatus.perdido).toBeGreaterThan(diasAtePerdido - 0.2)
    expect(byStatus.perdido).toBeLessThan(diasAtePerdido + 0.2)
  })
})
