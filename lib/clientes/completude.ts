/**
 * D-02 "cadastro incompleto" pure predicate, extracted out of
 * lib/supabase/queries/clientes.ts (02-05) into its own dependency-free
 * module so it can be safely imported from BOTH server code (that module,
 * which uses lib/supabase/server.ts's next/headers-dependent createClient())
 * and a Client Component (KanbanBoard.tsx, 02-06's edit-save flow needs the
 * exact same predicate to recompute the badge after an edit). Importing a
 * runtime value (not just a type) from lib/supabase/queries/clientes.ts
 * directly into a Client Component pulls next/headers into the client
 * bundle and fails the Next.js build — this module has zero such
 * dependencies, so it's safe on both sides.
 *
 * lib/supabase/queries/clientes.ts re-exports both symbols so every
 * existing import path (including tests/clientes/incompleto.test.ts) keeps
 * working unchanged.
 */

/**
 * Fields isClienteIncompleto() reads to decide "cadastro incompleto" (D-02)
 * — a subset of ClienteListItem so callers other than the query module
 * (e.g. the edit-form save flow) can reuse the exact same predicate without
 * needing the full row shape.
 */
export type ClienteCompletudeInput = {
  categoria_id: string | null
  contato: string | null
  telefone: string | null
  email: string | null
  numero_de_lojas: number | null
  produtos: { id: string; nome: string }[]
}

/**
 * D-02: a cliente is "incompleto" when ANY optional field is blank —
 * categoria, contato, telefone, email, número de lojas, or produtos
 * consumidos (empty list). Returns false only when every optional field is
 * filled. This is the SINGLE source of truth reused by the "Incompleto"
 * badge (ClienteCard), the "Incompletos" tab filter (ClienteToolbar/
 * KanbanBoard), and the client-side patch KanbanBoard applies right after a
 * successful edit (02-06) — they all read/recompute from this exact
 * function, so they can never disagree.
 */
export function isClienteIncompleto(cliente: ClienteCompletudeInput): boolean {
  return (
    !cliente.categoria_id ||
    !cliente.contato ||
    !cliente.telefone ||
    !cliente.email ||
    cliente.numero_de_lojas == null ||
    cliente.produtos.length === 0
  )
}
