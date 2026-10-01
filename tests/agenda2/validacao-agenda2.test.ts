import { describe, expect, it } from "vitest"

import {
  AGENDA2_BAIRRO_MAX,
  AGENDA2_DIGITOS_SEGUIDOS_MAX,
  AGENDA2_MSG_BAIRRO_DOCUMENTO,
  AGENDA2_MSG_BAIRRO_LONGO,
  AGENDA2_MSG_BAIRRO_VAZIO,
  AGENDA2_MSG_DATA_INVALIDA,
  AGENDA2_MSG_DATA_VAZIA,
  AGENDA2_MSG_NOME_DOCUMENTO,
  AGENDA2_MSG_NOME_LONGO,
  AGENDA2_MSG_NOME_VAZIO,
  AGENDA2_NOME_MAX,
  agenda2ItemIdSchema,
  agenda2ItemSchema,
  contemSequenciaLongaDeDigitos,
} from "../../lib/validations/agenda2"

/**
 * Testes do schema compartilhado do item da Agenda 2 (31-02 Tarefa 2) — o
 * MESMO schema que valida no navegador (formulário, Plano 31-07) e de novo
 * na Server Action (Plano 31-04). Puro: sem next/*, sem cliente de banco.
 */

const DATA_VALIDA = "2026-10-01"
const NOME_VALIDO = "Mercado Bom Preço"
const BAIRRO_VALIDO = "Centro"

function primeiraMensagem(result: ReturnType<typeof agenda2ItemSchema.safeParse>) {
  if (result.success) return undefined
  return result.error.issues[0]?.message
}

