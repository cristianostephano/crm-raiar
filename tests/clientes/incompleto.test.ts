import { describe, expect, it } from "vitest"

import {
  isClienteIncompleto,
  type ClienteCompletudeInput,
} from "../../lib/supabase/queries/clientes"

/**
 * Unit tests for the D-02 "cadastro incompleto" pure predicate (02-05 Task
 * 1). This is the single function shared by the "Incompleto" card badge and
 * the "Incompletos" tab filter — covering all-blank, all-filled, and the
 * missing-only-produtos edge case here is what guarantees the badge and the
 * tab can never disagree.
 */

const PRODUTO = { id: "produto-1", nome: "Casca" }

function allBlank(): ClienteCompletudeInput {
  return {
    categoria_id: null,
    contato: null,
    telefone: null,
    email: null,
    numero_de_lojas: null,
    produtos: [],
  }
}

function allFilled(): ClienteCompletudeInput {
  return {
    categoria_id: "categoria-1",
    contato: "Fulano de Tal",
    telefone: "11999999999",
    email: "fulano@example.com",
    numero_de_lojas: 3,
    produtos: [PRODUTO],
  }
}

describe("isClienteIncompleto", () => {
  it("is incompleto when every optional field is blank", () => {
    expect(isClienteIncompleto(allBlank())).toBe(true)
  })

  it("is complete when every optional field is filled", () => {
    expect(isClienteIncompleto(allFilled())).toBe(false)
  })

  it("stays incompleto when only produtos consumidos is missing", () => {
    const cliente: ClienteCompletudeInput = {
      ...allFilled(),
      produtos: [],
    }
    expect(isClienteIncompleto(cliente)).toBe(true)
  })

  it("stays incompleto when only categoria is missing", () => {
    const cliente: ClienteCompletudeInput = {
      ...allFilled(),
      categoria_id: null,
    }
    expect(isClienteIncompleto(cliente)).toBe(true)
  })

  it("treats numero_de_lojas = 0 as a filled value (explicit answer, not blank)", () => {
    const cliente: ClienteCompletudeInput = {
      ...allFilled(),
      numero_de_lojas: 0,
    }
    expect(isClienteIncompleto(cliente)).toBe(false)
  })

  it("treats an empty-string optional field as blank", () => {
    const cliente: ClienteCompletudeInput = {
      ...allFilled(),
      contato: "",
    }
    expect(isClienteIncompleto(cliente)).toBe(true)
  })
})
