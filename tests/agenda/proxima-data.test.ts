import { beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { signInAs } from "../helpers/supabase-test-clients"

/**
 * Integration tests for `proxima_data_visita` (Fase 13, migration 0013),
 * revalidados aqui sob a otica da Fase 15/Pitfall 1: e a UNICA autoridade
 * de calculo de proxima-data-de-visita no projeto inteiro, e este arquivo
 * prova o caso obrigatorio (31/jan -> 28/fev, e 29/fev em ano bissexto)
 * exatamente como `agenda_do_vendedor()` (migration 0015 desta fase) vai
 * chamar a mesma funcao para preencher `proxima_data_sugerida`. A funcao
 * NAO e redefinida nesta fase — so chamada.
 *
 * Mesmo padrao de todo teste de integracao deste projeto: sessao real via
 * signInAs()/SEED_ACCOUNTS, logada UMA vez neste arquivo (rate limit
 * documentado em STATE.md) e reusada em todos os casos abaixo.
 */

let vendedorA: SupabaseClient

beforeAll(async () => {
  vendedorA = await signInAs(
    SEED_ACCOUNTS.vendedorA.email,
    SEED_ACCOUNTS.vendedorA.password
  )
})

describe("proxima_data_visita: mensal a partir de fim de mes (Pitfall 1, obrigatorio)", () => {
  it("mensal: 31/jan + mensal cai em 28/fev em ano comum", async () => {
    const { data, error } = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2026-01-31",
      p_frequencia: "mensal",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-02-28")
  })

  it("bissexto: 31/jan + mensal cai em 29/fev em ano bissexto", async () => {
    const { data, error } = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2028-01-31",
      p_frequencia: "mensal",
    })
    expect(error).toBeNull()
    expect(data).toBe("2028-02-29")
  })
})

describe("proxima_data_visita: intervalos fixos", () => {
  it("semanal: 31/jan + semanal = 07/fev", async () => {
    const { data, error } = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2026-01-31",
      p_frequencia: "semanal",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-02-07")
  })

  it("quinzenal: 31/jan + quinzenal = 14/fev", async () => {
    const { data, error } = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2026-01-31",
      p_frequencia: "quinzenal",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-02-14")
  })
})

describe("proxima_data_visita: frequencia sem cadencia", () => {
  it("nenhuma: frequencia 'nenhuma' devolve nulo, o que faz a sugestao da agenda vir vazia", async () => {
    const { data, error } = await vendedorA.rpc("proxima_data_visita", {
      p_base: "2026-01-31",
      p_frequencia: "nenhuma",
    })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})
