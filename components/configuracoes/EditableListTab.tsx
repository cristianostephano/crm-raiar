"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import {
  createListaValor,
  getListaValores,
  type ListaTabela,
  type ListaValor,
} from "@/app/actions/listas"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  createListaValorSchema,
  type CreateListaValorInput,
} from "@/lib/validations/lista"

const LOAD_ERROR = "Não foi possível carregar os valores. Tente novamente."
const GENERIC_ERROR = "Não foi possível salvar. Tente novamente."
const DUPLICATE_ERROR = (nome: string) =>
  `Já existe um valor chamado "${nome}" nesta lista.`
const ADDED_MESSAGE = (nome: string) => `"${nome}" adicionado.`

/**
 * Shared list + "Adicionar" form for one lookup table, reused across all 4
 * "Configurações" tabs (only "Categoria" is wired in this plan — 03-03 adds
 * the other 3 tabs, and 03-02 adds edit/deactivate/reactivate to this same
 * component). Fetches on mount via getListaValores(tabela) (the "fetch on
 * open" pattern from PerdaMotivoDialog.tsx, adapted to mount instead of a
 * dialog's `open` prop), and shows only ativo === true rows — the "Mostrar
 * inativos" toggle that surfaces inactive rows is 03-02's job.
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
          ? "Digite um nome antes de adicionar."
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

  const ativos = valores.filter((valor) => valor.ativo)

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

      <p className="text-sm text-muted-foreground">
        {isLoading ? "Carregando..." : `${ativos.length} ${pluralAtivoLabel}`}
      </p>

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : isLoading ? null : ativos.length === 0 ? (
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
            {ativos.map((valor) => (
              <div
                key={valor.id}
                className="flex min-h-11 items-center px-4 text-base"
              >
                {valor.nome}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
