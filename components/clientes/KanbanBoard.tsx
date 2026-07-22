"use client"

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMemo, useState, type HTMLAttributes, type ReactNode } from "react"

import { moverCard } from "@/app/actions/funil"
import { ClienteCard, type ClienteCardData } from "@/components/clientes/ClienteCard"
import { ClienteDetailSheet } from "@/components/clientes/ClienteDetailSheet"
import {
  ClienteToolbar,
  type SortOption,
  type TabOption,
} from "@/components/clientes/ClienteToolbar"
import {
  clienteAtendeFiltros,
  contarFiltrosAtivos,
  FILTROS_VAZIOS,
  type ClienteFiltros,
} from "@/components/clientes/FiltersPopover"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  isClienteIncompleto,
  type ClienteCompletudeInput,
} from "@/lib/clientes/completude"
import { ETAPAS, ETAPA_KEYS, type EtapaKey } from "@/lib/funil/etapas"
import { diasParado, staleReason, taskStatus } from "@/lib/funil/staleness"
import type { UpdateClienteInput } from "@/lib/validations/cliente"
import type {
  ClienteListItem,
  ClientesAgrupadosPorEtapa,
  LookupOption,
} from "@/lib/supabase/queries/clientes"

/**
 * The 7-column compact kanban board (D-05) — the primary /clientes screen.
 * Columns are derived strictly from ETAPAS (lib/funil/etapas.ts), never a
 * hardcoded stage list, so column order/labels stay a single source of truth
 * shared with the `etapa_funil` Postgres enum.
 *
 * Interactive since 02-04: dnd-kit DndContext wraps the whole board, each
 * column is a droppable (useDroppable) and each ClienteCard a sortable drag
 * item (useSortable). A drop optimistically re-arranges local state, calls
 * moverCard() over the mover_card_funil RPC, and rolls back on any error
 * (FUN-02/FUN-03).
 */

/**
 * Computes a single fractional midpoint position for the moved card
 * (research/PITFALLS.md Pitfall 5) — a drag only ever writes ONE row, never
 * a renumber cascade across the column. Falls back to a now-epoch value
 * (matching the `clientes.posicao` column's own default) when dropped into
 * an empty column.
 */
function computeNovaPosicao(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return Date.now() / 1000
  if (before === undefined) return after! - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}

/**
 * "Ordenar por" (Claude's discretion on exact semantics, UI-SPEC copy only):
 * "recentes" leaves the list in its natural drag-managed order (posicao
 * ascending, i.e. does nothing here — the caller simply doesn't re-sort);
 * "az" is alphabetical by razão social; "parado" surfaces the
 * longest-stalled cards first using the same diasParado() the FUN-09
 * highlight already uses, so the two never disagree on "how stalled".
 */
function sortClientes(
  list: ClienteListItem[],
  sortBy: SortOption,
  now: Date
): ClienteListItem[] {
  if (sortBy === "az") {
    return [...list].sort((a, b) =>
      a.razao_social.localeCompare(b.razao_social, "pt-BR")
    )
  }
  if (sortBy === "parado") {
    return [...list].sort(
      (a, b) =>
        diasParado(b.etapa_alterada_em, now) -
        diasParado(a.etapa_alterada_em, now)
    )
  }
  return list
}

function findEtapaDoCartao(
  grouped: ClientesAgrupadosPorEtapa,
  clienteId: string
): EtapaKey | null {
  for (const key of ETAPA_KEYS) {
    if (grouped[key].some((cliente) => cliente.id === clienteId)) return key
  }
  return null
}

function toCardData(cliente: ClienteListItem): ClienteCardData {
  return {
    id: cliente.id,
    razaoSocial: cliente.razao_social,
    categoriaNome: cliente.categoria_nome,
    responsavelNome: cliente.responsavel_nome,
    etapa: cliente.etapa,
    statusAcompanhamento: cliente.status_acompanhamento,
    cidade: cliente.cidade,
    estado: cliente.estado,
    telefone: cliente.telefone,
    taskStatus: taskStatus(cliente.tarefas_abertas),
  }
}

