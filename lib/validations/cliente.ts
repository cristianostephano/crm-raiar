import { z } from "zod"

/**
 * Shared zod schema for cliente creation, used by both
 * ClienteQuickCreateForm.tsx (client-side validation via zodResolver) and
 * app/actions/clientes.ts's createCliente Server Action (server-side
 * re-validation — a Server Action must never trust client input).
 *
 * CLI-01/CLI-02: only razaoSocial, the endereço fields (cep, rua, numero,
 * cidade, estado — D-11), and responsavel are required. complemento and every
 * other field (categoriaId, contato, telefone, email, numeroDeLojas,
 * produtoIds) are optional and can be filled in later from the client detail
 * screen.
 *
 * `responsavel` mirrors InviteUserForm's D-05 controlled-Select pattern: it
 * starts as "" for a Supervisor (no default pre-selected, per CLI-03) and is
 * pre-filled + disabled for a Vendedor. Rejecting "" via an object-level
 * `.superRefine` (not a per-field `.refine()` on the field itself) is
 * required — chaining `.refine()` onto a single field turns it into a
 * ZodEffects type, which breaks @hookform/resolvers' generic inference
 * against zod v4 (see 02-PATTERNS.md and InviteUserForm.tsx's identical
 * comment for `role`).
 */
export const createClienteSchema = z
  .object({
    razaoSocial: z.string().min(1, "Informe a razão social."),
    cep: z.string().min(1, "Informe o CEP."),
    rua: z.string().min(1, "Informe a rua."),
    numero: z.string().min(1, "Informe o número."),
    complemento: z.string().optional(),
    cidade: z.string().min(1, "Informe a cidade."),
    estado: z.string().min(1, "Informe o estado."),
    // "" is the controlled empty state (Supervisor: no default choice yet);
    // the superRefine below rejects it before submit can succeed.
    responsavel: z.string(),
    categoriaId: z.string().optional(),
    contato: z.string().optional(),
    telefone: z.string().optional(),
    email: z
      .union([z.literal(""), z.string().email("Informe um e-mail válido.")])
      .optional(),
    numeroDeLojas: z.number().int().nonnegative().optional(),
    produtoIds: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.responsavel === "") {
      ctx.addIssue({
        code: "custom",
        message: "Selecione o responsável.",
        path: ["responsavel"],
      })
    }
  })

export type CreateClienteInput = z.infer<typeof createClienteSchema>

/**
 * Shared zod schema for editing an existing cliente (CLI-02/CLI-05/CLI-06),
 * used by both ClienteDetailSheet.tsx (react-hook-form + zodResolver) and
 * updateCliente's server-side re-validation in app/actions/clientes.ts.
 *
 * Same required/optional split as createClienteSchema (razão social,
 * endereço incl. D-11 cidade/estado, and responsavel are required; every
 * other field can be completed later, per CLI-02), plus the row `id` being
 * edited. `responsavel` keeps the same ""-sentinel + object-level
 * `.superRefine` trick as createClienteSchema/InviteUserForm's `role` — a
 * per-field `.refine()` would turn it into a ZodEffects type and break
 * @hookform/resolvers' generic inference against zod v4 (02-PATTERNS.md).
 * A Vendedor's form renders this field read-only (own name, non-editable),
 * so it always submits their own uid — but updateCliente() still strips any
 * client-sent responsavel change server-side for a non-Supervisor caller
 * (defense in depth; the real boundary is the UPDATE ... WITH CHECK RLS
 * policy from 02-01).
 */
export const updateClienteSchema = z
  .object({
    id: z.string().min(1),
    razaoSocial: z.string().min(1, "Informe a razão social."),
    cep: z.string().min(1, "Informe o CEP."),
    rua: z.string().min(1, "Informe a rua."),
    numero: z.string().min(1, "Informe o número."),
    complemento: z.string().optional(),
    cidade: z.string().min(1, "Informe a cidade."),
    estado: z.string().min(1, "Informe o estado."),
    responsavel: z.string(),
    categoriaId: z.string().optional(),
    contato: z.string().optional(),
    telefone: z.string().optional(),
    email: z
      .union([z.literal(""), z.string().email("Informe um e-mail válido.")])
      .optional(),
    numeroDeLojas: z.number().int().nonnegative().optional(),
    produtoIds: z.array(z.string()).optional(),
    // FUN-07: free-text observação, folded into updateCliente rather than a
    // separate "salvarObservacao" action — saved together with the rest of
    // "Salvar alterações" (02-07).
    observacao: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.responsavel === "") {
      ctx.addIssue({
        code: "custom",
        message: "Selecione o responsável.",
        path: ["responsavel"],
      })
    }
  })

export type UpdateClienteInput = z.infer<typeof updateClienteSchema>
