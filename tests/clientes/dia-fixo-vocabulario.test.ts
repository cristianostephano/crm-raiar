import { describe, expect, it } from "vitest"

import {
  ancoraCompleta,
  DIA_SEMANA_ITEMS,
  DIA_SEMANA_LABELS,
  DIAS_SEMANA,
  exigeSemanaDoMes,
  isDiaSemanaVisita,
  isSemanaDoMesVisita,
  normalizarAncora,
  SEMANA_DO_MES_ITEMS,
  SEMANA_DO_MES_LABELS,
  SEMANAS_DO_MES,
} from "@/lib/funil/diaFixo"

describe("DIAS_SEMANA / DIA_SEMANA_LABELS (ANCORA-01, ANCORA-02, 24-02)", () => {
  it("os sete rótulos internos existem, na mesma ordem do tipo dia_semana_enum da migration 0026, começando no domingo", () => {
    expect(DIAS_SEMANA).toEqual([
      "domingo",
      "segunda",
      "terca",
      "quarta",
      "quinta",
      "sexta",
      "sabado",
    ])
  })

  it("cada dia da semana tem um rótulo de tela em português com acentuação correta", () => {
    expect(DIA_SEMANA_LABELS).toEqual({
      domingo: "Domingo",
      segunda: "Segunda-feira",
      terca: "Terça-feira",
      quarta: "Quarta-feira",
      quinta: "Quinta-feira",
      sexta: "Sexta-feira",
      sabado: "Sábado",
    })
  })

  it("DIA_SEMANA_ITEMS deriva do mapa de rótulos, um item por dia, na mesma ordem", () => {
    expect(DIA_SEMANA_ITEMS).toEqual(
      DIAS_SEMANA.map((value) => ({ value, label: DIA_SEMANA_LABELS[value] }))
    )
  })
})

describe("SEMANAS_DO_MES / SEMANA_DO_MES_LABELS (ANCORA-02, 24-02)", () => {
  it("as cinco semanas do mês existem, nesta ordem", () => {
    expect(SEMANAS_DO_MES).toEqual([
      "primeira",
      "segunda",
      "terceira",
      "quarta",
      "ultima",
    ])
  })

  it("os rótulos de tela são 1ª/2ª/3ª/4ª semana e Última semana — nunca uma sexta opção", () => {
    expect(SEMANA_DO_MES_LABELS).toEqual({
      primeira: "1ª semana",
      segunda: "2ª semana",
      terceira: "3ª semana",
      quarta: "4ª semana",
      ultima: "Última semana",
    })
    expect(Object.keys(SEMANA_DO_MES_LABELS)).toHaveLength(5)
  })

  it("SEMANA_DO_MES_ITEMS deriva do mapa de rótulos, um item por semana, na mesma ordem", () => {
    expect(SEMANA_DO_MES_ITEMS).toEqual(
      SEMANAS_DO_MES.map((value) => ({
        value,
        label: SEMANA_DO_MES_LABELS[value],
      }))
    )
  })
})

describe("isDiaSemanaVisita (T-24-07, 24-02)", () => {
  it.each(DIAS_SEMANA)("aceita o rótulo válido '%s'", (dia) => {
    expect(isDiaSemanaVisita(dia)).toBe(true)
  })

  it("recusa texto desconhecido", () => {
    expect(isDiaSemanaVisita("feriado")).toBe(false)
  })

  it("recusa valor ausente (undefined e null)", () => {
    expect(isDiaSemanaVisita(undefined)).toBe(false)
    expect(isDiaSemanaVisita(null)).toBe(false)
  })

  it("recusa número", () => {
    expect(isDiaSemanaVisita(1)).toBe(false)
  })

  it("recusa objeto", () => {
    expect(isDiaSemanaVisita({ dia: "segunda" })).toBe(false)
  })
})

