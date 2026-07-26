"use server"

import { revalidatePath } from "next/cache"

import { cidadeValida } from "@/lib/clientes/cidadeValida"
import {
  createClienteSchema,
  updateClienteSchema,
  type CreateClienteInput,
  type UpdateClienteInput,
} from "@/lib/validations/cliente"
import { createClient } from "@/lib/supabase/server"
import { getClienteById, type ClienteDetalhe } from "@/lib/supabase/queries/clientes"

export type CreateClienteErrorCode =
  | "validation"
  | "unauthenticated"
  | "duplicate_razao_social"
  | "generic"

export type CreateClienteResult =
  | { data: { id: string }; error?: undefined }
  | { data?: undefined; error: { code: CreateClienteErrorCode } }

/**
 * Creates a cliente (CLI-01/CLI-02/CLI-03). Re-validates with
 * createClienteSchema on the server — never trusts the client-side
 * validation (T-02-07). Every new cliente originates in the funil's first
 * stage ("aguardando_contato") via the `clientes.etapa` DB default, so no
 * separate "assign initial stage" step is needed here (FUN-01).
 */
export async function createCliente(
  values: CreateClienteInput
): Promise<CreateClienteResult> {
  const parsed = createClienteSchema.safeParse(values)
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

  // Defense in depth (T-02-07/T-02-08): a Vendedor's client-sent responsavel
  // is always overridden with their own uid, even though the clientes INSERT
  // RLS policy from 02-01 ("usuarios cadastram clientes para si (ou
  // supervisor para qualquer um)") already enforces the same rule at the
  // database level. Only a Supervisor may assign a different responsavel.
  const responsavel = isSupervisor ? parsed.data.responsavel : user.id

  // V5/T-09-09: the Combobox already constrains the Cidade choice client-side,
  // but a Server Action must never trust that alone (CLAUDE.md) — re-check
  // server-side that the submitted Cidade genuinely belongs to the submitted
  // Estado (Zod's z.enum(UFS) already re-validated Estado above; Cidade
  // validity is DB-dependent, so it can't be expressed in Zod).
  const { data: cidadesDoEstado } = await supabase.rpc("cidades_por_estado", {
    p_uf: parsed.data.estado,
  })

  if (
    !cidadeValida(
      parsed.data.cidade,
      parsed.data.estado,
      (cidadesDoEstado ?? []).map((row: { nome: string }) => ({
        nome: row.nome,
        uf: parsed.data.estado,
      }))
    )
  ) {
    return { error: { code: "validation" } }
  }

  const { data: inserted, error } = await supabase
    .from("clientes")
    .insert({
      razao_social: parsed.data.razaoSocial,
      cep: parsed.data.cep,
      rua: parsed.data.rua,
      numero: parsed.data.numero,
      complemento: parsed.data.complemento || null,
      cidade: parsed.data.cidade,
      estado: parsed.data.estado,
      responsavel,
      categoria_id: parsed.data.categoriaId || null,
      contato: parsed.data.contato || null,
      telefone: parsed.data.telefone || null,
      email: parsed.data.email || null,
      numero_de_lojas: parsed.data.numeroDeLojas ?? null,
    })
    .select("id")
    .single()

  if (error) {
    // D-06: razao_social is unique across the whole base. Postgres reports a
    // unique-violation as 23505 — map it to a structured, non-revealing error
    // code (the copy shown to the user never reveals which vendedor owns the
    // existing razão social).
    if (error.code === "23505") {
      return { error: { code: "duplicate_razao_social" } }
    }
    return { error: { code: "generic" } }
  }

  revalidatePath("/clientes")
  return { data: { id: inserted!.id } }
}

export type GetClienteDetalheErrorCode = "unauthenticated" | "not_found"

export type GetClienteDetalheResult =
  | { data: ClienteDetalhe; error?: undefined }
  | { data?: undefined; error: { code: GetClienteDetalheErrorCode } }

/**
 * Thin Server Action wrapper around lib/supabase/queries/clientes.ts's
 * getClienteById() (T-02-21) — KanbanBoard is a Client Component, and
 * getClienteById() reads via lib/supabase/server.ts's createClient(), which
 * needs next/headers' cookies() (a live Next.js request scope). A Client
 * Component can only reach that through a Server Action, not by importing
 * the query function directly.
 */
export async function getClienteDetalhe(
  id: string
): Promise<GetClienteDetalheResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  const cliente = await getClienteById(id)
  if (!cliente) {
    return { error: { code: "not_found" } }
  }

  return { data: cliente }
}

export type UpdateClienteErrorCode =
  | "validation"
  | "unauthenticated"
  | "not_found"
  | "duplicate_razao_social"
  | "generic"

export type UpdateClienteResult =
  | { data: { id: string }; error?: undefined }
  | { data?: undefined; error: { code: UpdateClienteErrorCode } }

