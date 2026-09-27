import { format, parseISO } from "date-fns"

import type {
  AderenciaUsoRow,
  ComparativoVendedorRow,
} from "@/lib/supabase/queries/dashboard"

/**
 * Módulo puro (ADER-01..03, D-09) — regras de exibição da coluna de
 * aderência de uso da tabela comparativa por vendedor (VEND-01). Módulo
 * seguro para componente de cliente: só `import type` de
 * @/lib/supabase/queries/dashboard, nenhum import em tempo de execução de
 * módulo que leia cookies do servidor (nenhum acesso ao ambiente do
 * Next.js nem ao cliente Supabase do servidor aqui).
 *
 * Quem decide se a janela de 28 dias ainda está "coletando dados" é o
 * Postgres (coluna `coletando_desde`, dashboard_aderencia_uso() no plano
 * 30-02) — este módulo nunca calcula datas por conta própria; datas vindas
 * do banco são sempre lidas com `parseISO`, nunca com o construtor nativo de
 * Date (convenção do projeto — fuso incorreto).
 *
 * `aderenciaPct` já chega em pontos percentuais (0 a 100) — diferente de
 * `taxaConversao` (ComparativoVendedorTable.tsx), que chega como razão (0 a
 * 1) e por isso é multiplicada por 100 na tabela. Aqui essa multiplicação
 * NUNCA acontece.
 */

export type ComparativoVendedorLinha = ComparativoVendedorRow & {
  aderencia: AderenciaUsoRow | null
}

export type RotuloAderencia = {
  principal: string
  detalhe: string | null
  coletando: boolean
}

export const TEXTO_TOOLTIP_ADERENCIA =
  "Dias úteis (segunda a sexta) com uso do sistema nos últimos 28 dias — entrar no sistema, mover etapa, concluir tarefa ou visita, ou cadastrar ou editar cliente."

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const TRAVESSAO: RotuloAderencia = {
  principal: "—",
  detalhe: null,
  coletando: false,
}

/**
 * Decide o que a célula de aderência mostra para um vendedor (D-09):
 * - `null` (sem linha de aderência, ex: falha tolerada na ação) → travessão.
 * - `coletandoDesde` preenchido → aviso "Coletando dados desde DD/MM/AAAA",
 *   sem detalhe — vale tanto para janela ainda incompleta quanto para
 *   denominador zero (D-09 travado em conflitos_resolvidos item 9); vence
 *   sobre qualquer percentual eventualmente presente na mesma linha.
 * - `aderenciaPct` nulo (defensivo, sem coletandoDesde) → travessão.
 * - senão → percentual formatado em pt-BR (1 casa) + "%", com o detalhe
 *   "N de M dias úteis" (singular quando diasUteis é 1).
 */
export function rotuloAderencia(
  aderencia: AderenciaUsoRow | null
): RotuloAderencia {
  if (aderencia === null) return TRAVESSAO

  if (aderencia.coletandoDesde !== null) {
    return {
      principal: `Coletando dados desde ${format(
        parseISO(aderencia.coletandoDesde),
        "dd/MM/yyyy"
      )}`,
      detalhe: null,
      coletando: true,
    }
  }

  if (aderencia.aderenciaPct === null) return TRAVESSAO

  const unidade = aderencia.diasUteis === 1 ? "dia útil" : "dias úteis"

  return {
    principal: `${percentFormatter.format(aderencia.aderenciaPct)}%`,
    detalhe: `${aderencia.diasUsados} de ${aderencia.diasUteis} ${unidade}`,
    coletando: false,
  }
}

/**
 * Junta o comparativo já existente (VEND-01) com a leitura nova de
 * aderência, por `responsavel`. Nunca reordena nem filtra `linhas` — a
 * ordem é do SQL de dashboard_comparativo_vendedor(), preservada
 * integralmente aqui; um vendedor sem linha de aderência (ex: leitura nova
 * falhou, ou nenhuma aderência retornada para ele) recebe `aderencia: null`,
 * nunca some da lista. Uma aderência de um id fora do comparativo é
 * ignorada silenciosamente.
 */
export function mesclarAderencia(
  linhas: ComparativoVendedorRow[],
  aderencias: AderenciaUsoRow[]
): ComparativoVendedorLinha[] {
  const mapa = new Map(
    aderencias.map((aderencia) => [aderencia.responsavel, aderencia])
  )

  return linhas.map((linha) => ({
    ...linha,
    aderencia: mapa.get(linha.responsavel) ?? null,
  }))
}
