import { afterEach, describe, expect, it } from "vitest"

import { UFS } from "../../lib/clientes/ufs"
import {
  createClienteSchema,
  updateClienteSchema,
} from "../../lib/validations/cliente"
import { serviceClient } from "../helpers/supabase-test-clients"

/**
 * Tests for D-06 (quick task 260819-m8q): `updateClienteSchema` accepts
 * cep/rua/numero/cidade/estado blank, while `createClienteSchema` above it
 * in the same file is UNCHANGED and still requires all 5 (D-01).
 *
 * Two blocks, same discipline as tests/clientes/cliente-actions.test.ts:
 * - Schema block (pure, no network): exercises the zod schemas directly.
 * - Database block (integration): same convention as
 *   tests/clientes/endereco-opcional.test.ts — uses `serviceClient()`,
 *   never `signInAs` (known signInWithPassword rate limit, see Blockers in
 *   STATE.md), reads an arbitrary `profiles` id for `responsavel`.
 *
 * The Server Action `updateCliente` itself CANNOT be invoked directly from
 * Vitest — it calls lib/supabase/server.ts's createClient(), which reads
 * next/headers' cookies(), requiring a live Next.js request scope
 * (AsyncLocalStorage) that does not exist under Vitest. Same precedent
 * already documented in tests/clientes/cliente-actions.test.ts's header —
 * the database block below exercises the exact same UPDATE shape the
 * action sends to Postgres, instead of inventing a mock of the action.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Edicao Opcional ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function baseUpdateFields() {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    razaoSocial: "Acme Ltda",
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: "11111111-1111-1111-1111-111111111111",
  }
}

function baseCreateFields() {
  return {
    razaoSocial: "Acme Ltda",
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: "11111111-1111-1111-1111-111111111111",
  }
}

const createdClienteIds: string[] = []

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  const admin = serviceClient()
  await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
})

describe("updateClienteSchema (D-06, quick task 260819-m8q)", () => {
  it("accepts cep/rua/numero/cidade/estado all blank", () => {
    const result = updateClienteSchema.safeParse({
      ...baseUpdateFields(),
      cep: "",
      rua: "",
      numero: "",
      cidade: "",
      estado: "",
    })

    expect(result.success).toBe(true)
  })

  it("still rejects estado: 'XX', pointing at the estado field", () => {
    const result = updateClienteSchema.safeParse({
      ...baseUpdateFields(),
      estado: "XX",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const estadoIssue = result.error.issues.find(
        (issue) => issue.path[0] === "estado"
      )
      expect(estadoIssue).toBeDefined()
    }
  })

  it("still rejects estado: 'São Paulo' (full name instead of sigla), pointing at the estado field", () => {
    const result = updateClienteSchema.safeParse({
      ...baseUpdateFields(),
      estado: "São Paulo",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const estadoIssue = result.error.issues.find(
        (issue) => issue.path[0] === "estado"
      )
      expect(estadoIssue).toBeDefined()
    }
  })

  it("still accepts every one of the 27 UF siglas", () => {
    for (const uf of UFS) {
      const result = updateClienteSchema.safeParse({
        ...baseUpdateFields(),
        estado: uf,
      })
      expect(result.success).toBe(true)
    }
  })

  it("still rejects an empty razaoSocial, pointing at the razaoSocial field", () => {
    const result = updateClienteSchema.safeParse({
      ...baseUpdateFields(),
      razaoSocial: "",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const razaoSocialIssue = result.error.issues.find(
        (issue) => issue.path[0] === "razaoSocial"
      )
      expect(razaoSocialIssue).toBeDefined()
    }
  })

  it("still rejects an empty responsavel, pointing at the responsavel field", () => {
    const result = updateClienteSchema.safeParse({
      ...baseUpdateFields(),
      responsavel: "",
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const responsavelIssue = result.error.issues.find(
        (issue) => issue.path[0] === "responsavel"
      )
      expect(responsavelIssue).toBeDefined()
    }
  })
})

describe("createClienteSchema stays unchanged (D-01, quick task 260819-m8q)", () => {
  it("still rejects an empty cep, pointing at the cep field", () => {
    const result = createClienteSchema.safeParse({ ...baseCreateFields(), cep: "" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "cep")).toBe(true)
    }
  })

  it("still rejects an empty rua, pointing at the rua field", () => {
    const result = createClienteSchema.safeParse({ ...baseCreateFields(), rua: "" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "rua")).toBe(true)
    }
  })

  it("still rejects an empty numero, pointing at the numero field", () => {
    const result = createClienteSchema.safeParse({
      ...baseCreateFields(),
      numero: "",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "numero")).toBe(true)
    }
  })

  it("still rejects an empty cidade, pointing at the cidade field", () => {
    const result = createClienteSchema.safeParse({
      ...baseCreateFields(),
      cidade: "",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "cidade")).toBe(true)
    }
  })

  it("still rejects an empty estado, pointing at the estado field", () => {
    const result = createClienteSchema.safeParse({
      ...baseCreateFields(),
      estado: "",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "estado")).toBe(true)
    }
  })
})

async function getResponsavelId(): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin.from("profiles").select("id").limit(1).single()
  if (error || !data) {
    throw new Error(`Failed to read a responsavel id from profiles: ${error?.message}`)
  }
  return data.id
}

describe("UPDATE direto em clientes — endereço nulo aceito, texto vazio recusado (D-06, quick task 260819-m8q)", () => {
  it("UPDATE setting the 5 endereço fields to null is accepted", async () => {
    const admin = serviceClient()
    const responsavelId = await getResponsavelId()
    const razaoSocial = uniqueRazaoSocial("update-nulo")

    const { data: created, error: createError } = await admin
      .from("clientes")
      .insert({
        razao_social: razaoSocial,
        responsavel: responsavelId,
        cep: "01310-100",
        rua: "Av. Paulista",
        numero: "1000",
        cidade: "São Paulo",
        estado: "SP",
      })
      .select("id")
      .single()

    expect(createError).toBeNull()
    if (created?.id) createdClienteIds.push(created.id)

    const { data: updated, error: updateError } = await admin
      .from("clientes")
      .update({
        cep: null,
        rua: null,
        numero: null,
        cidade: null,
        estado: null,
      })
      .eq("id", created!.id)
      .select("cep, rua, numero, cidade, estado")
      .single()

    expect(updateError).toBeNull()
    expect(updated?.cep).toBeNull()
    expect(updated?.rua).toBeNull()
    expect(updated?.numero).toBeNull()
    expect(updated?.cidade).toBeNull()
    expect(updated?.estado).toBeNull()
  })

  it("UPDATE setting estado to '' (empty string) is rejected by chk_estado_valido — this is why updateCliente must convert blank to null before writing", async () => {
    const admin = serviceClient()
    const responsavelId = await getResponsavelId()
    const razaoSocial = uniqueRazaoSocial("update-estado-vazio")

    const { data: created, error: createError } = await admin
      .from("clientes")
      .insert({
        razao_social: razaoSocial,
        responsavel: responsavelId,
        estado: "SP",
      })
      .select("id")
      .single()

    expect(createError).toBeNull()
    if (created?.id) createdClienteIds.push(created.id)

    const { data: updated, error: updateError } = await admin
      .from("clientes")
      .update({ estado: "" })
      .eq("id", created!.id)
      .select("id")

    expect(updateError).not.toBeNull()
    expect(updateError?.code).toBe("23514") // Postgres CHECK constraint violation

    const { data: unchanged } = await admin
      .from("clientes")
      .select("estado")
      .eq("id", created!.id)
      .single()
    expect(unchanged?.estado).toBe("SP")
    expect(updated ?? []).toHaveLength(0)
  })
})
