/**
 * Quick task 260819-m8q (D-03) — autoridade ÚNICA dos rótulos "Sem cidade"/
 * "Sem estado" exibidos quando `clientes.cidade`/`clientes.estado` vêm
 * nulos (migration 0023 tornou as duas colunas opcionais). Módulo puro, sem
 * import de Supabase nem de `next/headers` — mesma disciplina de
 * lib/clientes/completude.ts, para poder ser importado tanto de componente
 * de servidor quanto de Client Component.
 *
 * A tela (ClienteCard), a ficha (ClienteDetailSheet) e o filtro
 * (FiltersPopover) devem TODOS ler os rótulos daqui, nunca escrever o texto
 * "Sem cidade"/"Sem estado" à mão em mais de um lugar — dois lugares
 * escrevendo o mesmo texto é como o filtro e o card acabam discordando.
 */

export const ROTULO_SEM_CIDADE = "Sem cidade"
export const ROTULO_SEM_ESTADO = "Sem estado"

/** Texto só com espaços conta como ausente, igual a nulo. */
function isAusente(valor: string | null): boolean {
  return !valor || valor.trim() === ""
}

/**
 * Monta o par "Cidade/Estado" exibido no card/ficha, trocando cada lado
 * ausente pelo seu rótulo (D-03): `rotuloCidadeEstado(null, "SP")` ->
 * `"Sem cidade/SP"`; `rotuloCidadeEstado(null, null)` ->
 * `"Sem cidade/Sem estado"`.
 */
export function rotuloCidadeEstado(
  cidade: string | null,
  estado: string | null
): string {
  const cidadeRotulo = isAusente(cidade) ? ROTULO_SEM_CIDADE : (cidade as string)
  const estadoRotulo = isAusente(estado) ? ROTULO_SEM_ESTADO : (estado as string)
  return `${cidadeRotulo}/${estadoRotulo}`
}
