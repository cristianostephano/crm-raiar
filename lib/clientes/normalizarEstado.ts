/**
 * Normalização de Estado para a sigla de UF correta (09-02, LOC-04). Módulo
 * puro (sem Supabase, sem diretivas "use client"/"use server"), na mesma
 * forma dependency-free de lib/importacao/dedupe.ts — importável tanto pelo
 * backfill SQL da migration 0007 (mesma fonte-verdade conceitual do mapa
 * nome->sigla abaixo) quanto por um teste unitário sem .env.local.
 *
 * D-01: os clientes de teste hoje cadastrados têm Estado em formatos
 * inconsistentes (sigla, nome por extenso, com/sem acento, espaços). A
 * normalização exigida é a mais simples possível — correspondência exata
 * case/acento-insensível, sem fuzzy matching. Um valor que não corresponde a
 * nenhuma sigla nem a nenhum nome conhecido não é bloqueado nem adivinhado:
 * volta em upper/trim (fallback não-bloqueante).
 */

import { UFS, type Uf } from "@/lib/clientes/ufs"

/**
 * Faixa Unicode dos combining diacritical marks (U+0300-U+036F, code points
 * 768-879) produzidos por `String.prototype.normalize("NFD")` ao decompor um
 * caractere acentuado. Filtrado por código de caractere (não por um regex com
 * caractere combinante literal embutido no arquivo-fonte, que é
 * frágil/ilegível em qualquer editor ou diff) — mesmo método de
 * lib/importacao/dedupe.ts's stripDiacritics.
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
 * Normaliza uma string para uma CHAVE DE COMPARAÇÃO acento/caso-insensível:
 * lowercase, sem diacríticos, espaços colapsados, trim. Usada tanto para a
 * chave de entrada quanto para as chaves do mapa nome->sigla abaixo, para
 * que o match seja sempre feito no mesmo espaço normalizado.
 */
function chaveComparacao(valor: string): string {
  return stripDiacritics(valor)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Mapa nome-por-extenso-normalizado -> sigla, das 27 UFs. Fonte-verdade que
 * o backfill SQL da migration 0007 (plano 09-01) espelha para a normalização
 * de `clientes.estado` (D-01/D-04).
 */
const NOME_PARA_SIGLA: Record<string, Uf> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
}

/**
 * Normaliza um valor bruto de Estado para a sigla de UF correta, quando
 * reconhecível. Passos: (1) computar a chave de comparação; (2) se a chave em
 * upper já for uma sigla válida (UFS), retorná-la; (3) senão, procurar no
 * mapa nome-por-extenso; (4) senão, fallback não-bloqueante: `raw` em
 * upper/trim (D-01/discretion — não bloquear, não adivinhar sigla).
 */
export function normalizarEstado(raw: string): string {
  const chave = chaveComparacao(raw)

  const siglaDireta = chave.toUpperCase()
  if (UFS.includes(siglaDireta as Uf)) {
    return siglaDireta
  }

  const siglaPorNome = NOME_PARA_SIGLA[chave]
  if (siglaPorNome) {
    return siglaPorNome
  }

  return raw.trim().toUpperCase()
}