function DraggableClienteCard({
  cliente,
  showResponsavel,
  onOpen,
}: {
  cliente: ClienteListItem
  showResponsavel: boolean
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cliente.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <ClienteCard
        cliente={toCardData(cliente)}
        showResponsavel={showResponsavel}
        incompleto={cliente.incompleto}
        isOverdue={cliente.isOverdue}
        overdueTooltip={cliente.overdue_tooltip ?? undefined}
        onOpen={onOpen}
        dragHandleProps={
          { ...attributes, ...listeners } as HTMLAttributes<HTMLDivElement>
        }
      />
    </div>
  )
}

/**
 * Plain (non-draggable) card used whenever the board isn't showing every
 * card in its natural posicao order — search/filters/the "Incompletos" tab
 * narrow which cards are visible per column, and a non-"recentes" sort
 * re-orders them. In either case, a drag's fractional-midpoint math
 * (computeNovaPosicao, handleDragEnd) would compute a position relative to
 * the wrong neighbors (a hidden card, or a neighbor from a different sort
 * order than the true manual order) — so dragging is disabled instead of
 * silently corrupting card order. Dragging resumes once "Todos" + "Mais
 * recentes" + no active search/filters is restored (see `dragDisabled`
 * below).
 */
function StaticClienteCard({
  cliente,
  showResponsavel,
  onOpen,
}: {
  cliente: ClienteListItem
  showResponsavel: boolean
  onOpen: () => void
}) {
  return (
    <ClienteCard
      cliente={toCardData(cliente)}
      showResponsavel={showResponsavel}
      incompleto={cliente.incompleto}
      isOverdue={cliente.isOverdue}
      overdueTooltip={cliente.overdue_tooltip ?? undefined}
      onOpen={onOpen}
    />
  )
}

/** Column body is its own droppable target (id = etapa key) so dropping into
 * empty space in a column — not directly onto another card — still resolves
 * to that column. */
function DroppableColumn({
  etapaKey,
  children,
}: {
  etapaKey: EtapaKey
  children: ReactNode
}) {
  const { setNodeRef } = useDroppable({ id: etapaKey })
  return (
    <div ref={setNodeRef} className="flex min-h-10 flex-col gap-2">
      {children}
    </div>
  )
}

