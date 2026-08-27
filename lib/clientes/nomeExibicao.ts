/**
 * Fase 26 Plano 4 (T-26-15) — autoridade ÚNICA do nome exibido de um cliente
 * em qualquer tela (cartão do funil, ficha). Módulo puro, sem import de
 * Supabase nem de `next/headers` — mesma disciplina de
 * lib/clientes/rotuloLocalizacao.ts, para poder ser importado tanto de
 * componente de servidor quanto de Client Component.
 *
 * Desde a Fase 26 Plano 2 (PROSP-02), razão social é opcional na planilha de
 * prospecção — um cliente pode chegar sem ela, só com Nome Fantasia. Sem
 * este módulo, o título do cartão do funil e da ficha ficariam em branco
 * para esse cliente, uma regressão visível criada pela própria fase.
 *
 * Toda tela que exibe o "nome" de um cliente deve ler daqui, nunca escrever
 * o texto de ausência à mão em mais de um lugar — dois lugares escrevendo o
 * mesmo texto é como o cartão e a ficha acabam discordando.
 */

export const ROTULO_SEM_NOME = "Sem nome"

/** Texto só com espaços conta como ausente, igual a nulo/indefinido. */
function isAusente(valor: string | null | undefined): boolean {
  return !valor || valor.trim() === ""
}

/**
 * Devolve o nome exibido de um cliente: razão social quando preenchida;
 * senão o Nome Fantasia quando preenchido; senão o rótulo único de ausência
 * (`ROTULO_SEM_NOME`). Tolera nulo/indefinido nos dois argumentos, sem
 * estourar.
 */
export function nomeExibicaoCliente(
  razaoSocial: string | null | undefined,
  nomeFantasia: string | null | undefined
): string {
  if (!isAusente(razaoSocial)) return razaoSocial as string
  if (!isAusente(nomeFantasia)) return nomeFantasia as string
  return ROTULO_SEM_NOME
}
