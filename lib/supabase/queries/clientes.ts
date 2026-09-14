import {
  isClienteIncompleto,
  type ClienteCompletudeInput,
} from "@/lib/clientes/completude"
import type { DiaSemanaVisita, SemanaDoMesVisita } from "@/lib/funil/diaFixo"
import { ETAPA_KEYS, type EtapaKey } from "@/lib/funil/etapas"
import type { FrequenciaVisita } from "@/lib/funil/frequencia"
import { staleReason, type TarefaAberta } from "@/lib/funil/staleness"
import { buscarPaginado } from "@/lib/supabase/queries/paginacao"
import { createClient } from "@/lib/supabase/server"

// Re-exported so every existing import path (this module used to define
// both symbols directly) keeps working unchanged — see
// lib/clientes/completude.ts's header comment for why the implementation
// moved to a dependency-free module (Client Components need to import the
// runtime function without pulling in next/headers).
export { isClienteIncompleto, type ClienteCompletudeInput }

export type ClienteListItem = {
  id: string
  razao_social: string
  /** Fase 26 Plano 4 (T-26-15): repasse do valor já lido de `clientes` —
   * alimenta lib/clientes/nomeExibicao.ts, a autoridade única do título
   * exibido no cartão/ficha quando razão social vier nula (PROSP-02). */
  nome_fantasia: string | null
  categoria_id: string | null
  categoria_nome: string | null
  responsavel: string
  responsavel_nome: string | null
  etapa: EtapaKey
  status_acompanhamento: "em_andamento" | "perdido" | "ganho"
  /** Nullable since migration 0023 (quick task 260819-m8q, D-01/D-02): a
   * cliente importado sem endereço tem cidade/estado nulos. Never coerced
   * to "" here — lib/clientes/rotuloLocalizacao.ts is the single place that
   * decides how to display absence ("Sem cidade"/"Sem estado", D-03). */
  cidade: string | null
  estado: string | null
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

export type ClientesAgrupadosPorEtapa = Record<EtapaKey, ClienteListItem[]>

/**
 * Full editable shape for the client detail Sheet (CLI-02/CLI-05/CLI-06) —
 * every field ClienteDetailSheet's form needs, including the raw endereço
 * breakdown (cep/rua/numero/complemento) the card-list's ClienteListItem
 * doesn't carry, and `produtoIds` (not `produtos` name+id pairs) since the
 * edit form's multi-select checklist only needs to know which ids are
 * checked.
 */
export type StatusAcompanhamento = "em_andamento" | "perdido" | "ganho"

export type ClienteDetalhe = {
  id: string
  razaoSocial: string
  /** Nullable since migration 0023 (quick task 260819-m8q, D-01/D-02/D-06):
   * a cliente importado sem endereço, ou editado sem preenchê-lo, tem os 5
   * campos abaixo nulos. Never coerced to "" here — the Sheet's own
   * toFormValues() decides the "" fallback for the form field, this layer
   * just reflects the schema. */
  cep: string | null
  rua: string | null
  numero: string | null
  complemento: string | null
  cidade: string | null
  estado: string | null
  responsavel: string
  responsavelNome: string | null
  categoriaId: string | null
  contato: string | null
  telefone: string | null
  email: string | null
  numeroDeLojas: number | null
  produtoIds: string[]
  /** Funil section fields (02-07) — etapa/statusAcompanhamento/motivoPerdaId
   * drive the status Select's current value and the Ganho-disabled-unless-
   * ETAPA_FINAL courtesy (FUN-05); observacao is the free-text field (FUN-07). */
  etapa: EtapaKey
  statusAcompanhamento: StatusAcompanhamento
  motivoPerdaId: string | null
  observacao: string | null
  /** Cadência de pós-venda (VIS-01/VIS-02/ATV-03) — vale para qualquer
   * status, mas só é editável na ficha quando o cliente está ganho. */
  frequenciaVisita: FrequenciaVisita | null
  /** Dia fixo da recorrência de visita (Fase 24, ANCORA-01/ANCORA-02) —
   * colunas novas da migration 0026. Opcionais em TODO cliente hoje (nenhum
   * ainda tem dia fixo gravado); `semanaDoMesVisita` só se aplica quando
   * `frequenciaVisita` é "mensal" (lib/funil/diaFixo.ts é a autoridade de
   * quando cada campo se aplica). */
  diaSemanaVisita: DiaSemanaVisita | null
  semanaDoMesVisita: SemanaDoMesVisita | null
  /** Campos do cliente ativo (ATV-01/ATV-02) — só fazem sentido depois do
   * ganho, mas continuam nulos num cliente ganho antigo como dado histórico
   * esperado, nunca erro (a tela do plano 16-04 não trata isso como estado
   * de erro). `frequenciaPedidos` guarda o nome canônico do vocabulário
   * `frequencias_pedido` (lib/clientes/frequenciaPedido.ts), texto simples
   * sem chave estrangeira (decisão D2). */
  nomeFantasia: string | null
  cnpj: string | null
  frequenciaPedidos: string | null
}

type ClienteDetalheRow = {
  id: string
  razao_social: string
  cep: string | null
  rua: string | null
  numero: string | null
  complemento: string | null
  cidade: string | null
  estado: string | null
  responsavel: string
  profiles: { nome: string; sobrenome: string } | null
  categoria_id: string | null
  contato: string | null
  telefone: string | null
  email: string | null
  numero_de_lojas: number | null
  cliente_produtos: { produto_id: string }[] | null
  etapa: EtapaKey
  status_acompanhamento: StatusAcompanhamento
  motivo_perda_id: string | null
  observacao: string | null
  frequencia_visita: FrequenciaVisita | null
  nome_fantasia: string | null
  cnpj: string | null
  frequencia_pedidos: string | null
  dia_semana_visita: DiaSemanaVisita | null
  semana_do_mes_visita: SemanaDoMesVisita | null
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
      "id, razao_social, cep, rua, numero, complemento, cidade, estado, responsavel, profiles(nome, sobrenome), categoria_id, contato, telefone, email, numero_de_lojas, cliente_produtos(produto_id), etapa, status_acompanhamento, motivo_perda_id, observacao, frequencia_visita, nome_fantasia, cnpj, frequencia_pedidos, dia_semana_visita, semana_do_mes_visita"
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
    etapa: row.etapa,
    statusAcompanhamento: row.status_acompanhamento,
    motivoPerdaId: row.motivo_perda_id,
    observacao: row.observacao,
    frequenciaVisita: row.frequencia_visita,
    nomeFantasia: row.nome_fantasia,
    cnpj: row.cnpj,
    frequenciaPedidos: row.frequencia_pedidos,
    diaSemanaVisita: row.dia_semana_visita,
    semanaDoMesVisita: row.semana_do_mes_visita,
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
  nome_fantasia: string | null
  categoria_id: string | null
  categorias: { nome: string } | null
  responsavel: string
  profiles: { nome: string; sobrenome: string } | null
  etapa: EtapaKey
  status_acompanhamento: "em_andamento" | "perdido" | "ganho"
  cidade: string | null
  estado: string | null
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

  // Leitura paginada (quick task 260914-ng5): a tabela `clientes` passou de
  // 1000 linhas pela primeira vez (2181 hoje), e o PostgREST devolve no
  // máximo 1000 linhas por requisição sem `.range()` explícito — um select
  // direto aqui truncava o Kanban (mostrou "571" em vez de 1752 na etapa
  // "1ª venda concluída"). `.order("id", ...)` entra como desempate de
  // `posicao` (não garantidamente única entre etapas diferentes), garantindo
  // ordem estável entre as chamadas de `.range()` separadas.
  const rows = await buscarPaginado<ClienteRow>(async (inicio, fim) => {
    const { data, error } = await supabase
      .from("clientes")
      .select(
        "id, razao_social, nome_fantasia, categoria_id, categorias(nome), responsavel, profiles(nome, sobrenome), etapa, status_acompanhamento, cidade, estado, contato, telefone, email, numero_de_lojas, posicao, etapa_alterada_em, tarefas(concluida, data_conclusao, tipos_tarefa(nome)), cliente_produtos(produto_id, produtos_consumidos(nome))"
      )
      .order("posicao", { ascending: true })
      .order("id", { ascending: true })
      .range(inicio, fim)

    return { data: data as unknown as ClienteRow[] | null, error }
  })

  if (rows === null) {
    throw new Error(`Falha ao carregar clientes: leitura paginada incompleta`)
  }

  const grouped = Object.fromEntries(
    ETAPA_KEYS.map((key) => [key, [] as ClienteListItem[]])
  ) as ClientesAgrupadosPorEtapa

  const now = new Date()

  for (const row of rows) {
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
      nome_fantasia: row.nome_fantasia,
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

/**
 * Export-shaped cliente row (EXP-01/EXP-02/EXP-03, D-02) — every cadastro
 * field plus the funil fields (etapa/status/observação), camelCase like
 * ClienteDetalhe. `etapa`/`statusAcompanhamento` are kept as raw enum values
 * here; mapping them to pt-BR labels is buildClientesWorkbook's job
 * (lib/clientes/exportacao.ts, 05-01 Task 3), not this query's.
 */
export type ClienteExportRow = {
  razaoSocial: string
  /** Nullable since migration 0023 (quick task 260819-m8q) — an empty cell
   * in the exported sheet is the correct result; buildClientesWorkbook's
   * cell() helper already converts null to "" (05-01), no logic change
   * needed there. */
  cep: string | null
  rua: string | null
  numero: string | null
  complemento: string | null
  cidade: string | null
  estado: string | null
  categoriaNome: string | null
  contato: string | null
  telefone: string | null
  email: string | null
  produtos: string[]
  numeroDeLojas: number | null
  responsavelNome: string | null
  etapa: EtapaKey
  statusAcompanhamento: StatusAcompanhamento
  observacao: string | null
}

/** Raw shape returned by getClientesParaExportacao's embedded-select query. */
type ClienteExportQueryRow = {
  razao_social: string
  cep: string | null
  rua: string | null
  numero: string | null
  complemento: string | null
  cidade: string | null
  estado: string | null
  categorias: { nome: string } | null
  profiles: { nome: string; sobrenome: string } | null
  contato: string | null
  telefone: string | null
  email: string | null
  numero_de_lojas: number | null
  cliente_produtos: {
    produtos_consumidos: { nome: string } | null
  }[] | null
  etapa: EtapaKey
  status_acompanhamento: StatusAcompanhamento
  observacao: string | null
}

/**
 * Export-shaped reader for the "Exportar" download (EXP-01/EXP-02/EXP-03).
 *
 * RLS on `clientes` (`is_supervisor() OR responsavel = auth.uid()`, same
 * policy every other reader in this file relies on) is the ENTIRE
 * authorization boundary here — there is deliberately no `responsavel`
 * filter or `is_supervisor()` branch in this function. A Vendedor's call
 * returns only their own clientes; a Supervisor's call returns every
 * cliente.
 *
 * `ids`, when provided as a non-empty array, layers an additional
 * `.in("id", ids)` on top of RLS to narrow an already-RLS-scoped result to
 * a specific set of rows (D-05's server-side narrowing for EXP-03 — the
 * screen's active search/filter/tab selection). This can only ever narrow
 * what RLS already allows: an id RLS wouldn't otherwise return simply comes
 * back as 0 rows for that id, never an error or a widened result. When
 * `ids` is null/undefined/empty, every RLS-visible row is returned.
 */
const CLIENTE_EXPORT_SELECT =
  "razao_social, cep, rua, numero, complemento, cidade, estado, categorias(nome), profiles(nome, sobrenome), contato, telefone, email, numero_de_lojas, cliente_produtos(produtos_consumidos(nome)), etapa, status_acompanhamento, observacao"

export async function getClientesParaExportacao(
  ids?: string[] | null
): Promise<ClienteExportRow[]> {
  const supabase = await createClient()

  let rows: ClienteExportQueryRow[]

  if (ids && ids.length > 0) {
    // Caminho COM ids: continua exatamente como estava, sem paginação — a
    // tela sempre manda um recorte já filtrado e pequeno, `.in("id", ids)`
    // já basta.
    const { data, error } = await supabase
      .from("clientes")
      .select(CLIENTE_EXPORT_SELECT)
      .in("id", ids)

    if (error) {
      throw new Error(`Falha ao carregar clientes para exportação: ${error.message}`)
    }

    rows = (data ?? []) as unknown as ClienteExportQueryRow[]
  } else {
    // Caminho SEM ids ("exportar tudo", quick task 260914-ng5): a tabela
    // `clientes` passou de 1000 linhas (2181 hoje), e o PostgREST devolve no
    // máximo 1000 por requisição sem `.range()` explícito. `.order("id", ...)`
    // é novo aqui (não havia nenhum `.order()` neste caminho antes) — só para
    // estabilidade de paginação, não muda o formato de saída.
    const rowsPaginadas = await buscarPaginado<ClienteExportQueryRow>(
      async (inicio, fim) => {
        const { data, error } = await supabase
          .from("clientes")
          .select(CLIENTE_EXPORT_SELECT)
          .order("id", { ascending: true })
          .range(inicio, fim)

        return { data: data as unknown as ClienteExportQueryRow[] | null, error }
      }
    )

    if (rowsPaginadas === null) {
      throw new Error(
        `Falha ao carregar clientes para exportação: leitura paginada incompleta`
      )
    }

    rows = rowsPaginadas
  }

  return rows.map((r) => {
    return {
      razaoSocial: r.razao_social,
      cep: r.cep,
      rua: r.rua,
      numero: r.numero,
      complemento: r.complemento,
      cidade: r.cidade,
      estado: r.estado,
      categoriaNome: r.categorias?.nome ?? null,
      contato: r.contato,
      telefone: r.telefone,
      email: r.email,
      produtos: (r.cliente_produtos ?? [])
        .filter((cp) => cp.produtos_consumidos !== null)
        .map((cp) => cp.produtos_consumidos!.nome),
      numeroDeLojas: r.numero_de_lojas,
      responsavelNome: r.profiles
        ? `${r.profiles.nome} ${r.profiles.sobrenome}`
        : null,
      etapa: r.etapa,
      statusAcompanhamento: r.status_acompanhamento,
      observacao: r.observacao,
    }
  })
}

/**
 * Single tarefa row for the Funil section's checklist (FUN-08). RLS on
 * `tarefas` (the parent-cliente EXISTS gate from 02-01) is the real
 * boundary — a Vendedor requesting a non-owned clienteId simply gets an
 * empty array back, same non-revealing posture as getClienteById.
 */
export type Tarefa = {
  id: string
  tipoTarefaId: string
  tipoNome: string
  dataConclusao: string | null
  concluida: boolean
}

type TarefaRow = {
  id: string
  tipo_tarefa_id: string
  data_conclusao: string | null
  concluida: boolean
  tipos_tarefa: { nome: string } | null
}

export async function getTarefas(clienteId: string): Promise<Tarefa[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("tarefas")
    .select("id, tipo_tarefa_id, data_conclusao, concluida, tipos_tarefa(nome)")
    .eq("cliente_id", clienteId)
    .order("criado_em", { ascending: true })

  if (error || !data) return []

  return (data as unknown as TarefaRow[]).map((row) => ({
    id: row.id,
    tipoTarefaId: row.tipo_tarefa_id,
    tipoNome: row.tipos_tarefa?.nome ?? "",
    dataConclusao: row.data_conclusao,
    concluida: row.concluida,
  }))
}

/**
 * Read-only histórico timeline (FUN-10) — newest first. There is
 * deliberately no `insertHistorico`-style write function anywhere in this
 * codebase: only the 02-01 SECURITY DEFINER triggers ever write to
 * `historico` (T-02-25), this is purely a reader.
 */
export type HistoricoEntry = {
  id: string
  descricao: string
  criadoEm: string
}

export async function getHistorico(clienteId: string): Promise<HistoricoEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("historico")
    .select("id, descricao, criado_em")
    .eq("cliente_id", clienteId)
    .order("criado_em", { ascending: false })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    descricao: row.descricao,
    criadoEm: row.criado_em,
  }))
}

