/**
 * Phase 10 (desativação de membro da equipe) — shared member type + pure
 * substitute-picker filter. No React, no "use client", no Supabase import:
 * both EquipeList.tsx and DesativarMembroDialog.tsx import this, and the
 * page reads the same shape straight off a `profiles` select() — keeping it
 * here (not re-exported from a component) avoids an import cycle between
 * the list and the dialog, the same cycle 07-03 avoided by keeping shared
 * types out of components.
 */

export type EquipeMember = {
  id: string
  nome: string
  sobrenome: string
  email: string
  // Kept as `string` (not a narrow union) because
  // app/(app)/equipe/page.tsx reads it straight from a select() and already
  // renders unknown roles through a label lookup with a fallback.
  role: string
  ativo: boolean
}

/**
 * Returns the active Vendedores eligible to be picked as a replacement for
 * `alvoId` in the deactivation dialog.
 *
 * `alvoId` is excluded (not merely filtered by role) because the member
 * being deactivated is still `ativo === true` at the moment the dialog
 * opens — without this exclusion the picker would happily offer them as
 * their own replacement, and the RPC's defensive check (which only verifies
 * the substitute exists and is active) would accept it, reassigning their
 * in-progress clientes to themselves immediately before switching them off.
 *
 * Restricting to Vendedores is a UI convenience matching the "vendedor
 * substituto" wording — it is not the trust boundary. The real trust
 * boundary stays the RPC's own `ativo = true` re-check on the chosen id.
 */
export function substitutosDisponiveis(
  members: EquipeMember[],
  alvoId: string
): EquipeMember[] {
  return members
    .filter(
      (member) =>
        member.role === "vendedor" && member.ativo === true && member.id !== alvoId
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
}
