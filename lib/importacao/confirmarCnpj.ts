import { fundirGruposDeMotivos } from "@/lib/importacao/confirmarFrequencia"
import type { PuladaGroup } from "@/lib/importacao/confirmar"
import type { ValidatedRowCnpj } from "@/app/actions/importacaoCnpj"

/**
 * Confirm-time accounting for the "CNPJ em massa" batch write (Fase 19,
 * IMP-03). Pure module — no Supabase client, no client/server component
 * directive — importando o tipo da linha validada do arquivo de ações só
 * como TIPO, mesma disciplina de lib/importacao/confirmarFrequencia.ts.
 * Reusa o tipo de grupo de motivos de lib/importacao/confirmar.ts e a
 * função de fusão já exportada por lib/importacao/confirmarFrequencia.ts —
 * nunca declara um segundo tipo nem uma segunda fusão.
 *
 * `planConfirmacaoCnpj` decide exatamente quais linhas revisadas viram a
 * carga da RPC atualizar_cnpj_lote e agrupa toda linha excluída sob o
 * vocabulário de motivos do resumo. `reconciliarCnpj` funde o que a RPC de
 * fato devolveu contra o que foi enviado — a única forma honesta de
 * descobrir que um cliente deixou de estar apto entre a revisão e a
 * confirmação.
 *
 * Nada aqui persiste em lugar nenhum: os grupos de puladas só existem no
 * valor de retorno desta requisição.
 */

/** Motivo de repetição — mesma lacuna do fluxo de frequência (L2): sem
 * deduplicar por identificador, a instrução em lote escolheria
 * arbitrariamente qual CNPJ gravar quando a planilha trouxesse o mesmo
 * cliente duas vezes. */
const CLIENTE_REPETIDO_REASON =
  "Cliente repetido na planilha — só a primeira linha foi considerada"

/** Motivo de corrida entre revisão e confirmação — análogo exato do que
 * lib/importacao/confirmarFrequencia.ts já cobre. */
const CLIENTE_NAO_MAIS_APTO_REASON =
  "Cliente não estava mais apto no momento da gravação"

/** Rede de segurança: uma linha "ok" com identificador ou CNPJ nulos não
 * deveria existir (a anotação já garante isso), mas nunca deve virar carga
 * se acontecer. */
const LINHA_INCONSISTENTE_REASON =
  "Linha marcada como pronta, mas com dado incompleto — pulada por segurança"

/** Re-validação defensiva: o dado voltou do navegador depois da revisão —
 * uma linha com CNPJ vazio (ou só espaços) aqui não pode abortar o lote
 * inteiro dentro do banco. Nenhuma checagem de formato, só presença. */
const CNPJ_NAO_INFORMADO_NA_CONFIRMACAO_REASON =
  "CNPJ não informado no momento da confirmação — pulada por segurança"

/** Chaves exatas que atualizar_cnpj_lote's jsonb_to_recordset espera
 * (supabase/migrations/0020_atualizar_cnpj_lote.sql). */
export type RpcCnpjRow = {
  id: string
  cnpj: string
}

export type PlanConfirmacaoCnpjResult = {
  carga: RpcCnpjRow[]
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
 * - "ok" com identificador nulo → pulada por segurança
 *   (LINHA_INCONSISTENTE_REASON). Não deveria acontecer, é a rede.
 * - re-validação defensiva do CNPJ (aparado, ainda não-vazio) ANTES de
 *   entrar na carga.
 * - linhas apontando para o MESMO identificador de cliente: a primeira
 *   ocorrência entra na carga, as demais são puladas sob o motivo de
 *   repetição — mesma convenção "primeira ocorrência vence" do fluxo de
 *   frequência.
 */
export function planConfirmacaoCnpj(
  linhas: ValidatedRowCnpj[]
): PlanConfirmacaoCnpjResult {
  const skippedRows = new Set<number>()
  const reasonCounts = new Map<string, number>()

  function addSkip(row: number, reason: string): void {
    skippedRows.add(row)
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
  }

  const candidatos: { row: number; entrada: RpcCnpjRow }[] = []

  for (const linha of linhas) {
    if (linha.status === "erro") {
      for (const reason of linha.reasons) {
        addSkip(linha.row, reason)
      }
      continue
    }

    const { clienteId, cnpj } = linha.resolved
    if (!clienteId || !cnpj) {
      addSkip(linha.row, LINHA_INCONSISTENTE_REASON)
      continue
    }

    const cnpjAparado = cnpj.trim()
    if (!cnpjAparado) {
      addSkip(linha.row, CNPJ_NAO_INFORMADO_NA_CONFIRMACAO_REASON)
      continue
    }

    candidatos.push({
      row: linha.row,
      entrada: { id: clienteId, cnpj: cnpjAparado },
    })
  }

  // A ordem de entrada em `linhas` define quem é a primeira.
  const vistos = new Set<string>()
  const carga: RpcCnpjRow[] = []

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

export type ReconciliarCnpjResult = {
  atualizados: { razaoSocial: string }[]
  puladasExtra: PuladaGroup[]
}

/**
 * Funde o que a RPC de fato devolveu (id + razão social do banco) contra o
 * que foi enviado — tudo que foi enviado e não voltou vira pulada sob o
 * motivo de "deixou de estar apto", nunca um erro genérico. Análogo exato de
 * reconciliarFrequencia (lib/importacao/confirmarFrequencia.ts).
 */
export function reconciliarCnpj(
  carga: RpcCnpjRow[],
  retornados: { id: string; razaoSocial: string }[]
): ReconciliarCnpjResult {
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

export { fundirGruposDeMotivos }
