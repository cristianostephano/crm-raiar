"use server"

import { revalidatePath } from "next/cache"

import {
  annotarLinha,
  type AnnotarLinhaLookups,
  type MappedRow,
  type ResolvedRow,
  type VendedorLookup,
} from "@/lib/importacao/annotarLinha"
import {
  planConfirmacao,
  reconcileImportados,
  type PuladaGroup,
} from "@/lib/importacao/confirmar"
import { findDuplicates } from "@/lib/importacao/dedupe"
import { createClient } from "@/lib/supabase/server"
import { getCategoriasAtivas, getProdutosAtivos } from "@/lib/supabase/queries/clientes"

export type ValidarLoteErrorCode = "unauthenticated" | "forbidden" | "generic"

export type ValidatedRowStatus = "ok" | "duplicado" | "erro"

/** One validated row for the review screen (06-04) — status precedence is
 * erro > duplicado > ok (a row that failed required-field/lookup validation
 * is never also flagged as a duplicate). */
export type ValidatedRow = {
  row: number
  status: ValidatedRowStatus
  reasons: string[]
  similarTo?: string
  resolved: ResolvedRow
}

export type ValidateLoteResult =
  | { data: { linhas: ValidatedRow[] }; error?: undefined }
  | { data?: undefined; error: { code: ValidarLoteErrorCode } }

/**
 * Read-only Server Action orchestrating the import preview (IMP-04/IMP-05/
 * IMP-07/IMP-10) — validates every mapped row against RLS-scoped lookups and
 * flags possible duplicates, but NEVER writes to the database (no
 * insert/update/rpc/revalidatePath). This is Fase 6's entire job: the
 * confirmarLoteImportacao Server Action + the importar_clientes_lote RPC
 * (is_supervisor()-gated, per ARCHITECTURE.md Pattern 4) that actually
 * create clientes are Fase 7 scope.
 *
 * IMP-10 (server-side feature gate): `is_supervisor` is checked here BEFORE
 * any data read, exactly like deleteCliente's discipline in
 * app/actions/clientes.ts — this app-layer check is the real boundary for
 * "may use the import feature at all" in this read-only phase; the real
 * WRITE-time is_supervisor() guard belongs to Fase 7's RPC.
 */
export async function validarLoteImportacao(
  linhas: MappedRow[]
): Promise<ValidateLoteResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const isSupervisor = callerProfile?.role === "supervisor"

  if (!isSupervisor) {
    return { error: { code: "forbidden" } }
  }

  // `linhas` are client-sent DATA (the parsed/mapped spreadsheet rows),
  // never an authorization input — the is_supervisor gate above is the only
  // barrier, same posture as getClientesParaExportacao's `ids` parameter.
  const [categorias, produtos, vendedoresResult, existentesResult] = await Promise.all(
    [
      getCategoriasAtivas(),
      getProdutosAtivos(),
      supabase.from("profiles").select("id, nome, sobrenome, email"),
      // Narrow, RLS-scoped duplicate-check read (reuses the pattern of
      // getClientesParaExportacao): for a Supervisor, clientes' RLS SELECT
      // policy returns the whole base — exactly the set dedup must compare
      // against. NEVER add a manual responsavel filter here.
      supabase.from("clientes").select("razao_social"),
    ]
  )

  if (vendedoresResult.error || existentesResult.error) {
    return { error: { code: "generic" } }
  }

  const vendedores: VendedorLookup[] = (vendedoresResult.data ?? []).map((row) => ({
    id: row.id as string,
    nome: row.nome as string,
    sobrenome: row.sobrenome as string,
    email: row.email as string,
  }))

  const lookups: AnnotarLinhaLookups = { vendedores, categorias, produtos }

  const existentes = (existentesResult.data ?? []).map(
    (row) => row.razao_social as string
  )

  const annotated = linhas.map((linha) => annotarLinha(linha, lookups))

  const batchForDedupe = annotated.map((annotatedRow, index) => ({
    row: index,
    razaoSocial: annotatedRow.resolved.razaoSocial,
  }))

  const duplicates = findDuplicates(batchForDedupe, existentes)

  // Precedence: erro > duplicado > ok — a row that already failed
  // required-field/lookup validation is never promoted to "duplicado", even
  // if its razão social also happens to collide.
  const result: ValidatedRow[] = annotated.map((annotatedRow, index) => {
    if (annotatedRow.status === "erro") {
      return {
        row: index,
        status: "erro",
        reasons: annotatedRow.reasons,
        resolved: annotatedRow.resolved,
      }
    }

    const similarTo = duplicates.get(index)
    if (similarTo) {
      return {
        row: index,
        status: "duplicado",
        reasons: [`Possível duplicado de "${similarTo}"`],
        similarTo,
        resolved: annotatedRow.resolved,
      }
    }

    return {
      row: index,
      status: "ok",
      reasons: [],
      resolved: annotatedRow.resolved,
    }
  })

  return { data: { linhas: result } }
}

