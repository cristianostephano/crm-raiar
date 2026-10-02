import { parseISO } from "date-fns"
import { describe, expect, it } from "vitest"

import {
  REPETIR_SEMANAS_VALORES,
  gerarDatasSemanais,
  repeticaoPermitida,
  rotuloRepeticao,
} from "@/lib/agenda2/repeticao"

/**
 * Testes da base pura da repetição semanal da Agenda 2 (32-01 Tarefa 1) —
 * lista fechada de opções, datas de cada ocorrência (N NO TOTAL, D-31), regra
 * "hoje em diante" (D-23) e rótulos do seletor. Sem relógio, sem banco.
 */

describe("REPETIR_SEMANAS_VALORES", () => {
  it("valores", () => {
    expect([...REPETIR_SEMANAS_VALORES]).toEqual([0, 4, 8, 12])
  })
})

describe("gerarDatasSemanais", () => {
  it("zero-uma-data", () => {
    expect(gerarDatasSemanais("2026-10-05", 0)).toEqual(["2026-10-05"])
  })

  it("quatro-no-total", () => {
    expect(gerarDatasSemanais("2026-10-05", 4)).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ])
  })

  it("oito-no-total", () => {
    const datas = gerarDatasSemanais("2026-10-05", 8)

    expect(datas).toHaveLength(8)
    expect(datas[0]).toBe("2026-10-05")
    expect(datas[7]).toBe("2026-11-23")
  })

  it("doze-vira-ano-e-horario-de-verao", () => {
    const datas = gerarDatasSemanais("2026-10-30", 12)
    const diaDaSemana = parseISO("2026-10-30").getDay()

    expect(datas).toHaveLength(12)
    expect(datas[0]).toBe("2026-10-30")
    expect(datas[2]).toBe("2026-11-13")
    expect(datas[11]).toBe("2027-01-15")

    for (const data of datas) {
      expect(parseISO(data).getDay()).toBe(diaDaSemana)
    }
  })

  it("fevereiro-bissexto", () => {
    expect(gerarDatasSemanais("2028-02-22", 4)).toEqual([
      "2028-02-22",
      "2028-02-29",
      "2028-03-07",
      "2028-03-14",
    ])
  })

  it("crescente-e-distinta", () => {
    const datas = gerarDatasSemanais("2026-10-30", 12)

    for (let i = 1; i < datas.length; i++) {
      expect(datas[i] > datas[i - 1]).toBe(true)
    }
    expect(new Set(datas).size).toBe(datas.length)
  })
})

describe("repeticaoPermitida", () => {
  it("repeticao-permitida", () => {
    expect(repeticaoPermitida("", "2026-10-02")).toBe(false)
    expect(repeticaoPermitida("2026-10-01", "2026-10-02")).toBe(false)
    expect(repeticaoPermitida("2026-10-02", "2026-10-02")).toBe(true)
    expect(repeticaoPermitida("2026-10-03", "2026-10-02")).toBe(true)
  })
})

describe("rotuloRepeticao", () => {
  it("rotulos", () => {
    expect(rotuloRepeticao(0)).toBe("Não repetir")
    expect(rotuloRepeticao(4)).toBe("Por 4 semanas (4 visitas, incluindo esta)")
    expect(rotuloRepeticao(8)).toBe("Por 8 semanas (8 visitas, incluindo esta)")
    expect(rotuloRepeticao(12)).toBe(
      "Por 12 semanas (12 visitas, incluindo esta)"
    )
  })
})
