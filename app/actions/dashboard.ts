"use server"

import { mesclarAderencia, type ComparativoVendedorLinha } from "@/lib/aderencia/exibicao"
import { normalizarVendedorFiltro } from "@/lib/dashboard/vendedorFiltro"
import { createClient } from "@/lib/supabase/server"
import {
  getAderenciaUso,
  getClientesPorEtapa,
  getComparativoVendedor,
  getDesempenhoVendedor,
  getFunilDetalhado,
  getGanhosPerdidos,
  getProspeccaoPorCategoria,
  getProspeccaoPorProduto,
  getTempoAteFechamento,
  type ClientesPorEtapaRow,
  type DesempenhoVendedorRow,
  type FunilDetalhadoRow,
  type GanhosPerdidosRow,
  type ProspeccaoRow,
  type TempoAteFechamentoRow,
} from "@/lib/supabase/queries/dashboard"

/**
 * Thin Server Action wrappers around lib/supabase/queries/dashboard.ts
 * (mirrors app/actions/funil.ts's getHistoricoAction/getMotivosPerda
 * pattern) — DashboardClient and its chart children are Client Components,
 * and every query function above depends on next/headers' cookies() via
 * lib/supabase/server.ts's createClient(), so they can only be called from
 * here.
 *
 * Every action returns a discriminated-union result ({ data } | { error })
 * — never a thrown exception across the Server Action boundary — so one
 * failed metric's error state never blanks the whole dashboard (UI-SPEC).
 * This phase is read-only: no revalidatePath anywhere in this file.
 *
 * Optional vendor cut (quick 261009-npp): six actions take an optional
 * `vendedorId` as the LAST parameter. After the session check it is
 * format-checked by normalizarVendedorFiltro (input hygiene, NOT
 * authorization - RLS decides what each caller sees); a malformed id returns
 * the usual fetch_falhou error without calling the reader; empty means "Todos"
 * and reaches the reader as null. getDesempenhoVendedorAction and
 * getComparativoVendedorAction are NOT cut.
 */

const ERRO_FETCH = {
  code: "fetch_falhou",
  message: "Não foi possível carregar os dados do dashboard. Tente novamente.",
} as const

export type DashboardErrorCode = "unauthenticated" | "fetch_falhou"

export type GetClientesPorEtapaResult =
  | { data: ClientesPorEtapaRow[]; error?: undefined }
  | { data?: undefined; error: { code: DashboardErrorCode; message: string } }

/** DSH-01/DSH-08 — live snapshot, no period parameters; optional vendor cut (quick 261009-npp). */
export async function getClientesPorEtapaAction(
  vendedorId?: string | null
): Promise<GetClientesPorEtapaResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  const vendedor = normalizarVendedorFiltro(vendedorId)
  if (!vendedor.ok) {
    return { error: { ...ERRO_FETCH } }
  }

  try {
    return { data: await getClientesPorEtapa(vendedor.vendedorId) }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message:
          "Não foi possível carregar os dados do dashboard. Tente novamente.",
      },
    }
  }
}

export type GetGanhosPerdidosResult =
  | { data: GanhosPerdidosRow[]; error?: undefined }
  | { data?: undefined; error: { code: DashboardErrorCode; message: string } }

/** DSH-02/DSH-04 — period filters by the status-change historico date (D-02); optional vendor cut (quick 261009-npp). */
export async function getGanhosPerdidosAction(
  inicio: Date,
  fim: Date,
  vendedorId?: string | null
): Promise<GetGanhosPerdidosResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  const vendedor = normalizarVendedorFiltro(vendedorId)
  if (!vendedor.ok) {
    return { error: { ...ERRO_FETCH } }
  }

  try {
    return { data: await getGanhosPerdidos(inicio, fim, vendedor.vendedorId) }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message:
          "Não foi possível carregar os dados do dashboard. Tente novamente.",
      },
    }
  }
}

export type GetDesempenhoVendedorResult =
  | { data: DesempenhoVendedorRow[]; error?: undefined }
  | { data?: undefined; error: { code: DashboardErrorCode; message: string } }

/** DSH-03/D-10 — Supervisor-only block in the UI; RLS already scopes a Vendedor's call to one row. */
export async function getDesempenhoVendedorAction(
  inicio: Date,
  fim: Date
): Promise<GetDesempenhoVendedorResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    return { data: await getDesempenhoVendedor(inicio, fim) }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message:
          "Não foi possível carregar os dados do dashboard. Tente novamente.",
      },
    }
  }
}

