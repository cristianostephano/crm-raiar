import type { ClienteGanho, IntervaloGanhos } from "@/lib/ganhos/lista"
import { buscarPaginado } from "@/lib/supabase/queries/paginacao"
import { createClient } from "@/lib/supabase/server"

/**
 * Leitura da tela Ganhos (quick 261008-rxw). A RLS dentro de
 * `clientes_ganhos` (migration 0053) é a ÚNICA fronteira — nenhuma checagem de
 * papel e nenhum filtro de dono aqui, igual a getClientesPerdidos. Paginada
 * desde o primeiro dia porque a lista só cresce. A ordem (data do ganho do
 * mais recente para o mais antigo, VAZIOS POR ÚLTIMO, depois cliente_id) é
 * pedida de novo aqui mesmo a função já ordenando, por contrato de
 * paginacao.ts — por isso `nullsFirst: false`.
 */
type ClienteGanhoRow = {
  cliente_id: string
  razao_social: string | null
  nome_fantasia: string | null
  ganho_em: string | null
  responsavel: string
  responsavel_nome: string | null
}

function mapRow(row: ClienteGanhoRow): ClienteGanho {
  return {
    clienteId: row.cliente_id,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia,
    ganhoEm: row.ganho_em,
    responsavel: row.responsavel,
    responsavelNome: row.responsavel_nome,
  }
}

export async function getClientesGanhos(
  intervalo: IntervaloGanhos
): Promise<ClienteGanho[]> {
  const supabase = await createClient()

  const rows = await buscarPaginado<ClienteGanhoRow>(async (inicio, fim) => {
    const { data, error } = await supabase
      .rpc("clientes_ganhos", {
        p_inicio: intervalo.inicio,
        p_fim: intervalo.fim,
      })
      .order("ganho_em", { ascending: false, nullsFirst: false })
      .order("cliente_id", { ascending: true })
      .range(inicio, fim)

    return { data: data as unknown as ClienteGanhoRow[] | null, error }
  })

  if (rows === null) {
    throw new Error("Falha ao carregar clientes ganhos: leitura paginada incompleta")
  }

  return rows.map(mapRow)
}
