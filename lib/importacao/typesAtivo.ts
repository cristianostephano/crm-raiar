import type { SystemField, SystemFieldDefinition } from "@/lib/importacao/types"

/**
 * Vocabulário de campos da planilha "Importar clientes ativos" (Fase 25
 * Plano 2, ATIVO-01/ATIVO-03). QUARTO vocabulário de campos do sistema —
 * irmão de `lib/importacao/types.ts` (16 campos, importação de clientes
 * novos), `lib/importacao/typesFrequencia.ts` e `lib/importacao/
 * typesCnpj.ts`. Reusa a MESMA interface parametrizada de definição de campo
 * (`SystemFieldDefinition<K>`) e a mesma camada genérica de mapeamento
 * (`lib/importacao/mapping.ts`) — nenhuma função nova é criada por este
 * vocabulário, só uma quarta lista declarada, estendendo a definição de
 * campo com uma frase de "campo faltando" própria de cada obrigatório
 * (`SystemFieldDefinitionAtivo`), o que mantém compatibilidade total com
 * `suggestMapping`/`applyMapping`/`requiredFieldsFaltando`/
 * `ColumnMappingTable` (parametrizados desde a Fase 17).
 *
 * `SYSTEM_FIELDS_ATIVO` tem as MESMAS 16 chaves e os MESMOS rótulos e a
 * MESMA ordem de `SYSTEM_FIELDS` — a planilha de ativos pede os mesmos
 * campos de cliente, o que muda é quais deles são exigidos. `SYSTEM_FIELDS`
 * NÃO é tocada por este arquivo (naoregride).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * JUSTIFICATIVA DE CADA FRONTEIRA DE OBRIGATORIEDADE (conferida pelo dono do
 * projeto no checkpoint humano do plano 25-03 — não remover este comentário
 * ao alterar a lista):
 *
 * - Os 9 obrigatórios desta lista (razaoSocial, cnpj, cep, rua, numero,
 *   cidade, estado, responsavel, contato) são, JUNTOS, EXATAMENTE a
 *   condição que `cliente_ativo_pronto_para_ganho` (RPC do plano 25-01,
 *   migration 0027) exige para gravar — mesma lista, mesma cardinalidade,
 *   sem subconjunto nem superconjunto. Uma linha sem qualquer um deles é
 *   recusada pelo banco de qualquer jeito; exigir na tela só antecipa a
 *   recusa com uma explicação melhor.
 * - Razão social, CNPJ e os 5 campos de endereço: cópia dos guards de ganho
 *   das migrations 0018/0025.
 * - Responsável: a coluna é obrigatória (`not null`) no esquema da tabela
 *   desde a migration 0002; sem ela a linha não pode nem ser criada. Por ser
 *   `not null`, uma linha sem responsável que chegasse ao banco abortaria o
 *   LOTE INTEIRO por violação de restrição, não só a própria linha — por
 *   isso ela também entra no filtro da RPC do 25-01, e não fica só nesta
 *   lista.
 * - Contato: nomeado literalmente no requisito ATIVO-01. É anulável na
 *   tabela, então o banco NÃO a recusaria sozinho — sem a exigência aqui e
 *   no filtro da RPC, a linha entraria calada com contato nulo, sem erro e
 *   sem sinal na tela.
 * - Frequência de visita e dia fixo NÃO aparecem neste vocabulário, por
 *   decisão travada — são definidos depois, individualmente, pela ficha/
 *   Agenda da Fase 24. Um cliente importado por aqui nasce sem frequência e
 *   por isso aparece na seção "Sem dia fixo definido" da Agenda; isso é o
 *   comportamento esperado, não uma pendência.
 * - Esta lista é a AUTORIDADE ÚNICA de obrigatoriedade deste fluxo: não
 *   existe um esquema de validação paralelo mantido à mão. Isso fecha um
 *   risco registrado na STATE.md (duas fontes de obrigatoriedade
 *   concordando só por convenção entre os dois assistentes de importação).
 * - Trocar um campo de obrigatório para opcional (ou o contrário) é uma
 *   mudança de UMA linha deste arquivo mais o ajuste do caso de teste
 *   correspondente.
 *
 * Nenhuma validação de formato/dígito verificador de CNPJ em lugar nenhum —
 * só presença. Convenção travada do projeto desde a Fase 18.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Estende a definição de campo genérica com a frase exibida quando aquele
 * campo obrigatório está em branco — presente em toda definição obrigatória,
 * ausente em toda definição opcional (é essa invariante que garante fonte
 * única de obrigatoriedade + mensagem). */
export interface SystemFieldDefinitionAtivo extends SystemFieldDefinition<SystemField> {
  campoFaltandoReason?: string
}

export const SYSTEM_FIELDS_ATIVO: SystemFieldDefinitionAtivo[] = [
  {
    key: "razaoSocial",
    label: "Razão social",
    required: true,
    campoFaltandoReason: "Razão social não informada",
  },
  {
    key: "cnpj",
    label: "CNPJ",
    required: true,
    campoFaltandoReason: "CNPJ não informado",
  },
  { key: "nomeFantasia", label: "Nome Fantasia", required: false },
  {
    key: "cep",
    label: "CEP",
    required: true,
    campoFaltandoReason: "CEP não informado",
  },
  {
    key: "rua",
    label: "Rua",
    required: true,
    campoFaltandoReason: "Rua não informada",
  },
  {
    key: "numero",
    label: "Número",
    required: true,
    campoFaltandoReason: "Número não informado",
  },
  { key: "complemento", label: "Complemento", required: false },
  {
    key: "cidade",
    label: "Cidade",
    required: true,
    campoFaltandoReason: "Cidade não informada",
  },
  {
    key: "estado",
    label: "Estado",
    required: true,
    campoFaltandoReason: "Estado não informado",
  },
  { key: "categoria", label: "Categoria", required: false },
  {
    key: "contato",
    label: "Contato",
    required: true,
    campoFaltandoReason: "Contato não informado",
  },
  { key: "telefone", label: "Telefone", required: false },
  { key: "email", label: "Email", required: false },
  { key: "produtos", label: "Produtos consumidos", required: false, multi: true },
  {
    key: "responsavel",
    label: "Responsável (vendedor)",
    required: true,
    campoFaltandoReason: "Responsável não informado",
  },
  { key: "numeroDeLojas", label: "Número de lojas", required: false },
]
