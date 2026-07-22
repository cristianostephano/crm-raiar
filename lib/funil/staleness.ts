import { differenceInCalendarDays, parseISO } from "date-fns"

/**
 * Stalled/overdue card highlight (FUN-09) — pure functions only, no DB
 * access, so they're cheap to unit-test and safe to run during every render
 * (the highlight must be visible on first load, no interaction required).
 *
 * Threshold is Claude's discretion (no explicit number in CLAUDE.md/UI-SPEC):
 * a card that hasn't changed stage in 7+ calendar days is flagged "parado".
 */
export const DIAS_PARADO_ALERTA = 7

/** A single open (not concluída) tarefa's fields needed to evaluate
 * overdue-ness and to render the "Tarefa atrasada: {tipo}." copy. */
export type TarefaAberta = {
  concluida: boolean
  /** ISO date string (YYYY-MM-DD), the `tarefas.data_conclusao` column. */
  dataConclusao: string | null
  tipoNome: string
}

function toDate(value: string | Date): Date {
  return typeof value === "string" ? parseISO(value) : value
}

/** Whole calendar days since the card's last stage change. */
export function diasParado(
  etapaAlteradaEm: string | Date,
  now: Date = new Date()
): number {
  return differenceInCalendarDays(now, toDate(etapaAlteradaEm))
}

/** True once a card has sat in its current stage for `limite` days or more. */
export function isParado(
  etapaAlteradaEm: string | Date,
  now: Date = new Date(),
  limite: number = DIAS_PARADO_ALERTA
): boolean {
  return diasParado(etapaAlteradaEm, now) >= limite
}

/**
 * True when an open task's due date has passed. A completed task
 * (`concluida === true`) is never overdue, regardless of its due date. A
 * task due "today" is not yet overdue — only calendar days strictly before
 * today count (using differenceInCalendarDays avoids timezone/time-of-day
 * bugs comparing a DATE column against a full timestamp `now`).
 */
export function tarefaAtrasada(
  tarefa: TarefaAberta,
  now: Date = new Date()
): boolean {
  if (tarefa.concluida || !tarefa.dataConclusao) return false
  return differenceInCalendarDays(now, parseISO(tarefa.dataConclusao)) > 0
}

/** Always-on open-task-status signal for a card's left border (distinct from
 * the "parado/atrasado" TriangleAlert, which stays keyed off staleReason).
 * Pure, unit-testable, safe to run every render. */
export type TaskStatus = "on_time" | "late" | "none"

/**
 * Classifies a cliente's open tasks into a single status: "none" when no
 * open task is scheduled at all, "late" when any open task is overdue
 * (reuses tarefaAtrasada so the border and the overdue icon can never
 * disagree on what "atrasado" means), otherwise "on_time".
 */
export function taskStatus(
  tarefas: TarefaAberta[],
  now: Date = new Date()
): TaskStatus {
  if (tarefas.length === 0) return "none"
  if (tarefas.some((tarefa) => tarefaAtrasada(tarefa, now))) return "late"
  return "on_time"
}

export type StaleReason =
  | { kind: "tarefa"; label: string }
  | { kind: "parado"; label: string }

/**
 * Precedence rule from the UI-SPEC copywriting contract: if a card is BOTH
 * stalled in its stage AND has an overdue open task, the task-overdue copy
 * wins (it's the more actionable one).
 */
export function staleReason(
  cliente: { etapaAlteradaEm: string | Date },
  tarefas: TarefaAberta[],
  now: Date = new Date()
): StaleReason | null {
  const overdueTarefa = tarefas.find((tarefa) => tarefaAtrasada(tarefa, now))
  if (overdueTarefa) {
    return {
      kind: "tarefa",
      label: `Tarefa atrasada: ${overdueTarefa.tipoNome}.`,
    }
  }

  if (isParado(cliente.etapaAlteradaEm, now)) {
    return {
      kind: "parado",
      label: `Parado há ${diasParado(cliente.etapaAlteradaEm, now)} dias nesta etapa.`,
    }
  }

  return null
}
