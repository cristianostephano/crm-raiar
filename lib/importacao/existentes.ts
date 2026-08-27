/**
 * Leitura de clientes já cadastrados, tolerante a nulo (Fase 26 Plano 3,
 * T-26-08). Módulo puro, mesma disciplina de lib/importacao/dedupe.ts: sem
 * import de Supabase, sem diretiva "use client"/"use server", totalmente
 * testável sem variáveis de ambiente.
 *
 * POR QUE este módulo existe: hoje os quatro pontos de leitura de "clientes
 * já cadastrados" (validar e confirmar, em cada um dos dois fluxos de
 * importação) convertem a razão social para texto com `as string` — uma
 * conversão de tipo não checada. No primeiro cliente do banco com razão
 * social nula (possível desde a migration 0024, alcançável na prática desde
 * a Fase 26 Plano 2/PROSP-02), essa conversão de tipo esconde do compilador
 * que o valor pode ser nulo — e no primeiro `.trim()`/comparação de string
 * feita mais adiante sobre esse valor, uma linha real do banco derrubaria a
 * validação do LOTE INTEIRO, não só daquela linha. Centralizar a leitura
 * aqui garante que os quatro pontos nunca divirjam nessa regra.
 */

/** Uma linha bruta devolvida pela consulta de clientes já cadastrados —
 * razão social possivelmente nula, Nome Fantasia possivelmente ausente da
 * consulta (o fluxo de clientes ativos nunca traz essa coluna). */
export type ExistenteRow = {
  razao_social?: string | null
  nome_fantasia?: string | null
}

export type NomesExistentesParaDedupe = {
  razoesSociais: string[]
  nomesFantasia: string[]
}

/** Aparado ou descartado — nunca texto vazio na lista de saída. Nulo,
 * indefinido e texto só com espaços em branco descartam a linha do lado
 * correspondente, sem lançar erro. */
function textoUtilizavel(valor: string | null | undefined): string | null {
  if (valor == null) return null
  const aparado = valor.trim()
  return aparado.length > 0 ? aparado : null
}

/**
 * Transforma a leitura bruta de clientes já cadastrados em duas listas de
 * texto seguras para comparação de duplicados: razões sociais utilizáveis e
 * Nomes Fantasia utilizáveis. Nunca converte tipo à força — o tipo de
 * entrada admite nulo explicitamente, porque a coluna de razão social é
 * nulável no banco desde a migration 0024. Quando o campo de Nome Fantasia
 * não vem na consulta (fluxo de clientes ativos), a lista de Nomes Fantasia
 * sai vazia. Uma leitura vazia devolve duas listas vazias.
 */
export function nomesExistentesParaDedupe(
  rows: ExistenteRow[]
): NomesExistentesParaDedupe {
  const razoesSociais: string[] = []
  const nomesFantasia: string[] = []

  for (const row of rows) {
    const razaoSocial = textoUtilizavel(row.razao_social)
    if (razaoSocial) razoesSociais.push(razaoSocial)

    const nomeFantasia = textoUtilizavel(row.nome_fantasia)
    if (nomeFantasia) nomesFantasia.push(nomeFantasia)
  }

  return { razoesSociais, nomesFantasia }
}
