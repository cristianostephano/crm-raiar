"use client"

import { format, isSameDay, isSameMonth } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { KeyboardEvent } from "react"

import {
  chaveDoDia,
  diasDaGradeDoMes,
  itensDoDia,
  rotulosDosDiasDaSemana,
  type AgendaItem,
} from "@/lib/agenda/itens"
import { cn } from "@/lib/utils"

/**
 * Visão de mês do calendário da Agenda (AGD-09/AGD-12). Grade de 7 colunas
 * por até 6 linhas, cada célula abrindo a lista completa daquele dia.
 *
 * (a) A grade de dias e os rótulos de cabeçalho vêm SEMPRE do módulo puro
 * (`diasDaGradeDoMes`/`rotulosDosDiasDaSemana`, plano 20-01), nunca de
 * aritmética de calendário escrita aqui — é isso que garante que a visão de
 * mês e a de semana nunca discordem sobre em qual coluna cada data cai
 * (Pitfall 8). Escrever a ordem das colunas à mão é exatamente o erro que
 * causaria esse desalinhamento.
 * (b) O componente é apresentacional: recebe o agrupamento (`porData`) já
 * calculado sobre o conjunto filtrado, não busca dado, não filtra e não
 * reagrupa.
 * (c) PITFALL 9, explícito desde já: "pertencer ao mês visível" e "estar
 * atrasado" são duas perguntas independentes, cada uma com seu próprio
 * caminho de estilo. Um item atrasado que caia numa célula de mês vizinho (a
 * borda da grade) precisa continuar gritando (acento vermelho, na Task 2)
 * mesmo dentro de uma célula esmaecida — misturar os dois num booleano só
 * apagaria essa informação exatamente na borda da grade, onde ela mais
 * importa. Por isso os dois booleanos abaixo (`noMesVisivel`, `ehHoje`) são
 * calculados separadamente e nomeados de forma inequívoca, e cada um governa
 * APENAS o seu próprio pedaço de estilo.
 */
export function AgendaCalendarioMes({
  referencia,
  porData,
  onSelecionarDia,
  now = new Date(),
}: {
  referencia: Date
  porData: Map<string, AgendaItem[]>
  onSelecionarDia: (dia: Date) => void
  now?: Date
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
            itens={itensDoDia(porData, dia)}
            onSelecionar={onSelecionarDia}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Uma célula de dia da grade. Alvo de clique é a célula inteira, com área
 * generosa (`min-h-28`) — chips individualmente clicáveis dentro de uma
 * célula de poucas dezenas de pixels tornariam a ação inalcançável na
 * prática, e contradiriam a leitura do esboço ("clique no dia abre a lista
 * completa daquele dia"). O conteúdo de itens (chips + indicador de
 * excedente) é preenchido na Task 2; esta task deixa a estrutura, os dois
 * estados visuais e a acessibilidade prontos.
 */
function MonthDayCell({
  dia,
  noMesVisivel,
  ehHoje,
  ultimaColuna,
  itens,
  onSelecionar,
}: {
  dia: Date
  noMesVisivel: boolean
  ehHoje: boolean
  ultimaColuna: boolean
  itens: AgendaItem[]
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

  const rotuloAcessivel = `${format(dia, "EEEE, d 'de' MMMM", {
    locale: ptBR,
  })}, ${itens.length} ${itens.length === 1 ? "item" : "itens"}`

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
    </div>
  )
}
