"use client"

import { Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { getClientesGanhosAction } from "@/app/actions/ganhos"
import { ClienteDetailSheet } from "@/components/clientes/ClienteDetailSheet"
import { GanhosItemRow } from "@/components/ganhos/GanhosItemRow"
import { GanhosPeriodoFilter } from "@/components/ganhos/GanhosPeriodoFilter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  filtrarGanhosPorNome,
  PERIODO_PADRAO_GANHOS,
  resolvePeriodoGanhos,
  temRecortePeriodoGanhos,
  type ClienteGanho,
  type PeriodoPresetGanhos,
} from "@/lib/ganhos/lista"

type FetchState =
  | { status: "carregando" }
  | { status: "erro" }
  | { status: "pronto"; itens: ClienteGanho[] }

/**
 * GanhosList (quick 261008-rxw) — Client Component dono da tela inteira
 * (título, filtros, lista). Tela irmã de PerdidosList, mas SEM nenhuma ação na
 * linha (P-03): clicar numa linha abre a MESMA ficha do funil
 * (ClienteDetailSheet) — é nela que se preenche ou corrige a "Data do ganho".
 * Salvar, apagar ou encerrar pela ficha recarrega a lista (reloadKey, sem
 * remoção otimista); um cliente encerrado some desta tela.
 *
 * Faz a ÚNICA leitura via `getClientesGanhosAction`. Regras puras
 * (período/busca) moram em lib/ganhos/lista.ts — este componente nunca
 * duplica essa lógica.
 *
 * LGPD: a lista só mostra nome, data do ganho e, para o Supervisor, o nome do
 * vendedor. Esconder o vendedor de quem não é Supervisor é só de TELA (P-11);
 * quem decide quais linhas cada pessoa recebe é a RLS do banco. Telefone,
 * e-mail e contato ficam só dentro da ficha.
 */
export function GanhosList({
  isSupervisor,
  categoriaOptions,
  produtoOptions,
  vendedorOptions,
}: {
  isSupervisor: boolean
  categoriaOptions: { id: string; nome: string }[]
  produtoOptions: { id: string; nome: string }[]
  vendedorOptions: { id: string; nome: string }[]
}) {
  const [preset, setPreset] = useState<PeriodoPresetGanhos>(PERIODO_PADRAO_GANHOS)
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | undefined>(
    undefined
  )
  const [busca, setBusca] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState<FetchState>({ status: "carregando" })
  const [clienteAbertoId, setClienteAbertoId] = useState<string | null>(null)

  // As janelas móveis (30dias/90dias) usam a hora ATUAL de quando são
  // resolvidas — sem este memo, cada render geraria um instante novo e o
  // efeito abaixo (que depende de intervalo.inicio/fim) entraria em laço
  // infinito. O memo congela o intervalo até o preset/customRange mudar.
  const intervalo = useMemo(
    () => resolvePeriodoGanhos(preset, customRange),
    [preset, customRange]
  )

  useEffect(() => {
    let cancelled = false
    // Mesmo precedente de AgendaList.tsx/PerdidosList.tsx: o estado de
    // carregando precisa ser marcado de forma síncrona no corpo do efeito para
    // que o Skeleton apareça a partir do próximo render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "carregando" })

    getClientesGanhosAction(intervalo).then((result) => {
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

  function handlePresetChange(novo: PeriodoPresetGanhos) {
    setPreset(novo)
    setBusca("")
  }

  function handleCustomRangeApply(range: { from: Date; to: Date }) {
    setCustomRange(range)
    setBusca("")
  }

  // Bumpar reloadKey é a única forma de recarga desta tela: "Tentar
  // novamente" e salvar/apagar/encerrar pela ficha só incrementam reloadKey e
  // deixam o efeito acima refazer a leitura.
  function handleRecarregar() {
    setReloadKey((key) => key + 1)
  }

  function handleAbrirFicha(clienteId: string) {
    setClienteAbertoId(clienteId)
  }

  const showResponsavel = isSupervisor
  const itens = state.status === "pronto" ? state.itens : []
  const visiveis = filtrarGanhosPorNome(itens, busca)
  const temRecorte = temRecortePeriodoGanhos(preset, customRange)

  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="text-xl font-semibold">Ganhos</h1>

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
          <GanhosPeriodoFilter
            preset={preset}
            customRange={customRange}
            onPresetChange={handlePresetChange}
            onCustomRangeApply={handleCustomRangeApply}
          />
        </div>
        {temRecorte ? (
          <p className="text-xs text-muted-foreground">
            Clientes sem data do ganho aparecem só em &quot;Tudo&quot;.
          </p>
        ) : null}
      </div>

      {state.status === "carregando" ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : state.status === "erro" ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar os clientes ganhos. Tente novamente.
          </p>
          <Button type="button" variant="outline" onClick={handleRecarregar}>
            Tentar novamente
          </Button>
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-12 text-center">
          {temRecorte ? (
            <>
              <p className="text-sm font-semibold">Nenhum cliente ganho nesse período</p>
              <p className="text-sm text-muted-foreground">
                Tente ampliar o período ou selecione &quot;Tudo&quot; para ver o histórico
                completo.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Nenhum cliente ganho</p>
              <p className="text-sm text-muted-foreground">
                Quando um cliente for marcado como ganho, ele aparece aqui.
              </p>
            </>
          )}
        </div>
      ) : visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-12 text-center">
          <p className="text-sm font-semibold">Nenhum cliente ganho com esse nome</p>
          <p className="text-sm text-muted-foreground">Confira a grafia ou limpe a busca.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visiveis.map((item) => (
            <GanhosItemRow
              key={item.clienteId}
              cliente={item}
              showResponsavel={showResponsavel}
              onAbrir={handleAbrirFicha}
            />
          ))}
        </div>
      )}

      {/* A MESMA ficha do funil (D-05). Sem currentUserId, igual à Agenda
          (P-08): quem não é Supervisor nunca vê o botão de apagar aqui. */}
      <ClienteDetailSheet
        clienteId={clienteAbertoId}
        open={clienteAbertoId !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setClienteAbertoId(null)
        }}
        isSupervisor={isSupervisor}
        categoriaOptions={categoriaOptions}
        produtoOptions={produtoOptions}
        vendedorOptions={vendedorOptions}
        onSaved={handleRecarregar}
        onDeleted={handleRecarregar}
        onStatusChanged={handleRecarregar}
      />
    </div>
  )
}
