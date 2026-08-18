"use client"

import { format, isSameDay } from "date-fns"
import { CheckCircle2, ClipboardCheck, Repeat } from "lucide-react"
import type { KeyboardEvent } from "react"

import {
  chaveDoDia,
  diasDaSemana,
  estaAtrasado,
  itensDoDia,
  rotulosDosDiasDaSemana,
  type AgendaItem,
} from "@/lib/agenda/itens"
import { cn } from "@/lib/utils"

/**
 * Visão de semana do calendário da Agenda (AGD-10). Sete colunas, uma por
 * dia, segunda a domingo.
 *
 * (a) Os 7 dias vêm SEMPRE de `diasDaSemana` (o módulo puro do plano
 * 20-01), nunca de soma de dias à mão — é isso que garante que esta visão e
 * a de mês concordem sobre em qual coluna cada data cai (D-04, Pitfall 8).
 * (b) O atraso vem da autoridade única do CALENDÁRIO (`estaAtrasado`, Fase
 * 21/AGD-13), com o `now` recebido — este componente não decide atraso por
 * conta própria. A partir da Fase 21 esta é a função certa — não mais
 * `bucketDoItem` direto — porque item concluído carrega a data em que foi
 * concluído, sempre no passado; `estaAtrasado` já embute a exceção que
 * impede pintar de vermelho um registro histórico.
 * (c) O cartão pequeno é uma REDUÇÃO deliberada do cartão da Lista para
 * caber numa coluna estreita: mantém os dois ícones e a distinção de cor
 * por origem (AGD-12), mas abre mão do botão "Concluir" — essa ação
 * continua alcançável pela visão de dia e pelo diálogo do dia (D-07:
 * nenhuma interação nova além das duas que a Lista já tem). Desde a Fase 21
 * o cartão pequeno também sabe mostrar um item já concluído (marca +
 * ícone de conferido, opacidade reduzida), na mesma forma que o chip da
 * visão de mês (Task 3 do plano 21-03) — os dois nunca devem divergir.
 */
export function AgendaCalendarioSemana({
  referencia,
  porData,
  onOpenItem,
  now = new Date(),
}: {
  referencia: Date
  porData: Map<string, AgendaItem[]>
  onOpenItem: (item: AgendaItem) => void
  now?: Date
}) {
  const dias = diasDaSemana(referencia)
  const rotulos = rotulosDosDiasDaSemana()

  return (
    <div className="grid grid-cols-7 items-start gap-3">
      {dias.map((dia, idx) => {
        const isHoje = isSameDay(dia, now)
        const itensDoDiaAtual = itensDoDia(porData, dia)

        return (
          <div
            key={chaveDoDia(dia)}
            className={cn(
              "flex min-h-32 flex-col rounded-lg border bg-card",
              isHoje ? "border-primary" : "border-border"
            )}
          >
            <div
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-t-lg border-b border-border py-2",
                isHoje && "bg-primary/10"
              )}
            >
              <span className="text-xs text-muted-foreground uppercase">
                {rotulos[idx]}
              </span>
              <span
                className={cn(
                  "text-lg font-semibold",
                  isHoje && "text-primary"
                )}
              >
                {format(dia, "d")}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 p-2">
              {itensDoDiaAtual.length === 0 ? (
                <span className="pt-2 text-center text-xs text-muted-foreground">
                  —
                </span>
              ) : (
                itensDoDiaAtual.map((item) => (
                  <WeekItemChip
                    key={item.itemId}
                    item={item}
                    atrasado={estaAtrasado(item, now)}
                    onOpen={() => onOpenItem(item)}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Cartão pequeno de um item dentro de uma coluna de semana. Mesmo padrão de
 * acessibilidade que o cartão da Lista (`role="button"`, `tabIndex`,
 * Enter/espaço) — não é regressão num item que é ferramenta de trabalho.
 *
 * A COR da borda lateral é decidida em etapas: primeiro a cor de origem
 * (esmaecida para prospecção, primária para visita), depois — só se
 * atrasado OU só se concluído (nunca as duas ao mesmo tempo, já que
 * `estaAtrasado` garante que item concluído nunca é atrasado) — a cor de
 * destaque correspondente sobrescrevendo apenas essa cor. As classes de
 * atraso e de concluído vêm por ÚLTIMO na composição (`cn`, que faz merge
 * de utilitários conflitantes mantendo o último) de propósito: se a ordem
 * inverter, o item perde a informação de prospecção/visita (D-10/AGD-12).
 * O ícone de conferido SOMA-se ao ícone de origem quando concluído — nunca
 * o substitui — e o cartão ganha opacidade reduzida, mesmo tratamento que
 * `AgendaItemRow` já aplica (plano 21-03, Task 1).
 */
function WeekItemChip({
  item,
  atrasado,
  onOpen,
}: {
  item: AgendaItem
  atrasado: boolean
  onOpen: () => void
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onOpen()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex cursor-pointer flex-col gap-0.5 rounded-md border border-border bg-background p-1.5 border-l-4",
        item.origem === "prospeccao"
          ? "border-l-muted-foreground"
          : "border-l-primary",
        atrasado && "border-l-destructive",
        item.concluido && "border-l-emerald-600",
        item.concluido && "opacity-60"
      )}
    >
      <div className="flex items-center gap-1">
        {item.origem === "prospeccao" ? (
          <ClipboardCheck className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <Repeat className="size-3 shrink-0 text-primary" />
        )}
        {item.concluido ? (
          <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />
        ) : null}
        <span className="truncate text-xs font-medium">
          {item.razaoSocial}
        </span>
      </div>
      <span className="truncate text-xs text-muted-foreground">
        {item.titulo}
      </span>
    </div>
  )
}
