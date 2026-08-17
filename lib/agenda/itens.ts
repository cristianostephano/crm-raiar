import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ptBR } from "date-fns/locale"

import type { FrequenciaVisita } from "@/lib/funil/frequencia"

/**
 * Agenda unificada (AGD-03/AGD-01/AGD-05 base/AGD-06) — pure functions only,
 * no DB access, no `next/*`, no `@/lib/supabase/*` import. This is the ONLY
 * file in the project that decides which of the three sections
 * (atrasado/hoje/proximos) an agenda item falls into — no other file
 * duplicates this decision.
 *
 * Same dependency-free posture as lib/clientes/completude.ts: this module
 * has to be importable from a Client Component (the 14-03 screen) without
 * pulling `next/headers`-dependent server code into the browser bundle.
 * Mirrors lib/funil/staleness.ts's shape (differenceInCalendarDays +
 * parseISO, `now: Date = new Date()` default parameter so tests can pin
 * "today", and "ISO date string (YYYY-MM-DD)" field documentation).
 * Importing `FrequenciaVisita` from lib/funil/frequencia.ts is safe here
 * because that module is equally pure.
 */

/** The two values `agenda_do_vendedor()`'s `origem` column returns. */
export type AgendaOrigem = "prospeccao" | "visita"

/** One row of `agenda_do_vendedor()`, already mapped to camelCase by
 * lib/supabase/queries/agenda.ts. */
export type AgendaItem = {
  origem: AgendaOrigem
  itemId: string
  clienteId: string
  razaoSocial: string
  responsavel: string | null
  responsavelNome: string | null
  titulo: string
  /** ISO date string (YYYY-MM-DD), the `agenda_do_vendedor()` `data` column. */
  data: string
  /** Frequência de visita do cliente (CONC-01/VIS-03), vinda pronta da
   * coluna `frequencia_visita` de `agenda_do_vendedor()` (migration 0015).
   * `null` para item de `origem: "prospeccao"` (o conceito não se aplica)
   * e para cliente sem cadência definida. */
  frequenciaVisita: FrequenciaVisita | null
  /** Data sugerida (YYYY-MM-DD) da próxima visita, JÁ CALCULADA DO BANCO —
   * coluna `proxima_data_sugerida` de `agenda_do_vendedor()` (migration
   * 0015), que reusa `proxima_data_visita` da Fase 13. `null` para item de
   * `origem: "prospeccao"` e para cliente sem cadência.
   *
   * PITFALL 1: esta data atravessa do banco até a tela SEM transformação —
   * nenhuma linha de código de aplicação (deste arquivo ou de qualquer
   * outro) pode recalculá-la ou reconstruí-la a partir de aritmética de
   * data. A autoridade única do cálculo é a função do banco. */
  proximaDataSugerida: string | null
}

export type AgendaBucket = "atrasado" | "hoje" | "proximos"

export type AgendaAgrupada = Record<AgendaBucket, AgendaItem[]>

/**
 * Autoridade única de "atrasado / hoje / próximos dias". Compara DIA DE
 * CALENDÁRIO (differenceInCalendarDays), nunca instante — um item de hoje
 * continua "hoje" tanto às 00h05 quanto às 23h30 do mesmo dia, sem depender
 * da hora do dia nem do fuso horário.
 *
 * A data que chega do banco JAMAIS pode ser convertida com o construtor de
 * data cru do JavaScript (`new Date(...)`) a partir da string: o construtor
 * interpreta a string `YYYY-MM-DD` como meia-noite em fuso zero e, no
 * horário de São Paulo, mostra o dia anterior (Pitfall 1 da research — o
 * kanban já tratou isso do mesmo jeito em lib/funil/staleness.ts). Use
 * sempre `parseISO`, que trata a string como data local.
 */
