"use client"

import { format, isSameDay } from "date-fns"
import { CheckCircle2 } from "lucide-react"
import type { KeyboardEvent } from "react"

import {
  chaveDoDia,
  diasDaSemana,
  rotulosDosDiasDaSemana,
} from "@/lib/agenda/itens"
import {
  estaAtrasadoAgenda2,
  itensDoDiaAgenda2,
  type Agenda2Item,
} from "@/lib/agenda2/itens"
import { cn } from "@/lib/utils"

/**
 * Visão de semana do calendário da Agenda 2 (AGD2-08, D-26/D-27/D-29).
 *
 * CÓPIA de `components/agenda/AgendaCalendarioSemana.tsx` — o original não é
 * editado nem importado; daqui só entram funções puras de `lib/agenda/itens.ts`
 * (`diasDaSemana`, `rotulosDosDiasDaSemana`, `chaveDoDia`). Nada desta pasta
 * importa componentes nem ações da Agenda atual.
 *
 * O que NÃO mudou: as 7 colunas (segunda a domingo, via `diasDaSemana` para
 * concordar com o mês), o cabeçalho do dia, o destaque de hoje e o "—" no dia
 * vazio.
 *
 * O que mudou: tipos e funções da Agenda 2; o chip mostra nome do cliente
 * (linha 1) e bairro (linha 2); o concluído fica RISCADO com borda verde, sem
 * `opacity-60` (o item concluído continua acionável); sem ícone de origem nem
 * de repetição (D-26); e `onSelecionarDia` substitui `onOpenItem` — não existe
 * ficha de cliente para abrir (Pitfall 9), então o chip leva ao dia.
 */
export function Agenda2CalendarioSemana({
  referencia,
  porData,
  onSelecionarDia,
  now = new Date(),
}: {
  referencia: Date
  porData: Map<string, Agenda2Item[]>
  onSelecionarDia: (dia: Date) => void
  now?: Date
}) {
  const dias = diasDaSemana(referencia)
  const rotulos = rotulosDosDiasDaSemana()

  return (
    <div className="grid grid-cols-7 items-start gap-3">
      {dias.map((dia, idx) => {
        const isHoje = isSameDay(dia, now)
        const itensDoDiaAtual = itensDoDiaAgenda2(porData, dia)

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
                    key={item.id}
                    item={item}
                    atrasado={estaAtrasadoAgenda2(item, now)}
                    onAbrirDia={() => onSelecionarDia(dia)}
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
 * Cartão pequeno de um item numa coluna de semana. Clicável por mouse e
 * teclado (`role="button"`, `tabIndex`, Enter/espaço) e leva ao DIA da coluna
 * (Pitfall 9) — as ações Editar/Apagar/Concluir ficam na visão de dia.
 *
 * A cor da borda lateral: primária por padrão; vermelha se atrasado; verde se
 * concluído (nunca os dois, `estaAtrasadoAgenda2` garante). As classes de
 * estado vêm por último no `cn`, que mantém a última em caso de conflito.
 */
function WeekItemChip({
  item,
  atrasado,
  onAbrirDia,
}: {
  item: Agenda2Item
  atrasado: boolean
  onAbrirDia: () => void
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onAbrirDia()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrirDia}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex cursor-pointer flex-col gap-0.5 rounded-md border border-border bg-background p-1.5 border-l-4 border-l-primary",
        atrasado && "border-l-destructive",
        item.concluido && "border-l-emerald-600"
      )}
    >
      <div className="flex items-center gap-1">
        {item.concluido ? (
          <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />
        ) : null}
        <span
          className={cn(
            "truncate text-xs font-semibold",
            item.concluido && "text-muted-foreground line-through"
          )}
        >
          {item.nomeCliente}
        </span>
      </div>
      <span className="truncate text-xs text-muted-foreground">
        {item.bairro}
      </span>
    </div>
  )
}
