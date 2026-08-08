"use client"

import { useEffect, useState } from "react"

import { getAgendaAction } from "@/app/actions/agenda"
import { AgendaItemRow } from "@/components/agenda/AgendaItemRow"
import { ClienteDetailSheet } from "@/components/clientes/ClienteDetailSheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  agruparAgenda,
  filtrarPorVendedor,
  vendedoresDaAgenda,
  type AgendaBucket,
  type AgendaItem,
} from "@/lib/agenda/itens"

/** Sentinel Select value para "sem filtro" — mesma convenção que
 * FiltersPopover.tsx já estabelece ("" é reservado pelo Select da base-ui
 * para o estado de placeholder). */
const SEM_FILTRO = "__todos__"

const SECAO_ORDEM: AgendaBucket[] = ["atrasado", "hoje", "proximos"]

function tituloSecao(bucket: AgendaBucket, count: number): string {
  if (bucket === "atrasado") return `Atrasado (${count})`
  if (bucket === "hoje") return `Hoje (${count})`
  return `Próximos dias (${count})`
}

type FetchState =
  | { status: "carregando" }
  | { status: "erro" }
  | { status: "pronto"; itens: AgendaItem[] }

/**
 * AgendaList (AGD-01/AGD-03/AGD-05) — Client Component que é o dono do
 * cabeçalho da tela inteira (título, subtítulo e filtro), faz a ÚNICA
 * leitura via `getAgendaAction()`, reparte em Atrasado/Hoje/Próximos dias e
 * oferece o filtro de vendedor ao Supervisor. Nenhuma decisão de negócio é
 * duplicada aqui — `agruparAgenda`/`filtrarPorVendedor`/`vendedoresDaAgenda`
 * de `lib/agenda/itens.ts` são a autoridade única.
 *
 * Fetch-on-mount mirrors ComparativoVendedorTable.tsx exatamente:
 * `FetchState` em união discriminada, `useEffect` com `setState` síncrono no
 * corpo, guarda `cancelled` e `reloadKey` bumpado pelo "Tentar novamente" —
 * o mesmo contador também é bumpado por `onSaved`/`onDeleted` da ficha do
 * cliente, já que salvar ou apagar um cliente pode mudar o que aparece
 * aqui.
 *
 * PROIBIDO nesta tela (pertence à Fase 15 — fluxo de finalização de item):
 * botão de marcar item como feito, campo de anotação de fechamento,
 * sugestão/seletor de data seguinte, qualquer chamada de escrita.
 */
export function AgendaList({
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
  const [state, setState] = useState<FetchState>({ status: "carregando" })
  // Bumped por "Tentar novamente" e por onSaved/onDeleted da ficha do
  // cliente aberta a partir de uma linha.
  const [reloadKey, setReloadKey] = useState(0)
  const [vendedorFiltroId, setVendedorFiltroId] = useState<string | null>(
    null
  )
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(
    null
  )
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Mesmo precedente de ComparativoVendedorTable.tsx: o estado de
    // carregando precisa ser marcado de forma síncrona no corpo do efeito
    // para que o Skeleton apareça a partir do próximo render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "carregando" })

    getAgendaAction().then((result) => {
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
  }, [reloadKey])

  const itens = state.status === "pronto" ? state.itens : []
  const vendedorOpcoesDoFiltro = vendedoresDaAgenda(itens)
  const itensFiltrados = filtrarPorVendedor(itens, vendedorFiltroId)
  const secoes = agruparAgenda(itensFiltrados)
  // O nome do vendedor só aparece na linha para o Supervisor vendo todos —
  // escolhido um vendedor específico, repetir o nome em toda linha é ruído.
  const showResponsavel = isSupervisor && vendedorFiltroId === null

  const nomeVendedorSelecionado = vendedorOpcoesDoFiltro.find(
    (vendedor) => vendedor.id === vendedorFiltroId
  )?.nome

  const selectItems = [
    { value: SEM_FILTRO, label: "Todos os vendedores" },
    ...vendedorOpcoesDoFiltro.map((vendedor) => ({
      value: vendedor.id,
      label: vendedor.nome,
    })),
  ]

  const totalItens =
    secoes.atrasado.length + secoes.hoje.length + secoes.proximos.length

  function handleOpenCliente(clienteId: string) {
    setSelectedClienteId(clienteId)
    setSheetOpen(true)
  }

  function handleRecarregar() {
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            O que você precisa fazer, do mais urgente ao mais distante.
          </p>
        </div>
        {isSupervisor ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agenda-filtro-vendedor">Vendedor</Label>
            <Select
              value={vendedorFiltroId ?? SEM_FILTRO}
              onValueChange={(value) =>
                setVendedorFiltroId(
                  value === SEM_FILTRO ? null : String(value)
                )
              }
              items={selectItems}
            >
              <SelectTrigger id="agenda-filtro-vendedor" className="w-56">
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_FILTRO}>
                  Todos os vendedores
                </SelectItem>
                {vendedorOpcoesDoFiltro.map((vendedor) => (
                  <SelectItem key={vendedor.id} value={vendedor.id}>
                    {vendedor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            Não foi possível carregar sua agenda. Tente novamente.
          </p>
          <Button type="button" variant="outline" onClick={handleRecarregar}>
            Tentar novamente
          </Button>
        </div>
      ) : totalItens === 0 ? (
        vendedorFiltroId !== null ? (
          <div className="flex flex-col items-center gap-1 py-16 text-center">
            <p className="text-base font-semibold">
              {`Nenhum item pendente para ${nomeVendedorSelecionado ?? ""}.`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-16 text-center">
            <p className="text-base font-semibold">
              Sua agenda está em dia
            </p>
            <p className="text-sm text-muted-foreground">
              Nenhuma tarefa de prospecção ou visita pendente no momento.
            </p>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-6">
          {SECAO_ORDEM.map((bucket) => {
            const itensDaSecao = secoes[bucket]
            if (itensDaSecao.length === 0) return null

            return (
              <div key={bucket} className="flex flex-col gap-2">
                <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {tituloSecao(bucket, itensDaSecao.length)}
                </h2>
                <div className="flex flex-col gap-2">
                  {itensDaSecao.map((item) => (
                    <AgendaItemRow
                      key={item.itemId}
                      item={item}
                      atrasado={bucket === "atrasado"}
                      showResponsavel={showResponsavel}
                      onOpen={() => handleOpenCliente(item.clienteId)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ClienteDetailSheet
        clienteId={selectedClienteId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        isSupervisor={isSupervisor}
        categoriaOptions={categoriaOptions}
        produtoOptions={produtoOptions}
        vendedorOptions={vendedorOptions}
        onSaved={handleRecarregar}
        onDeleted={handleRecarregar}
      />
    </div>
  )
}
