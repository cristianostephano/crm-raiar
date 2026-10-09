"use server"

import { validarPeriodoGanhos, type ClienteGanho, type IntervaloGanhos } from "@/lib/ganhos/lista"
import { getClientesGanhos } from "@/lib/supabase/queries/ganhos"
import { createClient } from "@/lib/supabase/server"

/**
 * Embrulho fino que a tela Ganhos (quick 261008-rxw) chama a partir do
 * navegador conforme troca o período e depois de salvar, apagar ou encerrar
 * pela ficha — mesmo formato de getClientesPerdidosAction. Checa sessão,
 * valida o período recebido (vindo do navegador, portanto não confiável) e
 * delega a leitura paginada ao leitor. Sem revalidação de rota: leitura pura,
 * recarregada pelo próprio reloadKey da tela.
 *
 * Só leitura (P-03): não existe ação de reabrir nem de "desganhar" aqui; a
 * saída de um cliente ganho é "Encerrar", que mora dentro da ficha.
 */

export type ClientesGanhosErrorCode =
  | "unauthenticated"
  | "periodo_invalido"
  | "fetch_falhou"

export type GetClientesGanhosResult =
  | { data: ClienteGanho[]; error?: undefined }
  | { data?: undefined; error: { code: ClientesGanhosErrorCode; message: string } }

export async function getClientesGanhosAction(
  intervalo: IntervaloGanhos
): Promise<GetClientesGanhosResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated", message: "Sessão expirada." } }
  }

  const validacao = validarPeriodoGanhos(intervalo)
  if (!validacao.valido) {
    return { error: { code: "periodo_invalido", message: validacao.message } }
  }

  try {
    return { data: await getClientesGanhos(validacao.intervalo) }
  } catch {
    return {
      error: {
        code: "fetch_falhou",
        message: "Não foi possível carregar os clientes ganhos. Tente novamente.",
      },
    }
  }
}
