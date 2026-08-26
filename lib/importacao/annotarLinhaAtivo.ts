import { cidadeCanonica, cidadeValida } from "@/lib/clientes/cidadeValida"
import { sanitizeCell } from "@/lib/clientes/exportacao"
import { UFS, type Uf } from "@/lib/clientes/ufs"
import { normalizeRazaoSocial } from "@/lib/importacao/dedupe"
import {
  type AnnotarLinhaLookups,
  type MappedRow,
  type ResolvedRow,
  type VendedorLookup,
} from "@/lib/importacao/annotarLinha"
import { SYSTEM_FIELDS_ATIVO } from "@/lib/importacao/typesAtivo"
import type { SystemField } from "@/lib/importacao/types"

/**
 * Pure per-row annotation for the "Importar clientes ativos" import preview
 * (Fase 25 Plano 2, ATIVO-03/ATIVO-04). No Supabase import, no "use server"/
 * "use client" directive — exatamente a disciplina de
 * lib/importacao/annotarLinha.ts: toda lista de consulta (vendedores/
 * categorias/produtos/cidades) chega já estreitada pelo chamador
 * (app/actions/importacaoAtivos.ts), tornando este módulo totalmente
 * testável com listas fabricadas, sem variáveis de ambiente.
 *
 * `MappedRow`, `ResolvedRow`, `VendedorLookup`, `CidadeLookup` e
 * `AnnotarLinhaLookups` são REUSADOS de lib/importacao/annotarLinha.ts, nunca
 * duplicados — a planilha de ativos usa exatamente as mesmas 16 chaves de
 * SystemField e produz exatamente a mesma forma resolvida; declarar cópias
 * criaria duas verdades que só concordariam por convenção.
 *
 * A situação "duplicado" NÃO é decidida aqui — precisa do lote inteiro e é
 * aplicada pela ação de servidor (validarLoteAtivos), exatamente como na
 * importação antiga.
 */

/** Case/acento-insensitive name match — mesma função de
 * lib/importacao/annotarLinha.ts's findByNome. */
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

/** Sanitizes every defined cell value with sanitizeCell (T-25-08) before any
 * resolution/comparison. */
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

/** Distinto do motivo de "não informado" (campo em branco) — um responsável
 * PREENCHIDO que não casa com nenhum vendedor é um problema diferente do
 * campo vazio. Distinguir os dois é uma melhoria deliberada sobre a
 * importação antiga, que confunde os dois numa frase só. */
const RESPONSAVEL_NAO_ENCONTRADO_REASON = (valor: string): string =>
  `Responsável "${valor}" não foi encontrado`

export type AnnotatedRowAtivo = {
  status: "ok" | "erro"
  reasons: string[]
  resolved: ResolvedRow
}

export function annotarLinhaAtivo(
  linha: MappedRow,
  lookups: AnnotarLinhaLookups
): AnnotatedRowAtivo {
  const sanitized = sanitizeRow(linha)
  const reasons: string[] = []

  // 2. Campos obrigatórios (ATIVO-01/ATIVO-03) — percorre SYSTEM_FIELDS_ATIVO
  // filtrando as definições obrigatórias; esta é a ÚNICA fonte de
  // obrigatoriedade e de frase — nenhum esquema de validação paralelo.
  for (const field of SYSTEM_FIELDS_ATIVO) {
    if (!field.required) continue
    const valor = sanitized[field.key]?.trim()
    if (!valor) {
      reasons.push(field.campoFaltandoReason as string)
    }
  }

  // 3. Categoria (opcional): quando preenchida, casar por nome
  // case/acento-insensitive; sem casamento, motivo de erro nomeando o valor
  // lido.
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

  // 4. Produtos consumidos (opcional, multivalor): separar por vírgula/
  // ponto-e-vírgula, aparar, descartar vazios, casar cada pedaço; cada pedaço
  // sem casamento vira um motivo próprio.
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

  // 5. Responsável — quando o valor está em branco, o passo 2 já produziu a
  // frase de campo faltando; NÃO acrescentar nada aqui (evita motivo
  // duplicado). Quando está preenchido, casar primeiro por email e depois
  // por "nome sobrenome" (mesma ordem de findVendedor em annotarLinha.ts);
  // sem casamento, um motivo NOVO e distinto (RESPONSAVEL_NAO_ENCONTRADO).
  let responsavelId: string | null = null
  const responsavelValor = sanitized.responsavel?.trim()
  if (responsavelValor) {
    const match = findVendedor(lookups.vendedores, responsavelValor)
    if (match) {
      responsavelId = match.id
    } else {
      reasons.push(RESPONSAVEL_NAO_ENCONTRADO_REASON(responsavelValor))
    }
  }

  // 6. Estado e cidade: as duas checagens só rodam quando o valor está
  // presente, porque a ausência já foi tratada no passo 2.
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

  // 7. Remove motivos repetidos; situação é "erro" quando sobrou pelo menos
  // um motivo, senão "ok".
  const dedupedReasons = Array.from(new Set(reasons))

  // 8. Forma resolvida — campos de texto aparados e virando nulo quando
  // ficam vazios (texto vazio em estado viola chk_estado_valido e derrubaria
  // a linha); estado normalizado para maiúscula, cidade normalizada para o
  // nome canônico quando casa.
  const cnpjValor = sanitized.cnpj?.trim()
  const nomeFantasiaValor = sanitized.nomeFantasia?.trim()
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

/** Anotação de lote — cada linha é independente (ATIVO-03): uma linha
 * incompleta nunca contamina as outras do mesmo lote. */
export function annotarLoteAtivos(
  linhas: MappedRow[],
  lookups: AnnotarLinhaLookups
): AnnotatedRowAtivo[] {
  return linhas.map((linha) => annotarLinhaAtivo(linha, lookups))
}
