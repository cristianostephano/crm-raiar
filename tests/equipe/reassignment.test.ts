import { afterAll, describe, expect, it } from "vitest"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import {
  createTestMember,
  deleteTestMember,
  serviceClient,
  signInAs,
} from "../helpers/supabase-test-clients"

/**
 * Phase 10 Plan 2 — the executable form of the locked product rule that
 * only in-progress business moves to the substitute when a team member is
 * deactivated (EQP-01), while already-won and already-lost clientes stay
 * credited to the deactivated member (EQP-04). This rule has no UI surface
 * and would regress invisibly with a one-word change to the migration's
 * `where status_acompanhamento = 'em_andamento'` filter — it needs an
 * executable guard, not a code read-through.
 *
 * `serviceClient()` is used ONLY for seeding and read-back, never for the
 * RPC call under test itself: the service role bypasses RLS and
 * `is_supervisor()`, so calling through it would pass regardless of the
 * guards and prove nothing (same discipline as
 * `tests/importacao/rls-importar-lote.test.ts`).
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Reassignment ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function baseRowFields(razaoSocial: string, responsavelId: string) {
  return {
    razao_social: razaoSocial,
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    complemento: null,
    cidade: "São Paulo",
    estado: "SP",
    responsavel: responsavelId,
    categoria_id: null,
    contato: "Fulano de Tal",
    telefone: "11999990000",
    email: null,
    numero_de_lojas: null,
  }
}

async function getUserId(client: Awaited<ReturnType<typeof signInAs>>): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) throw new Error("Expected an authenticated user")
  return user.id
}

let alvoId: string | null = null
const createdClienteIds: string[] = []

/**
 * Cleanup discipline: clientes MUST be deleted before the fixture member,
 * or `deleteTestMember` fails on the `clientes.responsavel` foreign key
 * (no ON DELETE action). Runs unconditionally via `afterAll` so a failed
 * assertion never leaves a permanently deactivated ghost member in the
 * live team list.
 */
afterAll(async () => {
  if (createdClienteIds.length > 0) {
    await serviceClient().from("clientes").delete().in("id", createdClienteIds.splice(0))
  }
  if (alvoId) {
    await deleteTestMember(alvoId)
    alvoId = null
  }
})

describe("desativar-membro-equipe reassignment contract (EQP-01, EQP-04)", () => {
  it("reassigns em_andamento clientes to the substitute and counts them", async () => {
    const alvo = await createTestMember("vendedor", "alvo")
    alvoId = alvo.id

    const vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
    const vendedorAId = await getUserId(vendedorA)

    const { data: motivo, error: motivoError } = await serviceClient()
      .from("motivos_perda")
      .select("id")
      .limit(1)
      .single()
    expect(motivoError).toBeNull()
    const motivoId = motivo!.id as string

    const razaoSocialEmAndamento = uniqueRazaoSocial("em-andamento")
    const razaoSocialGanho = uniqueRazaoSocial("ganho")
    const razaoSocialPerdido = uniqueRazaoSocial("perdido")

    const { data: emAndamento, error: emAndamentoError } = await serviceClient()
      .from("clientes")
      .insert(baseRowFields(razaoSocialEmAndamento, alvo.id))
      .select("id")
      .single()
    expect(emAndamentoError).toBeNull()
    createdClienteIds.push(emAndamento!.id)

    const { data: ganho, error: ganhoError } = await serviceClient()
      .from("clientes")
      .insert({
        ...baseRowFields(razaoSocialGanho, alvo.id),
        etapa: "primeira_venda",
        status_acompanhamento: "ganho",
      })
      .select("id")
      .single()
    expect(ganhoError).toBeNull()
    createdClienteIds.push(ganho!.id)

    const { data: perdido, error: perdidoError } = await serviceClient()
      .from("clientes")
      .insert({
        ...baseRowFields(razaoSocialPerdido, alvo.id),
        status_acompanhamento: "perdido",
        motivo_perda_id: motivoId,
      })
      .select("id")
      .single()
    expect(perdidoError).toBeNull()
    createdClienteIds.push(perdido!.id)

    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const { data: rpcData, error: rpcError } = await supervisor.rpc(
      "desativar_membro_equipe",
      {
        p_profile_id: alvo.id,
        p_novo_responsavel_id: vendedorAId,
      }
    )

    expect(rpcError).toBeNull()
    expect(rpcData).not.toBeNull()
    expect(Number(rpcData![0].clientes_reatribuidos)).toBe(1)

    const { data: emAndamentoReadBack, error: readBackError } = await serviceClient()
      .from("clientes")
      .select("responsavel")
      .eq("id", emAndamento!.id)
      .single()
    expect(readBackError).toBeNull()
    expect(emAndamentoReadBack!.responsavel).toBe(vendedorAId)

    const { data: alvoProfile, error: alvoProfileError } = await serviceClient()
      .from("profiles")
      .select("ativo")
      .eq("id", alvo.id)
      .single()
    expect(alvoProfileError).toBeNull()
    expect(alvoProfile!.ativo).toBe(false)

    const { data: ganhoReadBack, error: ganhoReadBackError } = await serviceClient()
      .from("clientes")
      .select("responsavel")
      .eq("id", ganho!.id)
      .single()
    expect(ganhoReadBackError).toBeNull()
    expect(ganhoReadBack!.responsavel).toBe(alvo.id)

    const { data: perdidoReadBack, error: perdidoReadBackError } = await serviceClient()
      .from("clientes")
      .select("responsavel")
      .eq("id", perdido!.id)
      .single()
    expect(perdidoReadBackError).toBeNull()
    expect(perdidoReadBack!.responsavel).toBe(alvo.id)
  })

  it("preserves closed (ganho/perdido) clientes with the deactivated member as responsavel", async () => {
    // Re-verifies the same post-deactivation state from the first test,
    // asserting per-cliente so a failure message names which one moved.
    expect(alvoId).not.toBeNull()

    const clienteIds = createdClienteIds.slice()
    expect(clienteIds.length).toBe(3)

    const { data: clientes, error } = await serviceClient()
      .from("clientes")
      .select("id, razao_social, status_acompanhamento, responsavel")
      .in("id", clienteIds)
    expect(error).toBeNull()
    expect(clientes).not.toBeNull()

    const ganhoRow = clientes!.find((c) => c.status_acompanhamento === "ganho")
    const perdidoRow = clientes!.find((c) => c.status_acompanhamento === "perdido")

    expect(ganhoRow, "expected a ganho cliente in the fixture set").toBeDefined()
    expect(perdidoRow, "expected a perdido cliente in the fixture set").toBeDefined()

    expect(ganhoRow!.responsavel, "ganho cliente should stay with the deactivated member").toBe(
      alvoId
    )
    expect(
      perdidoRow!.responsavel,
      "perdido cliente should stay with the deactivated member"
    ).toBe(alvoId)
  })
})
