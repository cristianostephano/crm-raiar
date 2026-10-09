import { taxaConversao } from "@/lib/dashboard/periodo"
import { ETAPA_KEYS, type EtapaKey } from "@/lib/funil/etapas"
import { createClient } from "@/lib/supabase/server"

/**
 * Typed .rpc() readers for the dashboard_* aggregate functions (the five
 * from the 0003 migration, dashboard_funil_detalhado/
 * dashboard_tempo_ate_fechamento from 0009 in Phase 11,
 * dashboard_comparativo_vendedor from 0011 in that same phase, and
 * dashboard_aderencia_uso from 0040 in Phase 30). Mirrors
 * lib/supabase/queries/clientes.ts's getClientesAgrupadosPorEtapa()
 * throw-on-error posture — a dashboard chart that silently renders empty on
 * a real fetch error is worse than an explicit failed-fetch state (UI-SPEC's
 * per-card error handling).
 *
 * NO manual responsavel/role filtering anywhere in this file — every
 * dashboard_* function is SECURITY INVOKER, so RLS on clientes/historico
 * already scopes every result to the caller automatically (D-07, same
 * principle as getClientesAgrupadosPorEtapa's own "no manual responsavel
 * filter" comment). The "ativo" filter of the aggregates is also decided only
 * in SQL; the only reader here that filters by `ativo` is
 * getVendedoresAtivosFiltro (the names list of the Dashboard vendor select).
 *
 * Optional vendor cut (quick 261009-npp, migration 0054): six readers accept
 * an optional `vendedorId` as the LAST parameter. The cut is decided in SQL
 * and only NARROWS the result - RLS stays the only boundary. With no vendedor
 * ("Todos") the rpc call is exactly the one made before 0054 (no second
 * argument / only { p_inicio, p_fim }); with a vendedor only `p_vendedor` is
 * added. Desempenho, comparativo and aderencia are NOT cut.
 */

// Postgres `bigint` columns come back from PostgREST as strings (to avoid
// silent precision loss past 2^53) — every row mapper below normalizes with
// Number() so callers always get real numbers, never numeric strings.

export type ClientesPorEtapaRow = { etapa: EtapaKey; total: number }

/** Arguments of the 3 readers without period: nothing when there is no vendedor. */
function argsSemPeriodo(vendedorId: string | null): { p_vendedor: string } | undefined {
  return vendedorId ? { p_vendedor: vendedorId } : undefined
}

/** Arguments of the 3 readers with period: p_vendedor only when chosen. */
function argsComPeriodo(
  inicio: Date,
  fim: Date,
  vendedorId: string | null
): { p_inicio: string; p_fim: string; p_vendedor?: string } {
  const base = { p_inicio: inicio.toISOString(), p_fim: fim.toISOString() }
  return vendedorId ? { ...base, p_vendedor: vendedorId } : base
}

/** DSH-01/DSH-08: live snapshot, no period parameters; optional vendor cut. */
export async function getClientesPorEtapa(
  vendedorId: string | null = null
): Promise<ClientesPorEtapaRow[]> {
  const supabase = await createClient()
  const args = argsSemPeriodo(vendedorId)
  const { data, error } = args
    ? await supabase.rpc("dashboard_clientes_por_etapa", args)
    : await supabase.rpc("dashboard_clientes_por_etapa")

  if (error) {
    throw new Error(`Falha ao carregar clientes por etapa: ${error.message}`)
  }

  return (data ?? []).map((row: { etapa: EtapaKey; total: number | string }) => ({
    etapa: row.etapa,
    total: Number(row.total),
  }))
}

export type GanhosPerdidosRow = { status: "ganho" | "perdido"; total: number }

/** DSH-02/D-02: period filters by the date of the status-change historico row; optional vendor cut. */
export async function getGanhosPerdidos(
  inicio: Date,
  fim: Date,
  vendedorId: string | null = null
): Promise<GanhosPerdidosRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(
    "dashboard_ganhos_perdidos",
    argsComPeriodo(inicio, fim, vendedorId)
  )

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

/** DSH-05/D-09: filters by clientes.criado_em (cadastro date), grouped by produto; optional vendor cut. */
export async function getProspeccaoPorProduto(
  inicio: Date,
  fim: Date,
  vendedorId: string | null = null
): Promise<ProspeccaoRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(
    "dashboard_prospeccao_por_produto",
    argsComPeriodo(inicio, fim, vendedorId)
  )

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

