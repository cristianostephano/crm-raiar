import { z } from "zod"

/**
 * Per-row Zod schema for the import preview (Fase 6, IMP-05). Required
 * fields mirror lib/validations/cliente.ts's createClienteSchema exactly
 * (razaoSocial, cep, rua, numero, cidade, estado, responsavel) — the same
 * minimum rules apply whether a cliente is typed manually or imported from a
 * spreadsheet, per 06-CONTEXT.md's reuse instruction.
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
 * the right message family (endereço fields all collapse to a single
 * "Endereço não informado" reason), but the messages are still defined here
 * so the schema is self-describing if used standalone.
 */
export const createImportRowSchema = z.object({
  razaoSocial: z.string().min(1, "Razão social não informada"),
  cep: z.string().min(1, "Endereço não informado"),
  rua: z.string().min(1, "Endereço não informado"),
  numero: z.string().min(1, "Endereço não informado"),
  cidade: z.string().min(1, "Endereço não informado"),
  estado: z.string().min(1, "Endereço não informado"),
  responsavel: z.string().min(1, "Responsável não informado"),
  complemento: z.string().optional(),
  contato: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
  numeroDeLojas: z.string().optional(),
})

export type ImportRowInput = z.infer<typeof createImportRowSchema>

/** The 5 endereço fields that collapse into a single "Endereço não informado"
 * reason in annotarLinha, rather than one reason per missing field. */
export const ENDERECO_FIELDS = ["cep", "rua", "numero", "cidade", "estado"] as const
