"use server"

import { revalidatePath } from "next/cache"

import {
  createListaValorSchema,
  updateListaValorSchema,
  type CreateListaValorInput,
  type UpdateListaValorInput,
} from "@/lib/validations/lista"
import { createClient } from "@/lib/supabase/server"

/** The 6 editable-list lookup tables administered by "Configurações"
 * (ADM-01..04) — all 6 share the exact same schema/RLS shape. The 5th,
 * `frequencias_pedido`, chegou na Fase 16 para o campo "Frequência de
 * pedidos" da ficha do cliente ativo (ATV-02, migration
 * 0016_frequencias_pedido.sql). A 6ª, `motivos_conclusao_remota`, chegou
 * na Fase 22 (migration 0022_conclusao_remota_com_motivo.sql) para o
 * motivo de uma conclusão remota (CONC-03) — as duas entram na mesma
 * união genérica sem nenhuma mudança nas 4 funções abaixo. */
export type ListaTabela =
  | "categorias"
  | "produtos_consumidos"
  | "tipos_tarefa"
  | "motivos_perda"
  | "frequencias_pedido"
  | "motivos_conclusao_remota"

export type ListaValor = { id: string; nome: string; ativo: boolean }

export type GetListaValoresErrorCode = "unauthenticated"

export type GetListaValoresResult =
  | { data: ListaValor[]; error?: undefined }
  | { data?: undefined; error: { code: GetListaValoresErrorCode } }

/**
 * Lists every row (active AND inactive) of a lookup table, for the
 * "Configurações" admin screen — unlike the read-only
 * getCategoriasAtivas/getProdutosAtivos/getTiposTarefaAtivos/
 * getMotivosPerdaAtivos in lib/supabase/queries/clientes.ts (which filter
 * ativo=true for cadastro dropdowns), this admin read must also surface
 * inactive rows so the Supervisor can find and reactivate them (03-02's
 * "Mostrar inativos" toggle) — that's why this lives here in listas.ts
 * rather than reusing/modifying those existing queries.
 */
export async function getListaValores(
  tabela: ListaTabela
): Promise<GetListaValoresResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  const { data, error } = await supabase
    .from(tabela)
    .select("id, nome, ativo")
    .order("nome", { ascending: true })

  if (error || !data) {
    return { data: [] }
  }

  return { data }
}

export type CreateListaValorErrorCode =
  | "validation"
  | "unauthenticated"
  | "forbidden"
  | "duplicate_nome"
  | "generic"

export type CreateListaValorResult =
  | { data: { id: string; nome: string }; error?: undefined }
  | { data?: undefined; error: { code: CreateListaValorErrorCode } }

/**
 * Adds a new value to one of the 4 lookup tables (ADM-01, this plan's
 * "adicionar" slice). Every write on these tables is Supervisor-only
 * (D-02) — unlike createCliente/updateCliente there is no Vendedor-scoped
 * variant, so this always rejects a non-Supervisor caller with "forbidden"
 * before attempting the insert (defense-in-depth mirroring deleteCliente;
 * the real boundary is the RLS INSERT policy from migration 0002, T-03-01).
 */