export function bucketDoItem(
  data: string,
  now: Date = new Date()
): AgendaBucket {
  const diff = differenceInCalendarDays(now, parseISO(data))
  if (diff > 0) return "atrasado"
  if (diff === 0) return "hoje"
  return "proximos"
}

/**
 * Reparte a lista recebida nas três seções, numa única passagem. NÃO ordena
 * em nenhum ponto (sem chamar o método de ordenação de array): a ordem já vem decidida pelo SQL de
 * `agenda_do_vendedor()` e reordenar aqui criaria uma segunda autoridade de
 * ordenação — o mesmo contrato que `ComparativoVendedorTable` já documenta
 * para o comparativo de vendedor. A soma dos tamanhos das três seções de
 * saída é sempre igual ao tamanho da lista de entrada (partição verdadeira).
 */
export function agruparAgenda(
  itens: AgendaItem[],
  now: Date = new Date()
): AgendaAgrupada {
  const agrupado: AgendaAgrupada = { atrasado: [], hoje: [], proximos: [] }

  for (const item of itens) {
    agrupado[bucketDoItem(item.data, now)].push(item)
  }

  return agrupado
}

/**
 * Filtro do AGD-05: `null` significa "sem filtro" e devolve a lista
 * inalterada, na mesma ordem. Este é um ESTREITAMENTO LOCAL sobre uma lista
 * que a RLS já escopou — não é, e não pode virar, uma checagem de
 * permissão.
 */
export function filtrarPorVendedor(
  itens: AgendaItem[],
  vendedorId: string | null
): AgendaItem[] {
  if (vendedorId === null) return itens
  return itens.filter((item) => item.responsavel === vendedorId)
}

/**
 * Extrai os vendedores distintos presentes na lista (par `responsavel` +
 * `responsavelNome`), descartando itens sem um dos dois em vez de gerar uma
 * opção vazia. Ordenado por nome com `localeCompare` em `pt-BR`. A lista de
 * opções do filtro vem sempre dos próprios itens já carregados, nunca de
 * uma consulta separada (regra travada no UI-SPEC) — é também o que garante
 * que o filtro nunca ofereça um vendedor que o chamador não teria permissão
 * de ver.
 */
export function vendedoresDaAgenda(
  itens: AgendaItem[]
): { id: string; nome: string }[] {
  const porId = new Map<string, string>()

  for (const item of itens) {
    if (!item.responsavel || !item.responsavelNome) continue
    if (!porId.has(item.responsavel)) {
      porId.set(item.responsavel, item.responsavelNome)
    }
  }

  return Array.from(porId, ([id, nome]) => ({ id, nome })).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR")
  )
}

// ---------------------------------------------------------------------------
// Camada de calendário (AGD-07..AGD-12/AGD-14) — mês, semana e dia. Vive
// neste mesmo arquivo de propósito: este continua sendo o único lugar que
// decide como os itens da agenda são organizados (ver comentário de
// cabeçalho acima); um arquivo novo criaria uma segunda autoridade sobre a
// mesma pergunta. Como o resto do arquivo, a camada abaixo permanece pura —
// nenhuma importação de `next/*` nem de `@/lib/supabase/*`.
// ---------------------------------------------------------------------------

/**
 * Segunda-feira, o único início de semana usado pela grade de mês, pela
 * grade de semana e pelos rótulos de cabeçalho. O date-fns NÃO deriva o
 * primeiro dia da semana do idioma passado — mesmo `startOfWeek`/`endOfWeek`
 * recebendo `{ locale: ptBR }`, o padrão da biblioteca continua sendo o dia
 * usado nos calendários americanos (domingo). Sem esta constante
 * compartilhada, a grade de mês e a de semana poderiam discordar sobre em
 * qual coluna cada data cai (Pitfall 8 da pesquisa da Fase 20).
 */
export const INICIO_DA_SEMANA = 1

