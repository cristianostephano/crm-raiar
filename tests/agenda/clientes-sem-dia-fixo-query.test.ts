import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Teste da consulta getClientesSemDiaFixo (AGD-15, Fase 27 Plano 1) — no
 * database, mocks @/lib/supabase/server inteiramente. Prova que o select
 * pede `nome_fantasia` e que o mapeamento repassa o valor cru (Pattern 1 da
 * pesquisa: a decisão de queda de nome fica só na tela).
 *
 * vi.hoisted() roda antes dos imports (o vi.mock é içado), dando aos espiões
 * uma referência compartilhada com a fábrica do mock e com os testes abaixo —
 * mesmo molde de tests/clientes/todas-cidades.test.ts.
 */
const { selectSpy, rangeSpy } = vi.hoisted(() => ({
  selectSpy: vi.fn(),
  rangeSpy: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: (colunas: string) => {
        selectSpy(colunas)
        return {
          eq: () => ({
            or: () => ({
              order: () => ({
                order: () => ({
                  range: rangeSpy,
                }),
              }),
            }),
          }),
        }
      },
    }),
  }),
}))

import { getClientesSemDiaFixo } from "@/lib/supabase/queries/agenda"

describe("getClientesSemDiaFixo (AGD-15)", () => {
  beforeEach(() => {
    selectSpy.mockReset()
    rangeSpy.mockReset()
  })

  it("o select pede nome_fantasia junto das demais colunas", async () => {
    rangeSpy.mockResolvedValue({ data: [], error: null })

    await getClientesSemDiaFixo()

    expect(selectSpy).toHaveBeenCalledWith(
      "id, razao_social, nome_fantasia, responsavel, profiles(nome, sobrenome), frequencia_visita, dia_semana_visita, semana_do_mes_visita"
    )
  })

  it("mapeia uma linha completa preservando nomeFantasia cru", async () => {
    rangeSpy.mockResolvedValue({
      data: [
        {
          id: "c1",
          razao_social: "Padaria Central Ltda",
          nome_fantasia: "Padaria Central",
          responsavel: "v1",
          profiles: { nome: "Ana", sobrenome: "Souza" },
          frequencia_visita: null,
        },
      ],
      error: null,
    })

    const resultado = await getClientesSemDiaFixo()

    expect(resultado).toEqual([
      {
        clienteId: "c1",
        razaoSocial: "Padaria Central Ltda",
        nomeFantasia: "Padaria Central",
        responsavel: "v1",
        responsavelNome: "Ana Souza",
        frequenciaVisita: null,
      },
    ])
  })

  it("razao_social nula é repassada crua (sem queda aplicada no mapeamento)", async () => {
    rangeSpy.mockResolvedValue({
      data: [
        {
          id: "c2",
          razao_social: null,
          nome_fantasia: "Mercado Bom Preço",
          responsavel: "v1",
          profiles: null,
          frequencia_visita: null,
        },
      ],
      error: null,
    })

    const resultado = await getClientesSemDiaFixo()

    expect(resultado[0].razaoSocial).toBeNull()
    expect(resultado[0].nomeFantasia).toBe("Mercado Bom Preço")
  })

  it("nome_fantasia nulo vira nomeFantasia null (nunca undefined ou string vazia)", async () => {
    rangeSpy.mockResolvedValue({
      data: [
        {
          id: "c3",
          razao_social: "Mercearia Nova",
          nome_fantasia: null,
          responsavel: "v1",
          profiles: null,
          frequencia_visita: null,
        },
      ],
      error: null,
    })

    const resultado = await getClientesSemDiaFixo()

    expect(resultado[0].nomeFantasia).toBeNull()
    expect(resultado[0].nomeFantasia).not.toBeUndefined()
  })
})
