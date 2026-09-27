import { describe, expect, it } from "vitest"

import {
  apareceNaProspeccao,
  STATUS_FORA_DA_PROSPECCAO_LISTA,
} from "../../lib/funil/prospeccao"
import type { StatusAcompanhamento } from "../../lib/supabase/queries/clientes"

/**
 * Unit tests for the regra de visibilidade do funil de prospecção — fonte
 * única consumida tanto pelo filtro SQL quanto pela guarda do laço de
 * agrupamento em getClientesAgrupadosPorEtapa.
 *
 * Fase 28 (PERD-01, D-06): a regra deixou de excluir um status só ("ganho",
 * quick task 260915-ls7) e passou a excluir um CONJUNTO de dois ("ganho" e
 * "perdido") das 7 colunas do Kanban.
 *
 * Fase 29 (D-13): a regra passa de dois para TRÊS status excluídos — cliente
 * encerrado (era ganho, parou de comprar) também some das 7 colunas e passa
 * a ser encontrado na tela Encerrados.
 */

const TODOS_OS_STATUS: StatusAcompanhamento[] = [
  "em_andamento",
  "perdido",
  "ganho",
  "encerrado",
]

describe("apareceNaProspeccao", () => {
  it("cliente em andamento aparece no funil de prospecção", () => {
    expect(apareceNaProspeccao("em_andamento")).toBe(true)
  })

  it("cliente perdido sai do funil de prospecção (PERD-01/D-06)", () => {
    expect(apareceNaProspeccao("perdido")).toBe(false)
  })

  it("cliente ganho sai do funil de prospecção", () => {
    expect(apareceNaProspeccao("ganho")).toBe(false)
  })

  it("cliente encerrado sai do funil de prospecção (Fase 29, D-13)", () => {
    expect(apareceNaProspeccao("encerrado")).toBe(false)
  })

  it("STATUS_FORA_DA_PROSPECCAO_LISTA vale exatamente ['ganho', 'perdido', 'encerrado']", () => {
    expect(STATUS_FORA_DA_PROSPECCAO_LISTA).toEqual([
      "ganho",
      "perdido",
      "encerrado",
    ])
  })

  it("exatamente três dos quatro status possíveis saem da prospecção", () => {
    const escondidos = TODOS_OS_STATUS.filter(
      (status) => !apareceNaProspeccao(status)
    )
    expect(escondidos).toEqual(["perdido", "ganho", "encerrado"])
  })

  it("em_andamento é o único status que continua aparecendo na prospecção", () => {
    const visiveis = TODOS_OS_STATUS.filter((status) =>
      apareceNaProspeccao(status)
    )
    expect(visiveis).toEqual(["em_andamento"])
  })
})