describe("isSemanaDoMesVisita (T-24-07, 24-02)", () => {
  it.each(SEMANAS_DO_MES)("aceita o rótulo válido '%s'", (semana) => {
    expect(isSemanaDoMesVisita(semana)).toBe(true)
  })

  it("recusa texto desconhecido", () => {
    expect(isSemanaDoMesVisita("quinta")).toBe(false)
  })

  it("recusa valor ausente (undefined e null)", () => {
    expect(isSemanaDoMesVisita(undefined)).toBe(false)
    expect(isSemanaDoMesVisita(null)).toBe(false)
  })

  it("recusa número", () => {
    expect(isSemanaDoMesVisita(4)).toBe(false)
  })

  it("recusa objeto", () => {
    expect(isSemanaDoMesVisita({ semana: "ultima" })).toBe(false)
  })
})

describe("exigeSemanaDoMes (D-02, 24-02)", () => {
  it("verdadeiro só para mensal", () => {
    expect(exigeSemanaDoMes("mensal")).toBe(true)
  })

  it.each(["semanal", "quinzenal", "nenhuma"] as const)(
    "falso para '%s'",
    (frequencia) => {
      expect(exigeSemanaDoMes(frequencia)).toBe(false)
    }
  )

  it("falso quando a frequência é nula ou ausente", () => {
    expect(exigeSemanaDoMes(null)).toBe(false)
    expect(exigeSemanaDoMes(undefined)).toBe(false)
  })
})

describe("normalizarAncora (T-24-09, 24-02)", () => {
  it("sem cadência (ausente): os dois campos voltam vazios mesmo se algo foi passado", () => {
    expect(normalizarAncora(undefined, "quinta", "ultima")).toEqual({
      diaSemana: null,
      semanaDoMes: null,
    })
  })

  it("sem cadência ('nenhuma'): os dois campos voltam vazios mesmo se algo foi passado", () => {
    expect(normalizarAncora("nenhuma", "quinta", "ultima")).toEqual({
      diaSemana: null,
      semanaDoMes: null,
    })
  })

  it("semanal: dia da semana preservado, semana do mês sempre vazia mesmo se algo foi passado", () => {
    expect(normalizarAncora("semanal", "quinta", "ultima")).toEqual({
      diaSemana: "quinta",
      semanaDoMes: null,
    })
  })

  it("quinzenal: dia da semana preservado, semana do mês sempre vazia mesmo se algo foi passado", () => {
    expect(normalizarAncora("quinzenal", "sexta", "primeira")).toEqual({
      diaSemana: "sexta",
      semanaDoMes: null,
    })
  })

  it("mensal: os dois campos preservados", () => {
    expect(normalizarAncora("mensal", "quinta", "ultima")).toEqual({
      diaSemana: "quinta",
      semanaDoMes: "ultima",
    })
  })

  it("semanal sem dia da semana informado: devolve nulo, nunca inventa um valor", () => {
    expect(normalizarAncora("semanal", null, null)).toEqual({
      diaSemana: null,
      semanaDoMes: null,
    })
  })
})

describe("ancoraCompleta (D-01, 24-02)", () => {
  it("verdadeiro quando não há cadência — nada a definir", () => {
    expect(ancoraCompleta("nenhuma", null, null)).toBe(true)
    expect(ancoraCompleta(null, null, null)).toBe(true)
    expect(ancoraCompleta(undefined, null, null)).toBe(true)
  })

  it("verdadeiro para semanal/quinzenal com dia da semana preenchido", () => {
    expect(ancoraCompleta("semanal", "segunda", null)).toBe(true)
    expect(ancoraCompleta("quinzenal", "sabado", null)).toBe(true)
  })

  it("falso para semanal/quinzenal sem dia da semana", () => {
    expect(ancoraCompleta("semanal", null, null)).toBe(false)
    expect(ancoraCompleta("quinzenal", null, null)).toBe(false)
  })

  it("mensal só é verdadeiro quando os DOIS campos estão preenchidos", () => {
    expect(ancoraCompleta("mensal", "quinta", "ultima")).toBe(true)
    expect(ancoraCompleta("mensal", "quinta", null)).toBe(false)
    expect(ancoraCompleta("mensal", null, "ultima")).toBe(false)
    expect(ancoraCompleta("mensal", null, null)).toBe(false)
  })
})
