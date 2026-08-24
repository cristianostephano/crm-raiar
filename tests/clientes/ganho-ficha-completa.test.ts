import { afterEach, describe, expect, it } from "vitest"

import { serviceClient } from "../helpers/supabase-test-clients"
import { ETAPA_FINAL } from "../../lib/funil/etapas"

/**
 * Integration tests for the Fase 23 Plano 1 database guard
 * (23-01-PLAN.md) — `mover_card_funil`'s two new transition guards (razão
 * social e endereço completo), migrations 0024/0025 — GANHO-01 e GANHO-02.
 *
 * Como este arquivo autentica — decisão deliberada, seguir à risca: usa
 * APENAS `serviceClient()` para semear, chamar a RPC e ler o resultado.
 * Nenhuma autenticação por senha em lugar nenhum deste arquivo. Dois
 * motivos, ambos já registrados no projeto:
 *
 *   - As duas contas semente de vendedor foram apagadas (STATE.md,
 *     2026-08-19) e ~49 arquivos de teste falham por causa disso — este
 *     arquivo precisa rodar verde hoje, isolado, sem depender daquela
 *     decisão pendente.
 *   - O que este arquivo prova é um fato do CORPO da função e do SCHEMA,
 *     não um fato de RLS: os guards ficam dentro de `mover_card_funil` e
 *     disparam igual para qualquer chamador. A RLS da mesma RPC já está
 *     provada em tests/clientes/rls-visitas.test.ts. Mesmo raciocínio já
 *     escrito no cabeçalho de tests/clientes/endereco-opcional.test.ts, e
 *     há precedente de chamar RPC pelo cliente de service role em
 *     tests/clientes/cidades-por-estado.test.ts.
 *
 * RED até a Task 3 aplicar as migrations 0024/0025 no banco hospedado —
 * esperado e documentado aqui, mesmo padrão de
 * tests/clientes/endereco-opcional.test.ts.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste GanhoFichaCompleta ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Espaço-em-branco puro, mas com comprimento aleatório para não colidir com a UNIQUE de razao_social entre execuções concorrentes. */
function razaoSocialSoEspacos(): string {
  return " ".repeat(3 + Math.floor(Math.random() * 5))
}

const createdClienteIds: string[] = []

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  const admin = serviceClient()
  // `on delete cascade` em visitas.cliente_id cobre a limpeza das visitas
  // semeadas por estes testes — só é preciso apagar o cliente.
  await admin.from("clientes").delete().in("id", createdClienteIds.splice(0))
})

async function getResponsavelId(): Promise<string> {
  const admin = serviceClient()
  const { data, error } = await admin.from("profiles").select("id").limit(1).single()
  if (error || !data) {
    throw new Error(`Failed to read a responsavel id from profiles: ${error?.message}`)
  }
  return data.id
}

/** Os 5 campos de endereço que a migration 0023 tornou anuláveis, todos preenchidos. */
function camposEnderecoCompleto() {
  return {
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
  }
}

/** Campos base de um cliente completo (razão social + os 5 campos de endereço + CNPJ + responsável), com overrides pontuais por caso. */
function clienteCompletoFields(
  razaoSocial: string,
  responsavelId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    razao_social: razaoSocial,
    cnpj: "12.345.678/0001-99",
    responsavel: responsavelId,
    ...camposEnderecoCompleto(),
    ...overrides,
  }
}

async function inserirCliente(fields: Record<string, unknown>): Promise<{ id: string }> {
  const admin = serviceClient()
  const { data, error } = await admin.from("clientes").insert(fields).select("id").single()
  if (error || !data) {
    throw new Error(`Failed to seed test cliente: ${error?.message}`)
  }
  createdClienteIds.push(data.id)
  return data
}

/**
 * Chamada de ganho no formato do diálogo (13-02/18-02): sempre manda etapa
 * final, status ganho e frequência de visita não nula — a frequência é
 * obrigatória porque o guard existente de VIS-01 dispara ANTES dos guards
 * novos, e sem ela este arquivo não provaria o que se propõe a provar.
 */