export function KanbanBoard({
  grouped: initialGrouped,
  callerRole,
  categoriaOptions,
  produtoOptions,
}: {
  grouped: ClientesAgrupadosPorEtapa
  callerRole: "supervisor" | "vendedor"
  /** Full active categorias/produtos_consumidos catalogs (bugfix, real
   * lookup-table queries — see getCategoriasAtivas/getProdutosAtivos), NOT
   * derived from the already-loaded card set: a brand-new cliente (or any
   * categoria/produto not yet assigned to a visible cliente) must still be
   * selectable in the create/edit forms and the Filtros popover. */
  categoriaOptions: LookupOption[]
  produtoOptions: LookupOption[]
}) {
  const showResponsavel = callerRole === "supervisor"
  const [grouped, setGrouped] = useState(initialGrouped)
  const [toast, setToast] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  // 02-06: card click (never drag, see ClienteCard's onOpen/dragHandleProps
  // split) opens the detail Sheet for this cliente.
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(
    null
  )
  const [sheetOpen, setSheetOpen] = useState(false)

  // D-07/D-08/D-09/D-01: search/filter/sort/tab state lives here, applied
  // in-memory over the already-loaded `grouped` set (Pitfall 7) — none of
  // these ever trigger a new getClientesAgrupadosPorEtapa() call.
  const [searchQuery, setSearchQuery] = useState("")
  const [filtros, setFiltros] = useState<ClienteFiltros>(FILTROS_VAZIOS)
  const [sortBy, setSortBy] = useState<SortOption>("recentes")
  const [activeTab, setActiveTab] = useState<TabOption>("todos")

  const todosOsClientes = useMemo(
    () => ETAPA_KEYS.flatMap((key) => grouped[key]),
    [grouped]
  )

  // estadoOptions/vendedorOptions are still derived from the already-loaded
  // card set (Pitfall 7) — unlike categoria/produto, there is no separate
  // full-catalog lookup table for "estado" (free-text field on clientes)
  // or "vendedor" (a Supervisor's own team, already fully represented in
  // teamMembers elsewhere but not threaded here), and both are only ever
  // useful as filter values that already appear on a visible cliente.
  const estadoOptions = useMemo(() => {
    const set = new Set<string>()
    for (const cliente of todosOsClientes) {
      if (cliente.estado) set.add(cliente.estado)
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"))
  }, [todosOsClientes])

  // Supervisor-only (D-09) — the toolbar never renders this option list for
  // a Vendedor, but computing it is harmless either way (a Vendedor's own
  // `grouped` set only ever contains their own clientes, T-02-16).
  const vendedorOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const cliente of todosOsClientes) {
      if (cliente.responsavel_nome) {
        map.set(cliente.responsavel, cliente.responsavel_nome)
      }
    }
    return [...map.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  }, [todosOsClientes])

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filtrosAtivos = contarFiltrosAtivos(filtros)
  const hasActiveFilters =
    normalizedSearch !== "" || filtrosAtivos > 0 || activeTab === "incompletos"
  // Dragging is only safe when the rendered order exactly matches
  // `grouped`'s own posicao-ascending order — i.e. nothing is narrowing
  // (search/filtros/Incompletos) or re-sorting the visible set. Otherwise
  // computeNovaPosicao/handleDragEnd would compute a position against the
  // wrong neighbors (see StaticClienteCard's doc comment).
  const dragDisabled = hasActiveFilters || sortBy !== "recentes"

  const filteredGrouped = useMemo(() => {
    const now = new Date()
    const result = {} as ClientesAgrupadosPorEtapa
    for (const key of ETAPA_KEYS) {
      let list = grouped[key]
      if (activeTab === "incompletos") {
        list = list.filter((cliente) => cliente.incompleto)
      }
      if (normalizedSearch) {
        list = list.filter((cliente) =>
          cliente.razao_social.toLowerCase().includes(normalizedSearch)
        )
      }
      if (filtrosAtivos > 0) {
        list = list.filter((cliente) => clienteAtendeFiltros(cliente, filtros))
      }
      result[key] = sortClientes(list, sortBy, now)
    }
    return result
  }, [grouped, activeTab, normalizedSearch, filtrosAtivos, filtros, sortBy])

  const totalFiltrado = ETAPA_KEYS.reduce(
    (sum, key) => sum + filteredGrouped[key].length,
    0
  )

  function limparFiltrosEBusca() {
    setSearchQuery("")
    setFiltros(FILTROS_VAZIOS)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text })
    window.setTimeout(() => setToast(null), 4000)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    const sourceEtapa = findEtapaDoCartao(grouped, activeId)
    if (!sourceEtapa) return

    const isColumnDrop = (ETAPA_KEYS as readonly string[]).includes(overId)
    const targetEtapa = isColumnDrop
      ? (overId as EtapaKey)
      : findEtapaDoCartao(grouped, overId)
    if (!targetEtapa) return

    const previousGrouped = grouped

    const moving = grouped[sourceEtapa].find((c) => c.id === activeId)
    if (!moving) return

    const sourceListWithoutMoving = grouped[sourceEtapa].filter(
      (c) => c.id !== activeId
    )
    const targetListWithoutMoving =
      sourceEtapa === targetEtapa
        ? sourceListWithoutMoving
        : grouped[targetEtapa]

    const targetIndex = isColumnDrop
      ? targetListWithoutMoving.length
      : Math.max(
          targetListWithoutMoving.findIndex((c) => c.id === overId),
          0
        )

    const before = targetListWithoutMoving[targetIndex - 1]?.posicao
    const after = targetListWithoutMoving[targetIndex]?.posicao
    const novaPosicao = computeNovaPosicao(before, after)

    // A real stage move resets etapa_alterada_em to now (mirrors the
    // clientes_before_update trigger), so the "parado" highlight recomputes
    // immediately instead of showing stale data until the next full reload —
    // an overdue open tarefa can still keep the highlight on regardless.
    const etapaAlteradaEm =
      sourceEtapa === targetEtapa
        ? moving.etapa_alterada_em
        : new Date().toISOString()
    const reason = staleReason(
      { etapaAlteradaEm },
      moving.tarefas_abertas,
      new Date()
    )

    const movedCliente: ClienteListItem = {
      ...moving,
      etapa: targetEtapa,
      posicao: novaPosicao,
      etapa_alterada_em: etapaAlteradaEm,
      isOverdue: reason !== null,
      overdue_tooltip: reason?.label ?? null,
    }

    const newTargetList = [...targetListWithoutMoving]
    newTargetList.splice(targetIndex, 0, movedCliente)

    setGrouped({
      ...grouped,
      [sourceEtapa]: sourceEtapa === targetEtapa ? newTargetList : sourceListWithoutMoving,
      [targetEtapa]: newTargetList,
    })

    const result = await moverCard(activeId, targetEtapa, novaPosicao)

    if (result.error) {
      setGrouped(previousGrouped)
      showToast("error", result.error.message)
      return
    }

    const etapaLabel =
      ETAPAS.find((e) => e.key === targetEtapa)?.label ?? targetEtapa
    showToast("success", `Card movido para "${etapaLabel}".`)
  }

  function handleOpenCliente(clienteId: string) {
    setSelectedClienteId(clienteId)
    setSheetOpen(true)
  }

  /**
   * Patches the edited cliente's card in-place from the Sheet's own
   * submitted values — mirrors handleDragEnd's local-state-first approach
   * rather than a full router.refresh() round-trip. categoria_nome/produtos
   * are re-resolved from the same categoriaOptions/produtoOptions lookup
   * lists the Sheet was given (the full active catalogs, not derived from
   * `grouped`), and `incompleto` is recomputed via the single shared
   * isClienteIncompleto() predicate (02-05) so the "Incompleto" badge/tab
   * never drifts from what was just saved.
   */
  function handleClienteSaved(values: UpdateClienteInput) {
    setGrouped((prev) => {
      const etapaKey = findEtapaDoCartao(prev, values.id)
      if (!etapaKey) return prev

      const existing = prev[etapaKey].find((c) => c.id === values.id)
      if (!existing) return prev

      const categoriaNome = values.categoriaId
        ? (categoriaOptions.find((c) => c.id === values.categoriaId)?.nome ??
          null)
        : null

      const produtos = (values.produtoIds ?? [])
        .map((produtoId) => produtoOptions.find((p) => p.id === produtoId))
        .filter((p): p is { id: string; nome: string } => Boolean(p))

      const responsavelNome =
        vendedorOptions.find((v) => v.id === values.responsavel)?.nome ??
        existing.responsavel_nome

      const completudeInput: ClienteCompletudeInput = {
        categoria_id: values.categoriaId || null,
        contato: values.contato || null,
        telefone: values.telefone || null,
        email: values.email || null,
        numero_de_lojas: values.numeroDeLojas ?? null,
        produtos,
      }

      const updatedCliente: ClienteListItem = {
        ...existing,
        razao_social: values.razaoSocial,
        categoria_id: values.categoriaId || null,
        categoria_nome: categoriaNome,
        responsavel: values.responsavel,
        responsavel_nome: responsavelNome,
        cidade: values.cidade,
        estado: values.estado,
        contato: values.contato || null,
        telefone: values.telefone || null,
        email: values.email || null,
        numero_de_lojas: values.numeroDeLojas ?? null,
        produtos,
        incompleto: isClienteIncompleto(completudeInput),
      }

      return {
        ...prev,
        [etapaKey]: prev[etapaKey].map((c) =>
          c.id === values.id ? updatedCliente : c
        ),
      }
    })
  }

  function handleClienteDeleted(clienteId: string) {
    setGrouped((prev) => {
      const etapaKey = findEtapaDoCartao(prev, clienteId)
      if (!etapaKey) return prev
      return {
        ...prev,
        [etapaKey]: prev[etapaKey].filter((c) => c.id !== clienteId),
      }
    })
  }

  return (
    <div className="relative flex flex-1 flex-col gap-4">
      <ClienteToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        filtros={filtros}
        onFiltrosApply={setFiltros}
        onFiltrosClear={() => setFiltros(FILTROS_VAZIOS)}
        categoriaOptions={categoriaOptions}
        produtoOptions={produtoOptions}
        estadoOptions={estadoOptions}
        vendedorOptions={vendedorOptions}
        isSupervisor={showResponsavel}
      />

      {totalFiltrado === 0 ? (
        activeTab === "incompletos" &&
        normalizedSearch === "" &&
        filtrosAtivos === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-base font-semibold">
              Nenhum cadastro incompleto! Todos os clientes estão com os
              dados completos.
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-base font-semibold">
              Nenhum cliente encontrado com esses filtros.
            </p>
            <Button
              type="button"
              variant="link"
              onClick={limparFiltrosEBusca}
            >
              Limpar filtros
            </Button>
          </div>
        )
      ) : dragDisabled ? (
        <div className="flex flex-1 gap-4 overflow-x-auto pb-2">
          {ETAPAS.map((etapa) => {
            const clientes = filteredGrouped[etapa.key]

            return (
              <div
                key={etapa.key}
                className="flex w-[280px] shrink-0 flex-col gap-2"
              >
                <div className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2">
                  <h2 className="text-base leading-tight font-semibold">
                    {etapa.label}
                  </h2>
                  <Badge variant="outline" className="shrink-0">
                    {clientes.length}
                  </Badge>
                </div>

                <div className="flex min-h-10 flex-col gap-2">
                  {clientes.length === 0 ? (
                    <p className="px-1 text-sm text-muted-foreground">
                      Nenhum cliente nesta etapa
                    </p>
                  ) : (
                    clientes.map((cliente) => (
                      <StaticClienteCard
                        key={cliente.id}
                        cliente={cliente}
                        showResponsavel={showResponsavel}
                        onOpen={() => handleOpenCliente(cliente.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <DndContext
          id="clientes-kanban"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-1 gap-4 overflow-x-auto pb-2">
            {ETAPAS.map((etapa) => {
              const clientes = filteredGrouped[etapa.key]

              return (
                <div
                  key={etapa.key}
                  className="flex w-[280px] shrink-0 flex-col gap-2"
                >
                  <div className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2">
                    <h2 className="text-base leading-tight font-semibold">
                      {etapa.label}
                    </h2>
                    <Badge variant="outline" className="shrink-0">
                      {clientes.length}
                    </Badge>
                  </div>

                  <SortableContext
                    items={clientes.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <DroppableColumn etapaKey={etapa.key}>
                      {clientes.length === 0 ? (
                        <p className="px-1 text-sm text-muted-foreground">
                          Nenhum cliente nesta etapa
                        </p>
                      ) : (
                        clientes.map((cliente) => (
                          <DraggableClienteCard
                            key={cliente.id}
                            cliente={cliente}
                            showResponsavel={showResponsavel}
                            onOpen={() => handleOpenCliente(cliente.id)}
                          />
                        ))
                      )}
                    </DroppableColumn>
                  </SortableContext>
                </div>
              )
            })}
          </div>
        </DndContext>
      )}

      {toast ? (
        <div
          role={toast.type === "error" ? "alert" : "status"}
          className={
            "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-2 text-sm shadow-lg " +
            (toast.type === "error"
              ? "bg-destructive text-white"
              : "bg-foreground text-background")
          }
        >
          {toast.text}
        </div>
      ) : null}

      <ClienteDetailSheet
        clienteId={selectedClienteId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        isSupervisor={showResponsavel}
        categoriaOptions={categoriaOptions}
        produtoOptions={produtoOptions}
        vendedorOptions={vendedorOptions}
        onSaved={handleClienteSaved}
        onDeleted={handleClienteDeleted}
      />
    </div>
  )
}
