/**
 * Normalização de razão social + detecção de duplicados (Fase 6, IMP-07/D-03).
 * Módulo puro (sem Supabase, sem diretivas "use client"/"use server"), na
 * mesma forma dependency-free de lib/clientes/completude.ts — importável
 * tanto de app/actions/importacao.ts (Server Action) quanto de um teste
 * unitário sem .env.local.
 *
 * Não há algoritmo de dedup para reaproveitar de outro lugar do código —
 * comparação de string normalizada (lowercase, sem acento, sem pontuação,
 * sem sufixo societário) é a escolha documentada em 06-CONTEXT.md's "Claude's
 * Discretion" (pg_trgm ficou como opção não obrigatória).
 */

/** Sufixos societários comuns removidos do FIM da razão social normalizada. */
const SUFIXOS_SOCIETARIOS = ["ltda", "s/a", "s.a.", "sa", "me", "eireli", "epp", "mei"]

/**
 * Faixa Unicode dos combining diacritical marks (U+0300-U+036F, code points
 * 768-879) produzidos por `String.prototype.normalize("NFD")` ao decompor um
 * caractere acentuado (ex: "a" com acento -> "a" + combining acute accent).
 * Filtrado por código de caractere (não por um regex com caractere
 * combinante literal embutido no arquivo-fonte, que é frágil/ilegível em
 * qualquer editor ou diff).
 */
const DIACRITICS_RANGE_START = 0x0300
const DIACRITICS_RANGE_END = 0x036f

function stripDiacritics(valor: string): string {
  return Array.from(valor.normalize("NFD"))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code < DIACRITICS_RANGE_START || code > DIACRITICS_RANGE_END
    })
    .join("")
}

/**
 * Normaliza uma razão social (ou Nome Fantasia — reusada verbatim para os
 * dois desde a Fase 26 Plano 2, PROSP-02: a função não tem nada de
 * específico de razão social) para uma CHAVE DE COMPARAÇÃO de duplicados —
 * nunca usar o retorno para exibição/gravação (Pitfall A1). Passos: lowercase,
 * remoção de diacríticos (NFD + strip de combining marks), remoção de
 * pontuação, colapso de espaços, remoção de sufixo societário do fim, trim.
 *
 * Aceita nulo/indefinido e devolve texto vazio ANTES de qualquer chamada de
 * método de texto (Bug B da pesquisa da Fase 26: razão social é nulável no
 * banco desde a migration 0024, e sem esta tolerância a comparação de
 * duplicados estourava no primeiro cliente com razão social nula, derrubando
 * a validação do lote inteiro).
 */
export function normalizeRazaoSocial(valor: string | null | undefined): string {
  if (!valor) return ""

  let normalized = stripDiacritics(valor)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // strip punctuation (keep letters/digits/spaces)
    .replace(/\s+/g, " ")
    .trim()

  // Remove um único sufixo societário do fim, se presente como última
  // "palavra" (já sem pontuação nesse ponto, ex: "s/a" virou "s a").
  for (const suffix of SUFIXOS_SOCIETARIOS) {
    const suffixNormalized = stripDiacritics(suffix)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()

    const pattern = new RegExp(`\\s${suffixNormalized.replace(/ /g, "\\s+")}$`)
    if (pattern.test(` ${normalized}`)) {
      normalized = ` ${normalized}`.replace(pattern, "").trim()
      break
    }
  }

  return normalized
}

/** Uma linha do batch a ser comparada — razão social pode ser nula (Bug A da
 * pesquisa da Fase 26: chega nula, nunca em texto vazio, desde o Task 3
 * deste plano); Nome Fantasia é a CHAVE DE RESERVA opcional (Fase 26 Plano
 * 2, PROSP-02) usada quando a razão social está ausente. */
export type DedupeBatchItem = {
  row: number
  razaoSocial: string | null
  nomeFantasia?: string | null
}

/** Espaço de nomes de cada chave, para que a normalização de uma razão
 * social nunca colida com a normalização de um Nome Fantasia que tenha o
 * mesmo texto (ex.: uma empresa cuja razão social É o próprio Nome Fantasia
 * de outra). */
const RAZAO_SOCIAL_NAMESPACE = "rs:"
const NOME_FANTASIA_NAMESPACE = "nf:"

