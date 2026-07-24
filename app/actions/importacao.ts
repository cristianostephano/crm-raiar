"use server"

import {
  annotarLinha,
  type AnnotarLinhaLookups,
  type MappedRow,
  type ResolvedRow,
  type VendedorLookup,
} from "@/lib/importacao/annotarLinha"
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
