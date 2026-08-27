"use server"

// Import de namespace (não nomeado) só para este módulo: a chamada de
// invalidação de cache do Next só acontece já dentro do próprio corpo da
// função que faz a chamada à RPC em massa — mesma convenção mecânica de
// app/actions/importacaoCnpj.ts, reforçando que a ação de validação nunca
// invalida cache nem escreve.
import * as nextCache from "next/cache"

import { annotarLoteAtivos } from "@/lib/importacao/annotarLinhaAtivo"
import {
  type AnnotarLinhaLookups,
  type MappedRow,
  type ResolvedRow,
  type VendedorLookup,
} from "@/lib/importacao/annotarLinha"
import { planConfirmacao } from "@/lib/importacao/confirmar"
import {
  fundirGruposDeMotivosAtivos,
  reconciliarAtivos,
  type RpcRetornoAtivo,
} from "@/lib/importacao/confirmarAtivo"
import { findDuplicates } from "@/lib/importacao/dedupe"
import { nomesExistentesParaDedupe } from "@/lib/importacao/existentes"
import { createClient } from "@/lib/supabase/server"
import { getCategoriasAtivas, getProdutosAtivos } from "@/lib/supabase/queries/clientes"
import { getTodasCidades } from "@/lib/supabase/queries/cidades"
import type { PuladaGroup } from "@/lib/importacao/confirmar"

export type LoteAtivosErrorCode = "unauthenticated" | "forbidden" | "generic"

export type ValidatedRowAtivoStatus = "ok" | "duplicado" | "erro"

/** Uma linha validada para a tela de revisão do plano 25-03 — status
 * precedence é erro > duplicado > ok (mesma disciplina de
 * validarLoteImportacao), campo a campo idêntico a `ValidatedRow`
 * (app/actions/importacao.ts) de propósito: é essa igualdade estrutural que
 * permite passar `linhas` direto para `planConfirmacao` sem conversão. */
export type ValidatedRowAtivo = {
  row: number
  status: ValidatedRowAtivoStatus
  reasons: string[]
  similarTo?: string
  resolved: ResolvedRow
}

export type ValidarLoteAtivosResult =
  | { data: { linhas: ValidatedRowAtivo[] }; error?: undefined }
  | { data?: undefined; error: { code: LoteAtivosErrorCode } }

/**
 * Ação de validação, SOMENTE LEITURA (ATIVO-03/ATIVO-04): nunca escreve nem
 * invalida cache. Abertura idêntica às ações irmãs — sessão, depois papel de
 * supervisor, ANTES de qualquer leitura de dado; só então qualquer leitura.
 */