/**
 * Read-only "Diário" (DIAR-01) — leitura NOVA e independente do histórico
 * completo acima, e por quê: o histórico continua sendo a trilha inteira
 * (mudança de etapa, mudança de status, conclusões) e continua na tela ao
 * lado, inalterado; o diário é o recorte do que foi de fato executado com o
 * cliente — só tarefa concluída e visita concluída, filtrado NO SQL (nunca
 * trazendo tudo e filtrando depois no navegador). Mesma postura de
 * `getHistorico`: erro ou ausência de dado devolve lista vazia, nunca
 * exceção — o diário não pode derrubar a ficha inteira.
 *
 * Assim como `getHistorico`, não existe (e não pode existir) função de
 * escrita na trilha de auditoria neste arquivo — só os gatilhos SECURITY
 * DEFINER das migrations 0002/0015 escrevem em `historico` (T-02-25).
 *
 * Autorização: ZERO checagem de papel e ZERO filtro de dono aqui — a regra
 * de leitura de `historico` condicionada ao cliente pai (migration 0002,
 * inalterada) é a fronteira INTEIRA do critério de sucesso 4 desta fase. Um
 * Vendedor que chamar isto para um cliente alheio recebe lista vazia (RLS
 * filtra a linha), nunca um filtro de responsavel escrito à mão aqui — duas
 * fontes de verdade que podem divergir é exatamente o que este comentário
 * (mesmo tom do de `getClientesParaExportacao`) existe para evitar.
 *
 * O nome do autor é montado a partir do perfil quando ele existir, e vem
 * NULO quando não existir — esta camada de dados nunca inventa um texto de
 * substituição (decisão de tela, plano 16-04).
 */
