import { afterAll, describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

import { SEED_ACCOUNTS } from "../auth/rls-roles.test"
import {
  createTestMember,
  deleteTestMember,
  serviceClient,
  signInAs,
} from "../helpers/supabase-test-clients"
import { taxaConversao } from "@/lib/dashboard/periodo"

/**
 * Integration tests for `dashboard_comparativo_vendedor()` (VEND-01).
 *
 * ISOLATION NOTE (12-RESEARCH.md): the live test project already carries
 * clientes historicos de quantidade desconhecida nas contas semente
 * compartilhadas (SEED_ACCOUNTS), o que tornaria qualquer asserção de
 * contagem exata instável se elas fossem o sujeito. Em vez disso, todo
 * teste aqui usa um vendedor de fixture descartável
 * (createTestMember/deleteTestMember, padrão da Fase 10) com um seed
 * pequeno e conhecido de clientes, e chama a RPC como Supervisor (que
 * enxerga a linha de todos os vendedores). As asserções sempre localizam a
 * linha do vendedor de fixture pelo `responsavel` (id), nunca por posição
 * no array.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste Comparativo ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

type ComparativoVendedorRow = {
  responsavel: string
  responsavel_nome: string | null
  negocios_iniciados: number | string
  ganho: number | string
  perdido: number | string
  ciclo_medio_dias: number | string | null
}

async function getComparativoRowFor(
  client: SupabaseClient,
  responsavelId: string
): Promise<ComparativoVendedorRow | undefined> {
  const { data, error } = await client.rpc("dashboard_comparativo_vendedor")
  if (error) {
    throw new Error(`dashboard_comparativo_vendedor falhou: ${error.message}`)
  }
  const rows = (data ?? []) as ComparativoVendedorRow[]
  return rows.find((row) => row.responsavel === responsavelId)
}

describe("dashboard_comparativo_vendedor RPC behavior (VEND-01)", () => {
  const createdClienteIds: string[] = []
  let fixtureVendedorId: string
  let ganhoId: string
  let perdidoId: string
  let andamentoId: string

  afterAll(async () => {
    const admin = serviceClient()
    if (createdClienteIds.length > 0) {
      await admin.from("clientes").delete().in("id", createdClienteIds)
    }
    // clientes deletados PRIMEIRO — deleteTestMember falha na FK
    // clientes.responsavel caso contrário (tests/equipe/reassignment.test.ts).
    if (fixtureVendedorId) await deleteTestMember(fixtureVendedorId)
  })

  it("vendedor ativo sem nenhum cliente atribuido aparece como linha completa de zeros (VEND-01)", async () => {
    const fixture = await createTestMember("vendedor", "comparativo")
    fixtureVendedorId = fixture.id

    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const row = await getComparativoRowFor(supervisor, fixture.id)
    expect(row).toBeDefined()
    expect(Number(row!.negocios_iniciados)).toBe(0)
    expect(Number(row!.ganho)).toBe(0)
    expect(Number(row!.perdido)).toBe(0)
    expect(row!.ciclo_medio_dias).toBeNull()
  })

  it("negocios_iniciados conta todos os clientes atribuidos desde sempre, sem nenhum recorte de data (VEND-01)", async () => {
    const admin = serviceClient()
    const motivoPerdaId = await getMotivoPerdaId()

    const agora = Date.now()
    const criadoEmGanho = new Date(agora - 10 * 86400 * 1000)
    const criadoEmPerdido = new Date(agora - 30 * 86400 * 1000)
    // Backdatado em vários meses — prova que a ausência de recorte de data
    // (D-01/D-02) não some com um cliente antigo.
    const criadoEmAndamento = new Date(agora - 200 * 86400 * 1000)

    const { data: ganho, error: ganhoError } = await admin
      .from("clientes")
      .insert(
        baseClienteFields(
          uniqueRazaoSocial("ganho"),
          fixtureVendedorId,
          "primeira_venda"
        )
      )
      .select("id")
      .single()
    expect(ganhoError).toBeNull()
    ganhoId = ganho!.id
    createdClienteIds.push(ganhoId)

    const { data: perdido, error: perdidoError } = await admin
      .from("clientes")
      .insert(
        baseClienteFields(
          uniqueRazaoSocial("perdido"),
          fixtureVendedorId,
          "aguardando_contato"
        )
      )
      .select("id")
      .single()
    expect(perdidoError).toBeNull()
    perdidoId = perdido!.id
    createdClienteIds.push(perdidoId)

    const { data: andamento, error: andamentoError } = await admin
      .from("clientes")
      .insert(
        baseClienteFields(
          uniqueRazaoSocial("andamento"),
          fixtureVendedorId,
          "conversa_comprador"
        )
      )
      .select("id")
      .single()
    expect(andamentoError).toBeNull()
    andamentoId = andamento!.id
    createdClienteIds.push(andamentoId)

    // ganho só é permitido na etapa final (chk_ganho_somente_etapa_final) —
    // a etapa já está em "primeira_venda" desde o insert.
    const { error: marcarGanhoError } = await admin
      .from("clientes")
      .update({ status_acompanhamento: "ganho" })
      .eq("id", ganhoId)
    expect(marcarGanhoError).toBeNull()

    // perdido exige motivo_perda_id (chk_perdido_exige_motivo). Definido em
    // um UPDATE separado do insert para que a trigger de historico
    // (só reage a UPDATE, nunca a INSERT) efetivamente escreva o evento.
    const { error: marcarPerdidoError } = await admin
      .from("clientes")
      .update({
        status_acompanhamento: "perdido",
        motivo_perda_id: motivoPerdaId,
      })
      .eq("id", perdidoId)
    expect(marcarPerdidoError).toBeNull()

    // Backdatar clientes.criado_em (nenhuma trigger reage a essa coluna) —
    // controla a duração usada pelo teste de ciclo médio a seguir. O evento
    // de fechamento em historico permanece no instante real deste teste.
    const { error: backdateGanhoError } = await admin
      .from("clientes")
      .update({ criado_em: criadoEmGanho.toISOString() })
      .eq("id", ganhoId)
    expect(backdateGanhoError).toBeNull()

    const { error: backdatePerdidoError } = await admin
      .from("clientes")
      .update({ criado_em: criadoEmPerdido.toISOString() })
      .eq("id", perdidoId)
    expect(backdatePerdidoError).toBeNull()

    const { error: backdateAndamentoError } = await admin
      .from("clientes")
      .update({ criado_em: criadoEmAndamento.toISOString() })
      .eq("id", andamentoId)
    expect(backdateAndamentoError).toBeNull()

    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const row = await getComparativoRowFor(supervisor, fixtureVendedorId)
    expect(row).toBeDefined()
    expect(Number(row!.negocios_iniciados)).toBe(3)
    expect(Number(row!.ganho)).toBe(1)
    expect(Number(row!.perdido)).toBe(1)
  })

  it("ciclo_medio_dias considera SO os negocios ganhos (D-04), nunca o perdido, e fica nulo sem nenhum ganho", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const row = await getComparativoRowFor(supervisor, fixtureVendedorId)
    expect(row).toBeDefined()
    expect(row!.ciclo_medio_dias).not.toBeNull()
    const cicloMedio = Number(row!.ciclo_medio_dias)
    // ~10 dias (duração do cliente GANHO), claramente distante dos ~30
    // dias do cliente PERDIDO — prova de que a média é ganho-only (D-04).
    expect(cicloMedio).toBeGreaterThan(10 - 0.3)
    expect(cicloMedio).toBeLessThan(10 + 0.3)
    expect(cicloMedio).toBeLessThan(20)

    // Vendedor ativo sem nenhum ganho tem ciclo_medio_dias nulo, nunca 0.
    const fixtureSemGanho = await createTestMember("vendedor", "sem-ganho")
    try {
      const rowSemGanho = await getComparativoRowFor(
        supervisor,
        fixtureSemGanho.id
      )
      expect(rowSemGanho).toBeDefined()
      expect(Number(rowSemGanho!.ganho)).toBe(0)
      expect(rowSemGanho!.ciclo_medio_dias).toBeNull()
    } finally {
      await deleteTestMember(fixtureSemGanho.id)
    }
  })

  it("conversao: a RPC nunca calcula taxa de conversao no SQL (D-03), e taxaConversao aplicada as contagens cruas devolve o valor esperado", async () => {
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )
    const { data, error } = await supervisor.rpc(
      "dashboard_comparativo_vendedor"
    )
    expect(error).toBeNull()
    const rows = (data ?? []) as Record<string, unknown>[]
    for (const rawRow of rows) {
      expect(
        Object.keys(rawRow).some((key) =>
          key.toLowerCase().includes("conversao")
        )
      ).toBe(false)
    }

    const row = (rows as ComparativoVendedorRow[]).find(
      (r) => r.responsavel === fixtureVendedorId
    )
    expect(row).toBeDefined()
    // 1 ganho e 1 perdido no seed desta suíte -> 0.5.
    expect(taxaConversao(Number(row!.ganho), Number(row!.perdido))).toBe(0.5)

    // Sem nenhum ganho e nenhum perdido, a função pura devolve null — nunca
    // NaN nem 0.
    expect(taxaConversao(0, 0)).toBeNull()
  })

  it("vendedor desativado desaparece desta lista, mas os totais de dashboard_ganhos_perdidos ficam inalterados (VEND-01)", async () => {
    const admin = serviceClient()
    const supervisor = await signInAs(
      SEED_ACCOUNTS.supervisor.email,
      SEED_ACCOUNTS.supervisor.password
    )

    const window = {
      inicio: new Date(Date.now() - 400 * 86400 * 1000).toISOString(),
      fim: new Date(Date.now() + 30_000).toISOString(),
    }

    const rowBefore = await getComparativoRowFor(supervisor, fixtureVendedorId)
    expect(rowBefore).toBeDefined()

    const { data: ganhosPerdidosBefore, error: gpBeforeError } =
      await supervisor.rpc("dashboard_ganhos_perdidos", {
        p_inicio: window.inicio,
        p_fim: window.fim,
      })
    expect(gpBeforeError).toBeNull()

    const { error: desativarError } = await admin
      .from("profiles")
      .update({ ativo: false })
      .eq("id", fixtureVendedorId)
    expect(desativarError).toBeNull()

    // A linha do vendedor de fixture some COMPLETAMENTE do resultado.
    const rowAfter = await getComparativoRowFor(supervisor, fixtureVendedorId)
    expect(rowAfter).toBeUndefined()

    const { data: ganhosPerdidosAfter, error: gpAfterError } =
      await supervisor.rpc("dashboard_ganhos_perdidos", {
        p_inicio: window.inicio,
        p_fim: window.fim,
      })
    expect(gpAfterError).toBeNull()

    type StatusTotalRow = { status: string; total: number | string }
    const toMap = (rows: StatusTotalRow[]) =>
      Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]))
    // Prova direta do limite da fase: desativar tira a LINHA desta tabela,
    // nunca os números históricos de dashboard_ganhos_perdidos.
    expect(toMap((ganhosPerdidosAfter ?? []) as StatusTotalRow[])).toEqual(
      toMap((ganhosPerdidosBefore ?? []) as StatusTotalRow[])
    )
  })
})
