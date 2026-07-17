"use client"

import { TriangleAlert } from "lucide-react"
import type { HTMLAttributes, KeyboardEvent } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { EtapaKey } from "@/lib/funil/etapas"
import { cn } from "@/lib/utils"

/**
 * Flat, presentational shape ClienteCard renders — callers (KanbanBoard,
 * later the "Incompletos" list view) map their raw query rows into this.
 */
export type ClienteCardData = {
  id: string
  razaoSocial: string
  categoriaNome: string | null
  responsavelNome: string | null
  etapa: EtapaKey
  statusAcompanhamento: "em_andamento" | "perdido" | "ganho"
  cidade: string
  estado: string
}

/**
 * Compact, presentational kanban card (D-03/D-04). Full forward-looking prop
 * contract locked in now so 02-04 (drag), 02-05 ("Incompleto" badge/overdue
 * data), and 02-06 (detail sheet) only ever pass new props — they never
 * restructure this component.
 *
 * - `incompleto` / `isOverdue` / `overdueTooltip`: slots wired with real data
 *   starting in 02-05/02-04 respectively; inert (no-op) here.
 * - `onOpen`: click-to-open-detail, wired in 02-06.
 * - `dragHandleProps`: spread onto the card root by 02-04's dnd-kit
 *   `useDraggable` integration; optional/no-op now.
 *
 * Per UI-SPEC: categoria/status badges are never `--primary` blue — only
 * `outline`/`secondary`/`destructive` badge variants are used here.
 */
export function ClienteCard({
  cliente,
  showResponsavel,
  incompleto = false,
  isOverdue = false,
  overdueTooltip,
  onOpen,
  dragHandleProps,
}: {
  cliente: ClienteCardData
  showResponsavel: boolean
  incompleto?: boolean
  isOverdue?: boolean
  overdueTooltip?: string
  onOpen?: () => void
  dragHandleProps?: HTMLAttributes<HTMLDivElement>
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onOpen) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <Card
      size="sm"
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={onOpen ? handleKeyDown : undefined}
      className={cn(
        "gap-1.5",
        onOpen && "cursor-pointer",
        isOverdue && "border-l-4 border-l-amber-500"
      )}
      {...dragHandleProps}
    >
      <CardHeader className="grid-cols-[1fr_auto] items-start gap-2 px-3">
        <CardTitle
          className="truncate text-base leading-tight font-semibold"
          title={cliente.razaoSocial}
        >
          {cliente.razaoSocial}
        </CardTitle>
        {incompleto ? (
          <Badge variant="outline" className="shrink-0">
            Incompleto
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-3">
        <div className="flex items-center gap-2">
          {cliente.categoriaNome ? (
            <Badge variant="outline">{cliente.categoriaNome}</Badge>
          ) : null}
          {isOverdue ? (
            <Tooltip>
              <TooltipTrigger
                className="inline-flex shrink-0 items-center bg-transparent p-0"
                aria-label={overdueTooltip ?? "Parado ou atrasado"}
                onClick={(event) => event.stopPropagation()}
              >
                <TriangleAlert className="size-3.5 shrink-0 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent>
                {overdueTooltip ?? "Parado ou atrasado"}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        {showResponsavel && cliente.responsavelNome ? (
          <p className="truncate text-sm text-muted-foreground">
            {cliente.responsavelNome}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {cliente.cidade}/{cliente.estado}
        </p>
      </CardContent>
    </Card>
  )
}
