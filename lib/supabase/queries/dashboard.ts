import { taxaConversao } from "@/lib/dashboard/periodo"
import { ETAPA_KEYS, type EtapaKey } from "@/lib/funil/etapas"
import { createClient } from "@/lib/supabase/server"

/**
 * Typed .rpc() readers for the eight dashboard_* aggregate functions (the
 * five from the 0003 migration, dashboard_funil_detalhado/
 * dashboard_tempo_ate_fechamento from 0009 in Phase 11, and
 * dashboard_comparativo_vendedor from 0011 in this phase). Mirrors
 * lib/supabase/queries/clientes.ts's getClientesAgrupadosPorEtapa()
 * throw-on-error posture — a dashboard chart that silently renders empty on
 * a real fetch error is worse than an explicit failed-fetch state (UI-SPEC's
 * per-card error handling).
 *
 * NO manual responsavel/role filtering anywhere in this file — every
 * dashboard_* function is SECURITY INVOKER, so RLS on clientes/historico
 * already scopes every result to the caller automatically (D-07, same
 * principle as getClientesAgrupadosPorEtapa's own "no manual responsavel
 * filter" comment). The list of ATIVO vendedores is also decided only in
 * SQL: this file never filters by `ativo`.
 */

// Postgres `bigint` columns come back from PostgREST as strings (to avoid
// silent precision loss past 2^53) — every row mapper below normalizes with
// Number() so callers always get real numbers, never numeric strings.

export type ClientesPorEtapaRow = { etapa: EtapaKey; total: number }

/** DSH-01/DSH-08: live snapshot, no period parameters. */
export async function getClientesPorEtapa(): Promise<ClientesPorEtapaRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_clientes_por_etapa")

  if (error) {
    throw new Error(`Falha ao carregar clientes por etapa: ${error.message}`)
  }

  return (data ?? []).map((row: { etapa: EtapaKey; total: number | string }) => ({
    etapa: row.etapa,
    total: Number(row.total),
  }))
}

export type GanhosPerdidosRow = { status: "ganho" | "perdido"; total: number }

/** DSH-02/D-02: period filters by the date of the status-change historico row. */
export async function getGanhosPerdidos(
  inicio: Date,
  fim: Date
): Promise<GanhosPerdidosRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_ganhos_perdidos", {
    p_inicio: inicio.toISOString(),
    p_fim: fim.toISOString(),
  })

  if (error) {
    throw new Error(`Falha ao carregar ganhos/perdidos: ${error.message}`)
  }

  return (data ?? []).map(
    (row: { status: "ganho" | "perdido"; total: number | string }) => ({
      status: row.status,
      total: Number(row.total),
    })
  )
}

export type DesempenhoVendedorRow = {
  responsavel: string
  responsavelNome: string | null
  ganho: number
  perdido: number
}

/** DSH-03/D-10: same ganho/perdido basis as getGanhosPerdidos, grouped by vendedor. */
export async function getDesempenhoVendedor(
  inicio: Date,
  fim: Date
): Promise<DesempenhoVendedorRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_desempenho_vendedor", {
    p_inicio: inicio.toISOString(),
    p_fim: fim.toISOString(),
  })

  if (error) {
    throw new Error(`Falha ao carregar desempenho por vendedor: ${error.message}`)
  }

  return (data ?? []).map(
    (row: {
      responsavel: string
      responsavel_nome: string | null
      ganho: number | string
      perdido: number | string
    }) => ({
      responsavel: row.responsavel,
      responsavelNome: row.responsavel_nome,
      ganho: Number(row.ganho),
      perdido: Number(row.perdido),
    })
  )
}

export type ProspeccaoRow = { id: string; nome: string; total: number }

/** DSH-05/D-09: filters by clientes.criado_em (cadastro date), grouped by produto. */
export async function getProspeccaoPorProduto(
  inicio: Date,
  fim: Date
): Promise<ProspeccaoRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_prospeccao_por_produto", {
    p_inicio: inicio.toISOString(),
    p_fim: fim.toISOString(),
  })

  if (error) {
    throw new Error(`Falha ao carregar prospecção por produto: ${error.message}`)
  }

  return (data ?? []).map(
    (row: { produto_id: string; produto_nome: string; total: number | string }) => ({
      id: row.produto_id,
      nome: row.produto_nome,
      total: Number(row.total),
    })
  )
}

