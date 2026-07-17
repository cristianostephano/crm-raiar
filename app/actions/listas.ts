"use server"

import { revalidatePath } from "next/cache"

import {
  createListaValorSchema,
  type CreateListaValorInput,
} from "@/lib/validations/lista"
import { createClient } from "@/lib/supabase/server"

/** The 4 editable-list lookup tables administered by "Configurações"
 * (ADM-01..04) — all 4 share the exact same schema/RLS shape. */
export type ListaTabela =
  | "categorias"
  | "produtos_consumidos"
  | "tipos_tarefa"
  | "motivos_perda"

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
  // cadastro dropdowns pick it up on next navigation.
  revalidatePath("/configuracoes")
  revalidatePath("/clientes")

  return { data: inserted! }
}
