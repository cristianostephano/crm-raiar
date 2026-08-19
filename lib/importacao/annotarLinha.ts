import { cidadeCanonica, cidadeValida } from "@/lib/clientes/cidadeValida"
import { sanitizeCell } from "@/lib/clientes/exportacao"
import { UFS, type Uf } from "@/lib/clientes/ufs"
import { normalizeRazaoSocial } from "@/lib/importacao/dedupe"
import type { LookupOption } from "@/lib/supabase/queries/clientes"
import { createImportRowSchema } from "@/lib/validations/importacao"
import type { SystemField } from "@/lib/importacao/types"

/**
 * Pure per-row annotation for the import preview (Fase 6, IMP-04/IMP-05/
 * D-02). No Supabase import, no "use server"/"use client" directive — every
 * lookup list (vendedores/categorias/produtos) is passed in already
 * RLS-scoped by the caller (app/actions/importacao.ts), so this function is
 * fully unit-testable with fabricated lookup lists (tests/importacao/
 * annotarLinha.test.ts), no .env.local needed.
 *
 * status here is only "ok" | "erro" — "duplicado" is applied afterwards by
 * validarLoteImportacao via lib/importacao/dedupe.ts's findDuplicates, since
 * duplicate detection needs the whole batch at once, not one row at a time.
 */

/** One mapped spreadsheet row — every SystemField the user's column mapping
 * (06-04) resolved to a value, already coerced to string by parseArquivo. */
export type MappedRow = Partial<Record<SystemField, string>>

/** Vendedor lookup shape — enough to match by email or by "nome sobrenome". */
export type VendedorLookup = {
  id: string
  nome: string
  sobrenome: string
  email: string
}

/** Cidade lookup shape (nome + uf) — populada uma vez por batch pelo
 * chamador (app/actions/importacao.ts's validarLoteImportacao), a partir de
 * um narrow `select nome, uf from cidades` (09-06, LOC-01/LOC-02). */
export type CidadeLookup = { nome: string; uf: string }

export type AnnotarLinhaLookups = {
  vendedores: VendedorLookup[]
  categorias: LookupOption[]
  produtos: LookupOption[]
  cidades: CidadeLookup[]
}

/** Resolved + sanitized row shape, ready for Fase 7 to insert — never
 * written to the database by this phase (read-only preview). */
export type ResolvedRow = {
  razaoSocial: string
  cnpj: string | null
  nomeFantasia: string | null
  cep: string | null
  rua: string | null
  numero: string | null
  complemento: string | null
  cidade: string | null
  estado: string | null
  categoriaId: string | null
  contato: string | null
  telefone: string | null
  email: string | null
  produtoIds: string[]
  responsavelId: string | null
  numeroDeLojas: string | null
}

export type AnnotatedRow = {
  status: "ok" | "erro"
  reasons: string[]
  resolved: ResolvedRow
}

const RESPONSAVEL_REASON = "Responsável não informado"
const RAZAO_SOCIAL_REASON = "Razão social não informada"

/** Case/acento-insensitive name match — reuses dedupe's normalization
 * (sanctioned by the plan: "pode reaproveitar de dedupe ou uma comparação
 * case-insensitive simples") for categoria/produto/vendedor name lookups. */
function findByNome<T extends { nome: string }>(
  options: T[],
  valor: string
): T | undefined {
  const key = normalizeRazaoSocial(valor)
  return options.find((option) => normalizeRazaoSocial(option.nome) === key)
}

function findVendedor(
  vendedores: VendedorLookup[],
  valor: string
): VendedorLookup | undefined {
  const normalizedValor = valor.trim().toLowerCase()

  const byEmail = vendedores.find(
    (v) => v.email.trim().toLowerCase() === normalizedValor
  )
  if (byEmail) return byEmail

  return vendedores.find(
    (v) =>
      normalizeRazaoSocial(`${v.nome} ${v.sobrenome}`) ===
      normalizeRazaoSocial(valor)
  )
}

/** Sanitizes every defined cell value with sanitizeCell (A4 — closes the
 * CSV/formula-injection hole on the import side too, mirroring the export
 * guard in lib/clientes/exportacao.ts) before any resolution/validation. */
function sanitizeRow(linha: MappedRow): MappedRow {
  const sanitized: MappedRow = {}
  for (const [key, value] of Object.entries(linha)) {
    if (value === undefined) continue
    sanitized[key as SystemField] = sanitizeCell(value)
  }
  return sanitized
}

/** Splits a multi-value produtos cell (comma or semicolon separated) into
 * trimmed, non-empty tokens. */
