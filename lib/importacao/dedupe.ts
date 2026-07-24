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
 * Normaliza uma razão social para uma CHAVE DE COMPARAÇÃO de duplicados —
 * nunca usar o retorno para exibição/gravação (Pitfall A1). Passos: lowercase,
 * remoção de diacríticos (NFD + strip de combining marks), remoção de
 * pontuação, colapso de espaços, remoção de sufixo societário do fim, trim.
 */
export function normalizeRazaoSocial(valor: string): string {
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

/**
 * Dada uma lista de razões sociais do batch (com o índice de linha original)
 * e uma lista de razões sociais já existentes no banco, mapeia cada índice
 * de linha cujo nome normalizado bate com um existente OU com outra linha do
 * próprio batch (D-03 — duplicado interno recebe o mesmo tratamento) para o
 * nome "parecido" (legível, não normalizado) que casou.
 *
 * Quando uma linha bate tanto contra o banco quanto contra outra linha do
 * batch, o nome do banco tem precedência (é o candidato mais "canônico").
 * Entre múltiplas linhas do próprio batch, a primeira ocorrência (linha de
 * menor índice) é o nome retornado para as demais.
 */
export function findDuplicates(
  batch: { row: number; razaoSocial: string }[],
  existentes: string[]
): Map<number, string> {
  const result = new Map<number, string>()

  const existentesByKey = new Map<string, string>()
  for (const nome of existentes) {
    const key = normalizeRazaoSocial(nome)
    if (key && !existentesByKey.has(key)) {
      existentesByKey.set(key, nome)
    }
  }

  // Primeira ocorrência de cada chave dentro do próprio batch, na ordem de
  // entrada — usada como "nome parecido" para colisões puramente internas.
  const firstInBatchByKey = new Map<string, { row: number; razaoSocial: string }>()

  for (const item of batch) {
    const key = normalizeRazaoSocial(item.razaoSocial)
    if (!key) continue

    const existingMatch = existentesByKey.get(key)
    if (existingMatch) {
      result.set(item.row, existingMatch)
      if (!firstInBatchByKey.has(key)) {
        firstInBatchByKey.set(key, item)
      }
      continue
    }

    const firstInBatch = firstInBatchByKey.get(key)
    if (firstInBatch && firstInBatch.row !== item.row) {
      result.set(item.row, firstInBatch.razaoSocial)
      // A primeira ocorrência também é duplicada (das demais), a menos que
      // já tenha sido marcada contra o banco acima.
      if (!result.has(firstInBatch.row)) {
        result.set(firstInBatch.row, item.razaoSocial)
      }
    } else if (!firstInBatch) {
      firstInBatchByKey.set(key, item)
    }
  }

  return result
}
