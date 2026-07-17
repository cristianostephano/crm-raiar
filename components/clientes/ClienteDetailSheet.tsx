"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { deleteCliente, getClienteDetalhe, updateCliente } from "@/app/actions/clientes"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  updateClienteSchema,
  type UpdateClienteInput,
} from "@/lib/validations/cliente"
import type { ClienteDetalhe } from "@/lib/supabase/queries/clientes"

const DUPLICATE_RAZAO_SOCIAL_ERROR =
  "Já existe um cliente cadastrado com essa razão social."
const GENERIC_ERROR = "Não foi possível salvar as alterações. Tente novamente."
const SUCCESS_MESSAGE = "Cliente salvo com sucesso."
const LOAD_ERROR =
  "Não foi possível carregar os dados do cliente. Tente novamente."
const DELETE_GENERIC_ERROR = "Não foi possível apagar o cliente. Tente novamente."

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
    estado: cliente.estado,
    responsavel: cliente.responsavel,
    categoriaId: cliente.categoriaId ?? "",
    contato: cliente.contato ?? "",
    telefone: cliente.telefone ?? "",
    email: cliente.email ?? "",
    numeroDeLojas: cliente.numeroDeLojas ?? undefined,
    produtoIds: cliente.produtoIds,
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
      estado: "",
      responsavel: "",
      categoriaId: "",
      contato: "",
      telefone: "",
      email: "",
      numeroDeLojas: undefined,
      produtoIds: [],
    },
  })

  useEffect(() => {
    if (!open || !clienteId) {
      setCliente(null)
      setLoadError(null)
      setFormError(null)
      setSuccessMessage(null)
      setConfirmDeleteOpen(false)
      setDeleteError(null)
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

    return () => {
      cancelled = true
    }
    // form is stable across renders (react-hook-form); only re-fetch when
    // the Sheet opens for a different clienteId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clienteId])

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

  const produtoIds = form.watch("produtoIds") ?? []

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

                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="complemento"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cidade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input autoComplete="address-level2" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="estado"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado</FormLabel>
                          <FormControl>
                            <Input autoComplete="address-level1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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

                  <Separator />
                  <h2 className="text-xl font-semibold">Funil</h2>
                  {/* Empty on purpose — 02-07 fills this section (status
                   * select, observação textarea, tarefas checklist,
                   * histórico timeline) without restructuring this Sheet. */}
                  <div
                    data-slot="funil-section-placeholder"
                    className="flex flex-col gap-3"
                  />
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
    </>
  )
}
