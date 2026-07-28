import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * RLS negative-case tests for every dashboard aggregate function (DSH-06 /
 * DSH-07 / D-07 / FNL-03) — the behavioral gate that fails loudly if any
 * function ever accidentally gains a `security definer` clause
 * (04-RESEARCH.md Pitfall 4 / 11-RESEARCH.md Anti-Patterns). Mirrors
 * tests/clientes/rls-clientes.test.ts's cross-vendedor pattern: seed via
 * service role / a signed-in Vendedor A client, assert as a DIFFERENT
 * signed-in role, never as service-role (that would bypass RLS entirely
 * and give a false pass).
 *
 * Extended in Phase 11 to also cover `dashboard_funil_detalhado()` and
 * `dashboard_tempo_ate_fechamento()` (FNL-03) — both take zero arguments,
 * unlike the period-filtered RPCs above them in the same assertion arrays.
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

async function getActiveProduto(): Promise<{ id: string }> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from("produtos_consumidos")
    .select("id")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error("Nenhum produto consumido ativo encontrado para o teste")
  }
  return data as { id: string }
}

async function getActiveCategoria(): Promise<{ id: string }> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from("categorias")
    .select("id")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error("Nenhuma categoria ativa encontrada para o teste")
  }
  return data as { id: string }
}

function testWindow() {
  const now = Date.now()
  return {
    inicio: new Date(now - 1000).toISOString(),
    fim: new Date(now + 30_000).toISOString(),
  }
}

type EtapaTotalRow = { etapa: string; total: number | string }
type StatusTotalRow = { status: string; total: number | string }
type DesempenhoRow = {
  responsavel: string
  ganho: number | string
  perdido: number | string
}
type IdTotalRow = { total: number | string; [key: string]: unknown }
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
type TempoAteFechamentoRow = { status: string; media_dias: number | string }

function toMap<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T
): Record<string, number> {
  return Object.fromEntries(
    rows.map((row) => [String(row[key]), Number(row.total)])
  )
}

function toResponsavelMap(
  rows: DesempenhoRow[]
): Record<string, { ganho: number; perdido: number }> {
  return Object.fromEntries(
    rows.map((row) => [
      row.responsavel,
      { ganho: Number(row.ganho), perdido: Number(row.perdido) },
    ])
  )
}

/**
 * Normalizes dashboard_funil_detalhado() rows for deep-equality comparison
 * (FNL-03) — same "before/after must be identical" spirit as toMap above,
 * but this RPC's rows have multiple numeric/nullable columns instead of a
 * single `total`, so each row is normalized in full rather than reduced to
 * one number.
 */
function toFunilDetalhadoMap(rows: FunilDetalhadoRow[]) {
  return Object.fromEntries(
    rows.map((row) => [
      row.etapa,
      {
        quantidade: Number(row.quantidade),
        avancouCount: Number(row.avancou_count),
        avancouPct: row.avancou_pct === null ? null : Number(row.avancou_pct),
        perdidosCount: Number(row.perdidos_count),
        perdidosPct:
          row.perdidos_pct === null ? null : Number(row.perdidos_pct),
        tempoMedioDias:
          row.tempo_medio_dias === null ? null : Number(row.tempo_medio_dias),
        gargalo: row.gargalo,
      },
    ])
  )
}

function toTempoFechamentoMap(
  rows: TempoAteFechamentoRow[]
): Record<string, number> {
  return Object.fromEntries(
    rows.map((row) => [row.status, Number(row.media_dias)])
  )
}

