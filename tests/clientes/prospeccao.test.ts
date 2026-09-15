import { describe, expect, it } from "vitest"

import {
  apareceNaProspeccao,
  STATUS_FORA_DA_PROSPECCAO,
} from "../../lib/funil/prospeccao"
import type { StatusAcompanhamento } from "../../lib/supabase/queries/clientes"

/**
 * Unit tests for the regra de visibilidade do funil de prospecção (quick
 * task 260915-ls7) — fonte única consumida tanto pelo filtro SQL quanto pela
 * guarda do laço de agrupamento em getClientesAgrupadosPorEtapa.
 */

const TODOS_OS_STATUS: StatusAcompanhamento[] = [
  "em_andamento",
  "perdido",
  "ganho",
]

describe("apareceNaProspeccao", () => {
  it("cliente em andamento aparece no funil de prospecção", () => {
    expect(apareceNaProspeccao("em_andamento")).toBe(true)
  })

  it("cliente perdido continua aparecendo no funil de prospecção", () => {
    expect(apareceNaProspeccao("perdido")).toBe(true)
  })

  it("cliente ganho sai do funil de prospecção", () => {
    expect(apareceNaProspeccao("ganho")).toBe(false)
  })

  it("STATUS_FORA_DA_PROSPECCAO vale exatamente 'ganho'", () => {
    expect(STATUS_FORA_DA_PROSPECCAO).toBe("ganho")
  })

  it("exatamente um dos três status possíveis sai da prospecção", () => {
    const escondidos = TODOS_OS_STATUS.filter(
      (status) => !apareceNaProspeccao(status)
    )
    expect(escondidos).toEqual(["ganho"])
  })
})