/** DSH-05/D-09: filters by clientes.criado_em (cadastro date), grouped by categoria; optional vendor cut. */
export async function getProspeccaoPorCategoria(
  inicio: Date,
  fim: Date,
  vendedorId: string | null = null
): Promise<ProspeccaoRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(
    "dashboard_prospeccao_por_categoria",
    argsComPeriodo(inicio, fim, vendedorId)
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

/** FNL-01: live snapshot of all 7 etapas, no period parameters; optional vendor cut. */
export async function getFunilDetalhado(
  vendedorId: string | null = null
): Promise<FunilDetalhadoRow[]> {
  const supabase = await createClient()
  const args = argsSemPeriodo(vendedorId)
  const { data, error } = args
    ? await supabase.rpc("dashboard_funil_detalhado", args)
    : await supabase.rpc("dashboard_funil_detalhado")

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

/** FNL-02: live snapshot (ganho/perdido separated), no period parameters; optional vendor cut. */
export async function getTempoAteFechamento(
  vendedorId: string | null = null
): Promise<TempoAteFechamentoRow[]> {
  const supabase = await createClient()
  const args = argsSemPeriodo(vendedorId)
  const { data, error } = args
    ? await supabase.rpc("dashboard_tempo_ate_fechamento", args)
    : await supabase.rpc("dashboard_tempo_ate_fechamento")

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

export type AderenciaUsoRow = {
  responsavel: string
  diasUsados: number
  diasUteis: number
  // Já em pontos percentuais (0 a 100) — nulo quando diasUteis é zero
  // (dashboard_aderencia_uso() decide isso no banco, nunca aqui).
  aderenciaPct: number | null
  // "AAAA-MM-DD" ou nulo; quem decide é o Postgres. Preenchido durante a
  // coleta (medição com menos de 28 dias). Com diasUteis maior que zero,
  // diasUteis/diasUsados/aderenciaPct já vêm PARCIAIS, contados desde esta
  // data (primeiro dia útil contado do vendedor, migration 0052). Preenchido
  // com diasUteis zero = só o aviso "Coletando dados desde". Nulo = janela
  // de 28 dias cheia (números completos).
  coletandoDesde: string | null
}

/**
 * ADER-01..03: leitura agregada, read-only, de dashboard_aderencia_uso()
 * (migration 0040, plano 30-02; conta parcial durante a coleta na migration
 * 0052, quick 261008-mrf). Nenhuma checagem de papel aqui — a função
 * do banco já devolve zero linhas para quem não é Supervisor (D-08); esta
 * função roda como o chamador, sem elevação de privilégio, no mesmo molde
 * das demais leituras deste arquivo. dashboard_comparativo_vendedor() e
 * getComparativoVendedor() não mudam — a junção por `responsavel` acontece
 * na Server Action (plano 30-05), nunca no banco nem aqui.
 */
export async function getAderenciaUso(): Promise<AderenciaUsoRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("dashboard_aderencia_uso")

  if (error) {
    throw new Error(`Falha ao carregar aderência de uso: ${error.message}`)
  }

  return (data ?? []).map(
    (row: {
      responsavel: string
      dias_usados: number | string
      dias_uteis: number | string
      aderencia_pct: number | string | null
      coletando_desde: string | null
    }) => ({
      responsavel: row.responsavel,
      diasUsados: Number(row.dias_usados),
      diasUteis: Number(row.dias_uteis),
      aderenciaPct: row.aderencia_pct === null ? null : Number(row.aderencia_pct),
      coletandoDesde: row.coletando_desde,
    })
  )
}

export type VendedorFiltroOpcao = { id: string; nome: string }

/**
 * Names list of the Dashboard vendor select (quick 261009-npp): only active
 * vendedores, only id + nome + sobrenome (LGPD data minimization - no e-mail,
 * no phone). Called only for the Supervisor by the page; throws on error like
 * the other readers (the page turns a failure into an empty list).
 */
export async function getVendedoresAtivosFiltro(): Promise<VendedorFiltroOpcao[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, sobrenome")
    .eq("role", "vendedor")
    .eq("ativo", true)
    .order("nome", { ascending: true })

  if (error) {
    throw new Error(`Falha ao carregar vendedores: ${error.message}`)
  }

  return (data ?? []).map(
    (row: { id: string; nome: string | null; sobrenome: string | null }) => ({
      id: row.id,
      nome: [row.nome, row.sobrenome]
        .map((parte) => (parte ?? "").trim())
        .filter((parte) => parte !== "")
        .join(" "),
    })
  )
}

// Re-exported so chart components can label the x-axis with ETAPA_KEYS'
// order/labels without a second etapa->label map (04-PATTERNS.md).
export { ETAPA_KEYS }
export type { EtapaKey }
