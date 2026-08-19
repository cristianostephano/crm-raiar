import { z } from "zod"

import { UFS } from "@/lib/clientes/ufs"

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
 *
 * ATV-01/ATV-02: os três campos do cliente ativo (nome fantasia, CNPJ,
 * frequência de pedidos) entram SÓ no esquema de EDIÇÃO abaixo, nunca aqui —
 * é o mecanismo literal por trás do critério de sucesso 1 da Fase 16 ("o
 * cadastro rápido continua sem pedir nenhum dos dois").
 */
export const createClienteSchema = z
  .object({
    razaoSocial: z.string().min(1, "Informe a razão social."),
    cep: z.string().min(1, "Informe o CEP."),
    rua: z.string().min(1, "Informe a rua."),
    numero: z.string().min(1, "Informe o número."),
    complemento: z.string().optional(),
    cidade: z.string().min(1, "Selecione uma cidade válida."),
    estado: z.enum(UFS, { message: "Selecione um estado válido." }),
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
 * Razão social and responsavel are required, plus the row `id` being
 * edited. `responsavel` keeps the same ""-sentinel + object-level
 * `.superRefine` trick as createClienteSchema/InviteUserForm's `role` — a
 * per-field `.refine()` would turn it into a ZodEffects type and break
 * @hookform/resolvers' generic inference against zod v4 (02-PATTERNS.md).
 * A Vendedor's form renders this field read-only (own name, non-editable),
 * so it always submits their own uid — but updateCliente() still strips any
 * client-sent responsavel change server-side for a non-Supervisor caller
 * (defense in depth; the real boundary is the UPDATE ... WITH CHECK RLS
 * policy from 02-01).
 *
 * Quick task 260819-m8q (D-06): unlike createClienteSchema above, this
 * schema DIVERGES from it on the 5 endereço fields — since then it accepts
 * cep/rua/numero/cidade in blank (plain optional-shaped text, same as
 * complemento/contato) and estado in blank OR a valid UF (union with the
 * empty-string literal, same convention `email` below already uses for
 * "opcional, mas se vier tem que ser válido" — preserves the enum's own
 * "Selecione um estado válido." message nested inside the union error).
 * This divergence is intentional: opening the ficha of a cliente imported
 * without an address (Fase 6/7) to edit anything else (e.g. só corrigir o
 * telefone) must not be blocked by the 5 endereço fields the way the
 * cadastro manual still is. `createClienteSchema` above is UNCHANGED and
 * keeps requiring all 5 — the cadastro manual keeps demanding full address
 * on purpose (D-01).
 *
 * ATV-01/ATV-02 (Fase 16): nome fantasia, CNPJ e frequência de pedidos são
 * três campos opcionais de texto a mais, ao lado de contato/telefone/email —
 * mesma postura branda (sem `.min()`, sem `.regex()`): a validação de CNPJ
 * está explicitamente fora de escopo do projeto. A frequência de pedidos é
 * re-validada contra o vocabulário do banco no servidor (updateCliente),
 * não aqui — o zod não sabe o catálogo dinâmico.
 */
export const updateClienteSchema = z
  .object({
    id: z.string().min(1),
    razaoSocial: z.string().min(1, "Informe a razão social."),
    // D-06: texto simples aceitando vazio — NÃO `.optional()` (mantém o
    // campo sempre presente/tipo string, nunca `string | undefined`), para
    // não quebrar EstadoCidadeFields (genérico sobre `cidade: string`) nem
    // tornar o campo de formulário não-controlado.
    cep: z.string(),
    rua: z.string(),
    numero: z.string(),
    complemento: z.string().optional(),
    cidade: z.string(),
    estado: z.union([
      z.literal(""),
      z.enum(UFS, { message: "Selecione um estado válido." }),
    ]),
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
    // ATV-01: opcionais, sem tamanho mínimo, sem formato exigido.
    nomeFantasia: z.string().optional(),
    cnpj: z.string().optional(),
    // ATV-02: re-validado contra o vocabulário do banco em updateCliente().
    frequenciaPedidos: z.string().optional(),
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
