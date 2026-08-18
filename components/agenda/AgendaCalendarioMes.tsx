"use client"

import { format, isSameDay, isSameMonth } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle2, ClipboardCheck, Repeat } from "lucide-react"
import type { KeyboardEvent } from "react"

import {
  MAX_ITENS_NA_CELULA,
  chaveDoDia,
  diasDaGradeDoMes,
  dividirCelula,
  estaAtrasado,
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
 * (c) PITFALL 9, explícito desde já: "pertencer ao mês visível", "estar
 * atrasado" e — desde a Fase 21/AGD-13 — "estar concluído" são TRÊS
 * perguntas independentes, cada uma com seu próprio caminho de estilo. Um
 * item atrasado que caia numa célula de mês vizinho (a borda da grade)
 * precisa continuar gritando (acento vermelho) mesmo dentro de uma célula
 * esmaecida, e um item concluído nunca recebe esse acento vermelho — nem
 * mesmo na borda da grade — porque a autoridade única de atraso do
 * calendário (`estaAtrasado`) já embute essa exceção. Misturar as três num
 * booleano só apagaria alguma dessas informações exatamente onde ela mais
 * importa. Por isso os dois booleanos de célula abaixo (`noMesVisivel`,
 * `ehHoje`) são calculados separadamente e nomeados de forma inequívoca, e
 * cada um governa APENAS o seu próprio pedaço de estilo — o terceiro estado
 * (concluído) mora no próprio item e é lido no chip, não na célula.
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
            now={now}
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
 * completa daquele dia"). Nenhum chip nem o indicador de excedente recebe
 * tratador de clique próprio: o clique sobe (bubbling) até esta `div`, que
 * já é o alvo.
 *
 * Os itens visíveis e o excedente vêm de UMA ÚNICA chamada a
 * `dividirCelula`, sobre a MESMA lista obtida de `itensDoDia` — dois
 * cálculos independentes (um para os chips, outro para o "+N") poderiam
 * divergir quando o Supervisor troca o filtro de vendedor, que é a falha
 * exata registrada no Pitfall 10.
 */
function MonthDayCell({
  dia,
  noMesVisivel,
  ehHoje,
  ultimaColuna,
  itens,
  now,
  onSelecionar,
}: {
  dia: Date
  noMesVisivel: boolean
  ehHoje: boolean
  ultimaColuna: boolean
  itens: AgendaItem[]
  now: Date
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

  const { visiveis, excedente } = dividirCelula(itens, MAX_ITENS_NA_CELULA)
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
      {visiveis.length > 0 ? (
        <div className="flex flex-1 flex-col gap-1">
          {visiveis.map((item) => (
            <MonthItemChip
              key={item.itemId}
              item={item}
              atrasado={estaAtrasado(item, now)}
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
 * Chip de um item dentro da célula de mês — resumo visual, não alvo de
 * clique independente (por isso não tem `role`, `tabIndex` nem `onClick`
 * próprio). Reproduz em escala reduzida a mesma linguagem visual do cartão
 * da Lista (`AgendaItemRow`, AGD-12): ícone de prancheta + tratamento cinza
 * para prospecção, ícone de repetição + tratamento azul para visita.
 *
 * A cor é decidida em ETAPAS, na mesma ordem do cartão pequeno da visão de
 * semana (`WeekItemChip`, plano 21-03): primeiro o par fundo/texto/borda-
 * lateral da origem, depois — só depois, via `cn`, que resolve utilitários
 * conflitantes mantendo o último — o acento de erro sobrescrevendo apenas a
 * cor da borda lateral quando atrasado, OU o acento verde-esmeralda quando
 * concluído (nunca os dois juntos, já que `estaAtrasado` garante que item
 * concluído nunca é atrasado). O acento SE SOMA à origem, não a substitui
 * (D-10/AGD-12): um item de visita atrasado continua mostrando o ícone de
 * repetição, um item concluído continua mostrando o ícone de origem SOMADO
 * ao ícone de conferido, e um item atrasado numa célula de mês vizinho
 * esmaecida continua com a borda vermelha legível (Pitfall 9).
 */
function MonthItemChip({
  item,
  atrasado,
}: {
  item: AgendaItem
  atrasado: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded border-l-2 px-1.5 py-0.5 text-xs",
        item.origem === "prospeccao"
          ? "bg-muted text-muted-foreground border-l-muted-foreground"
          : "bg-primary/10 text-primary border-l-primary",
        atrasado && "border-l-destructive",
        item.concluido && "border-l-emerald-600",
        item.concluido && "opacity-60"
      )}
    >
      {item.origem === "prospeccao" ? (
        <ClipboardCheck className="size-3 shrink-0 text-muted-foreground" />
      ) : (
        <Repeat className="size-3 shrink-0 text-primary" />
      )}
      {item.concluido ? (
        <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{item.razaoSocial}</span>
    </div>
  )
}
