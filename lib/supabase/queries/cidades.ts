import type { CidadeLookupItem } from "@/lib/clientes/cidadeValida"
import { createClient } from "@/lib/supabase/server"

/**
 * Leitor paginado da tabela `cidades` (bug 260819-l6o). A tabela tem 5571
 * linhas (seed IBGE, migration 0007), mas o PostgREST devolve no máximo
 * 1000 por requisição quando não há paginação explícita — ler sem paginar
 * entrega uma lista truncada, e validar a importação de clientes contra ela
 * rejeita cidade real (ex: São Paulo/SP, Curitiba/PR, ausentes das primeiras
 * 1000 linhas). Quem precisar da lista de cidades de UM Estado só deve
 * continuar usando a RPC `cidades_por_estado` (já pequena por natureza,
 * nunca truncou) — este leitor é só para quem genuinamente precisa do país
 * inteiro de uma vez.
 */

/** Teto por requisição do PostgREST — tamanho de página máximo aproveitável. */
export const TAMANHO_PAGINA_CIDADES = 1000

/** Trava de segurança contra laço infinito (teto de 20 mil linhas, ~4x o
 * seed atual do IBGE). Se atingido sem a página final vir incompleta, é
 * tratado como falha de leitura — nunca devolve lista parcial como se fosse
 * completa. */
export const MAX_PAGINAS_CIDADES = 20

export async function getTodasCidades(): Promise<CidadeLookupItem[] | null> {
  const supabase = await createClient()

  const cidades: CidadeLookupItem[] = []

  for (let pagina = 0; pagina < MAX_PAGINAS_CIDADES; pagina++) {
    const inicio = pagina * TAMANHO_PAGINA_CIDADES
    const fim = inicio + TAMANHO_PAGINA_CIDADES - 1

    // .order("id") é obrigatório: sem ordenação explícita pela chave
    // primária o PostgREST não garante ordem estável entre requisições, e a
    // paginação pode repetir ou pular linhas entre páginas.
    const { data, error } = await supabase
      .from("cidades")
      .select("nome, uf")
      .order("id", { ascending: true })
      .range(inicio, fim)

    if (error) return null

    const rows: CidadeLookupItem[] = (data ?? []).map(
      (row: { nome: string; uf: string }) => ({
        nome: row.nome,
        uf: row.uf,
      })
    )

    cidades.push(...rows)

    if (rows.length < TAMANHO_PAGINA_CIDADES) {
      return cidades
    }
  }

  return null
}
