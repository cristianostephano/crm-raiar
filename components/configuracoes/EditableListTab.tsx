"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Eye, EyeOff, Pencil, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import {
  createListaValor,
  getListaValores,
  setListaValorAtivo,
  updateListaValor,
  type ListaTabela,
  type ListaValor,
} from "@/app/actions/listas"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  createListaValorSchema,
  type CreateListaValorInput,
} from "@/lib/validations/lista"

const LOAD_ERROR = "Não foi possível carregar os valores. Tente novamente."
const GENERIC_ERROR = "Não foi possível salvar. Tente novamente."
const DUPLICATE_ERROR = (nome: string) =>
  `Já existe um valor chamado "${nome}" nesta lista.`
const EMPTY_NAME_ERROR = "Digite um nome antes de adicionar."
const ADDED_MESSAGE = (nome: string) => `"${nome}" adicionado.`
const EDITED_MESSAGE = (nome: string) => `"${nome}" atualizado.`
const DEACTIVATED_MESSAGE = (nome: string) => `"${nome}" desativado.`
const REACTIVATED_MESSAGE = (nome: string) => `"${nome}" reativado.`

/**
 * Shared list + CRUD UI for one lookup table, reused across all 4
 * "Configurações" tabs (only "Categoria" is wired so far — 03-03 adds the
 * other 3 tabs). Fetches on mount via getListaValores(tabela) (the "fetch on
 * open" pattern from PerdaMotivoDialog.tsx, adapted to mount instead of a
 * dialog's `open` prop). This plan (03-02) adds edit-in-place (D-04),
 * deactivate/reactivate (D-03, soft-delete via `ativo`, never a real
 * delete), and the "Mostrar inativos" toggle on top of 03-01's list+add.
 */
