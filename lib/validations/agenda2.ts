import { format, isValid, parseISO } from "date-fns"
import { z } from "zod"

/**
 * Schema compartilhado do item da Agenda 2 (AGD2-01/03, Fase 31) — a FONTE
 * ÚNICA destes números e desta regra no código de aplicação. Espelha, lado
 * a lado, as constraints `chk_agenda2_*` da migration 0048
 * (31-01-PLAN.md): mudar um lado exige mudar o outro na mesma leva — o
 * teste de sincronia do plano 31-04 confere isso.
 *
 * Privacidade por padrão (LGPD — nota a do ROADMAP + correção 4 do
 * 31-01-PLAN.md): além do limite de tamanho, nome e bairro recusam
 * automaticamente qualquer sequência de 8+ dígitos (ignorando separadores
 * comuns de documento), para não deixar CPF/CNPJ/telefone/CEP serem
 * digitados nesses dois campos de texto livre.
 *
 * Arquivo puro (sem `next/*`, sem cliente de banco) — importado tanto pelo
 * formulário (navegador, Plano 31-07, via zodResolver) quanto pela Server
 * Action (Plano 31-04, que nunca pode confiar só na validação do
 * navegador). Mesmo molde de `lib/validations/agenda.ts`/`cliente.ts`.
 */

/** FONTE ÚNICA — espelha `chk_agenda2_nome_cliente_tamanho` (migration 0048). */
export const AGENDA2_NOME_MAX = 120
/** FONTE ÚNICA — espelha `chk_agenda2_bairro_tamanho` (migration 0048). */
export const AGENDA2_BAIRRO_MAX = 60
/** FONTE ÚNICA — 8 ou mais dígitos seguidos é recusado; espelha
 * `[0-9]{8,}` em `chk_agenda2_nome_cliente_sem_documento`/
 * `chk_agenda2_bairro_sem_documento` (migration 0048). */
export const AGENDA2_DIGITOS_SEGUIDOS_MAX = 7

export const AGENDA2_MSG_NOME_VAZIO = "Informe o nome do cliente."
export const AGENDA2_MSG_NOME_LONGO =
  "O nome pode ter no máximo 120 caracteres."
export const AGENDA2_MSG_NOME_DOCUMENTO =
  "Use só o nome do cliente, sem números de documento ou telefone."
export const AGENDA2_MSG_BAIRRO_VAZIO = "Informe o bairro."
export const AGENDA2_MSG_BAIRRO_LONGO =
  "O bairro pode ter no máximo 60 caracteres."
export const AGENDA2_MSG_BAIRRO_DOCUMENTO =
  "Informe só o nome do bairro, sem CEP ou outros números longos."
export const AGENDA2_MSG_DATA_VAZIA = "Informe a data."
export const AGENDA2_MSG_DATA_INVALIDA = "Data inválida."

/**
 * Mesma regra de `chk_agenda2_nome_cliente_sem_documento`/
 * `chk_agenda2_bairro_sem_documento` (migration 0048):
 * `regexp_replace(coluna, '[./[:space:]-]', '', 'g') !~ '[0-9]{8,}'`.
 * Remove ponto, barra, hífen e qualquer espaço (os separadores comuns de
 * CPF/CNPJ/telefone/CEP) antes de testar se sobra uma sequência de
 * `AGENDA2_DIGITOS_SEGUIDOS_MAX + 1` ou mais dígitos — números curtos
 * (ex. "Mercado 24h", "Empório 1234567") continuam passando.
 */
export function contemSequenciaLongaDeDigitos(texto: string): boolean {
  const semSeparadores = texto.replace(/[./\s-]/g, "")
  const sequenciaLonga = new RegExp(`[0-9]{${AGENDA2_DIGITOS_SEGUIDOS_MAX + 1},}`)

  return sequenciaLonga.test(semSeparadores)
}

const FORMATO_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Confere, nesta ordem: (1) o texto está no formato AAAA-MM-DD; (2)
 * `parseISO` consegue montar uma data de calendário válida a partir dele
 * (recusa `2026-02-30`, que o parser "corrigiria" rolando para março sem
 * isto); (3) formatar essa data de volta devolve exatamente o mesmo texto
 * — dupla checagem contra qualquer rolagem silenciosa de data inválida.
 * Nenhuma restrição de passado/futuro (D-09): qualquer data válida, mesmo
 * no passado, é aceita.
 */
function ehDataValida(valor: string): boolean {
  if (!FORMATO_DATA_ISO.test(valor)) return false

  const data = parseISO(valor)
  if (!isValid(data)) return false

  return format(data, "yyyy-MM-dd") === valor
}

export const agenda2ItemSchema = z.object({
  nomeCliente: z
    .string()
    .trim()
    .min(1, AGENDA2_MSG_NOME_VAZIO)
    .max(AGENDA2_NOME_MAX, AGENDA2_MSG_NOME_LONGO)
    .refine((valor) => !contemSequenciaLongaDeDigitos(valor), {
      message: AGENDA2_MSG_NOME_DOCUMENTO,
    }),
  bairro: z
    .string()
    .trim()
    .min(1, AGENDA2_MSG_BAIRRO_VAZIO)
    .max(AGENDA2_BAIRRO_MAX, AGENDA2_MSG_BAIRRO_LONGO)
    .refine((valor) => !contemSequenciaLongaDeDigitos(valor), {
      message: AGENDA2_MSG_BAIRRO_DOCUMENTO,
    }),
  data: z
    .string()
    .min(1, AGENDA2_MSG_DATA_VAZIA)
    .refine((valor) => ehDataValida(valor), {
      message: AGENDA2_MSG_DATA_INVALIDA,
    }),
})

export type Agenda2ItemInput = z.infer<typeof agenda2ItemSchema>

/**
 * Valida o `id` de um item existente (edição/conclusão/exclusão) — a
 * mesma forma de UUID que `agenda2_itens.id` (migration 0048) gera.
 */
export const agenda2ItemIdSchema = z.uuid()
