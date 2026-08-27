import { describe, expect, it } from "vitest"

import {
  produtosPendentesDaCarga,
  resolverProdutosPendentes,
  type ClienteRecemGravado,
} from "../../lib/importacao/produtosPendentes"
import type { RpcClienteRow } from "../../lib/importacao/confirmar"

/**
 * Unit tests for the produtos-pendentes helper (Fase 26 Plano 3, Task 2,
 * T-26-09). Pure-function style, following tests/importacao/dedupe.test.ts
 * e tests/importacao/confirmar.test.ts — no Supabase, no server context.
 */

function makeRpcRow(overrides: Partial<RpcClienteRow> = {}): RpcClienteRow {
  return {
    razao_social: "Distribuidora ABC Ltda",
    cnpj: null,
    nome_fantasia: null,
    cep: null,
    rua: null,
    numero: null,
    complemento: null,
    cidade: null,
    estado: null,
    responsavel: null,
    categoria_id: null,
    contato: null,
    telefone: null,
    email: null,
    numero_de_lojas: null,
    produto_ids: [],
    ...overrides,
  }
}

describe("produtosPendentesDaCarga", () => {
  it("produces a pendência with both products for a null-razão-social row with two produtos", () => {
    const rowsToInsert = [
      makeRpcRow({
        razao_social: null,
        nome_fantasia: "Distribuidora Exemplo",
        produto_ids: ["prod-1", "prod-2"],
      }),
    ]

    const pendencias = produtosPendentesDaCarga(rowsToInsert)

    expect(pendencias).toEqual([
      { nomeFantasia: "Distribuidora Exemplo", produtoIds: ["prod-1", "prod-2"] },
    ])
  })

  it("produces no pendência for a null-razão-social row with no produtos", () => {
    const rowsToInsert = [
      makeRpcRow({
        razao_social: null,
        nome_fantasia: "Distribuidora Exemplo",
        produto_ids: [],
      }),
    ]

    expect(produtosPendentesDaCarga(rowsToInsert)).toEqual([])
  })

  it("produces no pendência when every row has a razão social (today's zero-cost path)", () => {
    const rowsToInsert = [
      makeRpcRow({ razao_social: "Empresa A", produto_ids: ["prod-1"] }),
      makeRpcRow({ razao_social: "Empresa B", produto_ids: [] }),
    ]

    expect(produtosPendentesDaCarga(rowsToInsert)).toEqual([])
  })

  it("produces no pendência for a null-razão-social row with produtos but no Nome Fantasia", () => {
    const rowsToInsert = [
      makeRpcRow({
        razao_social: null,
        nome_fantasia: null,
        produto_ids: ["prod-1"],
      }),
    ]

    expect(produtosPendentesDaCarga(rowsToInsert)).toEqual([])
  })
})

describe("resolverProdutosPendentes", () => {
  it("turns each pendência into cliente-id/produto-id pairs given the set of recém-gravados", () => {
    const pendencias = [
      { nomeFantasia: "Distribuidora Exemplo", produtoIds: ["prod-1", "prod-2"] },
    ]
    const clientesRecemGravados: ClienteRecemGravado[] = [
      { id: "cliente-1", nomeFantasia: "Distribuidora Exemplo" },
    ]

    const result = resolverProdutosPendentes(pendencias, clientesRecemGravados)

    expect(result.vinculos).toEqual([
      { clienteId: "cliente-1", produtoId: "prod-1" },
      { clienteId: "cliente-1", produtoId: "prod-2" },
    ])
    expect(result.naoResolvidas).toEqual([])
  })

  it("ignores accent, case, and punctuation differences when matching Nome Fantasia", () => {
    const pendencias = [
      { nomeFantasia: "DISTRIBUIDORA  Exemplo.", produtoIds: ["prod-1"] },
    ]
    const clientesRecemGravados: ClienteRecemGravado[] = [
      { id: "cliente-1", nomeFantasia: "Distribuidóra Exemplo" },
    ]

    const result = resolverProdutosPendentes(pendencias, clientesRecemGravados)

    expect(result.vinculos).toEqual([{ clienteId: "cliente-1", produtoId: "prod-1" }])
    expect(result.naoResolvidas).toEqual([])
  })

  it("treats a pendência as unresolved (never guessing) when two recém-gravados share the same normalized Nome Fantasia", () => {
    const pendencias = [
      { nomeFantasia: "Distribuidora Exemplo", produtoIds: ["prod-1"] },
    ]
    const clientesRecemGravados: ClienteRecemGravado[] = [
      { id: "cliente-1", nomeFantasia: "Distribuidora Exemplo" },
      { id: "cliente-2", nomeFantasia: "DISTRIBUIDORA EXEMPLO" },
    ]

    const result = resolverProdutosPendentes(pendencias, clientesRecemGravados)

    expect(result.vinculos).toEqual([])
    expect(result.naoResolvidas).toEqual(pendencias)
  })

  it("treats a pendência as unresolved when no recém-gravado matches", () => {
    const pendencias = [
      { nomeFantasia: "Distribuidora Sem Par", produtoIds: ["prod-1"] },
    ]
    const clientesRecemGravados: ClienteRecemGravado[] = [
      { id: "cliente-1", nomeFantasia: "Outra Distribuidora" },
    ]

    const result = resolverProdutosPendentes(pendencias, clientesRecemGravados)

    expect(result.vinculos).toEqual([])
    expect(result.naoResolvidas).toEqual(pendencias)
  })
})
