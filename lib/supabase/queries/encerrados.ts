import type { ClienteEncerrado, IntervaloEncerrados } from "@/lib/encerrados/lista"
import { buscarPaginado } from "@/lib/supabase/queries/paginacao"
import { createClient } from "@/lib/supabase/server"
import type { LookupOption } from "@/lib/supabase/queries/clientes"

/**
 * Leitura da tela Encerrados (Fase 29, D-07/D-08). A RLS dentro de
 * `clientes_encerrados` (migration 0036, plano 29-01) é a ÚNICA fronteira —
 * nenhuma checagem de papel e nenhum filtro de dono aqui, igual a
 * getClientesPerdidos/getClientesSemDiaFixo/getClientesAgrupadosPorEtapa.
 * Paginada desde o primeiro dia (mesmo raciocínio de Perdidos, Pitfall 2 da
 * pesquisa da Fase 28). A ordem é pedida de novo aqui mesmo a função já
 * ordenando, por contrato de paginacao.ts.
 */
type ClienteEncerradoRow = {
  cliente_id: string
  razao_social: string | null
  nome_fantasia: string | null
  motivo_encerramento_nome: string | null
  encerrado_em: string
  responsavel: string
  responsavel_nome: string | null
}

function mapRow(row: ClienteEncerradoRow): ClienteEncerrado {
  return {
    clienteId: row.cliente_id,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia,
    motivoEncerramentoNome: row.motivo_encerramento_nome,
    encerradoEm: row.encerrado_em,
    responsavel: row.responsavel,
    responsavelNome: row.responsavel_nome,
  }
}

export async function getClientesEncerrados(
  intervalo: IntervaloEncerrados
): Promise<ClienteEncerrado[]> {
  const supabase = await createClient()

  const rows = await buscarPaginado<ClienteEncerradoRow>(async (inicio, fim) => {
    const { data, error } = await supabase
      .rpc("clientes_encerrados", {
        p_inicio: intervalo.inicio,
        p_fim: intervalo.fim,
      })
      .order("encerrado_em", { ascending: false })
      .order("cliente_id", { ascending: true })
      .range(inicio, fim)

    return { data: data as unknown as ClienteEncerradoRow[] | null, error }
  })

  if (rows === null) {
    throw new Error(
      "Falha ao carregar clientes encerrados: leitura paginada incompleta"
    )
  }

  return rows.map(mapRow)
}

/**
 * Catálogo ativo de motivos_encerramento (migration 0036, plano 29-01), para
 * o Select "Motivo do encerramento" do diálogo de encerrar (ENCR-02) — irmã
 * literal de getMotivosPerdaAtivos/getTiposTarefaAtivos
 * (lib/supabase/queries/clientes.ts).
 */
export async function getMotivosEncerramentoAtivos(): Promise<LookupOption[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("motivos_encerramento")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome", { ascending: true })

  if (error || !data) return []
  return data
}
