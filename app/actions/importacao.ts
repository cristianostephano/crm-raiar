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
import { nomesExistentesParaDedupe } from "@/lib/importacao/existentes"
import {
  produtosPendentesDaCarga,
  resolverProdutosPendentes,
} from "@/lib/importacao/produtosPendentes"
import { createClient } from "@/lib/supabase/server"
import { getCategoriasAtivas, getProdutosAtivos } from "@/lib/supabase/queries/clientes"
import { getTodasCidades } from "@/lib/supabase/queries/cidades"

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
  const [categorias, produtos, vendedoresResult, existentesResult, cidades] =
    await Promise.all([
      getCategoriasAtivas(),
      getProdutosAtivos(),
      supabase.from("profiles").select("id, nome, sobrenome, email"),
      // Narrow, RLS-scoped duplicate-check read (reuses the pattern of
      // getClientesParaExportacao): for a Supervisor, clientes' RLS SELECT
      // policy returns the whole base — exactly the set dedup must compare
      // against. NEVER add a manual responsavel filter here. Traz também
      // nome_fantasia (Fase 26 Plano 3, PROSP-02): a chave de reserva do
      // fluxo de prospecção precisa comparar Nome Fantasia contra Nome
      // Fantasia já cadastrado, não só razão social contra razão social.
      supabase.from("clientes").select("razao_social, nome_fantasia"),
      // Lista completa de cidades (LOC-01/LOC-02), paginada por
      // getTodasCidades (lib/supabase/queries/cidades.ts) — a tabela tem
      // 5571 linhas e o PostgREST devolve no máximo 1000 por requisição sem
      // paginação explícita, então um select direto aqui truncava a lista e
      // fazia a validação rejeitar cidade real. A postura de RLS não muda: a
      // policy de SELECT é aberta a qualquer usuário autenticado (dado
      // público do IBGE), nada a escopar aqui. Uma falha de leitura vira
      // erro do lote inteiro de propósito — validar contra uma lista
      // parcial reprovaria cidade correta.
      getTodasCidades(),
    ])

  if (vendedoresResult.error || existentesResult.error || cidades === null) {
    return { error: { code: "generic" } }
  }

  const vendedores: VendedorLookup[] = (vendedoresResult.data ?? []).map((row) => ({
    id: row.id as string,
    nome: row.nome as string,
    sobrenome: row.sobrenome as string,
    email: row.email as string,
  }))

  const lookups: AnnotarLinhaLookups = { vendedores, categorias, produtos, cidades }

  // Fase 26 Plano 3 (T-26-08): substitui a conversão de tipo não checada
  // sobre razão social pelo módulo tolerante a nulo — um cliente do banco
  // com razão social nula não pode mais derrubar a validação do lote
  // inteiro.
  const { razoesSociais: existentes, nomesFantasia: existentesNomesFantasia } =
    nomesExistentesParaDedupe(existentesResult.data ?? [])

  const annotated = linhas.map((linha) => annotarLinha(linha, lookups))

  // Fase 26 Plano 3 (PROSP-02): leva também o Nome Fantasia de cada linha
  // anotada, ao lado da razão social — sem isso, duas linhas sem razão
  // social nunca seriam comparadas contra os Nomes Fantasia já cadastrados.
  const batchForDedupe = annotated.map((annotatedRow, index) => ({
    row: index,
    razaoSocial: annotatedRow.resolved.razaoSocial,
    nomeFantasia: annotatedRow.resolved.nomeFantasia,
  }))

  const duplicates = findDuplicates(batchForDedupe, existentes, existentesNomesFantasia)

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

/** Motivo em português para a linha pulada quando os produtos consumidos de
 * uma linha gravada sem razão social não puderam ser vinculados
 * automaticamente (Fase 26 Plano 3, T-26-09) — cobre tanto a ambiguidade/
 * ausência de correspondência (resolverProdutosPendentes) quanto uma falha
 * na gravação complementar em si; nos dois casos, o cliente FOI importado,
 * só os produtos ficaram de fora e precisam ser preenchidos manualmente.
 *
 * NÃO exportar esta constante: um arquivo com a diretiva "use server" só
 * pode exportar funções assíncronas (Server Actions) — um export de valor
 * comum quebra o build inteiro do módulo (achado nesta própria task, Rule 1). */
const PRODUTOS_NAO_VINCULADOS_REASON =
  "Produtos consumidos não puderam ser vinculados automaticamente — preencha na ficha do cliente"

export type ConfirmarLoteErrorCode = "unauthenticated" | "forbidden" | "generic"

