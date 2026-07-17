"use server"

import { revalidatePath } from "next/cache"

import { createClienteSchema, type CreateClienteInput } from "@/lib/validations/cliente"
import { createClient } from "@/lib/supabase/server"

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
