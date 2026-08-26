import { afterEach, describe, expect, it } from "vitest"
import { getDay, parseISO } from "date-fns"

import { serviceClient } from "../helpers/supabase-test-clients"
import { ETAPA_FINAL } from "../../lib/funil/etapas"

/**
 * Integration tests for the Fase 24 Plano 1 database layer (24-01-PLAN.md)
 * — migration 0026: `proxima_data_visita` reescrita com âncora de dia fixo
 * (ANCORA-01, ANCORA-02, ANCORA-04) e os dois chamadores existentes
 * (`agenda_do_vendedor`, `mover_card_funil`) passando a âncora adiante
 * (ANCORA-03).
 *
 * Como este arquivo autentica — decisão deliberada, seguir à risca. Usa
 * APENAS `serviceClient()` (service role) para semear, chamar as funções e
 * ler resultados. Nenhuma autenticação por senha em lugar nenhum deste
 * arquivo. Dois motivos, os mesmos que `tests/clientes/ganho-ficha-completa.test.ts`
 * (Fase 23) já registrou no próprio cabeçalho:
 *   - as duas contas semente de vendedor foram apagadas (ver Blockers na
 *     STATE.md) e dezenas de arquivos de teste falham por causa disso —
 *     este arquivo precisa rodar verde hoje, isolado, sem depender daquela
 *     decisão pendente;
 *   - o que este arquivo prova é um fato do CORPO das funções, não um fato
 *     de permissão: `proxima_data_visita` é pura e não toca em tabela
 *     nenhuma, e as duas colunas novas vivem em `clientes`, cuja RLS já é
 *     provada por `tests/clientes/rls-clientes.test.ts` e
 *     `tests/clientes/rls-visitas.test.ts`.
 *
 * RED até a Task 3 aplicar a migration 0026 no banco hospedado — esperado
 * e documentado aqui, mesmo padrão de `ganho-ficha-completa.test.ts`.
 *
 * `tests/clientes/frequencia-visita.test.ts` (o oráculo de regressão do
 * caminho antigo) NÃO é editado por este arquivo — nem uma linha.
 */