async function marcarGanho(clienteId: string) {
  const admin = serviceClient()
  return admin.rpc("mover_card_funil", {
    p_cliente_id: clienteId,
    p_nova_etapa: ETAPA_FINAL,
    p_novo_status: "ganho",
    p_frequencia_visita: "semanal",
  })
}

/** Mirrors the exact call the drag handler (arrastar card) sends: no p_novo_status, no p_cnpj. */
async function arrastarCard(clienteId: string, novaPosicao: number) {
  const admin = serviceClient()
  return admin.rpc("mover_card_funil", {
    p_cliente_id: clienteId,
    p_nova_etapa: ETAPA_FINAL,
    p_nova_posicao: novaPosicao,
  })
}

async function lerStatus(clienteId: string) {
  const admin = serviceClient()
  return admin.from("clientes").select("status_acompanhamento").eq("id", clienteId).single()
}

describe("clientes.razao_social aceita valor nulo (migration 0024)", () => {
  it("Bloco A - insert direto com razao_social nula e aceito e cria a linha", async () => {
    const responsavelId = await getResponsavelId()
    const admin = serviceClient()

    const { data, error } = await admin
      .from("clientes")
      .insert({ razao_social: null, responsavel: responsavelId })
      .select("id, razao_social")
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    if (data?.id) createdClienteIds.push(data.id)
    expect(data?.razao_social).toBeNull()
  })

  it("Bloco A - dois inserts diretos com razao_social nula sao os dois aceitos (unicidade nao trata dois nulos como conflito)", async () => {
    const responsavelId = await getResponsavelId()
    const admin = serviceClient()

    const primeiro = await admin
      .from("clientes")
      .insert({ razao_social: null, responsavel: responsavelId })
      .select("id")
      .single()
    expect(primeiro.error).toBeNull()
    if (primeiro.data?.id) createdClienteIds.push(primeiro.data.id)

    const segundo = await admin
      .from("clientes")
      .insert({ razao_social: null, responsavel: responsavelId })
      .select("id")
      .single()
    expect(segundo.error).toBeNull()
    if (segundo.data?.id) createdClienteIds.push(segundo.data.id)

    expect(primeiro.data?.id).toBeTruthy()
    expect(segundo.data?.id).toBeTruthy()
    expect(primeiro.data?.id).not.toBe(segundo.data?.id)
  })
})

describe("mover_card_funil: trava ampliada na transicao para ganho (GANHO-01)", () => {
  const CAMPOS_ENDERECO = ["cep", "rua", "numero", "cidade", "estado"] as const

  it.each(CAMPOS_ENDERECO)(
    "Bloco B - cliente completo sem o campo de endereco '%s' tem o ganho recusado e o status nao muda",
    async (campo) => {
      const responsavelId = await getResponsavelId()
      const fields = clienteCompletoFields(uniqueRazaoSocial(`endereco-sem-${campo}`), responsavelId, {
        [campo]: null,
      })
      const inserted = await inserirCliente(fields)

      const { error } = await marcarGanho(inserted.id)
      expect(error).not.toBeNull()

      const { data: cliente, error: readError } = await lerStatus(inserted.id)
      expect(readError).toBeNull()
      expect(cliente?.status_acompanhamento).not.toBe("ganho")
    }
  )

  it("Bloco B - cliente completo com CNPJ mas razao_social nula tem o ganho recusado", async () => {
    const responsavelId = await getResponsavelId()
    const fields = clienteCompletoFields(uniqueRazaoSocial("razao-nula"), responsavelId, {
      razao_social: null,
    })
    const inserted = await inserirCliente(fields)

    const { error } = await marcarGanho(inserted.id)
    expect(error).not.toBeNull()

    const { data: cliente, error: readError } = await lerStatus(inserted.id)
    expect(readError).toBeNull()
    expect(cliente?.status_acompanhamento).not.toBe("ganho")
  })

  it("Bloco B - cliente completo com razao_social so com espacos em branco tem o ganho recusado", async () => {
    const responsavelId = await getResponsavelId()
    const fields = clienteCompletoFields(uniqueRazaoSocial("razao-espacos"), responsavelId, {
      razao_social: razaoSocialSoEspacos(),
    })
    const inserted = await inserirCliente(fields)

    const { error } = await marcarGanho(inserted.id)
    expect(error).not.toBeNull()

    const { data: cliente, error: readError } = await lerStatus(inserted.id)
    expect(readError).toBeNull()
    expect(cliente?.status_acompanhamento).not.toBe("ganho")
  })

  it("Bloco B - cliente com razao_social, os 5 campos de endereco e CNPJ tem o ganho aceito e a linha fica ganho", async () => {
    const responsavelId = await getResponsavelId()
    const fields = clienteCompletoFields(uniqueRazaoSocial("completo"), responsavelId)
    const inserted = await inserirCliente(fields)

    // Nota de execução (Task 2): a coluna `visitas.criado_por` aceita valor
    // nulo, então a semeadura da primeira visita dentro de mover_card_funil
    // é esperada passar mesmo sob o cliente de service role (auth.uid()
    // devolve nulo aqui). Se algum dia isso deixar de valer, semear antes
    // uma visita pendente para o cliente, já que o bloco de semeadura da
    // RPC é idempotente e pula quando já existe visita sem data realizada.
    const { error } = await marcarGanho(inserted.id)
    expect(error).toBeNull()

    const { data: cliente, error: readError } = await lerStatus(inserted.id)
    expect(readError).toBeNull()
    expect(cliente?.status_acompanhamento).toBe("ganho")
  })
})

