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
 *
 * Extended in Phase 12 to also cover `dashboard_comparativo_vendedor()`
 * (VEND-01) — another zero-argument RPC, added to the same before/after
 * arrays plus a dedicated cross-vendedor `it()` block below.
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
type ComparativoVendedorRow = {
  responsavel: string
  responsavel_nome: string | null
  negocios_iniciados: number | string
  ganho: number | string
  perdido: number | string
  ciclo_medio_dias: number | string | null
}

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

/**
 * Normalizes dashboard_comparativo_vendedor() rows for deep-equality
 * comparison (VEND-01) — same "before/after must be identical" spirit as
 * toFunilDetalhadoMap above, keyed by responsavel (id) since row order is
 * alphabetical by name, not stable enough to compare by position.
 */
function toComparativoVendedorMap(rows: ComparativoVendedorRow[]) {
  return Object.fromEntries(
    rows.map((row) => [
      row.responsavel,
      {
        negociosIniciados: Number(row.negocios_iniciados),
        ganho: Number(row.ganho),
        perdido: Number(row.perdido),
        cicloMedioDias:
          row.ciclo_medio_dias === null ? null : Number(row.ciclo_medio_dias),
      },
    ])
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
      beforeComparativoVendedor,
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
      // FNL-03/VEND-01: all three RPCs below take zero arguments, unlike
      // the period-filtered calls above.
      vendedorB.rpc("dashboard_funil_detalhado"),
      vendedorB.rpc("dashboard_tempo_ate_fechamento"),
      vendedorB.rpc("dashboard_comparativo_vendedor"),
    ])
    for (const result of [
      beforeEtapa,
      beforeGanhosPerdidos,
      beforeDesempenho,
      beforeProduto,
      beforeCategoria,
      beforeFunilDetalhado,
      beforeTempoFechamento,
      beforeComparativoVendedor,
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
      afterComparativoVendedor,
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
      vendedorB.rpc("dashboard_comparativo_vendedor"),
    ])
    for (const result of [
      afterEtapa,
      afterGanhosPerdidos,
      afterDesempenho,
      afterProduto,
      afterCategoria,
      afterFunilDetalhado,
      afterTempoFechamento,
      afterComparativoVendedor,
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
    // VEND-01: same "no single number Vendedor B sees can move" guarantee,
    // now for dashboard_comparativo_vendedor().
    expect(
      toComparativoVendedorMap(
        (afterComparativoVendedor.data ?? []) as ComparativoVendedorRow[]
      )
    ).toEqual(
      toComparativoVendedorMap(
        (beforeComparativoVendedor.data ?? []) as ComparativoVendedorRow[]
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
    // Uses >= (not exact +1) because dashboard_funil_detalhado() has no
    // period/responsavel filter — it's a whole-history snapshot across
    // every vendedor, so it can only ever grow or stay flat between two
    // reads, never move in the other direction from this test's own
    // insert; other suites running concurrently against the same live
    // project may also add clientes in this window, which is fine as long
    // as the number never fails to reflect our own contribution.
    expect(afterSupervisorMap.aguardando_contato.quantidade).toBeGreaterThanOrEqual(
      beforeSupervisorMap.aguardando_contato.quantidade + 1
    )
    // Vendedor B keeps seeing exactly the same numbers — Vendedor A's new
    // cliente never contributes to Vendedor B's view of any RPC.
    expect(afterVendedorBMap).toEqual(beforeVendedorBMap)
  })

  it("dashboard_comparativo_vendedor never leaks another vendedor's real numbers to Vendedor B (VEND-01)", async () => {
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
      supervisor.rpc("dashboard_comparativo_vendedor"),
      vendedorB.rpc("dashboard_comparativo_vendedor"),
    ])
    expect(beforeSupervisor.error).toBeNull()
    expect(beforeVendedorB.error).toBeNull()
    const beforeSupervisorMap = toComparativoVendedorMap(
      (beforeSupervisor.data ?? []) as ComparativoVendedorRow[]
    )
    const beforeVendedorBMap = toComparativoVendedorMap(
      (beforeVendedorB.data ?? []) as ComparativoVendedorRow[]
    )

    const razaoSocial = uniqueRazaoSocial("supervisor-comparativo-vendedor")
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
      supervisor.rpc("dashboard_comparativo_vendedor"),
      vendedorB.rpc("dashboard_comparativo_vendedor"),
    ])
    expect(afterSupervisor.error).toBeNull()
    expect(afterVendedorB.error).toBeNull()
    const afterSupervisorMap = toComparativoVendedorMap(
      (afterSupervisor.data ?? []) as ComparativoVendedorRow[]
    )
    const afterVendedorBMap = toComparativoVendedorMap(
      (afterVendedorB.data ?? []) as ComparativoVendedorRow[]
    )

    // A linha do Vendedor A vista pelo SUPERVISOR cresce em
    // negocios_iniciados — a RPC não tem filtro de período/responsável, é
    // um snapshot de histórico completo que só pode crescer ou ficar igual.
    expect(
      afterSupervisorMap[vendedorAId]?.negociosIniciados
    ).toBeGreaterThanOrEqual(
      (beforeSupervisorMap[vendedorAId]?.negociosIniciados ?? 0) + 1
    )
    // A linha do Vendedor A APARECE no resultado do Vendedor B (a lista de
    // nomes vem de `profiles`, que tem SELECT aberto para todo autenticado),
    // mas com contagens que não refletem o cliente que o Vendedor A acabou
    // de criar — clientes/historico seguem escopados por RLS mesmo que o
    // roster (profiles) em si seja visível a qualquer chamador. É
    // exatamente essa distinção que este teste trava.
    expect(afterVendedorBMap).toEqual(beforeVendedorBMap)
  })
})
