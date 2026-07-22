import { describe, expect, it } from "vitest"

import {
  DIAS_PARADO_ALERTA,
  diasParado,
  isParado,
  staleReason,
  tarefaAtrasada,
  taskStatus,
  type TarefaAberta,
} from "../../lib/funil/staleness"

/**
 * Unit tests for the FUN-09 stalled/overdue pure logic (02-04 Task 2).
 * Fixed `now` in every test — no reliance on the real clock — so results are
 * deterministic regardless of when the suite runs.
 */

const NOW = new Date("2026-07-17T12:00:00Z")

function daysAgoISO(days: number): string {
  const d = new Date(NOW)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

function dateOnlyDaysAgo(days: number): string {
  const d = new Date(NOW)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

describe("diasParado / isParado", () => {
  it("counts whole calendar days since the last stage change", () => {
    expect(diasParado(daysAgoISO(3), NOW)).toBe(3)
  })

  it("is false just below the threshold", () => {
    const etapaAlteradaEm = daysAgoISO(DIAS_PARADO_ALERTA - 1)
    expect(isParado(etapaAlteradaEm, NOW)).toBe(false)
  })

  it("is true exactly at the threshold", () => {
    const etapaAlteradaEm = daysAgoISO(DIAS_PARADO_ALERTA)
    expect(isParado(etapaAlteradaEm, NOW)).toBe(true)
  })

  it("is true above the threshold", () => {
    const etapaAlteradaEm = daysAgoISO(DIAS_PARADO_ALERTA + 5)
    expect(isParado(etapaAlteradaEm, NOW)).toBe(true)
  })
})

describe("tarefaAtrasada", () => {
  it("is true for an open task whose due date is before today", () => {
    const tarefa: TarefaAberta = {
      concluida: false,
      dataConclusao: dateOnlyDaysAgo(1),
      tipoNome: "Visitar",
    }
    expect(tarefaAtrasada(tarefa, NOW)).toBe(true)
  })

  it("is false for a task due today", () => {
    const tarefa: TarefaAberta = {
      concluida: false,
      dataConclusao: dateOnlyDaysAgo(0),
      tipoNome: "Visitar",
    }
    expect(tarefaAtrasada(tarefa, NOW)).toBe(false)
  })

  it("is false for a completed task, even with a past due date", () => {
    const tarefa: TarefaAberta = {
      concluida: true,
      dataConclusao: dateOnlyDaysAgo(30),
      tipoNome: "Visitar",
    }
    expect(tarefaAtrasada(tarefa, NOW)).toBe(false)
  })

  it("is false for an open task with no due date", () => {
    const tarefa: TarefaAberta = {
      concluida: false,
      dataConclusao: null,
      tipoNome: "Mandar mensagem",
    }
    expect(tarefaAtrasada(tarefa, NOW)).toBe(false)
  })
})

describe("staleReason", () => {
  it("returns null when neither condition applies", () => {
    const cliente = { etapaAlteradaEm: daysAgoISO(1) }
    const tarefas: TarefaAberta[] = [
      { concluida: false, dataConclusao: dateOnlyDaysAgo(0), tipoNome: "Visitar" },
    ]
    expect(staleReason(cliente, tarefas, NOW)).toBeNull()
  })

  it("returns the parado reason when only the stage is stalled", () => {
    const cliente = { etapaAlteradaEm: daysAgoISO(DIAS_PARADO_ALERTA) }
    const reason = staleReason(cliente, [], NOW)
    expect(reason).toEqual({
      kind: "parado",
      label: `Parado há ${DIAS_PARADO_ALERTA} dias nesta etapa.`,
    })
  })

  it("returns the tarefa reason when only a task is overdue", () => {
    const cliente = { etapaAlteradaEm: daysAgoISO(1) }
    const tarefas: TarefaAberta[] = [
      { concluida: false, dataConclusao: dateOnlyDaysAgo(2), tipoNome: "Visitar" },
    ]
    expect(staleReason(cliente, tarefas, NOW)).toEqual({
      kind: "tarefa",
      label: "Tarefa atrasada: Visitar.",
    })
  })

  it("prefers the tarefa reason when both conditions are true", () => {
    const cliente = { etapaAlteradaEm: daysAgoISO(DIAS_PARADO_ALERTA + 10) }
    const tarefas: TarefaAberta[] = [
      {
        concluida: false,
        dataConclusao: dateOnlyDaysAgo(3),
        tipoNome: "Mandar mensagem",
      },
    ]
    expect(staleReason(cliente, tarefas, NOW)).toEqual({
      kind: "tarefa",
      label: "Tarefa atrasada: Mandar mensagem.",
    })
  })

  it("ignores a completed task and falls back to the parado reason", () => {
    const cliente = { etapaAlteradaEm: daysAgoISO(DIAS_PARADO_ALERTA) }
    const tarefas: TarefaAberta[] = [
      { concluida: true, dataConclusao: dateOnlyDaysAgo(30), tipoNome: "Visitar" },
    ]
    expect(staleReason(cliente, tarefas, NOW)).toEqual({
      kind: "parado",
      label: `Parado há ${DIAS_PARADO_ALERTA} dias nesta etapa.`,
    })
  })
})

describe("taskStatus", () => {
  it('returns "none" when there are no open tasks scheduled', () => {
    expect(taskStatus([], NOW)).toBe("none")
  })

  it('returns "on_time" for a single open task due today (not overdue)', () => {
    const tarefas: TarefaAberta[] = [
      { concluida: false, dataConclusao: dateOnlyDaysAgo(0), tipoNome: "Visitar" },
    ]
    expect(taskStatus(tarefas, NOW)).toBe("on_time")
  })

  it('returns "late" for a single open task past due', () => {
    const tarefas: TarefaAberta[] = [
      { concluida: false, dataConclusao: dateOnlyDaysAgo(2), tipoNome: "Visitar" },
    ]
    expect(taskStatus(tarefas, NOW)).toBe("late")
  })

  it('returns "late" when at least one of multiple open tasks is overdue', () => {
    const tarefas: TarefaAberta[] = [
      { concluida: false, dataConclusao: dateOnlyDaysAgo(0), tipoNome: "Visitar" },
      { concluida: false, dataConclusao: dateOnlyDaysAgo(2), tipoNome: "Mandar mensagem" },
    ]
    expect(taskStatus(tarefas, NOW)).toBe("late")
  })
})
