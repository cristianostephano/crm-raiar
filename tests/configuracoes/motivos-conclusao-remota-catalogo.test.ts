import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Catálogo de "motivos_conclusao_remota" (CONC-03, Fase 22 Plano 2) — prova
 * o comportamento do LEITOR (getMotivosConclusaoRemotaAtivos), não a
 * autorização de escrita (já provada por
 * tests/configuracoes/rls-motivos-conclusao-remota.test.ts no plano 22-01,
 * não duplicada aqui).
 *
 * getMotivosConclusaoRemotaAtivos() depende do contexto de requisição do
 * Next (leitura de cookies via next/headers), então não pode ser invocada
 * diretamente pelo Vitest — precedente já registrado no projeto desde a
 * Fase 2 (e repetido literalmente por
 * tests/configuracoes/frequencias-pedido-catalogo.test.ts). Este arquivo
 * exercita a MESMA consulta que o leitor faz
 * (from("motivos_conclusao_remota").select("id, nome").eq("ativo",
 * true).order("nome")), com sessões reais, provando o comportamento que
 * importa: os 5 valores de partida da migration, filtro de ativo, ordem
 * alfabética, acesso do Vendedor, e efeito de desativar.
 *
 * Mesma disciplina de frequencias-pedido-catalogo.test.ts: cada identidade
 * é logada uma vez (beforeAll) e reutilizada, serviceClient() só para
 * semear/limpar/reler o estado verdadeiro após uma escrita, nunca para
 * afirmar autorização.
 *
 * Run em isolamento
 * (`npx vitest run tests/configuracoes/motivos-conclusao-remota-catalogo.test.ts`).
 */

const SEMENTES_MIGRATION_0022 = [
  "Pedido por telefone",
  "Pedido por WhatsApp",
  "Pedido por e-mail",
  "Reunião por vídeo",
  "Cliente não pôde receber",
]

describe("Catalogo: motivos_conclusao_remota (leitor ativo)", () => {
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
    return `Catalogo Motivo Remoto ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  // A mesma consulta que getMotivosConclusaoRemotaAtivos() faz.
  async function lerAtivos(client: Awaited<ReturnType<typeof signInAs>>) {
    return client
      .from("motivos_conclusao_remota")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome", { ascending: true })
  }

  it("sementes: os cinco valores iniciais da migration aparecem e estao ativos", async () => {
    const { data, error } = await lerAtivos(supervisor)
    expect(error).toBeNull()

    const nomes = (data ?? []).map((row) => row.nome)
    for (const sementeNome of SEMENTES_MIGRATION_0022) {
      expect(nomes).toContain(sementeNome)
    }
  })

  it("vendedor: uma sessao de VENDEDOR recebe o catalogo NAO vazio", async () => {
    const { data, error } = await lerAtivos(vendedorA)

    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it("ordem: o resultado vem em ordem alfabetica crescente pelo nome", async () => {
    const prefixo = `ZOrdem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const nomeC = `${prefixo}-Charlie`
    const nomeA = `${prefixo}-Alfa`
    const nomeB = `${prefixo}-Bravo`

    for (const nome of [nomeC, nomeA, nomeB]) {
      const { data: inserted, error } = await supervisor
        .from("motivos_conclusao_remota")
        .insert({ nome })
        .select("id")
        .single()
      expect(error).toBeNull()
      createdIds.push(inserted!.id)
    }

    const { data, error } = await lerAtivos(supervisor)
    expect(error).toBeNull()

    const nomesDoPrefixo = (data ?? [])
      .map((row) => row.nome)
      .filter((nome) => nome.startsWith(prefixo))

    expect(nomesDoPrefixo).toEqual([nomeA, nomeB, nomeC])
  })

  it("desativado: um valor semeado e depois desativado pelo Supervisor SOME do catalogo, sem ser apagado", async () => {
    const nome = uniqueNome("desativar")

    const { data: inserted, error: insertError } = await supervisor
      .from("motivos_conclusao_remota")
      .insert({ nome })
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdIds.push(inserted!.id)

    const { data: antes } = await lerAtivos(supervisor)
    expect((antes ?? []).map((row) => row.nome)).toContain(nome)

    const { error: deactivateError } = await supervisor
      .from("motivos_conclusao_remota")
      .update({ ativo: false })
      .eq("id", inserted!.id)
    expect(deactivateError).toBeNull()

    const { data: depois, error: depoisError } = await lerAtivos(supervisor)
    expect(depoisError).toBeNull()
    expect((depois ?? []).map((row) => row.nome)).not.toContain(nome)

    // A linha continua existindo (não foi apagada) — reler pela chave de
    // serviço, nunca pelo cliente autenticado (que só vê o filtro de ativo).
    const admin = serviceClient()
    const { data: reread } = await admin
      .from("motivos_conclusao_remota")
      .select("id, ativo")
      .eq("id", inserted!.id)
      .single()

    expect(reread).not.toBeNull()
    expect(reread?.ativo).toBe(false)
  })
})
