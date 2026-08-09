"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { format, parseISO } from "date-fns"
import { Info, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"

import {
  atualizarFrequenciaVisita,
  deleteCliente,
  getClienteDetalhe,
  getFrequenciasPedido,
  updateCliente,
} from "@/app/actions/clientes"
import {
  getDiarioAction,
  getHistoricoAction,
  marcarStatus,
  type MarcarStatusResult,
} from "@/app/actions/funil"
import {
  adicionarTarefa,
  atualizarDataTarefa,
  getTarefasAction,
  getTiposTarefa,
  removerTarefa,
  toggleTarefa,
} from "@/app/actions/tarefas"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { EstadoCidadeFields } from "@/components/clientes/EstadoCidadeFields"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PerdaMotivoDialog } from "@/components/clientes/PerdaMotivoDialog"
import { GanhoFrequenciaDialog } from "@/components/clientes/GanhoFrequenciaDialog"
import { HistoricoTimeline } from "@/components/clientes/HistoricoTimeline"
import { DiarioTimeline } from "@/components/clientes/DiarioTimeline"
import { ETAPA_FINAL } from "@/lib/funil/etapas"
import { FREQUENCIA_VISITA_ITEMS, type FrequenciaVisita } from "@/lib/funil/frequencia"
import { tarefaAtrasada } from "@/lib/funil/staleness"
import { cn } from "@/lib/utils"
import { UFS, type Uf } from "@/lib/clientes/ufs"
import {
  updateClienteSchema,
  type UpdateClienteInput,
} from "@/lib/validations/cliente"
import type {
  ClienteDetalhe,
  DiarioEntry,
  HistoricoEntry,
  LookupOption,
  StatusAcompanhamento,
  Tarefa,
} from "@/lib/supabase/queries/clientes"

const DUPLICATE_RAZAO_SOCIAL_ERROR =
  "Já existe um cliente cadastrado com essa razão social."
const GENERIC_ERROR = "Não foi possível salvar as alterações. Tente novamente."
const SUCCESS_MESSAGE = "Cliente salvo com sucesso."
const LOAD_ERROR =
  "Não foi possível carregar os dados do cliente. Tente novamente."
const DELETE_GENERIC_ERROR = "Não foi possível apagar o cliente. Tente novamente."
const GANHO_TOOLTIP = 'Disponível somente na etapa "1ª venda concluída".'

const STATUS_OPTIONS: { value: StatusAcompanhamento; label: string }[] = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "perdido", label: "Perdido" },
  { value: "ganho", label: "Ganho" },
]

// Base UI's <Select.Value> only resolves a human-readable label for a
// value that's already selected when the Select first mounts by looking it
// up in Select.Root's `items` prop — without it, it falls back to rendering
// the raw value (UUID / sentinel / enum key) until the popup has been
// opened at least once and its SelectItems have registered themselves. This
// Sheet always opens with a pre-selected value (an existing cliente's
// responsavel/categoriaId/statusAcompanhamento), so every Select here needs
// its own `items` lookup — unlike InviteUserForm's "papel" Select, which
// always starts unselected ("") and never hits this path.
const STATUS_ITEMS = STATUS_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}))

// Sentinel Select value meaning "nenhuma categoria" — "" is reserved for
// Base UI's own uncontrolled/placeholder state (same convention as
// FiltersPopover's SEM_FILTRO), but categoriaId is genuinely optional here
// (CLI-02), so a real "Nenhuma" choice needs its own non-"" value.
const SEM_CATEGORIA = "__sem_categoria__"

