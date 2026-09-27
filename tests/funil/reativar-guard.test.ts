import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Teste de marcarStatus (Fase 29, Plano 4 — D-04/D-10/D-11/D-12) — com mock
 * de @/lib/supabase/server e next/cache, prova que:
 *   (1) o select pede frequencia_visita junto das colunas de hoje;
 *   (2) reativar (status atual "encerrado" -> "ganho") usa a frequência já
 *       GRAVADA quando nenhum parâmetro é enviado (Reativar de um toque,
 *       Pitfall 1/D-10), inclusive quando a gravada é nula (restaura o
 *       "ganho sem frequência" de antes, 29-01 conflitos_resolvidos 1);
 *   (3) fora da reativação, "ganho" sem frequência (nem gravada nem
 *       parâmetro) continua bloqueado com a mensagem de sempre, e o
 *       parâmetro sempre vence sobre a gravada quando os dois existem;
 *   (4) encerrar só é possível a partir de "ganho" e sempre com motivo
 *       (D-04/ENCR-02);
 *   (5) em qualquer sucesso, a Agenda é revalidada junto de /clientes
 *       (D-12, critério 2).
 *
 * Molde de tests/agenda/clientes-sem-dia-fixo-query.test.ts: vi.hoisted()
 * cria os espiões antes do vi.mock içado. Espiões limpos no beforeEach
 * (lição da Fase 22 sobre valores enfileirados vazando entre testes) — cada
 * teste arma sua própria resposta com mockResolvedValueOnce.
 */
const { selectSpy, eqSpy, singleSpy, rpcSpy, revalidateSpy } = vi.hoisted(
  () => ({
    selectSpy: vi.fn(),
    eqSpy: vi.fn(),
    singleSpy: vi.fn(),
    rpcSpy: vi.fn(),
    revalidateSpy: vi.fn(),
  })
)

vi.mock("next/cache", () => ({
  revalidatePath: revalidateSpy,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: (colunas: string) => {
        selectSpy(colunas)
        return {
          eq: (...args: unknown[]) => {
            eqSpy(...args)
            return { single: singleSpy }
          },
        }
      },
    }),
    rpc: rpcSpy,
  }),
}))

import { marcarStatus } from "@/app/actions/funil"

type ClienteRowFicticia = {
  etapa: string
  status_acompanhamento: string
  cnpj: string | null
  razao_social: string | null
  cep: string | null
  rua: string | null
  numero: string | null
  cidade: string | null
  estado: string | null
  frequencia_visita: string | null
}

/** Fábrica de linha de cliente com ficha COMPLETA por padrão, nomes
 * inventados — cada teste sobrescreve só o que precisa. */
function clienteFicticio(
  overrides: Partial<ClienteRowFicticia> = {}
): ClienteRowFicticia {
  return {
    etapa: "primeira_venda",
    status_acompanhamento: "ganho",
    cnpj: "11.222.333/0001-44",
    razao_social: "Distribuidora Fictícia",
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    frequencia_visita: null,
    ...overrides,
  }
}

beforeEach(() => {
  selectSpy.mockReset()
  eqSpy.mockReset()
  singleSpy.mockReset()
  rpcSpy.mockReset()
  revalidateSpy.mockReset()
})

