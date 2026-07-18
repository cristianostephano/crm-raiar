import { ETAPA_KEYS, type EtapaKey } from "@/lib/funil/etapas"
import { createClient } from "@/lib/supabase/server"

/**
 * Typed .rpc() readers for the five dashboard_* aggregate functions (0003
 * migration). Mirrors lib/supabase/queries/clientes.ts's
 * getClientesAgrupadosPorEtapa() throw-on-error posture — a dashboard chart
 * that silently renders empty on a real fetch error is worse than an
 * explicit failed-fetch state (UI-SPEC's per-card error handling).
 *
 * NO manual responsavel/role filtering anywhere in this file — every
 * dashboard_* function is SECURITY INVOKER, so RLS on clientes/historico
 * already scopes every result to the caller automatically (D-07, same
 * principle as getClientesAgrupadosPorEtapa's own "no manual responsavel
 * filter" comment).
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

// Re-exported so chart components can label the x-axis with ETAPA_KEYS'
// order/labels without a second etapa->label map (04-PATTERNS.md).
export { ETAPA_KEYS }
export type { EtapaKey }
