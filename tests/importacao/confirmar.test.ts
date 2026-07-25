import { describe, expect, it } from "vitest"

import {
  planConfirmacao,
  reconcileImportados,
  type RpcClienteRow,
} from "../../lib/importacao/confirmar"
import type { ValidatedRow } from "../../app/actions/importacao"
import type { ResolvedRow } from "../../lib/importacao/annotarLinha"

/**
 * Unit tests for the confirm-time accounting helper (07-02 Task 1, D-02/D-03/
 * IMP-06). Pure-function style, following tests/importacao/dedupe.test.ts —
 * no Supabase, no server context.
 */

const DUPLICADO_PULADO_REASON = "Possível duplicado (pulado na revisão)"
const DUPLICADO_CONFIRMAR_REASON =
  "Duplicado encontrado ao confirmar — não existia no momento da revisão"

function makeResolved(overrides: Partial<ResolvedRow> = {}): ResolvedRow {
  return {
    razaoSocial: "Distribuidora ABC Ltda",
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    complemento: null,
    cidade: "São Paulo",
    estado: "SP",
    categoriaId: "cat-1",
    contato: "Fulano",
    telefone: "11999999999",
    email: "fulano@example.com",
    produtoIds: ["prod-1", "prod-2"],
    responsavelId: "vend-1",
    numeroDeLojas: "3",
    ...overrides,
  }
}

function makeRow(overrides: Partial<ValidatedRow> = {}): ValidatedRow {
  return {
    row: 0,
    status: "ok",
    reasons: [],
    resolved: makeResolved(),
    ...overrides,
  }
}

describe("planConfirmacao", () => {
  it("includes an 'ok' row with no new duplicate, mapping resolved fields to snake_case RPC keys", () => {
    const linha = makeRow({
      row: 0,
      status: "ok",
      resolved: makeResolved({
        razaoSocial: "Distribuidora ABC Ltda",
        responsavelId: "vend-1",
        categoriaId: "cat-1",
        produtoIds: ["prod-1", "prod-2"],
        numeroDeLojas: "3",
      }),
    })

    const result = planConfirmacao([linha], {}, [])

    expect(result.rowsToInsert).toHaveLength(1)
    const inserted: RpcClienteRow = result.rowsToInsert[0]
    expect(inserted).toEqual({
      razao_social: "Distribuidora ABC Ltda",
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      complemento: null,
      cidade: "São Paulo",
      estado: "SP",
      responsavel: "vend-1",
      categoria_id: "cat-1",
      contato: "Fulano",
      telefone: "11999999999",
      email: "fulano@example.com",
      numero_de_lojas: 3,
      produto_ids: ["prod-1", "prod-2"],
    })
    expect(result.puladas).toEqual([])
    expect(result.puladasCount).toBe(0)
  })

  it("excludes an 'erro' row, grouping each of its reasons in puladas and counting the row once", () => {
    const linha = makeRow({
      row: 0,
      status: "erro",
      reasons: ["Razão social não informada", "Endereço não informado"],
    })

    const result = planConfirmacao([linha], {}, [])

    expect(result.rowsToInsert).toEqual([])
    expect(result.puladasCount).toBe(1)
    expect(result.puladas).toEqual(
      expect.arrayContaining([
        { motivo: "Razão social não informada", quantidade: 1 },
        { motivo: "Endereço não informado", quantidade: 1 },
      ])
    )
    expect(result.puladas).toHaveLength(2)
  })

  it("excludes a 'duplicado' row with decision 'pular' (or absent), counted under the review-skip reason", () => {
    const linhaExplicitPular = makeRow({
      row: 0,
      status: "duplicado",
      reasons: ['Possível duplicado de "Distribuidora ABC"'],
      similarTo: "Distribuidora ABC",
    })
    const linhaAbsentDecision = makeRow({
      row: 1,
      status: "duplicado",
      reasons: ['Possível duplicado de "Mercado XYZ"'],
      similarTo: "Mercado XYZ",
      resolved: makeResolved({ razaoSocial: "Mercado XYZ Novo" }),
    })

    const result = planConfirmacao(
      [linhaExplicitPular, linhaAbsentDecision],
      { 0: "pular" },
      []
    )

    expect(result.rowsToInsert).toEqual([])
    expect(result.puladasCount).toBe(2)
    expect(result.puladas).toEqual([
      { motivo: DUPLICADO_PULADO_REASON, quantidade: 2 },
    ])
  })

  it("includes a 'duplicado' row with decision 'importar' (supervisor override; D-02 does not re-exclude it)", () => {
    const linha = makeRow({
      row: 0,
      status: "duplicado",
      reasons: ['Possível duplicado de "Distribuidora ABC"'],
      similarTo: "Distribuidora ABC",
      resolved: makeResolved({ razaoSocial: "Distribuidora ABC Ltda" }),
    })

    // Even though "Distribuidora ABC Ltda" is present in existentesRazaoSocial
    // (the exact D-02 re-check condition), an explicit "importar" override
    // must NOT be re-excluded.
    const result = planConfirmacao(
      [linha],
      { 0: "importar" },
      ["Distribuidora ABC Ltda"]
    )

    expect(result.rowsToInsert).toHaveLength(1)
    expect(result.rowsToInsert[0].razao_social).toBe("Distribuidora ABC Ltda")
    expect(result.puladasCount).toBe(0)
  })

  it("excludes an 'ok' row that newly matches existentesRazaoSocial at confirm time (D-02)", () => {
    const linha = makeRow({
      row: 0,
      status: "ok",
      resolved: makeResolved({ razaoSocial: "Nova Distribuidora Ltda" }),
    })

    const result = planConfirmacao([linha], {}, ["Nova Distribuidora Ltda"])

    expect(result.rowsToInsert).toEqual([])
    expect(result.puladasCount).toBe(1)
    expect(result.puladas).toEqual([
      { motivo: DUPLICADO_CONFIRMAR_REASON, quantidade: 1 },
    ])
  })

  it("keeps rowsToInsert.length + puladasCount equal to the input length across a mixed batch", () => {
    const linhas: ValidatedRow[] = [
      makeRow({ row: 0, status: "ok", resolved: makeResolved({ razaoSocial: "Empresa A" }) }),
      makeRow({
        row: 1,
        status: "erro",
        reasons: ["Razão social não informada"],
      }),
      makeRow({
        row: 2,
        status: "duplicado",
        reasons: ['Possível duplicado de "Empresa C Original"'],
        similarTo: "Empresa C Original",
        resolved: makeResolved({ razaoSocial: "Empresa C" }),
      }),
      makeRow({
        row: 3,
        status: "duplicado",
        reasons: ['Possível duplicado de "Empresa D Original"'],
        similarTo: "Empresa D Original",
        resolved: makeResolved({ razaoSocial: "Empresa D" }),
      }),
      makeRow({
        row: 4,
        status: "ok",
        resolved: makeResolved({ razaoSocial: "Empresa E Nova" }),
      }),
    ]

    const decisions: Record<number, "importar" | "pular"> = {
      3: "importar",
    }

    const result = planConfirmacao(linhas, decisions, ["Empresa E Nova"])

    expect(result.rowsToInsert.length + result.puladasCount).toBe(
      linhas.length
    )
    // row 0 (ok, no dup) + row 3 (duplicado override) inserted
    expect(result.rowsToInsert.map((r) => r.razao_social).sort()).toEqual(
      ["Empresa A", "Empresa D"].sort()
    )
  })
})

