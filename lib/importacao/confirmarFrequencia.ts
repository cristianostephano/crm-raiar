import { isFrequenciaVisita, type FrequenciaVisita } from "@/lib/funil/frequencia"
import type { PuladaGroup } from "@/lib/importacao/confirmar"
import type { ValidatedRowFrequencia } from "@/app/actions/importacaoFrequencia"

/**
 * Confirm-time accounting for the frequência-de-visita batch write (Fase 17,
 * IMP-01, D4/critério 3). Pure module — no Supabase client, no client/server
 * component directive — importando o tipo da linha validada do arquivo de
 * ações só como TIPO, mesma disciplina de lib/importacao/confirmar.ts. Reusa
 * o tipo de grupo de motivos de lib/importacao/confirmar.ts — nunca declara
 * um segundo.
 *
 * `planConfirmacaoFrequencia` decide exatamente quais linhas revisadas
 * viram a carga da RPC atualizar_frequencia_visita_lote e agrupa toda linha
 * excluída sob o vocabulário de motivos do resumo. `reconciliarFrequencia`
 * funde o que a RPC de fato devolveu contra o que foi enviado — a única
 * forma honesta de descobrir que um cliente deixou de estar apto entre a
 * revisão e a confirmação.
 *
 * Nada aqui persiste em lugar nenhum: os grupos de puladas só existem no
 * valor de retorno desta requisição.
 */

/** Motivo de repetição — ADIÇÃO consciente ao contrato de copy aprovado
 * (lacuna L2): sem deduplicar por identificador, a instrução em lote
 * escolheria arbitrariamente qual frequência gravar quando a planilha
 * trouxesse o mesmo cliente duas vezes com valores diferentes. */
const CLIENTE_REPETIDO_REASON =
  "Cliente repetido na planilha — só a primeira linha foi considerada"

/** Motivo de corrida entre revisão e confirmação — análogo exato do que
 * lib/importacao/confirmar.ts já cobre para a inserção, aqui para a
 * atualização: o cliente deixou de estar "ganho" no intervalo. */
const CLIENTE_NAO_MAIS_APTO_REASON =
  "Cliente não estava mais apto no momento da gravação"

/** Rede de segurança: uma linha "ok" com identificador ou frequência nulos
 * não deveria existir (a anotação já garante isso), mas nunca deve virar
 * carga se acontecer. */
const LINHA_INCONSISTENTE_REASON =
  "Linha marcada como pronta, mas com dado incompleto — pulada por segurança"

/** Re-validação defensiva (T-17-24): o dado voltou do navegador depois da
 * revisão — uma conversão de tipo malsucedida aqui não pode abortar o lote
 * inteiro dentro do banco. */
const FREQUENCIA_NAO_RECONHECIDA_NA_CONFIRMACAO_REASON =
  "Frequência não reconhecida no momento da confirmação — pulada por segurança"

/** Chaves exatas que atualizar_frequencia_visita_lote's jsonb_to_recordset
 * espera (supabase/migrations/0017_atualizar_frequencia_visita_lote.sql). */
export type RpcFrequenciaRow = {
  id: string
  frequencia_visita: FrequenciaVisita
}

export type PlanConfirmacaoFrequenciaResult = {
  carga: RpcFrequenciaRow[]
  puladas: PuladaGroup[]
  puladasCount: number
}

/**
 * Decide quais linhas revisadas viram a carga da RPC e por que o resto é
 * pulado.
 *
 * Classificação, em ordem:
 * - status "erro" → pulada; cada motivo da linha conta no seu próprio grupo,
 *   a linha conta uma vez só no total (mesma contabilidade de confirmar.ts).
 * - "ok" com identificador ou frequência nulos → pulada por segurança
 *   (LINHA_INCONSISTENTE_REASON). Não deveria acontecer, é a rede.
 * - re-validação defensiva da frequência com o guarda de tipo do módulo
 *   único ANTES de entrar na carga.
 * - linhas apontando para o MESMO identificador de cliente (lacuna L2): a
 *   primeira ocorrência entra na carga, as demais são puladas sob o motivo
 *   de repetição — mesma convenção "primeira ocorrência vence" da detecção
 *   de duplicados da v1.1.
 */
