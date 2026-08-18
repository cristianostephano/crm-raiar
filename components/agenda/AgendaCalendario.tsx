"use client"

import { useEffect, useMemo, useState } from "react"

import { getAgendaConcluidosAction } from "@/app/actions/agenda"
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
  filtrarPorVendedor,
  intervaloDeHistorico,
  itensDoDia,
  mesclarAgenda,
  navegarData,
  rotuloDoPeriodo,
  type AgendaItem,
  type AgendaVisao,
  type CalendarioModo,
} from "@/lib/agenda/itens"

/**
 * Contêiner do calendário da Agenda (AGD-08/AGD-09/AGD-11, D-02/D-03/D-05,
 * AGD-13/Fase 21). Amarra a barra de ferramentas (`AgendaCalendarioToolbar`)
 * e as três visões já construídas (planos 20-02/20-03), e abre o diálogo
 * com a lista completa de um dia quando alguém clica numa célula da grade
 * de mês.
 *
 * (a) Este componente é o dono de TRÊS coisas: a DATA DE REFERÊNCIA do
 * calendário, o dia aberto no diálogo, e — a partir da Fase 21 — a LEITURA
 * DO HISTÓRICO (itens já concluídos), limitada ao período visível. Nada
 * mais — a busca dos PENDENTES, o filtro por vendedor sobre a primeira
 * fonte, a ficha do cliente e a janela de conclusão continuam sendo
 * responsabilidade da tela (`AgendaList.tsx`, plano 20-05), que passa os
 * dois pedidos de ação (`onOpenCliente`, `onConcluirItem`) para baixo.
 * `visao` também não é estado daqui — é controlada de fora, para que o
 * plano 20-05 possa acrescentar o alternador Lista/Calendário sem este
 * contêiner herdar esse controle.
 *
 * (b) A lista `itens` recebida já vem estreitada pelo filtro de vendedor
 * (T-20-11). O agrupamento por data é calculado UMA vez aqui
 * (`agruparPorData`, memorizado), sobre o resultado da MESCLA
 * (`mesclarAgenda`, também uma vez) entre `itens` (pendentes) e o
 * histórico buscado por este componente já estreitado pelo mesmo filtro —
 * e é o MESMO mapa passado às visões de semana e mês: recalcular a partir
 * de outra fonte, ou mais de uma vez, é a falha registrada no Pitfall 10 e
 * reabriria a porta para uma visão mostrar um conjunto diferente da outra.
 *
 * (c) A barra de ferramentas é renderizada SEMPRE, inclusive na visão de
 * Lista (onde `rotulo` é `null` e ela mostra só o seletor) — é o único
 * caminho de volta ao Calendário depois que o usuário entra na Lista.
 *
 * (d) A leitura de histórico REVERTE de propósito, e SÓ para esta segunda
 * fonte, a regra que a Fase 20 escreveu aqui (T-20-10) — ver
 * `21-04-PLAN.md`, bloco `<reversao_deliberada>`. Motivo: a busca precisa
 * ser limitada ao intervalo visível, e o intervalo visível é derivado da
 * data de referência e do modo, os dois únicos estados que este contêiner
 * possui — subir a busca para a tela exigiria subir esses dois estados
 * junto, reescrevendo a fiação que a Fase 20 acabou de entregar e que o
 * dono do projeto já verificou no navegador (o que D-01 proíbe). O que
 * continua NÃO morando aqui: a leitura de pendentes (uma única chamada por
 * recarga, na tela), a ficha do cliente e a janela de conclusão.
 */