export function EditableListTab({
  tabela,
  inputPlaceholder,
  pluralAtivoLabel,
}: {
  tabela: ListaTabela
  /** Input placeholder, e.g. "Nome da categoria" (Copywriting Contract). */
  inputPlaceholder: string
  /** Full count-caption suffix, e.g. "categorias ativas" (already
   * gender/number agreed for this tab — kept as a caller-supplied string
   * rather than derived here, since Portuguese plural/gender agreement
   * differs per tab: "categorias ativas" vs "produtos ativos", etc). */
  pluralAtivoLabel: string
}) {
  const [valores, setValores] = useState<ListaValor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  // Edit-in-place (D-04): only one row can be in edit mode at a time.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNome, setEditingNome] = useState("")
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Deactivate confirmation dialog (D-03) — low-friction, reversible.
  const [deactivateTarget, setDeactivateTarget] = useState<ListaValor | null>(
    null
  )
  const [deactivateSubmitting, setDeactivateSubmitting] = useState(false)
  const [deactivateError, setDeactivateError] = useState<string | null>(null)

  // Reactivate (no dialog) — tracks which row's Eye button is mid-flight so
  // its action buttons can be disabled while the request is in progress.
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Same "fetch on mount" precedent as PerdaMotivoDialog's fetch-on-open
    // effect: the loading flag must be set synchronously before the async
    // call starts so the tab shows "Carregando..." from the very next
    // render — there's no external system to synchronize with instead of
    // this fetch itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true)
    setLoadError(null)

    getListaValores(tabela).then((result) => {
      if (cancelled) return
      setIsLoading(false)

      if (result.error) {
        setLoadError(LOAD_ERROR)
        return
      }

      setValores(result.data)
    })

    return () => {
      cancelled = true
    }
  }, [tabela])

  const form = useForm<CreateListaValorInput>({
    resolver: zodResolver(createListaValorSchema),
    defaultValues: { nome: "" },
  })

  async function onSubmit(values: CreateListaValorInput) {
    setFormError(null)
    setSuccessMessage(null)

    const result = await createListaValor(tabela, values)

    if (result.error) {
      const message =
        result.error.code === "validation"
          ? EMPTY_NAME_ERROR
          : result.error.code === "duplicate_nome"
            ? DUPLICATE_ERROR(values.nome)
            : GENERIC_ERROR
      setFormError(message)
      return
    }

    setValores((current) =>
      [...current, { ...result.data, ativo: true }].sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR")
      )
    )
    setSuccessMessage(ADDED_MESSAGE(result.data.nome))
    form.reset({ nome: "" })
  }

  function startEdit(valor: ListaValor) {
    setEditingId(valor.id)
    setEditingNome(valor.nome)
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingNome("")
    setEditError(null)
  }

  async function saveEdit() {
    if (!editingId) return

    setEditSubmitting(true)
    setEditError(null)

    const result = await updateListaValor(tabela, {
      id: editingId,
      nome: editingNome,
    })

    if (result.error) {
      const message =
        result.error.code === "validation"
          ? EMPTY_NAME_ERROR
          : result.error.code === "duplicate_nome"
            ? DUPLICATE_ERROR(editingNome)
            : GENERIC_ERROR
      setEditError(message)
      setEditSubmitting(false)
      return
    }

    setValores((current) =>
      current
        .map((valor) =>
          valor.id === editingId ? { ...valor, nome: result.data.nome } : valor
        )
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    )
    setFormError(null)
    setSuccessMessage(EDITED_MESSAGE(result.data.nome))
    setEditSubmitting(false)
    setEditingId(null)
    setEditingNome("")
    setEditError(null)
  }

  function openDeactivateDialog(valor: ListaValor) {
    setDeactivateTarget(valor)
    setDeactivateError(null)
  }

  function handleDeactivateDialogChange(open: boolean) {
    if (!open) {
      setDeactivateTarget(null)
      setDeactivateError(null)
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return

    setDeactivateSubmitting(true)
    setDeactivateError(null)

    const result = await setListaValorAtivo(tabela, deactivateTarget.id, false)

    if (result.error) {
      setDeactivateError(GENERIC_ERROR)
      setDeactivateSubmitting(false)
      return
    }

    const deactivatedNome = deactivateTarget.nome

    setValores((current) =>
      current.map((valor) =>
        valor.id === deactivateTarget.id ? { ...valor, ativo: false } : valor
      )
    )
    setFormError(null)
    setSuccessMessage(DEACTIVATED_MESSAGE(deactivatedNome))
    setDeactivateSubmitting(false)
    setDeactivateTarget(null)
  }

  async function reactivate(valor: ListaValor) {
    setReactivatingId(valor.id)

    const result = await setListaValorAtivo(tabela, valor.id, true)

    if (result.error) {
      setSuccessMessage(null)
      setFormError(GENERIC_ERROR)
      setReactivatingId(null)
      return
    }

    setValores((current) =>
      current.map((item) =>
        item.id === valor.id ? { ...item, ativo: true } : item
      )
    )
    setFormError(null)
    setSuccessMessage(REACTIVATED_MESSAGE(valor.nome))
    setReactivatingId(null)
  }

  const ativos = valores.filter((valor) => valor.ativo)
  const visiveis = showInactive ? valores : ativos

  return (
    <div className="flex flex-col gap-4 pt-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex items-start gap-2 rounded-lg border p-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input placeholder={inputPlaceholder} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Adicionando..." : "Adicionar"}
          </Button>
        </form>
      </Form>

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

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Carregando..." : `${ativos.length} ${pluralAtivoLabel}`}
        </p>
        <div className="flex items-center gap-2">
          <Switch
            id={`mostrar-inativos-${tabela}`}
            checked={showInactive}
            onCheckedChange={(checked) => setShowInactive(checked)}
          />
          <Label
            htmlFor={`mostrar-inativos-${tabela}`}
            className="font-normal text-muted-foreground"
          >
            Mostrar inativos
          </Label>
        </div>
      </div>

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : isLoading ? null : visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <p className="text-base font-semibold">
            Nenhum valor ativo nesta lista.
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Adicione um novo valor acima, ou ative &quot;Mostrar inativos&quot;
            para ver os valores desativados.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="divide-y">
            {visiveis.map((valor) => {
              const isEditing = editingId === valor.id
              const isReactivating = reactivatingId === valor.id

              return (
                <div
                  key={valor.id}
                  className="flex min-h-11 items-center gap-2 px-4 text-base"
                >
                  {isEditing ? (
                    <div className="flex flex-1 flex-col gap-1 py-1.5">
                      <Input
                        autoFocus
                        value={editingNome}
                        onChange={(event) =>
                          setEditingNome(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            void saveEdit()
                          } else if (event.key === "Escape") {
                            event.preventDefault()
                            cancelEdit()
                          }
                        }}
                        disabled={editSubmitting}
                        aria-label={`Editar ${valor.nome}`}
                      />
                      {editError ? (
                        <p role="alert" className="text-sm text-destructive">
                          {editError}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <span
                      className={
                        valor.ativo
                          ? "flex-1"
                          : "flex-1 text-muted-foreground"
                      }
                    >
                      {valor.nome}
                      {!valor.ativo ? (
                        <Badge variant="outline" className="ml-2">
                          Inativo
                        </Badge>
                      ) : null}
                    </span>
                  )}

                  <div className="flex shrink-0 items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Salvar"
                          disabled={editSubmitting}
                          onClick={() => void saveEdit()}
                        >
                          <Check className="size-4 text-primary" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Cancelar"
                          disabled={editSubmitting}
                          onClick={cancelEdit}
                        >
                          <X className="size-4" />
                        </Button>
                      </>
                    ) : valor.ativo ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar ${valor.nome}`}
                          onClick={() => startEdit(valor)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Desativar ${valor.nome}`}
                          onClick={() => openDeactivateDialog(valor)}
                        >
                          <EyeOff className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Reativar ${valor.nome}`}
                        disabled={isReactivating}
                        onClick={() => void reactivate(valor)}
                      >
                        <Eye className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog
        open={deactivateTarget !== null}
        onOpenChange={handleDeactivateDialogChange}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar &quot;{deactivateTarget?.nome}&quot;?</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            Esse valor deixa de aparecer para novos cadastros, mas continua
            normalmente nos clientes que já usam &quot;{deactivateTarget?.nome}
            &quot;. Você pode reativar quando quiser.
          </p>

          {deactivateError ? (
            <p role="alert" className="text-sm text-destructive">
              {deactivateError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleDeactivateDialogChange(false)}
              disabled={deactivateSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void confirmDeactivate()}
              disabled={deactivateSubmitting}
            >
              {deactivateSubmitting ? "Desativando..." : "Desativar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