/** DSH-05/D-09: filters by clientes.criado_em (cadastro date), grouped by categoria. */
export async function getProspeccaoPorCategoria(
  inicio: Date,
  fim: Date
): Promise<ProspeccaoRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(
    "dashboard_prospeccao_por_categoria",
    {
      p_inicio: inicio.toISOString(),
      p_fim: fim.toISOString(),
    }
  )

  if (error) {
    throw new Error(`Falha ao carregar prospecção por categoria: ${error.message}`)
  }

  return (data ?? []).map(
    (row: {
      categoria_id: string
      categoria_nome: string
      total: number | string
    }) => ({
      id: row.categoria_id,
      nome: row.categoria_nome,
      total: Number(row.total),
    })
  )
}

export type FunilDetalhadoRow = {
  etapa: EtapaKey
  quantidade: number
  avancouCount: number
  avancouPct: number | null
  perdidosCount: number
  perdidosPct: number | null
  tempoMedioDias: number | null
  gargalo: boolean
}

/** FNL-01: live snapshot of all 7 etapas, no period parameters. */
export async function getFunilDetalhado(): Promise<FunilDetalhadoRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_funil_detalhado")

  if (error) {
    throw new Error(`Falha ao carregar funil detalhado: ${error.message}`)
  }

  return (data ?? []).map(
    (row: {
      etapa: EtapaKey
      quantidade: number | string
      avancou_count: number | string
      avancou_pct: number | string | null
      perdidos_count: number | string
      perdidos_pct: number | string | null
      tempo_medio_dias: number | string | null
      gargalo: boolean
    }) => ({
      etapa: row.etapa,
      quantidade: Number(row.quantidade),
      avancouCount: Number(row.avancou_count),
      avancouPct: row.avancou_pct === null ? null : Number(row.avancou_pct),
      perdidosCount: Number(row.perdidos_count),
      perdidosPct: row.perdidos_pct === null ? null : Number(row.perdidos_pct),
      tempoMedioDias:
        row.tempo_medio_dias === null ? null : Number(row.tempo_medio_dias),
      gargalo: row.gargalo,
    })
  )
}

export type TempoAteFechamentoRow = {
  status: "ganho" | "perdido"
  mediaDias: number
}

/** FNL-02: live snapshot (ganho/perdido separated), no period parameters. */
export async function getTempoAteFechamento(): Promise<TempoAteFechamentoRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_tempo_ate_fechamento")

  if (error) {
    throw new Error(`Falha ao carregar tempo até fechamento: ${error.message}`)
  }

  return (data ?? []).map(
    (row: { status: "ganho" | "perdido"; media_dias: number | string }) => ({
      status: row.status,
      mediaDias: Number(row.media_dias),
    })
  )
}

export type ComparativoVendedorRow = {
  responsavel: string
  responsavelNome: string | null
  negociosIniciados: number
  ganho: number
  perdido: number
  cicloMedioDias: number | null
  // Computed here via taxaConversao() (D-03) — the RPC never returns this
  // column. Holds the raw ratio (0 to 1), never a percentage.
  taxaConversao: number | null
}

/** VEND-01: live snapshot, whole history, no period parameters (D-01/D-02). */
export async function getComparativoVendedor(): Promise<ComparativoVendedorRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_comparativo_vendedor")

  if (error) {
    throw new Error(`Falha ao carregar comparativo por vendedor: ${error.message}`)
  }

  return (data ?? []).map(
    (row: {
      responsavel: string
      responsavel_nome: string | null
      negocios_iniciados: number | string
      ganho: number | string
      perdido: number | string
      ciclo_medio_dias: number | string | null
    }) => {
      const ganho = Number(row.ganho)
      const perdido = Number(row.perdido)
      return {
        responsavel: row.responsavel,
        responsavelNome: row.responsavel_nome,
        negociosIniciados: Number(row.negocios_iniciados),
        ganho,
        perdido,
        cicloMedioDias:
          row.ciclo_medio_dias === null ? null : Number(row.ciclo_medio_dias),
        taxaConversao: taxaConversao(ganho, perdido),
      }
    }
  )
}

// Re-exported so chart components can label the x-axis with ETAPA_KEYS'
// order/labels without a second etapa->label map (04-PATTERNS.md).
export { ETAPA_KEYS }
export type { EtapaKey }
