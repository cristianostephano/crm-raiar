"use client"

import { AgendaItemRow } from "@/components/agenda/AgendaItemRow"
import { bucketDoItem, type AgendaItem } from "@/lib/agenda/itens"

/**
 * Visão de dia do calendário da Agenda (AGD-11). Lista os itens de UM dia,
 * reusando LITERALMENTE `AgendaItemRow` — o mesmo cartão que a Lista já usa
 * (D-05). Este componente é reusado duas vezes: como visão própria e como
 * conteúdo do diálogo que a visão de mês abre ao clicar num dia (AGD-09) —
 * por isso NÃO renderiza o título do dia; quem compõe (plano 20-04) fornece
 * o título nos dois lugares.
 *
 * NÃO calcula atraso: chama a autoridade única de classificação
 * (`bucketDoItem`, de `lib/agenda/itens.ts`) com o `now` recebido e repassa
 * o resultado como o indicador booleano que `AgendaItemRow` já espera —
 * exatamente como `AgendaList` faz hoje ao derivar o indicador da seção em
 * que a linha está.
 *
 * Puramente apresentacional: nenhuma leitura de dado, nenhuma ação de
 * servidor, mesma postura do cartão que compõe.
 */
export function AgendaCalendarioDia({
  itens,
  showResponsavel,
  onOpen,
  onConcluir,
  now = new Date(),
}: {
  itens: AgendaItem[]
  showResponsavel: boolean
  onOpen: (item: AgendaItem) => void
  onConcluir: (item: AgendaItem) => void
  now?: Date
}) {
  if (itens.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nada pendente para este dia.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {itens.map((item) => (
        <AgendaItemRow
          key={item.itemId}
          item={item}
          atrasado={bucketDoItem(item.data, now) === "atrasado"}
          showResponsavel={showResponsavel}
          onOpen={() => onOpen(item)}
          onConcluir={() => onConcluir(item)}
        />
      ))}
    </div>
  )
}