function toFormValues(cliente: ClienteDetalhe): UpdateClienteInput {
  return {
    id: cliente.id,
    razaoSocial: cliente.razaoSocial,
    cep: cliente.cep,
    rua: cliente.rua,
    numero: cliente.numero,
    complemento: cliente.complemento ?? "",
    cidade: cliente.cidade,
    // 09-03/LOC-04/D-01/UI-SPEC §5: a legacy record's stored estado can be
    // outside the 27-UF enum after the simple case/whitespace backfill
    // (chk_estado_valido stays NOT VALID for those rows) — cast, don't
    // reject; the Select just falls back to rendering the raw value
    // silently until the user picks a valid UF and saves (no blocking UI).
    // The full Select-based EstadoCidadeFields wiring lands in 09-05.
    estado: cliente.estado as Uf,
    responsavel: cliente.responsavel,
    categoriaId: cliente.categoriaId ?? "",
    contato: cliente.contato ?? "",
    telefone: cliente.telefone ?? "",
    email: cliente.email ?? "",
    numeroDeLojas: cliente.numeroDeLojas ?? undefined,
    produtoIds: cliente.produtoIds,
    observacao: cliente.observacao ?? "",
    // ATV-01/ATV-02: preenchidos a partir do cliente lido para QUALQUER
    // status, não só "ganho" — os campos só são RENDERIZADOS quando ganho,
    // mas continuam presentes nos valores do formulário; é isso que faz
    // salvar a ficha de um cliente que deixou de ser ganho devolver o valor
    // já guardado em vez de apagá-lo (updateCliente só grava a coluna
    // quando o campo está presente no envio).
    nomeFantasia: cliente.nomeFantasia ?? "",
    cnpj: cliente.cnpj ?? "",
    frequenciaPedidos: cliente.frequenciaPedidos ?? "",
  }
}

/**
 * Client detail/edit Sheet (CLI-02/CLI-05/CLI-06) — opened by clicking
 * (never dragging) a kanban card. Section 1 "Dados do cliente" is fully
 * editable here; Section 2 "Funil" is left as a clearly-labelled empty
 * container for 02-07 to fill (status/observação/tarefas/histórico) without
 * this component being restructured.
 *
 * `categoriaOptions`/`produtoOptions`/`vendedorOptions` are the same
 * in-memory-derived lists KanbanBoard already computes for FiltersPopover
 * (02-05's Pitfall-7 convention: derived from the already-loaded RLS-scoped
 * card set, not a separate lookup query) — reused here instead of adding a
 * new full-catalog fetch.
 */
