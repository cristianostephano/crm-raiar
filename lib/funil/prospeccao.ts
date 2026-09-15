import type { StatusAcompanhamento } from "@/lib/supabase/queries/clientes"

/**
 * Regra de visibilidade do funil de prospecção (quick task 260915-ls7).
 *
 * (1) Regra de produto: cliente ganho deixou de ser prospecção — ele já
 * fechou a primeira venda, então sai das 7 colunas do funil de `/clientes` e
 * passa a ser acompanhado pela Agenda (visitas/tarefas) e pela ficha
 * individual. Cliente perdido continua aparecendo normalmente: ainda é
 * objeto de análise do funil, só não foi pedido para sumir.
 *
 * (2) Isto é regra de EXIBIÇÃO, nunca de autorização. O mesmo usuário
 * continua podendo ler seus próprios clientes ganhos em toda outra tela —
 * Agenda, ficha, Diário e Dashboard. Quem tentar transformar esta regra em
 * policy de RLS quebra todas essas telas de uma vez: RLS decide QUEM pode
 * ver uma linha, este módulo decide só o que aparece nas 7 colunas do
 * Kanban de prospecção.
 *
 * (3) Este módulo é a definição ÚNICA da regra, consumida em dois pontos da
 * mesma leitura (`getClientesAgrupadosPorEtapa`): o filtro SQL e a guarda do
 * laço que monta o agrupamento. Mesmo espírito de `isClienteIncompleto`
 * (lib/clientes/completude.ts), que também é uma única fonte consumida por
 * dois consumidores.
 *
 * Módulo puro, sem nenhuma dependência de runtime — só importa o TIPO
 * StatusAcompanhamento (import type, some na compilação), então pode ser
 * importado tanto por Server Component quanto por Client Component sem
 * arrastar next/headers junto (mesmo formato de lib/clientes/completude.ts e
 * lib/clientes/export-ids.ts).
 */

/** Valor literal enviado ao Postgres no filtro da leitura do Kanban. */
export const STATUS_FORA_DA_PROSPECCAO = "ganho" as const satisfies StatusAcompanhamento

/**
 * `true` quando o status ainda é prospecção ativa (aparece nas 7 colunas do
 * Kanban); `false` só para "ganho".
 */
export function apareceNaProspeccao(status: StatusAcompanhamento): boolean {
  return status !== STATUS_FORA_DA_PROSPECCAO
}