describe("reconcileImportados", () => {
  it("reports every rowToInsert whose razao_social is present in returnedRazoes as importado", () => {
    const rowsToInsert: RpcClienteRow[] = [
      { ...emptyRpcRow(), razao_social: "Empresa A" },
      { ...emptyRpcRow(), razao_social: "Empresa B" },
    ]

    const result = reconcileImportados(rowsToInsert, [
      "Empresa A",
      "Empresa B",
    ])

    expect(result.importados).toEqual([
      { razaoSocial: "Empresa A" },
      { razaoSocial: "Empresa B" },
    ])
    expect(result.puladasExtra).toEqual([])
  })

  it("reports a rowToInsert absent from returnedRazoes (RPC ON CONFLICT race backstop) under the confirm-time duplicate reason", () => {
    const rowsToInsert: RpcClienteRow[] = [
      { ...emptyRpcRow(), razao_social: "Empresa A" },
      { ...emptyRpcRow(), razao_social: "Empresa B" },
    ]

    const result = reconcileImportados(rowsToInsert, ["Empresa A"])

    expect(result.importados).toEqual([{ razaoSocial: "Empresa A" }])
    expect(result.puladasExtra).toEqual([
      {
        motivo: DUPLICADO_CONFIRMAR_REASON,
        quantidade: 1,
      },
    ])
  })
})

function emptyRpcRow(): RpcClienteRow {
  return {
    razao_social: "",
    cep: "",
    rua: "",
    numero: "",
    complemento: null,
    cidade: "",
    estado: "",
    responsavel: null,
    categoria_id: null,
    contato: null,
    telefone: null,
    email: null,
    numero_de_lojas: null,
    produto_ids: [],
  }
}
