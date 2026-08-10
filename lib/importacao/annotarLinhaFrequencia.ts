import { sanitizeCell } from "@/lib/clientes/exportacao"
import { normalizeRazaoSocial } from "@/lib/importacao/dedupe"
import type { SystemFieldFrequencia } from "@/lib/importacao/typesFrequencia"
import {
  FREQUENCIAS_VISITA,
  FREQUENCIA_VISITA_LABELS,
  type FrequenciaVisita,
} from "@/lib/funil/frequencia"
import type { StatusAcompanhamento } from "@/lib/supabase/queries/clientes"

/**
 * Pure per-row annotation for the frequência-de-visita import preview (Fase
 * 17, IMP-01). No Supabase import, no client/server component directive —
 * a referência à camada de consulta (StatusAcompanhamento) é só de TIPO, o
 * que mantém este módulo puro apesar de referenciar um tipo que mora num
 * arquivo com cliente de banco. As listas de consulta (clientes) chegam já
 * estreitadas pelo chamador (app/actions/importacaoFrequencia.ts), então
 * este módulo é fully unit-testable com listas fabricadas
 * (tests/importacao/annotarLinhaFrequencia.test.ts), no .env.local needed —
 * mesma disciplina de lib/importacao/annotarLinha.ts.
 */

/** Uma linha mapeada da planilha — as duas chaves do segundo vocabulário
 * (lib/importacao/typesFrequencia.ts), já coagidas a string. */
export type MappedRowFrequencia = Partial<Record<SystemFieldFrequencia, string>>

/** Forma de consulta de cliente — o mínimo que a anotação precisa para
 * achar o cliente e explicar por que ele não está apto. */
export type ClienteFrequenciaLookup = {
  id: string
  razaoSocial: string
  statusAcompanhamento: StatusAcompanhamento
}

/** Linha resolvida — identificador do cliente (ou nulo, quando a linha não
 * pode carregar um dado confiável adiante) e a frequência reconhecida (ou
 * nula).
 *
 * `clienteEncontradoRazaoSocial` (Fase 17, Plano 17-04) é a razão social lida
 * do BANCO quando exatamente um cliente casa com a linha — nunca a mesma
 * fonte que `razaoSocial` (que é sempre a célula da planilha, saneada). É
 * essa diferença de fonte que a tabela de revisão usa para o Supervisor
 * confirmar visualmente que o casamento foi o certo antes de gravar (T-17-31
 * do plano 17-04). Fica nulo quando não há casamento OU quando há mais de um
 * (ambiguidade, L1) — não há um único nome de banco para mostrar nesses
 * casos. */
export type ResolvedRowFrequencia = {
  clienteId: string | null
  razaoSocial: string
  clienteEncontradoRazaoSocial: string | null
  frequenciaVisita: FrequenciaVisita | null
}

export type AnnotatedRowFrequencia = {
  status: "ok" | "erro"
  reasons: string[]
  resolved: ResolvedRowFrequencia
}

/** Texto exato dos cinco motivos do contrato de copy (17-UI-SPEC.md). */
const RAZAO_SOCIAL_NAO_INFORMADA_REASON = "Razão social não informada"
const CLIENTE_NAO_ENCONTRADO_REASON =
  "Cliente não encontrado com essa razão social"
const CLIENTE_NAO_GANHO_REASON =
  'Cliente encontrado, mas não está com status "Ganho" — frequência não pode ser definida por aqui'
const FREQUENCIA_NAO_INFORMADA_REASON = "Frequência de visita não informada"

/** Sexto motivo — ADIÇÃO consciente ao contrato de copy aprovado (lacuna L1,
 * não coberta pelo 17-UI-SPEC.md original): sem ele, uma colisão de
 * normalização de razão social gravaria a frequência no cliente errado, em
 * silêncio. Mesmo tom dos outros cinco motivos. */
const CLIENTE_AMBIGUO_REASON =
  "Mais de um cliente encontrado com essa razão social — use o nome exato do cadastro"

function frequenciaNaoReconhecidaReason(valorCru: string): string {
  return `Frequência "${valorCru}" não reconhecida — use Semanal, Quinzenal, Mensal ou Nenhuma`
}

/** Sanitizes every defined cell value with sanitizeCell (mesma guarda A4 de
 * annotarLinha.ts) before any resolution/comparison. */
function sanitizeRow(linha: MappedRowFrequencia): MappedRowFrequencia {
  const sanitized: MappedRowFrequencia = {}
  for (const [key, value] of Object.entries(linha)) {
    if (value === undefined) continue
    sanitized[key as SystemFieldFrequencia] = sanitizeCell(value)
  }
  return sanitized
}

/**
 * Um índice de clientes por chave de comparação — construído UMA vez por
 * lote, para não deixar a anotação quadrática numa planilha grande (limite
 * de ~10s da hospedagem). O valor é deliberadamente uma LISTA, e não um
 * cliente só: é a existência de mais de um resultado na mesma chave que
 * revela a ambiguidade da lacuna L1.
 */
