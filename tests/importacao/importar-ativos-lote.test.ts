import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  createTestMember,
  deleteTestMember,
  serviceClient,
  signInAs,
  type TestMember,
} from "../helpers/supabase-test-clients"

/**
 * Integration test for the `importar_clientes_ativos_lote` RPC (25-01-PLAN.md,
 * ATIVO-01/ATIVO-02/ATIVO-03) — a NOVA porta de escrita, paralela a
 * `importar_clientes_lote` (07/19), que cria clientes JÁ em
 * `status_acompanhamento = 'ganho'` / `etapa = 'primeira_venda'` numa única
 * gravação, sem passar por `mover_card_funil`.
 *
 * Como este arquivo autentica — decisão deliberada: NUNCA usar as contas
 * semente antigas (`vendedor.a+test`/`vendedor.b+test`), apagadas em
 * 2026-08-19 (derrubaram ~49 arquivos de teste — ver STATE.md). Usa
 * `createTestMember("supervisor")` e `createTestMember("vendedor")` para
 * criar fixtures descartáveis pela API de administração, e `signInAs` UMA
 * vez por fixture (duas autenticações no total neste arquivo, o mínimo
 * possível dado o rate limit conhecido de `signInWithPassword`). A
 * autenticação é inevitável aqui, diferente de `ganho-ficha-completa.test.ts`
 * (que usa só `serviceClient()`): a trava de papel desta RPC é
 * `is_supervisor()`, que lê o perfil do usuário CORRENTE via `auth.uid()` —
 * um cliente de service role tem usuário corrente nulo e seria recusado pela
 * própria trava, então provar o caminho feliz exige sessão de verdade.
 *
 * Limpeza: apaga toda linha de `clientes` criada pelo arquivo ANTES de
 * apagar os membros de fixture — `clientes.responsavel` referencia
 * `profiles(id)` sem ação de exclusão (documentado em `deleteTestMember`);
 * apagar na ordem inversa falha por violação de chave estrangeira.
 *
 * O arquivo fica VERMELHO até a Task 3 (checkpoint humano) aplicar a
 * migration 0027 no banco hospedado — a função ainda não existe. Mesmo
 * padrão documentado em `tests/clientes/endereco-opcional.test.ts` e
 * `tests/clientes/ganho-ficha-completa.test.ts`.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste ImportarAtivosLote ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Espaço-em-branco puro, comprimento aleatório para não colidir entre execuções. */
function soEspacos(): string {
  return " ".repeat(3 + Math.floor(Math.random() * 5))
}

function camposEnderecoCompleto() {
  return {
    cep: "01310-100",
    rua: "Av. Paulista",
    numero: "1000",
    cidade: "São Paulo",
    estado: "SP",
  }
}

/** Linha completa (os NOVE campos obrigatórios preenchidos), com overrides pontuais por caso. */
function linhaCompleta(
  razaoSocial: string,
  responsavelId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    razao_social: razaoSocial,
    cnpj: "12.345.678/0001-99",
    ...camposEnderecoCompleto(),
    complemento: null,
    responsavel: responsavelId,
    categoria_id: null,
    contato: "Fulano de Tal",
    telefone: "11999990000",
    email: null,
    numero_de_lojas: null,
    nome_fantasia: null,
    produto_ids: [],
    ...overrides,
  }
}

const createdClienteIds: string[] = []
let supervisor: TestMember
let vendedor: TestMember
let supervisorClient: SupabaseClient
let vendedorId: string

beforeAll(async () => {
  supervisor = await createTestMember("supervisor", "ativos-lote")
  vendedor = await createTestMember("vendedor", "ativos-lote")
  supervisorClient = await signInAs(supervisor.email, supervisor.password)
  vendedorId = vendedor.id
})

afterEach(async () => {
  if (createdClienteIds.length === 0) return
  await serviceClient().from("clientes").delete().in("id", createdClienteIds.splice(0))
})

afterAll(async () => {
  // Ordem obrigatória: clientes primeiro (FK sem ON DELETE), membros depois.
  await deleteTestMember(supervisor.id)
  await deleteTestMember(vendedor.id)
})

async function importar(rows: Record<string, unknown>[], as: SupabaseClient = supervisorClient) {
  return as.rpc("importar_clientes_ativos_lote", { p_clientes: rows })
}

async function lerClientePorRazaoSocial(razaoSocial: string) {
  const { data, error } = await serviceClient()
    .from("clientes")
    .select(
      "id, status_acompanhamento, etapa, frequencia_visita, dia_semana_visita, semana_do_mes_visita, contato"
    )
    .eq("razao_social", razaoSocial)
    .maybeSingle()
  if (error) throw new Error(`Failed to read back cliente "${razaoSocial}": ${error.message}`)
  return data
}

