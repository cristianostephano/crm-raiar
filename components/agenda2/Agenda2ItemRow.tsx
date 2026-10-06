"use client"

import { format, parseISO } from "date-fns"
import {
  CheckCircle2,
  Pencil,
  RotateCcw,
  TriangleAlert,
  Trash2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Agenda2Item } from "@/lib/agenda2/itens"
import { cn } from "@/lib/utils"

/**
 * Linha apresentacional de um item da Agenda 2 (AGD2-03/04/05/07,
 * D-02/D-04/D-06/D-16). Irmão novo de `components/agenda/AgendaItemRow.tsx`
 * — mesmo precedente de "sibling module, not shared abstraction" já usado
 * entre Perdidos/Encerrados; a Agenda atual não é tocada por este
 * componente.
 *
 * Puramente apresentacional: nenhuma leitura de dados, nenhuma Server
 * Action, nenhum cálculo de atraso. `atrasado` chega PRONTO de quem
 * renderiza (a Lista, 31-08) — a autoridade de dia de calendário continua
 * sendo `bucketDoItem()` em `lib/agenda/itens.ts`.
 *
 * Três divergências deliberadas de `AgendaItemRow` (UI-SPEC "Component
 * Contracts" → Agenda2ItemRow):
 * 1. O cartão NUNCA recebe `opacity-60` quando concluído — D-06 exige que
 *    o item continue totalmente editável, e esmaecer o cartão inteiro
 *    contradiria visualmente isso.
 * 2. `Editar` nunca é escondido — a única troca por estado é
 *    Concluir ↔ Desmarcar (Pitfall 5 do RESEARCH.md: não repetir o
 *    `concluido ? null : <Button>` do histórico de `AgendaItemRow`).
 * 3. O cartão não é clicável (sem `role="button"`/`tabIndex`): não existe
 *    ficha de cliente para abrir — `nomeCliente` é texto livre, não uma
 *    referência a `clientes`.
 *
 * Quick 261006-ncy: mostra, discretos e com no máximo 3 linhas, os dois
 * textos livres opcionais ("Motivo da visita:" e "O que foi feito:") quando
 * existem — nunca uma linha vazia. O Supervisor lê os textos e não ganha
 * nenhum botão novo.
 */
export function Agenda2ItemRow({
  item,
  atrasado,
  showResponsavel,
  podeAlterar,
  salvando = false,
  onEditar,
  onApagar,
  onConcluir,
  onDesmarcar,
}: {
  item: Agenda2Item
  atrasado: boolean
  showResponsavel: boolean
  podeAlterar: boolean
  salvando?: boolean
  onEditar: () => void
  onApagar: () => void
  onConcluir: () => void
  onDesmarcar: () => void
}) {
  // Mesmo guarda de AgendaItemRow: um item concluído nunca mostra atraso,
  // aconteça o que acontecer do lado de fora (D-02/D-04).
  const mostraAtraso = atrasado && !item.concluido

  // A data do banco JAMAIS pode ser convertida com o construtor de data cru
  // do JavaScript a partir da string: `YYYY-MM-DD` é interpretado em fuso
  // zero e, no horário de São Paulo, mostra o dia anterior. `parseISO`
  // trata a string como data local (mesma regra de `lib/agenda/itens.ts`).
  const dataFormatada = format(parseISO(item.data), "dd/MM")
  const tooltipAtraso = `Atrasado desde ${dataFormatada}.`

  return (
    <Card
      size="sm"
      className={cn("gap-1.5", mostraAtraso && "border-l-4 border-l-red-500")}
    >
      <CardHeader className="grid-cols-[1fr_auto] items-start gap-2 px-3">
        <CardTitle
          className={cn(
            "truncate text-base leading-tight font-semibold",
            item.concluido && "text-muted-foreground line-through"
          )}
          title={item.nomeCliente}
        >
          {item.nomeCliente}
        </CardTitle>
        {item.concluido ? (
          <Badge
            variant="outline"
            className="shrink-0 border-emerald-600 text-emerald-600"
          >
            <CheckCircle2 />
            Concluído
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-3">
        <p className="text-sm text-muted-foreground">{item.bairro}</p>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">{dataFormatada}</p>
          {mostraAtraso ? (
            <Tooltip>
              <TooltipTrigger
                className="inline-flex shrink-0 items-center bg-transparent p-0"
                aria-label={tooltipAtraso}
                onClick={(event) => event.stopPropagation()}
              >
                <TriangleAlert className="size-3.5 shrink-0 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent>{tooltipAtraso}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        {showResponsavel && item.responsavelNome ? (
          <p className="truncate text-sm text-muted-foreground">
            {item.responsavelNome}
          </p>
        ) : null}
        {/* Textos livres opcionais (quick 261006-ncy): só aparecem quando
         * existem — nenhum elemento vazio. Sempre renderizados como texto
         * React (nunca HTML cru). O Supervisor também os lê (podeAlterar não
         * interfere aqui). */}
        {item.oQueFazer ? (
          <p
            data-slot="agenda2-o-que-fazer"
            className="line-clamp-3 text-sm break-words whitespace-pre-line text-muted-foreground"
          >
            <span className="font-medium">Motivo da visita:</span>{" "}
            {item.oQueFazer}
          </p>
        ) : null}
        {item.oQueFoiFeito ? (
          <p
            data-slot="agenda2-o-que-foi-feito"
            className="line-clamp-3 text-sm break-words whitespace-pre-line text-muted-foreground"
          >
            <span className="font-medium">O que foi feito:</span>{" "}
            {item.oQueFoiFeito}
          </p>
        ) : null}
        {podeAlterar ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={salvando}
                onClick={onEditar}
              >
                <Pencil />
                Editar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={salvando}
                onClick={onApagar}
              >
                <Trash2 />
                Apagar
              </Button>
            </div>
            {item.concluido ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={salvando}
                onClick={onDesmarcar}
              >
                <RotateCcw />
                Desmarcar
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={salvando}
                onClick={onConcluir}
              >
                <CheckCircle2 />
                Concluir
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
