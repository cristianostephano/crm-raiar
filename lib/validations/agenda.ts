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
