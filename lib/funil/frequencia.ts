/**
 * Single source of truth for the project's frequência de visita vocabulary
 * (ATV-03 at the code level: um valor só, um lugar só).
 *
 * Mirrors the module shape lib/funil/etapas.ts already established for the
 * funil stages (array `as const` + type derivado + mapa de rótulos), so the
 * pattern for "fixed vocabulary shared by Client Component and Server
 * Action" never diverges across this project's enum-like modules.
 *
 * This module is intentionally pure — no import of next/react/@supabase —
 * because it's imported both by a Client Component (GanhoFrequenciaDialog,
 * this plan's 13-03 standing control) and a Server Action (app/actions/funil.ts).
 * Any server-only dependency here would leak into the client bundle.
 *
 * The order below (`semanal, quinzenal, mensal, nenhuma`) is locked by
 * 13-UI-SPEC.md's Copywriting Contract and matches the `frequencia_visita_enum`
 * Postgres enum created in supabase/migrations/0013_cliente_ativo_e_frequencia_visita.sql
 * — Phases 14-17 must import from here instead of redeclaring these strings.
 */

export const FREQUENCIAS_VISITA = [
  "semanal",
  "quinzenal",
  "mensal",
  "nenhuma",
] as const

export type FrequenciaVisita = (typeof FREQUENCIAS_VISITA)[number]

export const FREQUENCIA_VISITA_LABELS: Record<FrequenciaVisita, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  nenhuma: "Nenhuma",
}

export const FREQUENCIA_VISITA_ITEMS: { value: FrequenciaVisita; label: string }[] =
  FREQUENCIAS_VISITA.map((value) => ({
    value,
    label: FREQUENCIA_VISITA_LABELS[value],
  }))

/** Type guard used by the Server Action to re-validate what comes from the
 * browser before it reaches the `mover_card_funil` RPC parameter. */
export function isFrequenciaVisita(value: unknown): value is FrequenciaVisita {
  return (
    typeof value === "string" &&
    (FREQUENCIAS_VISITA as readonly string[]).includes(value)
  )
}
