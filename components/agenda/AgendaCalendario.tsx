"use client"

import { useMemo, useState } from "react"

import { AgendaCalendarioDia } from "@/components/agenda/AgendaCalendarioDia"
import { AgendaCalendarioMes } from "@/components/agenda/AgendaCalendarioMes"
import { AgendaCalendarioSemana } from "@/components/agenda/AgendaCalendarioSemana"
import { AgendaCalendarioToolbar } from "@/components/agenda/AgendaCalendarioToolbar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  agruparPorData,
  itensDoDia,
  navegarData,
  rotuloDoPeriodo,
  type AgendaItem,
  type AgendaVisao,
  type CalendarioModo,
} from "@/lib/agenda/itens"

/**
 * Contêiner do calendário da Agenda (AGD-08/AGD-09/AGD-11, D-02/D-03/D-05).
 * Amarra a barra de ferramentas (`AgendaCalendarioToolbar`) e as três visões
 * já construídas (planos 20-02/20-03), e abre o diálogo com a lista
 * completa de um dia quando alguém clica numa célula da grade de mês.
 *
 * (a) Este componente é o dono de exatamente duas coisas: a DATA DE
 * REFERÊNCIA do calendário e o dia aberto no diálogo. Nada mais — a busca
 * dos itens, o filtro por vendedor, a ficha do cliente e a janela de
 * conclusão continuam sendo responsabilidade da tela (`AgendaList.tsx`,
 * plano 20-05), que passa os dois pedidos de ação (`onOpenCliente`,
 * `onConcluirItem`) para baixo. `visao` também não é estado daqui — é
 * controlada de fora, para que o plano 20-05 possa acrescentar o alternador
 * Lista/Calendário sem este contêiner herdar esse controle.
 *
 * (b) A lista `itens` recebida já vem estreitada pelo filtro de vendedor
 * (T-20-11). O agrupamento por data é calculado UMA vez aqui
 * (`agruparPorData`, memorizado por `itens`) e é o MESMO mapa passado às
 * visões de semana e mês — recalcular a partir de outra fonte, ou mais de
 * uma vez, é a falha registrada no Pitfall 10 e reabriria a porta para uma
 * visão mostrar um conjunto diferente da outra.
 *
 * (c) A barra de ferramentas é renderizada SEMPRE, inclusive na visão de
 * Lista (onde `rotulo` é `null` e ela mostra só o seletor) — é o único
 * caminho de volta ao Calendário depois que o usuário entra na Lista.
 *
 * Nenhuma leitura de dado nem chamada de ação de servidor aqui (T-20-10):
 * quem executa "concluir" e "abrir ficha" continua sendo `AgendaList.tsx`,
 * através das ações de servidor já existentes.
 */
export function AgendaCalendario({
  visao,
  onVisaoChange,
  itens,
  showResponsavel,
  onOpenCliente,
  onConcluirItem,
  now = new Date(),
}: {
  visao: AgendaVisao
  onVisaoChange: (visao: AgendaVisao) => void
  itens: AgendaItem[]
  showResponsavel: boolean
  onOpenCliente: (clienteId: string) => void
  onConcluirItem: (item: AgendaItem) => void
  now?: Date
}) {
  const [referencia, setReferencia] = useState(now)
  const [diaDialogo, setDiaDialogo] = useState<Date | null>(null)

  const modo: CalendarioModo | null = visao === "lista" ? null : visao

  // Cálculo único (T-20-11): tanto a grade de mês quanto a de semana leem
  // este mesmo mapa, nunca um agrupamento recalculado por visão.
  const porData = useMemo(() => agruparPorData(itens), [itens])

  const rotulo = modo === null ? null : rotuloDoPeriodo(referencia, modo)

  function handleAnterior() {
    if (modo === null) return
    setReferencia(navegarData(referencia, modo, -1))
  }

  function handleProximo() {
    if (modo === null) return
    setReferencia(navegarData(referencia, modo, 1))
  }

  function handleHoje() {
    setReferencia(now)
  }

  function handleSelecionarDia(dia: Date) {
    setDiaDialogo(dia)
  }

  function handleOpen(item: AgendaItem) {
    onOpenCliente(item.clienteId)
  }

  return (
    <div className="flex flex-col gap-4">
      <AgendaCalendarioToolbar
        visao={visao}
        onVisaoChange={onVisaoChange}
        rotulo={rotulo}
        onAnterior={handleAnterior}
        onProximo={handleProximo}
        onHoje={handleHoje}
      />

      {modo === "mes" ? (
        <AgendaCalendarioMes
          referencia={referencia}
          porData={porData}
          onSelecionarDia={handleSelecionarDia}
          now={now}
        />
      ) : null}

      {modo === "semana" ? (
        <AgendaCalendarioSemana
          referencia={referencia}
          porData={porData}
          onOpenItem={handleOpen}
          now={now}
        />
      ) : null}

      {modo === "dia" ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{rotulo}</h2>
          <AgendaCalendarioDia
            itens={itensDoDia(porData, referencia)}
            showResponsavel={showResponsavel}
            onOpen={handleOpen}
            onConcluir={onConcluirItem}
            now={now}
          />
        </div>
      ) : null}

      {diaDialogo ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setDiaDialogo(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{rotuloDoPeriodo(diaDialogo, "dia")}</DialogTitle>
            </DialogHeader>
            {/* MESMO componente da visão de dia (D-03/D-05) — a lista do
                dia dentro do diálogo, a visão de dia e a Lista da tela
                mostram todas o mesmo cartão de item (AgendaItemRow, via
                AgendaCalendarioDia). Um segundo jeito de listar item aqui
                quebraria a cadeia inteira que o AGD-11 pede. */}
            <AgendaCalendarioDia
              itens={itensDoDia(porData, diaDialogo)}
              showResponsavel={showResponsavel}
              onOpen={handleOpen}
              onConcluir={onConcluirItem}
              now={now}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