function uniqueRazaoSocial(label: string): string {
  return `Teste DiaFixoVisita ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

/** Campos de um cliente completo (razão social + os 5 campos de endereço + CNPJ + responsável), com overrides pontuais por caso. */
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

type DiaSemana = "domingo" | "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado"
type SemanaDoMes = "primeira" | "segunda" | "terceira" | "quarta" | "ultima"
type Frequencia = "semanal" | "quinzenal" | "mensal" | "nenhuma"

/**
 * Helper único que chama `proxima_data_visita`. Omite os dois últimos
 * parâmetros quando não informados (em vez de mandá-los como `undefined`
 * explícito) — assim os casos do Bloco A exercitam exatamente a mesma
 * forma de chamada de dois argumentos que o código antigo (e
 * `tests/clientes/frequencia-visita.test.ts`) já faz.
 */
async function proximaDataVisita(params: {
  base: string
  frequencia: Frequencia
  diaSemana?: DiaSemana
  semanaDoMes?: SemanaDoMes
}) {
  const admin = serviceClient()
  const rpcParams: Record<string, unknown> = {
    p_base: params.base,
    p_frequencia: params.frequencia,
  }
  if (params.diaSemana !== undefined) {
    rpcParams.p_dia_semana = params.diaSemana
  }
  if (params.semanaDoMes !== undefined) {
    rpcParams.p_semana_do_mes = params.semanaDoMes
  }
  return admin.rpc("proxima_data_visita", rpcParams)
}

/** Dia da semana (0=domingo..6=sábado, mesma convenção do Postgres `dow`) de uma data 'YYYY-MM-DD' devolvida pelo banco — via `parseISO`, nunca `new Date(string)` (Pitfall de fuso já documentado no projeto). */
function diaDaSemanaDe(dataIso: string): number {
  return getDay(parseISO(dataIso))
}

describe("proxima_data_visita: caminho antigo continua idêntico (D-01)", () => {
  it("Bloco A - mensal 31/01 (ano comum) continua em 28/02", async () => {
    const { data, error } = await proximaDataVisita({ base: "2026-01-31", frequencia: "mensal" })
    expect(error).toBeNull()
    expect(data).toBe("2026-02-28")
  })

  it("Bloco A - mensal 31/01 (ano bissexto) continua em 29/02", async () => {
    const { data, error } = await proximaDataVisita({ base: "2028-01-31", frequencia: "mensal" })
    expect(error).toBeNull()
    expect(data).toBe("2028-02-29")
  })

  it("Bloco A - mensal 31/03 continua em 30/04", async () => {
    const { data, error } = await proximaDataVisita({ base: "2026-03-31", frequencia: "mensal" })
    expect(error).toBeNull()
    expect(data).toBe("2026-04-30")
  })

  it("Bloco A - semanal 31/01 continua em 07/02", async () => {
    const { data, error } = await proximaDataVisita({ base: "2026-01-31", frequencia: "semanal" })
    expect(error).toBeNull()
    expect(data).toBe("2026-02-07")
  })

  it("Bloco A - quinzenal 31/01 continua em 14/02", async () => {
    const { data, error } = await proximaDataVisita({ base: "2026-01-31", frequencia: "quinzenal" })
    expect(error).toBeNull()
    expect(data).toBe("2026-02-14")
  })

  it("Bloco A - frequência 'nenhuma' continua devolvendo nulo", async () => {
    const { data, error } = await proximaDataVisita({ base: "2026-01-31", frequencia: "nenhuma" })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})

describe("proxima_data_visita: semanal/quinzenal com dia fixo (ANCORA-01, ANCORA-04)", () => {
  it("Bloco B - caso simples, alvo ainda nesta semana", async () => {
    const { data, error } = await proximaDataVisita({
      base: "2026-08-26",
      frequencia: "semanal",
      diaSemana: "quinta",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-08-27")
  })

  it("Bloco B - conclusão no PRÓPRIO dia alvo nunca devolve o mesmo dia", async () => {
    const { data, error } = await proximaDataVisita({
      base: "2026-08-27",
      frequencia: "semanal",
      diaSemana: "quinta",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-09-03")
  })

  it("Bloco B - alvo já passou nesta semana, nunca devolve data passada", async () => {
    const { data, error } = await proximaDataVisita({
      base: "2026-08-31",
      frequencia: "semanal",
      diaSemana: "quinta",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-09-03")
  })

  it("Bloco B - quinzenal pula uma ocorrência (8 dias, não 1)", async () => {
    const { data, error } = await proximaDataVisita({
      base: "2026-08-26",
      frequencia: "quinzenal",
      diaSemana: "quinta",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-09-03")
  })

  it("Bloco B - quinzenal somado ao caso do próprio dia alvo", async () => {
    const { data, error } = await proximaDataVisita({
      base: "2026-08-27",
      frequencia: "quinzenal",
      diaSemana: "quinta",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-09-10")
  })

  it.each([
    ["domingo", "2026-08-30"],
    ["segunda", "2026-08-31"],
    ["terca", "2026-09-01"],
    ["quarta", "2026-09-02"],
    ["quinta", "2026-08-27"],
    ["sexta", "2026-08-28"],
    ["sabado", "2026-08-29"],
  ] as [DiaSemana, string][])(
    "Bloco B - os sete rótulos de dia da semana a partir de 2026-08-26 (quarta): %s -> %s",
    async (diaSemana, esperado) => {
      const { data, error } = await proximaDataVisita({
        base: "2026-08-26",
        frequencia: "semanal",
        diaSemana,
      })
      expect(error).toBeNull()
      expect(data).toBe(esperado)
    }
  )
})

describe("proxima_data_visita: mensal com semana do mês e dia da semana (ANCORA-02, ANCORA-04)", () => {
  it("Bloco C - ocorrência ainda à frente no próprio mês", async () => {
    const { data, error } = await proximaDataVisita({
      base: "2026-08-01",
      frequencia: "mensal",
      diaSemana: "quinta",
      semanaDoMes: "primeira",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-08-06")
  })

  it("Bloco C - ocorrência do mês já passou, avança um mês", async () => {
    const { data, error } = await proximaDataVisita({
      base: "2026-08-29",
      frequencia: "mensal",
      diaSemana: "quinta",
      semanaDoMes: "primeira",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-09-03")
  })

  it("Bloco C - outubro/2026: '4ª quinta' (22) é diferente de 'última quinta' (29)", async () => {
    const quarta = await proximaDataVisita({
      base: "2026-10-01",
      frequencia: "mensal",
      diaSemana: "quinta",
      semanaDoMes: "quarta",
    })
    const ultima = await proximaDataVisita({
      base: "2026-10-01",
      frequencia: "mensal",
      diaSemana: "quinta",
      semanaDoMes: "ultima",
    })
    expect(quarta.error).toBeNull()
    expect(ultima.error).toBeNull()
    expect(quarta.data).toBe("2026-10-22")
    expect(ultima.data).toBe("2026-10-29")
    expect(quarta.data).not.toBe(ultima.data)
  })

  it("Bloco C - virada de dezembro para janeiro do ano seguinte", async () => {
    const { data, error } = await proximaDataVisita({
      base: "2026-12-31",
      frequencia: "mensal",
      diaSemana: "quinta",
      semanaDoMes: "primeira",
    })
    expect(error).toBeNull()
    expect(data).toBe("2027-01-07")
  })
})

describe("proxima_data_visita: âncora incompleta e sem cadência (D-01 estendido)", () => {
  it("Bloco D - mensal com dia fixo mas SEM semana do mês cai no cálculo antigo", async () => {
    const { data, error } = await proximaDataVisita({
      base: "2026-01-31",
      frequencia: "mensal",
      diaSemana: "quinta",
    })
    expect(error).toBeNull()
    expect(data).toBe("2026-02-28")
  })

  it("Bloco D - frequência 'nenhuma' com dia fixo informado continua devolvendo nulo", async () => {
    const { data, error } = await proximaDataVisita({
      base: "2026-08-26",
      frequencia: "nenhuma",
      diaSemana: "quinta",
    })
    expect(error).toBeNull()
    expect(data).toBeNull()
  })
})

describe("proxima_data_visita: nunca uma data no passado (ANCORA-04)", () => {
  it("Bloco E - nenhuma combinação testada devolve data igual ou anterior à base", async () => {
    const casos: {
      base: string
      frequencia: Frequencia
      diaSemana?: DiaSemana
      semanaDoMes?: SemanaDoMes
    }[] = [
      { base: "2026-08-27", frequencia: "semanal", diaSemana: "quinta" }, // semanal no próprio dia alvo
      { base: "2026-08-27", frequencia: "quinzenal", diaSemana: "quinta" }, // quinzenal no próprio dia alvo
      { base: "2026-08-29", frequencia: "mensal", diaSemana: "quinta", semanaDoMes: "primeira" }, // mensal com a ocorrência já passada
      { base: "2026-12-31", frequencia: "mensal", diaSemana: "quinta", semanaDoMes: "primeira" }, // mensal na virada de ano
    ]

    for (const caso of casos) {
      const { data, error } = await proximaDataVisita(caso)
      expect(error).toBeNull()
      expect(typeof data).toBe("string")
      // Comparação como texto no formato ano-mês-dia (a ordem alfabética
      // coincide com a cronológica nesse formato) — nunca convertendo para
      // objeto de data, mesma postura de fuso que `lib/agenda/itens.ts` já
      // documenta.
      expect((data as string) > caso.base).toBe(true)
    }
  })
})

describe("clientes.dia_semana_visita / semana_do_mes_visita e os dois chamadores (ANCORA-03, Bloco F)", () => {
  it("Bloco F - as duas colunas gravam e relêem o mesmo valor", async () => {
    const admin = serviceClient()
    const responsavelId = await getResponsavelId()
    const fields = clienteCompletoFields(uniqueRazaoSocial("colunas"), responsavelId, {
      frequencia_visita: "semanal",
      dia_semana_visita: "quinta",
      semana_do_mes_visita: "ultima",
    })
    const inserted = await inserirCliente(fields)

    const { data, error } = await admin
      .from("clientes")
      .select("dia_semana_visita, semana_do_mes_visita")
      .eq("id", inserted.id)
      .single()

    expect(error).toBeNull()
    expect(data?.dia_semana_visita).toBe("quinta")
    expect(data?.semana_do_mes_visita).toBe("ultima")
  })

  it("Bloco F - agenda_do_vendedor mira o dia fixo do cliente na coluna de sugestão", async () => {
    const admin = serviceClient()
    const responsavelId = await getResponsavelId()
    const fields = clienteCompletoFields(uniqueRazaoSocial("agenda"), responsavelId, {
      etapa: ETAPA_FINAL,
      status_acompanhamento: "ganho",
      frequencia_visita: "semanal",
      dia_semana_visita: "quinta",
    })
    const inserted = await inserirCliente(fields)

    // Visita pendente — condição necessária para o cliente aparecer na
    // metade "visita" da união de agenda_do_vendedor. A coluna de autoria
    // (criado_por) aceita valor ausente, então a semeadura por service
    // role funciona sem precisar de um vendedor autenticado.
    const { error: visitaError } = await admin
      .from("visitas")
      .insert({ cliente_id: inserted.id, data_prevista: "2026-08-27" })
    expect(visitaError).toBeNull()

    const { data: linhas, error } = await admin.rpc("agenda_do_vendedor")
    expect(error).toBeNull()

    const linha = (linhas as { cliente_id: string; proxima_data_sugerida: string | null }[]).find(
      (item) => item.cliente_id === inserted.id
    )
    expect(linha).toBeDefined()
    expect(linha?.proxima_data_sugerida).not.toBeNull()
    const sugerida = linha!.proxima_data_sugerida as string

    // Afirma a PROPRIEDADE (dia da semana certo, estritamente futuro),
    // nunca reproduz a conta — a autoridade do cálculo é uma só no
    // projeto, e este teste não pode virar uma segunda implementação dela.
    expect(diaDaSemanaDe(sugerida)).toBe(4) // quinta = dow 4
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date()
    )
    expect(sugerida > hoje).toBe(true)
  })

  it("Bloco F - mover_card_funil semeia a primeira visita no dia fixo já gravado (caso de re-ganho)", async () => {
    const admin = serviceClient()
    const responsavelId = await getResponsavelId()
    const fields = clienteCompletoFields(uniqueRazaoSocial("re-ganho"), responsavelId, {
      etapa: ETAPA_FINAL,
      status_acompanhamento: "em_andamento",
      dia_semana_visita: "quinta",
    })
    const inserted = await inserirCliente(fields)

    const { error } = await admin.rpc("mover_card_funil", {
      p_cliente_id: inserted.id,
      p_nova_etapa: ETAPA_FINAL,
      p_novo_status: "ganho",
      p_frequencia_visita: "semanal",
    })
    expect(error).toBeNull()

    const { data: visitas, error: visitasError } = await admin
      .from("visitas")
      .select("data_prevista, data_realizada")
      .eq("cliente_id", inserted.id)
    expect(visitasError).toBeNull()
    expect(visitas ?? []).toHaveLength(1)
    expect(visitas?.[0]?.data_realizada).toBeNull()

    const prevista = visitas?.[0]?.data_prevista as string
    expect(diaDaSemanaDe(prevista)).toBe(4) // quinta = dow 4
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date()
    )
    expect(prevista > hoje).toBe(true)
  })
})
