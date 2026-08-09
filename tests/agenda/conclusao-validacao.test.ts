import { describe, expect, it } from "vitest"

import { geraProximaVisita } from "../../lib/funil/frequencia"
import {
  RESUMO_MAX,
  RESUMO_MIN,
  RESUMO_MSG_CURTO,
  RESUMO_MSG_LONGO,
  RESUMO_MSG_VAZIO,
  validarResumo,
} from "../../lib/validations/agenda"

/**
 * Testes puros do Task 1 (15-02) — sem banco, sem sessão, sem componente.
 * Cobrem os limites do resumo compartilhado (CONC-01, espelhando
 * chk_tarefas_resumo_tamanho/chk_visitas_resumo_tamanho da migration 0015)
 * e a decisão de cadência (VIS-03).
 */

function resumoDe(tamanho: number): string {
  return "a".repeat(tamanho)
}

describe("validarResumo: limite minimo", () => {
  it("minimo: resumo com 10 caracteres exatos e aceito", () => {
    const resultado = validarResumo(resumoDe(RESUMO_MIN))
    expect(resultado).toEqual({ valido: true, resumo: resumoDe(RESUMO_MIN) })
  })

  it("curto: resumo com 9 caracteres e recusado com a mensagem de curto demais", () => {
    const resultado = validarResumo(resumoDe(RESUMO_MIN - 1))
    expect(resultado).toEqual({ valido: false, message: RESUMO_MSG_CURTO })
  })
})

describe("validarResumo: limite maximo", () => {
  it("maximo: resumo com 500 caracteres exatos e aceito", () => {
    const resultado = validarResumo(resumoDe(RESUMO_MAX))
    expect(resultado).toEqual({ valido: true, resumo: resumoDe(RESUMO_MAX) })
  })

  it("longo: resumo com 501 caracteres e recusado com a mensagem de longo demais", () => {
    const resultado = validarResumo(resumoDe(RESUMO_MAX + 1))
    expect(resultado).toEqual({ valido: false, message: RESUMO_MSG_LONGO })
  })
})

describe("validarResumo: vazio e espacos", () => {
  it("vazio: resumo vazio e recusado com a mensagem de vazio", () => {
    const resultado = validarResumo("")
    expect(resultado).toEqual({ valido: false, message: RESUMO_MSG_VAZIO })
  })

  it("espacos: resumo so com espacos e quebras de linha e recusado com a mensagem de vazio, nao a de curto demais", () => {
    const resultado = validarResumo("   \n\t  \n  ")
    expect(resultado).toEqual({ valido: false, message: RESUMO_MSG_VAZIO })
  })
})

describe("validarResumo: aparado", () => {
  it("aparado: resumo com espacos nas pontas e 12 caracteres de conteudo real e aceito e o valor devolvido vem aparado", () => {
    const conteudo = resumoDe(12)
    const resultado = validarResumo(`  ${conteudo}  `)
    expect(resultado).toEqual({ valido: true, resumo: conteudo })
  })

  it("aparado curto: resumo cujo conteudo real tem 8 caracteres mas chega a 12 por causa de espacos nas pontas e recusado", () => {
    const conteudo = resumoDe(8)
    const resultado = validarResumo(`  ${conteudo}  `)
    expect(resultado).toEqual({ valido: false, message: RESUMO_MSG_CURTO })
  })
})

describe("geraProximaVisita: decisao de cadencia (VIS-03)", () => {
  it("cadencia: devolve verdadeiro para as tres frequencias reais", () => {
    expect(geraProximaVisita("semanal")).toBe(true)
    expect(geraProximaVisita("quinzenal")).toBe(true)
    expect(geraProximaVisita("mensal")).toBe(true)
  })

  it("cadencia: devolve falso para a frequencia sem cadencia", () => {
    expect(geraProximaVisita("nenhuma")).toBe(false)
  })

  it("cadencia: devolve falso para ausencia de frequencia (null/undefined)", () => {
    expect(geraProximaVisita(null)).toBe(false)
    expect(geraProximaVisita(undefined)).toBe(false)
  })
})
