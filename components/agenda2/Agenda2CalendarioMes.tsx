"use client"

import { format, isSameDay, isSameMonth } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle2 } from "lucide-react"
import type { KeyboardEvent } from "react"

import {
  MAX_ITENS_NA_CELULA,
  chaveDoDia,
  diasDaGradeDoMes,
  rotulosDosDiasDaSemana,
} from "@/lib/agenda/itens"
import {
  dividirCelulaAgenda2,
  estaAtrasadoAgenda2,
  itensDoDiaAgenda2,
  type Agenda2Item,
} from "@/lib/agenda2/itens"
import { cn } from "@/lib/utils"

/**
 * Visão de mês do calendário da Agenda 2 (AGD2-08, D-26/D-27/D-29).
 *
 * CÓPIA de `components/agenda/AgendaCalendarioMes.tsx` — o original não é
 * editado nem importado; daqui só entram funções puras e constantes de
 * `lib/agenda/itens.ts` (grade, rótulos, `chaveDoDia`, limite da célula).
 * Nada desta pasta importa componentes nem ações da Agenda atual.
 *
 * O que NÃO mudou: a grade (`diasDaGradeDoMes`, semana começando na
 * segunda), as classes da célula, a célula inteira clicável (role="button",
 * Enter/espaço), o "+N mais" e as três perguntas independentes do Pitfall 9
 * ("no mês visível", "atrasado" e "concluído" têm, cada uma, o seu caminho de
 * estilo: um atrasado numa célula vizinha esmaecida continua vermelho).
 *
 * O que mudou: tipos e funções da Agenda 2 (`Agenda2Item`, `itensDoDiaAgenda2`,
 * `dividirCelulaAgenda2`, `estaAtrasadoAgenda2`); a chave é `item.id`; o rótulo
 * acessível termina em "visita(s)"; o chip mostra o nome do cliente, sem ícone
 * de origem e sem ícone de repetição (D-26); e o concluído aparece RISCADO
 * (D-29) em vez de apenas esmaecido.
 *
 * Quick 261006-fjt: para o Supervisor vendo todos os vendedores
 * (`showResponsavel`), o chip ganha uma 2ª linha pequena e apagada com o nome
 * do vendedor. O Vendedor nunca vê. A prop é opcional e começa DESLIGADA
 * (privacidade por padrão). O rótulo acessível da célula não cita nomes.
 *
 * Componente apresentacional: recebe `porData` já agrupado, não busca nem
 * filtra dado.
 */
export function Agenda2CalendarioMes({
  referencia,
  porData,
  onSelecionarDia,
  now = new Date(),
  showResponsavel = false,
}: {
  referencia: Date
  porData: Map<string, Agenda2Item[]>
  onSelecionarDia: (dia: Date) => void
  now?: Date
  showResponsavel?: boolean
}) {
  const dias = diasDaGradeDoMes(referencia)
  const rotulos = rotulosDosDiasDaSemana()

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-7">
        {rotulos.map((rotulo) => (
          <div
            key={rotulo}
            className="border-b border-border px-2 py-2.5 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {rotulo}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((dia, idx) => (
          <MonthDayCell
            key={chaveDoDia(dia)}
            dia={dia}
            noMesVisivel={isSameMonth(dia, referencia)}
            ehHoje={isSameDay(dia, now)}
            ultimaColuna={(idx + 1) % 7 === 0}
            itens={itensDoDiaAgenda2(porData, dia)}
            now={now}
            showResponsavel={showResponsavel}
            onSelecionar={onSelecionarDia}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Uma célula de dia da grade. O alvo de clique é a célula inteira (`min-h-28`);
 * nenhum chip nem o "+N mais" tem tratador próprio — o clique sobe até esta
 * `div`. Os chips visíveis e o excedente vêm de UMA chamada a
 * `dividirCelulaAgenda2` sobre a mesma lista, para nunca divergirem.
 */
function MonthDayCell({
  dia,
  noMesVisivel,
  ehHoje,
  ultimaColuna,
  itens,
  now,
  showResponsavel,
  onSelecionar,
}: {
  dia: Date
  noMesVisivel: boolean
  ehHoje: boolean
  ultimaColuna: boolean
  itens: Agenda2Item[]
  now: Date
  showResponsavel: boolean
  onSelecionar: (dia: Date) => void
}) {
  function handleClick() {
    onSelecionar(dia)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelecionar(dia)
    }
  }

  const { visiveis, excedente } = dividirCelulaAgenda2(
    itens,
    MAX_ITENS_NA_CELULA
  )
  const rotuloAcessivel = `${format(dia, "EEEE, d 'de' MMMM", {
    locale: ptBR,
  })}, ${itens.length} ${itens.length === 1 ? "visita" : "visitas"}`

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={rotuloAcessivel}
      className={cn(
        "flex min-h-28 cursor-pointer flex-col gap-1 border-r border-b border-border p-1.5 transition-colors hover:bg-muted/50",
        ultimaColuna && "border-r-0",
        !noMesVisivel && "bg-muted/30"
      )}
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full text-sm",
          !noMesVisivel && "text-muted-foreground/60",
          ehHoje && "bg-primary font-semibold text-primary-foreground"
        )}
      >
        {format(dia, "d")}
      </span>
      {visiveis.length > 0 ? (
        <div className="flex flex-1 flex-col gap-1">
          {visiveis.map((item) => (
            <MonthItemChip
              key={item.id}
              item={item}
              atrasado={estaAtrasadoAgenda2(item, now)}
              showResponsavel={showResponsavel}
            />
          ))}
          {excedente > 0 ? (
            <span className="rounded px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
              +{excedente} mais
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Chip de um item dentro da célula de mês — resumo visual, não alvo de clique
 * próprio. Pendente: azul (`border-l-primary`); atrasado: borda vermelha;
 * concluído: cinza com borda verde, ícone de conferido e nome riscado (D-29),
 * nunca com o acento de atraso (`estaAtrasadoAgenda2` já garante isso). Sem
 * ícone de origem nem de repetição (D-26).
 *
 * Com `showResponsavel` e nome não vazio, uma 2ª linha pequena (cortada com
 * reticências) mostra o vendedor. As duas linhas ficam num ENVOLTÓRIO `span`,
 * nunca `div`: os testes (e o `closest("div")`) esperam que a `div` mais
 * próxima do nome do cliente seja o próprio chip.
 */
function MonthItemChip({
  item,
  atrasado,
  showResponsavel,
}: {
  item: Agenda2Item
  atrasado: boolean
  showResponsavel: boolean
}) {
  const nomeResponsavel = showResponsavel
    ? (item.responsavelNome ?? "").trim()
    : ""
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded border-l-2 px-1.5 py-0.5 text-xs",
        item.concluido
          ? "bg-muted text-muted-foreground border-l-emerald-600"
          : "bg-primary/10 text-primary border-l-primary",
        atrasado && "border-l-destructive"
      )}
    >
      {item.concluido ? (
        <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate", item.concluido && "line-through")}>
          {item.nomeCliente}
        </span>
        {nomeResponsavel ? (
          <span
            data-slot="agenda2-responsavel"
            title={nomeResponsavel}
            className="truncate text-[11px] leading-tight text-muted-foreground"
          >
            {nomeResponsavel}
          </span>
        ) : null}
      </span>
    </div>
  )
}