export type GetProspeccaoPorProdutoResult =
  | { data: ProspeccaoRow[]; error?: undefined }
  | { data?: undefined; error: { code: DashboardErrorCode; message: string } }

/** DSH-05/D-09 — period filters by clientes.criado_em (cadastro date); optional vendor cut (quick 261009-npp). */
export async function getProspeccaoPorProdutoAction(
  inicio: Date,
  fim: Date,
  vendedorId?: string | null
): Promise<GetProspeccaoPorProdutoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  const vendedor = normalizarVendedorFiltro(vendedorId)
  if (!vendedor.ok) {
    return { error: { ...ERRO_FETCH } }
  }

  try {
    return { data: await getProspeccaoPorProduto(inicio, fim, vendedor.vendedorId) }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message:
          "Não foi possível carregar os dados do dashboard. Tente novamente.",
      },
    }
  }
}

export type GetProspeccaoPorCategoriaResult =
  | { data: ProspeccaoRow[]; error?: undefined }
  | { data?: undefined; error: { code: DashboardErrorCode; message: string } }

/** DSH-05/D-09 — same criado_em date basis as getProspeccaoPorProdutoAction; optional vendor cut (quick 261009-npp). */
export async function getProspeccaoPorCategoriaAction(
  inicio: Date,
  fim: Date,
  vendedorId?: string | null
): Promise<GetProspeccaoPorCategoriaResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  const vendedor = normalizarVendedorFiltro(vendedorId)
  if (!vendedor.ok) {
    return { error: { ...ERRO_FETCH } }
  }

  try {
    return { data: await getProspeccaoPorCategoria(inicio, fim, vendedor.vendedorId) }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message:
          "Não foi possível carregar os dados do dashboard. Tente novamente.",
      },
    }
  }
}

export type GetFunilDetalhadoResult =
  | { data: FunilDetalhadoRow[]; error?: undefined }
  | { data?: undefined; error: { code: DashboardErrorCode; message: string } }

/** FNL-01 — live snapshot, no period parameter; optional vendor cut (quick 261009-npp). */
export async function getFunilDetalhadoAction(
  vendedorId?: string | null
): Promise<GetFunilDetalhadoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  const vendedor = normalizarVendedorFiltro(vendedorId)
  if (!vendedor.ok) {
    return { error: { ...ERRO_FETCH } }
  }

  try {
    return { data: await getFunilDetalhado(vendedor.vendedorId) }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message:
          "Não foi possível carregar os dados do dashboard. Tente novamente.",
      },
    }
  }
}

export type GetTempoAteFechamentoResult =
  | { data: TempoAteFechamentoRow[]; error?: undefined }
  | { data?: undefined; error: { code: DashboardErrorCode; message: string } }

/** FNL-02 — live snapshot, no period parameter; optional vendor cut (quick 261009-npp). */
export async function getTempoAteFechamentoAction(
  vendedorId?: string | null
): Promise<GetTempoAteFechamentoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  const vendedor = normalizarVendedorFiltro(vendedorId)
  if (!vendedor.ok) {
    return { error: { ...ERRO_FETCH } }
  }

  try {
    return { data: await getTempoAteFechamento(vendedor.vendedorId) }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message:
          "Não foi possível carregar os dados do dashboard. Tente novamente.",
      },
    }
  }
}

export type GetComparativoVendedorResult =
  | { data: ComparativoVendedorLinha[]; error?: undefined }
  | { data?: undefined; error: { code: DashboardErrorCode; message: string } }

/**
 * VEND-01 — live snapshot, no period parameter; Supervisor-only gate lives
 * in DashboardClient, not here. ADER-01..03: a aderência de uso é uma
 * métrica nova, decorativa em relação ao comparativo já em produção — se só
 * ela falhar (`.catch(() => null)`), a tabela comparativa continua
 * carregando normalmente, com a coluna de aderência em travessão em todas
 * as linhas; se o comparativo falhar, o erro devolvido é o mesmo de sempre.
 * Nenhuma checagem de papel aqui: D-08 já é garantido no banco
 * (dashboard_aderencia_uso() devolve zero linhas para quem não é
 * Supervisor) e DashboardClient nem monta este componente para Vendedor.
 */
export async function getComparativoVendedorAction(): Promise<GetComparativoVendedorResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    const [comparativo, aderencia] = await Promise.all([
      getComparativoVendedor(),
      getAderenciaUso().catch(() => null),
    ])

    return { data: mesclarAderencia(comparativo, aderencia ?? []) }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message:
          "Não foi possível carregar os dados do dashboard. Tente novamente.",
      },
    }
  }
}
