import { describe, expect, it } from "vitest"

import { DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON } from "../../lib/importacao/confirmar"
import type { RpcClienteRow } from "../../lib/importacao/confirmar"
import {
  DADO_OBRIGATORIO_FALTANDO_AO_GRAVAR_REASON,
  fundirGruposDeMotivosAtivos,
  reconciliarAtivos,
  type RpcRetornoAtivo,
} from "../../lib/importacao/confirmarAtivo"

/**
 * Unit tests for the confirm-time accounting helper of the "Importar
 * clientes ativos" batch write (25-02 Task 3, ATIVO-02/ATIVO-03). Pure
 * module, fabricated data — no Supabase, mirrors tests/importacao/
 * confirmar.test.ts's shape.
 */

function emptyRpcRow(razaoSocial: string): RpcClienteRow {
  return {
    razao_social: razaoSocial,
    cnpj: "12.345.678/0001-90",
    nome_fantasia: null,
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    complemento: null,
    cidade: "São Paulo",
    estado: "SP",
    responsavel: "vend-1",
    categoria_id: null,
    contato: "Fulano",
    telefone: null,
    email: null,
    numero_de_lojas: null,
    produto_ids: [],
  }
}

function retorno(
  razaoSocial: string,
  status: RpcRetornoAtivo["status"],
  id: string | null = null
): RpcRetornoAtivo {
  return { razao_social: razaoSocial, id, status }
}

describe("reconciliarAtivos", () => {
  it("reconciliainserido: carga de 2 linhas cujo retorno traz as duas como inseridas devolve 2 importados e nenhuma pulada", () => {
    const carga = [emptyRpcRow("Empresa A"), emptyRpcRow("Empresa B")]
    const retornados = [
      retorno("Empresa A", "inserido", "id-a"),
      retorno("Empresa B", "inserido", "id-b"),
    ]

    const result = reconciliarAtivos(carga, retornados)

    expect(result.importados).toEqual([
      { razaoSocial: "Empresa A" },
      { razaoSocial: "Empresa B" },
    ])
    expect(result.puladas).toEqual([])
  })

  it("reconciliaincompleto: linha devolvida como incompleta vira pulada agrupada sob o motivo de dado obrigatorio faltando ao gravar", () => {
    const carga = [emptyRpcRow("Empresa A")]
    const retornados = [retorno("Empresa A", "incompleto", null)]

    const result = reconciliarAtivos(carga, retornados)

    expect(result.importados).toEqual([])
    expect(result.puladas).toEqual([
      { motivo: DADO_OBRIGATORIO_FALTANDO_AO_GRAVAR_REASON, quantidade: 1 },
    ])
  })

  it("reconciliaduplicado: linha devolvida como duplicada vira pulada agrupada sob o motivo de duplicado encontrado ao confirmar", () => {
    const carga = [emptyRpcRow("Empresa A")]
    const retornados = [retorno("Empresa A", "duplicado", null)]

    const result = reconciliarAtivos(carga, retornados)

    expect(result.importados).toEqual([])
    expect(result.puladas).toEqual([
      { motivo: DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON, quantidade: 1 },
    ])
  })

  it("reconciliaausente: linha enviada sem casamento no retorno e contada como pulada (nunca importada), sob o mesmo motivo de duplicado encontrado ao confirmar", () => {
    const carga = [emptyRpcRow("Empresa A"), emptyRpcRow("Empresa B")]
    const retornados = [retorno("Empresa A", "inserido", "id-a")]

    const result = reconciliarAtivos(carga, retornados)

    expect(result.importados).toEqual([{ razaoSocial: "Empresa A" }])
    expect(result.puladas).toEqual([
      { motivo: DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON, quantidade: 1 },
    ])
  })

  it("razaorepetida: duas linhas da carga com a mesma razao social e a RPC devolvendo insercao so para uma - no maximo uma e importada, a outra e pulada", () => {
    const carga = [emptyRpcRow("Empresa Repetida"), emptyRpcRow("Empresa Repetida")]
    const retornados = [retorno("Empresa Repetida", "inserido", "id-unico")]

    const result = reconciliarAtivos(carga, retornados)

    expect(result.importados).toEqual([{ razaoSocial: "Empresa Repetida" }])
    expect(result.importados).toHaveLength(1)
    expect(result.puladas).toEqual([
      { motivo: DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON, quantidade: 1 },
    ])
  })
})

describe("fundirGruposDeMotivosAtivos", () => {
  it("fundemotivos: dois grupos com o mesmo texto de motivo sao somados num so, nunca listados duas vezes", () => {
    const a = [{ motivo: "Motivo X", quantidade: 2 }]
    const b = [{ motivo: "Motivo X", quantidade: 3 }, { motivo: "Motivo Y", quantidade: 1 }]

    const result = fundirGruposDeMotivosAtivos(a, b)

    expect(result).toEqual(
      expect.arrayContaining([
        { motivo: "Motivo X", quantidade: 5 },
        { motivo: "Motivo Y", quantidade: 1 },
      ])
    )
    expect(result).toHaveLength(2)
  })
})
