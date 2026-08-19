import { z } from "zod"

/**
 * Per-row Zod schema for the import preview (Fase 6, IMP-05).
 *
 * Quick task 260819-m8q (D-01/D-02): this schema DIVERGED from
 * lib/validations/cliente.ts's createClienteSchema. Only `razaoSocial` and
 * `responsavel` remain required — the 5 endereço fields (cep, rua, numero,
 * cidade, estado) are now optional here, exactly like complemento/contato/
 * telefone already were, so a spreadsheet with incomplete address data is
 * accepted. The manual cadastro form (createClienteSchema) is untouched and
 * still requires all 5 — this divergence is intentional, not a drift.
 *
 * Unlike createClienteSchema, this schema is validated directly with
 * `.safeParse()` inside a Server Action (lib/importacao/annotarLinha.ts /
 * app/actions/importacao.ts) — there is no react-hook-form + zodResolver on
 * the server side, so createClienteSchema's `.superRefine()`-instead-of-
 * per-field-`.refine()` constraint (documented there to avoid breaking
 * @hookform/resolvers' generic inference against zod v4) doesn't bind here.
 * Plain `.min(1, message)` per required field is enough. That constraint
 * would only re-apply if this schema were ever reused client-side with
 * react-hook-form (not the case in this phase).
 *
 * Messages match 06-UI-SPEC.md's Copywriting Contract exactly — annotarLinha
 * reads `error.issues[].path` (not `.message`) to map each missing field to
 * the right message family.
 */
export const createImportRowSchema = z.object({
  razaoSocial: z.string().min(1, "Razão social não informada"),
  responsavel: z.string().min(1, "Responsável não informado"),
  cep: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  complemento: z.string().optional(),
  contato: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
  numeroDeLojas: z.string().optional(),
})

export type ImportRowInput = z.infer<typeof createImportRowSchema>
