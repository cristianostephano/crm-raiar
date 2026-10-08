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
 *
 * Quick 261008-mrf: a migration 0052 devolve números PARCIAIS durante a
 * coleta (coletandoDesde preenchido e diasUteis > 0); a tela mostra
 * "NN,N% (parcial)" com "N de M dias úteis desde dd/MM". Sem dias úteis
 * contados, o aviso "Coletando dados desde ..." continua.
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

  // Quick 261008-mrf: com dias úteis contados o percentual parcial aparece; sem dias úteis, o aviso continua
  it("coletando-sem-dias-uteis-mantem-aviso: coletandoDesde preenchido e diasUteis 0 mantém o aviso, nunca um percentual sem denominador", () => {
    const resultado = rotuloAderencia(
      buildAderencia({
        coletandoDesde: "2026-09-27",
        aderenciaPct: 50,
        diasUteis: 0,
      })
    )

    expect(resultado.principal).toBe("Coletando dados desde 27/09/2026")
    expect(resultado.principal).not.toContain("%")
    expect(resultado.detalhe).toBeNull()
    expect(resultado.coletando).toBe(true)
  })

  it("parcial-noventa: coletandoDesde + percentual + dias úteis mostra '90,0% (parcial)' e '9 de 10 dias úteis desde 28/09'", () => {
    const resultado = rotuloAderencia(
      buildAderencia({
        coletandoDesde: "2026-09-28",
        aderenciaPct: 90,
        diasUsados: 9,
        diasUteis: 10,
      })
    )

    expect(resultado).toEqual({
      principal: "90,0% (parcial)",
      detalhe: "9 de 10 dias úteis desde 28/09",
      coletando: false,
    })
  })

  it("parcial-cem: 9 de 9 dias úteis mostra '100,0% (parcial)'", () => {
    const resultado = rotuloAderencia(
      buildAderencia({
        coletandoDesde: "2026-09-28",
        aderenciaPct: 100,
        diasUsados: 9,
        diasUteis: 9,
      })
    )

    expect(resultado.principal).toBe("100,0% (parcial)")
    expect(resultado.detalhe).toBe("9 de 9 dias úteis desde 28/09")
  })

  it("parcial-singular: diasUteis 1 mostra 'dia útil' no singular", () => {
    const resultado = rotuloAderencia(
      buildAderencia({
        coletandoDesde: "2026-10-08",
        aderenciaPct: 100,
        diasUsados: 1,
        diasUteis: 1,
      })
    )

    expect(resultado.detalhe).toBe("1 de 1 dia útil desde 08/10")
  })

  it("parcial-zero-por-cento: 0 de 3 dias úteis mostra '0,0% (parcial)'", () => {
    const resultado = rotuloAderencia(
      buildAderencia({
        coletandoDesde: "2026-09-28",
        aderenciaPct: 0,
        diasUsados: 0,
        diasUteis: 3,
      })
    )

    expect(resultado.principal).toBe("0,0% (parcial)")
    expect(resultado.detalhe).toBe("0 de 3 dias úteis desde 28/09")
    expect(resultado.coletando).toBe(false)
  })

  it("parcial-nunca-multiplica: aderenciaPct 85 no parcial nunca vira 8.500,0%", () => {
    const resultado = rotuloAderencia(
      buildAderencia({
        coletandoDesde: "2026-09-28",
        aderenciaPct: 85,
        diasUsados: 17,
        diasUteis: 20,
      })
    )

    expect(resultado.principal).toBe("85,0% (parcial)")
    expect(resultado.principal).not.toContain("8.500")
  })

  it("parcial-data-sem-fuso: a data do 'desde' é lida com parseISO, sem deslocar o dia", () => {
    const resultado = rotuloAderencia(
      buildAderencia({
        coletandoDesde: "2026-10-01",
        aderenciaPct: 50,
        diasUsados: 1,
        diasUteis: 2,
      })
    )

    expect(resultado.detalhe?.endsWith("desde 01/10")).toBe(true)
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
    expect(resultado.principal).not.toContain("parcial")
    expect(resultado.detalhe).not.toContain("desde")
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
      "Dias úteis (segunda a sexta) com uso do sistema nos últimos 28 dias — entrar no sistema, mover etapa, concluir tarefa ou visita, ou cadastrar ou editar cliente. Enquanto a medição ainda não tem 28 dias, o número aparece como (parcial) e conta só os dias úteis desde o início da medição — ou desde a entrada do vendedor no time, se for mais recente."
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
