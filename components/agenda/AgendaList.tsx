"use client"

import { Download } from "lucide-react"
import { useEffect, useState } from "react"

import {
  concluirTarefaProspeccao,
  concluirVisita,
  getAgendaAction,
  getClientesSemDiaFixoAction,
} from "@/app/actions/agenda"
import { AgendaCalendario } from "@/components/agenda/AgendaCalendario"
import { AgendaItemRow } from "@/components/agenda/AgendaItemRow"
import { AgendaSemDiaFixo } from "@/components/agenda/AgendaSemDiaFixo"
import { ConcluirItemDialog } from "@/components/agenda/ConcluirItemDialog"
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
  type AgendaVisao,
  type ClienteSemDiaFixo,
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
 * A partir da Fase 15 esta tela deixa de ser somente leitura: além do par
 * de estado da ficha do cliente, ganha um par irmão (`concluirItem`/
 * `concluirDialogOpen`) para `ConcluirItemDialog` (CONC-01/VIS-03). A
 * confirmação da janela é roteada para `concluirTarefaProspeccao` ou
 * `concluirVisita` (app/actions/agenda.ts, Plano 15-02) conforme a
 * `origem` do item selecionado, e o sucesso bumpa o mesmo `reloadKey` que
 * a ficha do cliente já usa — é essa recarga que faz o item concluído
 * sumir e a próxima visita (quando houver) aparecer na seção certa.
 *
 * A partir da Fase 20 (AGD-07/AGD-14) este componente também é o dono da
 * VISÃO ATIVA (`visao`, Lista por padrão — D-01) e compõe `AgendaCalendario`
 * como irmão da Lista, passando `itensFiltrados` — o MESMO resultado de
 * `filtrarPorVendedor` que a Lista já consome — para que o filtro de
 * vendedor do Supervisor mande nas duas visões sempre em concordância
 * (Pitfall 10). O calendário não busca dado nem duplica o filtro; recebe
 * tudo pronto e devolve os mesmos dois pedidos de ação que a Lista já
 * trata (`handleOpenCliente`/`handleOpenConcluir`).
 *
 * A partir da Fase 22 (CONC-02), `motivoConclusaoRemotaOptions` (buscado
 * pela página) é repassado à janela de conclusão, e o identificador do
 * motivo devolvido por ela é roteado para as DUAS ações de servidor
 * conforme a `origem` do item — nunca só uma (mesmo risco travado do
 * plano: a janela é uma só, mas as ações são duas).
 *
 * A partir da Fase 24 (AGENDA-01), este componente também é dono de uma
 * SEGUNDA leitura (`clientesSemDiaFixo`, via `getClientesSemDiaFixoAction`),
 * disjunta da leitura de itens de agenda — clientes ativos que ainda não têm
 * dia fixo de visita definido. O efeito que a busca depende do MESMO
 * `reloadKey` do efeito original, para reagir à mesma recarga (salvar pela
 * ficha, "Tentar novamente"). Falha em silêncio (lista vazia): este aviso é
 * auxiliar e nunca pode impedir a Agenda de carregar. Estreitada pelo MESMO
 * `filtrarPorVendedor` que a Lista já usa — nunca um segundo filtro — e
 * renderizada só na visão de Lista (`AgendaSemDiaFixo.tsx`), ANTES do corte
 * de "agenda vazia", para aparecer mesmo num dia sem pendências.
 */
