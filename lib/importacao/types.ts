/**
 * Vocabulário canônico de campos do sistema para a importação de clientes
 * em PROSPECÇÃO (Fase 6). Fonte única reusada por:
 * - `modelo.ts` (esta plan) — colunas do modelo de planilha (IMP-02);
 * - `annotarLinha` (06-02) — validação de cada linha da planilha;
 * - `ColumnMappingTable`/mapeamento (06-04) — opções do Select por coluna.
 *
 * Fase 26 Plano 2 (PROSP-02): a planilha de prospecção existe para importar
 * empresas ANTES do primeiro contato, quando a razão social quase nunca é
 * conhecida ainda — só o nome popular ("Nome Fantasia") e quem vai trabalhar
 * o cliente. Por isso `required: true` passou de `razaoSocial` para
 * `nomeFantasia`; `responsavel` continua obrigatório (sem ele a linha não
 * pode nem ser atribuída a um vendedor). `razaoSocial` diverge aqui do
 * cadastro manual (`createClienteSchema`, tela "Novo cliente", que continua
 * exigindo razão social) de propósito — a importação em massa aceita o dado
 * mínimo que existe na fase de prospecção, apoiada na coluna `razao_social`
 * já nulável desde a migration 0024 (Fase 23). Os 5 campos de endereço
 * seguem opcionais desde a quick task 260819-m8q. Todo cliente importado
 * sempre nasce em "Aguardando contato", então a etapa do funil NUNCA aparece
 * neste vocabulário (PROSP-03).
 *
 * 16 campos desde a Fase 19 (IMP-01/IMP-02): `cnpj` e `nomeFantasia` foram
 * acrescentados, os dois opcionais, logo depois de `razaoSocial` — mapeiam
 * colunas que já existem em `clientes` (nullable) desde a migration 0013 da
 * Fase 13.
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
 * inseridos logo após `razaoSocial`, Fase 19). `required: true` apenas em
 * `nomeFantasia` e `responsavel` desde a Fase 26 Plano 2 (PROSP-02) —
 * `razaoSocial` virou opcional no mesmo passo; os 5 campos de endereço já
 * eram opcionais desde a quick task 260819-m8q; `multi: true` apenas em
 * produtos (multi-valor, D-01 do domínio do CRM).
 */
export const SYSTEM_FIELDS: SystemFieldDefinition[] = [
  { key: "razaoSocial", label: "Razão social", required: false },
  { key: "cnpj", label: "CNPJ", required: false },
  { key: "nomeFantasia", label: "Nome Fantasia", required: true },
  { key: "cep", label: "CEP", required: false },
  { key: "rua", label: "Rua", required: false },
  { key: "numero", label: "Número", required: false },
  { key: "complemento", label: "Complemento", required: false },
  { key: "cidade", label: "Cidade", required: false },
  { key: "estado", label: "Estado", required: false },
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