describe("agenda2ItemSchema", () => {
  it("aceita-valido-aparado", () => {
    const result = agenda2ItemSchema.safeParse({
      nomeCliente: "  Mercado Bom Preço ",
      bairro: " Centro ",
      data: DATA_VALIDA,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.nomeCliente).toBe("Mercado Bom Preço")
      expect(result.data.bairro).toBe("Centro")
    }
  })

  it("nome-vazio", () => {
    for (const nomeCliente of ["", "   "]) {
      const result = agenda2ItemSchema.safeParse({
        nomeCliente,
        bairro: BAIRRO_VALIDO,
        data: DATA_VALIDA,
      })

      expect(result.success).toBe(false)
      expect(primeiraMensagem(result)).toBe(AGENDA2_MSG_NOME_VAZIO)
    }
  })

  it("nome-limite", () => {
    const nome120 = "a".repeat(120)
    const nome121 = "a".repeat(121)

    const resultadoNoLimite = agenda2ItemSchema.safeParse({
      nomeCliente: nome120,
      bairro: BAIRRO_VALIDO,
      data: DATA_VALIDA,
    })
    expect(resultadoNoLimite.success).toBe(true)

    const resultadoAcimaDoLimite = agenda2ItemSchema.safeParse({
      nomeCliente: nome121,
      bairro: BAIRRO_VALIDO,
      data: DATA_VALIDA,
    })
    expect(resultadoAcimaDoLimite.success).toBe(false)
    expect(primeiraMensagem(resultadoAcimaDoLimite)).toBe(AGENDA2_MSG_NOME_LONGO)
  })

  it("bairro-vazio", () => {
    const result = agenda2ItemSchema.safeParse({
      nomeCliente: NOME_VALIDO,
      bairro: "",
      data: DATA_VALIDA,
    })

    expect(result.success).toBe(false)
    expect(primeiraMensagem(result)).toBe(AGENDA2_MSG_BAIRRO_VAZIO)
  })

  it("bairro-limite", () => {
    const bairro60 = "a".repeat(60)
    const bairro61 = "a".repeat(61)

    const resultadoNoLimite = agenda2ItemSchema.safeParse({
      nomeCliente: NOME_VALIDO,
      bairro: bairro60,
      data: DATA_VALIDA,
    })
    expect(resultadoNoLimite.success).toBe(true)

    const resultadoAcimaDoLimite = agenda2ItemSchema.safeParse({
      nomeCliente: NOME_VALIDO,
      bairro: bairro61,
      data: DATA_VALIDA,
    })
    expect(resultadoAcimaDoLimite.success).toBe(false)
    expect(primeiraMensagem(resultadoAcimaDoLimite)).toBe(AGENDA2_MSG_BAIRRO_LONGO)
  })

  it("data-vazia", () => {
    const result = agenda2ItemSchema.safeParse({
      nomeCliente: NOME_VALIDO,
      bairro: BAIRRO_VALIDO,
      data: "",
    })

    expect(result.success).toBe(false)
    expect(primeiraMensagem(result)).toBe(AGENDA2_MSG_DATA_VAZIA)
  })

  it("data-invalida", () => {
    for (const data of ["28/09/2026", "2026-02-30"]) {
      const result = agenda2ItemSchema.safeParse({
        nomeCliente: NOME_VALIDO,
        bairro: BAIRRO_VALIDO,
        data,
      })

      expect(result.success).toBe(false)
      expect(primeiraMensagem(result)).toBe(AGENDA2_MSG_DATA_INVALIDA)
    }
  })

  it("data-passada-aceita", () => {
    const result = agenda2ItemSchema.safeParse({
      nomeCliente: NOME_VALIDO,
      bairro: BAIRRO_VALIDO,
      data: "2020-01-15",
    })

    expect(result.success).toBe(true)
  })

  it("documento-no-nome", () => {
    const nomes = [
      "Cliente 123.456.789-09", // CPF
      "12.345.678 Fulano de Tal", // raiz de CNPJ
      "Loja 11 99999-0000", // telefone
    ]

    for (const nomeCliente of nomes) {
      const result = agenda2ItemSchema.safeParse({
        nomeCliente,
        bairro: BAIRRO_VALIDO,
        data: DATA_VALIDA,
      })

      expect(result.success).toBe(false)
      expect(primeiraMensagem(result)).toBe(AGENDA2_MSG_NOME_DOCUMENTO)
    }
  })

  it("numeros-curtos-aceitos", () => {
    const nomes = ["Padaria 2 Irmãos 1990", "Mercado 24h", "Empório 1234567"]

    for (const nomeCliente of nomes) {
      const result = agenda2ItemSchema.safeParse({
        nomeCliente,
        bairro: BAIRRO_VALIDO,
        data: DATA_VALIDA,
      })

      expect(result.success).toBe(true)
    }
  })

  it("documento-no-bairro", () => {
    const resultadoCep = agenda2ItemSchema.safeParse({
      nomeCliente: NOME_VALIDO,
      bairro: "01310-100",
      data: DATA_VALIDA,
    })
    expect(resultadoCep.success).toBe(false)
    expect(primeiraMensagem(resultadoCep)).toBe(AGENDA2_MSG_BAIRRO_DOCUMENTO)

    const resultadoNumeroCurto = agenda2ItemSchema.safeParse({
      nomeCliente: NOME_VALIDO,
      bairro: "Jardim 2000",
      data: DATA_VALIDA,
    })
    expect(resultadoNumeroCurto.success).toBe(true)
  })

  it("sem-campos-extras", () => {
    const result = agenda2ItemSchema.safeParse({
      nomeCliente: NOME_VALIDO,
      bairro: BAIRRO_VALIDO,
      data: DATA_VALIDA,
      vendedorId: "vendedor-a",
      concluido: true,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(Object.keys(result.data).sort()).toEqual([
        "bairro",
        "data",
        "nomeCliente",
      ])
    }
  })
})

describe("contemSequenciaLongaDeDigitos", () => {
  it("contem-sequencia", () => {
    expect(contemSequenciaLongaDeDigitos("1234567")).toBe(false)
    expect(contemSequenciaLongaDeDigitos("12345678")).toBe(true)
    expect(contemSequenciaLongaDeDigitos("12.345-678")).toBe(true)
    expect(contemSequenciaLongaDeDigitos("12 34 56 78")).toBe(true)
    expect(contemSequenciaLongaDeDigitos("abc")).toBe(false)
  })
})

describe("agenda2ItemIdSchema", () => {
  it("id-uuid", () => {
    expect(
      agenda2ItemIdSchema.safeParse("11111111-1111-4111-8111-111111111111")
        .success
    ).toBe(true)
    expect(agenda2ItemIdSchema.safeParse("abc").success).toBe(false)
    expect(agenda2ItemIdSchema.safeParse("").success).toBe(false)
  })
})

describe("constantes", () => {
  it("constantes", () => {
    expect(AGENDA2_NOME_MAX).toBe(120)
    expect(AGENDA2_BAIRRO_MAX).toBe(60)
    expect(AGENDA2_DIGITOS_SEGUIDOS_MAX).toBe(7)
  })
})
