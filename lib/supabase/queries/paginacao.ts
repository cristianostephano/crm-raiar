/**
 * Paginador genérico de leituras Supabase (quick task 260914-ng5). A tabela
 * `clientes` passou de 1000 linhas pela primeira vez hoje (2181 atualmente),
 * e o PostgREST devolve no máximo 1000 linhas por requisição quando não há
 * paginação explícita (`.range()`) — ler sem paginar entrega uma lista
 * truncada, exatamente o MESMO bug já corrigido uma vez de forma específica
 * para a tabela `cidades` (`getTodasCidades`, lib/supabase/queries/cidades.ts,
 * quick task 260819-l6o).
 *
 * Esta versão generaliza o mesmo laço para qualquer leitura já filtrada/
 * ordenada pelo chamador: o CHAMADOR monta sua própria query (com
 * `.select()`/`.eq()`/`.or()`/`.order()` já aplicados) e só falta
 * `.range(inicio, fim)`, que o próprio callback `buscarPagina` aplica antes
 * de devolver `{ data, error }`. O chamador NUNCA monta `.range()` sozinho
 * fora deste módulo, e é responsável por incluir na SUA query um `.order()`
 * com uma coluna que garanta ordem estável entre requisições separadas
 * (idealmente `id`, a chave primária) — sem isso o PostgREST não garante a
 * mesma ordem relativa entre duas chamadas de `.range()` e a paginação pode
 * pular ou repetir linhas na fronteira entre páginas, corrompendo
 * silenciosamente a mesma contagem que este bug existe para corrigir.
 */

/** Teto por requisição do PostgREST — tamanho de página máximo aproveitável. */
export const TAMANHO_PAGINA_PADRAO = 1000

/** Trava de segurança contra laço infinito (100 páginas = 100 mil linhas de
 * folga sobre as 2181 atuais). Se atingido sem a página final vir mais curta
 * que o tamanho de página, é tratado como falha de leitura — nunca devolve
 * lista parcial como se fosse completa. */
export const MAX_PAGINAS_PADRAO = 100

export type ResultadoPagina<T> = { data: T[] | null; error: unknown }

export type BuscarPagina<T> = (
  inicio: number,
  fim: number
) => Promise<ResultadoPagina<T>>

export type OpcoesBuscarPaginado = {
  tamanhoPagina?: number
  maxPaginas?: number
}

/**
 * Une múltiplas páginas de `buscarPagina` numa única lista. Mesmo laço `for`
 * de `getTodasCidades`: `inicio = pagina * tamanhoPagina`,
 * `fim = inicio + tamanhoPagina - 1`, acumula as linhas, e para assim que uma
 * página vier com menos linhas que `tamanhoPagina` (sinal de fim real). Se o
 * laço terminar sem uma página curta (teto de páginas atingido), devolve
 * `null` — nunca `[]` interpretado como "acabou por coincidência" quando na
 * verdade é o teto de segurança batendo. Se qualquer página devolver `error`
 * truthy, o resultado inteiro é `null`, mesmo as páginas anteriores tendo
 * vindo com sucesso.
 */
export async function buscarPaginado<T>(
  buscarPagina: BuscarPagina<T>,
  opcoes?: OpcoesBuscarPaginado
): Promise<T[] | null> {
  const tamanhoPagina = opcoes?.tamanhoPagina ?? TAMANHO_PAGINA_PADRAO
  const maxPaginas = opcoes?.maxPaginas ?? MAX_PAGINAS_PADRAO

  const acumulado: T[] = []

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const inicio = pagina * tamanhoPagina
    const fim = inicio + tamanhoPagina - 1

    const { data, error } = await buscarPagina(inicio, fim)

    if (error) return null

    const rows = data ?? []
    acumulado.push(...rows)

    if (rows.length < tamanhoPagina) {
      return acumulado
    }
  }

  return null
}
