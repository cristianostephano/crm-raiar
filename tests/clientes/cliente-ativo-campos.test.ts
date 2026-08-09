import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"
import { ETAPA_FINAL } from "../../lib/funil/etapas"
import {
  frequenciaPedidoCanonica,
  frequenciaPedidoValida,
} from "../../lib/clientes/frequenciaPedido"
import {
  createClienteSchema,
  updateClienteSchema,
} from "../../lib/validations/cliente"

/**
 * Camada de dados dos três campos do cliente ativo — nome fantasia, CNPJ,
 * frequência de pedidos (16-03-PLAN.md, ATV-01/ATV-02).
 *
 * Duas metades: a primeira é pura (esquemas e funções puras, sem banco, sem
 * login). A segunda é de integração contra o banco real, com sessões reais
 * — porque `updateCliente` (Server Action) não pode ser invocada diretamente
 * pelo Vitest (precedente do projeto desde a Fase 2), esta metade exercita a
 * MESMA gravação/leitura de colunas que a ação faz.
 */

const VOCABULARIO_TESTE = [{ nome: "Semanal" }, { nome: "Quinzenal" }]

describe("cadastro: createClienteSchema nunca conhece os três campos do cliente ativo", () => {
  const base = {
    razaoSocial: "Cliente Teste Cadastro",
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP" as const,
    responsavel: "00000000-0000-0000-0000-000000000000",
  }

  it("cadastro: um objeto acrescido dos três campos novos e' aceito, mas o resultado NAO contem nenhum deles", () => {
    const parsed = createClienteSchema.safeParse({
      ...base,
      nomeFantasia: "Fantasia Ltda",
      cnpj: "12.345.678/0001-90",
      frequenciaPedidos: "Semanal",
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("nomeFantasia")
      expect(parsed.data).not.toHaveProperty("cnpj")
      expect(parsed.data).not.toHaveProperty("frequenciaPedidos")
    }
  })

  it("cadastro: um objeto valido sem os tres campos continua sendo aceito", () => {
    const parsed = createClienteSchema.safeParse(base)
    expect(parsed.success).toBe(true)
  })
})

describe("edicao: updateClienteSchema conhece os tres campos, todos opcionais", () => {
  const base = {
    id: "00000000-0000-0000-0000-000000000001",
    razaoSocial: "Cliente Teste Edicao",
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP" as const,
    responsavel: "00000000-0000-0000-0000-000000000000",
  }

  it("edicao: aceita os tres campos presentes e os devolve", () => {
    const parsed = updateClienteSchema.safeParse({
      ...base,
      nomeFantasia: "Fantasia Ltda",
      cnpj: "12.345.678/0001-90",
      frequenciaPedidos: "Semanal",
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.nomeFantasia).toBe("Fantasia Ltda")
      expect(parsed.data.cnpj).toBe("12.345.678/0001-90")
      expect(parsed.data.frequenciaPedidos).toBe("Semanal")
    }
  })

  it("edicao: aceita o objeto sem nenhum dos tres campos", () => {
    const parsed = updateClienteSchema.safeParse(base)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.nomeFantasia).toBeUndefined()
      expect(parsed.data.cnpj).toBeUndefined()
      expect(parsed.data.frequenciaPedidos).toBeUndefined()
    }
  })

  it("edicao: aceita CNPJ em qualquer formato, sem reclamar (fora de escopo)", () => {
    for (const cnpj of ["12345678000190", "12.345.678/0001-90", "abc-123", ""]) {
      const parsed = updateClienteSchema.safeParse({ ...base, cnpj })
      expect(parsed.success).toBe(true)
    }
  })
})

describe("vocabulario: frequenciaPedidoValida", () => {
  it("vocabulario: aceita vazio e ausente (campo opcional)", () => {
    expect(frequenciaPedidoValida(undefined, VOCABULARIO_TESTE)).toBe(true)
    expect(frequenciaPedidoValida(null, VOCABULARIO_TESTE)).toBe(true)
    expect(frequenciaPedidoValida("", VOCABULARIO_TESTE)).toBe(true)
    expect(frequenciaPedidoValida("   ", VOCABULARIO_TESTE)).toBe(true)
  })

  it("vocabulario: aceita um nome do vocabulario mesmo com caixa e espacos diferentes", () => {
    expect(frequenciaPedidoValida("  semanal  ", VOCABULARIO_TESTE)).toBe(true)
    expect(frequenciaPedidoValida("QUINZENAL", VOCABULARIO_TESTE)).toBe(true)
  })

  it("vocabulario: recusa um texto que nao esteja no vocabulario", () => {
    expect(frequenciaPedidoValida("Mensal", VOCABULARIO_TESTE)).toBe(false)
    expect(frequenciaPedidoValida("texto qualquer", VOCABULARIO_TESTE)).toBe(false)
  })
})