describe("RLS: dashboard aggregates never leak across vendedores (DSH-06)", () => {
  it("Vendedor B sees zero contribution from Vendedor A's clientes across every dashboard RPC", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const admin = serviceClient()
    const produto = await getActiveProduto()
    const categoria = await getActiveCategoria()
    const window = testWindow()

    const [
      beforeEtapa,
      beforeGanhosPerdidos,
      beforeDesempenho,
      beforeProduto,
      beforeCategoria,
      beforeFunilDetalhado,
      beforeTempoFechamento,
    ] = await Promise.all([
      vendedorB.rpc("dashboard_clientes_por_etapa"),
      vendedorB.rpc("dashboard_ganhos_perdidos", {
        p_inicio: window.inicio,
        p_fim: window.fim,
      }),
      vendedorB.rpc("dashboard_desempenho_vendedor", {
        p_inicio: window.inicio,
        p_fim: window.fim,
      }),
      vendedorB.rpc("dashboard_prospeccao_por_produto", {
        p_inicio: window.inicio,
        p_fim: window.fim,
      }),
      vendedorB.rpc("dashboard_prospeccao_por_categoria", {
        p_inicio: window.inicio,
        p_fim: window.fim,
      }),
      // FNL-03: both new RPCs take zero arguments, unlike the
      // period-filtered calls above.
      vendedorB.rpc("dashboard_funil_detalhado"),
      vendedorB.rpc("dashboard_tempo_ate_fechamento"),
    ])
    for (const result of [
      beforeEtapa,
      beforeGanhosPerdidos,
      beforeDesempenho,
      beforeProduto,
      beforeCategoria,
      beforeFunilDetalhado,
      beforeTempoFechamento,
    ]) {
      expect(result.error).toBeNull()
    }

    // Vendedor A creates + advances a cliente through every metric surface.
    const razaoSocial = uniqueRazaoSocial("rls-cross-vendedor")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert({
        ...baseClienteFields(razaoSocial, vendedorAId, "aguardando_feedback"),
        categoria_id: categoria.id,
      })
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { error: produtoLinkError } = await vendedorA
      .from("cliente_produtos")
      .insert({ cliente_id: inserted!.id, produto_id: produto.id })
    expect(produtoLinkError).toBeNull()

    const { error: moveError } = await admin
      .from("clientes")
      .update({ etapa: "primeira_venda", status_acompanhamento: "ganho" })
      .eq("id", inserted!.id)
    expect(moveError).toBeNull()

    const [
      afterEtapa,
      afterGanhosPerdidos,
      afterDesempenho,
      afterProduto,
      afterCategoria,
      afterFunilDetalhado,
      afterTempoFechamento,
    ] = await Promise.all([
      vendedorB.rpc("dashboard_clientes_por_etapa"),
      vendedorB.rpc("dashboard_ganhos_perdidos", {
        p_inicio: window.inicio,
        p_fim: window.fim,
      }),
      vendedorB.rpc("dashboard_desempenho_vendedor", {
        p_inicio: window.inicio,
        p_fim: window.fim,
      }),
      vendedorB.rpc("dashboard_prospeccao_por_produto", {
        p_inicio: window.inicio,
        p_fim: window.fim,
      }),
      vendedorB.rpc("dashboard_prospeccao_por_categoria", {
        p_inicio: window.inicio,
        p_fim: window.fim,
      }),
      vendedorB.rpc("dashboard_funil_detalhado"),
      vendedorB.rpc("dashboard_tempo_ate_fechamento"),
    ])
    for (const result of [
      afterEtapa,
      afterGanhosPerdidos,
      afterDesempenho,
      afterProduto,
      afterCategoria,
      afterFunilDetalhado,
      afterTempoFechamento,
    ]) {
      expect(result.error).toBeNull()
    }

    expect(
      toMap((afterEtapa.data ?? []) as EtapaTotalRow[], "etapa")
    ).toEqual(toMap((beforeEtapa.data ?? []) as EtapaTotalRow[], "etapa"))
    expect(
      toMap((afterGanhosPerdidos.data ?? []) as StatusTotalRow[], "status")
    ).toEqual(
      toMap((beforeGanhosPerdidos.data ?? []) as StatusTotalRow[], "status")
    )
    expect(
      toResponsavelMap((afterDesempenho.data ?? []) as DesempenhoRow[])[
        vendedorAId
      ]
    ).toBeUndefined()
    expect(
      toMap((afterProduto.data ?? []) as IdTotalRow[], "produto_id")
    ).toEqual(toMap((beforeProduto.data ?? []) as IdTotalRow[], "produto_id"))
    expect(
      toMap((afterCategoria.data ?? []) as IdTotalRow[], "categoria_id")
    ).toEqual(
      toMap((beforeCategoria.data ?? []) as IdTotalRow[], "categoria_id")
    )
    // FNL-03: the cliente Vendedor A just created/advanced/closed as
    // "ganho" cannot move a single number Vendedor B sees on either new RPC.
    expect(
      toFunilDetalhadoMap((afterFunilDetalhado.data ?? []) as FunilDetalhadoRow[])
    ).toEqual(
      toFunilDetalhadoMap(
        (beforeFunilDetalhado.data ?? []) as FunilDetalhadoRow[]
      )
    )
    expect(
      toTempoFechamentoMap(
        (afterTempoFechamento.data ?? []) as TempoAteFechamentoRow[]
      )
    ).toEqual(
      toTempoFechamentoMap(
        (beforeTempoFechamento.data ?? []) as TempoAteFechamentoRow[]
      )
    )
  })
})

