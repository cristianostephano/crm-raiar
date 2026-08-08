"use server"

import type { AgendaItem } from "@/lib/agenda/itens"
import { getAgenda } from "@/lib/supabase/queries/agenda"
import { createClient } from "@/lib/supabase/server"

/**
 * Embrulho fino que o Client Component da Agenda (plano 14-03) chama:
 * `getAgenda()` depende de `cookies()` via lib/supabase/server.ts, então só
 * pode ser invocada a partir daqui.
 *
 * Fase de LEITURA PURA — nenhuma revalidação de cache, nenhuma mutação
 * neste arquivo. O fluxo de conclusão (resumo + próxima data) é da Fase 15
 * e não pode ser antecipado aqui.
 *
 * `getAgendaPendentesCount()` não tem Server Action própria: o menu é
 * renderizado por Server Component (plano 14-04) e chama a query
 * diretamente.
 */

export type AgendaErrorCode = "unauthenticated" | "fetch_falhou"

export type GetAgendaResult =
  | { data: AgendaItem[]; error?: undefined }
  | { data?: undefined; error: { code: AgendaErrorCode; message: string } }

export async function getAgendaAction(): Promise<GetAgendaResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  try {
    return { data: await getAgenda() }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message: "Não foi possível carregar sua agenda. Tente novamente.",
      },
    }
  }
}