export function construirIndiceClientes(
  clientes: ClienteFrequenciaLookup[]
): Map<string, ClienteFrequenciaLookup[]> {
  const indice = new Map<string, ClienteFrequenciaLookup[]>()

  for (const cliente of clientes) {
    const chave = normalizeRazaoSocial(cliente.razaoSocial)
    const existentes = indice.get(chave)
    if (existentes) {
      existentes.push(cliente)
    } else {
      indice.set(chave, [cliente])
    }
  }

  return indice
}

/** Reconhece a frequência escrita pelo Supervisor: aparar espaços, comparar
 * sem diferenciar caixa e sem diferenciar acento (reusando a MESMA remoção
 * de diacríticos que normalizeRazaoSocial já faz — nunca uma segunda
 * implementação), aceitando tanto o valor interno quanto o rótulo de
 * exibição dos quatro valores, ambos vindos do módulo único de frequência. */
function resolverFrequencia(valorCru: string): {
  valor: FrequenciaVisita | null
  motivo: string | null
} {
  const chave = normalizeRazaoSocial(valorCru)

  const porValorInterno = FREQUENCIAS_VISITA.find(
    (valor) => normalizeRazaoSocial(valor) === chave
  )
  if (porValorInterno) return { valor: porValorInterno, motivo: null }

  const porRotulo = FREQUENCIAS_VISITA.find(
    (valor) => normalizeRazaoSocial(FREQUENCIA_VISITA_LABELS[valor]) === chave
  )
  if (porRotulo) return { valor: porRotulo, motivo: null }

  return { valor: null, motivo: frequenciaNaoReconhecidaReason(valorCru) }
}

/** Anota uma linha já mapeada contra um índice de clientes já construído —
 * rotina interna compartilhada pelas duas portas de entrada públicas abaixo,
 * nunca duplicada. */
function annotarComIndice(
  linha: MappedRowFrequencia,
  indice: Map<string, ClienteFrequenciaLookup[]>
): AnnotatedRowFrequencia {
  const sanitized = sanitizeRow(linha)
  const reasons: string[] = []

  let clienteId: string | null = null
  // Nome do banco do cliente casado (Plano 17-04) — preenchido sempre que
  // exatamente um cliente casa com a linha, mesmo quando ele não está apto
  // (a coluna de revisão precisa mostrar QUEM foi encontrado mesmo nesse
  // caso, para o motivo de "não está com status Ganho" fazer sentido).
  let clienteEncontradoRazaoSocial: string | null = null
  const razaoSocialValor = sanitized.razaoSocial?.trim() ?? ""

  if (!razaoSocialValor) {
    reasons.push(RAZAO_SOCIAL_NAO_INFORMADA_REASON)
  } else {
    const chave = normalizeRazaoSocial(razaoSocialValor)
    const encontrados = indice.get(chave) ?? []

    if (encontrados.length === 0) {
      reasons.push(CLIENTE_NAO_ENCONTRADO_REASON)
    } else if (encontrados.length > 1) {
      // Lacuna L1: mais de um cliente casa com a mesma chave normalizada —
      // erro, identificador nulo, nunca escolhe um "no achismo". Sem um
      // único cliente para apontar, não há nome de banco a exibir.
      reasons.push(CLIENTE_AMBIGUO_REASON)
    } else {
      const cliente = encontrados[0]
      clienteEncontradoRazaoSocial = cliente.razaoSocial
      if (cliente.statusAcompanhamento !== "ganho") {
        // Encontrado, mas inapto: o identificador FICA nulo — uma linha
        // inapta nunca pode carregar identificador para a fase de gravação.
        reasons.push(CLIENTE_NAO_GANHO_REASON)
      } else {
        clienteId = cliente.id
      }
    }
  }

  const frequenciaValorCru = sanitized.frequenciaVisita?.trim() ?? ""
  let frequenciaVisita: FrequenciaVisita | null = null

  if (!frequenciaValorCru) {
    reasons.push(FREQUENCIA_NAO_INFORMADA_REASON)
  } else {
    const resolvida = resolverFrequencia(frequenciaValorCru)
    if (resolvida.motivo) {
      reasons.push(resolvida.motivo)
    } else {
      frequenciaVisita = resolvida.valor
    }
  }

  const dedupedReasons = Array.from(new Set(reasons))

  return {
    status: dedupedReasons.length > 0 ? "erro" : "ok",
    reasons: dedupedReasons,
    resolved: {
      clienteId,
      razaoSocial: sanitized.razaoSocial ?? "",
      clienteEncontradoRazaoSocial,
      frequenciaVisita,
    },
  }
}

/** Anotação por uma única linha — assinatura exata do contrato de interface
 * (linha mapeada + lista de clientes). Constrói o índice internamente e
 * delega à mesma rotina do lote — nunca duplica a regra. */
export function annotarLinhaFrequencia(
  linha: MappedRowFrequencia,
  clientes: ClienteFrequenciaLookup[]
): AnnotatedRowFrequencia {
  return annotarComIndice(linha, construirIndiceClientes(clientes))
}

/** Anotação de lote — constrói o índice UMA vez e mapeia. É esta que a ação
 * de servidor de validação chama. */
export function annotarLoteFrequencia(
  linhas: MappedRowFrequencia[],
  clientes: ClienteFrequenciaLookup[]
): AnnotatedRowFrequencia[] {
  const indice = construirIndiceClientes(clientes)
  return linhas.map((linha) => annotarComIndice(linha, indice))
}