export type DiarioEntry = {
  id: string
  tipo: "tarefa_concluida" | "visita_concluida"
  descricao: string
  criadoEm: string
  autorNome: string | null
}

type DiarioEntryRow = {
  id: string
  tipo: string
  descricao: string
  criado_em: string
  profiles: { nome: string; sobrenome: string } | null
}

export async function getDiario(clienteId: string): Promise<DiarioEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("historico")
    .select("id, tipo, descricao, criado_em, profiles(nome, sobrenome)")
    .eq("cliente_id", clienteId)
    .in("tipo", ["tarefa_concluida", "visita_concluida"])
    .order("criado_em", { ascending: false })

  if (error || !data) return []

  return (data as unknown as DiarioEntryRow[]).map((row) => ({
    id: row.id,
    tipo: row.tipo as DiarioEntry["tipo"],
    descricao: row.descricao,
    criadoEm: row.criado_em,
    autorNome: row.profiles
      ? `${row.profiles.nome} ${row.profiles.sobrenome}`
      : null,
  }))
}

/**
 * Export-shaped diário row (IMP-02, plano 17-02) — irmã de `DiarioEntry`
 * acima, mas de escopo diferente: `getDiario` lê UM cliente só, para a
 * ficha; esta lê TUDO que o chamador enxerga, para download. Razão social e
 * responsável do cliente entram aqui porque a planilha agrega vários
 * clientes de uma vez (a ficha não precisa disso — já está dentro do
 * cliente).
 */
