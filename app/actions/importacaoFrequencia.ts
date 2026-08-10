"use server"

import { revalidatePath } from "next/cache"

import {
  annotarLoteFrequencia,
  type ClienteFrequenciaLookup,
  type MappedRowFrequencia,
  type ResolvedRowFrequencia,
} from "@/lib/importacao/annotarLinhaFrequencia"
import {
  fundirGruposDeMotivos,
  planConfirmacaoFrequencia,
  reconciliarFrequencia,
} from "@/lib/importacao/confirmarFrequencia"
import type { PuladaGroup } from "@/lib/importacao/confirmar"
import { createClient } from "@/lib/supabase/server"

export type FrequenciaLoteErrorCode = "unauthenticated" | "forbidden" | "generic"

/** Uma linha validada para a tela de revisão (IMP-01) — status é sempre
 * "ok" ou "erro" (este fluxo não tem o estado "duplicado" da importação de
 * clientes, por isso não há coluna de Ação nem decisão por linha). */
export type ValidatedRowFrequencia = {
  row: number
  status: "ok" | "erro"
  reasons: string[]
  resolved: ResolvedRowFrequencia
}

export type ValidarLoteFrequenciaResult =
  | { data: { linhas: ValidatedRowFrequencia[] }; error?: undefined }
  | { data?: undefined; error: { code: FrequenciaLoteErrorCode } }

/**
 * Ação de validação, somente leitura (IMP-01): nunca escreve nada. Mesma
 * abertura de validarLoteImportacao — checagem de sessão e de papel
 * (is_supervisor, lida da tabela de perfis) ANTES de qualquer leitura de
 * dado. Este check é conforto de interface; a trava real é o guard dentro
 * de atualizar_frequencia_visita_lote (17-01).
 */
export async function validarLoteFrequencia(
  linhas: MappedRowFrequencia[]
): Promise<ValidarLoteFrequenciaResult> {
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

  const clientes: ClienteFrequenciaLookup[] = (clientesResult.data ?? []).map(
    (row) => ({
      id: row.id as string,
      razaoSocial: row.razao_social as string,
      statusAcompanhamento:
        row.status_acompanhamento as ClienteFrequenciaLookup["statusAcompanhamento"],
    })
  )

  const anotadas = annotarLoteFrequencia(linhas, clientes)

  const result: ValidatedRowFrequencia[] = anotadas.map((linha, index) => ({
    row: index,
    status: linha.status,
    reasons: linha.reasons,
    resolved: linha.resolved,
  }))

  return { data: { linhas: result } }
}

export type ConfirmarLoteFrequenciaResult =
  | {
      data: {
        atualizados: { razaoSocial: string }[]
        puladas: PuladaGroup[]
      }
      error?: undefined
    }
  | { data?: undefined; error: { code: FrequenciaLoteErrorCode } }

/**
 * Ação de confirmação (IMP-01, D4/critério de sucesso 3): mesma abertura de
 * sessão/papel de validarLoteFrequencia; planeja a carga, faz UMA chamada à
 * RPC atualizar_frequencia_visita_lote com o lote inteiro (nunca um laço),
 * reconcilia o que foi devolvido e funde os grupos de puladas. Nenhum
 * identificador vem direto de célula de planilha — os identificadores da
 * carga são sempre os que validarLoteFrequencia resolveu contra o banco.
 */
export async function confirmarLoteFrequencia(
  linhas: ValidatedRowFrequencia[]
): Promise<ConfirmarLoteFrequenciaResult> {
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

  const { carga, puladas } = planConfirmacaoFrequencia(linhas)

  if (carga.length === 0) {
    return { data: { atualizados: [], puladas } }
  }

  const { data: retornados, error: rpcError } = await supabase.rpc(
    "atualizar_frequencia_visita_lote",
    { p_atualizacoes: carga }
  )

  if (rpcError) {
    return { error: { code: "generic" } }
  }

  const retornadosTipados = (retornados ?? []) as {
    id: string
    razao_social: string
  }[]

  const { atualizados, puladasExtra } = reconciliarFrequencia(
    carga,
    retornadosTipados.map((row) => ({ id: row.id, razaoSocial: row.razao_social }))
  )

  const puladasFinal = fundirGruposDeMotivos(puladas, puladasExtra)

  revalidatePath("/clientes")

  return { data: { atualizados, puladas: puladasFinal } }
}
