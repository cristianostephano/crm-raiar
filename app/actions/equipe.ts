"use server"

// Phase 10 (desativação de membro da equipe) — EQP-01, EQP-03.
//
// Postgres and Supabase Auth are two separate services that cannot share a
// transaction, so the two steps below are sequenced, never atomic: the
// Postgres RPC runs first (it is the primary control — RLS re-evaluates on
// every request via is_supervisor()'s `ativo = true` check, so a committed
// RPC already cuts the deactivated member off from every table), and the
// Auth Admin API ban runs second, only to additionally block a brand-new
// login/token-refresh attempt.

import { revalidatePath } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { mapRpcErrorToCode, type DesativarMembroResult } from "@/lib/equipe/erros"

export async function desativarMembroEquipe(
  profileId: string,
  novoResponsavelId: string
): Promise<DesativarMembroResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  // No role lookup here on purpose: unlike deleteCliente's app-layer
  // Supervisor check (a UX convenience only), this action's authorization
  // lives entirely inside the SECURITY DEFINER RPC's own first statement
  // (is_supervisor()). Duplicating that check here would create a second
  // place that could drift from the real boundary.
  const { data, error } = await supabase.rpc("desativar_membro_equipe", {
    p_profile_id: profileId,
    p_novo_responsavel_id: novoResponsavelId,
  })

  if (error) {
    return { error: { code: mapRpcErrorToCode(error.message), message: error.message } }
  }

  const admin = createAdminClient()
  const { error: banError } = await admin.auth.admin.updateUserById(profileId, {
    ban_duration: "876000h",
  })

  if (banError) {
    // The RPC has already committed, so the member is ALREADY deactivated
    // and already cut off at the RLS layer on their next request — only
    // the "block a brand-new login" layer failed. This is why "ban_failed"
    // is a distinct code from "rpc_failed": the UI flips the row to
    // Inativo and still shows a warning, per the UI-SPEC's partial-failure
    // copy, instead of pretending the whole deactivation failed.
    return { error: { code: "ban_failed" } }
  }

  revalidatePath("/equipe")
  // The RPC's bigint column can arrive as a string over the wire; the
  // Number(...) wrapper is deliberate since this count is interpolated
  // straight into a user-facing sentence.
  return { data: { clientesReatribuidos: Number(data?.[0]?.clientes_reatribuidos ?? 0) } }
}

export async function reativarMembroEquipe(
  profileId: string
): Promise<DesativarMembroResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  const { error } = await supabase.rpc("reativar_membro_equipe", {
    p_profile_id: profileId,
  })

  if (error) {
    return { error: { code: mapRpcErrorToCode(error.message), message: error.message } }
  }

  const admin = createAdminClient()
  const { error: banError } = await admin.auth.admin.updateUserById(profileId, {
    ban_duration: "none",
  })

  if (banError) {
    return { error: { code: "ban_failed" } }
  }

  revalidatePath("/equipe")
  // The zero count here is structural, not a placeholder: reactivation
  // transfers nothing back (D-02's deliberately low-friction framing), so
  // the caller's success message for reactivation never interpolates a
  // count at all.
  return { data: { clientesReatribuidos: 0 } }
}