describe("canonico: frequenciaPedidoCanonica", () => {
  it("canonico: devolve o texto exato do vocabulario para entrada com caixa/espacos diferentes", () => {
    expect(frequenciaPedidoCanonica("  semanal  ", VOCABULARIO_TESTE)).toBe("Semanal")
    expect(frequenciaPedidoCanonica("QUINZENAL", VOCABULARIO_TESTE)).toBe("Quinzenal")
  })

  it("canonico: devolve nulo para entrada vazia ou desconhecida", () => {
    expect(frequenciaPedidoCanonica("", VOCABULARIO_TESTE)).toBeNull()
    expect(frequenciaPedidoCanonica(undefined, VOCABULARIO_TESTE)).toBeNull()
    expect(frequenciaPedidoCanonica("Mensal", VOCABULARIO_TESTE)).toBeNull()
  })
})

// ───────────────────────────────────────────────────────────────────────
// Metade de integracao — sessoes reais contra o banco real (Pitfall/
// precedente do projeto desde a Fase 2: Server Actions nao podem ser
// invocadas diretamente pelo Vitest).
// ───────────────────────────────────────────────────────────────────────

function uniqueRazaoSocial(label: string): string {
  return `Teste ClienteAtivoCampos ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function baseClienteFields(razaoSocial: string, responsavelId: string) {
  return {
    razao_social: razaoSocial,
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: responsavelId,
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

async function createTestCliente(
  client: SupabaseClient,
  responsavelId: string,
  label: string
): Promise<string> {
  const { data, error } = await client
    .from("clientes")
    .insert(baseClienteFields(uniqueRazaoSocial(label), responsavelId))
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(`Failed to seed test cliente: ${error?.message}`)
  }
  createdClienteIds.push(data.id)
  return data.id
}

describe("colunas: gravacao e leitura das tres colunas pelo dono", () => {
  it("colunas: com sessao real do Vendedor dono, grava as tres colunas num cliente proprio e rele com os mesmos valores", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "colunas")

    const { data: updated, error: updateError } = await vendedorA
      .from("clientes")
      .update({
        nome_fantasia: "Fantasia Colunas",
        cnpj: "12.345.678/0001-90",
        frequencia_pedidos: "Semanal",
      })
      .eq("id", clienteId)
      .select("nome_fantasia, cnpj, frequencia_pedidos")
      .single()

    expect(updateError).toBeNull()
    expect(updated?.nome_fantasia).toBe("Fantasia Colunas")
    expect(updated?.cnpj).toBe("12.345.678/0001-90")
    expect(updated?.frequencia_pedidos).toBe("Semanal")

    const { data: reread, error: rereadError } = await vendedorA
      .from("clientes")
      .select("nome_fantasia, cnpj, frequencia_pedidos")
      .eq("id", clienteId)
      .single()

    expect(rereadError).toBeNull()
    expect(reread?.nome_fantasia).toBe("Fantasia Colunas")
    expect(reread?.cnpj).toBe("12.345.678/0001-90")
    expect(reread?.frequencia_pedidos).toBe("Semanal")
  })
})

describe("legado: cliente ganho antigo com as tres colunas nulas e' dado historico, nao erro", () => {
  it("legado: um cliente ganho semeado com as tres colunas nulas e lido normalmente pelo dono, com os tres campos nulos e sem erro", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const admin = serviceClient()

    const { data: inserted, error: insertError } = await admin
      .from("clientes")
      .insert({
        ...baseClienteFields(uniqueRazaoSocial("legado"), vendedorAId),
        etapa: ETAPA_FINAL,
        status_acompanhamento: "ganho",
      })
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { data: cliente, error: readError } = await vendedorA
      .from("clientes")
      .select("nome_fantasia, cnpj, frequencia_pedidos")
      .eq("id", inserted!.id)
      .single()

    expect(readError).toBeNull()
    expect(cliente?.nome_fantasia).toBeNull()
    expect(cliente?.cnpj).toBeNull()
    expect(cliente?.frequencia_pedidos).toBeNull()
  })
})

describe("alheio: Vendedor B nao altera as tres colunas de um cliente de Vendedor A", () => {
  it("alheio: Vendedor B tentando gravar as tres colunas num cliente de Vendedor A nao altera nada", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const clienteId = await createTestCliente(vendedorA, vendedorAId, "alheio")

    const { data: valoresOriginais } = await serviceClient()
      .from("clientes")
      .select("nome_fantasia, cnpj, frequencia_pedidos")
      .eq("id", clienteId)
      .single()

    const vendedorB = await signInAs(
      SEED_ACCOUNTS.vendedorB.email,
      SEED_ACCOUNTS.vendedorB.password
    )
    const { data: updateResult, error: updateError } = await vendedorB
      .from("clientes")
      .update({
        nome_fantasia: "Tentativa Alheia",
        cnpj: "99.999.999/0001-99",
        frequencia_pedidos: "Quinzenal",
      })
      .eq("id", clienteId)
      .select("id")
    expect(updateError).toBeNull()
    expect(updateResult ?? []).toHaveLength(0)

    const { data: reread, error: rereadError } = await serviceClient()
      .from("clientes")
      .select("nome_fantasia, cnpj, frequencia_pedidos")
      .eq("id", clienteId)
      .single()

    expect(rereadError).toBeNull()
    expect(reread?.nome_fantasia).toBe(valoresOriginais?.nome_fantasia ?? null)
    expect(reread?.cnpj).toBe(valoresOriginais?.cnpj ?? null)
    expect(reread?.frequencia_pedidos).toBe(
      valoresOriginais?.frequencia_pedidos ?? null
    )
  })
})
