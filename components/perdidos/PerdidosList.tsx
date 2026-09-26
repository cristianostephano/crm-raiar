"use client"

import { Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { marcarStatus } from "@/app/actions/funil"
import { getClientesPerdidosAction } from "@/app/actions/perdidos"
import { PerdidosItemRow } from "@/components/perdidos/PerdidosItemRow"
import { PerdidosPeriodoFilter } from "@/components/perdidos/PerdidosPeriodoFilter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  filtrarPerdidosPorNome,
  PERIODO_PADRAO_PERDIDOS,
  resolvePeriodoPerdidos,
  temRecortePeriodo,
  type ClientePerdido,
  type PeriodoPresetPerdidos,
} from "@/lib/perdidos/lista"

type FetchState =
  | { status: "carregando" }
  | { status: "erro" }
  | { status: "pronto"; itens: ClientePerdido[] }

/**
 * PerdidosList (PERD-02..05, D-08, D-09) — Client Component dono da tela
 * inteira (título, filtros, lista). Faz a ÚNICA leitura via
 * `getClientesPerdidosAction`; "Reabrir" reusa `marcarStatus` já existente
 * (D-08 — nenhuma ação nova é criada para isto); a linha some da tela pela
 * RELEITURA (D-09, sem remoção otimista). Regras puras (período/busca) moram
 * em lib/perdidos/lista.ts — este componente nunca duplica essa lógica.
 */
export function PerdidosList({ isSupervisor }: { isSupervisor: boolean }) {
  const [preset, setPreset] = useState<PeriodoPresetPerdidos>(
    PERIODO_PADRAO_PERDIDOS
  )
  const [customRange, setCustomRange] = useState<
    { from: Date; to: Date } | undefined
  >(undefined)
  const [busca, setBusca] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState<FetchState>({ status: "carregando" })
  const [reabrindoId, setReabrindoId] = useState<string | null>(null)
  const [reabrirErro, setReabrirErro] = useState<string | null>(null)

  // As janelas móveis (30dias/90dias) usam a hora ATUAL de quando são
  // resolvidas — sem este memo, cada render geraria um instante novo e o
  // efeito abaixo (que depende de intervalo.inicio/fim) entraria em laço
  // infinito. O memo congela o intervalo até o preset/customRange mudar.
  const intervalo = useMemo(
    () => resolvePeriodoPerdidos(preset, customRange),
    [preset, customRange]
  )

  useEffect(() => {
    let cancelled = false
    // Mesmo precedente de AgendaList.tsx: o estado de carregando precisa ser
    // marcado de forma síncrona no corpo do efeito para que o Skeleton
    // apareça a partir do próximo render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "carregando" })

    getClientesPerdidosAction(intervalo).then((result) => {
      if (cancelled) return

      if (result.error) {
        setState({ status: "erro" })
        return
      }

      setState({ status: "pronto", itens: result.data })
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalo.inicio, intervalo.fim, reloadKey])

  function handlePresetChange(novo: PeriodoPresetPerdidos) {
    setPreset(novo)
    setBusca("")
  }

  function handleCustomRangeApply(range: { from: Date; to: Date }) {
    setCustomRange(range)
    setBusca("")
  }

  // Bumpar reloadKey é a única forma de recarga desta tela (D-09): nem
  // "Reabrir" bem-sucedido nem "Tentar novamente" removem/inserem item
  // otimisticamente — os dois só incrementam reloadKey e deixam o efeito
  // acima refazer a leitura.
  function handleRecarregar() {
    setReloadKey((key) => key + 1)
  }

  async function handleReabrir(clienteId: string) {
    if (reabrindoId) return

    setReabrindoId(clienteId)
    setReabrirErro(null)
    const result = await marcarStatus(clienteId, "em_andamento")
    setReabrindoId(null)

    if (result.error) {
      setReabrirErro(result.error.message)
      return
    }

    handleRecarregar()
  }

  const showResponsavel = isSupervisor
  const itens = state.status === "pronto" ? state.itens : []
  const visiveis = filtrarPerdidosPorNome(itens, busca)
  const temRecorte = temRecortePeriodo(preset, customRange)

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="text-xl font-semibold">Perdidos</h1>

      <div className="flex flex-col gap-3 rounded-lg bg-secondary p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por nome..."
              aria-label="Buscar por nome"
              className="pl-8"
            />
          </div>
          <PerdidosPeriodoFilter
            preset={preset}
            customRange={customRange}
            onPresetChange={handlePresetChange}
            onCustomRangeApply={handleCustomRangeApply}
          />
        </div>
      </div>

      {reabrirErro ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {reabrirErro}
        </div>
      ) : null}

      {state.status === "carregando" ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : state.status === "erro" ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os clientes perdidos. Tente novamente.
          </p>
          <Button type="button" variant="outline" onClick={handleRecarregar}>
            Tentar novamente
          </Button>
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-12 text-center">
          {temRecorte ? (
            <>
              <p className="text-sm font-semibold">
                Nenhum cliente perdido nesse período
              </p>
              <p className="text-sm text-muted-foreground">
                Tente ampliar o período ou selecione &quot;Tudo&quot; para ver
                o histórico completo.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Nenhum cliente perdido</p>
              <p className="text-sm text-muted-foreground">
                Quando um cliente for marcado como perdido, ele aparece aqui.
              </p>
            </>
          )}
        </div>
      ) : visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-12 text-center">
          <p className="text-sm font-semibold">
            Nenhum cliente perdido com esse nome
          </p>
          <p className="text-sm text-muted-foreground">
            Confira a grafia ou limpe a busca.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visiveis.map((item) => (
            <PerdidosItemRow
              key={item.clienteId}
              cliente={item}
              showResponsavel={showResponsavel}
              reabrindo={reabrindoId === item.clienteId}
              onReabrir={handleReabrir}
            />
          ))}
        </div>
      )}
    </div>
  )
}
