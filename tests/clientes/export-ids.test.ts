import { describe, expect, it } from "vitest"

import { ETAPA_KEYS } from "../../lib/funil/etapas"
import { collectExportIds } from "../../lib/clientes/export-ids"
import type { ClientesAgrupadosPorEtapa } from "../../lib/supabase/queries/clientes"

/**
 * Unit tests for collectExportIds (05-02 Task 2, D-05) — proves the
 * Exportar button will send exactly the on-screen filtered set of ids, in
 * ETAPA_KEYS column order, never the full base.
 */

function emptyGrouped(): ClientesAgrupadosPorEtapa {
  return Object.fromEntries(
    ETAPA_KEYS.map((key) => [key, []])
  ) as unknown as ClientesAgrupadosPorEtapa
}

describe("collectExportIds", () => {
  it("flattens every cliente id across all 7 etapa columns, in ETAPA_KEYS order", () => {
    const grouped = emptyGrouped()
    grouped[ETAPA_KEYS[0]] = [{ id: "a" }, { id: "b" }] as never
    grouped[ETAPA_KEYS[2]] = [{ id: "c" }] as never
    grouped[ETAPA_KEYS[6]] = [{ id: "d" }] as never

    expect(collectExportIds(grouped)).toEqual(["a", "b", "c", "d"])
  })

  it("returns only one column's ids when grouped is narrowed to that column", () => {
    const grouped = emptyGrouped()
    grouped[ETAPA_KEYS[3]] = [{ id: "x" }, { id: "y" }] as never

    expect(collectExportIds(grouped)).toEqual(["x", "y"])
  })

  it("returns an empty array when every column is empty", () => {
    expect(collectExportIds(emptyGrouped())).toEqual([])
  })
})