export type DiarioExportRow = {
  razaoSocial: string
  responsavelNome: string | null
  tipo: "tarefa_concluida" | "visita_concluida"
  descricao: string
  criadoEm: string
  autorNome: string | null
}

/**
 * Raw shape returned by getDiarioParaExportacao's embedded-select query.
 * `historico` e `clientes` cada uma tem uma ligação com `profiles`, então o
 * autor da entrada precisa vir apelidado ("autor") para não colidir com o
 * `profiles` aninhado dentro de `clientes` — mesma postura do plano 16-03.
 */
type DiarioExportQueryRow = {
  descricao: string
  tipo: string
  criado_em: string
  clientes: {
    razao_social: string
    profiles: { nome: string; sobrenome: string } | null
  } | null
  autor: { nome: string; sobrenome: string } | null
}

/**
 * Leitura do diário para exportação (IMP-02, critério de sucesso 5) — irmã
 * de `getDiario`, mas SEM parâmetro nenhum de propósito (D3, 17-UI-SPEC.md):
 * o filtro de vendedor ativo na tela de Agenda não deve atravessar para a
 * exportação. Sem parâmetro, não existe caminho pelo qual um chamador possa
 * tentar ampliar o escopo nem pelo qual o filtro da tela possa vazar para o
 * servidor.
 *
 * Autorização: ZERO checagem de papel e ZERO filtro de dono aqui — a regra
 * de leitura de `historico` condicionada ao cliente pai (migration 0002,
 * inalterada) é a fronteira INTEIRA do critério de sucesso 5. Um Vendedor
 * recebe só as conclusões dos próprios clientes; um Supervisor recebe as de
 * todo o time — de graça, sem uma linha de checagem escrita à mão aqui (o
 * mesmo comentário que já vale para `getClientesParaExportacao`).
 *
 * Diferente de `getDiario` (que devolve lista vazia em erro, porque alimenta
 * uma seção de ficha que não pode derrubar a tela), esta função LANÇA em
 * erro — mesma postura de `getClientesParaExportacao`, chamada de dentro de
 * uma rota que já trata exceção.
 */
