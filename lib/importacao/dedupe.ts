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
  /** CNPJ opcional — alimenta a regra de desambiguação por CNPJ (quick task
   * 260914-j8g, bug de falso positivo em filiais de rede — ex.
   * Carrefour/Outback: razão social igual, CNPJ diferente, NUNCA duplicado). */
  cnpj?: string | null
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
 * Normaliza um CNPJ SÓ para fins de COMPARAÇÃO de duplicados — remove tudo
 * que não é dígito. NUNCA usar o retorno para exibição/gravação (mesmo
 * aviso de escopo que `normalizeRazaoSocial` já faz para a chave de nome).
 * Nulo, indefinido ou string vazia/só espaço viram string vazia, que
 * representa "CNPJ ausente" (ambíguo) no restante desta comparação.
 */
function normalizeCnpjParaComparacao(valor: string | null | undefined): string {
  if (!valor) return ""
  return valor.replace(/\D/g, "")
}

/**
 * Verdadeiro SOMENTE quando os dois CNPJs, depois de normalizados pra
 * dígitos, ficam ambos não vazios E diferentes entre si — o caso "ambos os
 * lados têm CNPJ e são de empresas distintas" (quick task 260914-j8g: o fix
 * do falso positivo de filiais de rede, ex. Carrefour/Outback). Quando
 * qualquer um dos lados fica vazio depois de normalizado (nulo, indefinido,
 * ou só espaço/pontuação), devolve `false` — "não diverge", o valor que
 * PRESERVA o comportamento antigo (ambíguo = trata como possível duplicado,
 * porque sem CNPJ não há como desambiguar).
 */
function cnpjDivergente(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const digitosA = normalizeCnpjParaComparacao(a)
  const digitosB = normalizeCnpjParaComparacao(b)
  if (!digitosA || !digitosB) return false
  return digitosA !== digitosB
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
 *
 * Quick task 260914-j8g: nome igual só vira "possível duplicado" quando o
 * CNPJ também bate OU quando falta CNPJ em pelo menos um dos dois lados;
 * nome igual com CNPJ diferente presente nos DOIS lados NUNCA é duplicado —
 * corrige o falso positivo real de filiais de rede com razão social igual e
 * CNPJ diferente (ex. "CARREFOUR COMERCIO E INDUSTRIA LTDA", "OUTBACK
 * STEAKHOUSE RESTAURANTES BRASIL S.A."). `existentesCnpj` e
 * `existentesNomesFantasiaCnpj` são OPCIONAIS (lista vazia por padrão,
 * alinhados por índice a `existentes`/`existentesNomesFantasia`
 * respectivamente) para que chamadas existentes que não passam CNPJ
 * continuem compilando e se comportando exatamente como antes (banco "sem
 * CNPJ" em todo índice = ambíguo = continua tratando como possível
 * duplicado).
 */
export function findDuplicates(
  batch: DedupeBatchItem[],
  existentes: (string | null | undefined)[],
  existentesNomesFantasia: (string | null | undefined)[] = [],
  existentesCnpj: (string | null | undefined)[] = [],
  existentesNomesFantasiaCnpj: (string | null | undefined)[] = []
): Map<number, string> {
  const result = new Map<number, string>()

  type CandidatoExistente = { nome: string; cnpj: string | null | undefined }

  // Cada chave agora mapeia para uma LISTA de candidatos (não mais um único
  // nome) — duas empresas diferentes podem compartilhar a mesma chave de
  // nome com CNPJs diferentes (cenário Carrefour/Outback: duas filiais).
  const existentesByKey = new Map<string, CandidatoExistente[]>()

  existentes.forEach((nome, index) => {
    const key = normalizeRazaoSocial(nome)
    if (!key) return
    const fullKey = RAZAO_SOCIAL_NAMESPACE + key
    const lista = existentesByKey.get(fullKey) ?? []
    lista.push({ nome: nome as string, cnpj: existentesCnpj[index] })
    existentesByKey.set(fullKey, lista)
  })
  existentesNomesFantasia.forEach((nome, index) => {
    const key = normalizeRazaoSocial(nome)
    if (!key) return
    const fullKey = NOME_FANTASIA_NAMESPACE + key
    const lista = existentesByKey.get(fullKey) ?? []
    lista.push({ nome: nome as string, cnpj: existentesNomesFantasiaCnpj[index] })
    existentesByKey.set(fullKey, lista)
  })

  type AncoraDoBatch = { row: number; nome: string; cnpj: string | null | undefined }

  // Âncoras de cada chave dentro do próprio batch, na ordem de entrada —
  // usadas como "nome parecido" para colisões puramente internas. Também
  // vira LISTA pelo mesmo motivo: duas linhas do MESMO lote com nome igual e
  // CNPJ diferente precisam virar âncoras separadas, nunca comparadas entre
  // si.
  const firstInBatchByKey = new Map<string, AncoraDoBatch[]>()

  for (const item of batch) {
    const key = chaveDeComparacao(item.razaoSocial, item.nomeFantasia)
    if (!key) continue

    // Nome legível a exibir como "parecido com" — a razão social quando
    // presente, senão o Nome Fantasia (a mesma chave de reserva usada acima).
    const nomeExibido = item.razaoSocial || item.nomeFantasia || ""

    const candidatosExistentes = existentesByKey.get(key) ?? []
    const existingMatch = candidatosExistentes.find(
      (candidato) => !cnpjDivergente(item.cnpj, candidato.cnpj)
    )
    if (existingMatch) {
      result.set(item.row, existingMatch.nome)
      const ancoras = firstInBatchByKey.get(key) ?? []
      const jaTemAncoraCompativel = ancoras.some(
        (ancora) => !cnpjDivergente(item.cnpj, ancora.cnpj)
      )
      if (!jaTemAncoraCompativel) {
        ancoras.push({ row: item.row, nome: nomeExibido, cnpj: item.cnpj })
        firstInBatchByKey.set(key, ancoras)
      }
      continue
    }

    const ancoras = firstInBatchByKey.get(key) ?? []
    const ancoraCompativel = ancoras.find(
      (ancora) => ancora.row !== item.row && !cnpjDivergente(item.cnpj, ancora.cnpj)
    )
    if (ancoraCompativel) {
      result.set(item.row, ancoraCompativel.nome)
      // A âncora também é duplicada (das demais), a menos que já tenha sido
      // marcada contra o banco acima.
      if (!result.has(ancoraCompativel.row)) {
        result.set(ancoraCompativel.row, nomeExibido)
      }
    } else {
      const jaTemAncoraCompativel = ancoras.some(
        (ancora) => !cnpjDivergente(item.cnpj, ancora.cnpj)
      )
      if (!jaTemAncoraCompativel) {
        ancoras.push({ row: item.row, nome: nomeExibido, cnpj: item.cnpj })
        firstInBatchByKey.set(key, ancoras)
      }
    }
  }

  return result
}
