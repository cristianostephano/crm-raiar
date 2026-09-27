import { describe, expect, it } from "vitest"

import {
  mesclarAderencia,
  rotuloAderencia,
  TEXTO_TOOLTIP_ADERENCIA,
  type ComparativoVendedorLinha,
} from "@/lib/aderencia/exibicao"
import type {
  AderenciaUsoRow,
  ComparativoVendedorRow,
} from "@/lib/supabase/queries/dashboard"

/**
 * Testes de tests/dashboard/aderencia-exibicao.test.ts (30-05-PLAN.md Tarefa
 * 1) — módulo puro, sem dublê de Supabase: rotuloAderencia() decide o que
 * cada célula mostra (D-09/ADER-03) e mesclarAderencia() junta o comparativo
 * já existente (VEND-01) com a leitura nova de aderência, por `responsavel`.
 */

function buildAderencia(partial: Partial<AderenciaUsoRow> = {}): AderenciaUsoRow {
  return {
    responsavel: "v1",
    diasUsados: 0,
    diasUteis: 0,
    aderenciaPct: null,
    coletandoDesde: null,
    ...partial,
  }
}

function buildComparativo(
  partial: Partial<ComparativoVendedorRow> = {}
): ComparativoVendedorRow {
  return {
    responsavel: "v1",
    responsavelNome: "Vendedor Um",
    negociosIniciados: 0,
    ganho: 0,
    perdido: 0,
    cicloMedioDias: null,
    taxaConversao: null,
    ...partial,
  }
}

describe("rotuloAderencia", () => {
  it("nulo-vira-travessao: rotuloAderencia(null) devolve travessão, sem detalhe, coletando falso", () => {
    expect(rotuloAderencia(null)).toEqual({
      principal: "—",
      detalhe: null,
      coletando: false,
    })
  })

  it("coletando-com-data: coletandoDesde preenchido devolve o aviso formatado, sem detalhe, coletando verdadeiro", () => {
    const resultado = rotuloAderencia(
      buildAderencia({ coletandoDesde: "2026-09-27" })
    )

    expect(resultado).toEqual({
      principal: "Coletando dados desde 27/09/2026",
      detalhe: null,
      coletando: true,
    })
  })

  it("coletando-vence-percentual: coletandoDesde preenchido some com o percentual mesmo com aderenciaPct presente", () => {
    const resultado = rotuloAderencia(
      buildAderencia({ coletandoDesde: "2026-09-27", aderenciaPct: 50 })
    )

    expect(resultado.principal).toBe("Coletando dados desde 27/09/2026")
    expect(resultado.principal).not.toContain("%")
  })

  it("denominador-zero-mesmo-texto: diasUteis 0 e coletandoDesde preenchido usa o MESMO texto de janela incompleta", () => {
    const resultado = rotuloAderencia(
      buildAderencia({
        diasUteis: 0,
        aderenciaPct: null,
        coletandoDesde: "2026-10-01",
      })
    )

    expect(resultado.principal).toBe("Coletando dados desde 01/10/2026")
  })

  it("percentual-ja-em-pontos: aderenciaPct 85 nunca é multiplicado de novo", () => {
    const resultado = rotuloAderencia(
      buildAderencia({ aderenciaPct: 85, diasUsados: 17, diasUteis: 20 })
    )

    expect(resultado.principal).toBe("85,0%")
    expect(resultado.principal).not.toBe("8.500,0%")
    expect(resultado.detalhe).toBe("17 de 20 dias úteis")
    expect(resultado.coletando).toBe(false)
  })

  it("percentual-decimal: aderenciaPct 15.5 mostra uma casa decimal no formato brasileiro", () => {
    const resultado = rotuloAderencia(buildAderencia({ aderenciaPct: 15.5 }))

    expect(resultado.principal).toBe("15,5%")
  })

  it("singular: diasUteis 1 mostra 'dia útil' no singular", () => {
    const resultado = rotuloAderencia(
      buildAderencia({ diasUsados: 1, diasUteis: 1, aderenciaPct: 100 })
    )

    expect(resultado.detalhe).toBe("1 de 1 dia útil")
  })

  it("pct-nulo-defensivo: coletandoDesde nulo e aderenciaPct nulo devolve travessão", () => {
    const resultado = rotuloAderencia(
      buildAderencia({ coletandoDesde: null, aderenciaPct: null })
    )

    expect(resultado).toEqual({
      principal: "—",
      detalhe: null,
      coletando: false,
    })
  })

  it("tooltip-texto: TEXTO_TOOLTIP_ADERENCIA é exatamente o texto travado", () => {
    expect(TEXTO_TOOLTIP_ADERENCIA).toBe(
      "Dias úteis (segunda a sexta) com uso do sistema nos últimos 28 dias — entrar no sistema, mover etapa, concluir tarefa ou visita, ou cadastrar ou editar cliente."
    )
  })
})

describe("mesclarAderencia", () => {
  it("mesclar-preserva-ordem: preserva a ordem e as linhas do comparativo, vendedor sem aderência recebe nulo", () => {
    const linhas: ComparativoVendedorRow[] = [
      buildComparativo({ responsavel: "v-zeta", responsavelNome: "Zeta" }),
      buildComparativo({ responsavel: "v-alfa", responsavelNome: "Alfa" }),
      buildComparativo({ responsavel: "v-meio", responsavelNome: "Meio" }),
    ]
    const aderencias: AderenciaUsoRow[] = [
      buildAderencia({ responsavel: "v-alfa", aderenciaPct: 80 }),
      buildAderencia({ responsavel: "v-meio", aderenciaPct: 40 }),
    ]

    const resultado: ComparativoVendedorLinha[] = mesclarAderencia(
      linhas,
      aderencias
    )

    expect(resultado.map((linha) => linha.responsavelNome)).toEqual([
      "Zeta",
      "Alfa",
      "Meio",
    ])
    expect(resultado[0].aderencia).toBeNull()
    expect(resultado[1].aderencia?.aderenciaPct).toBe(80)
    expect(resultado[2].aderencia?.aderenciaPct).toBe(40)
  })

  it("mesclar-ignora-sobras: aderência de um id fora do comparativo não aparece e não muda o tamanho", () => {
    const linhas: ComparativoVendedorRow[] = [
      buildComparativo({ responsavel: "v-alfa" }),
    ]
    const aderencias: AderenciaUsoRow[] = [
      buildAderencia({ responsavel: "v-alfa", aderenciaPct: 90 }),
      buildAderencia({ responsavel: "v-fora-do-comparativo", aderenciaPct: 10 }),
    ]

    const resultado = mesclarAderencia(linhas, aderencias)

    expect(resultado).toHaveLength(1)
    expect(resultado[0].aderencia?.aderenciaPct).toBe(90)
  })

  it("mesclar-lista-vazia: aderências vazias deixam todas as linhas com aderencia nula, demais campos intactos", () => {
    const linhas: ComparativoVendedorRow[] = [
      buildComparativo({ responsavel: "v-alfa", negociosIniciados: 7, ganho: 3 }),
    ]

    const resultado = mesclarAderencia(linhas, [])

    expect(resultado).toEqual([
      { ...linhas[0], aderencia: null },
    ])
  })
})
