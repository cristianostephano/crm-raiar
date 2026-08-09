import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import { serviceClient, signInAs } from "../helpers/supabase-test-clients"

/**
 * Catálogo de "frequencias_pedido" (ATV-02, Fase 16 Plano 2, Task 2) — prova
 * o comportamento do LEITOR (getFrequenciasPedidoAtivas), não a autorização
 * de escrita (já provada por tests/configuracoes/rls-frequencias-pedido.test.ts
 * no plano 16-01, não duplicada aqui).
 *
 * getFrequenciasPedidoAtivas()/getFrequenciasPedido() dependem do contexto
 * de requisição do Next (leitura de cookies via next/headers), então não
 * podem ser invocadas diretamente pelo Vitest — precedente já registrado no
 * projeto desde a Fase 2. Este arquivo exercita a MESMA consulta que o
 * leitor faz (from("frequencias_pedido").select("id, nome").eq("ativo",
 * true).order("nome")), com sessões reais, provando o comportamento que
 * importa: filtro de ativo, ordem alfabética, acesso do Vendedor, efeito de
 * desativar, e seleção estreita de colunas.
 *
 * Mesma disciplina de tests/configuracoes/rls-frequencias-pedido.test.ts:
 * cada identidade é logada uma vez (beforeAll) e reutilizada, serviceClient()
 * só para semear/limpar/reler o estado verdadeiro após uma escrita, nunca
 * para afirmar autorização.
 *
 * Run em isolamento
 * (`npx vitest run tests/configuracoes/frequencias-pedido-catalogo.test.ts`).
 */

describe("Catalogo: frequencias_pedido (leitor ativo)", () => {
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
    return `Catalogo Frequencia ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  // A mesma consulta que getFrequenciasPedidoAtivas() faz.
  async function lerAtivos(client: Awaited<ReturnType<typeof signInAs>>) {
    return client
      .from("frequencias_pedido")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome", { ascending: true })
  }

  it("ativos: devolve o valor ativo e NAO devolve o inativo", async () => {
    const nomeAtivo = uniqueNome("ativo")
    const nomeInativo = uniqueNome("inativo")

    const { data: ativoInserido, error: ativoError } = await supervisor
      .from("frequencias_pedido")
      .insert({ nome: nomeAtivo })
      .select("id")
      .single()
    expect(ativoError).toBeNull()
    createdIds.push(ativoInserido!.id)

    const { data: inativoInserido, error: inativoInsertError } = await supervisor
      .from("frequencias_pedido")
      .insert({ nome: nomeInativo })
      .select("id")
      .single()
    expect(inativoInsertError).toBeNull()
    createdIds.push(inativoInserido!.id)

    const { error: deactivateError } = await supervisor
      .from("frequencias_pedido")
      .update({ ativo: false })
      .eq("id", inativoInserido!.id)
    expect(deactivateError).toBeNull()

    const { data, error } = await lerAtivos(supervisor)
    expect(error).toBeNull()

    const nomes = (data ?? []).map((row) => row.nome)
    expect(nomes).toContain(nomeAtivo)
    expect(nomes).not.toContain(nomeInativo)
  })

  it("ordem: resultado vem em ordem alfabetica crescente pelo nome", async () => {
    const prefixo = `ZOrdem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const nomeC = `${prefixo}-Charlie`
    const nomeA = `${prefixo}-Alfa`
    const nomeB = `${prefixo}-Bravo`

    for (const nome of [nomeC, nomeA, nomeB]) {
      const { data: inserted, error } = await supervisor
        .from("frequencias_pedido")
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

  it("vendedor: um Vendedor autenticado consegue executar a mesma leitura e recebe valores", async () => {
    const { data, error } = await lerAtivos(vendedorA)

    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it("desativar: apos o Supervisor desativar um valor, a leitura seguinte nao o traz mais, e a linha continua existindo", async () => {
    const nome = uniqueNome("desativar")

    const { data: inserted, error: insertError } = await supervisor
      .from("frequencias_pedido")
      .insert({ nome })
      .select("id")
      .single()
    expect(insertError).toBeNull()
    createdIds.push(inserted!.id)

    const { data: antes } = await lerAtivos(supervisor)
    expect((antes ?? []).map((row) => row.nome)).toContain(nome)

    const { error: deactivateError } = await supervisor
      .from("frequencias_pedido")
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
      .from("frequencias_pedido")
      .select("id, ativo")
      .eq("id", inserted!.id)
      .single()

    expect(reread).not.toBeNull()
    expect(reread?.ativo).toBe(false)
  })

  it("colunas: a leitura devolve exatamente identificador e nome, sem a linha inteira", async () => {
    const { data, error } = await lerAtivos(supervisor)
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)

    for (const row of data ?? []) {
      expect(Object.keys(row).sort()).toEqual(["id", "nome"])
    }
  })
})