export async function validarLoteAtivos(
  linhas: MappedRow[]
): Promise<ValidarLoteAtivosResult> {
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

  // `linhas` são dado enviado pelo cliente (as linhas mapeadas da planilha),
  // nunca entrada de autorização — o gate de supervisor acima é a única
  // barreira nesta ação, mesma postura de validarLoteImportacao.
  const [categorias, produtos, vendedoresResult, existentesResult, cidades] =
    await Promise.all([
      getCategoriasAtivas(),
      getProdutosAtivos(),
      supabase.from("profiles").select("id, nome, sobrenome, email"),
      // Consulta estreita, sem NENHUM filtro manual de dono — para o
      // Supervisor a regra de leitura de clientes já devolve a base inteira,
      // exatamente o conjunto que a detecção de duplicado (ATIVO-04) precisa.
      supabase.from("clientes").select("razao_social"),
      // Leitor paginado obrigatório (mesmo bug já corrigido uma vez neste
      // projeto): a tabela cidades tem 5571 linhas e um select direto trunca
      // em 1000, fazendo a validação rejeitar cidade real.
      getTodasCidades(),
    ])

  if (vendedoresResult.error || existentesResult.error || cidades === null) {
    return { error: { code: "generic" } }
  }

  const vendedores: VendedorLookup[] = (vendedoresResult.data ?? []).map((row) => ({
    id: row.id as string,
    nome: row.nome as string,
    sobrenome: row.sobrenome as string,
    email: row.email as string,
  }))

  const lookups: AnnotarLinhaLookups = { vendedores, categorias, produtos, cidades }

  // Fase 26 Plano 3 (T-26-08): substitui a conversão de tipo não checada
  // pelo módulo tolerante a nulo, mesmo conserto de validarLoteImportacao.
  // Diferença deliberada dos dois fluxos: o de clientes ativos NÃO ganha
  // comparação por Nome Fantasia — o vocabulário de clientes ativos exige
  // razão social em toda linha, então a chave de reserva não tem uso aqui.
  const { razoesSociais: existentes } = nomesExistentesParaDedupe(
    existentesResult.data ?? []
  )

  const annotated = annotarLoteAtivos(linhas, lookups)

  const batchForDedupe = annotated.map((annotatedRow, index) => ({
    row: index,
    razaoSocial: annotatedRow.resolved.razaoSocial,
  }))

  const duplicates = findDuplicates(batchForDedupe, existentes)

  // Precedência: erro > duplicado > ok — uma linha que já falhou a checagem
  // de campo obrigatório/lookup nunca é promovida a "duplicado".
  const result: ValidatedRowAtivo[] = annotated.map((annotatedRow, index) => {
    if (annotatedRow.status === "erro") {
      return {
        row: index,
        status: "erro",
        reasons: annotatedRow.reasons,
        resolved: annotatedRow.resolved,
      }
    }

    const similarTo = duplicates.get(index)
    if (similarTo) {
      return {
        row: index,
        status: "duplicado",
        reasons: [`Possível duplicado de "${similarTo}"`],
        similarTo,
        resolved: annotatedRow.resolved,
      }
    }

    return {
      row: index,
      status: "ok",
      reasons: [],
      resolved: annotatedRow.resolved,
    }
  })

  return { data: { linhas: result } }
}

export type ConfirmarLoteAtivosResult =
  | {
      data: {
        importados: { razaoSocial: string }[]
        puladas: PuladaGroup[]
      }
      error?: undefined
    }
  | { data?: undefined; error: { code: LoteAtivosErrorCode } }

/**
 * Ação de confirmação (ATIVO-02/ATIVO-03): mesma abertura de sessão/papel de
 * validarLoteAtivos, reler as razões sociais existentes (mesma consulta
 * estreita), planejar a carga com `planConfirmacao` reusada VERBATIM de
 * lib/importacao/confirmar.ts (nunca copiada), chamar
 * `importar_clientes_ativos_lote` EXATAMENTE uma vez com o lote inteiro,
 * reconciliar com `reconciliarAtivos`, fundir os grupos de motivos e
 * invalidar o cache da tela de clientes.
 */
export async function confirmarLoteAtivos(
  linhas: ValidatedRowAtivo[],
  decisoes: Record<number, "importar" | "pular">
): Promise<ConfirmarLoteAtivosResult> {
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

  // D-02-equivalente (ATIVO-04) revalidation read — mesma consulta estreita,
  // RLS-escopada, de validarLoteAtivos.
  const existentesResult = await supabase.from("clientes").select("razao_social")

  if (existentesResult.error) {
    return { error: { code: "generic" } }
  }

  // Fase 26 Plano 3 (T-26-08): mesma substituição da conversão de tipo não
  // checada; a consulta acima continua trazendo só razão social, de
  // propósito (ver comentário em validarLoteAtivos).
  const { razoesSociais: existentesRazaoSocial } = nomesExistentesParaDedupe(
    existentesResult.data ?? []
  )

  const { rowsToInsert, puladas } = planConfirmacao(
    linhas,
    decisoes,
    existentesRazaoSocial
  )

  if (rowsToInsert.length === 0) {
    return { data: { importados: [], puladas } }
  }

  const { data: retornados, error: rpcError } = await supabase.rpc(
    "importar_clientes_ativos_lote",
    { p_clientes: rowsToInsert }
  )

  if (rpcError) {
    return { error: { code: "generic" } }
  }

  const retornadosTipados = (retornados ?? []) as RpcRetornoAtivo[]

  const { importados, puladas: puladasReconciliadas } = reconciliarAtivos(
    rowsToInsert,
    retornadosTipados
  )

  const puladasFinal = fundirGruposDeMotivosAtivos(puladas, puladasReconciliadas)

  nextCache.revalidatePath("/clientes")

  return { data: { importados, puladas: puladasFinal } }
}