function splitProdutos(valor: string): string[] {
  return valor
    .split(/[,;]/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

export function annotarLinha(
  linha: MappedRow,
  lookups: AnnotarLinhaLookups
): AnnotatedRow {
  const sanitized = sanitizeRow(linha)
  const reasons: string[] = []

  // 2. Categoria (optional field — no reason if simply absent).
  let categoriaId: string | null = null
  const categoriaValor = sanitized.categoria?.trim()
  if (categoriaValor) {
    const match = findByNome(lookups.categorias, categoriaValor)
    if (match) {
      categoriaId = match.id
    } else {
      reasons.push(`Categoria "${categoriaValor}" não existe`)
    }
  }

  // 3. Produtos (multi-value, optional field).
  const produtoIds: string[] = []
  const produtosValor = sanitized.produtos?.trim()
  if (produtosValor) {
    for (const token of splitProdutos(produtosValor)) {
      const match = findByNome(lookups.produtos, token)
      if (match) {
        produtoIds.push(match.id)
      } else {
        reasons.push(`Produto "${token}" não existe`)
      }
    }
  }

  // 4. Responsável (vendedor) — an empty value is caught by the required-
  // field check below (step 5), so only a NON-empty-but-unmatched value adds
  // a reason here, avoiding a duplicate "Responsável não informado" entry.
  let responsavelId: string | null = null
  const responsavelValor = sanitized.responsavel?.trim()
  if (responsavelValor) {
    const match = findVendedor(lookups.vendedores, responsavelValor)
    if (match) {
      responsavelId = match.id
    } else {
      reasons.push(RESPONSAVEL_REASON)
    }
  }

  // 4b. Estado (UFS) + Cidade (tabela cidades) — LOC-01/LOC-02. Estado é
  // reusado da mesma lista fixa dos formulários/filtro (UFS); Cidade é
  // checada contra a mesma tabela cidades (lookups.cidades), nunca uma
  // lógica paralela de texto livre. Ambas as checagens são aditivas ao
  // required-field check do passo 5 (só rodam quando o valor está presente).
  const estadoValor = sanitized.estado?.trim().toUpperCase()
  if (estadoValor && !UFS.includes(estadoValor as Uf)) {
    reasons.push(`Estado "${estadoValor}" não é uma sigla de UF válida`)
  }

  const cidadeValor = sanitized.cidade?.trim()
  if (
    cidadeValor &&
    estadoValor &&
    UFS.includes(estadoValor as Uf) &&
    !cidadeValida(cidadeValor, estadoValor, lookups.cidades)
  ) {
    reasons.push(`Cidade "${cidadeValor}" não encontrada para o estado ${estadoValor}`)
  }

  // 5. Required fields (razaoSocial, responsavel) — quick task 260819-m8q
  // (D-01): os 5 campos de endereço deixaram de ser obrigatórios aqui, ao
  // contrário de createClienteSchema (cadastro manual, que continua exigindo
  // os 5). O branch abaixo só existe para razaoSocial/responsavel agora.
  const parsed = createImportRowSchema.safeParse({
    razaoSocial: sanitized.razaoSocial ?? "",
    cep: sanitized.cep ?? "",
    rua: sanitized.rua ?? "",
    numero: sanitized.numero ?? "",
    cidade: sanitized.cidade ?? "",
    estado: sanitized.estado ?? "",
    responsavel: sanitized.responsavel ?? "",
    complemento: sanitized.complemento,
    contato: sanitized.contato,
    telefone: sanitized.telefone,
    email: sanitized.email,
    numeroDeLojas: sanitized.numeroDeLojas,
  })

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]
      if (field === "razaoSocial") {
        reasons.push(RAZAO_SOCIAL_REASON)
      } else if (field === "responsavel") {
        reasons.push(RESPONSAVEL_REASON)
      }
    }
  }

  const dedupedReasons = Array.from(new Set(reasons))

  // 6. CNPJ / Nome Fantasia (IMP-01/IMP-02) — puramente carregados a partir
  // da célula já saneada por sanitizeRow acima; sem checagem de formato, sem
  // motivo de erro, aparados e convertidos para nulo quando ficam vazios
  // (célula ausente ou só espaço em branco).
  const cnpjValor = sanitized.cnpj?.trim()
  const nomeFantasiaValor = sanitized.nomeFantasia?.trim()

  // Quick task 260819-m8q (D-01/D-04): os 5 campos de endereço aparam
  // espaços e viram valor NULO quando ficam vazios — nunca texto vazio.
  // Texto vazio em `estado` viola `chk_estado_valido` (migration 0007) e
  // derrubaria a linha inteira no insert; nulo já é aceito pela constraint
  // sem alteração nela. Mesma forma já usada acima para cnpj/nomeFantasia.
  const cepValor = sanitized.cep?.trim()
  const ruaValor = sanitized.rua?.trim()
  const numeroValor = sanitized.numero?.trim()

  const resolved: ResolvedRow = {
    razaoSocial: sanitized.razaoSocial ?? "",
    cnpj: cnpjValor ? cnpjValor : null,
    nomeFantasia: nomeFantasiaValor ? nomeFantasiaValor : null,
    cep: cepValor ? cepValor : null,
    rua: ruaValor ? ruaValor : null,
    numero: numeroValor ? numeroValor : null,
    complemento: sanitized.complemento ?? null,
    // LOC-01/LOC-02: normaliza estado para a UF em maiúscula (senão a
    // constraint chk_estado_valido da Fase 7 barra o insert) e cidade para o
    // nome canônico do IBGE quando casa; senão cai para o valor saneado
    // aparado (a linha já está marcada "erro" pelas reasons acima), e para
    // valor nulo quando esse valor fica vazio.
    cidade:
      cidadeCanonica(cidadeValor ?? "", estadoValor ?? "", lookups.cidades) ??
      (cidadeValor ? cidadeValor : null),
    estado:
      estadoValor && UFS.includes(estadoValor as Uf)
        ? estadoValor
        : (estadoValor ? estadoValor : null),
    categoriaId,
    contato: sanitized.contato ?? null,
    telefone: sanitized.telefone ?? null,
    email: sanitized.email ?? null,
    produtoIds,
    responsavelId,
    numeroDeLojas: sanitized.numeroDeLojas ?? null,
  }

  return {
    status: dedupedReasons.length > 0 ? "erro" : "ok",
    reasons: dedupedReasons,
    resolved,
  }
}