export function AgendaList({
  isSupervisor,
  categoriaOptions,
  produtoOptions,
  vendedorOptions,
  motivoConclusaoRemotaOptions,
}: {
  isSupervisor: boolean
  categoriaOptions: { id: string; nome: string }[]
  produtoOptions: { id: string; nome: string }[]
  vendedorOptions: { id: string; nome: string }[]
  motivoConclusaoRemotaOptions: { id: string; nome: string }[]
}) {
  const [state, setState] = useState<FetchState>({ status: "carregando" })
  // Bumped por "Tentar novamente" e por onSaved/onDeleted da ficha do
  // cliente aberta a partir de uma linha.
  const [reloadKey, setReloadKey] = useState(0)
  // Visão ativa da tela (AGD-07). Padrão SEMPRE Lista — D-01 trata o
  // Calendário como alternativa, não substituição, e a equipe precisa
  // continuar chegando na tela do jeito que já conhece.
  const [visao, setVisao] = useState<AgendaVisao>("lista")
  const [vendedorFiltroId, setVendedorFiltroId] = useState<string | null>(
    null
  )
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(
    null
  )
  const [sheetOpen, setSheetOpen] = useState(false)
  const [concluirItem, setConcluirItem] = useState<AgendaItem | null>(null)
  const [concluirDialogOpen, setConcluirDialogOpen] = useState(false)
  const [isExportingDiario, setIsExportingDiario] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  // AGENDA-01 (Fase 24): clientes ativos sem dia fixo, começando vazio.
  const [clientesSemDiaFixo, setClientesSemDiaFixo] = useState<
    ClienteSemDiaFixo[]
  >([])

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

  // AGENDA-01 (Fase 24): segunda leitura, disjunta da agenda de itens
  // pendentes, dependente do MESMO `reloadKey` — é isso que faz a seção
  // reagir à mesma recarga que a Lista já reage (salvar pela ficha aberta a
  // partir da própria Agenda, ou clicar em "Tentar novamente"). Sem
  // `setState` síncrono no corpo deste efeito (a seção não tem esqueleto de
  // carregamento próprio, ela simplesmente aparece quando os dados chegam) —
  // por isso nenhuma supressão de lint nova é necessária aqui. Erro é
  // silencioso: este aviso é auxiliar e nunca pode impedir a Agenda de
  // carregar.
  useEffect(() => {
    let cancelled = false

    getClientesSemDiaFixoAction().then((result) => {
      if (cancelled) return
      if (result.error) {
        setClientesSemDiaFixo([])
        return
      }
      setClientesSemDiaFixo(result.data)
    })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const itens = state.status === "pronto" ? state.itens : []
  const vendedorOpcoesDoFiltro = vendedoresDaAgenda(itens)
  const itensFiltrados = filtrarPorVendedor(itens, vendedorFiltroId)
  const secoes = agruparAgenda(itensFiltrados)
  // AGENDA-01 (Fase 24): MESMO estreitamento por vendedor que a Lista já
  // aplica acima, generalizado em lib/agenda/itens.ts — nunca um segundo
  // filtro escrito aqui.
  const clientesSemDiaFixoFiltrados = filtrarPorVendedor(
    clientesSemDiaFixo,
    vendedorFiltroId
  )
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

  function handleOpenConcluir(item: AgendaItem) {
    setConcluirItem(item)
    setConcluirDialogOpen(true)
  }

  // Roteia a confirmação da janela única para a ação de servidor correta
  // conforme a origem do item — nenhuma escrita direta em tarefas/visitas
  // por aqui, sempre através de app/actions/agenda.ts (Plano 15-02).
  // Fase 22 (CONC-02): o identificador do motivo de conclusão remota vai
  // SEMPRE no fim da lista de argumentos de cada ação — nas DUAS, não só
  // numa (este é o ponto exato em que o projeto já se avisou que é fácil
  // errar).
  async function handleConfirmarConclusao(
    resumo: string,
    proximaData: string | null,
    motivoConclusaoRemotaId: string | null
  ) {
    if (!concluirItem) return undefined

    const result =
      concluirItem.origem === "prospeccao"
        ? await concluirTarefaProspeccao(
            concluirItem.itemId,
            resumo,
            motivoConclusaoRemotaId
          )
        : await concluirVisita(
            concluirItem.itemId,
            resumo,
            concluirItem.frequenciaVisita,
            proximaData,
            motivoConclusaoRemotaId
          )

    if (result.error) {
      return { error: { message: result.error.message } }
    }

    handleRecarregar()
    return undefined
  }

  /**
   * Cópia estrutural de KanbanBoard.tsx's handleExport (IMP-02, D3), com uma
   * simplificação: sem etapa de coleta de identificadores e sem corpo na
   * requisição — este download não tem parâmetro nenhum, sempre significa
   * "tudo o que eu posso ver". O estado do Select de filtro renderizado
   * acima (só existe para o Supervisor) NUNCA é consultado por esta
   * função de propósito — ler esse estado aqui devolveria a fronteira de
   * autorização para o navegador, e a fronteira real é a regra de leitura
   * no servidor.
   */
  async function handleExportDiario() {
    if (isExportingDiario) return

    setIsExportingDiario(true)
    setExportError(null)
    try {
      const res = await fetch("/api/agenda/exportar-diario", {
        method: "POST",
      })

      if (!res.ok) {
        setExportError("Não foi possível exportar o diário. Tente novamente.")
        return
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const filename = `diario_${new Date().toISOString().slice(0, 10)}.xlsx`

      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(url)
    } catch {
      setExportError("Não foi possível exportar o diário. Tente novamente.")
    } finally {
      setIsExportingDiario(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* IMP-02 (D2/D3) — botão de exportar o diário, sempre o primeiro
          elemento da tela, antes do cabeçalho de título/filtro. O rótulo
          alterna pelo indicador `isSupervisor` que este componente já
          recebe como propriedade — esse indicador escolhe SÓ o rótulo; o
          escopo do que baixa vem sempre da regra de leitura no servidor
          (RLS de `historico`), nunca deste valor. Sem estado de desabilitado
          por contagem (diferente do Kanban): a Agenda não pré-carrega uma
          contagem de diário, e buscar uma só para desabilitar o botão está
          fora de escopo — um diário vazio baixa uma planilha só com a linha
          de cabeçalho, resultado autoexplicativo, não um erro. */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={handleExportDiario}
          disabled={isExportingDiario}
        >
          <Download />
          {isExportingDiario
            ? "Exportando…"
            : isSupervisor
              ? "Exportar diário do time"
              : "Exportar meu diário"}
        </Button>
      </div>
      {exportError ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {exportError}
        </div>
      ) : null}

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
      ) : (
        <>
          {/* AGD-07/AGD-14 — irmão da Lista, nunca substituto: recebe
              `itensFiltrados`, o MESMO resultado de `filtrarPorVendedor` que
              o agrupamento em seções logo abaixo já consome, para que a
              grade nunca discorde da Lista quando o Supervisor troca o
              filtro (Pitfall 10). Nenhum segundo filtro, nenhuma segunda
              busca.
              `vendedorFiltroId` (AGD-13, Fase 21) além disso: a segunda
              fonte de dados do calendário (o histórico) é buscada lá
              dentro, não aqui, e precisa passar pelo mesmo estreitamento —
              sem repassar este identificador, a grade mostraria o
              histórico do time inteiro sob um filtro de um vendedor só. */}
          <AgendaCalendario
            visao={visao}
            onVisaoChange={setVisao}
            itens={itensFiltrados}
            showResponsavel={showResponsavel}
            vendedorFiltroId={vendedorFiltroId}
            onOpenCliente={handleOpenCliente}
            onConcluirItem={handleOpenConcluir}
          />
          {visao === "lista" ? (
            <>
              {/* AGENDA-01 (Fase 24) — sempre acima das três seções de
                  trabalho, e sempre visível mesmo com a agenda vazia: é um
                  lembrete de configuração, não um item de trabalho com data.
                  O próprio componente devolve nada quando a lista está
                  vazia. */}
              <AgendaSemDiaFixo
                clientes={clientesSemDiaFixoFiltrados}
                showResponsavel={showResponsavel}
                onOpenCliente={handleOpenCliente}
              />
              {totalItens === 0 ? (
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
                              onConcluir={() => handleOpenConcluir(item)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}
        </>
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

      {concluirItem ? (
        <ConcluirItemDialog
          open={concluirDialogOpen}
          onOpenChange={setConcluirDialogOpen}
          origem={concluirItem.origem}
          razaoSocial={concluirItem.razaoSocial}
          itemTitulo={concluirItem.titulo}
          frequenciaVisita={concluirItem.frequenciaVisita}
          proximaDataSugerida={concluirItem.proximaDataSugerida}
          motivoOptions={motivoConclusaoRemotaOptions}
          onConfirm={handleConfirmarConclusao}
        />
      ) : null}
    </div>
  )
}
