"use server"

// Import de namespace (não nomeado) só para este módulo: a chamada de
// invalidação de cache do Next só acontece já dentro do próprio corpo da
// função que faz a chamada à RPC em massa — mantém o nome dessa função de
// cache fora de qualquer parte do arquivo que precede a ação de validação,
// reforçando mecanicamente (não só por convenção) que a ação de validação
// nunca invalida cache nem escreve.
import * as nextCache from "next/cache"

import {
  annotarLoteCnpj,
  type ClienteCnpjLookup,
  type MappedRowCnpj,
  type ResolvedRowCnpj,
} from "@/lib/importacao/annotarLinhaCnpj"
import {
  fundirGruposDeMotivos,
  planConfirmacaoCnpj,
  reconciliarCnpj,
} from "@/lib/importacao/confirmarCnpj"
import type { PuladaGroup } from "@/lib/importacao/confirmar"
import { createClient } from "@/lib/supabase/server"

export type CnpjLoteErrorCode = "unauthenticated" | "forbidden" | "generic"

/** Uma linha validada para a tela de revisão (IMP-03) — status é sempre
 * "ok" ou "erro" (este fluxo não tem o estado "duplicado" da importação de
 * clientes, por isso não há coluna de Ação nem decisão por linha). */
export type ValidatedRowCnpj = {
  row: number
  status: "ok" | "erro"
  reasons: string[]
  resolved: ResolvedRowCnpj
}

export type ValidarLoteCnpjResult =
  | { data: { linhas: ValidatedRowCnpj[] }; error?: undefined }
  | { data?: undefined; error: { code: CnpjLoteErrorCode } }

/**
 * Ação de validação, somente leitura (IMP-03): nunca escreve nada. Mesma
 * abertura de validarLoteFrequencia — checagem de sessão e de papel
 * (is_supervisor, lida da tabela de perfis) ANTES de qualquer leitura de
 * dado. Este check é conforto de interface; a trava real é o guard dentro
 * de atualizar_cnpj_lote (19-01).
 */
export async function validarLoteCnpj(
  linhas: MappedRowCnpj[]
): Promise<ValidarLoteCnpjResult> {
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

  // Leitura estreita e estreitada pela regra de leitura (RLS): para o
  // Supervisor, a policy de SELECT de clientes já devolve a base inteira —
  // NUNCA um filtro manual de dono aqui. O status precisa vir junto: sem
  // ele, a anotação não teria como explicar POR QUE um cliente encontrado
  // não está apto — filtrar por status na consulta transformaria "não é
  // ganho" em "não encontrado", uma mensagem errada.
  const clientesResult = await supabase
    .from("clientes")
    .select("id, razao_social, status_acompanhamento")

  if (clientesResult.error) {
    return { error: { code: "generic" } }
  }

  const clientes: ClienteCnpjLookup[] = (clientesResult.data ?? []).map(
    (row) => ({
      id: row.id as string,
      razaoSocial: row.razao_social as string,
      statusAcompanhamento:
        row.status_acompanhamento as ClienteCnpjLookup["statusAcompanhamento"],
    })
  )

  const anotadas = annotarLoteCnpj(linhas, clientes)

  const result: ValidatedRowCnpj[] = anotadas.map((linha, index) => ({
    row: index,
    status: linha.status,
    reasons: linha.reasons,
    resolved: linha.resolved,
  }))

  return { data: { linhas: result } }
}

export type ConfirmarLoteCnpjResult =
  | {
      data: {
        atualizados: { razaoSocial: string }[]
        puladas: PuladaGroup[]
      }
      error?: undefined
    }
  | { data?: undefined; error: { code: CnpjLoteErrorCode } }

/**
 * Ação de confirmação (IMP-03, critério de sucesso 3): mesma abertura de
 * sessão/papel de validarLoteCnpj; planeja a carga, faz UMA chamada à RPC
 * atualizar_cnpj_lote com o lote inteiro (nunca um laço), reconcilia o que
 * foi devolvido e funde os grupos de puladas. Nenhum identificador vem
 * direto de célula de planilha — os identificadores da carga são sempre os
 * que validarLoteCnpj resolveu contra o banco.
 */
export async function confirmarLoteCnpj(
  linhas: ValidatedRowCnpj[]
): Promise<ConfirmarLoteCnpjResult> {
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

  const { carga, puladas } = planConfirmacaoCnpj(linhas)

  if (carga.length === 0) {
    return { data: { atualizados: [], puladas } }
  }

  const { data: retornados, error: rpcError } = await supabase.rpc(
    "atualizar_cnpj_lote",
    { p_atualizacoes: carga }
  )

  if (rpcError) {
    return { error: { code: "generic" } }
  }

  const retornadosTipados = (retornados ?? []) as {
    id: string
    razao_social: string
  }[]

  const { atualizados, puladasExtra } = reconciliarCnpj(
    carga,
    retornadosTipados.map((row) => ({ id: row.id, razaoSocial: row.razao_social }))
  )

  const puladasFinal = fundirGruposDeMotivos(puladas, puladasExtra)

  nextCache.revalidatePath("/clientes")

  return { data: { atualizados, puladas: puladasFinal } }
}
