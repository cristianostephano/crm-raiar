import type { SystemFieldDefinition } from "@/lib/importacao/types"

/**
 * Segunda lista de campos do sistema — usada pela importação em massa de
 * frequência de visita (Fase 17, IMP-01). Irmã de `lib/importacao/types.ts`,
 * reusando a mesma interface parametrizada de definição de campo (D4): a
 * camada de mapeamento de colunas (`lib/importacao/mapping.ts`) já foi
 * generalizada para servir qualquer lista de campos, então esta lista não
 * duplica nenhuma função — só declara um segundo vocabulário.
 *
 * Os dois campos são SEMPRE obrigatórios: sem razão social não há como achar
 * o cliente, e sem frequência não há o que gravar. A marcação `required:
 * true` é o que dirige, sem lógica nova, o estado desabilitado do botão
 * "Continuar" do passo 2 — via `requiredFieldsFaltando`, já genérica.
 */

export type SystemFieldFrequencia = "razaoSocial" | "frequenciaVisita"

export const SYSTEM_FIELDS_FREQUENCIA: SystemFieldDefinition<SystemFieldFrequencia>[] = [
  { key: "razaoSocial", label: "Razão social", required: true },
  { key: "frequenciaVisita", label: "Frequência de visita", required: true },
]