export function AgendaCalendario({
  visao,
  onVisaoChange,
  itens,
  showResponsavel,
  vendedorFiltroId = null,
  onOpenCliente,
  onConcluirItem,
  now = new Date(),
}: {
  visao: AgendaVisao
  onVisaoChange: (visao: AgendaVisao) => void
  itens: AgendaItem[]
  showResponsavel: boolean
  /** AGD-13: identificador do vendedor filtrado (`null` = sem filtro).
   * Opcional/default `null` para que nenhum chamador existente precise
   * mudar — a única leitura nova deste plano é interna a este componente. */
  vendedorFiltroId?: string | null
  onOpenCliente: (clienteId: string) => void
  onConcluirItem: (item: AgendaItem) => void
  now?: Date
}) {
  const [referencia, setReferencia] = useState(now)
  const [diaDialogo, setDiaDialogo] = useState<Date | null>(null)
  const [concluidos, setConcluidos] = useState<AgendaItem[]>([])
  const [historicoFalhou, setHistoricoFalhou] = useState(false)

  const modo: CalendarioModo | null = visao === "lista" ? null : visao

  // AGD-13: qual intervalo buscar É DERIVADO do que está visível agora
  // (`intervaloDeHistorico`, plano 21-02) — nunca hoje/futuro, `null`
  // quando nada estritamente passado está visível (Lista incluída, onde
  // `modo` já é `null`).
  const intervalo =
    modo === null ? null : intervaloDeHistorico(referencia, modo, now)
  // Extraídos como DOIS TEXTOS, nunca o objeto inteiro: tanto `referencia`
  // quanto o padrão de `now` (`new Date()`) são recriados a cada render, e
  // qualquer um dos dois nas dependências do efeito abaixo transformaria
  // navegação normal numa enxurrada de pedidos ao servidor (T-21-13). Os
  // dois textos só mudam quando o período visível de fato muda — é isso
  // que faz a busca acontecer uma vez por período, mesmo com re-renders
  // que não mudam o período.
  const intervaloInicio = intervalo?.inicio ?? null
  const intervaloFim = intervalo?.fim ?? null

  useEffect(() => {
    if (intervaloInicio === null || intervaloFim === null) {
      // Sem intervalo (Lista, ou nada passado visível): limpa qualquer
      // histórico de um período anterior e não chama nada — buscar seria
      // uma ida ao servidor garantidamente vazia.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConcluidos([])
      setHistoricoFalhou(false)
      return
    }

    let cancelled = false

    getAgendaConcluidosAction(intervaloInicio, intervaloFim).then((result) => {
      if (cancelled) return

      if (result.error) {
        setConcluidos([])
        setHistoricoFalhou(true)
        return
      }

      setConcluidos(result.data)
      setHistoricoFalhou(false)
    })

    return () => {
      cancelled = true
    }
  }, [intervaloInicio, intervaloFim])

  // A MESMA autoridade de filtro que a tela já aplica aos pendentes,
  // aplicada aqui à segunda fonte: as duas fontes entram no componente por
  // caminhos diferentes — os pendentes chegam já estreitados de cima
  // (T-20-11), os concluídos são buscados aqui dentro — e existe uma
  // implementação só da regra, aplicada uma vez a cada fonte. Não é uma
  // segunda autoridade; é a mesma autoridade aplicada ao segundo conjunto.
  // Sem esta aplicação, o Supervisor filtrando um vendedor veria a grade
  // dizendo um nome e mostrando o histórico do time inteiro (T-21-14).
  const concluidosFiltrados = useMemo(
    () => filtrarPorVendedor(concluidos, vendedorFiltroId),
    [concluidos, vendedorFiltroId]
  )

  // Mescla uma vez só (`mesclarAgenda`, plano 21-02), ANTES do agrupamento
  // por data — agrupar duas vezes e juntar depois recriaria a divergência
  // entre chips e contagem que o plano 21-03 fechou.
  const mesclados = useMemo(
    () => mesclarAgenda(itens, concluidosFiltrados),
    [itens, concluidosFiltrados]
  )

  // Cálculo único (T-20-11): tanto a grade de mês quanto a de semana leem
  // este mesmo mapa, nunca um agrupamento recalculado por visão.
  const porData = useMemo(() => agruparPorData(mesclados), [mesclados])

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

      {historicoFalhou ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Não foi possível carregar o histórico deste período.
        </div>
      ) : null}

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
