/**
 * Confirm-time accounting for the batch import write (Fase 7, IMP-06/D-02/
 * D-03). Pure module — no Supabase import, no "use server"/"use client"
 * directive — same discipline as lib/importacao/dedupe.ts/annotarLinha.ts,
 * so it is fully unit-testable (tests/importacao/confirmar.test.ts) without
 * .env.local or a live Next.js request scope.
 *
 * `planConfirmacao` decides exactly which reviewed rows become the RPC's
 * `p_clientes` insert set and groups every excluded row under the reason
 * vocabulary the summary screen renders (07-UI-SPEC.md's Copywriting
 * Contract). `reconcileImportados` folds the RPC's own returned rows back
 * into an honest importados/puladas split, covering the rare ON CONFLICT
 * race between confirm-time D-02 revalidation and the actual insert.
 *
 * D-03: nothing here writes to any table or persists a puladas record —
 * every return value is in-memory only, scoped to this one confirm request.
 */

import type { ValidatedRow } from "@/app/actions/importacao"
import { findDuplicates } from "@/lib/importacao/dedupe"
import type { ResolvedRow } from "@/lib/importacao/annotarLinha"

/** Reason vocabulary for duplicate-related skips — 07-UI-SPEC.md's exact
 * Copywriting Contract strings, distinct from the review-time duplicate
 * reason (`Possível duplicado de "X"`, produced by validarLoteImportacao). */
const DUPLICADO_PULADO_NA_REVISAO_REASON =
  "Possível duplicado (pulado na revisão)"
const DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON =
  "Duplicado encontrado ao confirmar — não existia no momento da revisão"

/** Exact snake_case keys the importar_clientes_lote RPC's
 * jsonb_to_recordset expects (supabase/migrations/0006_...sql). */
export type RpcClienteRow = {
  razao_social: string
  cep: string
  rua: string
  numero: string
  complemento: string | null
  cidade: string
  estado: string
  responsavel: string | null
  categoria_id: string | null
  contato: string | null
  telefone: string | null
  email: string | null
  numero_de_lojas: number | null
  produto_ids: string[]
}

export type PuladaGroup = { motivo: string; quantidade: number }

export type PlanConfirmacaoResult = {
  rowsToInsert: RpcClienteRow[]
  puladas: PuladaGroup[]
  puladasCount: number
}

/** Maps a resolved/sanitized review row (Fase 6) to the RPC's snake_case
 * insert shape. numeroDeLojas is a string on ResolvedRow (raw sanitized
 * cell) — parsed to a number here, null when empty/non-numeric. */
function toRpcClienteRow(resolved: ResolvedRow): RpcClienteRow {
  const parsed = resolved.numeroDeLojas
    ? Number(resolved.numeroDeLojas)
    : NaN

  return {
    razao_social: resolved.razaoSocial,
    cep: resolved.cep,
    rua: resolved.rua,
    numero: resolved.numero,
    complemento: resolved.complemento,
    cidade: resolved.cidade,
    estado: resolved.estado,
    responsavel: resolved.responsavelId,
    categoria_id: resolved.categoriaId,
    contato: resolved.contato,
    telefone: resolved.telefone,
    email: resolved.email,
    numero_de_lojas: Number.isFinite(parsed) ? parsed : null,
    produto_ids: resolved.produtoIds,
  }
}

/**
 * Decides which reviewed rows get inserted and why the rest are skipped.
 *
 * Classification (IMP-06 — one bad row never blocks the batch):
 * - status "erro" → skipped; every reason string in `reasons` contributes to
 *   its own puladas group, the row itself counted once toward puladasCount.
 * - status "duplicado" with decision "importar" (supervisor override) →
 *   candidate for insertion, NOT re-excluded by the D-02 re-check below.
 * - status "duplicado" with decision "pular" (or no decision recorded,
 *   default "pular") → skipped under DUPLICADO_PULADO_NA_REVISAO_REASON.
 * - status "ok" → candidate for insertion.
 *
 * D-02: findDuplicates (reused verbatim from lib/importacao/dedupe.ts) reruns
 * ONLY over the "ok" candidates (never the explicit "importar" overrides)
 * against `existentesRazaoSocial`. Any ok candidate that now matches is
 * moved to skipped under DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON.
 */
export function planConfirmacao(
  linhas: ValidatedRow[],
  decisions: Record<number, "importar" | "pular">,
  existentesRazaoSocial: string[]
): PlanConfirmacaoResult {
  const skippedRows = new Set<number>()
  const reasonCounts = new Map<string, number>()

  function addSkip(row: number, reason: string): void {
    skippedRows.add(row)
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
  }

  const candidates: ValidatedRow[] = []
  const overrideRows = new Set<number>()

  for (const linha of linhas) {
    if (linha.status === "erro") {
      for (const reason of linha.reasons) {
        addSkip(linha.row, reason)
      }
      continue
    }

    if (linha.status === "duplicado") {
      const decision = decisions[linha.row] ?? "pular"
      if (decision === "importar") {
        candidates.push(linha)
        overrideRows.add(linha.row)
      } else {
        addSkip(linha.row, DUPLICADO_PULADO_NA_REVISAO_REASON)
      }
      continue
    }

    // status === "ok"
    candidates.push(linha)
  }

  const okCandidates = candidates.filter((c) => !overrideRows.has(c.row))
  const batchForDedupe = okCandidates.map((c) => ({
    row: c.row,
    razaoSocial: c.resolved.razaoSocial,
  }))
  const newDuplicates = findDuplicates(batchForDedupe, existentesRazaoSocial)

  const rowsToInsert: RpcClienteRow[] = []
  for (const candidate of candidates) {
    if (!overrideRows.has(candidate.row) && newDuplicates.has(candidate.row)) {
      addSkip(candidate.row, DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON)
      continue
    }
    rowsToInsert.push(toRpcClienteRow(candidate.resolved))
  }

  const puladas: PuladaGroup[] = Array.from(reasonCounts.entries()).map(
    ([motivo, quantidade]) => ({ motivo, quantidade })
  )

  return { rowsToInsert, puladas, puladasCount: skippedRows.size }
}

export type ReconcileImportadosResult = {
  importados: { razaoSocial: string }[]
  puladasExtra: PuladaGroup[]
}

/**
 * Folds the RPC's actual returned razão-social set back into an honest
 * importados/puladas split — covers the rare ON CONFLICT DO NOTHING race
 * backstop (a row survived planConfirmacao's D-02 check but still collided
 * at INSERT time, e.g. two confirms racing on the same razão social).
 * Reported under the same confirm-time duplicate reason as D-02 itself,
 * since from the Supervisor's perspective it is the same story: "this row
 * didn't exist during review, but does now."
 */
export function reconcileImportados(
  rowsToInsert: RpcClienteRow[],
  returnedRazoes: string[]
): ReconcileImportadosResult {
  const returnedSet = new Set(returnedRazoes)
  const importados: { razaoSocial: string }[] = []
  let raceSkippedCount = 0

  for (const row of rowsToInsert) {
    if (returnedSet.has(row.razao_social)) {
      importados.push({ razaoSocial: row.razao_social })
    } else {
      raceSkippedCount++
    }
  }

  const puladasExtra: PuladaGroup[] =
    raceSkippedCount > 0
      ? [
          {
            motivo: DUPLICADO_ENCONTRADO_AO_CONFIRMAR_REASON,
            quantidade: raceSkippedCount,
          },
        ]
      : []

  return { importados, puladasExtra }
}
