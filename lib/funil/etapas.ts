/**
 * Single source of truth for the 7 fixed funil (kanban) stages.
 *
 * Source: CLAUDE.md "Funil de vendas (kanban)" list — the stage names and
 * their order are fixed for the MVP (no CRUD on stages, per STATE.md's
 * recorded open-item resolution). Every other Phase 2+ plan (cadastro,
 * kanban board, filters, detail sheet) imports ETAPAS/ETAPA_KEYS/ETAPA_FINAL
 * from here instead of redefining the stage list.
 *
 * The `key` values here MUST match the `etapa_funil` Postgres enum defined
 * in supabase/migrations/0002_clientes_and_funil.sql, in the same order.
 */

export const ETAPAS = [
  { key: "aguardando_contato", label: "Aguardando contato" },
  { key: "conversa_comprador", label: "Conversa realizada com comprador(a)" },
  { key: "aguardando_data_reuniao", label: "Aguardando data para reunião inicial" },
  { key: "aguardando_feedback", label: "Aguardando feedback da reunião" },
  { key: "aguardando_aprovacao", label: "Aguardando aprovação final do cliente/comitê" },
  { key: "em_cadastro_produto", label: "Em cadastro de produto" },
  { key: "primeira_venda", label: "1ª venda concluída" },
] as const

export type EtapaKey = (typeof ETAPAS)[number]["key"]

export const ETAPA_KEYS = ETAPAS.map((etapa) => etapa.key) as [
  EtapaKey,
  ...EtapaKey[],
]

/** Only stage from which status_acompanhamento can become 'ganho' (FUN-05). */
export const ETAPA_FINAL: EtapaKey = "primeira_venda"

/**
 * Etapa vizinha (anterior/seguinte) na GRADE fixa do funil, para as setas de
 * avançar/voltar do card (D-02, quick task 260921-n0a). Descrevem só a
 * ordem das 7 colunas — nenhuma regra de negócio, nenhuma duplicação de
 * trava: `mover_card_funil` continua sendo a única autoridade sobre o que
 * pode ou não ser movido (D-05).
 */
export function etapaAnterior(etapa: EtapaKey): EtapaKey | null {
  const index = ETAPA_KEYS.indexOf(etapa)
  return index > 0 ? ETAPA_KEYS[index - 1] : null
}

export function etapaSeguinte(etapa: EtapaKey): EtapaKey | null {
  const index = ETAPA_KEYS.indexOf(etapa)
  return index >= 0 && index < ETAPA_KEYS.length - 1
    ? ETAPA_KEYS[index + 1]
    : null
}
