import { addWeeks, parseISO } from "date-fns"

import { chaveDoDia } from "@/lib/agenda/itens"

/**
 * Repetição semanal da Agenda 2 (AGD2-02, Fase 32) — base pura.
 *
 * - FONTE ÚNICA da lista fechada de repetições (D-20): não repetir (0) ou
 *   repetir por 4, 8 ou 12 semanas. Tela e servidor leem esta mesma lista.
 * - "Repetir por N semanas" gera N visitas NO TOTAL: a data escolhida conta
 *   como a primeira (4 semanas = 4 visitas; 12 semanas = 12 visitas, nunca
 *   13). Decisão do dono em 2026-10-02 (D-31).
 * - As datas são sempre calculadas com parseISO -> addWeeks -> chaveDoDia.
 *   NUNCA pelo construtor de data a partir de texto (que lê "AAAA-MM-DD"
 *   como meia-noite UTC e desloca o dia em fusos a oeste) e NUNCA somando
 *   milissegundos (o horário de verão faria o dia escorregar) — Pitfall 1.
 * - Nenhum identificador de série existe (D-22): cada ocorrência gerada é um
 *   item comum e independente das demais.
 *
 * Arquivo puro (sem `next/*`, sem cliente de banco) — importável pelo
 * formulário no navegador e pela Server Action.
 */

/** Lista fechada de opções de repetição (D-20) — 0 significa "não repetir". */
export const REPETIR_SEMANAS_VALORES = [0, 4, 8, 12] as const

export type RepetirSemanas = (typeof REPETIR_SEMANAS_VALORES)[number]

/**
 * Datas (AAAA-MM-DD) de cada ocorrência: `semanas` visitas NO TOTAL, uma por
 * semana, todas no mesmo dia da semana da `dataBase`, que é a primeira.
 * `semanas = 0` devolve só a própria data.
 */
export function gerarDatasSemanais(
  dataBase: string,
  semanas: RepetirSemanas
): string[] {
  const total = semanas === 0 ? 1 : semanas
  const base = parseISO(dataBase)

  return Array.from({ length: total }, (_, i) => chaveDoDia(addWeeks(base, i)))
}

/**
 * D-23: repetir só vale quando a data escolhida é hoje ou futura. Compara
 * TEXTO AAAA-MM-DD (imune a fuso, mesma convenção de `existeItemParecido`).
 * `hoje` sempre vem de fora — nunca o relógio aqui dentro — para ser
 * testável e para servidor e tela usarem o mesmo dia de São Paulo.
 */
export function repeticaoPermitida(data: string, hoje: string): boolean {
  return data !== "" && data >= hoje
}

/** Rótulo do seletor; mostra o total de visitas para não deixar dúvida (D-31). */
export function rotuloRepeticao(semanas: RepetirSemanas): string {
  if (semanas === 0) return "Não repetir"

  return `Por ${semanas} semanas (${semanas} visitas, incluindo esta)`
}
