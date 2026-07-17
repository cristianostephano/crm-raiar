import { ETAPA_KEYS, type EtapaKey } from "@/lib/funil/etapas"
import { staleReason, type TarefaAberta } from "@/lib/funil/staleness"
import { createClient } from "@/lib/supabase/server"

export type ClienteListItem = {
  id: string
  razao_social: string
  categoria_id: string | null
  categoria_nome: string | null
  responsavel: string
  responsavel_nome: string | null
  etapa: EtapaKey
  status_acompanhamento: "em_andamento" | "perdido" | "ganho"
  cidade: string
  estado: string
  contato: string | null
  telefone: string | null
  email: string | null
  numero_de_lojas: number | null
  /** Fractional card-ordering value (Pitfall 5) — needed client-side by the
   * 02-04 drag handler to compute the single new midpoint position on drop,
   * never renumbering the whole column. */
  posicao: number
  /** ISO timestamp of the last stage change — feeds lib/funil/staleness.ts's
   * "parado" calculation (FUN-09), and is recomputed client-side after an
   * optimistic drag (the trigger resets it to now() on a real etapa move). */
  etapa_alterada_em: string
  /** Open (not concluída) tarefas only — everything staleReason() needs to
   * detect an overdue task (FUN-09), fetched once here so the highlight is
   * visible on first render with no extra round-trip. */
  tarefas_abertas: TarefaAberta[]
  isOverdue: boolean
  overdue_tooltip: string | null
}

export type ClientesAgrupadosPorEtapa = Record<EtapaKey, ClienteListItem[]>

/**
 * Raw shape returned by the embedded-select query below — `categorias`/
 * `profiles` are to-one embeds (each FK lives on `clientes` itself), so
 * PostgREST returns a single nested object, never an array, per relationship.
 */
type ClienteRow = {
  id: string
  razao_social: string
  categoria_id: string | null
  categorias: { nome: string } | null
  responsavel: string
  profiles: { nome: string; sobrenome: string } | null
  etapa: EtapaKey
  status_acompanhamento: "em_andamento" | "perdido" | "ganho"
  cidade: string
  estado: string
  contato: string | null
  telefone: string | null
  email: string | null
  numero_de_lojas: number | null
  posicao: number
  etapa_alterada_em: string
  tarefas: {
    concluida: boolean
    data_conclusao: string | null
    tipos_tarefa: { nome: string } | null
  }[] | null
}

/**
 * Server-side reader grouping every cliente visible to the caller by funil
 * stage, using the fixed ETAPA_KEYS order from lib/funil/etapas.ts.
 *
 * RLS on `clientes` (T-02-09) scopes which rows come back automatically — a
 * Vendedor's query returns only their own clientes, a Supervisor's returns
 * every cliente — with NO manual `responsavel` filter in this function. That
 * would be redundant with (and a risk of drifting from) the real
 * authorization boundary already enforced by the 02-01 SELECT policy.
 *
 * The selected columns include everything the client-list card needs
 * (razão social, categoria, responsável, cidade/estado — joined via the
 * to-one `categorias`/`profiles` embeds so ClienteCard never needs a
 * separate lookup) plus the fields used to detect an incomplete cadastro
 * (D-02: categoria_id/contato/telefone/email/numero_de_lojas blank ->
 * "Incompleto" badge in a later plan).
 */
export async function getClientesAgrupadosPorEtapa(): Promise<ClientesAgrupadosPorEtapa> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("clientes")
    .select(
      "id, razao_social, categoria_id, categorias(nome), responsavel, profiles(nome, sobrenome), etapa, status_acompanhamento, cidade, estado, contato, telefone, email, numero_de_lojas, posicao, etapa_alterada_em, tarefas(concluida, data_conclusao, tipos_tarefa(nome))"
    )
    .order("posicao", { ascending: true })

  if (error) {
    throw new Error(`Falha ao carregar clientes: ${error.message}`)
  }

  const grouped = Object.fromEntries(
    ETAPA_KEYS.map((key) => [key, [] as ClienteListItem[]])
  ) as ClientesAgrupadosPorEtapa

  const now = new Date()

  for (const row of (data ?? []) as unknown as ClienteRow[]) {
    const key = row.etapa

    const tarefasAbertas: TarefaAberta[] = (row.tarefas ?? [])
      .filter((tarefa) => !tarefa.concluida)
      .map((tarefa) => ({
        concluida: tarefa.concluida,
        dataConclusao: tarefa.data_conclusao,
        tipoNome: tarefa.tipos_tarefa?.nome ?? "",
      }))

    const reason = staleReason(
      { etapaAlteradaEm: row.etapa_alterada_em },
      tarefasAbertas,
      now
    )

    grouped[key].push({
      id: row.id,
      razao_social: row.razao_social,
      categoria_id: row.categoria_id,
      categoria_nome: row.categorias?.nome ?? null,
      responsavel: row.responsavel,
      responsavel_nome: row.profiles
        ? `${row.profiles.nome} ${row.profiles.sobrenome}`
        : null,
      etapa: row.etapa,
      status_acompanhamento: row.status_acompanhamento,
      cidade: row.cidade,
      estado: row.estado,
      contato: row.contato,
      telefone: row.telefone,
      email: row.email,
      numero_de_lojas: row.numero_de_lojas,
      posicao: row.posicao,
      etapa_alterada_em: row.etapa_alterada_em,
      tarefas_abertas: tarefasAbertas,
      isOverdue: reason !== null,
      overdue_tooltip: reason?.label ?? null,
    })
  }

  return grouped
}