describe("importar_clientes_ativos_lote (25-01, ATIVO-01/ATIVO-02/ATIVO-03)", () => {
  it("lotecompleto: uma linha completa cria um cliente já em 'ganho'/'primeira_venda'", async () => {
    const razaoSocial = uniqueRazaoSocial("lotecompleto")
    const row = linhaCompleta(razaoSocial, vendedorId)

    const { data, error } = await importar([row])
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(1)
    expect(data![0].status).toBe("inserido")
    expect(data![0].id).toBeTruthy()
    createdClienteIds.push(data![0].id)

    const cliente = await lerClientePorRazaoSocial(razaoSocial)
    expect(cliente).not.toBeNull()
    expect(cliente?.status_acompanhamento).toBe("ganho")
    expect(cliente?.etapa).toBe("primeira_venda")
  })

  it("semfrequencia: o cliente criado nasce sem frequência/âncora e sem visita pendente", async () => {
    const razaoSocial = uniqueRazaoSocial("semfrequencia")
    const row = linhaCompleta(razaoSocial, vendedorId)

    const { data, error } = await importar([row])
    expect(error).toBeNull()
    createdClienteIds.push(data![0].id)

    const cliente = await lerClientePorRazaoSocial(razaoSocial)
    expect(cliente?.frequencia_visita).toBeNull()
    expect(cliente?.dia_semana_visita).toBeNull()
    expect(cliente?.semana_do_mes_visita).toBeNull()

    const { data: visitas, error: visitasError } = await serviceClient()
      .from("visitas")
      .select("id")
      .eq("cliente_id", cliente!.id)
    expect(visitasError).toBeNull()
    expect(visitas ?? []).toHaveLength(0)
  })

  it("loteMisto: lote com 1 completa + 1 sem CNPJ + 1 sem cidade grava exatamente 1 cliente, sem exceção", async () => {
    const razaoCompleta = uniqueRazaoSocial("misto-completa")
    const razaoSemCnpj = uniqueRazaoSocial("misto-sem-cnpj")
    const razaoSemCidade = uniqueRazaoSocial("misto-sem-cidade")

    const rows = [
      linhaCompleta(razaoCompleta, vendedorId),
      linhaCompleta(razaoSemCnpj, vendedorId, { cnpj: null }),
      linhaCompleta(razaoSemCidade, vendedorId, { cidade: null }),
    ]

    const { data, error } = await importar(rows)
    expect(error).toBeNull()
    expect(data).not.toBeNull()

    const inseridos = data!.filter((r: { status: string }) => r.status === "inserido")
    expect(inseridos.length).toBe(1)
    createdClienteIds.push(...inseridos.map((r: { id: string }) => r.id))

    const completa = await lerClientePorRazaoSocial(razaoCompleta)
    const semCnpj = await lerClientePorRazaoSocial(razaoSemCnpj)
    const semCidade = await lerClientePorRazaoSocial(razaoSemCidade)
    expect(completa).not.toBeNull()
    expect(semCnpj).toBeNull()
    expect(semCidade).toBeNull()
  })

  it("retornoclassificado: devolve 1 linha por linha de entrada, classificada inserido/incompleto", async () => {
    const razaoCompleta = uniqueRazaoSocial("classificado-completa")
    const razaoSemCnpj = uniqueRazaoSocial("classificado-sem-cnpj")
    const razaoSemCidade = uniqueRazaoSocial("classificado-sem-cidade")

    const rows = [
      linhaCompleta(razaoCompleta, vendedorId),
      linhaCompleta(razaoSemCnpj, vendedorId, { cnpj: null }),
      linhaCompleta(razaoSemCidade, vendedorId, { cidade: null }),
    ]

    const { data, error } = await importar(rows)
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(3)

    const porRazao = new Map(
      (data as { razao_social: string; id: string | null; status: string }[]).map((r) => [
        r.razao_social,
        r,
      ])
    )

    const completa = porRazao.get(razaoCompleta)
    expect(completa?.status).toBe("inserido")
    expect(completa?.id).toBeTruthy()
    if (completa?.id) createdClienteIds.push(completa.id)

    const semCnpj = porRazao.get(razaoSemCnpj)
    expect(semCnpj?.status).toBe("incompleto")
    expect(semCnpj?.id).toBeNull()

    const semCidade = porRazao.get(razaoSemCidade)
    expect(semCidade?.status).toBe("incompleto")
    expect(semCidade?.id).toBeNull()
  })

  it("somenteespacos: CNPJ só com espaços em branco é tratado como incompleto", async () => {
    const razaoSocial = uniqueRazaoSocial("cnpj-so-espacos")
    const row = linhaCompleta(razaoSocial, vendedorId, { cnpj: soEspacos() })

    const { data, error } = await importar([row])
    expect(error).toBeNull()
    expect(data![0].status).toBe("incompleto")
    expect(data![0].id).toBeNull()

    const cliente = await lerClientePorRazaoSocial(razaoSocial)
    expect(cliente).toBeNull()
  })

  // NÃO REMOVER: este é o caso mais importante do arquivo. `clientes.responsavel`
  // é `not null` desde a migration 0002 — se o filtro de completude não
  // cobrir este campo, a instrução de criação não recusa só esta linha: ela
  // levanta violação de restrição e aborta o LOTE INTEIRO, derrubando junto
  // a linha boa do mesmo lote. Isso NÃO é redundante com `loteMisto` (que só
  // exercita campos anuláveis) — só este caso prova que uma linha sem
  // `responsavel` (not null na tabela) não derruba o lote.
  it("semresponsavel: lote com 1 completa + 1 sem responsável grava exatamente 1 cliente, sem exceção, e a incompleta nunca é 'duplicado'", async () => {
    const razaoCompleta = uniqueRazaoSocial("semresp-completa")
    const razaoSemResponsavel = uniqueRazaoSocial("semresp-sem-responsavel")

    const rows = [
      linhaCompleta(razaoCompleta, vendedorId),
      linhaCompleta(razaoSemResponsavel, vendedorId, { responsavel: null }),
    ]

    const { data, error } = await importar(rows)
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBe(2)

    const porRazao = new Map(
      (data as { razao_social: string; id: string | null; status: string }[]).map((r) => [
        r.razao_social,
        r,
      ])
    )

    const completa = porRazao.get(razaoCompleta)
    expect(completa?.status).toBe("inserido")
    if (completa?.id) createdClienteIds.push(completa.id)

    const semResponsavel = porRazao.get(razaoSemResponsavel)
    expect(semResponsavel?.status).toBe("incompleto")
    expect(semResponsavel?.id).toBeNull()

    const clienteSemResponsavel = await lerClientePorRazaoSocial(razaoSemResponsavel)
    expect(clienteSemResponsavel).toBeNull()
  })

  // `contato` é anulável em `clientes` — sem esta cobertura a linha entraria
  // calada com contato nulo (falha silenciosa, sem exceção e sem sinal no
  // retorno), quebrando a promessa de ficha completa de ATIVO-01.
  it("semcontato: linha com contato em branco (só espaços) é devolvida como incompleto e não é gravada", async () => {
    const razaoSocial = uniqueRazaoSocial("sem-contato")
    const row = linhaCompleta(razaoSocial, vendedorId, { contato: soEspacos() })

    const { data, error } = await importar([row])
    expect(error).toBeNull()
    expect(data![0].status).toBe("incompleto")
    expect(data![0].id).toBeNull()

    const cliente = await lerClientePorRazaoSocial(razaoSocial)
    expect(cliente).toBeNull()
  })

  it("duplicado: razão social já existente é devolvida como 'duplicado', identificador nulo, sem criar segundo cliente", async () => {
    const razaoSocial = uniqueRazaoSocial("duplicado")
    const seeded = await serviceClient()
      .from("clientes")
      .insert({ razao_social: razaoSocial, responsavel: vendedorId })
      .select("id")
      .single()
    expect(seeded.error).toBeNull()
    createdClienteIds.push(seeded.data!.id)

    const row = linhaCompleta(razaoSocial, vendedorId)
    const { data, error } = await importar([row])
    expect(error).toBeNull()
    expect(data![0].status).toBe("duplicado")
    expect(data![0].id).toBeNull()

    const { data: existentes, error: existentesError } = await serviceClient()
      .from("clientes")
      .select("id")
      .eq("razao_social", razaoSocial)
    expect(existentesError).toBeNull()
    expect(existentes ?? []).toHaveLength(1)
  })

  it("produtos: linha completa com produtos consumidos grava as linhas correspondentes em cliente_produtos", async () => {
    const { data: produto, error: produtoError } = await serviceClient()
      .from("produtos_consumidos")
      .select("id")
      .limit(1)
      .single()
    expect(produtoError).toBeNull()
    const produtoId = produto!.id as string

    const razaoSocial = uniqueRazaoSocial("produtos")
    const row = linhaCompleta(razaoSocial, vendedorId, { produto_ids: [produtoId] })

    const { data, error } = await importar([row])
    expect(error).toBeNull()
    expect(data![0].status).toBe("inserido")
    createdClienteIds.push(data![0].id)

    const { data: clienteProdutos, error: cpError } = await serviceClient()
      .from("cliente_produtos")
      .select("produto_id")
      .eq("cliente_id", data![0].id)
    expect(cpError).toBeNull()
    expect((clienteProdutos ?? []).map((cp) => cp.produto_id)).toContain(produtoId)
  })

  it("naosupervisor: chamada feita por um Vendedor levanta exceção e não grava nada", async () => {
    const vendedorClient = await signInAs(vendedor.email, vendedor.password)
    const razaoSocial = uniqueRazaoSocial("nao-supervisor")
    const row = linhaCompleta(razaoSocial, vendedorId)

    const { data, error } = await importar([row], vendedorClient)
    expect(error).not.toBeNull()
    expect(data).toBeNull()

    const cliente = await lerClientePorRazaoSocial(razaoSocial)
    expect(cliente).toBeNull()
  })
})
