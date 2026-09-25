"use server"

import { validarPeriodoPerdidos, type ClientePerdido, type IntervaloPerdidos } from "@/lib/perdidos/lista"
import { getClientesPerdidos } from "@/lib/supabase/queries/perdidos"
import { createClient } from "@/lib/supabase/server"

/**
 * Embrulho fino que a tela Perdidos (plano 28-04) chama a partir do
 * navegador conforme troca o período e depois de cada "Reabrir" (D-09) —
 * mesmo formato de getAgendaAction/getClientesSemDiaFixoAction
 * (app/actions/agenda.ts). Checa sessão, valida o período recebido (vindo
 * do navegador, portanto não confiável) e delega a leitura paginada ao
 * leitor. Sem revalidação de rota: leitura pura, recarregada pelo próprio
 * reloadKey da tela.
 *
 * D-08: NÃO existe ação de reabrir neste arquivo. A tela reabre chamando
 * diretamente a ação de troca de status já existente em app/actions/funil.ts
 * — não criar uma ação paralela aqui depois.
 */

export type ClientesPerdidosErrorCode =
  | "unauthenticated"
  | "periodo_invalido"
  | "fetch_falhou"

export type GetClientesPerdidosResult =
  | { data: ClientePerdido[]; error?: undefined }
  | { data?: undefined; error: { code: ClientesPerdidosErrorCode; message: string } }

export async function getClientesPerdidosAction(
  intervalo: IntervaloPerdidos
): Promise<GetClientesPerdidosResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  const validacao = validarPeriodoPerdidos(intervalo)
  if (!validacao.valido) {
    return { error: { code: "periodo_invalido", message: validacao.message } }
  }

  try {
    return { data: await getClientesPerdidos(validacao.intervalo) }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message: "Não foi possível carregar os clientes perdidos. Tente novamente.",
      },
    }
  }
}
