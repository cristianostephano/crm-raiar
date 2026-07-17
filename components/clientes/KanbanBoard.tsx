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
import { useState, type HTMLAttributes, type ReactNode } from "react"

import { moverCard } from "@/app/actions/funil"
import { ClienteCard, type ClienteCardData } from "@/components/clientes/ClienteCard"
import { Badge } from "@/components/ui/badge"
import { ETAPAS, ETAPA_KEYS, type EtapaKey } from "@/lib/funil/etapas"
import type {
  ClienteListItem,
  ClientesAgrupadosPorEtapa,
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

function findEtapaDoCartao(
  grouped: ClientesAgrupadosPorEtapa,
  clienteId: string
): EtapaKey | null {
  for (const key of ETAPA_KEYS) {
    if (grouped[key].some((cliente) => cliente.id === clienteId)) return key
  }
  return null
}

function DraggableClienteCard({
  cliente,
  showResponsavel,
}: {
  cliente: ClienteListItem
  showResponsavel: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: cliente.id })

  const cardData: ClienteCardData = {
    id: cliente.id,
    razaoSocial: cliente.razao_social,
    categoriaNome: cliente.categoria_nome,
    responsavelNome: cliente.responsavel_nome,
    etapa: cliente.etapa,
    statusAcompanhamento: cliente.status_acompanhamento,
    cidade: cliente.cidade,
    estado: cliente.estado,
  }

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
        cliente={cardData}
        showResponsavel={showResponsavel}
        dragHandleProps={
          { ...attributes, ...listeners } as HTMLAttributes<HTMLDivElement>
        }
      />
    </div>
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
}: {
  grouped: ClientesAgrupadosPorEtapa
  callerRole: "supervisor" | "vendedor"
}) {
  const showResponsavel = callerRole === "supervisor"
  const [grouped, setGrouped] = useState(initialGrouped)
  const [toast, setToast] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

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

    const movedCliente: ClienteListItem = {
      ...moving,
      etapa: targetEtapa,
      posicao: novaPosicao,
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

  return (
    <div className="relative flex flex-1 flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-4 overflow-x-auto pb-2">
          {ETAPAS.map((etapa) => {
            const clientes = grouped[etapa.key]

            return (
              <div
                key={etapa.key}
                className="flex w-[280px] shrink-0 flex-col gap-2"
              >
                <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
                  <h2 className="truncate text-xl font-semibold">
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
    </div>
  )
}
