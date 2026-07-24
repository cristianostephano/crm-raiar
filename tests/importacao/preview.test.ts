import { describe, expect, it } from "vitest"

import { statusBorderClass, summaryCounts } from "@/lib/importacao/preview"

describe("summaryCounts", () => {
  it("counts a mixture of ok/erro/duplicado statuses correctly", () => {
    const linhas = [
      { status: "ok" as const },
      { status: "ok" as const },
      { status: "erro" as const },
      { status: "duplicado" as const },
      { status: "duplicado" as const },
      { status: "duplicado" as const },
    ]

    expect(summaryCounts(linhas)).toEqual({
      total: 6,
      ok: 2,
      erros: 1,
      duplicados: 3,
    })
  })

  it("returns all-zero counts for an empty batch", () => {
    expect(summaryCounts([])).toEqual({
      total: 0,
      ok: 0,
      erros: 0,
      duplicados: 0,
    })
  })
})

describe("statusBorderClass", () => {
  it("maps ok/duplicado/erro to the exact TASK_STATUS_BORDER color vocabulary", () => {
    expect(statusBorderClass("ok")).toBe("border-l-4 border-l-green-500")
    expect(statusBorderClass("duplicado")).toBe(
      "border-l-4 border-l-amber-500"
    )
    expect(statusBorderClass("erro")).toBe("border-l-4 border-l-red-500")
  })
})
