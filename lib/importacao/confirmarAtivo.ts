import {
  DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON,
  toRpcClienteRow,
  type PuladaGroup,
  type RpcClienteRow,
} from "@/lib/importacao/confirmar"

/**
 * Confirm-time accounting for the "Importar clientes ativos" batch write
 * (Fase 25 Plano 2, ATIVO-03/ATIVO-04). Pure module — no Supabase import, no
 * "use server"/"use client" directive — mesma disciplina de
 * lib/importacao/confirmarCnpj.ts.
 *
 * Reusa `toRpcClienteRow` e `DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON` de
 * lib/importacao/confirmar.ts (a mesma conversão de linha resolvida + o
 * mesmo vocabulário de motivo já usados pela importação de clientes), nunca
 * uma segunda cópia que só concordaria por convenção.
 *
 * `fundirGruposDeMotivosAtivos` é declarada LOCALMENTE, não importada do
 * fluxo de CNPJ de propósito: a Fase 26 vai remover as telas antigas de
 * importação, e criar dependência de um módulo que pode desaparecer
 * transformaria uma limpeza de menu numa quebra de compilação.
 */

/** Linha devolvida por `importar_clientes_ativos_lote` (migration 0027) —
 * razão social, identificador possivelmente nulo, e a situação classificada
 * pelo banco. */
export type RpcRetornoAtivo = {
  razao_social: string
  id: string | null
  status: "inserido" | "duplicado" | "incompleto"
}

/** Motivo de rede de segurança: uma linha nesse estado deveria ter sido
 * barrada na revisão (SYSTEM_FIELDS_ATIVO já exige os mesmos 9 campos que a
 * RPC exige) — se aparecer aqui, houve mudança de dado entre revisar e
 * confirmar. */
export const DADO_OBRIGATORIO_FALTANDO_AO_GRAVAR_REASON =
  "Dado obrigatório faltando ao gravar — verifique razão social, CNPJ ou endereço completo"

export type ReconciliarAtivosResult = {
  importados: { razaoSocial: string }[]
  puladas: PuladaGroup[]
}

/**
 * Percorre a carga na ordem, casando cada item com uma entrada do retorno
 * que ainda não foi consumida (conjunto de consumidos, para que duas linhas
 * com a mesma razão social nunca contem duas inserções).
 *
 * - inserido → importado
 * - duplicado → pulado sob DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON
 * - incompleto → pulado sob DADO_OBRIGATORIO_FALTANDO_AO_GRAVAR_REASON
 * - ausência total de casamento → pulado sob
 *   DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON (mesmo tratamento defensivo que
 *   reconcileImportados já dá hoje)
 */
export function reconciliarAtivos(
  carga: RpcClienteRow[],
  retornados: RpcRetornoAtivo[]
): ReconciliarAtivosResult {
  const consumidos = new Set<number>()
  const importados: { razaoSocial: string }[] = []
  const reasonCounts = new Map<string, number>()

  function addSkip(reason: string): void {
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
  }

  for (const item of carga) {
    const indexRetorno = retornados.findIndex(
      (retorno, index) =>
        !consumidos.has(index) && retorno.razao_social === item.razao_social
    )

    if (indexRetorno === -1) {
      addSkip(DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON)
      continue
    }

    consumidos.add(indexRetorno)
    const retorno = retornados[indexRetorno]

    if (retorno.status === "inserido") {
      importados.push({ razaoSocial: item.razao_social })
    } else if (retorno.status === "duplicado") {
      addSkip(DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON)
    } else {
      addSkip(DADO_OBRIGATORIO_FALTANDO_AO_GRAVAR_REASON)
    }
  }

  const puladas: PuladaGroup[] = Array.from(reasonCounts.entries()).map(
    ([motivo, quantidade]) => ({ motivo, quantidade })
  )

  return { importados, puladas }
}

/** Funde dois conjuntos de grupos de motivos, somando quantidades por texto
 * de motivo — declarada localmente, não importada de confirmarCnpj.ts (ver
 * justificativa acima). */
export function fundirGruposDeMotivosAtivos(
  a: PuladaGroup[],
  b: PuladaGroup[]
): PuladaGroup[] {
  const merged = new Map<string, number>()

  for (const { motivo, quantidade } of [...a, ...b]) {
    merged.set(motivo, (merged.get(motivo) ?? 0) + quantidade)
  }

  return Array.from(merged.entries()).map(([motivo, quantidade]) => ({
    motivo,
    quantidade,
  }))
}

export { toRpcClienteRow }
export type { RpcClienteRow }
