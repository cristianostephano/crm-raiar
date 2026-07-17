import { z } from "zod"

/**
 * Shared zod schema for the 4 editable-list lookup tables (categorias,
 * produtos_consumidos, tipos_tarefa, motivos_perda) — they all share the
 * same { id, nome, ativo } shape, so a single create/update schema pair
 * covers all 4 tabs (no need for 4 near-identical schema files). Used by
 * both EditableListTab.tsx (client-side validation via zodResolver) and
 * app/actions/listas.ts's createListaValor Server Action (server-side
 * re-validation — a Server Action must never trust client input).
 */
export const createListaValorSchema = z.object({
  nome: z.string().min(1, "Digite um nome antes de adicionar."),
})

export type CreateListaValorInput = z.infer<typeof createListaValorSchema>

/**
 * Edit schema (plan 03-02's updateListaValor) — same `nome` rule as create,
 * plus the row `id` being edited.
 */
export const updateListaValorSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1, "Digite um nome antes de adicionar."),
})

export type UpdateListaValorInput = z.infer<typeof updateListaValorSchema>
