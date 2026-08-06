import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Integration tests for `cidades_com_clientes_por_estado` (quick task
 * 260806-h8a, D-02/D-03/D-04) — the RPC that feeds ONLY the Cidade filter
 * on the Clientes screen (components/clientes/FiltersPopover.tsx), never
 * the cadastro/edição form (that keeps using cidades_por_estado, the full
 * IBGE list, per D-01).
 *
 * RED until Task 2 (`supabase db push`) applies migration 0012 — the
 * function does not exist yet.
 *
 * UF de fixture: 'TO' (Tocantins), confirmado ao vivo em 2026-08-06 com
 * serviceClient() como tendo ZERO clientes reais antes deste teste rodar
 * pela primeira vez — futuras suítes não devem reusar 'TO' como fixture
 * sem re-confirmar isso.
 */

const UF_TESTE = "TO"
const CIDADE_COM_CLIENTE = "Palmas"
const CIDADE_SEM_CLIENTE = "Araguaína"

describe("cidades_com_clientes_por_estado RPC (D-02/D-03/D-04)", () => {
  let clienteFixtureId: string

  beforeAll(async () => {
    const admin = serviceClient()

    const { data: perfilVendedorB, error: perfilError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", SEED_ACCOUNTS.vendedorB.email)
      .single()

    if (perfilError || !perfilVendedorB) {
      throw new Error(
        `Não foi possível encontrar o perfil do Vendedor B: ${perfilError?.message}`
      )
    }

    const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const { data: clienteInserido, error: insertError } = await admin
      .from("clientes")
      .insert({
        razao_social: `Fixture Cidades Com Clientes ${sufixo}`,
        cep: "77000-000",
        rua: "Rua de Teste",
        numero: "100",
        cidade: CIDADE_COM_CLIENTE,
        estado: UF_TESTE,
        responsavel: perfilVendedorB.id,
      })
      .select("id")
      .single()

    if (insertError || !clienteInserido) {
      throw new Error(
        `Falha ao semear cliente-fixture: ${insertError?.message}`
      )
    }

    clienteFixtureId = clienteInserido.id
  })

  afterAll(async () => {
    if (!clienteFixtureId) return
    const admin = serviceClient()
    const { error } = await admin
      .from("clientes")
      .delete()
      .eq("id", clienteFixtureId)
    if (error) {
      throw new Error(`Falha ao limpar cliente-fixture: ${error.message}`)
    }
  })

  it("contém a cidade do cliente-fixture do Vendedor B, mesmo autenticado como Vendedor A (D-02: sistema inteiro)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )

    const { data, error } = await vendedorA.rpc(
      "cidades_com_clientes_por_estado",
      { p_uf: UF_TESTE }
    )

    expect(error).toBeNull()
    const nomes = (data ?? []).map((row: { nome: string }) => row.nome)
    expect(nomes).toContain(CIDADE_COM_CLIENTE)
  })

  it("NÃO contém uma cidade real do mesmo Estado sem nenhum cliente (D-04)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )

    const { data, error } = await vendedorA.rpc(
      "cidades_com_clientes_por_estado",
      { p_uf: UF_TESTE }
    )

    expect(error).toBeNull()
    const nomes = (data ?? []).map((row: { nome: string }) => row.nome)
    expect(nomes).not.toContain(CIDADE_SEM_CLIENTE)
  })

  it("cada linha devolvida tem `nome` do tipo string", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )

    const { data, error } = await vendedorA.rpc(
      "cidades_com_clientes_por_estado",
      { p_uf: UF_TESTE }
    )

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    for (const row of data ?? []) {
      expect(typeof row.nome).toBe("string")
    }
  })

  it("contraprova: a RLS da listagem de `clientes` segue intacta — Vendedor A não lê a linha do Vendedor B diretamente", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )

    const { data, error } = await vendedorA
      .from("clientes")
      .select("id")
      .eq("estado", UF_TESTE)

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })
})