export function planConfirmacaoFrequencia(
  linhas: ValidatedRowFrequencia[]
): PlanConfirmacaoFrequenciaResult {
  const skippedRows = new Set<number>()
  const reasonCounts = new Map<string, number>()

  function addSkip(row: number, reason: string): void {
    skippedRows.add(row)
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
  }

  const candidatos: { row: number; entrada: RpcFrequenciaRow }[] = []

  for (const linha of linhas) {
    if (linha.status === "erro") {
      for (const reason of linha.reasons) {
        addSkip(linha.row, reason)
      }
      continue
    }

    const { clienteId, frequenciaVisita } = linha.resolved
    if (!clienteId || !frequenciaVisita) {
      addSkip(linha.row, LINHA_INCONSISTENTE_REASON)
      continue
    }

    if (!isFrequenciaVisita(frequenciaVisita)) {
      addSkip(linha.row, FREQUENCIA_NAO_RECONHECIDA_NA_CONFIRMACAO_REASON)
      continue
    }

    candidatos.push({
      row: linha.row,
      entrada: { id: clienteId, frequencia_visita: frequenciaVisita },
    })
  }

  // Lacuna L2: a ordem de entrada em `linhas` define quem é a primeira.
  const vistos = new Set<string>()
  const carga: RpcFrequenciaRow[] = []

  for (const candidato of candidatos) {
    if (vistos.has(candidato.entrada.id)) {
      addSkip(candidato.row, CLIENTE_REPETIDO_REASON)
      continue
    }
    vistos.add(candidato.entrada.id)
    carga.push(candidato.entrada)
  }

  const puladas: PuladaGroup[] = Array.from(reasonCounts.entries()).map(
    ([motivo, quantidade]) => ({ motivo, quantidade })
  )

  return { carga, puladas, puladasCount: skippedRows.size }
}

export type ReconciliarFrequenciaResult = {
  atualizados: { razaoSocial: string }[]
  puladasExtra: PuladaGroup[]
}

/**
 * Funde o que a RPC de fato devolveu (id + razão social do banco) contra o
 * que foi enviado — tudo que foi enviado e não voltou vira pulada sob o
 * motivo de "deixou de estar apto", nunca um erro genérico. Análogo exato de
 * reconcileImportados (lib/importacao/confirmar.ts) para uma UPDATE em vez
 * de um INSERT.
 */
export function reconciliarFrequencia(
  carga: RpcFrequenciaRow[],
  retornados: { id: string; razaoSocial: string }[]
): ReconciliarFrequenciaResult {
  const razaoSocialPorId = new Map(
    retornados.map((retornado) => [retornado.id, retornado.razaoSocial])
  )

  const atualizados: { razaoSocial: string }[] = []
  let naoMaisAptoCount = 0

  for (const entrada of carga) {
    const razaoSocial = razaoSocialPorId.get(entrada.id)
    if (razaoSocial !== undefined) {
      atualizados.push({ razaoSocial })
    } else {
      naoMaisAptoCount++
    }
  }

  const puladasExtra: PuladaGroup[] =
    naoMaisAptoCount > 0
      ? [{ motivo: CLIENTE_NAO_MAIS_APTO_REASON, quantidade: naoMaisAptoCount }]
      : []

  return { atualizados, puladasExtra }
}

/**
 * Funde dois conjuntos de grupos de motivos somando quantidade por motivo —
 * mesma lógica que hoje é privada em app/actions/importacao.ts; aqui nasce
 * EXPORTADA do módulo puro, para poder ser testada (Task 3, item 4 do
 * plano).
 */
export function fundirGruposDeMotivos(
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
