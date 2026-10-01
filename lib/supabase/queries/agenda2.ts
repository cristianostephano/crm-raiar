import { addDays } from "date-fns"

import { chaveDoDia } from "@/lib/agenda/itens"
import type { Agenda2Item } from "@/lib/agenda2/itens"
import { buscarPaginado } from "@/lib/supabase/queries/paginacao"
import { createClient } from "@/lib/supabase/server"

/**
 * Leitura direta de tabela (sem RPC — Pattern 2 da pesquisa, 31-RESEARCH.md)
 * da Agenda 2 (Fase 31, AGD2-01/03/05/07). Duas funções:
 *
 * - `getAgenda2()`: lê a Lista. NENHUM filtro de dono aqui — a RLS da
 *   migration 0048 já escopa o resultado (vendedor vê os próprios itens,
 *   Supervisor vê o time inteiro; AGD2-07). A ordem é decidida só no SQL
 *   (data, criação, id como desempate — D-08), nunca reordenada aqui. O
 *   corte de leitura (`.or(...)` abaixo) é deliberadamente FOLGADO — só para
 *   não baixar o histórico inteiro a cada abertura (custo/egress, free
 *   tier) — quem decide o que de fato aparece na tela é
 *   `visivelNaListaAgenda2` (lib/agenda2/itens.ts, correção 7 do
 *   31-01-PLAN.md), não esta leitura.
 *
 * - `getAgenda2PendentesCount()`: contagem do selo do menu. DIVERGÊNCIA
 *   DELIBERADA de `getAgendaPendentesCount()` (lib/supabase/queries/agenda.ts):
 *   aqui o filtro por dono é EXPLÍCITO (`.eq("vendedor_id", user.id)`)
 *   porque a RLS de leitura desta tabela é mais ampla (dono OU Supervisor).
 *   Sem esse filtro explícito, o selo de um Supervisor mostraria o total do
 *   time inteiro em vez de zero (Pitfall 2 da pesquisa, D-13).
 *
 * `criado_em` não é lido em `getAgenda2()` — minimização (LGPD): a tela não
 * usa esse campo, só o SQL (para desempate de ordenação).
 *
 * Nenhuma checagem de papel em nenhuma das duas funções, e nenhum `.rpc(`
 * neste arquivo — a RLS é a única fronteira de autorização (CLAUDE.md).
 */

type Agenda2Row = {
  id: string
  vendedor_id: string
  nome_cliente: string
  bairro: string
  data: string
  concluido: boolean
  atualizado_em: string
  profiles: { nome: string; sobrenome: string } | null
}

function mapRow(row: Agenda2Row): Agenda2Item {
  return {
    id: row.id,
    nomeCliente: row.nome_cliente,
    bairro: row.bairro,
    data: row.data,
    concluido: row.concluido,
    atualizadoEm: row.atualizado_em,
    responsavel: row.vendedor_id,
    responsavelNome: row.profiles
      ? `${row.profiles.nome} ${row.profiles.sobrenome}`
      : null,
  }
}

/**
 * AGD2-01/AGD2-07: leitura da Lista da Agenda 2. NÃO filtra por dono (a RLS
 * decide), NÃO reordena e NÃO corta o resultado além do limite folgado
 * aplicado no próprio SQL (correção 7 do 31-01-PLAN.md).
 */
export async function getAgenda2(now: Date = new Date()): Promise<Agenda2Item[]> {
  const supabase = await createClient()

  const limiteData = chaveDoDia(addDays(now, -1))
  const limiteInstante = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const filtroRecente =
    `concluido.eq.false,data.gte.${limiteData},atualizado_em.gte.${limiteInstante}`

  const rows = await buscarPaginado<Agenda2Row>(async (inicio, fim) => {
    const { data, error } = await supabase
      .from("agenda2_itens")
      .select(
        "id, vendedor_id, nome_cliente, bairro, data, concluido, atualizado_em, profiles(nome, sobrenome)"
      )
      .or(filtroRecente)
      .order("data", { ascending: true })
      .order("criado_em", { ascending: true })
      .order("id", { ascending: true })
      .range(inicio, fim)

    return { data: data as unknown as Agenda2Row[] | null, error }
  })

  if (rows === null) {
    throw new Error("Falha ao carregar a Agenda 2: leitura paginada incompleta")
  }

  return rows.map((row) => mapRow(row))
}

/**
 * D-13 (Pitfalls 2-3 da pesquisa): contagem de pendentes do PRÓPRIO usuário
 * para o selo do menu — filtro de dono e de pendência sempre explícitos,
 * nunca implícitos via RLS (ver cabeçalho do arquivo).
 */
export async function getAgenda2PendentesCount(): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return 0

  const { count, error } = await supabase
    .from("agenda2_itens")
    .select("id", { count: "exact", head: true })
    .eq("vendedor_id", user.id)
    .eq("concluido", false)

  if (error) {
    throw new Error(`Falha ao carregar a Agenda 2: ${error.message}`)
  }

  return count ?? 0
}
