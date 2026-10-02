"use client"

import { Agenda2ItemRow } from "@/components/agenda2/Agenda2ItemRow"
import { estaAtrasadoAgenda2, type Agenda2Item } from "@/lib/agenda2/itens"

/**
 * Visão de dia do calendário da Agenda 2 (AGD2-08, D-27/D-28/D-29).
 *
 * CÓPIA de `components/agenda/AgendaCalendarioDia.tsx`. Mudanças: o cartão é
 * `Agenda2ItemRow` (Fase 31) no lugar de `AgendaItemRow`, com os quatro
 * callbacks (Editar/Apagar/Concluir/Desmarcar) repassando o próprio item; o
 * atraso vem de `estaAtrasadoAgenda2` (concluído nunca é atrasado); o dia
 * mostra pendentes E concluídos (D-28). Nada desta pasta importa componentes
 * nem ações da Agenda atual — só funções puras e tipos de `lib/`.
 *
 * NÃO renderiza o título do dia: quem compõe fornece (a visão de dia e o
 * diálogo aberto pela visão de mês reusam este componente). Puramente
 * apresentacional: nenhuma leitura de dado, nenhuma ação de servidor.
 * `podeAlterar` false (Supervisor) esconde todos os botões de escrita; a RLS
 * da tabela barra a escrita de qualquer forma.
 */
export function Agenda2CalendarioDia({
  itens,
  showResponsavel,
  podeAlterar,
  salvandoId,
  onEditar,
  onApagar,
  onConcluir,
  onDesmarcar,
  now = new Date(),
}: {
  itens: Agenda2Item[]
  showResponsavel: boolean
  podeAlterar: boolean
  salvandoId: string | null
  onEditar: (item: Agenda2Item) => void
  onApagar: (item: Agenda2Item) => void
  onConcluir: (item: Agenda2Item) => void
  onDesmarcar: (item: Agenda2Item) => void
  now?: Date
}) {
  if (itens.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhuma visita neste dia.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {itens.map((item) => (
        <Agenda2ItemRow
          key={item.id}
          item={item}
          atrasado={estaAtrasadoAgenda2(item, now)}
          showResponsavel={showResponsavel}
          podeAlterar={podeAlterar}
          salvando={salvandoId === item.id}
          onEditar={() => onEditar(item)}
          onApagar={() => onApagar(item)}
          onConcluir={() => onConcluir(item)}
          onDesmarcar={() => onDesmarcar(item)}
        />
      ))}
    </div>
  )
}
