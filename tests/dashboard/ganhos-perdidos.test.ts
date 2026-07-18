import { afterEach, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Behavior tests for `dashboard_ganhos_perdidos(p_inicio, p_fim)` (DSH-02).
 *
 * Per 04-RESEARCH.md Pattern 2 / Pitfall 1-2: the period filters by the date
 * of the most recent status-change `historico` row (tipo =
 * 'status_acompanhamento'), NOT by `clientes.criado_em` or
 * `clientes.etapa_alterada_em` (D-02). Status changes are driven via the
 * service client (never a direct `historico` insert — the 0002
 * `clientes_after_update_historico()` trigger is the only legitimate
 * writer, per the plan's read_first guidance).
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

async function getMotivoPerdaId(): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin
    .from("motivos_perda")
    .select("id")
    .eq("ativo", true)
    .limit(1)
    .single()
  if (error || !data) {
    throw new Error("Nenhum motivo de perda ativo encontrado para o teste")
  }
  return data.id as string
}

/**
 * A window captured once per test, BEFORE any mutation, and reused for both
 * the "before" and "after" RPC calls so the delta comparison is
 * apples-to-apples. `fim` extends 30s into the future to safely cover this
 * test's own (fast) async operations without needing to know the exact end
 * time in advance.
 */
function testWindow() {
  const now = Date.now()
  return {
    inicio: new Date(now - 1000).toISOString(),
    fim: new Date(now + 30_000).toISOString(),
  }
}

type StatusTotalRow = { status: string; total: number | string }

function toStatusMap(rows: StatusTotalRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]))
}

describe("dashboard_ganhos_perdidos", () => {
  it("counts a cliente whose most recent status-change historico row is ganho inside the window (D-02)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const admin = serviceClient()
    const window = testWindow()

    const razaoSocial = uniqueRazaoSocial("ganho")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId, "primeira_venda"))
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { data: before, error: beforeError } = await vendedorA.rpc(
      "dashboard_ganhos_perdidos",
      { p_inicio: window.inicio, p_fim: window.fim }
    )
    expect(beforeError).toBeNull()
    const beforeMap = toStatusMap((before ?? []) as StatusTotalRow[])

    const { error: updateError } = await admin
      .from("clientes")
      .update({ status_acompanhamento: "ganho" })
      .eq("id", inserted!.id)
    expect(updateError).toBeNull()

    const { data: after, error: afterError } = await vendedorA.rpc(
      "dashboard_ganhos_perdidos",
      { p_inicio: window.inicio, p_fim: window.fim }
    )
    expect(afterError).toBeNull()
    const afterMap = toStatusMap((after ?? []) as StatusTotalRow[])

    expect(afterMap.ganho ?? 0).toBe((beforeMap.ganho ?? 0) + 1)
  })

  it("excludes a status-change historico row OUTSIDE the requested window", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const admin = serviceClient()
    const window = testWindow()

    const razaoSocial = uniqueRazaoSocial("fora-da-janela")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId, "primeira_venda"))
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    // Baseline for the WIDE (correct) window, taken before the mutation.
    const { data: beforeWide, error: beforeWideError } = await vendedorA.rpc(
      "dashboard_ganhos_perdidos",
      { p_inicio: window.inicio, p_fim: window.fim }
    )
    expect(beforeWideError).toBeNull()
    const beforeWideMap = toStatusMap((beforeWide ?? []) as StatusTotalRow[])

    const { error: updateError } = await admin
      .from("clientes")
      .update({ status_acompanhamento: "ganho" })
      .eq("id", inserted!.id)
    expect(updateError).toBeNull()

    // A window entirely in the past (long before this test ran) must NOT
    // include the status change that just happened.
    const pastWindow = {
      inicio: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString(),
      fim: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    }
    const { data: pastData, error: pastError } = await vendedorA.rpc(
      "dashboard_ganhos_perdidos",
      { p_inicio: pastWindow.inicio, p_fim: pastWindow.fim }
    )
    expect(pastError).toBeNull()
    const pastMap = toStatusMap((pastData ?? []) as StatusTotalRow[])

    // The past window's ganho count must be unaffected by this test's own
    // mutation (it happened "now", not a year ago).
    expect(pastMap.ganho ?? 0).toBe(beforeWideMap.ganho ?? 0)

    // Sanity: the WIDE window DOES see it, confirming the mutation itself
    // worked and the exclusion above is a real date-basis filter, not a
    // silent no-op.
    const { data: afterWide, error: afterWideError } = await vendedorA.rpc(
      "dashboard_ganhos_perdidos",
      { p_inicio: window.inicio, p_fim: window.fim }
    )
    expect(afterWideError).toBeNull()
    const afterWideMap = toStatusMap((afterWide ?? []) as StatusTotalRow[])
    expect(afterWideMap.ganho ?? 0).toBe((beforeWideMap.ganho ?? 0) + 1)
  })

  it("counts a cliente that flipped perdido -> em_andamento -> ganho exactly once, as ganho (Pitfall 2 double-count edge)", async () => {
    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)
    const admin = serviceClient()
    const motivoPerdaId = await getMotivoPerdaId()
    const window = testWindow()

    const razaoSocial = uniqueRazaoSocial("double-count")
    const { data: inserted, error: insertError } = await vendedorA
      .from("clientes")
      .insert(baseClienteFields(razaoSocial, vendedorAId, "primeira_venda"))
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdClienteIds.push(inserted!.id)

    const { data: before, error: beforeError } = await vendedorA.rpc(
      "dashboard_ganhos_perdidos",
      { p_inicio: window.inicio, p_fim: window.fim }
    )
    expect(beforeError).toBeNull()
    const beforeMap = toStatusMap((before ?? []) as StatusTotalRow[])

    // Three separate UPDATEs so the AFTER UPDATE trigger writes three
    // separate historico rows, exercising the distinct-on-latest-event CTE.
    const { error: e1 } = await admin
      .from("clientes")
      .update({
        status_acompanhamento: "perdido",
        motivo_perda_id: motivoPerdaId,
      })
      .eq("id", inserted!.id)
    expect(e1).toBeNull()

    const { error: e2 } = await admin
      .from("clientes")
      .update({ status_acompanhamento: "em_andamento" })
      .eq("id", inserted!.id)
    expect(e2).toBeNull()

    const { error: e3 } = await admin
      .from("clientes")
      .update({ status_acompanhamento: "ganho" })
      .eq("id", inserted!.id)
    expect(e3).toBeNull()

    const { data: after, error: afterError } = await vendedorA.rpc(
      "dashboard_ganhos_perdidos",
      { p_inicio: window.inicio, p_fim: window.fim }
    )
    expect(afterError).toBeNull()
    const afterMap = toStatusMap((after ?? []) as StatusTotalRow[])

    // Counted exactly once, as ganho — never also as perdido, even though a
    // perdido historico row was written along the way.
    expect(afterMap.ganho ?? 0).toBe((beforeMap.ganho ?? 0) + 1)
    expect(afterMap.perdido ?? 0).toBe(beforeMap.perdido ?? 0)
  })
})
