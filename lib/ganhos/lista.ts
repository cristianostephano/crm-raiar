import { addDays, startOfDay, subDays } from "date-fns"

import { nomeExibicaoCliente } from "@/lib/clientes/nomeExibicao"

/**
 * Camada pura da tela Ganhos (quick 261008-rxw). Irmã deliberada de
 * lib/perdidos/lista.ts, SEM import cruzado com Perdidos/Encerrados (mesmo
 * precedente da Fase 29): mesmos presets, mesma resolução de período, mesma
 * validação e mesma busca. Sem import do cliente Supabase nem do módulo de
 * cabeçalhos/cookies do Next, para ser importável tanto pela Server Action
 * (app/actions/ganhos.ts) quanto pelo Client Component da tela.
 */

/**
 * Espelha as 6 colunas de `clientes_ganhos` (migration 0053). `ganhoEm` é a
 * "data real do ganho" (coluna clientes.ganho_em) no formato "AAAA-MM-DD", ou
 * nulo quando ninguém informou (cliente importado já ganho). Acrescentar
 * qualquer dado de meio de comunicação com a pessoa do cliente muda o escopo
 * de dado pessoal desta tela e precisa de aprovação do dono do projeto antes
 * — não adicionar campo novo aqui sem essa conversa.
 */
export type ClienteGanho = {
  clienteId: string
  razaoSocial: string | null
  nomeFantasia: string | null
  ganhoEm: string | null
  responsavel: string
  responsavelNome: string | null
}

/** Texto único para quando a data real do ganho estiver vazia — garante que
 * a linha nunca fique sem data visível. */
export const DATA_GANHO_AUSENTE = "Data não informada"

export type PeriodoPresetGanhos = "tudo" | "30dias" | "90dias" | "personalizado"

export const PERIODO_PADRAO_GANHOS: PeriodoPresetGanhos = "tudo"

export const PERIODO_PRESETS_GANHOS: readonly {
  value: PeriodoPresetGanhos
  label: string
}[] = [
  { value: "tudo", label: "Tudo" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "90dias", label: "Últimos 90 dias" },
  { value: "personalizado", label: "Personalizado" },
]

export type IntervaloGanhos = { inicio: string | null; fim: string | null }

/**
 * Resolve um preset (ou um intervalo personalizado explícito) num par
 * {inicio, fim} em ISO 8601, pronto para virar p_inicio/p_fim da RPC
 * `clientes_ganhos`. Os parâmetros continuam sendo instantes (mesma forma de
 * Perdidos); é a RPC que os converte para a data de São Paulo (P-13). As
 * janelas móveis (30dias/90dias) nunca têm limite superior. O banco trata o
 * fim como limite EXCLUSIVO, por isso o personalizado manda a meia-noite do
 * dia SEGUINTE ao último dia escolhido (o último dia inteiro entra). Cliente
 * sem data do ganho só aparece quando os dois limites são nulos ("Tudo").
 */
export function resolvePeriodoGanhos(
  preset: PeriodoPresetGanhos,
  custom?: { from: Date; to: Date },
  agora: Date = new Date()
): IntervaloGanhos {
  switch (preset) {
    case "tudo":
      return { inicio: null, fim: null }
    case "30dias":
      return { inicio: subDays(agora, 30).toISOString(), fim: null }
    case "90dias":
      return { inicio: subDays(agora, 90).toISOString(), fim: null }
    case "personalizado":
      if (!custom) return { inicio: null, fim: null }
      return {
        inicio: startOfDay(custom.from).toISOString(),
        fim: startOfDay(addDays(custom.to, 1)).toISOString(),
      }
  }
}

/**
 * Verdadeiro só quando o preset recorta de fato o período (não "tudo", e não
 * "personalizado" sem intervalo aplicado) — a tela usa para escolher entre os
 * dois textos de lista vazia e para mostrar o aviso de que clientes sem data
 * do ganho só aparecem em "Tudo".
 */
export function temRecortePeriodoGanhos(
  preset: PeriodoPresetGanhos,
  custom?: { from: Date; to: Date }
): boolean {
  if (preset === "tudo") return false
  if (preset === "personalizado") return Boolean(custom)
  return true
}

export type ValidacaoPeriodoGanhos =
  | { valido: true; intervalo: IntervaloGanhos }
  | { valido: false; message: string }

const PERIODO_INVALIDO_MESSAGE = "Período inválido."

/**
 * Normaliza uma chave (inicio ou fim) vinda de `entrada: unknown`.
 * `undefined` = ausente/nula (vira "sem limite"); `null` = valor rejeitado
 * pelo chamador (nem ausente nem data válida).
 */
function parseChaveData(valor: unknown): string | null | undefined {
  if (valor === undefined || valor === null) return undefined
  if (typeof valor !== "string" || Number.isNaN(Date.parse(valor))) return null
  return valor
}

/**
 * Valida o intervalo vindo do navegador ANTES de qualquer chamada ao banco —
 * a Server Action é um endpoint público, e esta validação é de ENTRADA, não
 * de autorização (autorização é só a RLS dentro de `clientes_ganhos`).
 */
export function validarPeriodoGanhos(entrada: unknown): ValidacaoPeriodoGanhos {
  if (typeof entrada !== "object" || entrada === null || Array.isArray(entrada)) {
    return { valido: false, message: PERIODO_INVALIDO_MESSAGE }
  }

  const { inicio: inicioBruto, fim: fimBruto } = entrada as {
    inicio?: unknown
    fim?: unknown
  }

  const inicioParseado = parseChaveData(inicioBruto)
  const fimParseado = parseChaveData(fimBruto)

  if (inicioParseado === null || fimParseado === null) {
    return { valido: false, message: PERIODO_INVALIDO_MESSAGE }
  }

  const inicio = inicioParseado ?? null
  const fim = fimParseado ?? null

  if (inicio !== null && fim !== null && Date.parse(inicio) >= Date.parse(fim)) {
    return {
      valido: false,
      message: "A data inicial precisa ser anterior à final.",
    }
  }

  return { valido: true, intervalo: { inicio, fim } }
}

/**
 * Busca pelo NOME EXIBIDO (Nome Fantasia, com queda para a razão social) —
 * mesma regra da busca do Kanban. Nunca muta a lista de entrada.
 */
export function filtrarGanhosPorNome(
  lista: readonly ClienteGanho[],
  busca: string
): ClienteGanho[] {
  const termo = busca.trim().toLowerCase()
  if (termo === "") return [...lista]
  return lista.filter((cliente) =>
    nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)
      .toLowerCase()
      .includes(termo)
  )
}