describe("RLS: Supervisor sees every vendedor's desempenho (DSH-07)", () => {
  it("dashboard_desempenho_vendedor includes Vendedor A's row when called by Supervisor, but Vendedor A only sees their own row", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const admin = serviceClient()
    const window = testWindow()

    const razaoSocial = uniqueRazaoSocial("supervisor-visibilidade")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId, "primeira_venda"))
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { error: updateError } = await admin
      .from("clientes")
      .update({ status_acompanhamento: "ganho" })
      .eq("id", inserted!.id)
    expect(updateError).toBeNull()

    const { data: supervisorData, error: supervisorError } =
      await supervisor.rpc("dashboard_desempenho_vendedor", {
        p_inicio: window.inicio,
        p_fim: window.fim,
      })
    expect(supervisorError).toBeNull()
    const supervisorMap = toResponsavelMap(
      (supervisorData ?? []) as DesempenhoRow[]
    )
    expect(supervisorMap[vendedorAId]).toBeDefined()
    expect(supervisorMap[vendedorAId].ganho).toBeGreaterThanOrEqual(1)

    const { data: vendedorAData, error: vendedorAError } =
      await vendedorA.rpc("dashboard_desempenho_vendedor", {
        p_inicio: window.inicio,
        p_fim: window.fim,
      })
    expect(vendedorAError).toBeNull()
    const rows = (vendedorAData ?? []) as DesempenhoRow[]
    expect(rows).toHaveLength(1)
    expect(rows[0].responsavel).toBe(vendedorAId)
  })

  it("dashboard_funil_detalhado grows for the Supervisor when Vendedor A creates a cliente, but Vendedor B never sees it (FNL-03)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )

    const [beforeSupervisor, beforeVendedorB] = await Promise.all([
      supervisor.rpc("dashboard_funil_detalhado"),
      vendedorB.rpc("dashboard_funil_detalhado"),
    ])
    expect(beforeSupervisor.error).toBeNull()
    expect(beforeVendedorB.error).toBeNull()
    const beforeSupervisorMap = toFunilDetalhadoMap(
      (beforeSupervisor.data ?? []) as FunilDetalhadoRow[]
    )
    const beforeVendedorBMap = toFunilDetalhadoMap(
      (beforeVendedorB.data ?? []) as FunilDetalhadoRow[]
    )

    const razaoSocial = uniqueRazaoSocial("supervisor-funil-detalhado")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(
        baseClienteFields(razaoSocial, vendedorAId, "aguardando_contato")
      )
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const [afterSupervisor, afterVendedorB] = await Promise.all([
      supervisor.rpc("dashboard_funil_detalhado"),
      vendedorB.rpc("dashboard_funil_detalhado"),
    ])
    expect(afterSupervisor.error).toBeNull()
    expect(afterVendedorB.error).toBeNull()
    const afterSupervisorMap = toFunilDetalhadoMap(
      (afterSupervisor.data ?? []) as FunilDetalhadoRow[]
    )
    const afterVendedorBMap = toFunilDetalhadoMap(
      (afterVendedorB.data ?? []) as FunilDetalhadoRow[]
    )

    // Supervisor sees every vendedor's clientes — the new cliente's stage
    // grows the "quantidade" count relative to the reading taken before.
    expect(afterSupervisorMap.aguardando_contato.quantidade).toBe(
      beforeSupervisorMap.aguardando_contato.quantidade + 1
    )
    // Vendedor B keeps seeing exactly the same numbers — Vendedor A's new
    // cliente never contributes to Vendedor B's view of any RPC.
    expect(afterVendedorBMap).toEqual(beforeVendedorBMap)
  })
})
