"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import {
  getTarefas,
  getTiposTarefaAtivos,
  type LookupOption,
  type Tarefa,
} from "@/lib/supabase/queries/clientes"

export type TarefaErrorCode = "nao_encontrada" | "generic"

export type TarefaResult =
  | { data: { id: string }; error?: undefined }
  | { data?: undefined; error: { code: TarefaErrorCode } }

/**
 * Appends a tarefa to a cliente's checklist (FUN-08). RLS on `tarefas` (the
 * parent-cliente EXISTS gate from 02-01) is the real authorization boundary
 * — a Vendedor attempting this on a non-owned clienteId gets 0 rows
 * inserted and this returns a generic error, never a distinguishing
 * "forbidden" code (same non-revealing posture as the rest of this phase).
 */
export async function adicionarTarefa(
  clienteId: string,
  tipoTarefaId: string,
  dataConclusao?: string | null
): Promise<TarefaResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("tarefas")
    .insert({
      cliente_id: clienteId,
      tipo_tarefa_id: tipoTarefaId,
      data_conclusao: dataConclusao || null,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { error: { code: "generic" } }
  }

  revalidatePath("/clientes")
  return { data: { id: data.id } }
}

/**
 * Flips a tarefa's concluida flag (FUN-08). Completing a task
 * (false -> true) is what the 02-01 `trg_tarefas_before_update_historico`
 * trigger watches for — it stamps concluida_em and writes exactly one
 * historico row (FUN-10); this action never inserts into `historico`
 * itself (T-02-25). RLS-gated via the parent cliente (T-02-24) — a
 * Vendedor toggling another vendedor's tarefa affects 0 rows.
 */
export async function toggleTarefa(
  tarefaId: string,
  concluida: boolean
): Promise<TarefaResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("tarefas")
    .update({ concluida })
    .eq("id", tarefaId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { error: { code: "generic" } }
  }
  if (!data) {
    return { error: { code: "nao_encontrada" } }
  }

  revalidatePath("/clientes")
  return { data: { id: data.id } }
}

/** Removes a tarefa (FUN-08's ghost delete icon). Same RLS-gated posture as
 * toggleTarefa above. */
export async function removerTarefa(tarefaId: string): Promise<TarefaResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("tarefas")
    .delete()
    .eq("id", tarefaId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { error: { code: "generic" } }
  }
  if (!data) {
    return { error: { code: "nao_encontrada" } }
  }

  revalidatePath("/clientes")
  return { data: { id: data.id } }
}

export type GetTarefasResult =
  | { data: Tarefa[]; error?: undefined }
  | { data?: undefined; error: { code: "unauthenticated" } }

/**
 * Thin Server Action wrapper around getTarefas() (T-02-21's pattern) —
 * ClienteDetailSheet is a Client Component and getTarefas() needs
 * next/headers' cookies() via lib/supabase/server.ts's createClient().
 */
export async function getTarefasAction(
  clienteId: string
): Promise<GetTarefasResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  return { data: await getTarefas(clienteId) }
}

export type GetTiposTarefaResult =
  | { data: LookupOption[]; error?: undefined }
  | { data?: undefined; error: { code: "unauthenticated" } }

/** Server Action wrapper around getTiposTarefaAtivos(), for the
 * "+ Adicionar tarefa" tipo Select (FUN-08). */
export async function getTiposTarefa(): Promise<GetTiposTarefaResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  return { data: await getTiposTarefaAtivos() }
}
