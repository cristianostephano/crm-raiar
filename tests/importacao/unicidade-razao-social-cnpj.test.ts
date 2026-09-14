import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  createTestMember,
  deleteTestMember,
  serviceClient,
  signInAs,
  type TestMember,
} from "../helpers/supabase-test-clients"

/**
 * Integration test for the migration 0030 unicidade rule
 * (razao_social_cnpj_colide + trigger + as duas RPCs de importação
 * recriadas) — quick task 260914-k3g.
 *
 * Contexto: a quick task 260914-j8g já corrigiu o MESMO problema de negócio
 * na camada de aplicação (lib/importacao/dedupe.ts — só o AVISO da tela de
 * revisão). Esta quick task (260914-k3g) corrige a trava REAL, no banco:
 * `clientes.razao_social` tinha uma unique constraint de coluna única desde
 * a migration 0002, que fazia o Postgres recusar SILENCIOSAMENTE qualquer
 * segunda linha com a mesma razão social — mesmo com CNPJ diferente — via
 * `on conflict (razao_social) do nothing` nas duas RPCs de importação em
 * massa. Numa importação real de "Clientes Ativos", 743 de 1755 linhas
 * foram puladas como "duplicado" só porque são lojas de rede (Carrefour,
 * Outback) com razão social igual e CNPJ diferente por filial.
 *
 * Regra de negócio provada aqui, para as duas RPCs:
 *   - mesma razão social + mesmo CNPJ (ambos presentes)    -> continua colidindo
 *   - mesma razão social + CNPJ diferente (ambos presentes) -> NÃO colide mais
 *   - mesma razão social + CNPJ ausente de um ou dos dois lados -> continua colidindo
 *
 * Como este arquivo autentica — decisão deliberada: NUNCA usar as contas
 * semente antigas (SEED_ACCOUNTS.vendedorA/vendedorB), documentadas em
 * STATE.md como possivelmente apagadas desde 2026-08-19. Usa
 * `createTestMember("supervisor")` e `createTestMember("vendedor")` para
 * criar fixtures descartáveis pela API de administração, e `signInAs` UMA
 * única vez (mesmo padrão de tests/importacao/importar-ativos-lote.test.ts),
 * pelo rate limit conhecido de `signInWithPassword`.
 *
 * O arquivo fica VERMELHO até a Task 3 (checkpoint humano) aplicar a
 * migration 0030 no banco hospedado — a função razao_social_cnpj_colide e o
 * trigger novo ainda não existem, e as duas RPCs ainda estão na versão
 * antiga (0019/0027) que colide por razão social sozinha.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Unicidade RazaoSocialCnpj ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const createdClienteIds: string[] = []
let supervisor: TestMember
let vendedor: TestMember
let supervisorClient: SupabaseClient
let vendedorId: string

beforeAll(async () => {
  supervisor = await createTestMember("supervisor", "unicidade-razao-cnpj")
  vendedor = await createTestMember("vendedor", "unicidade-razao-cnpj")
  supervisorClient = await signInAs(supervisor.email, supervisor.password)
  vendedorId = vendedor.id
})

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  await serviceClient().from("clientes").delete().in("id", createdClienteIds.splice(0))
})

afterAll(async () => {
  // Ordem obrigatória: clientes primeiro (FK sem ON DELETE em
  // clientes.responsavel), membros de fixture depois.
  await deleteTestMember(supervisor.id)
  await deleteTestMember(vendedor.id)
})

async function buscarProdutoId(): Promise<string> {
  const { data, error } = await serviceClient()
    .from("produtos_consumidos")
    .select("id")
    .limit(1)
    .single()
  if (error) throw new Error(`Failed to read a produtos_consumidos row: ${error.message}`)
  return data!.id as string
}

async function lerClientesPorRazaoSocial(razaoSocial: string) {
  const { data, error } = await serviceClient()
    .from("clientes")
    .select("id")
    .eq("razao_social", razaoSocial)
  if (error) throw new Error(`Failed to read back clientes "${razaoSocial}": ${error.message}`)
  return data ?? []
}

async function lerClienteProdutos(clienteId: string) {
  const { data, error } = await serviceClient()
    .from("cliente_produtos")
    .select("produto_id")
    .eq("cliente_id", clienteId)
  if (error) throw new Error(`Failed to read cliente_produtos for "${clienteId}": ${error.message}`)
  return data ?? []
}

describe("importar_clientes_lote (migration 0030 — razao_social + cnpj)", () => {
  function baseRowFields(razaoSocial: string, cnpj: string | null, overrides: Record<string, unknown> = {}) {
    return {
      razao_social: razaoSocial,
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      complemento: null,
      cidade: "São Paulo",
      estado: "SP",
      responsavel: vendedorId,
      categoria_id: null,
      contato: "Fulano de Tal",
      telefone: "11999990000",
      email: null,
      numero_de_lojas: null,
      cnpj,
      nome_fantasia: null,
      produto_ids: [],
      ...overrides,
    }
  }

  it("mesmocnpj: duas linhas com mesma razão social e mesmo CNPJ continuam colidindo — só a primeira grava", async () => {
    const produtoId = await buscarProdutoId()
    const razaoSocial = uniqueRazaoSocial("lote-mesmocnpj")
    const cnpj = "11.111.111/0001-11"

    const linha1 = baseRowFields(razaoSocial, cnpj)
    const linha2 = baseRowFields(razaoSocial, cnpj, { produto_ids: [produtoId] })

    const { data, error } = await supervisorClient.rpc("importar_clientes_lote", {
      p_clientes: [linha1, linha2],
    })
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(1)
    createdClienteIds.push(...data!.map((r: { id: string }) => r.id))

    const existentes = await lerClientesPorRazaoSocial(razaoSocial)
    expect(existentes).toHaveLength(1)
  })

  it("cnpjdiferente: duas linhas com mesma razão social e CNPJs diferentes NÃO colidem mais — as duas gravam, sem cross-contaminação de produtos", async () => {
    const produtoId = await buscarProdutoId()
    const razaoSocial = uniqueRazaoSocial("lote-cnpjdiferente")

    const linha1 = baseRowFields(razaoSocial, "11.111.111/0001-11", { produto_ids: [produtoId] })
    const linha2 = baseRowFields(razaoSocial, "22.222.222/0001-22", { produto_ids: [] })

    const { data, error } = await supervisorClient.rpc("importar_clientes_lote", {
      p_clientes: [linha1, linha2],
    })
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(2)
    const ids = data!.map((r: { id: string }) => r.id)
    expect(new Set(ids).size).toBe(2)
    createdClienteIds.push(...ids)

    const clientesGravados = await serviceClient()
      .from("clientes")
      .select("id, cnpj")
      .in("id", ids)
    expect(clientesGravados.error).toBeNull()

    const idPrimeira = clientesGravados.data!.find((c) => c.cnpj === "11.111.111/0001-11")!.id
    const idSegunda = clientesGravados.data!.find((c) => c.cnpj === "22.222.222/0001-22")!.id

    // Prova central do bug: a linha SEM produto (a segunda) não pode ter
    // herdado o produto da linha vizinha com a mesma razão social — se a
    // correlação de cliente_produtos ainda fosse só por razao_social, esta
    // asserção falharia.
    const produtosSegunda = await lerClienteProdutos(idSegunda)
    expect(produtosSegunda).toHaveLength(0)

    const produtosPrimeira = await lerClienteProdutos(idPrimeira)
    expect(produtosPrimeira.map((p) => p.produto_id)).toContain(produtoId)
  })

  it("semcnpjassimetrico: mesma razão social, uma linha sem CNPJ e outra com CNPJ continuam colidindo", async () => {
    const razaoSocial = uniqueRazaoSocial("lote-semcnpjassimetrico")

    const linha1 = baseRowFields(razaoSocial, null)
    const linha2 = baseRowFields(razaoSocial, "33.333.333/0001-33")

    const { data, error } = await supervisorClient.rpc("importar_clientes_lote", {
      p_clientes: [linha1, linha2],
    })
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(1)
    createdClienteIds.push(...data!.map((r: { id: string }) => r.id))

    const existentes = await lerClientesPorRazaoSocial(razaoSocial)
    expect(existentes).toHaveLength(1)
  })
})

describe("importar_clientes_ativos_lote (migration 0030 — razao_social + cnpj)", () => {
  function linhaCompleta(razaoSocial: string, cnpj: string | null, overrides: Record<string, unknown> = {}) {
    return {
      razao_social: razaoSocial,
      cnpj,
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      complemento: null,
      cidade: "São Paulo",
      estado: "SP",
      responsavel: vendedorId,
      categoria_id: null,
      contato: "Fulano de Tal",
      telefone: "11999990000",
      email: null,
      numero_de_lojas: null,
      nome_fantasia: null,
      produto_ids: [],
      ...overrides,
    }
  }

  async function importarAtivos(rows: Record<string, unknown>[]) {
    return supervisorClient.rpc("importar_clientes_ativos_lote", { p_clientes: rows })
  }

  it("mesmocnpj: duas linhas completas com mesma razão social e mesmo CNPJ continuam colidindo — 1 inserida, 1 duplicada", async () => {
    const razaoSocial = uniqueRazaoSocial("ativos-mesmocnpj")
    const cnpj = "44.444.444/0001-44"

    const linha1 = linhaCompleta(razaoSocial, cnpj)
    const linha2 = linhaCompleta(razaoSocial, cnpj)

    const { data, error } = await importarAtivos([linha1, linha2])
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(2)

    const inseridos = data!.filter((r: { status: string }) => r.status === "inserido")
    const duplicados = data!.filter((r: { status: string }) => r.status === "duplicado")
    expect(inseridos).toHaveLength(1)
    expect(inseridos[0].id).toBeTruthy()
    expect(duplicados).toHaveLength(1)
    expect(duplicados[0].id).toBeNull()
    createdClienteIds.push(inseridos[0].id)

    const existentes = await lerClientesPorRazaoSocial(razaoSocial)
    expect(existentes).toHaveLength(1)
  })

  it("cnpjdiferente: duas linhas completas com mesma razão social e CNPJs diferentes NÃO colidem mais — as duas inseridas, sem cross-contaminação de produtos", async () => {
    const produtoId = await buscarProdutoId()
    const razaoSocial = uniqueRazaoSocial("ativos-cnpjdiferente")

    const linha1 = linhaCompleta(razaoSocial, "55.555.555/0001-55", { produto_ids: [produtoId] })
    const linha2 = linhaCompleta(razaoSocial, "66.666.666/0001-66", { produto_ids: [] })

    const { data, error } = await importarAtivos([linha1, linha2])
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(2)

    const inseridos = data!.filter((r: { status: string }) => r.status === "inserido")
    expect(inseridos).toHaveLength(2)
    const ids = inseridos.map((r: { id: string }) => r.id)
    expect(new Set(ids).size).toBe(2)
    createdClienteIds.push(...ids)

    const clientesGravados = await serviceClient()
      .from("clientes")
      .select("id, cnpj")
      .in("id", ids)
    expect(clientesGravados.error).toBeNull()

    const idPrimeira = clientesGravados.data!.find((c) => c.cnpj === "55.555.555/0001-55")!.id
    const idSegunda = clientesGravados.data!.find((c) => c.cnpj === "66.666.666/0001-66")!.id

    const produtosSegunda = await lerClienteProdutos(idSegunda)
    expect(produtosSegunda).toHaveLength(0)

    const produtosPrimeira = await lerClienteProdutos(idPrimeira)
    expect(produtosPrimeira.map((p) => p.produto_id)).toContain(produtoId)
  })

  it("semcnpjassimetrico: cliente já existente sem CNPJ colide com uma linha nova com a mesma razão social e CNPJ presente", async () => {
    const razaoSocial = uniqueRazaoSocial("ativos-semcnpjassimetrico")

    const seeded = await serviceClient()
      .from("clientes")
      .insert({ razao_social: razaoSocial, responsavel: vendedorId })
      .select("id")
      .single()
    expect(seeded.error).toBeNull()
    createdClienteIds.push(seeded.data!.id)

    const linhaNova = linhaCompleta(razaoSocial, "77.777.777/0001-77")

    const { data, error } = await importarAtivos([linhaNova])
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(1)
    expect(data![0].status).toBe("duplicado")
    expect(data![0].id).toBeNull()

    const existentes = await lerClientesPorRazaoSocial(razaoSocial)
    expect(existentes).toHaveLength(1)
  })
})
