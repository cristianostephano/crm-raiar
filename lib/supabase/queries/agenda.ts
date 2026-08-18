import type { AgendaItem } from "@/lib/agenda/itens"
import type { FrequenciaVisita } from "@/lib/funil/frequencia"
import { createClient } from "@/lib/supabase/server"

/**
 * ÚNICO caminho de leitura da Agenda no projeto. Faz UMA chamada de RPC a
 * `agenda_do_vendedor()` e nunca busca `tarefas` e `visitas` separadamente
 * (Anti-Pattern 4 da research — duas buscas mescladas no navegador
 * duplicariam a lógica de ordenação e dobrariam o tráfego).
 *
 * NENHUM filtro manual de responsável ou de papel aqui: `agenda_do_vendedor()`
 * é SECURITY INVOKER (supabase/migrations/0014_agenda_do_vendedor.sql) e a
 * RLS de clientes/tarefas/visitas já escopou o resultado antes de ele chegar
 * — mesmo princípio de lib/supabase/queries/dashboard.ts.
 *
 * `AgendaItem` é re-exportado a partir de lib/agenda/itens.ts (não
 * redefinido aqui) para que os consumidores tenham um ponto de import só; o
 * tipo continua morando no arquivo puro porque o Client Component do plano
 * 14-03 precisa importá-lo sem passar por este arquivo (que puxa
 * `next/headers` via lib/supabase/server.ts).
 */
export type { AgendaItem }

type AgendaRow = {
  origem: "prospeccao" | "visita"
  item_id: string
  cliente_id: string
  razao_social: string
  responsavel: string | null
  responsavel_nome: string | null
  titulo: string
  data: string
  frequencia_visita: FrequenciaVisita | null
  proxima_data_sugerida: string | null
}

function mapRow(row: AgendaRow): AgendaItem {
  return {
    origem: row.origem,
    itemId: row.item_id,
    clienteId: row.cliente_id,
    razaoSocial: row.razao_social,
    responsavel: row.responsavel,
    responsavelNome: row.responsavel_nome,
    titulo: row.titulo,
    data: row.data,
    frequenciaVisita: row.frequencia_visita,
    proximaDataSugerida: row.proxima_data_sugerida,
  }
}

/**
 * AGD-01: leitura completa da agenda. NÃO reordena, NÃO filtra e NÃO corta
 * o resultado (sem chamar métodos de ordenação/filtro/slice de array) — a ordenação é decidida no SQL de
 * `agenda_do_vendedor()`, a filtragem de "ainda pendente" também é do SQL, e
 * a repartição em seções (atrasado/hoje/próximos) é responsabilidade de
 * lib/agenda/itens.ts.
 */
export async function getAgenda(): Promise<AgendaItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("agenda_do_vendedor")

  if (error) {
    throw new Error(`Falha ao carregar a agenda: ${error.message}`)
  }

  return (data ?? []).map((row: AgendaRow) => mapRow(row))
}

/**
 * AGD-06: contagem de pendentes para o selo do menu. Sai obrigatoriamente
 * da MESMA fonte que `getAgenda()` (a própria `agenda_do_vendedor()`, via
 * `count: 'exact', head: true` — confirmado funcionando nesta versão do
 * supabase-js pelo Plano 14-01) — é isso que impede o selo do menu de
 * discordar da tela. Se alguém trocar esta implementação por uma contagem
 * própria vinda de outra tabela, esse contrato quebra.
 */
export async function getAgendaPendentesCount(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase.rpc("agenda_do_vendedor", undefined, {
    count: "exact",
    head: true,
  })

  if (error) {
    throw new Error(`Falha ao carregar a agenda: ${error.message}`)
  }

  return count ?? 0
}

/**
 * AGD-13 (Fase 21): leitura dos itens JÁ CONCLUÍDOS num período obrigatório
 * — a segunda fonte do calendário, disjunta de `getAgenda()`. Chama
 * `agenda_concluidos_do_vendedor(p_inicio, p_fim)` (migration 0021) com os
 * dois parâmetros de data nos nomes exatos que a migration declara.
 *
 * Reusa o MESMO `mapRow` que `getAgenda()` já usa: as duas leituras
 * devolvem o mesmo conjunto de dez colunas, na mesma ordem — manter dois
 * mapeadores seria a porta de entrada para eles divergirem. NÃO reordena,
 * NÃO filtra e NÃO corta o resultado (sem chamar métodos de
 * ordenação/filtro/slice de array): a ordenação é decidida no SQL, igual à
 * leitura de pendentes.
 *
 * Esta função é o ÚNICO lugar do projeto que marca um item como concluído
 * (`concluido: true`) — `getAgenda()` jamais marca, por isso o campo é
 * opcional em `AgendaItem` (ver lib/agenda/itens.ts).
 *
 * NENHUM filtro manual de responsável ou checagem de papel aqui, pelo
 * mesmo motivo já documentado no cabeçalho deste arquivo:
 * `agenda_concluidos_do_vendedor()` é SECURITY INVOKER e a RLS de
 * clientes/tarefas/visitas já escopou o resultado antes de ele chegar.
 */
export async function getAgendaConcluidos(
  inicio: string,
  fim: string
): Promise<AgendaItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("agenda_concluidos_do_vendedor", {
    p_inicio: inicio,
    p_fim: fim,
  })

  if (error) {
    throw new Error(`Falha ao carregar o histórico da agenda: ${error.message}`)
  }

  return (data ?? []).map((row: AgendaRow) => ({ ...mapRow(row), concluido: true }))
}
