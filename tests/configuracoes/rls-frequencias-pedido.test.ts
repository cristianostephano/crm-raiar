import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { anonClient, serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * RLS contract test for the 5th editable-list lookup table
 * (`frequencias_pedido`) — Phase 16 Plan 1, Task 1.
 *
 * Structurally identical to categorias/produtos_consumidos/tipos_tarefa/
 * motivos_perda (0002_clientes_and_funil.sql): read-open to any
 * authenticated user, write (insert/update/delete) restricted to
 * Supervisor via is_supervisor(). Created by
 * 0016_frequencias_pedido.sql, this suite is the TDD RED gate for that
 * migration (Task 1 writes it RED, Task 3's `supabase db push` + rerun
 * takes it GREEN).
 *
 * Same discipline as tests/configuracoes/rls-listas.test.ts (Pitfall 2):
 * every assertion runs as a real signed-in restricted role (Supervisor or
 * Vendedor A) via signInAs(); serviceClient() is used ONLY for cleanup and
 * for re-reading a row's true state after a denied write (never to assert
 * RLS behaviour itself — the service role bypasses RLS and would give a
 * false pass). Each identity is signed in exactly ONCE for the whole file
 * (beforeAll) and reused across every test, per the known
 * signInWithPassword rate-limit noted in STATE.md.
 *
 * Run in isolation
 * (`npx vitest run tests/configuracoes/rls-frequencias-pedido.test.ts`).
 */

describe("RLS: frequencias_pedido (5a lista editavel)", () => {
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
    await admin.from("frequencias_pedido").delete().in("id", createdIds)
  })

  function uniqueNome(label: string): string {
    return `Teste Frequencia ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  it("seed: os seis valores iniciais existem na tabela e todos estao ativos", async () => {
    const nomesEsperados = [
      "Semanal",
      "Quinzenal",
      "Mensal",
      "Bimestral",
      "Trimestral",
      "Esporádica",
    ]

    const { data, error } = await vendedorA
      .from("frequencias_pedido")
      .select("nome, ativo")
      .in("nome", nomesEsperados)

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data).toHaveLength(nomesEsperados.length)
    for (const row of data ?? []) {
      expect(row.ativo).toBe(true)
    }
  })

  it("leitura: um Vendedor autenticado consegue listar os valores da tabela", async () => {
    const { data, error } = await vendedorA.from("frequencias_pedido").select("id")

    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it("supervisor: consegue inserir um valor com nome unico, renomear e voltar o nome", async () => {
    const nomeOriginal = uniqueNome("supervisor-insert")

    const { data: inserted, error: insertError } = await supervisor
      .from("frequencias_pedido")
      .insert({ nome: nomeOriginal })
      .select("id")
      .single()

    expect(insertError).toBeNull()
    expect(inserted).not.toBeNull()
    createdIds.push(inserted!.id)

    const nomeNovo = uniqueNome("supervisor-renomeado")

    const { data: renamed, error: renameError } = await supervisor
      .from("frequencias_pedido")
      .update({ nome: nomeNovo })
      .eq("id", inserted!.id)
      .select("id, nome")
      .single()

    expect(renameError).toBeNull()
    expect(renamed?.nome).toBe(nomeNovo)

    const { data: reverted, error: revertError } = await supervisor
      .from("frequencias_pedido")
      .update({ nome: nomeOriginal })
      .eq("id", inserted!.id)
      .select("id, nome")
      .single()

    expect(revertError).toBeNull()
    expect(reverted?.nome).toBe(nomeOriginal)
  })

  it("vendedor: NAO consegue inserir um valor novo (RLS INSERT policy nega)", async () => {
    const nome = uniqueNome("vendedor-insert")

    const { data: inserted, error } = await vendedorA
      .from("frequencias_pedido")
      .insert({ nome })
      .select("id")

    // RLS denies via a 0-row result rather than throwing — assert on both
    // possibilities without assuming which, same style as rls-listas.test.ts.
    expect(inserted ?? []).toHaveLength(0)
    if (error) {
      expect(error).not.toBeNull()
    }
  })

  it("vendedorupdate: NAO consegue trocar o estado de ativo de um valor existente", async () => {
    const nome = uniqueNome("vendedor-update")

    const { data: inserted, error: insertError } = await supervisor
      .from("frequencias_pedido")
      .insert({ nome })
      .select("id")
      .single()

    expect(insertError).toBeNull()
    createdIds.push(inserted!.id)

    const { data: updateResult, error: updateError } = await vendedorA
      .from("frequencias_pedido")
      .update({ ativo: false })
      .eq("id", inserted!.id)
      .select("id")

    expect(updateResult ?? []).toHaveLength(0)
    if (updateError) {
      expect(updateError).not.toBeNull()
    }

    // Assert the value's true state via service role (never confia só no
    // erro/0-linhas retornado ao vendedor) — a linha continua com o estado
    // anterior (ativo).
    const admin = serviceClient()
    const { data: reread } = await admin
      .from("frequencias_pedido")
      .select("ativo")
      .eq("id", inserted!.id)
      .single()

    expect(reread?.ativo).toBe(true)
  })

  it("duplicado: inserir um segundo valor com nome ja existente falha com 23505", async () => {
    const nome = uniqueNome("duplicado")

    const { data: firstInsert, error: firstError } = await supervisor
      .from("frequencias_pedido")
      .insert({ nome })
      .select("id")
      .single()

    expect(firstError).toBeNull()
    createdIds.push(firstInsert!.id)

    const { data: secondInsert, error: secondError } = await supervisor
      .from("frequencias_pedido")
      .insert({ nome })
      .select("id")
      .single()

    expect(secondInsert).toBeNull()
    expect(secondError).not.toBeNull()
    expect(secondError?.code).toBe("23505")
  })

  it("desativar: Supervisor troca ativo para falso e de volta para verdadeiro, linha continua existindo", async () => {
    const nome = uniqueNome("desativar")

    const { data: inserted, error: insertError } = await supervisor
      .from("frequencias_pedido")
      .insert({ nome })
      .select("id")
      .single()

    expect(insertError).toBeNull()
    createdIds.push(inserted!.id)

    const { data: deactivated, error: deactivateError } = await supervisor
      .from("frequencias_pedido")
      .update({ ativo: false })
      .eq("id", inserted!.id)
      .select("id, ativo")
      .single()

    expect(deactivateError).toBeNull()
    expect(deactivated?.ativo).toBe(false)

    const { data: reactivated, error: reactivateError } = await supervisor
      .from("frequencias_pedido")
      .update({ ativo: true })
      .eq("id", inserted!.id)
      .select("id, ativo")
      .single()

    expect(reactivateError).toBeNull()
    expect(reactivated?.ativo).toBe(true)
  })

  it("anonimo: um cliente nao autenticado nao le nada da tabela", async () => {
    const anon = anonClient()

    const { data, error } = await anon.from("frequencias_pedido").select("id")

    if (error) {
      expect(error).not.toBeNull()
    } else {
      expect(data ?? []).toHaveLength(0)
    }
  })
})