export async function getDiarioParaExportacao(): Promise<DiarioExportRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("historico")
    .select(
      "descricao, tipo, criado_em, clientes(razao_social, profiles(nome, sobrenome)), autor:profiles!historico_autor_id_fkey(nome, sobrenome)"
    )
    .in("tipo", ["tarefa_concluida", "visita_concluida"])
    .order("criado_em", { ascending: false })

  if (error) {
    throw new Error(`Falha ao carregar diário para exportação: ${error.message}`)
  }

  return (data ?? []).map((row) => {
    const r = row as unknown as DiarioExportQueryRow

    return {
      razaoSocial: r.clientes?.razao_social ?? "",
      responsavelNome: r.clientes?.profiles
        ? `${r.clientes.profiles.nome} ${r.clientes.profiles.sobrenome}`
        : null,
      tipo: r.tipo as DiarioExportRow["tipo"],
      descricao: r.descricao,
      criadoEm: r.criado_em,
      autorNome: r.autor
        ? `${r.autor.nome} ${r.autor.sobrenome}`
        : null,
    }
  })
}

/** Lookup-table option shape shared by tipos_tarefa/motivos_perda selects. */
export type LookupOption = { id: string; nome: string }

/**
 * Full active tipos_tarefa catalog, for the "+ Adicionar tarefa" tipo
 * Select (FUN-08). Unlike categoria/produto/vendedor options elsewhere in
 * this phase, tipos_tarefa never appears in the already-loaded kanban card
 * set (only OPEN tarefas' tipo name is embedded there), so this is a real
 * full-catalog lookup — read-open to every authenticated user per the 02-01
 * RLS policy.
 */
