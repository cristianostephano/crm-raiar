"use server"

import { revalidatePath } from "next/cache"

import type { EtapaKey } from "@/lib/funil/etapas"
import { createClient } from "@/lib/supabase/server"

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
