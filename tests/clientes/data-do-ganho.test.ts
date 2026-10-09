import { describe, expect, it } from "vitest"

import {
  DATA_GANHO_MINIMA,
  hojeEmSaoPaulo,
  validarDataDoGanho,
} from "@/lib/clientes/dataDoGanho"
import { createClienteSchema, updateClienteSchema } from "@/lib/validations/cliente"

/**
 * Regra unica da "Data do ganho" (quick 261008-rxw, D-17/P-14): a mesma
 * funcao pura vale no navegador e no servidor. Casos puros, sem banco: a
 * funcao de hoje em Sao Paulo, a validacao e o encaixe no schema de edicao.
 * Datas de "amanha"/"hoje" sao calculadas a partir de hojeEmSaoPaulo, nunca
 * literais que envelhecam.
 */

function diaSeguinte(hoje: string): string {
  const [ano, mes, dia] = hoje.split("-").map(Number)
  const proximo = new Date(Date.UTC(ano, mes - 1, dia + 1))
  return proximo.toISOString().slice(0, 10)
}

function clienteValido() {
  return {
    id: "c1",
    razaoSocial: "Padaria Central Ltda",
    cep: "",
    rua: "",
    numero: "",
    cidade: "",
    estado: "" as const,
    responsavel: "v1",
  }
}

describe("hojeEmSaoPaulo", () => {
  it("antes das 03:00Z ainda e o dia anterior em Sao Paulo", () => {
    expect(hojeEmSaoPaulo(new Date("2026-10-09T02:30:00Z"))).toBe("2026-10-08")
  })

  it("a partir das 03:00Z ja e o dia novo em Sao Paulo", () => {
    expect(hojeEmSaoPaulo(new Date("2026-10-09T03:30:00Z"))).toBe("2026-10-09")
  })
})

describe("validarDataDoGanho", () => {
  const hoje = "2026-10-08"

  it("vazio e valido (significa limpar a data)", () => {
    expect(validarDataDoGanho("", hoje)).toBeNull()
  })

  it("uma data passada comum e valida", () => {
    expect(validarDataDoGanho("2024-05-20", hoje)).toBeNull()
  })

  it("hoje e valido", () => {
    expect(validarDataDoGanho("2026-10-08", hoje)).toBeNull()
  })

  it("amanha e recusado como futuro", () => {
    expect(validarDataDoGanho("2026-10-09", hoje)).toBe("A data do ganho não pode ser no futuro.")
  })

  it("data de calendario inexistente e formato errado sao recusados", () => {
    expect(validarDataDoGanho("2024-02-30", hoje)).toBe("Informe uma data válida.")
    expect(validarDataDoGanho("20-05-2024", hoje)).toBe("Informe uma data válida.")
  })

  it("antes de 01/01/1990 e recusado; 01/01/1990 e aceito", () => {
    expect(DATA_GANHO_MINIMA).toBe("1990-01-01")
    expect(validarDataDoGanho("1989-12-31", hoje)).toBe("Informe uma data a partir de 01/01/1990.")
    expect(validarDataDoGanho("1990-01-01", hoje)).toBeNull()
  })
})

describe("updateClienteSchema com ganhoEm", () => {
  it("schema-sem-campo: aceita o objeto valido SEM ganhoEm e o resultado nao tem ganhoEm", () => {
    const resultado = updateClienteSchema.safeParse(clienteValido())

    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect("ganhoEm" in resultado.data).toBe(false)
    }
  })

  it("schema-vazio: aceita ganhoEm vazio", () => {
    expect(updateClienteSchema.safeParse({ ...clienteValido(), ganhoEm: "" }).success).toBe(true)
  })

  it("schema-passado: aceita uma data de 2019, anterior a qualquer cadastro no CRM", () => {
    expect(updateClienteSchema.safeParse({ ...clienteValido(), ganhoEm: "2019-03-15" }).success).toBe(true)
  })

  it("schema-futuro: recusa amanha de Sao Paulo, com a mensagem no campo ganhoEm", () => {
    const amanha = diaSeguinte(hojeEmSaoPaulo())
    const resultado = updateClienteSchema.safeParse({ ...clienteValido(), ganhoEm: amanha })

    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      const issue = resultado.error.issues.find((i) => i.path[0] === "ganhoEm")
      expect(issue?.message).toBe("A data do ganho não pode ser no futuro.")
    }
  })

  it("schema-invalido: recusa 2024-13-01", () => {
    const resultado = updateClienteSchema.safeParse({ ...clienteValido(), ganhoEm: "2024-13-01" })

    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues.some((i) => i.path[0] === "ganhoEm")).toBe(true)
    }
  })
})

describe("createClienteSchema", () => {
  it("cadastro-ignora: um objeto com ganhoEm devolve resultado SEM ganhoEm", () => {
    const resultado = createClienteSchema.safeParse({
      razaoSocial: "Padaria Central Ltda",
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      cidade: "São Paulo",
      estado: "SP",
      responsavel: "v1",
      ganhoEm: "2024-05-20",
    })

    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect("ganhoEm" in resultado.data).toBe(false)
    }
  })
})
