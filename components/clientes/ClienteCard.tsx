"use client"

import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Phone,
  TriangleAlert,
} from "lucide-react"
import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { etapaAnterior, etapaSeguinte, type EtapaKey } from "@/lib/funil/etapas"
import type { TaskStatus } from "@/lib/funil/staleness"
import { nomeExibicaoCliente } from "@/lib/clientes/nomeExibicao"
import { rotuloCidadeEstado } from "@/lib/clientes/rotuloLocalizacao"
import { cn } from "@/lib/utils"

/**
 * Flat, presentational shape ClienteCard renders — callers (KanbanBoard,
 * later the "Incompletos" list view) map their raw query rows into this.
 */
export type ClienteCardData = {
  id: string
  razaoSocial: string
  /** Fase 26 Plano 4 (T-26-15): repasse do valor lido de `clientes` —
   * alimenta nomeExibicaoCliente(), que decide o título exibido quando
   * razão social vier nula (PROSP-02). Nunca lido diretamente aqui. */
  nomeFantasia: string | null
  categoriaNome: string | null
  responsavelNome: string | null
  etapa: EtapaKey
  statusAcompanhamento: "em_andamento" | "perdido" | "ganho"
  /** Nullable since migration 0023 (quick task 260819-m8q, D-01/D-02) — a
   * cliente sem endereço is rendered via rotuloLocalizacao's "Sem cidade"/
   * "Sem estado" labels, never hidden (D-03). */
  cidade: string | null
  estado: string | null
  /** Feeds the quick-action row's tel:/wa.me links — null renders every
   * quick-action icon disabled/muted (not hidden, D-03) so card layout
   * never shifts between cards that do/don't have a phone number. */
  telefone: string | null
  /** Drives the always-visible 3-color left border (green/amber/red) —
   * separate signal from `isOverdue`, which only drives the TriangleAlert
   * tooltip. */
  taskStatus: TaskStatus
}

const TASK_STATUS_BORDER: Record<TaskStatus, string> = {
  on_time: "border-l-4 border-l-green-500",
  late: "border-l-4 border-l-amber-500",
  none: "border-l-4 border-l-red-500",
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "")
}

/** Ghost, 44px-touch-target quick-action icon (tel:/wa.me shortcuts on the
 * card, D-03's visual reference) — renders as a disabled/muted `span` (not
 * hidden) when there is no href to follow, so the row's layout stays stable
 * whether or not the client has a phone number on file. */
function QuickActionIcon({
  href,
  label,
  external = false,
  children,
}: {
  href: string | null
  label: string
  external?: boolean
  children: ReactNode
}) {
  const shared =
    "flex size-11 shrink-0 items-center justify-center rounded-md transition-colors"

  if (!href) {
    return (
      <span
        className={cn(shared, "cursor-not-allowed text-muted-foreground/40")}
        aria-hidden="true"
      >
        {children}
      </span>
    )
  }

  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      aria-label={label}
      className={cn(
        shared,
        "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </a>
  )
}

/** Same disabled-not-hidden shape as QuickActionIcon, but for an in-app
 * action (no href) — used by the schedule/CalendarClock quick action, which
 * has no standalone destination yet and instead opens the same detail sheet
 * `onOpen` already opens (02-06 wires the tarefa checklist inside it). */
function QuickActionButton({
  onAction,
  label,
  children,
}: {
  onAction: (() => void) | null
  label: string
  children: ReactNode
}) {
  const shared =
    "flex size-11 shrink-0 items-center justify-center rounded-md transition-colors"

  if (!onAction) {
    return (
      <span
        className={cn(shared, "cursor-not-allowed text-muted-foreground/40")}
        aria-hidden="true"
      >
        {children}
      </span>
    )
  }

  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        shared,
        "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      onClick={(event) => {
        event.stopPropagation()
        onAction()
      }}
    >
      {children}
    </button>
  )
}

