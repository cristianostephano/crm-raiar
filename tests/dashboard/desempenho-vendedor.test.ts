import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Behavior tests for `dashboard_desempenho_vendedor(p_inicio, p_fim)`
 * (DSH-03/D-10). Same ganho/perdido-via-historico basis as
 * dashboard_ganhos_perdidos, grouped by `clientes.responsavel` — RLS on
 * `clientes` collapses a Vendedor's own call to exactly one row (D-07),
 * with no manual role branching inside the function.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Dashboard ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function baseClienteFields(
  razaoSocial: string,
  responsavelId: string,
  etapa: string
) {
  return {
    razao_social: razaoSocial,
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
    responsavel: responsavelId,
    etapa,
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

function testWindow() {
  const now = Date.now()
  return {
    inicio: new Date(now - 1000).toISOString(),
    fim: new Date(now + 30_000).toISOString(),
  }
}

type DesempenhoRow = {
  responsavel: string
  responsavel_nome: string | null
  ganho: number | string
  perdido: number | string
}

function toResponsavelMap(
  rows: DesempenhoRow[]
): Record<string, { ganho: number; perdido: number }> {
  return Object.fromEntries(
    rows.map((row) => [
      row.responsavel,
      { ganho: Number(row.ganho), perdido: Number(row.perdido) },
    ])
  )
}

describe("dashboard_desempenho_vendedor", () => {
  it("as Supervisor, groups by responsavel and includes Vendedor A's ganho count in the period (D-10)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const admin = serviceClient()
    const window = testWindow()

    const { data: before, error: beforeError } = await supervisor.rpc(
      "dashboard_desempenho_vendedor",
      { p_inicio: window.inicio, p_fim: window.fim }
    )
    expect(beforeError).toBeNull()
    const beforeMap = toResponsavelMap((before ?? []) as DesempenhoRow[])
    const beforeGanho = beforeMap[vendedorAId]?.ganho ?? 0

    const razaoSocial = uniqueRazaoSocial("desempenho-supervisor")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId, "primeira_venda"))
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { error: updateError } = await admin
      .from("clientes")
      .update({ status_acompanhamento: "ganho" })
      .eq("id", inserted!.id)
    expect(updateError).toBeNull()

    const { data: after, error: afterError } = await supervisor.rpc(
      "dashboard_desempenho_vendedor",
      { p_inicio: window.inicio, p_fim: window.fim }
    )
    expect(afterError).toBeNull()
    const afterMap = toResponsavelMap((after ?? []) as DesempenhoRow[])

    expect(afterMap[vendedorAId]).toBeDefined()
    expect(afterMap[vendedorAId].ganho).toBe(beforeGanho + 1)
  })

  it("as Vendedor A, returns exactly one row — their own (D-07)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const admin = serviceClient()
    const window = testWindow()

    const razaoSocial = uniqueRazaoSocial("desempenho-vendedor-a")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId, "primeira_venda"))
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { error: updateError } = await admin
      .from("clientes")
      .update({ status_acompanhamento: "ganho" })
      .eq("id", inserted!.id)
    expect(updateError).toBeNull()

    const { data, error } = await vendedorA.rpc("dashboard_desempenho_vendedor", {
      p_inicio: window.inicio,
      p_fim: window.fim,
    })
    expect(error).toBeNull()
    const rows = (data ?? []) as DesempenhoRow[]

    expect(rows).toHaveLength(1)
    expect(rows[0].responsavel).toBe(vendedorAId)
  })
})
