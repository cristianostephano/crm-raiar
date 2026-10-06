"use client"

import { Plus } from "lucide-react"
import { useEffect, useState } from "react"

import {
  apagarAgenda2Item,
  concluirAgenda2Item,
  desmarcarAgenda2Item,
  getAgenda2Action,
} from "@/app/actions/agenda2"
import { Agenda2ApagarDialog } from "@/components/agenda2/Agenda2ApagarDialog"
import { Agenda2Calendario } from "@/components/agenda2/Agenda2Calendario"
import { Agenda2ConcluirDialog } from "@/components/agenda2/Agenda2ConcluirDialog"
import { Agenda2ItemForm } from "@/components/agenda2/Agenda2ItemForm"
import { Agenda2ItemRow } from "@/components/agenda2/Agenda2ItemRow"
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
  agruparAgenda2,
  itensDaListaAgenda2,
  vendedoresDaAgenda2,
  type Agenda2Item,
} from "@/lib/agenda2/itens"
import {
  filtrarPorVendedor,
  type AgendaBucket,
  type AgendaVisao,
} from "@/lib/agenda/itens"

/** Sentinel Select value para "sem filtro" — mesma convenção de AgendaList.tsx
 * ("" é reservado pelo Select da base-ui para o estado de placeholder). */
const SEM_FILTRO = "__todos__"

const SECAO_ORDEM: AgendaBucket[] = ["atrasado", "hoje", "proximos"]

function tituloSecao(bucket: AgendaBucket, count: number): string {
  if (bucket === "atrasado") return `Atrasado (${count})`
  if (bucket === "hoje") return `Hoje (${count})`
  return `Próximos dias (${count})`
}

const MSG_SALVAR_FALHOU = "Não foi possível salvar. Tente novamente."
const MSG_CARREGAR_FALHOU =
  "Não foi possível carregar sua Agenda. Tente novamente."

type FetchState =
  | { status: "carregando" }
  | { status: "erro" }
  | { status: "pronto"; itens: Agenda2Item[] }

/**
 * Agenda2List (AGD2-01/02/03/04/05/07/08, D-01/02/04/05/06/08/10/11/16/17/18,
 * D-27/D-28/D-30, correção 7 do 31-01-PLAN.md) — irmão novo de
 * `components/agenda/AgendaList.tsx` (sibling module, não abstração
 * compartilhada — mesmo precedente já usado entre Perdidos/Encerrados). A
 * Agenda atual não é tocada por este componente.
 *
 * A tela tem DUAS VISÕES sobre a mesma fonte, escolhidas pelo seletor da barra
 * do calendário (Lista é a padrão): a Lista, com a regra de visibilidade da
 * Fase 31 (`itensDaListaAgenda2`), e o Calendário Dia/Semana/Mês
 * (`Agenda2Calendario`), com regra própria (D-28: concluído de dia passado
 * aparece riscado na célula do seu dia). O calendário é uma cópia própria da
 * Agenda atual (D-27), não um componente compartilhado. Esta tela continua a
 * ÚNICA dona das escritas, do formulário, da confirmação de apagar e do
 * filtro de vendedor — o calendário só recebe os handlers e o `reloadKey`, e
 * qualquer ação, de qualquer visão, recarrega as duas.
 *
 * Quick 261006-ncy: todo "Concluir" (cartão da Lista, visão Dia e diálogo do dia
 * do calendário) abre a janela pequena `Agenda2ConcluirDialog` ("Concluir
 * visita", com "O que foi feito" opcional); só ela chama
 * `concluirAgenda2Item(id, texto)`. "Desmarcar" continua direto e não apaga
 * nenhum texto.
 *
 * Mesmo esqueleto de leitura de AgendaList: `FetchState` em união
 * discriminada, `useEffect` com `setState` síncrono no corpo, guarda
 * `cancelled`, `reloadKey` bumpado por "Tentar novamente" e por qualquer ação
 * de escrita bem-sucedida. A leitura da Lista roda em qualquer visão: ela
 * alimenta o aviso de duplicado do formulário e as opções do filtro do
 * Supervisor. Sem tudo o que não é desta fase (D-11): sem exportação, sem
 * "Sem dia fixo", sem ficha de cliente, sem busca.
 *
 * Nenhuma decisão de negócio é duplicada aqui: visibilidade dos concluídos e
 * seções vêm de `lib/agenda2/itens.ts`; o estreitamento por vendedor reusa
 * `filtrarPorVendedor` de `lib/agenda/itens.ts` sem alteração (D-17). O
 * filtro do Supervisor é um ESTREITAMENTO LOCAL sobre o que a RLS já liberou
 * — nunca uma checagem de permissão. Esconder os botões de escrita quando
 * `isSupervisor` é só reflexo visual: D-16 é garantido pela RLS assimétrica
 * da migration 0048 (31-01/31-03), não por este componente.
 */
