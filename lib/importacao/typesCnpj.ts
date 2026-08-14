import type { SystemFieldDefinition } from "@/lib/importacao/types"

/**
 * TERCEIRO vocabulário de campos do sistema — usado pela planilha "CNPJ em
 * massa" (Fase 19, IMP-03). Irmã de `lib/importacao/types.ts` (a lista de 16
 * campos da importação de clientes) e de `lib/importacao/typesFrequencia.ts`
 * (a segunda lista, Fase 17): reusa a mesma interface parametrizada de
 * definição de campo (`SystemFieldDefinition<K>`) e a mesma camada genérica
 * de mapeamento (`lib/importacao/mapping.ts`) — nenhuma função nova é criada
 * por esta lista, só um terceiro vocabulário declarado.
 *
 * Os dois campos são SEMPRE obrigatórios, ao contrário do vocabulário de 16
 * campos (onde `cnpj` é opcional, porque lá o cliente está sendo criado do
 * zero): sem razão social não há como achar o cliente no banco, e sem CNPJ
 * não há o que gravar. A marcação `required: true` dirige, sem lógica nova,
 * o estado desabilitado do botão "Continuar" do passo 2 do assistente — via
 * `requiredFieldsFaltando`, já genérica.
 */

export type SystemFieldCnpj = "razaoSocial" | "cnpj"

export const SYSTEM_FIELDS_CNPJ: SystemFieldDefinition<SystemFieldCnpj>[] = [
  { key: "razaoSocial", label: "Razão social", required: true },
  { key: "cnpj", label: "CNPJ", required: true },
]
