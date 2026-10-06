"use client"

import { useEffect, useMemo, useState } from "react"

import { getAgenda2PeriodoAction } from "@/app/actions/agenda2"
import { Agenda2CalendarioDia } from "@/components/agenda2/Agenda2CalendarioDia"
import { Agenda2CalendarioMes } from "@/components/agenda2/Agenda2CalendarioMes"
import { Agenda2CalendarioSemana } from "@/components/agenda2/Agenda2CalendarioSemana"
import { Agenda2CalendarioToolbar } from "@/components/agenda2/Agenda2CalendarioToolbar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  agruparPorDataAgenda2,
  intervaloVisivelAgenda2,
  itensDoDiaAgenda2,
  type Agenda2Item,
} from "@/lib/agenda2/itens"
import {
  filtrarPorVendedor,
  navegarData,
  rotuloDoPeriodo,
  type AgendaVisao,
  type CalendarioModo,
} from "@/lib/agenda/itens"

/** Mensagem fixa de falha de leitura — nunca o erro cru do servidor (T-32-06). */
const MSG_CARREGAR_CALENDARIO =
  "Não foi possível carregar o calendário deste período."

/**
 * Contêiner do calendário da Agenda 2 (AGD2-08, D-27/D-28/D-29/D-30).
 *
 * CÓPIA ADAPTADA de `components/agenda/AgendaCalendario.tsx` — o original não
 * é editado nem importado; daqui só entram funções puras e tipos de
 * `lib/agenda/itens.ts` (`navegarData`, `rotuloDoPeriodo`, `filtrarPorVendedor`).
 * Nada deste arquivo importa componentes nem Server Actions da Agenda atual.
 *
 * O que foi COPIADO: a data de referência (`referencia`), a navegação
 * (anterior/próximo/Hoje, a troca de visão preserva a data, semana na
 * segunda), a extração do intervalo em DOIS TEXTOS para as dependências do
 * efeito e a guarda `cancelled` contra resposta atrasada.
 *
 * O que foi REMOVIDO: a segunda leitura (histórico) e a mescla de duas fontes
 * — a Agenda 2 tem uma tabela só, então há uma leitura só —, a ficha de
 * cliente e a janela de conclusão com resumo.
 *
 * O que MUDOU (decisões da Fase 32):
 * - Lê só o período VISÍVEL (`intervaloVisivelAgenda2`, ROADMAP nota (e)):
 *   mês pede a grade de 6 semanas, semana pede 7 dias, dia pede 1; na Lista
 *   não lê nada.
 * - D-28: nenhuma regra de visibilidade da Lista — concluído de dia passado
 *   aparece na célula do seu dia, riscado (D-29).
 * - D-30: `filtrarPorVendedor` é um ESTREITAMENTO LOCAL sobre o que a RLS já
 *   liberou, nunca uma checagem de permissão. `podeAlterar` esconde botões do
 *   Supervisor só como reflexo visual; a fronteira é a RLS da migration 0048.
 * - `showResponsavel` (Supervisor vendo todos, calculado em Agenda2List) vai
 *   também para Semana e Mês, que mostram o nome do vendedor no chip (quick
 *   261006-fjt); é reflexo visual, a fronteira continua sendo a RLS.
 *
 * Recarga SEM PISCAR: quando `reloadKey` muda (a tela concluiu/editou/apagou),
 * os itens do período atual continuam na tela até a resposta nova chegar. O
 * Skeleton só aparece quando ainda não existe dado DO PERÍODO ATUAL (primeira
 * leitura ou troca de período). Cada resposta carrega a `chave` do período
 * que a pediu, então uma resposta de outro período nunca é mostrada
 * (Pitfall 6).
 */
