import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { anonClient, serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * RLS contract test for the 6th editable-list lookup table
 * (`motivos_conclusao_remota`) — Phase 22 Plan 1, Task 1.
 *
 * Structurally identical to
 * tests/configuracoes/rls-frequencias-pedido.test.ts (Phase 16, the most
 * recent editable-list lookup table): read-open to any authenticated
 * user, write (insert/update/delete) restricted to Supervisor via
 * is_supervisor(). Created by 0022_conclusao_remota_com_motivo.sql, this
 * suite is RED until the migration's push in Task 3.
 *
 * Same discipline as every RLS suite in this project (Pitfall 2): every
 * assertion runs as a real signed-in restricted role (Supervisor or
 * Vendedor A) via signInAs(); serviceClient() is used ONLY for cleanup
 * and for re-reading a row's true state after a denied write (never to
 * assert RLS behaviour itself — the service role bypasses RLS and would
 * give a false pass). Each identity is signed in exactly ONCE for the
 * whole file (beforeAll) and reused across every test, per the known
 * signInWithPassword rate-limit noted in STATE.md.
 *
 * The `vendedorle` case below is the single most important case in this
 * file: it proves — with a real Vendedor session, never just a
 * Supervisor one — that the SELECT policy is open. Restricting it by
 * accident leaves the Vendedor's dropdown permanently empty with no
 * error, the exact silent-failure mode migration 0016 already documents
 * in this project.
 *
 * Run in isolation
 * (`npx vitest run tests/configuracoes/rls-motivos-conclusao-remota.test.ts`).
 */

describe("RLS: motivos_conclusao_remota (6a lista editavel)", () => {
  let supervisor: Awaited<ReturnType<typeof signInAs>>
  let vendedorA: Awaited<ReturnType<typeof signInAs>>
  const createdIds: string[] = []

  beforeAll(async () => {
    supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    vendedorA = await signInAs(
      SEED_ACCOUNTS.vendedorA.email,
      SEED_ACCOUNTS.vendedorA.password
    )
  })

  afterAll(async () => {
    if (createdIds.length === 0) return
    const admin = serviceClient()
    await admin.from("motivos_conclusao_remota").delete().in("id", createdIds)
  })

  function uniqueNome(label: string): string {
    return `Teste Motivo Remoto ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  it("seed: os cinco valores iniciais existem na tabela e todos estao ativos", async () => {
    const nomesEsperados = [
      "Pedido por telefone",
      "Pedido por WhatsApp",
      "Pedido por e-mail",
      "Reunião por vídeo",
      "Cliente não pôde receber",
    ]

    const { data, error } = await vendedorA
      .from("motivos_conclusao_remota")
      .select("nome, ativo")
      .in("nome", nomesEsperados)

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data).toHaveLength(nomesEsperados.length)
    for (const row of data ?? []) {
      expect(row.ativo).toBe(true)
    }
  })

  it("vendedorle: uma sessao real de VENDEDOR le a tabela e recebe conjunto nao vazio", async () => {
    const { data, error } = await vendedorA
      .from("motivos_conclusao_remota")
      .select("id")

    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it("vendedorescreve: a mesma sessao de Vendedor tem insert/update/delete recusados, e a releitura pelo service role confirma que nada mudou de verdade", async () => {
    const admin = serviceClient()

    const nomeOriginal = uniqueNome("vendedor-tenta-inserir")
    const { data: inserted, error: insertError } = await vendedorA
      .from("motivos_conclusao_remota")
      .insert({ nome: nomeOriginal })
      .select("id")
    expect(inserted ?? []).toHaveLength(0)
    if (insertError) {
      expect(insertError).not.toBeNull()
    }
    const { data: rereadAfterInsert } = await admin
      .from("motivos_conclusao_remota")
      .select("id")
      .eq("nome", nomeOriginal)
    expect(rereadAfterInsert ?? []).toHaveLength(0)

    const { data: seeded, error: seedError } = await supervisor
      .from("motivos_conclusao_remota")
      .insert({ nome: uniqueNome("alvo-de-escrita-vendedor") })
      .select("id, nome")
      .single()
    expect(seedError).toBeNull()
    createdIds.push(seeded!.id)

    const { data: updated, error: updateError } = await vendedorA
      .from("motivos_conclusao_remota")
      .update({ ativo: false })
      .eq("id", seeded!.id)
      .select("id")
    expect(updated ?? []).toHaveLength(0)
    if (updateError) {
      expect(updateError).not.toBeNull()
    }
    const { data: rereadAfterUpdate } = await admin
      .from("motivos_conclusao_remota")
      .select("ativo")
      .eq("id", seeded!.id)
      .single()
    expect(rereadAfterUpdate?.ativo).toBe(true)

    const { data: deleted, error: deleteError } = await vendedorA
      .from("motivos_conclusao_remota")
      .delete()
      .eq("id", seeded!.id)
      .select("id")
    expect(deleted ?? []).toHaveLength(0)
    if (deleteError) {
      expect(deleteError).not.toBeNull()
    }
    const { data: rereadAfterDelete } = await admin
      .from("motivos_conclusao_remota")
      .select("id")
      .eq("id", seeded!.id)
    expect(rereadAfterDelete ?? []).toHaveLength(1)
  })

  it("supervisorescreve: Supervisor insere, renomeia e desativa com sucesso", async () => {
    const nomeOriginal = uniqueNome("supervisor-insert")

    const { data: inserted, error: insertError } = await supervisor
      .from("motivos_conclusao_remota")
      .insert({ nome: nomeOriginal })
      .select("id")
      .single()

    expect(insertError).toBeNull()
    expect(inserted).not.toBeNull()
    createdIds.push(inserted!.id)

    const nomeNovo = uniqueNome("supervisor-renomeado")

    const { data: renamed, error: renameError } = await supervisor
      .from("motivos_conclusao_remota")
      .update({ nome: nomeNovo })
      .eq("id", inserted!.id)
      .select("id, nome")
      .single()

    expect(renameError).toBeNull()
    expect(renamed?.nome).toBe(nomeNovo)

    const { data: deactivated, error: deactivateError } = await supervisor
      .from("motivos_conclusao_remota")
      .update({ ativo: false })
      .eq("id", inserted!.id)
      .select("id, ativo")
      .single()

    expect(deactivateError).toBeNull()
    expect(deactivated?.ativo).toBe(false)
  })

  it("nomeunico: inserir um segundo valor com nome ja existente e recusado pela restricao de unicidade", async () => {
    const nome = uniqueNome("nomeunico")

    const { data: firstInsert, error: firstError } = await supervisor
      .from("motivos_conclusao_remota")
      .insert({ nome })
      .select("id")
      .single()

    expect(firstError).toBeNull()
    createdIds.push(firstInsert!.id)

    const { data: secondInsert, error: secondError } = await supervisor
      .from("motivos_conclusao_remota")
      .insert({ nome })
      .select("id")
      .single()

    expect(secondInsert).toBeNull()
    expect(secondError).not.toBeNull()
    expect(secondError?.code).toBe("23505")
  })

  it("anonimo: um cliente nao autenticado nao le nada da tabela", async () => {
    const anon = anonClient()

    const { data, error } = await anon
      .from("motivos_conclusao_remota")
      .select("id")

    if (error) {
      expect(error).not.toBeNull()
    } else {
      expect(data ?? []).toHaveLength(0)
    }
  })
})
