import { sanitizeCell } from "@/lib/clientes/exportacao"
import { normalizeRazaoSocial } from "@/lib/importacao/dedupe"
import type { SystemFieldCnpj } from "@/lib/importacao/typesCnpj"
import type { StatusAcompanhamento } from "@/lib/supabase/queries/clientes"

/**
 * Pure per-row annotation for the "CNPJ em massa" import preview (Fase 19,
 * IMP-03). No Supabase import, no client/server component directive — a
 * referência à camada de consulta (StatusAcompanhamento) é só de TIPO, o que
 * mantém este módulo puro apesar de referenciar um tipo que mora num arquivo
 * com cliente de banco. As listas de consulta (clientes) chegam já
 * estreitadas pelo chamador (app/actions/importacaoCnpj.ts), então este
 * módulo é fully unit-testable com listas fabricadas
 * (tests/importacao/annotarLinhaCnpj.test.ts), no .env.local needed — cópia
 * estrutural de lib/importacao/annotarLinhaFrequencia.ts (Fase 17), copiando
 * a correção de nome ambíguo que já funciona em produção, não redescobrindo
 * o problema.
 */

/** Uma linha mapeada da planilha — as duas chaves do terceiro vocabulário
 * (lib/importacao/typesCnpj.ts), já coagidas a string. */
export type MappedRowCnpj = Partial<Record<SystemFieldCnpj, string>>

/** Forma de consulta de cliente — o mínimo que a anotação precisa para
 * achar o cliente e explicar por que ele não está apto. */
export type ClienteCnpjLookup = {
  id: string
  razaoSocial: string
  statusAcompanhamento: StatusAcompanhamento
}

/** Linha resolvida — identificador do cliente (ou nulo, quando a linha não
 * pode carregar um dado confiável adiante) e o CNPJ lido da célula (ou
 * nulo).
 *
 * `clienteEncontradoRazaoSocial` é a razão social lida do BANCO do cliente
 * casado, separada de `razaoSocial` (que é sempre a célula da planilha,
 * saneada) — é essa diferença de fonte que deixa o Supervisor conferir
 * visualmente que o casamento foi o certo antes de gravar. Fica nulo quando
 * não há casamento OU quando há mais de um (ambiguidade) — não há um único
 * nome de banco a apontar nesses casos. */
export type ResolvedRowCnpj = {
  clienteId: string | null
  razaoSocial: string
  clienteEncontradoRazaoSocial: string | null
  cnpj: string | null
}

export type AnnotatedRowCnpj = {
  status: "ok" | "erro"
  reasons: string[]
  resolved: ResolvedRowCnpj
}

/** Cinco motivos de erro, no mesmo tom dos do fluxo de frequência. */
const RAZAO_SOCIAL_NAO_INFORMADA_REASON = "Razão social não informada"
const CLIENTE_NAO_ENCONTRADO_REASON =
  "Cliente não encontrado com essa razão social"
const CLIENTE_NAO_GANHO_REASON =
  'Cliente encontrado, mas não está com status "Ganho" — CNPJ não pode ser regularizado por aqui'
const CNPJ_NAO_INFORMADO_REASON = "CNPJ não informado"

/** Quinto motivo — mesmo padrão do sexto motivo de annotarLinhaFrequencia.ts:
 * sem ele, uma colisão de normalização de razão social gravaria o CNPJ no
 * cliente errado, em silêncio. Mesmo tom dos outros quatro motivos. */
const CLIENTE_AMBIGUO_REASON =
  "Mais de um cliente encontrado com essa razão social — use o nome exato do cadastro"

/** Sanitizes every defined cell value with sanitizeCell (mesma guarda A4 de
 * annotarLinha.ts) before any resolution/comparison. */
function sanitizeRow(linha: MappedRowCnpj): MappedRowCnpj {
  const sanitized: MappedRowCnpj = {}
  for (const [key, value] of Object.entries(linha)) {
    if (value === undefined) continue
    sanitized[key as SystemFieldCnpj] = sanitizeCell(value)
  }
  return sanitized
}

/**
 * Um índice de clientes por chave de comparação — construído UMA vez por
 * lote, para não deixar a anotação quadrática numa planilha grande (limite
 * de ~10s da hospedagem). O valor é deliberadamente uma LISTA, e não um
 * cliente só: é a existência de mais de um resultado na mesma chave que
 * revela a ambiguidade (critério de sucesso 4 da fase).
 */
export function construirIndiceClientes(
  clientes: ClienteCnpjLookup[]
): Map<string, ClienteCnpjLookup[]> {
  const indice = new Map<string, ClienteCnpjLookup[]>()

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

/** Anota uma linha já mapeada contra um índice de clientes já construído —
 * rotina interna compartilhada pelas duas portas de entrada públicas abaixo,
 * nunca duplicada. */
function annotarComIndice(
  linha: MappedRowCnpj,
  indice: Map<string, ClienteCnpjLookup[]>
): AnnotatedRowCnpj {
  const sanitized = sanitizeRow(linha)
  const reasons: string[] = []

  let clienteId: string | null = null
  // Nome do banco do cliente casado — preenchido sempre que exatamente um
  // cliente casa com a linha, mesmo quando ele não está apto (a coluna de
  // revisão precisa mostrar QUEM foi encontrado mesmo nesse caso, para o
  // motivo de "não está com status Ganho" fazer sentido).
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
      // Mais de um cliente casa com a mesma chave normalizada — erro,
      // identificador nulo, nunca escolhe um "no achismo". Sem um único
      // cliente para apontar, não há nome de banco a exibir.
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

  // CNPJ é texto livre, só presença — nenhuma checagem de formato, máscara
  // ou dígito verificador (postura já travada na Fase 18/CLAUDE.md).
  const cnpjValorCru = sanitized.cnpj?.trim() ?? ""
  let cnpj: string | null = null

  if (!cnpjValorCru) {
    reasons.push(CNPJ_NAO_INFORMADO_REASON)
  } else {
    cnpj = cnpjValorCru
  }

  const dedupedReasons = Array.from(new Set(reasons))

  return {
    status: dedupedReasons.length > 0 ? "erro" : "ok",
    reasons: dedupedReasons,
    resolved: {
      clienteId,
      razaoSocial: sanitized.razaoSocial ?? "",
      clienteEncontradoRazaoSocial,
      cnpj,
    },
  }
}

/** Anotação por uma única linha — assinatura exata do contrato de interface
 * (linha mapeada + lista de clientes). Constrói o índice internamente e
 * delega à mesma rotina do lote — nunca duplica a regra. */
export function annotarLinhaCnpj(
  linha: MappedRowCnpj,
  clientes: ClienteCnpjLookup[]
): AnnotatedRowCnpj {
  return annotarComIndice(linha, construirIndiceClientes(clientes))
}

/** Anotação de lote — constrói o índice UMA vez e mapeia. É esta que a ação
 * de servidor de validação chama. */
export function annotarLoteCnpj(
  linhas: MappedRowCnpj[],
  clientes: ClienteCnpjLookup[]
): AnnotatedRowCnpj[] {
  const indice = construirIndiceClientes(clientes)
  return linhas.map((linha) => annotarComIndice(linha, indice))
}
