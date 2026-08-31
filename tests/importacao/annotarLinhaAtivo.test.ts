import { describe, expect, it } from "vitest"

import {
  annotarLinhaAtivo,
  annotarLoteAtivos,
} from "../../lib/importacao/annotarLinhaAtivo"
import type { AnnotarLinhaLookups, MappedRow } from "../../lib/importacao/annotarLinha"
import { SYSTEM_FIELDS_ATIVO } from "../../lib/importacao/typesAtivo"

/**
 * Unit tests for the per-row pure annotation of the "Importar clientes
 * ativos" import preview (25-02 Task 2, ATIVO-03/ATIVO-04). Fabricated
 * lookup lists, no Supabase — mirrors tests/importacao/annotarLinha.test.ts's
 * shape.
 */

function baseRow(): MappedRow {
  return {
    razaoSocial: "Distribuidora ABC Ltda",
    cnpj: "12.345.678/0001-90",
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: "vendedora@raiar.local",
    contato: "Fulano de Tal",
  }
}

const lookups: AnnotarLinhaLookups = {
  vendedores: [
    {
      id: "vendedor-1",
      nome: "Ana",
      sobrenome: "Souza",
      email: "vendedora@raiar.local",
    },
    {
      id: "vendedor-2",
      nome: "Bruno",
      sobrenome: "Lima",
      email: "bruno@raiar.local",
    },
  ],
  categorias: [
    { id: "cat-1", nome: "Food Service" },
    { id: "cat-2", nome: "Varejo tradicional" },
  ],
  produtos: [
    { id: "prod-1", nome: "Casca" },
    { id: "prod-2", nome: "Pasteurizado" },
  ],
  cidades: [
    { nome: "São Paulo", uf: "SP" },
    { nome: "Campinas", uf: "SP" },
  ],
}

function fieldReason(key: string): string {
  const field = SYSTEM_FIELDS_ATIVO.find((f) => f.key === key)
  if (!field?.campoFaltandoReason) {
    throw new Error(`Campo ${key} não tem campoFaltandoReason declarada`)
  }
  return field.campoFaltandoReason
}

