import { describe, expect, it } from "vitest"

import {
  camposFaltandoParaGanho,
  mensagemFichaIncompleta,
  type FichaParaGanhoInput,
} from "@/lib/funil/fichaParaGanho"

/**
 * Fixture com todos os seis campos preenchidos — cada teste parte daqui e
 * anula só o campo que quer provar, para nunca reescrever a lista inteira
 * de campos a cada caso (23-02).
 */
function fichaCompleta(): FichaParaGanhoInput {
  return {
    razao_social: "Padaria Central Ltda",
    cep: "01310-100",
    rua: "Avenida Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
  }
}

describe("camposFaltandoParaGanho (GANHO-01, 23-02)", () => {
  it("ficha completa: razão social e os 5 campos de endereço preenchidos devolve lista vazia", () => {
    expect(camposFaltandoParaGanho(fichaCompleta())).toEqual([])
  })

  it("razão social nula: a lista traz só o rótulo da razão social", () => {
    expect(
      camposFaltandoParaGanho({ ...fichaCompleta(), razao_social: null })
    ).toEqual(["razão social"])
  })

  it("razão social só de espaços em branco: mesma lista do caso nulo", () => {
    expect(
      camposFaltandoParaGanho({ ...fichaCompleta(), razao_social: "   " })
    ).toEqual(["razão social"])
  })

  it("sem cidade: a lista traz só o rótulo da cidade", () => {
    expect(
      camposFaltandoParaGanho({ ...fichaCompleta(), cidade: null })
    ).toEqual(["cidade"])
  })

  it.each([
    ["cep", "CEP"],
    ["rua", "rua"],
    ["numero", "número"],
    ["cidade", "cidade"],
    ["estado", "estado"],
  ] as const)(
    "campo de endereço '%s' nulo isoladamente traz exatamente o rótulo '%s'",
    (campo, rotulo) => {
      expect(
        camposFaltandoParaGanho({ ...fichaCompleta(), [campo]: null })
      ).toEqual([rotulo])
    }
  )

  it("sem razão social e sem cidade: os dois rótulos, razão social antes dos campos de endereço", () => {
    expect(
      camposFaltandoParaGanho({
        ...fichaCompleta(),
        razao_social: null,
        cidade: null,
      })
    ).toEqual(["razão social", "cidade"])
  })

  it("complemento nunca é campo desta trava (D-04) — ausência de complemento não afeta a lista", () => {
    const ficha = fichaCompleta() as FichaParaGanhoInput & {
      complemento?: string | null
    }
    delete ficha.complemento
    expect(camposFaltandoParaGanho(ficha)).toEqual([])
  })
})

describe("mensagemFichaIncompleta (GANHO-01, 23-02)", () => {
  it("lista com dois rótulos: mensagem contém a orientação e os dois rótulos", () => {
    const mensagem = mensagemFichaIncompleta(["razão social", "cidade"])
    expect(mensagem).toContain("Complete a ficha do cliente antes")
    expect(mensagem).toContain("razão social")
    expect(mensagem).toContain("cidade")
  })

  it("lista vazia: mensagem contém só a orientação, sem lista pendurada", () => {
    const mensagem = mensagemFichaIncompleta([])
    expect(mensagem).toContain("Complete a ficha do cliente antes")
    expect(mensagem).not.toContain(":")
  })
})