export async function getTiposTarefaAtivos(): Promise<LookupOption[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("tipos_tarefa")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true })

  if (error || !data) return []
  return data
}

/**
 * Full active motivos_perda catalog, for PerdaMotivoDialog's required
 * "Motivo da perda" Select (FUN-06) — same full-catalog-lookup reasoning as
 * getTiposTarefaAtivos above.
 */
export async function getMotivosPerdaAtivos(): Promise<LookupOption[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("motivos_perda")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true })

  if (error || !data) return []
  return data
}

/**
 * Full active motivos_conclusao_remota catalog (6ª lista editável, Fase 22,
 * migration 0022) — irmã literal de getMotivosPerdaAtivos acima. Alimenta o
 * campo de escolha de motivo do diálogo de conclusão remota da Agenda
 * (CONC-03, plano 22-03). Filtra por ativo de propósito: um motivo
 * desativado pelo Supervisor não pode mais ser escolhido para uma nova
 * conclusão — mas continua aparecendo no Diário das conclusões já
 * gravadas, porque aquele texto é retrato congelado (D-04).
 */
export async function getMotivosConclusaoRemotaAtivos(): Promise<
  LookupOption[]
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("motivos_conclusao_remota")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true })

  if (error || !data) return []
  return data
}

/**
 * Full active categorias catalog, for the categoria Select in the client
 * create/edit forms and the Filtros popover (CLI-02/D-08). Bugfix: this used
 * to be derived from the already-loaded kanban card set (categoria_id/nome
 * of clientes currently visible), which meant a brand-new cliente — or any
 * categoria not yet assigned to a visible cliente — could never be selected
 * (chicken-and-egg). Same full-catalog-lookup pattern as
 * getTiposTarefaAtivos/getMotivosPerdaAtivos above; read-open to every
 * authenticated user per the 02-01 RLS policy.
 */
export async function getCategoriasAtivas(): Promise<LookupOption[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("categorias")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true })

  if (error || !data) return []
  return data
}

/**
 * Full active produtos_consumidos catalog — same bugfix rationale and
 * pattern as getCategoriasAtivas above, for the "Produtos consumidos"
 * checklist in the client create/edit forms and the Filtros popover.
 */
export async function getProdutosAtivos(): Promise<LookupOption[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("produtos_consumidos")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true })

  if (error || !data) return []
  return data
}

/**
 * Full active frequencias_pedido catalog — irmã literal de
 * getTiposTarefaAtivos/getCategoriasAtivas/getProdutosAtivos acima.
 * Alimenta o campo de escolha "Frequência de pedidos" na ficha do cliente
 * ativo (ATV-02, plano 16-04). Devolve SÓ os valores ativos, de propósito:
 * um valor desativado pelo Supervisor não pode mais ser escolhido para um
 * cliente novo.
 *
 * IMPORTANTE para quem vier depois: a VALIDAÇÃO do valor enviado (plano
 * 16-03) NÃO pode usar este leitor — um cliente que já tenha guardado um
 * valor desde então desativado precisa continuar conseguindo salvar a
 * ficha, então a validação usa uma leitura do catálogo completo (ativos +
 * inativos), não este. Confundir os dois é o defeito mais provável desta
 * área.
 */
export async function getFrequenciasPedidoAtivas(): Promise<LookupOption[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("frequencias_pedido")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true })

  if (error || !data) return []
  return data
}
