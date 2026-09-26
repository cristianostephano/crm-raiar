"use server"

import {
  validarPeriodoEncerrados,
  type ClienteEncerrado,
  type IntervaloEncerrados,
} from "@/lib/encerrados/lista"
import {
  getClientesEncerrados,
  getMotivosEncerramentoAtivos,
} from "@/lib/supabase/queries/encerrados"
import { createClient } from "@/lib/supabase/server"
import type { LookupOption } from "@/lib/supabase/queries/clientes"

/**
 * Embrulho fino que a tela Encerrados (plano 29-06) chama a partir do
 * navegador conforme troca o período e depois de cada "Reativar" (D-10), e
 * que o diálogo de encerrar (plano 29-06/29-07) chama para popular o Select
 * de motivo — mesmo formato da tela irmã de perdas da Fase 28 e do catálogo
 * de motivos de perda de app/actions/funil.ts (getMotivosPerda), módulos
 * irmãos, sem import cruzado (Pitfall 4). Checa sessão, valida o período
 * recebido (vindo do navegador, portanto não confiável) e delega a leitura
 * paginada ao leitor. Sem revalidação de rota: leitura pura, recarregada
 * pelo próprio reloadKey da tela.
 *
 * D-10: NÃO existe ação de reativar neste arquivo. A tela reativa chamando
 * diretamente a ação de troca de status já existente em app/actions/funil.ts
 * (marcarStatus) — não criar uma ação paralela aqui depois.
 */

export type ClientesEncerradosErrorCode =
  | "unauthenticated"
  | "periodo_invalido"
  | "fetch_falhou"

export type GetClientesEncerradosResult =
  | { data: ClienteEncerrado[]; error?: undefined }
  | { data?: undefined; error: { code: ClientesEncerradosErrorCode; message: string } }

export async function getClientesEncerradosAction(
  intervalo: IntervaloEncerrados
): Promise<GetClientesEncerradosResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  const validacao = validarPeriodoEncerrados(intervalo)
  if (!validacao.valido) {
    return { error: { code: "periodo_invalido", message: validacao.message } }
  }

  try {
    return { data: await getClientesEncerrados(validacao.intervalo) }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message: "Não foi possível carregar os clientes encerrados. Tente novamente.",
      },
    }
  }
}

export type GetMotivosEncerramentoResult =
  | { data: LookupOption[]; error?: undefined }
  | { data?: undefined; error: { code: "unauthenticated" } }

/** Server Action wrapper around getMotivosEncerramentoAtivos(), para o
 * Select "Motivo do encerramento" (ENCR-02) — irmã de getMotivosPerda. */
export async function getMotivosEncerramento(): Promise<GetMotivosEncerramentoResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  return { data: await getMotivosEncerramentoAtivos() }
}
