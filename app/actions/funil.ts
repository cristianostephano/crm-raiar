"use server"

import { revalidatePath } from "next/cache"

import { ETAPA_FINAL, type EtapaKey } from "@/lib/funil/etapas"
import { createClient } from "@/lib/supabase/server"
import {
  getHistorico,
  getMotivosPerdaAtivos,
  type HistoricoEntry,
  type LookupOption,
  type StatusAcompanhamento,
} from "@/lib/supabase/queries/clientes"

export type MoverCardErrorCode =
  | "cliente_nao_encontrado"
  | "ganho_travado"
  | "mover_falhou"

export type MoverCardResult =
  | { data: true; error?: undefined }
  | { data?: undefined; error: { code: MoverCardErrorCode; message: string } }

/**
 * Moves a cliente's funil card to a new stage/position (FUN-02/FUN-03),
 * calling the `mover_card_funil` RPC from 02-01 — never a raw client-side
 * UPDATE, so RLS on the underlying `clientes` UPDATE stays the single
 * authorization boundary (T-02-13).
 *
 * The pre-check SELECT below is scoped by the exact same RLS policy as the
 * UPDATE ("vendedor edita os proprios clientes, supervisor edita todos"'s
 * SELECT counterpart) — if a Vendedor's `clienteId` belongs to another
 * vendedor, this SELECT returns no row and the action fails closed with
 * `cliente_nao_encontrado` before ever calling the RPC. This is also where
 * the "ganho" edge case (T-02-14) is caught with a friendly message instead
 * of letting the DB CHECK constraint throw — the constraint remains the
 * real backstop if this guard is ever bypassed.
 */
export async function moverCard(
  clienteId: string,
  novaEtapa: EtapaKey,
  novaPosicao: number
): Promise<MoverCardResult> {
  const supabase = await createClient()

  const { data: cliente, error: fetchError } = await supabase
    .from("clientes")
    .select("status_acompanhamento")
    .eq("id", clienteId)
    .single()

  if (fetchError || !cliente) {
    return {
      error: {
        code: "cliente_nao_encontrado",
        message: "Não foi possível encontrar este cliente.",
      },
    }
  }

  if (
    cliente.status_acompanhamento === "ganho" &&
    novaEtapa !== "primeira_venda"
  ) {
    return {
      error: {
        code: "ganho_travado",
        message:
          'Este cliente já teve a "1ª venda concluída" — não é possível movê-lo para outra etapa.',
      },
    }
  }

  const { error } = await supabase.rpc("mover_card_funil", {
    p_cliente_id: clienteId,
    p_nova_etapa: novaEtapa,
    p_nova_posicao: novaPosicao,
  })

  if (error) {
    return {
      error: {
        code: "mover_falhou",
        message: "Não foi possível mover o card. Tente novamente.",
      },
    }
  }

  revalidatePath("/clientes")
  return { data: true }
}

export type MarcarStatusErrorCode =
  | "cliente_nao_encontrado"
  | "ganho_travado"
  | "motivo_obrigatorio"
  | "mover_falhou"

export type MarcarStatusResult =
  | { data: true; error?: undefined }
  | { data?: undefined; error: { code: MarcarStatusErrorCode; message: string } }

/**
 * Sets a cliente's status_acompanhamento (FUN-04) — "em andamento" / "perdido"
 * (requires motivoPerdaId, FUN-06) / "ganho" (only from ETAPA_FINAL, FUN-05).
 * Like moverCard, this ALWAYS routes through the `mover_card_funil` RPC
 * (never a raw `.update()` on clientes) so the 02-01 CHECK constraints stay
 * the real backstop — the pre-checks below only produce a friendlier error
 * code/message than letting the DB constraint throw. The RPC is called with
 * the card's CURRENT etapa (a status-only change never moves the card
 * between columns), so the AFTER UPDATE trigger writes exactly one
 * historico row for the status change (FUN-10) — this action never inserts
 * into `historico` itself (T-02-25).
 */
export async function marcarStatus(
  clienteId: string,
  novoStatus: StatusAcompanhamento,
  motivoPerdaId?: string
): Promise<MarcarStatusResult> {
  const supabase = await createClient()

  const { data: cliente, error: fetchError } = await supabase
    .from("clientes")
    .select("etapa")
    .eq("id", clienteId)
    .single()

  if (fetchError || !cliente) {
    return {
      error: {
        code: "cliente_nao_encontrado",
        message: "Não foi possível encontrar este cliente.",
      },
    }
  }

  if (novoStatus === "ganho" && cliente.etapa !== ETAPA_FINAL) {
    return {
      error: {
        code: "ganho_travado",
        message:
          'Só é possível marcar como ganho na etapa "1ª venda concluída".',
      },
    }
  }

  if (novoStatus === "perdido" && !motivoPerdaId) {
    return {
      error: {
        code: "motivo_obrigatorio",
        message: "Selecione o motivo da perda antes de salvar.",
      },
    }
  }

  const { error } = await supabase.rpc("mover_card_funil", {
    p_cliente_id: clienteId,
    p_nova_etapa: cliente.etapa,
    p_novo_status: novoStatus,
    p_motivo_perda_id: novoStatus === "perdido" ? motivoPerdaId : null,
  })

  if (error) {
    return {
      error: {
        code: "mover_falhou",
        message: "Não foi possível salvar as alterações. Tente novamente.",
      },
    }
  }

  revalidatePath("/clientes")
  return { data: true }
}

export type GetHistoricoResult =
  | { data: HistoricoEntry[]; error?: undefined }
  | { data?: undefined; error: { code: "unauthenticated" } }

/**
 * Thin Server Action wrapper around getHistorico() (T-02-21's pattern) —
 * ClienteDetailSheet is a Client Component and getHistorico() needs
 * next/headers' cookies() via lib/supabase/server.ts's createClient().
 */
export async function getHistoricoAction(
  clienteId: string
): Promise<GetHistoricoResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  return { data: await getHistorico(clienteId) }
}

export type GetMotivosPerdaResult =
  | { data: LookupOption[]; error?: undefined }
  | { data?: undefined; error: { code: "unauthenticated" } }

/** Server Action wrapper around getMotivosPerdaAtivos(), for
 * PerdaMotivoDialog's required "Motivo da perda" Select (FUN-06). */
export async function getMotivosPerda(): Promise<GetMotivosPerdaResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  return { data: await getMotivosPerdaAtivos() }
}
