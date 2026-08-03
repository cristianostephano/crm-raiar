/**
 * Phase 10 (desativação de membro da equipe) — pure error-code mapper for
 * the two `SECURITY DEFINER` RPCs (`desativar_membro_equipe`,
 * `reativar_membro_equipe`).
 *
 * Why this lives outside app/actions/equipe.ts: a "use server" file may
 * only export async functions, so a synchronous mapper cannot live there.
 * Keeping it dependency-free also lets DesativarMembroDialog.tsx import the
 * result/type shapes without pulling `next/headers` into the client bundle
 * — the same reason `lib/clientes/completude.ts` was extracted into its own
 * pure module.
 *
 * Why the codes extend 10-PATTERNS.md's five-member union with three more:
 * the UI-SPEC's Copywriting Contract requires four distinct error messages
 * for four distinct causes. Doing the Postgres-exception-text matching
 * here, once, keeps that string coupling out of the React component
 * entirely.
 */

// Single source of truth for the fragment -> code matches: each matchable
// code literal is written exactly once, here, and both the exported type
// and mapRpcErrorToCode() derive from this same list (rather than
// restating the string literals separately in a type union and in a
// parallel if/else chain, which would let the two silently drift apart).
const RPC_ERROR_MATCHERS = [
  { fragment: "a própria conta", code: "self_deactivation" },
  { fragment: "último Supervisor ativo", code: "last_supervisor" },
  { fragment: "substituto inválido", code: "invalid_substitute" },
  { fragment: "Somente supervisores", code: "forbidden" },
] as const

export type DesativarMembroErrorCode =
  | "unauthenticated"
  | (typeof RPC_ERROR_MATCHERS)[number]["code"]
  | "rpc_failed"
  | "ban_failed"
  | "generic"

export type DesativarMembroResult =
  | { data: { clientesReatribuidos: number }; error?: undefined }
  | { data?: undefined; error: { code: DesativarMembroErrorCode; message?: string } }

/**
 * Matches distinctive fragments of the Postgres exception text raised by
 * `desativar_membro_equipe` / `reativar_membro_equipe`, in RPC_ERROR_MATCHERS
 * order, returning on the first match. Anything else — including a
 * null/undefined message, and including "Membro não encontrado" (which has
 * no dedicated message in the Copywriting Contract) — returns "rpc_failed".
 */
export function mapRpcErrorToCode(
  message: string | null | undefined
): DesativarMembroErrorCode {
  if (!message) {
    return "rpc_failed"
  }

  for (const matcher of RPC_ERROR_MATCHERS) {
    if (message.includes(matcher.fragment)) {
      return matcher.code
    }
  }

  return "rpc_failed"
}
