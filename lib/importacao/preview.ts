/**
 * Pure helpers for the import review screen (Step 3, IMP-07/IMP-08). No
 * "use client"/"use server" directive, no Supabase import — unit-testable
 * in isolation. `ReviewRowStatus` is declared locally (not imported from
 * app/actions/importacao.ts's "use server" module) to keep this file fully
 * dependency-isolated; it's structurally identical to `ValidatedRowStatus`.
 */

export type ReviewRowStatus = "ok" | "duplicado" | "erro"

export type SummaryCounts = {
  total: number
  ok: number
  erros: number
  duplicados: number
}

/** Correct { total, ok, erros, duplicados } counts for a mixed batch of
 * validated rows — feeds Step 3's summary line. */
export function summaryCounts(
  linhas: { status: ReviewRowStatus }[]
): SummaryCounts {
  return linhas.reduce<SummaryCounts>(
    (acc, linha) => {
      acc.total += 1
      if (linha.status === "ok") acc.ok += 1
      else if (linha.status === "erro") acc.erros += 1
      else if (linha.status === "duplicado") acc.duplicados += 1
      return acc
    },
    { total: 0, ok: 0, erros: 0, duplicados: 0 }
  )
}

/** Reuses ClienteCard.tsx's TASK_STATUS_BORDER color vocabulary verbatim
 * (06-UI-SPEC.md lines 84-91) — never invent a new status-color system. */
const STATUS_BORDER: Record<ReviewRowStatus, string> = {
  ok: "border-l-4 border-l-green-500",
  duplicado: "border-l-4 border-l-amber-500",
  erro: "border-l-4 border-l-red-500",
}

export function statusBorderClass(status: ReviewRowStatus): string {
  return STATUS_BORDER[status]
}
