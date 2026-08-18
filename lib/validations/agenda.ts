import { differenceInCalendarDays, parseISO } from "date-fns"
import { z } from "zod"

/**
 * Limites do resumo de conclusão (CONC-01) — FONTE ÚNICA desses dois
 * números no código de aplicação. Os mesmos valores estão gravados como
 * `chk_tarefas_resumo_tamanho`/`chk_visitas_resumo_tamanho` no banco
 * (supabase/migrations/0015_conclusao_com_resumo.sql, Fase 15-01) —
 * mudar um lado exige mudar o outro na mesma leva, senão a tela deixaria
 * passar o que o banco recusa. A tela (Plano 15-03) importa estas
 * constantes para montar o contador de caracteres e o `maxLength` do
 * campo; nunca redeclara estes números.
 */
export const RESUMO_MIN = 10
export const RESUMO_MAX = 500

/**
 * As três mensagens de validação do resumo, copiadas LITERALMENTE do
 * Copywriting Contract de 15-UI-SPEC.md (seção `ConcluirItemDialog.tsx`).
 * A tela importa estas constantes em vez de reescrever/traduzir o texto —
 * é isso que garante que a mensagem exibida sempre corresponda ao que o
 * validador compartilhado realmente decidiu.
 */
export const RESUMO_MSG_VAZIO = "Escreva um resumo antes de concluir."
export const RESUMO_MSG_CURTO = "O resumo precisa ter pelo menos 10 caracteres."
export const RESUMO_MSG_LONGO = "O resumo pode ter no máximo 500 caracteres."

/**
 * Esquema de validação do resumo (CONC-01) — apara espaços das pontas
 * ANTES de medir, espelhando exatamente o `btrim(...)` + `char_length(...)`
 * que `concluir_tarefa_prospeccao`/`concluir_visita` já fazem no banco
 * (migration 0015): um resumo que só atinge o mínimo por causa de espaços
 * nas pontas é recusado dos dois lados, com o mesmo critério.
 *
 * Este arquivo é PURO: sem import de `next/*`, sem import do cliente de
 * banco. É importado tanto por um componente de navegador (o
 * `ConcluirItemDialog` do Plano 15-03) quanto pela ação de servidor deste
 * plano (app/actions/agenda.ts) — qualquer dependência de servidor aqui
 * vazaria para o pacote do navegador.
 */
export const resumoSchema = z
  .string()
  .transform((value) => value.trim())
  .superRefine((value, ctx) => {
    if (value === "") {
      ctx.addIssue({ code: "custom", message: RESUMO_MSG_VAZIO })
      return
    }
    if (value.length < RESUMO_MIN) {
      ctx.addIssue({ code: "custom", message: RESUMO_MSG_CURTO })
      return
    }
    if (value.length > RESUMO_MAX) {
      ctx.addIssue({ code: "custom", message: RESUMO_MSG_LONGO })
    }
  })

export type ValidarResumoResult =
  | { valido: true; resumo: string }
  | { valido: false; message: string }

/**
 * Auxiliar que a ação de servidor (app/actions/agenda.ts) e a tela (Plano
 * 15-03) consomem — devolve um formato simples ("válido + texto aparado"
 * ou "inválido + mensagem") em vez de cada lado interpretar o resultado
 * bruto do zod à sua própria maneira.
 */
export function validarResumo(value: string): ValidarResumoResult {
  const result = resumoSchema.safeParse(value)

  if (result.success) {
    return { valido: true, resumo: result.data }
  }

  return {
    valido: false,
    message: result.error.issues[0]?.message ?? RESUMO_MSG_VAZIO,
  }
}

/**
 * Teto de dias do intervalo de histórico (AGD-13) — FONTE ÚNICA deste
 * número no código de aplicação. A maior grade de mês possível tem 42
 * dias (`diasDaGradeDoMes`, lib/agenda/itens.ts); o teto dá folga sem
 * deixar de ser um limite real. A ação de servidor (Fase 21-04) importa
 * esta constante para recusar um pedido grande demais, e o teste importa
 * a mesma constante para provar a fronteira — dois números soltos
 * divergiriam em silêncio.
 */
export const INTERVALO_HISTORICO_MAX_DIAS = 45

export const INTERVALO_MSG_INVALIDO = "Intervalo de histórico inválido."
export const INTERVALO_MSG_LONGO =
  "Intervalo de histórico maior que o permitido."

const FORMATO_DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

export type ValidarIntervaloResult =
  | { valido: true; inicio: string; fim: string }
  | { valido: false; message: string }

/**
 * Guarda de RECURSO do intervalo de histórico pedido pelo navegador — NÃO
 * é guarda de autorização. Quem decide o que cada usuário pode ver
 * continua sendo exclusivamente a RLS no banco (mesmo padrão de
 * `agenda_do_vendedor()`); este validador nunca pode virar um segundo
 * lugar que decide permissão. Ele existe porque a ação de servidor que vai
 * consumi-lo (Fase 21-04) é um endpoint público, e o cálculo de
 * `intervaloDeHistorico` feito no navegador não é fronteira nenhuma —
 * qualquer chamador poderia pedir um intervalo arbitrariamente grande
 * diretamente à ação, sem passar pela tela.
 *
 * Confere, nesta ordem: (1) os dois textos estão no formato de data
 * ano-mês-dia; (2) o início não é posterior ao fim; (3) a distância em
 * dias de calendário entre os dois não passa de `INTERVALO_HISTORICO_MAX_DIAS`.
 */
export function validarIntervaloHistorico(
  inicio: string,
  fim: string
): ValidarIntervaloResult {
  if (!FORMATO_DATA_ISO.test(inicio) || !FORMATO_DATA_ISO.test(fim)) {
    return { valido: false, message: INTERVALO_MSG_INVALIDO }
  }

  if (inicio > fim) {
    return { valido: false, message: INTERVALO_MSG_INVALIDO }
  }

  const distanciaDias = differenceInCalendarDays(parseISO(fim), parseISO(inicio))

  if (distanciaDias > INTERVALO_HISTORICO_MAX_DIAS) {
    return { valido: false, message: INTERVALO_MSG_LONGO }
  }

  return { valido: true, inicio, fim }
}
