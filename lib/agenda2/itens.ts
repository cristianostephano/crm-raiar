import { bucketDoItem, type AgendaBucket } from "@/lib/agenda/itens"

/**
 * Funções puras da Lista da Agenda 2 (Fase 31, AGD2-01/03/05/07) — uma
 * fonte só, alimentada pela tabela `agenda2_itens` (migration 0048,
 * 31-01-PLAN.md). Sem `next/*`, sem `@/lib/supabase/*`: importável por
 * Client Component, mesma postura de dependência-zero de
 * `lib/agenda/itens.ts`.
 *
 * Toda decisão de dia de calendário (atrasado/hoje/próximos) é SEMPRE de
 * `bucketDoItem()`, importada de `lib/agenda/itens.ts` — nenhuma comparação
 * de data nova vive aqui, nenhum corte de horizonte novo (D-01/D-03,
 * correção 6 do 31-01-PLAN.md). A Agenda atual não é editada nesta fase.
 *
 * Nenhuma função deste arquivo reordena itens — a ordem vem do SQL (data,
 * criação, id) e é preservada ponta a ponta (D-08). A única exceção é
 * `vendedoresDaAgenda2`, que ordena as OPÇÕES do filtro por nome (não os
 * itens da lista).
 *
 * `responsavel` é o nome escolhido para `vendedor_id` justamente para
 * reusar `filtrarPorVendedor` (de `lib/agenda/itens.ts`) sem nenhuma
 * alteração — D-17. A Lista chama `filtrarPorVendedor` diretamente; este
 * arquivo não reexporta nem reimplementa essa função.
 *
 * `visivelNaListaAgenda2` materializa a correção 7 do 31-01-PLAN.md: com
 * só atrasado/hoje/próximos, um item concluído ontem ficaria preso em
 * "Atrasado" para sempre. A regra: todo pendente é visível; todo item de
 * hoje ou do futuro é visível (pendente ou concluído); um concluído de data
 * passada só é visível se foi alterado HOJE (D-05, para o vendedor poder
 * desmarcar um clique errado sem precisar procurar no calendário).
 */

/** Uma linha de `agenda2_itens`, já mapeada para camelCase pela camada de
 * consulta. */
export type Agenda2Item = {
  id: string
  nomeCliente: string
  bairro: string
  /** YYYY-MM-DD, texto cru vindo do banco. */
  data: string
  concluido: boolean
  /** timestamptz ISO completo vindo do banco. */
  atualizadoEm: string
  /** = vendedor_id — nome escolhido para reusar `filtrarPorVendedor` sem
   * alteração (D-17). */
  responsavel: string | null
  /** "Nome Sobrenome" do dono, para o Supervisor ver de quem é o item. */
  responsavelNome: string | null
}

export type Agenda2Agrupada = Record<AgendaBucket, Agenda2Item[]>

/**
 * Reparte a lista recebida nas três seções, numa única passagem, sem
 * ordenar (mesma forma de `agruparAgenda` em `lib/agenda/itens.ts`). A soma
 * dos tamanhos das três seções de saída é sempre igual ao tamanho da lista
 * de entrada (partição verdadeira).
 */
export function agruparAgenda2(
  itens: Agenda2Item[],
  now: Date = new Date()
): Agenda2Agrupada {
  const agrupado: Agenda2Agrupada = { atrasado: [], hoje: [], proximos: [] }

  for (const item of itens) {
    agrupado[bucketDoItem(item.data, now)].push(item)
  }

  return agrupado
}

/**
 * Decide se um item deve aparecer na Lista (correção 7 do 31-01-PLAN.md).
 * Três casos, nesta ordem:
 * 1. Pendente (não concluído) — sempre visível, qualquer data.
 * 2. Concluído de hoje ou do futuro — sempre visível (D-04), riscado na
 *    tela.
 * 3. Concluído de data passada — visível só se foi alterado HOJE (D-05);
 *    `atualizadoEm` é um instante completo, e `bucketDoItem` continua
 *    decidindo o dia de calendário local a partir dele, exatamente como
 *    decide a partir de `data`.
 */
export function visivelNaListaAgenda2(
  item: Agenda2Item,
  now: Date = new Date()
): boolean {
  if (!item.concluido) return true
  if (bucketDoItem(item.data, now) !== "atrasado") return true
  return bucketDoItem(item.atualizadoEm, now) === "hoje"
}

/**
 * Filtra pela regra de `visivelNaListaAgenda2`, preservando a ordem de
 * entrada.
 */
export function itensDaListaAgenda2(
  itens: Agenda2Item[],
  now: Date = new Date()
): Agenda2Item[] {
  return itens.filter((item) => visivelNaListaAgenda2(item, now))
}

/**
 * Extrai os vendedores distintos presentes na lista (par `responsavel` +
 * `responsavelNome`), descartando item sem um dos dois. Ordenado por nome
 * com `localeCompare` em `pt-BR` — mesmo corpo de `vendedoresDaAgenda`
 * (`lib/agenda/itens.ts`), copiado localmente e tipado para `Agenda2Item`
 * para não editar a Agenda atual. As opções do filtro vêm sempre dos
 * próprios itens já carregados, nunca de uma consulta separada.
 */
export function vendedoresDaAgenda2(
  itens: Agenda2Item[]
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

/** Normalização local usada só por `existeItemParecido`: apara as pontas,
 * colapsa espaços internos em um, e ignora caixa (locale pt-BR). */
function normalizarNomeParaComparacao(texto: string): string {
  return texto.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")
}

/**
 * Aviso de possível duplicado (D-07) — nunca um bloqueio, a tela decide
 * deixar criar mesmo assim. "Parecido" = mesmo nome (ignorando caixa e
 * espaços) E mesma data. Datas são comparadas como TEXTO
 * (`item.data === candidato.data`), imune a fuso — nenhuma conversão para
 * objeto de data. `ignorarId` exclui o próprio item da checagem (uso: tela
 * de edição). Checagem feita sobre a lista já carregada, sem ida ao banco.
 */
export function existeItemParecido(
  itens: Agenda2Item[],
  candidato: { nomeCliente: string; data: string },
  ignorarId: string | null = null
): boolean {
  const nomeCandidato = normalizarNomeParaComparacao(candidato.nomeCliente)

  return itens.some((item) => {
    if (item.id === ignorarId) return false
    return (
      normalizarNomeParaComparacao(item.nomeCliente) === nomeCandidato &&
      item.data === candidato.data
    )
  })
}
