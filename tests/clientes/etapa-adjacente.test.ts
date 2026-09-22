import { describe, expect, it } from "vitest"

import { ETAPA_KEYS, ETAPAS, etapaAnterior, etapaSeguinte } from "@/lib/funil/etapas"

describe("etapaAnterior/etapaSeguinte (D-02)", () => {
  it("etapaSeguinte('aguardando_contato') devolve 'conversa_comprador'", () => {
    expect(etapaSeguinte("aguardando_contato")).toBe("conversa_comprador")
  })

  it("etapaAnterior('conversa_comprador') devolve 'aguardando_contato'", () => {
    expect(etapaAnterior("conversa_comprador")).toBe("aguardando_contato")
  })

  it("etapaAnterior('aguardando_contato') devolve null (não existe etapa antes da primeira)", () => {
    expect(etapaAnterior("aguardando_contato")).toBeNull()
  })

  it("etapaSeguinte('primeira_venda') devolve null (não existe etapa depois da última)", () => {
    expect(etapaSeguinte("primeira_venda")).toBeNull()
  })

  it("percorre ETAPA_KEYS inteiro: cada vizinho bate com o índice adjacente", () => {
    for (let i = 1; i < ETAPA_KEYS.length; i++) {
      expect(etapaAnterior(ETAPA_KEYS[i])).toBe(ETAPA_KEYS[i - 1])
    }
    for (let i = 0; i < ETAPA_KEYS.length - 1; i++) {
      expect(etapaSeguinte(ETAPA_KEYS[i])).toBe(ETAPA_KEYS[i + 1])
    }
  })

  it("ida e volta fecha: etapaSeguinte(etapaAnterior(k)) volta para k sempre que etapaAnterior(k) não é nulo", () => {
    for (const k of ETAPA_KEYS) {
      const anterior = etapaAnterior(k)
      if (anterior !== null) {
        expect(etapaSeguinte(anterior)).toBe(k)
      }
    }
  })

  it("ETAPAS continua com 7 etapas (sanity check da grade usada acima)", () => {
    expect(ETAPAS).toHaveLength(7)
  })
})