export type ConfirmarLoteResult =
  | {
      data: {
        // Fase 26 Plano 2 (Bug A): razaoSocial acompanha a nulabilidade de
        // ResolvedRow/RpcClienteRow — uma linha importada sem razão social
        // (prospecção) chega aqui com valor nulo, nunca texto vazio.
        importados: { razaoSocial: string | null }[]
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
  // filter here. Traz também nome_fantasia (Fase 26 Plano 3), mesma razão
  // da leitura de validarLoteImportacao acima.
  const existentesResult = await supabase
    .from("clientes")
    .select("razao_social, nome_fantasia")

  if (existentesResult.error) {
    return { error: { code: "generic" } }
  }

  // Fase 26 Plano 3 (T-26-08): mesma substituição da conversão de tipo não
  // checada usada em validarLoteImportacao.
  const {
    razoesSociais: existentesRazaoSocial,
    nomesFantasia: existentesNomesFantasia,
  } = nomesExistentesParaDedupe(existentesResult.data ?? [])

  const { rowsToInsert, puladas } = planConfirmacao(
    linhas,
    decisions,
    existentesRazaoSocial,
    existentesNomesFantasia
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

  // A RPC devolve razao_social + id + status por linha gravada (assinatura
  // em supabase/migrations/0019_...sql) — id é usado abaixo (Task 2, T-26-09)
  // para restringir a leitura complementar de produtos pendentes.
  const returnedRowsTyped = (returnedRows ?? []) as {
    razao_social: string | null
    id: string
    status: string
  }[]

  const returnedRazoes = returnedRowsTyped.map((row) => row.razao_social)

  const { importados, puladasExtra } = reconcileImportados(
    rowsToInsert,
    returnedRazoes
  )

  let puladasFinal = mergePuladas(puladas, puladasExtra)

  // Fase 26 Plano 3 (Task 2, T-26-09): completa os produtos consumidos das
  // linhas gravadas sem razão social — ver o cabeçalho de
  // lib/importacao/produtosPendentes.ts para o porquê. Sem nenhuma linha
  // pendente, este bloco não faz NENHUMA leitura ou escrita extra (o
  // caminho de hoje continua com custo idêntico).
  const pendencias = produtosPendentesDaCarga(rowsToInsert)

  if (pendencias.length > 0) {
    // Leitura estreita, restrita aos identificadores devolvidos pela função
    // de gravação e às linhas de razão social nula — nunca a base inteira.
    const idsGravadosSemRazaoSocial = returnedRowsTyped
      .filter((row) => row.razao_social === null)
      .map((row) => row.id)

    const clientesResult =
      idsGravadosSemRazaoSocial.length > 0
        ? await supabase
            .from("clientes")
            .select("id, nome_fantasia")
            .in("id", idsGravadosSemRazaoSocial)
            .is("razao_social", null)
        : { data: [], error: null }

    if (clientesResult.error) {
      // A falha nesta leitura complementar NÃO desfaz nem invalida a
      // importação já concluída — vira linha pulada com motivo próprio.
      puladasFinal = mergePuladas(puladasFinal, [
        { motivo: PRODUTOS_NAO_VINCULADOS_REASON, quantidade: pendencias.length },
      ])
    } else {
      const clientesRecemGravados = (clientesResult.data ?? [])
        .map((row) => ({
          id: row.id as string,
          nomeFantasia: (row.nome_fantasia as string | null)?.trim() ?? "",
        }))
        .filter((cliente) => cliente.nomeFantasia.length > 0)

      const { vinculos, naoResolvidas } = resolverProdutosPendentes(
        pendencias,
        clientesRecemGravados
      )

      let falhaNaGravacaoCount = 0

      if (vinculos.length > 0) {
        const { error: vinculoError } = await supabase
          .from("cliente_produtos")
          .upsert(
            vinculos.map((vinculo) => ({
              cliente_id: vinculo.clienteId,
              produto_id: vinculo.produtoId,
            })),
            // Chave primária da tabela é o par cliente/produto (migration
            // 0002) — ignora conflito para que uma reexecução nunca falhe.
            { onConflict: "cliente_id,produto_id", ignoreDuplicates: true }
          )

        if (vinculoError) {
          falhaNaGravacaoCount = pendencias.length - naoResolvidas.length
        }
      }

      const problemCount = naoResolvidas.length + falhaNaGravacaoCount
      if (problemCount > 0) {
        puladasFinal = mergePuladas(puladasFinal, [
          { motivo: PRODUTOS_NAO_VINCULADOS_REASON, quantidade: problemCount },
        ])
      }
    }
  }

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