/** Seta de avançar/voltar etapa direto no card (D-01/D-02, quick task
 * 260921-n0a). O par de `stopPropagation` é obrigatório: o do `onClick`
 * impede que o clique suba até o elemento raiz do `Card` e abra a ficha
 * (`onOpen`); o do `onPointerDown` impede que os listeners do dnd-kit —
 * espalhados no mesmo elemento raiz via `dragHandleProps` — comecem a
 * rastrear um arraste a partir do botão. O destino é sempre a etapa
 * ADJACENTE, nunca um salto livre entre as 7 etapas (D-02). */
function EtapaArrowButton({
  label,
  disabled,
  onMove,
  children,
}: {
  label: string
  disabled: boolean
  onMove: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onMove()
      }}
    >
      {children}
    </button>
  )
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
  onMoverEtapa,
  movendoEtapa = false,
}: {
  cliente: ClienteCardData
  showResponsavel: boolean
  incompleto?: boolean
  isOverdue?: boolean
  overdueTooltip?: string
  onOpen?: () => void
  dragHandleProps?: HTMLAttributes<HTMLDivElement>
  /** Chama a MESMA Server Action que o arrastar já usa (`moverCard`) —
   * ver o comentário de `EtapaArrowButton` acima. Opcional para manter o
   * card utilizável por qualquer outro consumidor sem essa prop. */
  onMoverEtapa?: (destino: EtapaKey) => void
  /** Trava de clique-duplo enquanto a chamada de `onMoverEtapa` está no
   * ar — nunca uma tentativa de adivinhar recusa do RPC (D-05). */
  movendoEtapa?: boolean
}) {
  const etapaAnteriorVizinha = etapaAnterior(cliente.etapa)
  const etapaSeguinteVizinha = etapaSeguinte(cliente.etapa)
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
        TASK_STATUS_BORDER[cliente.taskStatus]
      )}
      {...dragHandleProps}
    >
      <CardHeader className="grid-cols-[1fr_auto] items-start gap-2 px-3">
        <CardTitle
          className="truncate text-base leading-tight font-semibold"
          title={nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)}
        >
          {nomeExibicaoCliente(cliente.razaoSocial, cliente.nomeFantasia)}
        </CardTitle>
        {incompleto ? (
          <Badge variant="destructive" className="shrink-0">
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
          {rotuloCidadeEstado(cliente.cidade, cliente.estado)}
        </p>
        <div className="-mx-1.5 -mb-1.5 flex items-center">
          <QuickActionIcon
            href={cliente.telefone ? `tel:${cliente.telefone}` : null}
            label="Ligar para o cliente"
          >
            <Phone className="size-[18px]" />
          </QuickActionIcon>
          <QuickActionIcon
            href={
              cliente.telefone
                ? `https://wa.me/55${onlyDigits(cliente.telefone)}`
                : null
            }
            label="Conversar no WhatsApp"
            external
          >
            <MessageCircle className="size-[18px]" />
          </QuickActionIcon>
          {/* No standalone schedule/tarefa quick-add exists yet — opens the
           * same detail sheet `onOpen` opens (02-06 puts the tarefa
           * checklist there), so it's disabled (not hidden) until a caller
           * passes `onOpen`, exactly like a card with no onOpen at all. */}
          <QuickActionButton onAction={onOpen ?? null} label="Agendar tarefa">
            <CalendarClock className="size-[18px]" />
          </QuickActionButton>
          {onMoverEtapa ? (
            <div className="ml-auto flex items-center">
              {etapaAnteriorVizinha ? (
                <EtapaArrowButton
                  label="Voltar para a etapa anterior"
                  disabled={movendoEtapa}
                  onMove={() => onMoverEtapa(etapaAnteriorVizinha)}
                >
                  <ChevronLeft className="size-[18px]" />
                </EtapaArrowButton>
              ) : null}
              {etapaSeguinteVizinha ? (
                <EtapaArrowButton
                  label="Avançar para a próxima etapa"
                  disabled={movendoEtapa}
                  onMove={() => onMoverEtapa(etapaSeguinteVizinha)}
                >
                  <ChevronRight className="size-[18px]" />
                </EtapaArrowButton>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
