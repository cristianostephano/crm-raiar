"use client"

import { format, parseISO } from "date-fns"
import { CheckCircle2, ClipboardCheck, Repeat, TriangleAlert } from "lucide-react"
import type { KeyboardEvent } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { AgendaItem } from "@/lib/agenda/itens"
import { cn } from "@/lib/utils"

/**
 * Linha apresentacional de um item da Agenda (AGD-01/AGD-03). Puramente
 * apresentacional: nenhuma leitura de dados, nenhum estado além do que o
 * React exige, e nenhuma decisão de negócio.
 *
 * `atrasado` chega PRONTO de quem renderiza (a seção em que a linha está —
 * AgendaList). Este componente NÃO calcula atraso e não importa a função de
 * classificação de seção: a autoridade disso é `lib/agenda/itens.ts`,
 * aplicada uma única vez, na lista.
 *
 * Molde literal: components/clientes/ClienteCard.tsx — mesmo `Card size="sm"`
 * com `role="button"`/`tabIndex`/`onKeyDown` (Enter/espaço,
 * `preventDefault`), mesma borda de atraso (`border-l-4 border-l-red-500`) e
 * mesmo bloco `TriangleAlert`+`Tooltip` (`size-3.5 shrink-0 text-amber-500`,
 * `onClick` que interrompe a propagação) — critério de sucesso 3 da fase
 * exige as MESMAS classes utilitárias, não um equivalente-mas-diferente.
 *
 * A partir da Fase 15 este componente ganha o botão "Concluir" (CONC-01)
 * que o comentário de cabeçalho anterior listava como proibido — é
 * exatamente esta fase que entrega o fluxo de finalização de item. O botão
 * interrompe a propagação do clique ANTES de chamar `onConcluir`, mesmo
 * padrão defensivo que o `TooltipTrigger` do triângulo de atraso já usa
 * logo acima: sem isso, o mesmo clique também dispararia `onOpen` e abriria
 * a ficha do cliente por cima da janela de conclusão (T-15-36). O
 * componente continua sem chamar Server Action, sem ler dados e sem
 * calcular atraso — só expõe o callback para quem o compõe decidir o que
 * fazer.
 */
export function AgendaItemRow({
  item,
  atrasado,
  showResponsavel,
  onOpen,
  onConcluir,
}: {
  item: AgendaItem
  atrasado: boolean
  showResponsavel: boolean
  onOpen?: () => void
  onConcluir: () => void
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onOpen) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onOpen()
    }
  }

  // A data do banco JAMAIS pode ser convertida com o construtor de data cru
  // do JavaScript a partir da string: `YYYY-MM-DD` é interpretado em fuso
  // zero e, no horário de São Paulo, mostra o dia anterior (Pitfall 1).
  // `parseISO` trata a string como data local.
  const dataFormatada = format(parseISO(item.data), "dd/MM")
  const tooltipAtraso = `Atrasado desde ${dataFormatada}.`

  return (
    <Card
      size="sm"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className={cn(
        "gap-1.5",
        onOpen && "cursor-pointer",
        atrasado && "border-l-4 border-l-red-500"
      )}
    >
      <CardHeader className="grid-cols-[1fr_auto] items-start gap-2 px-3">
        <CardTitle
          className="truncate text-base leading-tight font-semibold"
          title={item.razaoSocial}
        >
          {item.razaoSocial}
        </CardTitle>
        {item.origem === "prospeccao" ? (
          <Badge variant="outline" className="shrink-0">
            <ClipboardCheck />
            Prospecção
          </Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            <Repeat />
            Visita
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5 px-3">
        <p className="text-sm text-muted-foreground">{item.titulo}</p>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">{dataFormatada}</p>
          {atrasado ? (
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
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              onConcluir()
            }}
          >
            <CheckCircle2 />
            Concluir
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