describe("annotarLinhaAtivo", () => {
  it("completa: linha com os 9 obrigatorios preenchidos e lookups existentes resulta em ok, sem motivos, com identificadores resolvidos", () => {
    const result = annotarLinhaAtivo(
      { ...baseRow(), categoria: "Food Service", produtos: "Casca" },
      lookups
    )

    expect(result.status).toBe("ok")
    expect(result.reasons).toEqual([])
    expect(result.resolved.responsavelId).toBe("vendedor-1")
    expect(result.resolved.categoriaId).toBe("cat-1")
    expect(result.resolved.produtoIds).toEqual(["prod-1"])
  })

  it("faltando: linha sem CNPJ tem como unico motivo a frase de CNPJ faltando declarada no vocabulario", () => {
    const rest: MappedRow = { ...baseRow() }
    delete rest.cnpj

    const result = annotarLinhaAtivo(rest, lookups)

    expect(result.status).toBe("erro")
    expect(result.reasons).toEqual([fieldReason("cnpj")])
  })

  it("faltando: linha sem CEP produz a frase de CEP, provando que a frase vem da lista, nao de um mapa paralelo", () => {
    const rest: MappedRow = { ...baseRow() }
    delete rest.cep

    const result = annotarLinhaAtivo(rest, lookups)

    expect(result.status).toBe("erro")
    expect(result.reasons).toEqual([fieldReason("cep")])
  })

  it("soespacos: um campo obrigatorio preenchido so com espacos conta como faltando", () => {
    const result = annotarLinhaAtivo({ ...baseRow(), rua: "   " }, lookups)

    expect(result.status).toBe("erro")
    expect(result.reasons).toEqual([fieldReason("rua")])
  })

  it("multiplosmotivos: tres obrigatorios em branco acumulam os tres motivos, sem repeticao", () => {
    const rest: MappedRow = { ...baseRow() }
    delete rest.cnpj
    delete rest.numero
    delete rest.cidade

    const result = annotarLinhaAtivo(rest, lookups)

    expect(result.status).toBe("erro")
    expect(result.reasons.sort()).toEqual(
      [fieldReason("cnpj"), fieldReason("numero"), fieldReason("cidade")].sort()
    )
    expect(new Set(result.reasons).size).toBe(result.reasons.length)
  })

  it("contatoopcional (revertido, quick task 260831-mod): linha sem contato resulta em ok, sem motivos, contato resolvido nulo", () => {
    const semContato: MappedRow = { ...baseRow() }
    delete semContato.contato

    const result = annotarLinhaAtivo(semContato, lookups)

    expect(result.status).toBe("ok")
    expect(result.reasons).toEqual([])
    expect(result.resolved.contato).toBeNull()
  })

  it("responsavelnaoencontrado: responsavel preenchido mas sem casamento produz motivo DIFERENTE do de responsavel em branco", () => {
    const semResponsavel: MappedRow = { ...baseRow() }
    delete semResponsavel.responsavel
    const resultVazio = annotarLinhaAtivo(semResponsavel, lookups)

    const resultNaoEncontrado = annotarLinhaAtivo(
      { ...baseRow(), responsavel: "ninguem@raiar.local" },
      lookups
    )

    expect(resultVazio.reasons).toEqual([fieldReason("responsavel")])
    expect(resultNaoEncontrado.status).toBe("erro")
    expect(resultNaoEncontrado.reasons).toEqual([
      'Responsável "ninguem@raiar.local" não foi encontrado',
    ])
    expect(resultNaoEncontrado.reasons[0]).not.toBe(fieldReason("responsavel"))
    expect(resultNaoEncontrado.resolved.responsavelId).toBeNull()
  })

  it("categoriainexistente: categoria preenchida que nao existe vira motivo de erro nomeando o valor lido", () => {
    const result = annotarLinhaAtivo(
      { ...baseRow(), categoria: "Categoria Inexistente" },
      lookups
    )

    expect(result.status).toBe("erro")
    expect(result.reasons).toContain('Categoria "Categoria Inexistente" não existe')
    expect(result.resolved.categoriaId).toBeNull()
  })

  it("produtos: celula com dois valores separados por virgula resolve dois identificadores; valor inexistente vira motivo nomeando o valor", () => {
    const okResult = annotarLinhaAtivo(
      { ...baseRow(), produtos: "Casca,Pasteurizado" },
      lookups
    )
    expect(okResult.status).toBe("ok")
    expect(okResult.resolved.produtoIds).toEqual(["prod-1", "prod-2"])

    const errResult = annotarLinhaAtivo(
      { ...baseRow(), produtos: "Casca, Óleo" },
      lookups
    )
    expect(errResult.status).toBe("erro")
    expect(errResult.reasons).toContain('Produto "Óleo" não existe')
    expect(errResult.resolved.produtoIds).toEqual(["prod-1"])
  })

  it("estadocidade: sigla fora da lista fixa vira erro; cidade inexistente vira erro; cidade valida normaliza para o nome canonico", () => {
    const estadoInvalido = annotarLinhaAtivo({ ...baseRow(), estado: "ZZ" }, lookups)
    expect(estadoInvalido.status).toBe("erro")
    expect(estadoInvalido.reasons).toContain(
      'Estado "ZZ" não é uma sigla de UF válida'
    )

    const cidadeInvalida = annotarLinhaAtivo(
      { ...baseRow(), estado: "SP", cidade: "Cidade Inexistente" },
      lookups
    )
    expect(cidadeInvalida.status).toBe("erro")
    expect(cidadeInvalida.reasons).toContain(
      'Cidade "Cidade Inexistente" não encontrada para o estado SP'
    )

    const cidadeCanonica = annotarLinhaAtivo(
      { ...baseRow(), estado: "sp", cidade: "campinas" },
      lookups
    )
    expect(cidadeCanonica.status).toBe("ok")
    expect(cidadeCanonica.resolved.estado).toBe("SP")
    expect(cidadeCanonica.resolved.cidade).toBe("Campinas")
  })

  it("sanitizacao: uma celula que comeca com caractere de formula e neutralizada antes de qualquer comparacao", () => {
    const result = annotarLinhaAtivo(
      { ...baseRow(), contato: "=cmd|' /C calc'!A1" },
      lookups
    )

    expect(result.resolved.contato).toBe("'=cmd|' /C calc'!A1")
  })

  it("loteindependente: anotar um lote de 3 linhas onde so a do meio esta incompleta devolve ok, erro, ok", () => {
    const meio: MappedRow = { ...baseRow() }
    delete meio.cnpj

    const resultados = annotarLoteAtivos([baseRow(), meio, baseRow()], lookups)

    expect(resultados.map((r) => r.status)).toEqual(["ok", "erro", "ok"])
  })
})
