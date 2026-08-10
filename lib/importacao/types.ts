/**
 * Vocabulário canônico de campos do sistema para a importação de clientes
 * (Fase 6). Fonte única reusada por:
 * - `modelo.ts` (esta plan) — colunas do modelo de planilha (IMP-02);
 * - `annotarLinha` (06-02) — validação de cada linha da planilha;
 * - `ColumnMappingTable`/mapeamento (06-04) — opções do Select por coluna.
 *
 * `required` segue as mesmas regras mínimas de `lib/validations/cliente.ts`
 * (`createClienteSchema`): razaoSocial, cep, rua, numero, cidade, estado,
 * responsavel. Todo cliente importado sempre nasce em "Aguardando contato",
 * então a etapa do funil NUNCA aparece neste vocabulário.
 */

export type SystemField =
  | "razaoSocial"
  | "cep"
  | "rua"
  | "numero"
  | "complemento"
  | "cidade"
  | "estado"
  | "categoria"
  | "contato"
  | "telefone"
  | "email"
  | "produtos"
  | "responsavel"
  | "numeroDeLojas"

/**
 * Parametrizada pela chave (`K`), com valor padrão igual à união de 14
 * chaves de sempre — toda menção existente sem parâmetro genérico continua
 * significando exatamente o que significava antes desta generalização. O
 * parâmetro existe só para permitir uma segunda lista de campos
 * (lib/importacao/typesFrequencia.ts, Fase 17) sem duplicar esta interface.
 */
export interface SystemFieldDefinition<K extends string = SystemField> {
  key: K
  label: string
  required: boolean
  multi?: boolean
}

/**
 * Ordem e labels seguem 06-UI-SPEC.md linha 165. `required: true` apenas nos
 * 7 campos mínimos (mesma regra de createClienteSchema); `multi: true`
 * apenas em produtos (multi-valor, D-01 do domínio do CRM).
 */
export const SYSTEM_FIELDS: SystemFieldDefinition[] = [
  { key: "razaoSocial", label: "Razão social", required: true },
  { key: "cep", label: "CEP", required: true },
  { key: "rua", label: "Rua", required: true },
  { key: "numero", label: "Número", required: true },
  { key: "complemento", label: "Complemento", required: false },
  { key: "cidade", label: "Cidade", required: true },
  { key: "estado", label: "Estado", required: true },
  { key: "categoria", label: "Categoria", required: false },
  { key: "contato", label: "Contato", required: false },
  { key: "telefone", label: "Telefone", required: false },
  { key: "email", label: "Email", required: false },
  { key: "produtos", label: "Produtos consumidos", required: false, multi: true },
  { key: "responsavel", label: "Responsável (vendedor)", required: true },
  { key: "numeroDeLojas", label: "Número de lojas", required: false },
]

/** Resultado bruto de ler um .xlsx/.csv: cabeçalho + linhas de dados, todas as células já coagidas a string. */
export interface ParsedFile {
  headers: string[]
  rows: string[][]
}

/** Resultado da checagem de upload (extensão + tamanho) antes de qualquer parsing. */
export type UploadValidation = { ok: true } | { ok: false; motivo: "tipo" | "tamanho" }
