import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Behavior tests for `dashboard_prospeccao_por_produto(p_inicio, p_fim)`
 * and `dashboard_prospeccao_por_categoria(p_inicio, p_fim)` (DSH-05/D-09).
 *
 * D-09 (04-CONTEXT.md): unlike ganhos/perdidos, this metric filters by
 * `clientes.criado_em` (cadastro date), not by a status-change event.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Dashboard ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function baseClienteFields(
  razaoSocial: string,
  responsavelId: string,
  categoriaId: string
) {
  return {
    razao_social: razaoSocial,
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: responsavelId,
    categoria_id: categoriaId,
  }
}

const createdClienteIds: string[] = []

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  const admin = serviceClient()
  await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
})

async function getUserId(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
}

async function getActiveProduto(): Promise<{ id: string; nome: string }> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from("produtos_consumidos")
    .select("id, nome")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error("Nenhum produto consumido ativo encontrado para o teste")
  }
  return data as { id: string; nome: string }
}

async function getActiveCategoria(): Promise<{ id: string; nome: string }> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from("categorias")
    .select("id, nome")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error("Nenhuma categoria ativa encontrada para o teste")
  }
  return data as { id: string; nome: string }
}

function testWindow() {
  const now = Date.now()
  return {
    inicio: new Date(now - 1000).toISOString(),
    fim: new Date(now + 30_000).toISOString(),
  }
}

type ProdutoTotalRow = { produto_id: string; produto_nome: string; total: number | string }
type CategoriaTotalRow = {
  categoria_id: string
  categoria_nome: string
  total: number | string
}

function toProdutoMap(rows: ProdutoTotalRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.produto_id, Number(row.total)]))
}

function toCategoriaMap(rows: CategoriaTotalRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.categoria_id, Number(row.total)]))
}

describe("dashboard_prospeccao_por_produto", () => {
  it("counts clientes by criado_em within the period, grouped by produto (D-09)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const produto = await getActiveProduto()
    const categoria = await getActiveCategoria()
    const window = testWindow()

    const { data: before, error: beforeError } = await vendedorA.rpc(
      "dashboard_prospeccao_por_produto",
      { p_inicio: window.inicio, p_fim: window.fim }
    )
    expect(beforeError).toBeNull()
    const beforeMap = toProdutoMap((before ?? []) as ProdutoTotalRow[])

    const razaoSocial = uniqueRazaoSocial("prospeccao-produto")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId, categoria.id))
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { error: linkError } = await vendedorA
      .from("cliente_produtos")
      .insert({ cliente_id: inserted!.id, produto_id: produto.id })
    expect(linkError).toBeNull()

    const { data: after, error: afterError } = await vendedorA.rpc(
      "dashboard_prospeccao_por_produto",
      { p_inicio: window.inicio, p_fim: window.fim }
    )
    expect(afterError).toBeNull()
    const afterMap = toProdutoMap((after ?? []) as ProdutoTotalRow[])

    expect(afterMap[produto.id] ?? 0).toBe((beforeMap[produto.id] ?? 0) + 1)
  })
})

describe("dashboard_prospeccao_por_categoria", () => {
  it("counts clientes by criado_em within the period, grouped by categoria (D-09)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const categoria = await getActiveCategoria()
    const window = testWindow()

    const { data: before, error: beforeError } = await vendedorA.rpc(
      "dashboard_prospeccao_por_categoria",
      { p_inicio: window.inicio, p_fim: window.fim }
    )
    expect(beforeError).toBeNull()
    const beforeMap = toCategoriaMap((before ?? []) as CategoriaTotalRow[])

    const razaoSocial = uniqueRazaoSocial("prospeccao-categoria")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId, categoria.id))
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { data: after, error: afterError } = await vendedorA.rpc(
      "dashboard_prospeccao_por_categoria",
      { p_inicio: window.inicio, p_fim: window.fim }
    )
    expect(afterError).toBeNull()
    const afterMap = toCategoriaMap((after ?? []) as CategoriaTotalRow[])

    expect(afterMap[categoria.id] ?? 0).toBe((beforeMap[categoria.id] ?? 0) + 1)
  })
})
