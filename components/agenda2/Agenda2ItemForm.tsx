"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { format, parseISO } from "date-fns"
import { TriangleAlert } from "lucide-react"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"

import {
  atualizarAgenda2Item,
  criarAgenda2Item,
} from "@/app/actions/agenda2"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { existeItemParecido, type Agenda2Item } from "@/lib/agenda2/itens"
import {
  AGENDA2_BAIRRO_MAX,
  AGENDA2_NOME_MAX,
  agenda2ItemSchema,
  type Agenda2ItemInput,
} from "@/lib/validations/agenda2"

/**
 * Janela de criar/editar item da Agenda 2 (AGD2-01/03, D-06/D-07/D-09,
 * UI-SPEC → Agenda2ItemForm). Dialog CONTROLADO de fora — a Lista (31-08) é
 * quem abre esta janela a partir de três lugares (botão do cabeçalho, botão
 * do estado vazio, "Editar" da linha), por isso este componente não tem seu
 * próprio `DialogTrigger`.
 *
 * O dono do item (`vendedor_id`) NUNCA aparece nesta tela — vem sempre da
 * sessão, dentro da Server Action (31-04, T-31-18). O aviso de duplicado
 * (D-07) é só um aviso, nunca um bloqueio: checado sobre `itensExistentes`
 * (lista já carregada pela Lista), sem nenhuma ida extra ao banco. A dica de
 * LGPD abaixo do nome é orientação, nunca trava — quem recusa números de
 * documento é o próprio schema compartilhado (`agenda2ItemSchema`, 31-02).
 */
export function Agenda2ItemForm({
  open,
  onOpenChange,
  modo,
  item,
  itensExistentes,
  onSalvo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  modo: "criar" | "editar"
  item: Agenda2Item | null
  itensExistentes: Agenda2Item[]
  onSalvo: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {modo === "criar" ? "Adicionar visita" : "Editar item"}
          </DialogTitle>
        </DialogHeader>
        {/* `key` força um componente novo (com `defaultValues` novos) a cada
         * abertura diferente — sem isso, alternar de "editar item A" para
         * "editar item B" (ou para "criar") reaproveitaria o estado interno
         * do formulário anterior. */}
        <Agenda2ItemFields
          key={`${modo}-${item?.id ?? "novo"}`}
          modo={modo}
          item={item}
          itensExistentes={itensExistentes}
          onSalvo={onSalvo}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  )
}

const GENERIC_ERROR = "Não foi possível salvar. Tente novamente."
const LGPD_HINT =
  "Use o Nome Fantasia do cliente. Evite nome completo de pessoa e documentos."

function textoAviso(data: string): string {
  return `Já existe um item parecido para ${format(parseISO(data), "dd/MM")}. Confirme se quer criar mesmo assim.`
}

/** Compara "bruto com bruto" (D-07) — nunca o valor aparado pelo schema
 * contra o valor digitado, ou o aviso sumiria sozinho na hora em que
 * aparecesse. */
function valoresIguais(
  snapshot: Agenda2ItemInput | null,
  atuais: Partial<Agenda2ItemInput>
): boolean {
  if (!snapshot) return false
  return (
    snapshot.nomeCliente === (atuais.nomeCliente ?? "") &&
    snapshot.bairro === (atuais.bairro ?? "") &&
    snapshot.data === (atuais.data ?? "")
  )
}

function Agenda2ItemFields({
  modo,
  item,
  itensExistentes,
  onSalvo,
  onOpenChange,
}: {
  modo: "criar" | "editar"
  item: Agenda2Item | null
  itensExistentes: Agenda2Item[]
  onSalvo: () => void
  onOpenChange: (open: boolean) => void
}) {
  const [formError, setFormError] = useState<string | null>(null)
  const [avisoPara, setAvisoPara] = useState<Agenda2ItemInput | null>(null)
  const [calendarioAberto, setCalendarioAberto] = useState(false)

  const defaultValues: Agenda2ItemInput =
    modo === "editar" && item
      ? { nomeCliente: item.nomeCliente, bairro: item.bairro, data: item.data }
      : { nomeCliente: "", bairro: "", data: "" }

  const form = useForm<Agenda2ItemInput>({
    resolver: zodResolver(agenda2ItemSchema),
    defaultValues,
  })

  const valoresAtuais = useWatch({ control: form.control })
  const mostrarAviso = valoresIguais(avisoPara, valoresAtuais)

  async function onSubmit(values: Agenda2ItemInput) {
    setFormError(null)

    const parecido = existeItemParecido(
      itensExistentes,
      values,
      modo === "editar" && item ? item.id : null
    )

    if (parecido && !mostrarAviso) {
      setAvisoPara(form.getValues())
      return
    }

    try {
      const result =
        modo === "criar"
          ? await criarAgenda2Item(values)
          : await atualizarAgenda2Item((item as Agenda2Item).id, values)

      if (result.error) {
        setFormError(GENERIC_ERROR)
        return
      }

      onSalvo()
      onOpenChange(false)
    } catch {
      setFormError(GENERIC_ERROR)
    }
  }

  const textoBotao = form.formState.isSubmitting
    ? "Salvando..."
    : mostrarAviso
      ? "Criar mesmo assim"
      : modo === "criar"
        ? "Adicionar visita"
        : "Salvar alterações"

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <FormField
          control={form.control}
          name="nomeCliente"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do cliente</FormLabel>
              <FormControl>
                <Input autoComplete="off" maxLength={AGENDA2_NOME_MAX} {...field} />
              </FormControl>
              <FormDescription>{LGPD_HINT}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bairro"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bairro</FormLabel>
              <FormControl>
                <Input autoComplete="off" maxLength={AGENDA2_BAIRRO_MAX} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="data"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data</FormLabel>
              <Popover open={calendarioAberto} onOpenChange={setCalendarioAberto}>
                <PopoverTrigger
                  type="button"
                  className="w-fit rounded-lg border border-input px-2.5 py-1.5 text-left text-sm"
                >
                  {field.value
                    ? format(parseISO(field.value), "dd/MM/yyyy")
                    : "Selecionar data"}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  {/* Nenhuma prop de dias desabilitados (D-09): o calendário
                   * aceita qualquer data, inclusive no passado. A data só é
                   * convertida via `format(dia, "yyyy-MM-dd")`/`parseISO` —
                   * nunca o construtor cru de data a partir de texto. */}
                  <Calendar
                    mode="single"
                    selected={field.value ? parseISO(field.value) : undefined}
                    onSelect={(dia) => {
                      if (!dia) return
                      field.onChange(format(dia, "yyyy-MM-dd"))
                      setCalendarioAberto(false)
                    }}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {mostrarAviso && avisoPara ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
          >
            <TriangleAlert className="size-4 shrink-0 text-amber-600" />
            {textoAviso(avisoPara.data)}
          </div>
        ) : null}

        {formError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </div>
        ) : null}

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {textoBotao}
        </Button>
      </form>
    </Form>
  )
}