describe("mover_card_funil: grandfathering de clientes ja ganho (GANHO-02)", () => {
  async function semearClienteLegado(responsavelId: string): Promise<string> {
    const admin = serviceClient()
    const { data: inserted, error: insertError } = await admin
      .from("clientes")
      .insert({
        razao_social: null,
        responsavel: responsavelId,
        etapa: ETAPA_FINAL,
        status_acompanhamento: "ganho",
        cep: null,
        rua: null,
        numero: null,
        cidade: null,
        estado: null,
      })
      .select("id")
      .single()
    if (insertError || !inserted) {
      throw new Error(`Failed to seed legacy cliente: ${insertError?.message}`)
    }
    createdClienteIds.push(inserted.id)
    return inserted.id
  }

  it("Bloco C - cliente legado ganho sem razao_social e sem endereco continua legivel, editavel, e a reafirmacao de ganho nao e bloqueada", async () => {
    const responsavelId = await getResponsavelId()
    const admin = serviceClient()
    const clienteId = await semearClienteLegado(responsavelId)

    // (i) a linha e legivel.
    const { data: cliente, error: readError } = await admin
      .from("clientes")
      .select("razao_social, cep")
      .eq("id", clienteId)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.razao_social).toBeNull()
    expect(cliente?.cep).toBeNull()

    // (ii) um UPDATE comum em outro campo funciona sem erro.
    const { data: updated, error: updateError } = await admin
      .from("clientes")
      .update({ observacao: "cliente legado, editado normalmente" })
      .eq("id", clienteId)
      .select("observacao")
      .single()
    expect(updateError).toBeNull()
    expect(updated?.observacao).toBe("cliente legado, editado normalmente")

    // (iii) chamar mover_card_funil reafirmando ganho NAO devolve erro,
    // porque nao houve transicao (o cliente ja era ganho).
    const { error: rpcError } = await marcarGanho(clienteId)
    expect(rpcError).toBeNull()
  })

  it("Bloco C - cliente legado ganho sem razao_social e sem endereco nao e bloqueado numa chamada no formato de arrastar card", async () => {
    const responsavelId = await getResponsavelId()
    const admin = serviceClient()
    const clienteId = await semearClienteLegado(responsavelId)

    const { error } = await arrastarCard(clienteId, 42)
    expect(error).toBeNull()

    const { data: cliente, error: readError } = await admin
      .from("clientes")
      .select("status_acompanhamento, razao_social")
      .eq("id", clienteId)
      .single()
    expect(readError).toBeNull()
    expect(cliente?.status_acompanhamento).toBe("ganho")
    expect(cliente?.razao_social).toBeNull()
  })
})