export async function createListaValor(
  tabela: ListaTabela,
  values: CreateListaValorInput
): Promise<CreateListaValorResult> {
  const parsed = createListaValorSchema.safeParse(values)
  if (!parsed.success) {
    return { error: { code: "validation" } }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const isSupervisor = callerProfile?.role === "supervisor"

  if (!isSupervisor) {
    return { error: { code: "forbidden" } }
  }

  const { data: inserted, error } = await supabase
    .from(tabela)
    .insert({ nome: parsed.data.nome })
    .select("id, nome")
    .single()

  if (error) {
    // The unique(nome) constraint already exists on all 4 tables (Phase 2,
    // proven by Task 1's rls-listas.test.ts) — map Postgres' 23505
    // unique-violation to a structured, UI-friendly error code.
    if (error.code === "23505") {
      return { error: { code: "duplicate_nome" } }
    }
    return { error: { code: "generic" } }
  }

  // D-03/ADM-01: reflect the new value immediately where it's used —
  // "/configuracoes" for the admin list itself, "/clientes" so the
  // cadastro dropdowns pick it up on next navigation. "/agenda" joined
  // this pair in Fase 22: since motivos_conclusao_remota (CONC-03) is a
  // list too, a value created/renamed/deactivated here must reach the
  // Agenda's remote-conclusion dialog without a full page reload — the
  // same reasoning applies to all 3 write actions below, not just create.
  revalidatePath("/configuracoes")
  revalidatePath("/clientes")
  revalidatePath("/agenda")

  return { data: inserted! }
}

export type UpdateListaValorErrorCode =
  | "validation"
  | "unauthenticated"
  | "forbidden"
  | "duplicate_nome"
  | "not_found"
  | "generic"

export type UpdateListaValorResult =
  | { data: { id: string; nome: string }; error?: undefined }
  | { data?: undefined; error: { code: UpdateListaValorErrorCode } }

/**
 * Renames an existing value in place (D-04, this plan's "editar" slice) —
 * deliberately an UPDATE on the same row, never a delete+recreate, so a
 * cliente already referencing this row's id keeps pointing at it. Same
 * Supervisor-only defense-in-depth + duplicate-mapping shape as
 * createListaValor.
 */
export async function updateListaValor(
  tabela: ListaTabela,
  values: UpdateListaValorInput
): Promise<UpdateListaValorResult> {
  const parsed = updateListaValorSchema.safeParse(values)
  if (!parsed.success) {
    return { error: { code: "validation" } }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const isSupervisor = callerProfile?.role === "supervisor"

  if (!isSupervisor) {
    return { error: { code: "forbidden" } }
  }

  const { data: updated, error } = await supabase
    .from(tabela)
    .update({ nome: parsed.data.nome })
    .eq("id", parsed.data.id)
    .select("id, nome")
    .maybeSingle()

  if (error) {
    if (error.code === "23505") {
      return { error: { code: "duplicate_nome" } }
    }
    return { error: { code: "generic" } }
  }

  if (!updated) {
    // 0 rows: either the id doesn't exist, or RLS's USING clause filtered it
    // out — never distinguish which, same non-revealing posture as
    // updateCliente's not_found mapping.
    return { error: { code: "not_found" } }
  }

  revalidatePath("/configuracoes")
  revalidatePath("/clientes")
  revalidatePath("/agenda")

  return { data: updated }
}

export type SetListaValorAtivoErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "generic"

export type SetListaValorAtivoResult =
  | { data: { id: string }; error?: undefined }
  | { data?: undefined; error: { code: SetListaValorAtivoErrorCode } }

/**
 * Soft-delete toggle (D-03, this plan's "desativar"/"reativar" slice): only
 * ever `.update({ ativo })`, NEVER `.delete()` — a DELETE RLS policy exists
 * on these 4 tables as a migration-0002 residue, but this action never
 * triggers it, so a cliente already referencing a deactivated value keeps
 * working normally (D-03). Same Supervisor-only defense-in-depth as every
 * other write on these tables.
 */
export async function setListaValorAtivo(
  tabela: ListaTabela,
  id: string,
  ativo: boolean
): Promise<SetListaValorAtivoResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const isSupervisor = callerProfile?.role === "supervisor"

  if (!isSupervisor) {
    return { error: { code: "forbidden" } }
  }

  const { data: updated, error } = await supabase
    .from(tabela)
    .update({ ativo })
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) {
    return { error: { code: "generic" } }
  }

  if (!updated) {
    return { error: { code: "not_found" } }
  }

  revalidatePath("/configuracoes")
  revalidatePath("/clientes")
  revalidatePath("/agenda")

  return { data: updated }
}