/**
 * Teto de itens visíveis por célula da grade de mês (AGD-09) antes de virar
 * "+N mais". Exportada para que a grade (`dividirCelula`) e o contador de
 * excedente concordem sempre sobre o mesmo número.
 */
export const MAX_ITENS_NA_CELULA = 3

/** Os três modos de visualização de calendário (AGD-08). */
export type CalendarioModo = "dia" | "semana" | "mes"

/**
 * Vocabulário completo de visão da Agenda (AGD-07): a lista já existente
 * somada aos três modos de calendário. Mora aqui, e não no componente, para
 * que a tela e o calendário concordem sobre o vocabulário sem uma delas
 * importar a outra.
 */
export type AgendaVisao = "lista" | CalendarioModo

/** Auxiliar interno de capitalização — evita repetir a mesma manipulação de
 * string nos três ramos de `rotuloDoPeriodo` e em `rotulosDosDiasDaSemana`. */
function capitalizarPrimeiraLetra(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/**
 * As células da grade de mês (AGD-09): semanas completas cobrindo o mês
 * inteiro, sempre em múltiplo de 7. Composição pura de aritmética de
 * calendário sobre objetos `Date` (início do mês → início da semana, fim do
 * mês → fim da semana, ambos usando a constante de início de semana) — sem
 * nenhum componente de fuso horário. Diferente do agrupamento por dia mais
 * abaixo, que jamais converte a data de um item.
 */
export function diasDaGradeDoMes(referencia: Date): Date[] {
  const inicio = startOfWeek(startOfMonth(referencia), {
    weekStartsOn: INICIO_DA_SEMANA,
  })
  const fim = endOfWeek(endOfMonth(referencia), {
    weekStartsOn: INICIO_DA_SEMANA,
  })

  return eachDayOfInterval({ start: inicio, end: fim })
}

/**
 * Os 7 dias da semana (AGD-10) que contém `referencia`, sempre de segunda a
 * domingo — inclusive quando `referencia` cai num domingo, o caso que a
 * escolha de segunda-feira como início torna delicado.
 */
export function diasDaSemana(referencia: Date): Date[] {
  const inicio = startOfWeek(referencia, { weekStartsOn: INICIO_DA_SEMANA })
  const fim = endOfWeek(referencia, { weekStartsOn: INICIO_DA_SEMANA })

  return eachDayOfInterval({ start: inicio, end: fim })
}

/**
 * Rótulos curtos dos 7 dias da semana, de segunda a domingo. DERIVADOS de
 * `diasDaSemana` (nunca uma lista escrita à mão) — é isso que garante que o
 * cabeçalho da grade de mês/semana e as colunas nunca desalinhem.
 */
export function rotulosDosDiasDaSemana(): string[] {
  return diasDaSemana(new Date()).map((dia) =>
    capitalizarPrimeiraLetra(format(dia, "EEEEEE", { locale: ptBR }))
  )
}

/**
 * Avança ou volta a data de referência conforme o modo: um dia, uma semana
 * (sete dias) ou um mês, multiplicado pelo passo. Navegar um mês a partir do
 * dia 31 usa o comportamento de aparar (clamp) do próprio date-fns — 31 de
 * janeiro vira o último dia de fevereiro, não transborda para março — pinado
 * em teste para não surpreender depois.
 */
export function navegarData(
  referencia: Date,
  modo: CalendarioModo,
  passo: 1 | -1
): Date {
  if (modo === "dia") return addDays(referencia, passo)
  if (modo === "semana") return addWeeks(referencia, passo)
  return addMonths(referencia, passo)
}

/**
 * Rótulo em português do período mostrado, um formato por modo, usando o
 * idioma `ptBR` do subcaminho de idiomas do date-fns já instalado (nada a
 * instalar). Mês: nome do mês por extenso, "de", e o ano, com inicial
 * maiúscula. Semana: quando o primeiro e o último dia caem no mesmo mês, só
 * o número do primeiro seguido do último por extenso; quando atravessam
 * meses, os dois lados por extenso, com o ano só no fim. Dia: dia da semana
 * por extenso, o dia, o mês por extenso e o ano, com inicial maiúscula.
 */
export function rotuloDoPeriodo(
  referencia: Date,
  modo: CalendarioModo
): string {
  if (modo === "mes") {
    return capitalizarPrimeiraLetra(
      format(referencia, "MMMM 'de' yyyy", { locale: ptBR })
    )
  }

  if (modo === "dia") {
    return capitalizarPrimeiraLetra(
      format(referencia, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
    )
  }

  const dias = diasDaSemana(referencia)
  const primeiro = dias[0]
  const ultimo = dias[6]

  if (isSameMonth(primeiro, ultimo)) {
    return `${format(primeiro, "d")} - ${format(ultimo, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`
  }

  return `${format(primeiro, "d 'de' MMMM", { locale: ptBR })} - ${format(ultimo, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`
}

/**
 * A ÚNICA ponte entre o mundo dos objetos de data (a grade, construída por
 * `diasDaGradeDoMes`/`diasDaSemana`) e o mundo das strings de data (o campo
 * `data` do item, que já chega do banco como texto ISO curto). A ponte é
 * atravessada num só sentido — de objeto para texto — no mesmo formato
 * `YYYY-MM-DD` do campo `data` do item.
 */
export function chaveDoDia(dia: Date): string {
  return format(dia, "yyyy-MM-dd")
}

/**
 * Reparte a lista recebida por dia, numa única passagem, empurrando cada
 * item para a lista da sua própria string de data — usada VERBATIM como
 * chave. A string de data do item **jamais** é passada ao construtor de
 * data do JavaScript nem a `parseISO`: comparar texto com texto é imune a
 * fuso horário, e é por isso que o agrupamento é feito assim, e não
 * convertendo os dois lados para objeto de data (a mesma regressão que
 * `bucketDoItem` já documenta no próprio comentário). A ordem de entrada é
 * preservada dentro de cada dia, pelo mesmo motivo que `agruparAgenda` já
 * documenta para as três seções: nenhuma segunda autoridade de ordenação.
 */
export function agruparPorData(itens: AgendaItem[]): Map<string, AgendaItem[]> {
  const porData = new Map<string, AgendaItem[]>()

  for (const item of itens) {
    const chave = item.data
    const lista = porData.get(chave)
    if (lista) {
      lista.push(item)
    } else {
      porData.set(chave, [item])
    }
  }

  return porData
}

/**
 * Consulta o mapa já agrupado (por `agruparPorData`) pela chave derivada de
 * `chaveDoDia`, devolvendo lista vazia quando não há nada — nunca
 * indefinido. Receber o mapa pronto, em vez da lista crua de itens, é
 * intencional: garante que a grade e as contagens leiam o MESMO
 * agrupamento, calculado uma vez a partir do conjunto já estreitado pelo
 * filtro de vendedor.
 */
export function itensDoDia(
  porData: Map<string, AgendaItem[]>,
  dia: Date
): AgendaItem[] {
  return porData.get(chaveDoDia(dia)) ?? []
}

/**
 * Reparte os itens de uma célula (AGD-09) em "os que aparecem" e "quantos
 * sobraram". O excedente é DERIVADO do mesmo arranjo que produz os
 * visíveis — nunca um segundo número calculado à parte —, para que o
 * contador da célula não possa discordar do que a célula desenha. O teto
 * vem de `MAX_ITENS_NA_CELULA` por padrão, mas pode ser sobrescrito.
 */
export function dividirCelula(
  itens: AgendaItem[],
  maxVisiveis: number = MAX_ITENS_NA_CELULA
): { visiveis: AgendaItem[]; excedente: number } {
  const visiveis = itens.slice(0, maxVisiveis)

  return { visiveis, excedente: itens.length - visiveis.length }
}
