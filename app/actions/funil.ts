"use server"

import { revalidatePath } from "next/cache"

import { ETAPA_FINAL, type EtapaKey } from "@/lib/funil/etapas"
import {
  camposFaltandoParaGanho,
  mensagemFichaIncompleta,
} from "@/lib/funil/fichaParaGanho"
import {
  isFrequenciaVisita,
  type FrequenciaVisita,
} from "@/lib/funil/frequencia"
import { createClient } from "@/lib/supabase/server"
import {
  getDiario,
  getHistorico,
  getMotivosPerdaAtivos,
  type DiarioEntry,
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
  | "frequencia_obrigatoria"
  | "cnpj_obrigatorio"
  | "ficha_incompleta"
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
 *
 * CNPJ-01/CNPJ-02 (18-02): a quinta chamada opcional carrega o CNPJ digitado
 * no diálogo de ganho. `status_acompanhamento` entra no mesmo `select` de
 * `etapa` acima só para esta pré-checagem saber se a chamada é uma
 * TRANSIÇÃO para ganho (cliente ainda não é ganho) ou uma reafirmação num
 * cliente que já é ganho — é a mesma condição do guard do RPC (18-01), para
 * a tela nunca cobrar CNPJ de quem já é ganho (grandfathering).
 *
 * GANHO-01/GANHO-02 (23-02): mesma relação cortesia/backstop do CNPJ acima,
 * agora para razão social e endereço completo. O guard REAL é o de
 * `mover_card_funil` (migration 0025, plano 23-01) — sem esta pré-checagem
 * a exceção do Postgres cairia crua no "Não foi possível salvar as
 * alterações. Tente novamente." abaixo, e o vendedor não descobriria qual
 * campo falta. `lib/funil/fichaParaGanho.ts` é a autoridade única dessa
 * regra do lado TypeScript e precisa concordar campo por campo com o guard
 * do banco — ver o cabeçalho daquele módulo.
 */
export async function marcarStatus(
  clienteId: string,
  novoStatus: StatusAcompanhamento,
  motivoPerdaId?: string,
  frequenciaVisita?: FrequenciaVisita,
  cnpj?: string
): Promise<MarcarStatusResult> {
  const supabase = await createClient()

  const { data: cliente, error: fetchError } = await supabase
    .from("clientes")
    .select(
      "etapa, status_acompanhamento, cnpj, razao_social, cep, rua, numero, cidade, estado"
    )
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

  // Pré-checagem apenas para uma mensagem mais amigável: o guard REAL é o
  // do RPC `mover_card_funil` (13-01, migration 0013), que continua sendo o
  // backstop se este caminho for contornado — mesma relação já documentada
  // acima entre as pré-checagens e as CHECK constraints.
  if (
    novoStatus === "ganho" &&
    !isFrequenciaVisita(frequenciaVisita)
  ) {
    return {
      error: {
        code: "frequencia_obrigatoria",
        message: "Selecione a frequência de visita antes de confirmar.",
      },
    }
  }

  const cnpjEfetivo = (cnpj?.trim() || cliente.cnpj?.trim()) ?? ""

  // Mesma relação cortesia/backstop acima: só reprova aqui quando o CNPJ
  // EFETIVO (parâmetro OU coluna já gravada, ambos aparados) está vazio —
  // nunca só o parâmetro, senão esta pré-checagem bloquearia uma chamada
  // que o RPC (18-01) aceitaria (cliente que já tem CNPJ na ficha e não
  // reenviou o valor). E só na TRANSIÇÃO para ganho: um cliente que já é
  // ganho (grandfathering, CNPJ-02) nunca é cobrado aqui.
  if (
    novoStatus === "ganho" &&
    cliente.status_acompanhamento !== "ganho" &&
    !cnpjEfetivo
  ) {
    return {
      error: {
        code: "cnpj_obrigatorio",
        message: "Informe o CNPJ antes de confirmar.",
      },
    }
  }

  // Mesma relação cortesia/backstop das pré-checagens acima (GANHO-01/
  // GANHO-02, 23-02): o guard REAL é o de `mover_card_funil` (migration
  // 0025). Só reprova aqui na TRANSIÇÃO para ganho (status atual diferente
  // de "ganho" — grandfathering, mesma condição do guard do banco), e só
  // quando a ficha realmente está incompleta.
  if (novoStatus === "ganho" && cliente.status_acompanhamento !== "ganho") {
    const camposFaltando = camposFaltandoParaGanho(cliente)

    if (camposFaltando.length > 0) {
      return {
        error: {
          code: "ficha_incompleta",
          message: mensagemFichaIncompleta(camposFaltando),
        },
      }
    }
  }

  const { error } = await supabase.rpc("mover_card_funil", {
    p_cliente_id: clienteId,
    p_nova_etapa: cliente.etapa,
    p_novo_status: novoStatus,
    p_motivo_perda_id: novoStatus === "perdido" ? motivoPerdaId : null,
    p_frequencia_visita: novoStatus === "ganho" ? frequenciaVisita : null,
    p_cnpj: novoStatus === "ganho" ? (cnpj?.trim() || null) : null,
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

export type GetDiarioResult =
  | { data: DiarioEntry[]; error?: undefined }
  | { data?: undefined; error: { code: "unauthenticated" } }

/**
 * Thin Server Action wrapper around getDiario() (DIAR-01) — mesmo molde
 * literal de getHistoricoAction acima: checa usuário autenticado e senão
 * devolve o resultado da consulta. Nenhuma checagem de papel — a regra de
 * leitura da trilha de auditoria (migration 0002) é a fronteira real.
 */
export async function getDiarioAction(
  clienteId: string
): Promise<GetDiarioResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  return { data: await getDiario(clienteId) }
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