describe("marcarStatus (Fase 29, D-04/D-10/D-11/D-12)", () => {
  it("select-pede-frequencia: o select do cliente pede frequencia_visita junto das colunas de hoje", async () => {
    singleSpy.mockResolvedValueOnce({
      data: clienteFicticio({ status_acompanhamento: "em_andamento" }),
      error: null,
    })
    rpcSpy.mockResolvedValueOnce({ error: null })

    await marcarStatus("cliente-1", "em_andamento")

    expect(selectSpy).toHaveBeenCalledWith(
      "etapa, status_acompanhamento, cnpj, razao_social, cep, rua, numero, cidade, estado, frequencia_visita"
    )
  })

  it("reativar-usa-frequencia-gravada: cliente encerrado com frequencia_visita 'semanal' gravada reativa com um toque", async () => {
    singleSpy.mockResolvedValueOnce({
      data: clienteFicticio({
        status_acompanhamento: "encerrado",
        frequencia_visita: "semanal",
      }),
      error: null,
    })
    rpcSpy.mockResolvedValueOnce({ error: null })

    const result = await marcarStatus("cliente-1", "ganho")

    expect(result).toEqual({ data: true })
    expect(rpcSpy).toHaveBeenCalledTimes(1)
    expect(rpcSpy).toHaveBeenCalledWith(
      "mover_card_funil",
      expect.objectContaining({
        p_novo_status: "ganho",
        p_nova_etapa: "primeira_venda",
        p_frequencia_visita: "semanal",
        p_motivo_encerramento_id: null,
      })
    )
  })

  it("reativar-sem-frequencia-restaura: cliente encerrado sem frequencia_visita gravada reativa mesmo assim (RPC recebe null)", async () => {
    singleSpy.mockResolvedValueOnce({
      data: clienteFicticio({
        status_acompanhamento: "encerrado",
        frequencia_visita: null,
      }),
      error: null,
    })
    rpcSpy.mockResolvedValueOnce({ error: null })

    const result = await marcarStatus("cliente-1", "ganho")

    expect(result).toEqual({ data: true })
    expect(rpcSpy).toHaveBeenCalledWith(
      "mover_card_funil",
      expect.objectContaining({
        p_novo_status: "ganho",
        p_frequencia_visita: null,
      })
    )
  })

  it("reativar-ficha-incompleta (D-11): cliente encerrado com rua vazia recusa com ficha_incompleta, RPC não é chamada", async () => {
    singleSpy.mockResolvedValueOnce({
      data: clienteFicticio({
        status_acompanhamento: "encerrado",
        frequencia_visita: "semanal",
        rua: "",
      }),
      error: null,
    })

    const result = await marcarStatus("cliente-1", "ganho")

    expect(result.error?.code).toBe("ficha_incompleta")
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("ganho-comum-sem-frequencia-bloqueia: cliente em_andamento sem frequência gravada nem parâmetro é bloqueado", async () => {
    singleSpy.mockResolvedValueOnce({
      data: clienteFicticio({
        status_acompanhamento: "em_andamento",
        frequencia_visita: null,
      }),
      error: null,
    })

    const result = await marcarStatus("cliente-1", "ganho")

    expect(result).toEqual({
      error: {
        code: "frequencia_obrigatoria",
        message: "Selecione a frequência de visita antes de confirmar.",
      },
    })
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("ganho-comum-parametro-vence: cliente em_andamento com 'mensal' gravado e parâmetro 'semanal' manda 'semanal' à RPC", async () => {
    singleSpy.mockResolvedValueOnce({
      data: clienteFicticio({
        status_acompanhamento: "em_andamento",
        frequencia_visita: "mensal",
      }),
      error: null,
    })
    rpcSpy.mockResolvedValueOnce({ error: null })

    const result = await marcarStatus(
      "cliente-1",
      "ganho",
      undefined,
      "semanal"
    )

    expect(result).toEqual({ data: true })
    expect(rpcSpy).toHaveBeenCalledWith(
      "mover_card_funil",
      expect.objectContaining({ p_frequencia_visita: "semanal" })
    )
  })

  it("encerrar-exige-motivo: cliente ganho sem motivoEncerramentoId é recusado antes da RPC", async () => {
    singleSpy.mockResolvedValueOnce({
      data: clienteFicticio({ status_acompanhamento: "ganho" }),
      error: null,
    })

    const result = await marcarStatus("cliente-1", "encerrado")

    expect(result).toEqual({
      error: {
        code: "motivo_obrigatorio",
        message: "Selecione o motivo do encerramento antes de salvar.",
      },
    })
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("encerrar-so-de-ganho: cliente em_andamento não pode ser encerrado, mesmo com motivo", async () => {
    singleSpy.mockResolvedValueOnce({
      data: clienteFicticio({ status_acompanhamento: "em_andamento" }),
      error: null,
    })

    const result = await marcarStatus(
      "cliente-1",
      "encerrado",
      undefined,
      undefined,
      undefined,
      "m1"
    )

    expect(result.error?.code).toBe("encerramento_travado")
    expect(rpcSpy).not.toHaveBeenCalled()
  })

  it("encerrar-ok: cliente ganho com motivo chama a RPC com os parâmetros de encerrar, o resto nulo", async () => {
    singleSpy.mockResolvedValueOnce({
      data: clienteFicticio({ status_acompanhamento: "ganho" }),
      error: null,
    })
    rpcSpy.mockResolvedValueOnce({ error: null })

    const result = await marcarStatus(
      "cliente-1",
      "encerrado",
      undefined,
      undefined,
      undefined,
      "m1"
    )

    expect(result).toEqual({ data: true })
    expect(rpcSpy).toHaveBeenCalledWith("mover_card_funil", {
      p_cliente_id: "cliente-1",
      p_nova_etapa: "primeira_venda",
      p_novo_status: "encerrado",
      p_motivo_perda_id: null,
      p_frequencia_visita: null,
      p_cnpj: null,
      p_motivo_encerramento_id: "m1",
    })
  })

  it("revalida-agenda: em qualquer sucesso, revalidatePath é chamado com /clientes e /agenda", async () => {
    singleSpy.mockResolvedValueOnce({
      data: clienteFicticio({ status_acompanhamento: "ganho" }),
      error: null,
    })
    rpcSpy.mockResolvedValueOnce({ error: null })

    await marcarStatus("cliente-1", "encerrado", undefined, undefined, undefined, "m1")

    expect(revalidateSpy).toHaveBeenCalledWith("/clientes")
    expect(revalidateSpy).toHaveBeenCalledWith("/agenda")
  })
})