/** Chave de comparação de uma linha: razão social normalizada quando
 * presente; caindo para Nome Fantasia normalizado (chave de reserva,
 * PROSP-02) quando a razão social fica vazia; `null` quando as duas ficam
 * vazias (a linha é pulada pela comparação, como sempre). */
function chaveDeComparacao(
  razaoSocial: string | null | undefined,
  nomeFantasia: string | null | undefined
): string | null {
  const rsKey = normalizeRazaoSocial(razaoSocial)
  if (rsKey) return RAZAO_SOCIAL_NAMESPACE + rsKey

  const nfKey = normalizeRazaoSocial(nomeFantasia)
  if (nfKey) return NOME_FANTASIA_NAMESPACE + nfKey

  return null
}

/**
 * Dada uma lista de linhas do batch (com o índice de linha original) e uma
 * lista de razões sociais já existentes no banco, mapeia cada índice de
 * linha cujo nome normalizado bate com um existente OU com outra linha do
 * próprio batch (D-03 — duplicado interno recebe o mesmo tratamento) para o
 * nome "parecido" (legível, não normalizado) que casou.
 *
 * Quando uma linha bate tanto contra o banco quanto contra outra linha do
 * batch, o nome do banco tem precedência (é o candidato mais "canônico").
 * Entre múltiplas linhas do próprio batch, a primeira ocorrência (linha de
 * menor índice) é o nome retornado para as demais.
 *
 * Fase 26 Plano 2 (PROSP-02/Bug A/Bug B): `existentes` e `existentesNomesFantasia`
 * toleram valores nulos (uma segunda empresa sem razão social no banco não
 * pode derrubar a comparação — Bug B). Quando a razão social de uma linha do
 * batch está vazia, a comparação cai para o Nome Fantasia da própria linha
 * (chave de reserva), permitindo reconhecer duas linhas sem razão social e
 * com o mesmo Nome Fantasia como possível duplicado uma da outra.
 * `existentesNomesFantasia` é OPCIONAL (lista vazia por padrão) para que as
 * três chamadas existentes continuem compilando sem alteração.
 */
export function findDuplicates(
  batch: DedupeBatchItem[],
  existentes: (string | null | undefined)[],
  existentesNomesFantasia: (string | null | undefined)[] = []
): Map<number, string> {
  const result = new Map<number, string>()

  const existentesByKey = new Map<string, string>()
  for (const nome of existentes) {
    const key = normalizeRazaoSocial(nome)
    if (key && !existentesByKey.has(RAZAO_SOCIAL_NAMESPACE + key)) {
      existentesByKey.set(RAZAO_SOCIAL_NAMESPACE + key, nome as string)
    }
  }
  for (const nome of existentesNomesFantasia) {
    const key = normalizeRazaoSocial(nome)
    if (key && !existentesByKey.has(NOME_FANTASIA_NAMESPACE + key)) {
      existentesByKey.set(NOME_FANTASIA_NAMESPACE + key, nome as string)
    }
  }

  // Primeira ocorrência de cada chave dentro do próprio batch, na ordem de
  // entrada — usada como "nome parecido" para colisões puramente internas.
  const firstInBatchByKey = new Map<string, { row: number; nome: string }>()

  for (const item of batch) {
    const key = chaveDeComparacao(item.razaoSocial, item.nomeFantasia)
    if (!key) continue

    // Nome legível a exibir como "parecido com" — a razão social quando
    // presente, senão o Nome Fantasia (a mesma chave de reserva usada acima).
    const nomeExibido = item.razaoSocial || item.nomeFantasia || ""

    const existingMatch = existentesByKey.get(key)
    if (existingMatch) {
      result.set(item.row, existingMatch)
      if (!firstInBatchByKey.has(key)) {
        firstInBatchByKey.set(key, { row: item.row, nome: nomeExibido })
      }
      continue
    }

    const firstInBatch = firstInBatchByKey.get(key)
    if (firstInBatch && firstInBatch.row !== item.row) {
      result.set(item.row, firstInBatch.nome)
      // A primeira ocorrência também é duplicada (das demais), a menos que
      // já tenha sido marcada contra o banco acima.
      if (!result.has(firstInBatch.row)) {
        result.set(firstInBatch.row, nomeExibido)
      }
    } else if (!firstInBatch) {
      firstInBatchByKey.set(key, { row: item.row, nome: nomeExibido })
    }
  }

  return result
}