/**
 * Edits an existing cliente (CLI-02/CLI-05/CLI-06). Re-validates with
 * updateClienteSchema server-side — never trusts the client-side validation
 * (mirrors createCliente's T-02-07 discipline).
 */
export async function updateCliente(
  values: UpdateClienteInput
): Promise<UpdateClienteResult> {
  const parsed = updateClienteSchema.safeParse(values)
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

  // Defense in depth (T-02-19): a Vendedor's client-sent responsavel change
  // is always stripped/overridden with their own uid, even though the
  // clientes UPDATE ... WITH CHECK RLS policy from 02-01 already rejects a
  // Vendedor reassigning responsavel at the database level. Only a
  // Supervisor may assign a different responsavel.
  const responsavel = isSupervisor ? parsed.data.responsavel : user.id

  // V5/T-09-09: same re-validation as createCliente — never trust that the
  // client-side Combobox already constrained Cidade to the chosen Estado.
  const { data: cidadesDoEstado } = await supabase.rpc("cidades_por_estado", {
    p_uf: parsed.data.estado,
  })

  if (
    !cidadeValida(
      parsed.data.cidade,
      parsed.data.estado,
      (cidadesDoEstado ?? []).map((row: { nome: string }) => ({
        nome: row.nome,
        uf: parsed.data.estado,
      }))
    )
  ) {
    return { error: { code: "validation" } }
  }

  const { data: updated, error } = await supabase
    .from("clientes")
    .update({
      razao_social: parsed.data.razaoSocial,
      cep: parsed.data.cep,
      rua: parsed.data.rua,
      numero: parsed.data.numero,
      complemento: parsed.data.complemento || null,
      cidade: parsed.data.cidade,
      estado: parsed.data.estado,
      responsavel,
      categoria_id: parsed.data.categoriaId || null,
      contato: parsed.data.contato || null,
      telefone: parsed.data.telefone || null,
      email: parsed.data.email || null,
      numero_de_lojas: parsed.data.numeroDeLojas ?? null,
      // FUN-07: saved together with the rest of "Salvar alterações" — no
      // separate salvarObservacao action.
      observacao: parsed.data.observacao || null,
    })
    .eq("id", parsed.data.id)
    .select("id")
    .maybeSingle()

  if (error) {
    // D-06: same 23505 -> duplicate_razao_social mapping as createCliente.
    if (error.code === "23505") {
      return { error: { code: "duplicate_razao_social" } }
    }
    return { error: { code: "generic" } }
  }

  if (!updated) {
    // 0 rows: either the id doesn't exist, or RLS's USING clause filtered it
    // out (a Vendedor editing a non-owned cliente) — never distinguish
    // which, same non-revealing posture as duplicate_razao_social.
    return { error: { code: "not_found" } }
  }

  // Multi-value produtos consumidos (CLI-02): replace the whole
  // cliente_produtos set for this cliente rather than diffing adds/removes —
  // simple and safe at MVP scale (a handful of produtos per cliente). Each
  // statement is still gated by cliente_produtos' own parent-EXISTS RLS
  // policy (Pitfall 3 — a joined table's RLS is independent of clientes').
  const produtoIds = parsed.data.produtoIds ?? []

  const { error: deleteProdutosError } = await supabase
    .from("cliente_produtos")
    .delete()
    .eq("cliente_id", parsed.data.id)

  if (deleteProdutosError) {
    return { error: { code: "generic" } }
  }

  if (produtoIds.length > 0) {
    const { error: insertProdutosError } = await supabase
      .from("cliente_produtos")
      .insert(
        produtoIds.map((produtoId) => ({
          cliente_id: parsed.data.id,
          produto_id: produtoId,
        }))
      )

    if (insertProdutosError) {
      return { error: { code: "generic" } }
    }
  }

  revalidatePath("/clientes")
  return { data: { id: updated.id } }
}

export type DeleteClienteErrorCode = "unauthenticated" | "forbidden" | "generic"

export type DeleteClienteResult =
  | { data: { id: string }; error?: undefined }
  | { data?: undefined; error: { code: DeleteClienteErrorCode } }

/**
 * Deletes a cliente (CLI-05/CLI-06). Supervisor-only: a non-Supervisor
 * caller is rejected here, before the DELETE is even attempted, but this
 * app-layer check is UX only — clientes' DELETE RLS policy from 02-01
 * (`using (is_supervisor())`) is the real boundary (T-02-18); a Vendedor
 * calling this Server Action directly (bypassing the hidden UI button)
 * would still be a no-op even if this check were somehow skipped.
 */
export async function deleteCliente(id: string): Promise<DeleteClienteResult> {
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

  const { data: deleted, error } = await supabase
    .from("clientes")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) {
    return { error: { code: "generic" } }
  }

  if (!deleted) {
    return { error: { code: "generic" } }
  }

  revalidatePath("/clientes")
  return { data: { id: deleted.id } }
}
