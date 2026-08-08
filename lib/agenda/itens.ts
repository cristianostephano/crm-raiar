import { differenceInCalendarDays, parseISO } from "date-fns"

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