export type ConfirmarLoteErrorCode = "unauthenticated" | "forbidden" | "generic"

export type ConfirmarLoteResult =
  | {
      data: {
        importados: { razaoSocial: string }[]
        puladas: PuladaGroup[]
      }
      error?: undefined
    }
  | { data?: undefined; error: { code: ConfirmarLoteErrorCode } }

/**
 * Write Server Action that confirms the reviewed import batch (Fase 7,
 * D-01/D-02/D-03, IMP-01/IMP-06). Supervisor-gated exactly like
 * validarLoteImportacao (app-layer check is UX-only; the RPC's own
 * `is_supervisor()` raise, 07-01, is the real backstop), re-runs the D-02
 * duplicate revalidation via `planConfirmacao` (reusing findDuplicates —
 * no new dedupe logic), calls `importar_clientes_lote` exactly once with the
 * surviving rows, and reconciles the result into `{ importados, puladas }`
 * for the summary screen (D-01).
 *
 * `linhas` is the same ValidatedRow[] shape validarLoteImportacao returns
 * (untrusted client-sent DATA, never an authorization input — same posture
 * as `linhas` in validarLoteImportacao above); `decisions` is the per-row
 * Importar/Pular choice the Supervisor made on the review table (06-04/
 * 07-03), keyed by row index, default "pular" when absent for a duplicado
 * row.
 *
 * D-03: skipped rows are never written anywhere — `puladas` only exists in
 * this response's return value.
 */
export async function confirmarLoteImportacao(
  linhas: ValidatedRow[],
  decisions: Record<number, "importar" | "pular">
): Promise<ConfirmarLoteResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: { code: "unauthenticated" } }
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const isSupervisor = callerProfile?.role === "supervisor"

  if (!isSupervisor) {
    return { error: { code: "forbidden" } }
  }

  // D-02 revalidation read — the exact narrow, RLS-scoped select
  // validarLoteImportacao uses. For a Supervisor, clientes' RLS SELECT
  // policy returns the whole base, so NEVER add a manual responsavel
  // filter here.
  const existentesResult = await supabase.from("clientes").select("razao_social")

  if (existentesResult.error) {
    return { error: { code: "generic" } }
  }

  const existentesRazaoSocial = (existentesResult.data ?? []).map(
    (row) => row.razao_social as string
  )

  const { rowsToInsert, puladas } = planConfirmacao(
    linhas,
    decisions,
    existentesRazaoSocial
  )

  if (rowsToInsert.length === 0) {
    return { data: { importados: [], puladas } }
  }

  const { data: returnedRows, error: rpcError } = await supabase.rpc(
    "importar_clientes_lote",
    { p_clientes: rowsToInsert }
  )

  if (rpcError) {
    return { error: { code: "generic" } }
  }

  const returnedRazoes = (returnedRows ?? []).map(
    (row: { razao_social: string }) => row.razao_social
  )

  const { importados, puladasExtra } = reconcileImportados(
    rowsToInsert,
    returnedRazoes
  )

  const puladasFinal = mergePuladas(puladas, puladasExtra)

  revalidatePath("/clientes")

  return { data: { importados, puladas: puladasFinal } }
}

/** Merges two PuladaGroup breakdowns, summing quantidade for groups that
 * share the same motivo string (planConfirmacao's D-02 group and
 * reconcileImportados' RPC-race group both use the same reason string,
 * so a batch that hits both must report a single combined count). */
function mergePuladas(a: PuladaGroup[], b: PuladaGroup[]): PuladaGroup[] {
  const merged = new Map<string, number>()

  for (const { motivo, quantidade } of [...a, ...b]) {
    merged.set(motivo, (merged.get(motivo) ?? 0) + quantidade)
  }

  return Array.from(merged.entries()).map(([motivo, quantidade]) => ({
    motivo,
    quantidade,
  }))
}