export function Agenda2List({ isSupervisor }: { isSupervisor: boolean }) {
  const [state, setState] = useState<FetchState>({ status: "carregando" })
  // Bumped por "Tentar novamente" e por qualquer ação de escrita que afete o
  // que a Lista mostra (concluir, desmarcar, apagar, criar, editar).
  const [reloadKey, setReloadKey] = useState(0)
  // Lista é a visão padrão, como na Agenda atual (AGD2-08).
  const [visao, setVisao] = useState<AgendaVisao>("lista")
  const [vendedorFiltroId, setVendedorFiltroId] = useState<string | null>(
    null
  )
  const [formAberto, setFormAberto] = useState(false)
  const [formModo, setFormModo] = useState<"criar" | "editar">("criar")
  const [formItem, setFormItem] = useState<Agenda2Item | null>(null)
  const [apagarItem, setApagarItem] = useState<Agenda2Item | null>(null)
  const [apagarAberto, setApagarAberto] = useState(false)
  const [concluirItem, setConcluirItem] = useState<Agenda2Item | null>(null)
  const [concluirAberto, setConcluirAberto] = useState(false)
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Mesmo precedente de AgendaList.tsx/ComparativoVendedorTable.tsx: o
    // estado de carregando precisa ser marcado de forma síncrona no corpo do
    // efeito para que o Skeleton apareça a partir do próximo render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "carregando" })

    getAgenda2Action().then((result) => {
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
  // Correção 7 do 31-01-PLAN.md: concluído de hoje/futuro fica visível
  // riscado; concluído de dia passado só aparece se foi alterado hoje.
  const visiveis = itensDaListaAgenda2(itens)
  const opcoes = vendedoresDaAgenda2(visiveis)
  // ESTREITAMENTO LOCAL sobre o que a RLS já liberou — nunca permissão.
  const filtrados = filtrarPorVendedor(visiveis, vendedorFiltroId)
  const secoes = agruparAgenda2(filtrados)
  // O nome do vendedor só aparece na linha para o Supervisor vendo todos —
  // escolhido um vendedor específico, repetir o nome em toda linha é ruído.
  const showResponsavel = isSupervisor && vendedorFiltroId === null
  const total =
    secoes.atrasado.length + secoes.hoje.length + secoes.proximos.length

  const nomeVendedorSelecionado = opcoes.find(
    (vendedor) => vendedor.id === vendedorFiltroId
  )?.nome

  const selectItems = [
    { value: SEM_FILTRO, label: "Todos os vendedores" },
    ...opcoes.map((vendedor) => ({ value: vendedor.id, label: vendedor.nome })),
  ]

  function handleRecarregar() {
    setReloadKey((key) => key + 1)
  }

  function handleAdicionar() {
    setFormModo("criar")
    setFormItem(null)
    setFormAberto(true)
  }

  function handleEditar(item: Agenda2Item) {
    setFormModo("editar")
    setFormItem(item)
    setFormAberto(true)
  }

  function handleAbrirApagar(item: Agenda2Item) {
    setApagarItem(item)
    setApagarAberto(true)
  }

  function handleAbrirConcluir(item: Agenda2Item) {
    setConcluirItem(item)
    setConcluirAberto(true)
  }

  // Contrato de `Agenda2ConcluirDialog.onConfirmar`: Promise<boolean> (true =
  // concluiu; false = falhou) — a janela mostra o erro genérico sozinha
  // quando devolvemos false, não precisamos setar `erroAcao` aqui.
  async function handleConfirmarConcluir(resultado: string): Promise<boolean> {
    if (!concluirItem) return false
    const id = concluirItem.id
    setSalvandoId(id)
    setErroAcao(null)
    try {
      const result = await concluirAgenda2Item(id, resultado)
      if (result.error) return false
      handleRecarregar()
      return true
    } catch {
      return false
    } finally {
      setSalvandoId(null)
    }
  }

  async function handleDesmarcar(id: string) {
    setSalvandoId(id)
    setErroAcao(null)
    try {
      const result = await desmarcarAgenda2Item(id)
      if (result.error) {
        setErroAcao(MSG_SALVAR_FALHOU)
        return
      }
      handleRecarregar()
    } catch {
      setErroAcao(MSG_SALVAR_FALHOU)
    } finally {
      setSalvandoId(null)
    }
  }

  // Contrato de `Agenda2ApagarDialog.onConfirmar`: Promise<boolean> (true =
  // apagou; false = falhou) — o diálogo mostra o erro genérico sozinho
  // quando devolvemos false, não precisamos setar `erroAcao` aqui.
  async function handleConfirmarApagar(): Promise<boolean> {
    if (!apagarItem) return false
    try {
      const result = await apagarAgenda2Item(apagarItem.id)
      if (result.error) return false
      handleRecarregar()
      return true
    } catch {
      return false
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-xl font-semibold">Agenda</h1>
        {isSupervisor ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agenda2-filtro-vendedor">Vendedor</Label>
            <Select
              value={vendedorFiltroId ?? SEM_FILTRO}
              onValueChange={(value) =>
                setVendedorFiltroId(
                  value === SEM_FILTRO ? null : String(value)
                )
              }
              items={selectItems}
            >
              <SelectTrigger id="agenda2-filtro-vendedor" className="w-56">
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_FILTRO}>
                  Todos os vendedores
                </SelectItem>
                {opcoes.map((vendedor) => (
                  <SelectItem key={vendedor.id} value={vendedor.id}>
                    {vendedor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Button type="button" onClick={handleAdicionar}>
            <Plus />
            Adicionar visita
          </Button>
        )}
      </div>

      {erroAcao ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {erroAcao}
        </div>
      ) : null}

      {/* Sempre montado: a barra com o seletor Lista/Dia/Semana/Mês é o único
          caminho de volta, então não pode sumir junto com a Lista. O calendário
          lê o próprio período (getAgenda2PeriodoAction) e só mostra a grade
          fora da Lista. */}
      <Agenda2Calendario
        visao={visao}
        onVisaoChange={setVisao}
        reloadKey={reloadKey}
        vendedorFiltroId={vendedorFiltroId}
        showResponsavel={showResponsavel}
        podeAlterar={!isSupervisor}
        salvandoId={salvandoId}
        onEditar={handleEditar}
        onApagar={handleAbrirApagar}
        onConcluir={handleAbrirConcluir}
        onDesmarcar={(item) => handleDesmarcar(item.id)}
      />

      {visao !== "lista" ? null : state.status === "carregando" ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : state.status === "erro" ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {MSG_CARREGAR_FALHOU}
          </p>
          <Button type="button" variant="outline" onClick={handleRecarregar}>
            Tentar novamente
          </Button>
        </div>
      ) : total === 0 ? (
        isSupervisor ? (
          vendedorFiltroId !== null ? (
            <div className="flex flex-col items-center gap-1 py-16 text-center">
              <p className="text-base font-semibold">
                {`Nenhum item para ${nomeVendedorSelecionado ?? ""}.`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 py-16 text-center">
              <p className="text-base font-semibold">
                Nenhum item na Agenda do time
              </p>
              <p className="text-sm text-muted-foreground">
                Quando os vendedores anotarem visitas, elas aparecem aqui.
              </p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-1 py-16 text-center">
            <p className="text-base font-semibold">
              Sua Agenda está vazia
            </p>
            <p className="text-sm text-muted-foreground">
              Anote aqui quem você vai visitar em cada dia — nome do cliente,
              bairro e data.
            </p>
            <Button type="button" className="mt-4" onClick={handleAdicionar}>
              <Plus />
              Adicionar visita
            </Button>
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
                    <Agenda2ItemRow
                      key={item.id}
                      item={item}
                      atrasado={bucket === "atrasado"}
                      showResponsavel={showResponsavel}
                      podeAlterar={!isSupervisor}
                      salvando={salvandoId === item.id}
                      onEditar={() => handleEditar(item)}
                      onApagar={() => handleAbrirApagar(item)}
                      onConcluir={() => handleAbrirConcluir(item)}
                      onDesmarcar={() => handleDesmarcar(item.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* D-16: o formulário e as janelas de apagar/concluir nem são renderizados
          para o Supervisor — a RLS já barra a escrita de qualquer forma
          (31-03), isto é só o reflexo visual de "somente leitura". */}
      {!isSupervisor ? (
        <>
          <Agenda2ItemForm
            open={formAberto}
            onOpenChange={setFormAberto}
            modo={formModo}
            item={formItem}
            itensExistentes={itens}
            onSalvo={handleRecarregar}
            onRecarregar={handleRecarregar}
          />
          <Agenda2ApagarDialog
            open={apagarAberto}
            onOpenChange={setApagarAberto}
            item={apagarItem}
            onConfirmar={handleConfirmarApagar}
          />
          <Agenda2ConcluirDialog
            open={concluirAberto}
            onOpenChange={setConcluirAberto}
            item={concluirItem}
            onConfirmar={handleConfirmarConcluir}
          />
        </>
      ) : null}
    </div>
  )
}
