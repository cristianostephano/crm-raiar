import { SYSTEM_FIELDS, type SystemField, type SystemFieldDefinition } from "@/lib/importacao/types"

/**
 * Pure column-mapping logic for the import wizard's Step 2 (IMP-03/IMP-04).
 * No "use client"/"use server" directive, no Supabase import — unit-testable
 * in isolation, mirroring lib/importacao/dedupe.ts's shape (06-PATTERNS.md).
 *
 * Fase 17 (D4): as três funções exportadas abaixo foram generalizadas para
 * servir QUALQUER lista de campos (parâmetro genérico `K`, valor padrão
 * igual à união de 14 chaves de SYSTEM_FIELDS) — sem essa generalização, a
 * segunda lista de campos da importação de frequências
 * (lib/importacao/typesFrequencia.ts) precisaria duplicar toda esta tabela
 * de mapeamento, que é exatamente o que a decisão D4 proíbe. Toda chamada
 * existente sem o segundo parâmetro continua se comportando exatamente como
 * antes — os testes de tests/importacao/mapping.test.ts (intocados) são a
 * prova mecânica disso.
 */

/** Sentinel mapping target meaning "this column should not be imported" —
 * always the last option in ColumnMappingTable's per-column Select. */
export const NAO_IMPORTAR = "nao_importar" as const

/** Versões parametrizadas dos dois tipos de mapeamento (Fase 17, D4). */
export type MappingTargetOf<K extends string = SystemField> = K | typeof NAO_IMPORTAR

/** Keyed by column INDEX (not header text) — spreadsheet headers can repeat
 * or be blank, so the index is the only unambiguous column identity. */
export type ColumnMappingOf<K extends string = SystemField> = Record<number, MappingTargetOf<K>>

/** Apelidos retrocompatíveis — todo consumidor existente que usa estes dois
 * nomes continua significando exatamente a mesma coisa que significava antes
 * da generalização (Fase 17, D4). */
export type MappingTarget = MappingTargetOf<SystemField>
export type ColumnMapping = ColumnMappingOf<SystemField>

/** Strips diacritics (NFD + explicit combining-mark code-point filter, same
 * approach as dedupe.ts's normalizeRazaoSocial — avoids embedding a literal
 * combining character in a regex literal), lowercases, and drops every
 * non-alphanumeric character so "Razão Social", "razao_social" and
 * "RAZAO-SOCIAL" all normalize identically. */
function normalizeHeader(value: string): string {
  const stripped = Array.from(value.normalize("NFD"))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return !(code >= 0x0300 && code <= 0x036f)
    })
    .join("")

  return stripped.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** Extra normalized aliases beyond each SYSTEM_FIELDS label itself — covers
 * the common spreadsheet header variations this phase must recognize,
 * notably "vendedor" for responsavel (IMP-04). Fixado na união de 16 chaves
 * (SystemField) — suggestMapping abaixo confere se o resultado pertence à
 * lista de campos efetivamente recebida antes de devolvê-lo (Fase 17, D4).
 *
 * Fase 19 (IMP-01/IMP-02): "CNPJ"/"cnpj"/"C.N.P.J."/"Cnpj" e "Nome
 * Fantasia"/"nome_fantasia"/"NOME FANTASIA" já normalizam para o mesmo texto
 * do respectivo label de SYSTEM_FIELDS ("cnpj"/"nomefantasia") — o match por
 * label acima já resolve essas variações, sem entrada redundante aqui. Só
 * "fantasia" sozinho não bate com o label completo, daí a única entrada
 * nova abaixo. */
