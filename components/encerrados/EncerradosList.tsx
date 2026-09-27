"use client"

import { Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { marcarStatus } from "@/app/actions/funil"
import { getClientesEncerradosAction } from "@/app/actions/encerrados"
import { EncerradosItemRow } from "@/components/encerrados/EncerradosItemRow"
import { EncerradosPeriodoFilter } from "@/components/encerrados/EncerradosPeriodoFilter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  filtrarEncerradosPorNome,
  PERIODO_PADRAO_ENCERRADOS,
  resolvePeriodoEncerrados,
  temRecortePeriodoEncerrados,
  type ClienteEncerrado,
  type PeriodoPresetEncerrados,
} from "@/lib/encerrados/lista"

type FetchState =
  | { status: "carregando" }
  | { status: "erro" }
  | { status: "pronto"; itens: ClienteEncerrado[] }

/**
 * EncerradosList (D-07..D-10, ENCR-05) — Client Component dono da tela
 * inteira (título, filtros, lista). Faz a ÚNICA leitura via
 * `getClientesEncerradosAction`; "Reativar" reusa `marcarStatus` já
 * existente com `novoStatus = "ganho"` (D-10, pesquisa Don't Hand-Roll —
 * nenhuma ação nova é criada para isto; a frequência efetiva que faz o
 * toque único funcionar é resolvida no servidor, 29-04). A linha some da
 * tela pela RELEITURA (D-09, sem remoção otimista). Regras puras
 * (período/busca) moram em lib/encerrados/lista.ts — este componente nunca
 * duplica essa lógica.
 *
 * Componente IRMÃO de components/perdidos/PerdidosList.tsx (Fase 28) — sem
 * nenhum import cruzado (Pitfall 4).
 */
export function EncerradosList({ isSupervisor }: { isSupervisor: boolean }) {
  const [preset, setPreset] = useState<PeriodoPresetEncerrados>(
    PERIODO_PADRAO_ENCERRADOS
  )
  const [customRange, setCustomRange] = useState<
    { from: Date; to: Date } | undefined
  >(undefined)
  const [busca, setBusca] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState<FetchState>({ status: "carregando" })
  const [reativandoId, setReativandoId] = useState<string | null>(null)
  const [reativarErro, setReativarErro] = useState<string | null>(null)

  // As janelas móveis (30dias/90dias) usam a hora ATUAL de quando são
  // resolvidas — sem este memo, cada render geraria um instante novo e o
  // efeito abaixo (que depende de intervalo.inicio/fim) entraria em laço
  // infinito. O memo congela o intervalo até o preset/customRange mudar.
  const intervalo = useMemo(
    () => resolvePeriodoEncerrados(preset, customRange),
    [preset, customRange]
  )

  useEffect(() => {
    let cancelled = false
    // Mesmo precedente de AgendaList.tsx: o estado de carregando precisa ser
    // marcado de forma síncrona no corpo do efeito para que o Skeleton
    // apareça a partir do próximo render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "carregando" })

    getClientesEncerradosAction(intervalo).then((result) => {
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

  function handlePresetChange(novo: PeriodoPresetEncerrados) {
    setPreset(novo)
    setBusca("")
  }

  function handleCustomRangeApply(range: { from: Date; to: Date }) {
    setCustomRange(range)
    setBusca("")
  }

  // Bumpar reloadKey é a única forma de recarga desta tela (D-09): nem
  // "Reativar" bem-sucedido nem "Tentar novamente" removem/inserem item
  // otimisticamente — os dois só incrementam reloadKey e deixam o efeito
  // acima refazer a leitura.
  function handleRecarregar() {
    setReloadKey((key) => key + 1)
  }

  async function handleReativar(clienteId: string) {
    if (reativandoId) return

    setReativandoId(clienteId)
    setReativarErro(null)
    const result = await marcarStatus(clienteId, "ganho")
    setReativandoId(null)

    if (result.error) {
      setReativarErro(result.error.message)
      return
    }

    handleRecarregar()
  }

  const showResponsavel = isSupervisor
  const itens = state.status === "pronto" ? state.itens : []
  const visiveis = filtrarEncerradosPorNome(itens, busca)
  const temRecorte = temRecortePeriodoEncerrados(preset, customRange)

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="text-xl font-semibold">Encerrados</h1>

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
          <EncerradosPeriodoFilter
            preset={preset}
            customRange={customRange}
            onPresetChange={handlePresetChange}
            onCustomRangeApply={handleCustomRangeApply}
          />
        </div>
      </div>

      {reativarErro ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {reativarErro}
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
            Não foi possível carregar os clientes encerrados. Tente novamente.
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
                Nenhum cliente encerrado nesse período
              </p>
              <p className="text-sm text-muted-foreground">
                Tente ampliar o período ou selecione &quot;Tudo&quot; para ver
                o histórico completo.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Nenhum cliente encerrado</p>
              <p className="text-sm text-muted-foreground">
                Quando um cliente for encerrado, ele aparece aqui.
              </p>
            </>
          )}
        </div>
      ) : visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-12 text-center">
          <p className="text-sm font-semibold">
            Nenhum cliente encerrado com esse nome
          </p>
          <p className="text-sm text-muted-foreground">
            Confira a grafia ou limpe a busca.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visiveis.map((item) => (
            <EncerradosItemRow
              key={item.clienteId}
              cliente={item}
              showResponsavel={showResponsavel}
              reativando={reativandoId === item.clienteId}
              onReativar={handleReativar}
            />
          ))}
        </div>
      )}
    </div>
  )
}
