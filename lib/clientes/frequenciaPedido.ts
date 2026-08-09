/**
 * Pure membership + canonicalization pair for "Frequência de pedidos"
 * (ATV-02) — irmã literal de lib/clientes/cidadeValida.ts's
 * cidadeValida/cidadeCanonica pair, mesmo raciocínio de tolerância
 * (comparação depois de aparar espaços das pontas e insensível a caixa).
 *
 * Módulo puro (sem Supabase, sem diretiva de cliente/servidor) — importável
 * tanto de app/actions/clientes.ts (Server Action) quanto de um teste
 * unitário sem .env.local.
 *
 * `clientes.frequencia_pedidos` guarda texto simples, SEM ligação com a
 * tabela `frequencias_pedido` (decisão D2 do contrato de interface,
 * 16-UI-SPEC.md) — por isso o banco NÃO recusa valor inválido sozinho.
 * `frequenciaPedidoValida`/`frequenciaPedidoCanonica` são a fronteira REAL
 * do ATV-02: sem essa checagem no servidor, o campo de escolha vira
 * decoração e qualquer texto arbitrário entra pela porta dos fundos.
 *
 * IMPORTANTE para quem chamar: o vocabulário passado aqui precisa ser o
 * catálogo COMPLETO (ativos + inativos), nunca só os ativos — um cliente
 * que já guardou um valor desde então desativado precisa continuar
 * conseguindo salvar a ficha inteira. Usar o leitor de catálogo ATIVO
 * (getFrequenciasPedidoAtivas, no arquivo de consultas de clientes, plano
 * 16-02) aqui é o defeito mais provável desta área — aquele leitor é só
 * para o campo de escolha de um cliente NOVO, nunca para esta
 * re-validação.
 */

/** Um valor de vocabulário, para fins de comparação/canonicalização. */
export type VocabularioItem = { nome: string }

function normalizar(valor: string): string {
  return valor.trim().toLowerCase()
}

/**
 * Retorna true sse `valor` for vazio/ausente (o campo é opcional — não
 * preencher é sempre válido) ou existir em `vocabulario` com comparação
 * insensível a caixa e espaços nas pontas.
 */
export function frequenciaPedidoValida(
  valor: string | null | undefined,
  vocabulario: VocabularioItem[]
): boolean {
  if (!valor || valor.trim() === "") return true

  const valorKey = normalizar(valor)
  return vocabulario.some((item) => normalizar(item.nome) === valorKey)
}

/**
 * Devolve o nome canônico (o texto exato como está guardado em
 * `frequencias_pedido`) correspondente a `valor`, ou null quando não houver
 * correspondência ou `valor` for vazio/ausente.
 */
export function frequenciaPedidoCanonica(
  valor: string | null | undefined,
  vocabulario: VocabularioItem[]
): string | null {
  if (!valor || valor.trim() === "") return null

  const valorKey = normalizar(valor)
  const match = vocabulario.find((item) => normalizar(item.nome) === valorKey)

  return match ? match.nome : null
}
