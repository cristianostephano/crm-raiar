/**
 * Fase 30 (Aderência de Uso no Dashboard) — sinal de "abriu o sistema hoje"
 * (D-01) e "cadastrou/editou cliente hoje" (D-02/D-05).
 *
 * Este módulo NÃO decide qual dia é gravado — ele só decide SE vale a pena
 * chamar a RPC `registrar_acesso_diario()` (migration 0038, plano 30-01).
 * Quem carimba a data é sempre o banco, no fuso de São Paulo (D-10): mesmo
 * que o relógio do navegador esteja errado ou adiantado, isso nunca muda o
 * dia gravado — só pode fazer o sistema chamar a RPC um pouco cedo ou um
 * pouco tarde demais, o que o próprio banco corrige de novo no dia seguinte.
 *
 * O marcador (cookie) inclui a conta (usuarioId) e não só o dia, porque dois
 * vendedores podem usar o mesmo aparelho no mesmo dia — sem a conta no
 * valor, o registro do segundo vendedor seria pulado por engano.
 *
 * Este módulo roda dentro do middleware (lib/supabase/middleware.ts), que é
 * executado em todo request autenticado — por isso ele não pode importar
 * nada que dependa de um escopo de requisição do Next que o middleware não
 * tem (nem o módulo de leitura de cookies do App Router, nem o marcador de
 * "só servidor", nem o client Supabase usado pelas Server Actions).
 *
 * LGPD: o cookie do marcador não guarda nada além do dia e do código da
 * conta — o mesmo tipo de dado que o próprio cookie de sessão do Supabase já
 * carrega. Nenhum horário, IP, aparelho ou localização é gravado aqui (isso
 * é responsabilidade do banco, e D-10 já proíbe até lá).
 */

export const MARCADOR_ACESSO_COOKIE = "aderencia_dia"

export const OPCOES_MARCADOR_ACESSO = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  // O valor já carrega o dia (AAAA-MM-DD.conta) — a validade do cookie só
  // precisa ultrapassar um dia inteiro para o marcador de ontem deixar de
  // bater sozinho; 48h dá folga sem custo extra (correção 7 do 30-01: quem
  // decide se registra de novo é a comparação de valor, não a validade).
  maxAge: 60 * 60 * 48,
  secure: process.env.NODE_ENV === "production",
} as const

/**
 * Dia local de São Paulo (AAAA-MM-DD) a partir de um instante. Usa
 * `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"` — nunca
 * aritmética manual de fuso (o mesmo cuidado de `bucketDoItem`, que já
 * documenta o bug de fuso que este projeto levou uma vez). `formatToParts`
 * monta o valor a partir das partes year/month/day em vez de confiar no
 * formato padrão do locale, que pode mudar de ordem/separador.
 */
export function diaLocalSaoPaulo(agora: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora)

  const ano = partes.find((parte) => parte.type === "year")?.value
  const mes = partes.find((parte) => parte.type === "month")?.value
  const dia = partes.find((parte) => parte.type === "day")?.value

  if (!ano || !mes || !dia) {
    throw new Error("Intl.DateTimeFormat não devolveu ano/mês/dia")
  }

  return `${ano}-${mes}-${dia}`
}

/**
 * Valor do marcador: dia + conta, separados por ponto. A conta entra no
 * valor para que dois vendedores no mesmo navegador nunca compartilhem o
 * mesmo marcador (um "já registrei hoje" de um não pode valer para o outro).
 */
export function valorMarcadorAcesso(dia: string, usuarioId: string): string {
  return `${dia}.${usuarioId}`
}

/**
 * Verdadeiro quando o valor do cookie não bate com o esperado para o
 * dia/conta atuais — cobre cookie ausente, dia diferente (virou o dia) e
 * conta diferente (outra pessoa logada no mesmo aparelho).
 */
export function precisaRegistrarAcesso(
  valorCookie: string | undefined,
  dia: string,
  usuarioId: string
): boolean {
  return valorCookie !== valorMarcadorAcesso(dia, usuarioId)
}

/**
 * Cliente mínimo aceito por registrarAcessoDiario — só o método `rpc`, com a
 * assinatura de UM argumento (sem parâmetros, como a RPC do 30-01 exige).
 * Tipo estrutural (não importa `SupabaseClient` de `@supabase/supabase-js`)
 * para não amarrar este módulo a nenhum shape de Database gerado — o
 * `SupabaseClient` real (usado no middleware e nas Server Actions) satisfaz
 * este shape estruturalmente, e o retorno usa `PromiseLike` (não `Promise`)
 * porque o builder real do supabase-js é "thenable", não um Promise nativo.
 */
export type ClienteComRpc = {
  rpc: (
    nomeFuncao: "registrar_acesso_diario"
  ) => PromiseLike<{ error: { message: string } | null }>
}

/**
 * Chama `registrar_acesso_diario()` (0038, plano 30-01) sem nenhum
 * parâmetro — o banco decide quem é (auth.uid()) e qual o dia (fuso de São
 * Paulo). Nunca lança: um problema aqui (erro devolvido pela RPC ou uma
 * exceção de rede) nunca pode derrubar a tela nem a Server Action que
 * piggyback neste registro (ameaça de DoS, T-30-22) — devolve `false` e a
 * próxima requisição tenta de novo (nenhum cookie é gravado sem sucesso).
 */
export async function registrarAcessoDiario(
  cliente: ClienteComRpc
): Promise<boolean> {
  try {
    const { error } = await cliente.rpc("registrar_acesso_diario")
    return !error
  } catch {
    return false
  }
}
