import { ETAPA_KEYS } from "@/lib/funil/etapas"
import type { ClientesAgrupadosPorEtapa } from "@/lib/supabase/queries/clientes"

/**
 * Dependency-free helper (mirrors lib/clientes/completude.ts's shape) that
 * flattens a filtered+sorted ClientesAgrupadosPorEtapa set into the flat id
 * list the Exportar button POSTs to /api/clientes/exportar (05-02 Task 2,
 * D-05). Kept out of KanbanBoard.tsx (a heavy "use client" module) and out
 * of lib/clientes/exportacao.ts (which imports @e965/xlsx and must never
 * reach the client bundle), so it stays unit-testable in isolation and safe
 * to import from a Client Component.
 *
 * Callers MUST pass the already-filtered set (KanbanBoard's `filteredGrouped`),
 * never the unfiltered `grouped` — this is what makes the download mirror
 * exactly what's on screen (EXP-03).
 */
export function collectExportIds(grouped: ClientesAgrupadosPorEtapa): string[] {
  return ETAPA_KEYS.flatMap((key) => grouped[key].map((cliente) => cliente.id))
}
