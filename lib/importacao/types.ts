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
 *
 * 16 campos desde a Fase 19 (IMP-01/IMP-02): `cnpj` e `nomeFantasia` foram
 * acrescentados, os dois opcionais, logo depois de `razaoSocial` — mapeiam
 * colunas que já existem em `clientes` (nullable) desde a migration 0013 da
 * Fase 13. Nenhum dos dois é obrigatório: o conjunto de 7 campos mínimos
 * continua exatamente o mesmo de antes.
 */

export type SystemField =
  | "razaoSocial"
  | "cnpj"
  | "nomeFantasia"
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
 * Parametrizada pela chave (`K`), com valor padrão igual à união de 16
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
 * Ordem e labels seguem 06-UI-SPEC.md linha 165 (com `cnpj`/`nomeFantasia`
 * inseridos logo após `razaoSocial`, Fase 19). `required: true` apenas nos
 * 7 campos mínimos (mesma regra de createClienteSchema); `multi: true`
 * apenas em produtos (multi-valor, D-01 do domínio do CRM).
 */
export const SYSTEM_FIELDS: SystemFieldDefinition[] = [
  { key: "razaoSocial", label: "Razão social", required: true },
  { key: "cnpj", label: "CNPJ", required: false },
  { key: "nomeFantasia", label: "Nome Fantasia", required: false },
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