export function Agenda2Calendario({
  visao,
  onVisaoChange,
  reloadKey,
  vendedorFiltroId,
  showResponsavel,
  podeAlterar,
  salvandoId,
  onEditar,
  onApagar,
  onConcluir,
  onDesmarcar,
  now = new Date(),
}: {
  visao: AgendaVisao
  onVisaoChange: (visao: AgendaVisao) => void
  reloadKey: number
  vendedorFiltroId: string | null
  showResponsavel: boolean
  podeAlterar: boolean
  salvandoId: string | null
  onEditar: (item: Agenda2Item) => void
  onApagar: (item: Agenda2Item) => void
  onConcluir: (item: Agenda2Item) => void
  onDesmarcar: (item: Agenda2Item) => void
  now?: Date
}) {
  const [referencia, setReferencia] = useState(now)
  const [carregado, setCarregado] = useState<{
    chave: string
    itens: Agenda2Item[]
  } | null>(null)
  const [falhouChave, setFalhouChave] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const [diaDialogo, setDiaDialogo] = useState<Date | null>(null)

  const modo: CalendarioModo | null = visao === "lista" ? null : visao
  const rotulo = modo === null ? null : rotuloDoPeriodo(referencia, modo)

  const intervalo =
    modo === null ? null : intervaloVisivelAgenda2(referencia, modo)
  // DOIS TEXTOS, nunca o objeto: `referencia` e o padrão de `now`
  // (`new Date()`) são recriados a cada render; só os textos mudam quando o
  // período visível de fato muda (Pitfall 5 / T-32-08).
  const inicio = intervalo?.inicio ?? null
  const fim = intervalo?.fim ?? null
  const chave = inicio === null || fim === null ? null : inicio + "|" + fim

  useEffect(() => {
    if (inicio === null || fim === null) return

    const chaveDaChamada = inicio + "|" + fim
    let cancelled = false
    // Limpa a falha anterior de forma síncrona para que "Tentar novamente"
    // volte ao estado de leitura (mesmo precedente de Agenda2List).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFalhouChave(null)

    getAgenda2PeriodoAction(inicio, fim).then((result) => {
      if (cancelled) return

      if (result.error) {
        setFalhouChave(chaveDaChamada)
        return
      }

      setCarregado({ chave: chaveDaChamada, itens: result.data })
    })

    return () => {
      cancelled = true
    }
  }, [inicio, fim, reloadKey, tentativa])

  const itensDoPeriodo = useMemo(
    () => (carregado?.chave === chave ? carregado.itens : null),
    [carregado, chave]
  )

  // D-30: estreitamento local, nunca permissão. Nenhum filtro de visibilidade
  // da Lista aqui (D-28).
  const filtrados = useMemo(
    () => filtrarPorVendedor(itensDoPeriodo ?? [], vendedorFiltroId),
    [itensDoPeriodo, vendedorFiltroId]
  )

  // Agrupamento calculado UMA vez e passado às visões de mês e semana.
  const porData = useMemo(() => agruparPorDataAgenda2(filtrados), [filtrados])

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

  // Editar/Apagar PRIMEIRO fecham o diálogo do dia e só então chamam a tela:
  // o formulário e a confirmação de apagar moram na tela (montados uma vez) e
  // não podem ficar empilhados sobre outro diálogo modal. Concluir/Desmarcar
  // são repassados direto — o diálogo continua aberto e a linha se atualiza
  // quando a recarga (`reloadKey`) chega, sem piscar.
  function handleEditarDoDialogo(item: Agenda2Item) {
    setDiaDialogo(null)
    onEditar(item)
  }

  function handleApagarDoDialogo(item: Agenda2Item) {
    setDiaDialogo(null)
    onApagar(item)
  }

  function renderCorpo() {
    if (modo === null) return null

    if (falhouChave === chave) {
      return (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {MSG_CARREGAR_CALENDARIO}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setTentativa((n) => n + 1)}
          >
            Tentar novamente
          </Button>
        </div>
      )
    }

    if (itensDoPeriodo === null) {
      return <Skeleton className="h-96 w-full" />
    }

    if (modo === "mes") {
      return (
        <Agenda2CalendarioMes
          referencia={referencia}
          porData={porData}
          onSelecionarDia={setDiaDialogo}
          now={now}
          showResponsavel={showResponsavel}
        />
      )
    }

    if (modo === "semana") {
      return (
        <Agenda2CalendarioSemana
          referencia={referencia}
          porData={porData}
          onSelecionarDia={setDiaDialogo}
          now={now}
          showResponsavel={showResponsavel}
        />
      )
    }

    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{rotulo}</h2>
        <Agenda2CalendarioDia
          itens={itensDoDiaAgenda2(porData, referencia)}
          showResponsavel={showResponsavel}
          podeAlterar={podeAlterar}
          salvandoId={salvandoId}
          onEditar={onEditar}
          onApagar={onApagar}
          onConcluir={onConcluir}
          onDesmarcar={onDesmarcar}
          now={now}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sempre montada: único caminho de volta ao calendário estando na Lista. */}
      <Agenda2CalendarioToolbar
        visao={visao}
        onVisaoChange={onVisaoChange}
        rotulo={rotulo}
        onAnterior={handleAnterior}
        onProximo={handleProximo}
        onHoje={handleHoje}
      />

      {renderCorpo()}

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
            {/* MESMO componente da visão de dia: um segundo jeito de listar
                item aqui divergiria do cartão da Lista. */}
            <Agenda2CalendarioDia
              itens={itensDoDiaAgenda2(porData, diaDialogo)}
              showResponsavel={showResponsavel}
              podeAlterar={podeAlterar}
              salvandoId={salvandoId}
              onEditar={handleEditarDoDialogo}
              onApagar={handleApagarDoDialogo}
              onConcluir={onConcluir}
              onDesmarcar={onDesmarcar}
              now={now}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
