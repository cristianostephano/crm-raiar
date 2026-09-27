import type { StatusAcompanhamento } from "@/lib/supabase/queries/clientes"

/**
 * Regra de visibilidade do funil de prospecção (quick task 260915-ls7,
 * estendida na Fase 28 — Relatório de Perdidos, PERD-01, D-06 — e na Fase
 * 29 — Encerrar Cliente Ativo, D-13).
 *
 * (1) Regra de produto: cliente ganho deixou de ser prospecção — ele já
 * fechou a primeira venda, então sai das 7 colunas do funil de `/clientes` e
 * passa a ser acompanhado pela Agenda (visitas/tarefas) e pela ficha
 * individual (quick task 260915-ls7). Cliente perdido também sai das 7
 * colunas: deixou de ser prospecção ativa e passa a ser encontrado na tela
 * Perdidos, de onde pode ser reaberto com um toque (Fase 28, PERD-01/D-06).
 * Ao reabrir (status volta a "em andamento") ele passa de novo por esta
 * regra e reaparece na etapa em que já estava (D-08) — a etapa nunca muda ao
 * marcar/desmarcar perdido, só o status. Cliente encerrado também sai das 7
 * colunas (Fase 29, D-13): era um ativo (ganho) que parou de comprar, é
 * encontrado na tela Encerrados e, ao reativar, volta para "ganho" —
 * portanto continua fora do Kanban e volta a ser acompanhado pela Agenda
 * (Fase 29, D-10).
 *
 * (2) Isto é regra de EXIBIÇÃO, nunca de autorização. O mesmo usuário
 * continua podendo ler seus próprios clientes ganhos, perdidos e encerrados
 * em toda outra tela — Agenda, ficha, Diário, Dashboard, a tela Perdidos
 * (Fase 28) e a tela Encerrados (Fase 29), que leem cliente perdido/
 * encerrado normalmente. Quem tentar transformar esta regra em policy de
 * RLS quebra todas essas telas de uma vez: RLS decide QUEM pode ver uma
 * linha, este módulo decide só o que aparece nas 7 colunas do Kanban de
 * prospecção.
 *
 * (3) Este módulo é a definição ÚNICA da regra, consumida em dois pontos da
 * mesma leitura (`getClientesAgrupadosPorEtapa`): o filtro SQL e a guarda do
 * laço que monta o agrupamento. Mesmo espírito de `isClienteIncompleto`
 * (lib/clientes/completude.ts), que também é uma única fonte consumida por
 * dois consumidores. A leitura de exportação (`getClientesParaExportacao`)
 * NÃO consome este módulo de propósito (Fase 28, D-07) — "Exportar todos"
 * precisa continuar trazendo ganhos, perdidos e encerrados mesmo depois de
 * saírem do Kanban.
 *
 * Módulo puro, sem nenhuma dependência de runtime — só importa o TIPO
 * StatusAcompanhamento (import type, some na compilação), então pode ser
 * importado tanto por Server Component quanto por Client Component sem
 * arrastar next/headers junto (mesmo formato de lib/clientes/completude.ts e
 * lib/clientes/export-ids.ts).
 */

/**
 * Valores enviados ao Postgres no filtro de exclusão da leitura do Kanban —
 * também a fonte única consumida por `apareceNaProspeccao` abaixo. Array (não
 * Set) porque também alimenta a string do filtro `.not(..., "in", ...)` do
 * PostgREST em lib/supabase/queries/clientes.ts, que precisa de algo
 * iterável/joinável — o Set interno abaixo é só um detalhe de implementação
 * de `apareceNaProspeccao`.
 */
export const STATUS_FORA_DA_PROSPECCAO_LISTA = [
  "ganho",
  "perdido",
  "encerrado",
] as const satisfies readonly StatusAcompanhamento[]

const STATUS_FORA_DA_PROSPECCAO_SET: ReadonlySet<StatusAcompanhamento> =
  new Set<StatusAcompanhamento>(STATUS_FORA_DA_PROSPECCAO_LISTA)

/**
 * `true` só para "em andamento" (aparece nas 7 colunas do Kanban); `false`
 * para "ganho", "perdido" e "encerrado", que saem da prospecção ativa.
 */
export function apareceNaProspeccao(status: StatusAcompanhamento): boolean {
  return !STATUS_FORA_DA_PROSPECCAO_SET.has(status)
}
