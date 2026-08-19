"use client"

import { useEffect, useState } from "react"
import type {
  Control,
  FieldValues,
  Path,
  PathValue,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form"

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UFS } from "@/lib/clientes/ufs"
import { createClient } from "@/lib/supabase/client"

/**
 * Shared shape both CreateClienteInput and UpdateClienteInput satisfy —
 * lets this component stay generic over either form's TFieldValues while
 * still statically knowing "cidade"/"estado"/"complemento" are valid field
 * names (09-03/09-PATTERNS.md: extraction of ClienteQuickCreateForm.tsx's
 * inline complemento/cidade/estado row, lines 228-268).
 */
type EstadoCidadeFormShape = {
  complemento?: string
  cidade: string
  estado: string
}

/**
 * Estado→Cidade cascade (LOC-01/LOC-02, D-02): Estado is a Select over the
 * fixed UFS constant; Cidade is a searchable Combobox populated from the
 * cidades_por_estado(uf) RPC, disabled until an Estado is chosen, and reset
 * every time Estado changes (never carries a stale city into a newly-picked
 * state). Renders the whole `grid grid-cols-3 gap-3` row (Complemento/
 * Cidade/Estado, in that column order) so it's a drop-in replacement for
 * the equivalent block in ClienteQuickCreateForm.tsx and
 * ClienteDetailSheet.tsx (shared by both consumers since plan 09-05).
 *
 * Quick task 260819-m8q (D-06): this component itself has NO required/
 * optional notion of its own — whether Cidade/Estado are mandatory is
 * entirely a property of the zod schema each consumer's form is wired to
 * (createClienteSchema, still required, vs updateClienteSchema, now
 * accepts blank). There is no asterisk or "obrigatório" text in this
 * component's UI either way — the only signal to the user is whatever
 * FormMessage renders from that schema, which disappears on its own once a
 * schema stops requiring the field. Cidade stays disabled until an Estado
 * is chosen either way, unchanged by D-06.
 */
export function EstadoCidadeFields<
  TFieldValues extends FieldValues & EstadoCidadeFormShape,
>({
  control,
  watch,
  setValue,
  estadoItems,
}: {
  control: Control<TFieldValues>
  watch: UseFormWatch<TFieldValues>
  setValue: UseFormSetValue<TFieldValues>
  /**
   * Optional `items` pass-through for the Estado Select (UI-SPEC §5): lets
   * a legacy out-of-UFS value already on the form (ClienteDetailSheet,
   * D-01/LOC-04) render instead of falling back to raw-value display only
   * once the popup has opened once — same `items` convention already used
   * by ClienteDetailSheet's other pre-selected Selects.
   */
  estadoItems?: { value: string; label: string }[]
}) {
  const cidadeName = "cidade" as Path<TFieldValues>
  const estadoName = "estado" as Path<TFieldValues>
  const complementoName = "complemento" as Path<TFieldValues>

  const estado = watch(estadoName) as unknown as string

  const [cidades, setCidades] = useState<string[]>([])
  const [cidadeOpen, setCidadeOpen] = useState(false)

  useEffect(() => {
    if (!estado) {
      return
    }

    let cancelled = false
    createClient()
      .rpc("cidades_por_estado", { p_uf: estado })
      .then(({ data }: { data: { nome: string }[] | null }) => {
        if (!cancelled) {
          setCidades((data ?? []).map((row) => row.nome))
        }
      })

    return () => {
      cancelled = true
    }
  }, [estado])

  // A lista exibida é derivada do Estado selecionado em vez de guardada:
  // zerar o estado do React dentro do corpo do efeito dispara render em
  // cascata (regra react-hooks/set-state-in-effect). Derivar produz
  // exatamente o mesmo resultado renderizado.
  const cidadesVisiveis = estado ? cidades : []

  return (
    <div className="grid grid-cols-3 gap-3">
      <FormField
        control={control}
        name={complementoName}
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
        control={control}
        name={cidadeName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cidade</FormLabel>
            <FormControl>
              <Combobox
                items={cidadesVisiveis}
                value={(field.value as string) || null}
                onValueChange={(value) => field.onChange(value ?? "")}
                onOpenChange={setCidadeOpen}
                disabled={!estado}
              >
                <ComboboxInput
                  disabled={!estado}
                  placeholder={
                    !estado
                      ? "Escolha o Estado primeiro"
                      : cidadeOpen
                        ? "Buscar cidade..."
                        : "Selecione a cidade"
                  }
                />
                <ComboboxContent>
                  <ComboboxEmpty>Nenhuma cidade encontrada</ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxCollection>
                      {(cidade: string) => (
                        <ComboboxItem key={cidade} value={cidade}>
                          {cidade}
                        </ComboboxItem>
                      )}
                    </ComboboxCollection>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={estadoName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Estado</FormLabel>
            <FormControl>
              <Select
                value={field.value as string}
                items={estadoItems}
                onValueChange={(value) => {
                  field.onChange(value)
                  // Cascade reset (D-02/UI-SPEC §1): a newly-picked Estado
                  // always clears any previously-selected Cidade — never
                  // carry a city name from one UF into another.
                  setValue(
                    cidadeName,
                    "" as PathValue<TFieldValues, Path<TFieldValues>>,
                    { shouldValidate: false }
                  )
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  {UFS.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
