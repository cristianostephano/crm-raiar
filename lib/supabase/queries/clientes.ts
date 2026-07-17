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
  /** Produtos consumidos (multi-value, D-08/D-10 filter + D-02 completeness
   * check) — joined via the cliente_produtos table. */
  produtos: { id: string; nome: string }[]
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
  /** D-02: true when any optional field is blank — precomputed once here by
   * isClienteIncompleto() so the "Incompleto" card badge and the
   * "Incompletos" tab filter always agree (same function, same input). */
  incompleto: boolean
}

/**
 * Fields isClienteIncompleto() reads to decide "cadastro incompleto" (D-02)
 * — a subset of ClienteListItem so callers other than this query module
 * (e.g. a future edit-form save) can reuse the exact same predicate without
 * needing the full row shape.
 */
export type ClienteCompletudeInput = {
  categoria_id: string | null
  contato: string | null
  telefone: string | null
  email: string | null
  numero_de_lojas: number | null
  produtos: { id: string; nome: string }[]
}

/**
 * D-02: a cliente is "incompleto" when ANY optional field is blank —
 * categoria, contato, telefone, email, número de lojas, or produtos
 * consumidos (empty list). Returns false only when every optional field is
 * filled. This is the SINGLE source of truth reused by both the
 * "Incompleto" badge (ClienteCard) and the "Incompletos" tab filter
 * (ClienteToolbar/KanbanBoard) — they read the same precomputed
 * `incompleto` field below, so they can never disagree.
 */
export function isClienteIncompleto(cliente: ClienteCompletudeInput): boolean {
  return (
    !cliente.categoria_id ||
    !cliente.contato ||
    !cliente.telefone ||
    !cliente.email ||
    cliente.numero_de_lojas == null ||
    cliente.produtos.length === 0
  )
}

export type ClientesAgrupadosPorEtapa = Record<EtapaKey, ClienteListItem[]>

/**
 * Full editable shape for the client detail Sheet (CLI-02/CLI-05/CLI-06) —
 * every field ClienteDetailSheet's form needs, including the raw endereço
 * breakdown (cep/rua/numero/complemento) the card-list's ClienteListItem
 * doesn't carry, and `produtoIds` (not `produtos` name+id pairs) since the
 * edit form's multi-select checklist only needs to know which ids are
 * checked.
 */
export type ClienteDetalhe = {
  id: string
  razaoSocial: string
  cep: string
  rua: string
  numero: string
  complemento: string | null
  cidade: string
  estado: string
  responsavel: string
  responsavelNome: string | null
  categoriaId: string | null
  contato: string | null
  telefone: string | null
  email: string | null
  numeroDeLojas: number | null
  produtoIds: string[]
}

type ClienteDetalheRow = {
  id: string
  razao_social: string
  cep: string
  rua: string
  numero: string
  complemento: string | null
  cidade: string
  estado: string
  responsavel: string
  profiles: { nome: string; sobrenome: string } | null
  categoria_id: string | null
  contato: string | null
  telefone: string | null
  email: string | null
  numero_de_lojas: number | null
  cliente_produtos: { produto_id: string }[] | null
}

/**
 * Reads a single cliente for the detail/edit Sheet (T-02-21). RLS on
 * `clientes` (the same `is_supervisor() or responsavel = auth.uid()` SELECT
 * policy from 02-01) is the real boundary here — a Vendedor requesting a
 * non-owned id simply gets no matching row back (`maybeSingle()` resolves to
 * `null`), not an error, so this returns `null` for both "doesn't exist" and
 * "exists but isn't visible to this caller" (never reveals which).
 */
export async function getClienteById(
  id: string
): Promise<ClienteDetalhe | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("clientes")
    .select(
      "id, razao_social, cep, rua, numero, complemento, cidade, estado, responsavel, profiles(nome, sobrenome), categoria_id, contato, telefone, email, numero_de_lojas, cliente_produtos(produto_id)"
    )
    .eq("id", id)
    .maybeSingle()

  if (error || !data) return null

  const row = data as unknown as ClienteDetalheRow

  return {
    id: row.id,
    razaoSocial: row.razao_social,
    cep: row.cep,
    rua: row.rua,
    numero: row.numero,
    complemento: row.complemento,
    cidade: row.cidade,
    estado: row.estado,
    responsavel: row.responsavel,
    responsavelNome: row.profiles
      ? `${row.profiles.nome} ${row.profiles.sobrenome}`
      : null,
    categoriaId: row.categoria_id,
    contato: row.contato,
    telefone: row.telefone,
    email: row.email,
    numeroDeLojas: row.numero_de_lojas,
    produtoIds: (row.cliente_produtos ?? []).map((cp) => cp.produto_id),
  }
}

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
  cliente_produtos: {
    produto_id: string
    produtos_consumidos: { nome: string } | null
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
      "id, razao_social, categoria_id, categorias(nome), responsavel, profiles(nome, sobrenome), etapa, status_acompanhamento, cidade, estado, contato, telefone, email, numero_de_lojas, posicao, etapa_alterada_em, tarefas(concluida, data_conclusao, tipos_tarefa(nome)), cliente_produtos(produto_id, produtos_consumidos(nome))"
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

    const produtos = (row.cliente_produtos ?? [])
      .filter((cp) => cp.produtos_consumidos !== null)
      .map((cp) => ({
        id: cp.produto_id,
        nome: cp.produtos_consumidos!.nome,
      }))

    const completudeInput: ClienteCompletudeInput = {
      categoria_id: row.categoria_id,
      contato: row.contato,
      telefone: row.telefone,
      email: row.email,
      numero_de_lojas: row.numero_de_lojas,
      produtos,
    }

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
      produtos,
      posicao: row.posicao,
      etapa_alterada_em: row.etapa_alterada_em,
      tarefas_abertas: tarefasAbertas,
      isOverdue: reason !== null,
      overdue_tooltip: reason?.label ?? null,
      incompleto: isClienteIncompleto(completudeInput),
    })
  }

  return grouped
}
