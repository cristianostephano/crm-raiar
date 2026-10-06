import { format, isValid, parseISO } from "date-fns"
import { z } from "zod"

import {
  REPETIR_SEMANAS_VALORES,
  repeticaoPermitida,
} from "@/lib/agenda2/repeticao"

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
 *
 * Quick 261006-ncy (migration 0051): a visita ganha dois textos livres
 * OPCIONAIS, `oQueFazer` ("Motivo da visita") e `oQueFoiFeito` ("O que foi
 * feito"), com o mesmo limite de `chk_agenda2_o_que_fazer_tamanho` e
 * `chk_agenda2_o_que_foi_feito_tamanho` (`AGENDA2_TEXTO_VISITA_MAX`). Por
 * decisão do dono (2026-10-06) esses dois campos NÃO recusam sequência de
 * dígitos e NÃO mostram dica de privacidade na tela — diferente de nome e
 * bairro, cuja regra continua igual.
 *
 * Fase 32 (repetição semanal): `agenda2ItemSchema` NÃO muda — ele também
 * valida a EDIÇÃO, que nunca gera repetição (D-24). A CRIAÇÃO usa
 * `criarAgenda2CriarSchema(hoje)`, que acrescenta `repetirSemanas` (lista
 * fechada 0/4/8/12) e recusa repetir com data passada (D-23). O `hoje`
 * (AAAA-MM-DD de São Paulo) chega por parâmetro — o schema nunca lê o
 * relógio. Nenhum campo de série existe (D-22): chaves extras são
 * descartadas.
 */

/** FONTE ÚNICA — espelha `chk_agenda2_nome_cliente_tamanho` (migration 0048). */
export const AGENDA2_NOME_MAX = 120
/** FONTE ÚNICA — espelha `chk_agenda2_bairro_tamanho` (migration 0048). */
export const AGENDA2_BAIRRO_MAX = 60
/** FONTE ÚNICA — 8 ou mais dígitos seguidos é recusado; espelha
 * `[0-9]{8,}` em `chk_agenda2_nome_cliente_sem_documento`/
 * `chk_agenda2_bairro_sem_documento` (migration 0048). */
export const AGENDA2_DIGITOS_SEGUIDOS_MAX = 7

/**
 * FONTE ÚNICA — espelha `chk_agenda2_o_que_fazer_tamanho` e
 * `chk_agenda2_o_que_foi_feito_tamanho` (migration 0051): máximo de
 * caracteres depois de aparar espaços.
 */
export const AGENDA2_TEXTO_VISITA_MAX = 500

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
export const AGENDA2_MSG_TEXTO_VISITA_LONGO = "Use no máximo 500 caracteres."
export const AGENDA2_MSG_DATA_VAZIA = "Informe a data."
export const AGENDA2_MSG_DATA_INVALIDA = "Data inválida."
export const AGENDA2_MSG_REPETIR_INVALIDO =
  "Escolha uma opção de repetição válida."
export const AGENDA2_MSG_REPETIR_PASSADO =
  "A repetição só vale para hoje ou datas futuras."

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

/**
 * Texto livre opcional da visita (`oQueFazer`/`oQueFoiFeito`). Ordem das
 * etapas: string, trim, máximo, transform (vazio vira null), nullable,
 * optional — assim AUSENTE continua ausente (`optional` curto-circuita antes
 * do transform) e `null` continua `null`. Semântica nas Server Actions:
 * AUSENTE = a ação não mexe na coluna; vazio, só espaços ou null = grava NULL;
 * texto = grava aparado. SEM recusa de sequência de dígitos e SEM dica na
 * tela, por decisão do dono de 2026-10-06 (diferente de nome e bairro).
 */
export const agenda2TextoVisitaSchema = z
  .string()
  .trim()
  .max(AGENDA2_TEXTO_VISITA_MAX, AGENDA2_MSG_TEXTO_VISITA_LONGO)
  .transform((valor) => (valor === "" ? null : valor))
  .nullable()
  .optional()

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
  oQueFazer: agenda2TextoVisitaSchema,
  oQueFoiFeito: agenda2TextoVisitaSchema,
})

export type Agenda2ItemInput = z.infer<typeof agenda2ItemSchema>

/**
 * Schema de CRIAÇÃO (Fase 32): os campos de `agenda2ItemSchema` mais
 * `repetirSemanas`. `.optional()` e não `.default(0)` — default faz entrada
 * e saída divergirem e quebra a tipagem do zodResolver; quem trata ausente
 * como 0 é a Server Action. A lista fechada vem direto de
 * `REPETIR_SEMANAS_VALORES` (T-32-01: teto de 12 linhas por envio).
 */
export function criarAgenda2CriarSchema(hoje: string) {
  return agenda2ItemSchema
    .extend({
      repetirSemanas: z
        .literal(REPETIR_SEMANAS_VALORES, {
          error: AGENDA2_MSG_REPETIR_INVALIDO,
        })
        .optional(),
    })
    .superRefine((valor, ctx) => {
      if (
        (valor.repetirSemanas ?? 0) > 0 &&
        !repeticaoPermitida(valor.data, hoje)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["repetirSemanas"],
          message: AGENDA2_MSG_REPETIR_PASSADO,
        })
      }
    })
}

export type Agenda2CriarItemInput = z.input<
  ReturnType<typeof criarAgenda2CriarSchema>
>

/**
 * Valida o `id` de um item existente (edição/conclusão/exclusão) — a
 * mesma forma de UUID que `agenda2_itens.id` (migration 0048) gera.
 */
export const agenda2ItemIdSchema = z.uuid()