export function ClienteDetailSheet({
  clienteId,
  open,
  onOpenChange,
  isSupervisor,
  categoriaOptions,
  produtoOptions,
  vendedorOptions,
  onSaved,
  onDeleted,
}: {
  clienteId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isSupervisor: boolean
  categoriaOptions: { id: string; nome: string }[]
  produtoOptions: { id: string; nome: string }[]
  vendedorOptions: { id: string; nome: string }[]
  onSaved: (values: UpdateClienteInput) => void
  onDeleted: (id: string) => void
}) {
  const [cliente, setCliente] = useState<ClienteDetalhe | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Funil section (02-07): status control, tarefas checklist, histórico
  // timeline. Loaded alongside the cliente itself when the Sheet opens.
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [historico, setHistorico] = useState<HistoricoEntry[]>([])
  const [tiposTarefa, setTiposTarefa] = useState<LookupOption[]>([])
  // DIAR-01: dado POR CLIENTE, resetado no bloco abaixo ao trocar/fechar.
  const [diario, setDiario] = useState<DiarioEntry[]>([])
  // ATV-02: catálogo GLOBAL (mesmo motivo de tiposTarefa acima não entrar no
  // bloco de reset) — não muda ao trocar de cliente, resetá-lo só causaria
  // uma busca a mais.
  const [frequenciasPedido, setFrequenciasPedido] = useState<LookupOption[]>([])
  const [statusError, setStatusError] = useState<string | null>(null)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [perdaDialogOpen, setPerdaDialogOpen] = useState(false)
  const [ganhoDialogOpen, setGanhoDialogOpen] = useState(false)
  const [frequenciaError, setFrequenciaError] = useState<string | null>(null)
  const [isSavingFrequencia, setIsSavingFrequencia] = useState(false)

  const [addingTarefa, setAddingTarefa] = useState(false)
  const [novoTipoTarefaId, setNovoTipoTarefaId] = useState("")
  const [novaData, setNovaData] = useState<Date | undefined>(undefined)
  const [tarefaError, setTarefaError] = useState<string | null>(null)
  const [isSavingTarefa, setIsSavingTarefa] = useState(false)

  const form = useForm<UpdateClienteInput>({
    resolver: zodResolver(updateClienteSchema),
    defaultValues: {
      id: "",
      razaoSocial: "",
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      cidade: "",
      // "" is overwritten by form.reset(toFormValues(...)) once the cliente
      // loads; cast needed only because estado: z.enum(UFS) narrows the
      // type to Uf (09-03/LOC-01) — no valid empty-string UF exists.
      estado: "" as Uf,
      responsavel: "",
      categoriaId: "",
      contato: "",
      telefone: "",
      email: "",
      numeroDeLojas: undefined,
      produtoIds: [],
      observacao: "",
      nomeFantasia: "",
      cnpj: "",
      frequenciaPedidos: "",
    },
  })

  useEffect(() => {
    if (!open || !clienteId) {
      // Achado pré-existente, fora do escopo desta task (260806-fln/Task 2):
      // o React Compiler só conseguiu reportar este `set-state-in-effect`
      // depois que o `react-hooks/incompatible-library` da linha ~489 foi
      // corrigido logo abaixo — com aquele erro presente, o compilador não
      // analisava o restante do componente. Resetar estas ~13 variáveis
      // locais ao fechar o Sheet ou trocar de cliente é comportamento
      // intencional; convertê-lo para o padrão "ajustar estado durante o
      // render" (recomendado pelo React para este caso) é um refactor maior
      // que fica fora do escopo de hygiene deste plano. Ver deferred-items.md.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCliente(null)
      setLoadError(null)
      setFormError(null)
      setSuccessMessage(null)
      setConfirmDeleteOpen(false)
      setDeleteError(null)
      setTarefas([])
      setHistorico([])
      setDiario([])
      setStatusError(null)
      setPerdaDialogOpen(false)
      setGanhoDialogOpen(false)
      setFrequenciaError(null)
      setIsSavingFrequencia(false)
      setAddingTarefa(false)
      setNovoTipoTarefaId("")
      setNovaData(undefined)
      setTarefaError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    setFormError(null)
    setSuccessMessage(null)

    getClienteDetalhe(clienteId).then((result) => {
      if (cancelled) return
      setIsLoading(false)

      if (result.error) {
        setLoadError(LOAD_ERROR)
        return
      }

      setCliente(result.data)
      form.reset(toFormValues(result.data))
    })

    // Funil section data (02-07) — loaded alongside the cliente itself, each
    // independently: a failure loading tarefas/histórico/tiposTarefa never
    // blocks the "Dados do cliente" section from rendering.
    getTarefasAction(clienteId).then((result) => {
      if (cancelled || result.error) return
      setTarefas(result.data)
    })
    getHistoricoAction(clienteId).then((result) => {
      if (cancelled || result.error) return
      setHistorico(result.data)
    })
    getTiposTarefa().then((result) => {
      if (cancelled || result.error) return
      setTiposTarefa(result.data)
    })
    getDiarioAction(clienteId).then((result) => {
      if (cancelled || result.error) return
      setDiario(result.data)
    })
    getFrequenciasPedido().then((result) => {
      if (cancelled || result.error) return
      setFrequenciasPedido(result.data)
    })

    return () => {
      cancelled = true
    }
    // form is stable across renders (react-hook-form); only re-fetch when
    // the Sheet opens for a different clienteId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clienteId])

  async function refreshHistorico() {
    if (!clienteId) return
    const result = await getHistoricoAction(clienteId)
    if (!result.error) setHistorico(result.data)
  }

  // DIAR-01: NÃO reusa refreshHistorico — é uma leitura própria
  // (getDiarioAction), nunca um filtro sobre o histórico já carregado no
  // navegador. Chamada nos mesmos pontos em que refreshHistorico já é
  // chamada, porque as duas escritas caem na mesma tabela `historico`.
  async function refreshDiario() {
    if (!clienteId) return
    const result = await getDiarioAction(clienteId)
    if (!result.error) setDiario(result.data)
  }

  async function handleStatusChange(
    novoStatus: StatusAcompanhamento,
    motivoPerdaId?: string,
    frequenciaVisita?: FrequenciaVisita
  ): Promise<MarcarStatusResult> {
    if (!cliente) return { error: { code: "cliente_nao_encontrado", message: LOAD_ERROR } }

    setStatusError(null)
    setIsSavingStatus(true)

    try {
      const result = await marcarStatus(cliente.id, novoStatus, motivoPerdaId, frequenciaVisita)

      if (result.error) {
        setStatusError(result.error.message)
        setIsSavingStatus(false)
        return result
      }

      setCliente((prev) =>
        prev
          ? {
              ...prev,
              statusAcompanhamento: novoStatus,
              motivoPerdaId: novoStatus === "perdido" ? (motivoPerdaId ?? null) : null,
              // The RPC's own coalesce never erases frequenciaVisita when the
              // status changes away from "ganho" — mirror that here so local
              // state never diverges from the DB (ATV-03).
              frequenciaVisita:
                novoStatus === "ganho"
                  ? (frequenciaVisita ?? prev.frequenciaVisita)
                  : prev.frequenciaVisita,
            }
          : prev
      )
      setIsSavingStatus(false)
      await refreshHistorico()
      await refreshDiario()
      return result
    } catch {
      const error = {
        code: "mover_falhou" as const,
        message: GENERIC_ERROR,
      }
      setStatusError(error.message)
      setIsSavingStatus(false)
      return { error }
    }
  }

  function handleStatusSelect(value: string | null) {
    if (!value) return
    const novoStatus = value as StatusAcompanhamento
    if (novoStatus === "perdido") {
      setPerdaDialogOpen(true)
      return
    }
    if (novoStatus === "ganho") {
      setGanhoDialogOpen(true)
      return
    }
    void handleStatusChange(novoStatus)
  }

  // Standing frequência de visita control (VIS-02/VIS-04) — deliberately a
  // separate handler from handleStatusChange/handleStatusSelect: this is an
  // ordinary clientes field edit, never a funil stage/status transition, so
  // it must never call marcarStatus or reach mover_card_funil
  // (13-UI-SPEC.md Interaction Contract point 4). Saves immediately on
  // change, no confirmation step, outside the "Dados do cliente"
  // react-hook-form/"Salvar alterações" flow (VIS-02 minimum friction).
  async function handleFrequenciaChange(value: string | null) {
    if (!value || !cliente) return
    const frequencia = value as FrequenciaVisita

    setFrequenciaError(null)
    setIsSavingFrequencia(true)

    try {
      const result = await atualizarFrequenciaVisita(cliente.id, frequencia)

      if (result.error) {
        setFrequenciaError(GENERIC_ERROR)
        return
      }

      setCliente((prev) =>
        prev ? { ...prev, frequenciaVisita: frequencia } : prev
      )
    } catch {
      setFrequenciaError(GENERIC_ERROR)
    } finally {
      setIsSavingFrequencia(false)
    }
  }

  async function handleToggleTarefa(tarefaId: string, concluida: boolean) {
    setTarefaError(null)
    const previous = tarefas
    setTarefas((prev) =>
      prev.map((tarefa) =>
        tarefa.id === tarefaId ? { ...tarefa, concluida } : tarefa
      )
    )

    const result = await toggleTarefa(tarefaId, concluida)

    if (result.error) {
      setTarefas(previous)
      setTarefaError(GENERIC_ERROR)
      return
    }

    if (concluida) {
      await refreshHistorico()
      await refreshDiario()
    }
  }

  async function handleTarefaData(tarefaId: string, date: Date | undefined) {
    setTarefaError(null)
    const dataConclusao = date ? format(date, "yyyy-MM-dd") : null
    const previous = tarefas
    setTarefas((prev) =>
      prev.map((tarefa) =>
        tarefa.id === tarefaId ? { ...tarefa, dataConclusao } : tarefa
      )
    )

    const result = await atualizarDataTarefa(tarefaId, dataConclusao)
    if (result.error) {
      setTarefas(previous)
      setTarefaError(GENERIC_ERROR)
    }
  }

  async function handleRemoverTarefa(tarefaId: string) {
    setTarefaError(null)
    const previous = tarefas
    setTarefas((prev) => prev.filter((tarefa) => tarefa.id !== tarefaId))

    const result = await removerTarefa(tarefaId)
    if (result.error) {
      setTarefas(previous)
      setTarefaError(GENERIC_ERROR)
    }
  }

  async function handleAdicionarTarefa() {
    if (!cliente) return
    if (!novoTipoTarefaId) {
      setTarefaError("Selecione o tipo da tarefa.")
      return
    }

    setTarefaError(null)
    setIsSavingTarefa(true)

    const dataConclusao = novaData ? format(novaData, "yyyy-MM-dd") : null
    const result = await adicionarTarefa(cliente.id, novoTipoTarefaId, dataConclusao)

    setIsSavingTarefa(false)

    if (result.error) {
      setTarefaError(GENERIC_ERROR)
      return
    }

    const tipoNome =
      tiposTarefa.find((tipo) => tipo.id === novoTipoTarefaId)?.nome ?? ""

    setTarefas((prev) => [
      ...prev,
      {
        id: result.data.id,
        tipoTarefaId: novoTipoTarefaId,
        tipoNome,
        dataConclusao,
        concluida: false,
      },
    ])
    setAddingTarefa(false)
    setNovoTipoTarefaId("")
    setNovaData(undefined)
  }

  function toggleProduto(id: string, checked: boolean) {
    const current = form.getValues("produtoIds") ?? []
    form.setValue(
      "produtoIds",
      checked ? [...current, id] : current.filter((produtoId) => produtoId !== id),
      { shouldDirty: true }
    )
  }

  async function onSubmit(values: UpdateClienteInput) {
    setFormError(null)
    setSuccessMessage(null)

    try {
      const result = await updateCliente(values)

      if (result.error) {
        setFormError(
          result.error.code === "duplicate_razao_social"
            ? DUPLICATE_RAZAO_SOCIAL_ERROR
            : GENERIC_ERROR
        )
        return
      }

      setSuccessMessage(SUCCESS_MESSAGE)
      onSaved(values)
    } catch {
      setFormError(GENERIC_ERROR)
    }
  }

  async function handleConfirmDelete() {
    if (!cliente) return
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const result = await deleteCliente(cliente.id)

      if (result.error) {
        setDeleteError(DELETE_GENERIC_ERROR)
        setIsDeleting(false)
        return
      }

      setIsDeleting(false)
      setConfirmDeleteOpen(false)
      onDeleted(cliente.id)
      onOpenChange(false)
    } catch {
      setDeleteError(DELETE_GENERIC_ERROR)
      setIsDeleting(false)
    }
  }

  const produtoIds = useWatch({ control: form.control, name: "produtoIds" }) ?? []

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 sm:max-w-[480px]"
        >
          <SheetHeader className="flex-row items-start justify-between gap-2 border-b">
            <SheetTitle className="pr-8 text-xl font-semibold">
              {cliente?.razaoSocial ?? "Cliente"}
            </SheetTitle>
            {isSupervisor && cliente ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Apagar cliente
              </Button>
            ) : null}
          </SheetHeader>

          {isLoading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Carregando...
            </p>
          ) : loadError ? (
            <p role="alert" className="px-4 py-6 text-sm text-destructive">
              {loadError}
            </p>
          ) : cliente ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex flex-1 flex-col overflow-hidden"
                noValidate
              >
                <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
                  {formError ? (
                    <div
                      role="alert"
                      className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {formError}
                    </div>
                  ) : null}

                  {successMessage ? (
                    <div
                      role="status"
                      className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary"
                    >
                      {successMessage}
                    </div>
                  ) : null}

                  <h2 className="text-xl font-semibold">Dados do cliente</h2>
                  <Separator />

                  <FormField
                    control={form.control}
                    name="razaoSocial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razão social</FormLabel>
                        <FormControl>
                          <Input autoComplete="organization" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <Input autoComplete="postal-code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="numero"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="rua"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rua</FormLabel>
                        <FormControl>
                          <Input autoComplete="address-line1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <EstadoCidadeFields
                    control={form.control}
                    watch={form.watch}
                    setValue={form.setValue}
                    estadoItems={UFS.map((uf) => ({ value: uf, label: uf }))}
                  />

                  <FormField
                    control={form.control}
                    name="responsavel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável</FormLabel>
                        {isSupervisor ? (
                          <Select
                            value={field.value}
                            onValueChange={(value) => field.onChange(value)}
                            items={vendedorOptions.map((vendedor) => ({
                              value: vendedor.id,
                              label: vendedor.nome,
                            }))}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecione o responsável" />
                            </SelectTrigger>
                            <SelectContent>
                              {vendedorOptions.map((vendedor) => (
                                <SelectItem key={vendedor.id} value={vendedor.id}>
                                  {vendedor.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          // A Vendedor only ever loads their own clientes
                          // (RLS SELECT scoping, T-02-01/CLI-04), so
                          // cliente.responsavelNome is always their own name
                          // here — read-only, no reassignment control.
                          <FormControl>
                            <Input
                              value={cliente.responsavelNome ?? ""}
                              disabled
                              readOnly
                            />
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="categoriaId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select
                          value={field.value || SEM_CATEGORIA}
                          onValueChange={(value) =>
                            field.onChange(value === SEM_CATEGORIA ? "" : value)
                          }
                          items={[
                            { value: SEM_CATEGORIA, label: "Nenhuma" },
                            ...categoriaOptions.map((categoria) => ({
                              value: categoria.id,
                              label: categoria.nome,
                            })),
                          ]}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SEM_CATEGORIA}>Nenhuma</SelectItem>
                            {categoriaOptions.map((categoria) => (
                              <SelectItem key={categoria.id} value={categoria.id}>
                                {categoria.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contato"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contato</FormLabel>
                        <FormControl>
                          <Input autoComplete="name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="telefone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input type="tel" autoComplete="tel" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" autoComplete="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label>Produtos consumidos</Label>
                    {produtoOptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum produto cadastrado ainda.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {produtoOptions.map((produto) => {
                          const inputId = `cliente-produto-${produto.id}`
                          return (
                            <div
                              key={produto.id}
                              className="flex items-center gap-2"
                            >
                              <Checkbox
                                id={inputId}
                                checked={produtoIds.includes(produto.id)}
                                onCheckedChange={(checked) =>
                                  toggleProduto(produto.id, checked)
                                }
                              />
                              <Label htmlFor={inputId} className="font-normal">
                                {produto.nome}
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="numeroDeLojas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número de lojas</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            value={field.value ?? ""}
                            onChange={(event) =>
                              field.onChange(
                                event.target.value === ""
                                  ? undefined
                                  : Number(event.target.value)
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {cliente.statusAcompanhamento === "ganho" ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="nomeFantasia"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome fantasia</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="cnpj"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CNPJ</FormLabel>
                              <FormControl>
                                <Input placeholder="00.000.000/0000-00" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="frequenciaPedidos"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Frequência de pedidos</FormLabel>
                            {frequenciasPedido.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Nenhuma frequência cadastrada ainda.
                              </p>
                            ) : (
                              <Select
                                value={field.value || ""}
                                onValueChange={(value) =>
                                  field.onChange(value ?? "")
                                }
                                items={frequenciasPedido.map((freq) => ({
                                  value: freq.nome,
                                  label: freq.nome,
                                }))}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Selecione a frequência" />
                                </SelectTrigger>
                                <SelectContent>
                                  {frequenciasPedido.map((freq) => (
                                    <SelectItem key={freq.id} value={freq.nome}>
                                      {freq.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {/* ATV-02: texto de apoio SEMPRE visível — é a
                                expressão literal do critério de aceitação,
                                nunca escondido atrás de tooltip. Campo comum
                                de formulário, salvo só pelo botão "Salvar
                                alterações" — diferente da Frequência de
                                VISITA logo abaixo (seção Funil), que grava
                                na hora via atualizarFrequenciaVisita; os
                                dois têm nome parecido e ficam a poucas
                                linhas um do outro, daí este comentário. */}
                            <p className="text-sm text-muted-foreground">
                              Informação de apoio — não gera alerta, cobrança ou tarefa na Agenda.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  ) : null}

                  <Separator />
                  <h2 className="text-xl font-semibold">Funil</h2>
                  <div data-slot="funil-section" className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="cliente-status-select">Status</Label>
                      <Select
                        value={cliente.statusAcompanhamento}
                        onValueChange={handleStatusSelect}
                        items={STATUS_ITEMS}
                      >
                        <SelectTrigger
                          id="cliente-status-select"
                          className="w-full"
                          disabled={isSavingStatus}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              disabled={
                                option.value === "ganho" &&
                                cliente.etapa !== ETAPA_FINAL
                              }
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "size-2 rounded-full",
                                    option.value === "em_andamento" &&
                                      "bg-muted-foreground",
                                    option.value === "perdido" && "bg-destructive",
                                    option.value === "ganho" && "bg-green-600"
                                  )}
                                />
                                {option.label}
                                {option.value === "ganho" &&
                                cliente.etapa !== ETAPA_FINAL ? (
                                  <Tooltip>
                                    <TooltipTrigger
                                      className="pointer-events-auto inline-flex items-center bg-transparent p-0"
                                      aria-label={GANHO_TOOLTIP}
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      <Info className="size-3.5 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>{GANHO_TOOLTIP}</TooltipContent>
                                  </Tooltip>
                                ) : null}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {statusError ? (
                        <p role="alert" className="text-sm text-destructive">
                          {statusError}
                        </p>
                      ) : null}
                    </div>

                    {cliente.statusAcompanhamento === "ganho" ? (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="cliente-frequencia-visita-select">
                          Frequência de visita
                        </Label>
                        <Select
                          value={cliente.frequenciaVisita ?? ""}
                          onValueChange={handleFrequenciaChange}
                          items={FREQUENCIA_VISITA_ITEMS}
                        >
                          <SelectTrigger
                            id="cliente-frequencia-visita-select"
                            className="w-full"
                            disabled={isSavingFrequencia}
                          >
                            <SelectValue placeholder="Selecione a frequência" />
                          </SelectTrigger>
                          <SelectContent>
                            {FREQUENCIA_VISITA_ITEMS.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {frequenciaError ? (
                          <p role="alert" className="text-sm text-destructive">
                            {frequenciaError}
                          </p>
                        ) : cliente.frequenciaVisita === null ? (
                          <p className="text-sm text-muted-foreground">
                            Frequência ainda não definida.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <FormField
                      control={form.control}
                      name="observacao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observação</FormLabel>
                          <FormControl>
                            <Textarea rows={3} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex flex-col gap-2">
                      <Label>Tarefas</Label>

                      {tarefas.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma tarefa cadastrada.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {tarefas.map((tarefa) => {
                            const overdue = tarefaAtrasada({
                              concluida: tarefa.concluida,
                              dataConclusao: tarefa.dataConclusao,
                              tipoNome: tarefa.tipoNome,
                            })
                            return (
                              <div
                                key={tarefa.id}
                                className="flex items-center gap-2"
                              >
                                <Checkbox
                                  checked={tarefa.concluida}
                                  onCheckedChange={(checked) =>
                                    handleToggleTarefa(tarefa.id, checked)
                                  }
                                />
                                <span
                                  className={cn(
                                    "flex-1 truncate text-sm",
                                    tarefa.concluida &&
                                      "text-muted-foreground line-through"
                                  )}
                                >
                                  {tarefa.tipoNome}
                                </span>
                                <Popover>
                                  <PopoverTrigger
                                    className={cn(
                                      "shrink-0 text-sm underline-offset-2 hover:underline",
                                      overdue
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {tarefa.dataConclusao
                                      ? format(
                                          parseISO(tarefa.dataConclusao),
                                          "dd/MM/yyyy"
                                        )
                                      : "Definir data"}
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0">
                                    <Calendar
                                      mode="single"
                                      selected={
                                        tarefa.dataConclusao
                                          ? parseISO(tarefa.dataConclusao)
                                          : undefined
                                      }
                                      onSelect={(date) =>
                                        handleTarefaData(tarefa.id, date)
                                      }
                                    />
                                  </PopoverContent>
                                </Popover>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Remover tarefa"
                                  onClick={() => handleRemoverTarefa(tarefa.id)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {tarefaError ? (
                        <p role="alert" className="text-sm text-destructive">
                          {tarefaError}
                        </p>
                      ) : null}

                      {addingTarefa ? (
                        <div className="flex flex-col gap-2 rounded-lg border p-3">
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="nova-tarefa-tipo">
                              Tipo de tarefa
                            </Label>
                            <Select
                              value={novoTipoTarefaId}
                              onValueChange={(value) =>
                                setNovoTipoTarefaId(value ?? "")
                              }
                            >
                              <SelectTrigger
                                id="nova-tarefa-tipo"
                                className="w-full"
                              >
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                {tiposTarefa.map((tipo) => (
                                  <SelectItem key={tipo.id} value={tipo.id}>
                                    {tipo.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label>Data de conclusão</Label>
                            <Popover>
                              <PopoverTrigger className="w-fit rounded-lg border border-input px-2.5 py-1.5 text-left text-sm">
                                {novaData
                                  ? format(novaData, "dd/MM/yyyy")
                                  : "Selecionar data"}
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={novaData}
                                  onSelect={setNovaData}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setAddingTarefa(false)
                                setTarefaError(null)
                                setNovoTipoTarefaId("")
                                setNovaData(undefined)
                              }}
                              disabled={isSavingTarefa}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              onClick={handleAdicionarTarefa}
                              disabled={isSavingTarefa}
                            >
                              {isSavingTarefa ? "Adicionando..." : "Adicionar"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-fit"
                          onClick={() => setAddingTarefa(true)}
                        >
                          + Adicionar tarefa
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>Histórico</Label>
                      <HistoricoTimeline entries={historico} />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>Diário</Label>
                      <DiarioTimeline entries={diario} />
                    </div>
                  </div>
                </div>

                <SheetFooter className="border-t">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting
                      ? "Salvando..."
                      : "Salvar alterações"}
                  </Button>
                </SheetFooter>
              </form>
            </Form>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja apagar o cliente {cliente?.razaoSocial}? Essa
            ação não pode ser desfeita e vai remover todo o histórico do
            funil.
          </p>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Apagando..." : "Apagar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cliente ? (
        <>
          <PerdaMotivoDialog
            open={perdaDialogOpen}
            onOpenChange={setPerdaDialogOpen}
            razaoSocial={cliente.razaoSocial}
            onConfirm={(motivoId) => handleStatusChange("perdido", motivoId)}
          />
          <GanhoFrequenciaDialog
            open={ganhoDialogOpen}
            onOpenChange={setGanhoDialogOpen}
            razaoSocial={cliente.razaoSocial}
            onConfirm={(frequencia) => handleStatusChange("ganho", undefined, frequencia)}
          />
        </>
      ) : null}
    </>
  )
}
