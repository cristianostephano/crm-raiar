import type { ClientePerdido, IntervaloPerdidos } from "@/lib/perdidos/lista"
import { buscarPaginado } from "@/lib/supabase/queries/paginacao"
import { createClient } from "@/lib/supabase/server"

/**
 * Leitura da tela Perdidos (Fase 28, PERD-02/03/04). A RLS dentro de
 * `clientes_perdidos` (migration 0034, plano 28-01) é a ÚNICA fronteira —
 * nenhuma checagem de papel e nenhum filtro de dono aqui (D-10), igual a
 * getClientesSemDiaFixo/getClientesAgrupadosPorEtapa. Paginada desde o
 * primeiro dia porque a lista só cresce (Pitfall 2, quick task 260914-ng5).
 * A ordem é pedida de novo aqui mesmo a função já ordenando, por contrato de
 * paginacao.ts.
 */
type ClientePerdidoRow = {
  cliente_id: string
  razao_social: string | null
  nome_fantasia: string | null
  motivo_perda_nome: string | null
  perdido_em: string
  responsavel: string
  responsavel_nome: string | null
}

function mapRow(row: ClientePerdidoRow): ClientePerdido {
  return {
    clienteId: row.cliente_id,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia,
    motivoPerdaNome: row.motivo_perda_nome,
    perdidoEm: row.perdido_em,
    responsavel: row.responsavel,
    responsavelNome: row.responsavel_nome,
  }
}

export async function getClientesPerdidos(
  intervalo: IntervaloPerdidos
): Promise<ClientePerdido[]> {
  const supabase = await createClient()

  const rows = await buscarPaginado<ClientePerdidoRow>(async (inicio, fim) => {
    const { data, error } = await supabase
      .rpc("clientes_perdidos", {
        p_inicio: intervalo.inicio,
        p_fim: intervalo.fim,
      })
      .order("perdido_em", { ascending: false })
      .order("cliente_id", { ascending: true })
      .range(inicio, fim)

    return { data: data as unknown as ClientePerdidoRow[] | null, error }
  })

  if (rows === null) {
    throw new Error(
      "Falha ao carregar clientes perdidos: leitura paginada incompleta"
    )
  }

  return rows.map(mapRow)
}
