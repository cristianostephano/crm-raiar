"use server"

import { createClient } from "@/lib/supabase/server"
import {
  getClientesPorEtapa,
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
 */

export type DashboardErrorCode = "unauthenticated" | "fetch_falhou"

export type GetClientesPorEtapaResult =
  | { data: ClientesPorEtapaRow[]; error?: undefined }
  | { data?: undefined; error: { code: DashboardErrorCode; message: string } }

/** DSH-01/DSH-08 — live snapshot, no period parameters. */
export async function getClientesPorEtapaAction(): Promise<GetClientesPorEtapaResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    return { data: await getClientesPorEtapa() }
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

/** DSH-02/DSH-04 — period filters by the status-change historico date (D-02). */
export async function getGanhosPerdidosAction(
  inicio: Date,
  fim: Date
): Promise<GetGanhosPerdidosResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    return { data: await getGanhosPerdidos(inicio, fim) }
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

/** DSH-05/D-09 — period filters by clientes.criado_em (cadastro date). */
export async function getProspeccaoPorProdutoAction(
  inicio: Date,
  fim: Date
): Promise<GetProspeccaoPorProdutoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    return { data: await getProspeccaoPorProduto(inicio, fim) }
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

/** DSH-05/D-09 — same criado_em date basis as getProspeccaoPorProdutoAction. */
export async function getProspeccaoPorCategoriaAction(
  inicio: Date,
  fim: Date
): Promise<GetProspeccaoPorCategoriaResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    return { data: await getProspeccaoPorCategoria(inicio, fim) }
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

/** FNL-01 — live snapshot, no period parameter. */
export async function getFunilDetalhadoAction(): Promise<GetFunilDetalhadoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    return { data: await getFunilDetalhado() }
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

/** FNL-02 — live snapshot, no period parameter. */
export async function getTempoAteFechamentoAction(): Promise<GetTempoAteFechamentoResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    return { data: await getTempoAteFechamento() }
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