const ALIASES: Record<string, SystemField> = {
  razaosocial: "razaoSocial",
  empresa: "razaoSocial",
  nomeempresa: "razaoSocial",
  fantasia: "nomeFantasia",
  cep: "cep",
  rua: "rua",
  logradouro: "rua",
  endereco: "rua",
  numero: "numero",
  nro: "numero",
  complemento: "complemento",
  cidade: "cidade",
  municipio: "cidade",
  estado: "estado",
  uf: "estado",
  categoria: "categoria",
  contato: "contato",
  nomecontato: "contato",
  telefone: "telefone",
  celular: "telefone",
  fone: "telefone",
  email: "email",
  produtos: "produtos",
  produtosconsumidos: "produtos",
  produto: "produtos",
  responsavel: "responsavel",
  vendedor: "responsavel",
  responsavelvendedor: "responsavel",
  numerodelojas: "numeroDeLojas",
  lojas: "numeroDeLojas",
  qtddelojas: "numeroDeLojas",
}

/**
 * Best-guess mapping target for one raw spreadsheet header. Matches first
 * against each `fields` label (normalized), then against the ALIASES table;
 * a header with no good match suggests NAO_IMPORTAR rather than guessing
 * wrong.
 *
 * Fase 17 (D4) conserto obrigatório: um apelido só é aplicado se a chave que
 * ele aponta PERTENCER à lista de campos recebida. Sem essa conferência, uma
 * planilha de frequências com um cabeçalho "CEP" devolveria a chave "cep",
 * que não existe naquela lista, e o Select da tela receberia um valor fora
 * das suas próprias opções. Para a lista de 14 (SYSTEM_FIELDS) essa
 * conferência nunca dispara — todo apelido aponta para um campo dela — então
 * o comportamento de sempre é preservado por construção.
 */
export function suggestMapping<K extends string = SystemField>(
  header: string,
  // O cast abaixo é necessário porque o compilador não consegue provar, na
  // posição de valor padrão de um parâmetro genérico, que SYSTEM_FIELDS
  // (tipado pela união de 14 chaves) é o próprio valor padrão de K — nunca o
  // tipo curinga proibido pelo CLAUDE.md.
  fields: SystemFieldDefinition<K>[] = SYSTEM_FIELDS as unknown as SystemFieldDefinition<K>[]
): MappingTargetOf<K> {
  const normalized = normalizeHeader(header)

  const byLabel = fields.find(
    (field) => normalizeHeader(field.label) === normalized
  )
  if (byLabel) return byLabel.key

  const alias = ALIASES[normalized]
  if (alias && fields.some((field) => (field.key as string) === alias)) {
    // O pertencimento já foi conferido acima — o cast duplo é necessário
    // porque ALIASES está fixada em SystemField, não em K.
    return alias as unknown as MappingTargetOf<K>
  }

  return NAO_IMPORTAR
}

/**
 * Transforms parsed spreadsheet rows (string[][]) into mapped row objects
 * using the Supervisor's column mapping — columns marked NAO_IMPORTAR are
 * dropped. `produtos` (multi-value) is preserved as a single raw string per
 * cell; splitting into individual product tokens happens later in
 * annotarLinha (06-02), not here.
 */
export function applyMapping<K extends string = SystemField>(
  headers: string[],
  rows: string[][],
  mapping: ColumnMappingOf<K>
): Partial<Record<K, string>>[] {
  return rows.map((row) => {
    const mappedRow: Partial<Record<K, string>> = {}

    headers.forEach((_header, columnIndex) => {
      const target = mapping[columnIndex]
      if (!target || target === NAO_IMPORTAR) return

      const value = row[columnIndex]
      if (value === undefined) return

      mappedRow[target as K] = value
    })

    return mappedRow
  })
}

/**
 * Required `fields` (e.g. Responsável) not yet associated with any column in
 * the current mapping — drives Step 2's inline warning and the "Continuar"
 * disabled state.
 */
export function requiredFieldsFaltando<K extends string = SystemField>(
  mapping: ColumnMappingOf<K>,
  // Mesma justificativa de cast do valor padrão de suggestMapping acima.
  fields: SystemFieldDefinition<K>[] = SYSTEM_FIELDS as unknown as SystemFieldDefinition<K>[]
): SystemFieldDefinition<K>[] {
  const mappedFields = new Set(
    Object.values(mapping).filter(
      (target): target is K => target !== NAO_IMPORTAR
    )
  )

  return fields.filter(
    (field) => field.required && !mappedFields.has(field.key)
  )
}
