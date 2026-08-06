/**
 * Fonte de cidades para o FILTRO da tela de Clientes (D-01/D-02, quick task
 * 260806-h8a) — só as cidades que já têm pelo menos um cliente cadastrado
 * naquele Estado, do sistema inteiro (não escopado ao vendedor logado).
 *
 * O formulário de cadastro/edição (EstadoCidadeFields.tsx) usa uma fonte
 * DIFERENTE de propósito: a lista completa de municípios do IBGE, porque é
 * lá que se cadastra um cliente numa cidade nova pela primeira vez. Este
 * arquivo não é usado por aquele formulário.
 */

import { createClient } from "@/lib/supabase/client"

/** Nome da RPC (migration 0012) — única fonte de verdade do nome. */
export const RPC_CIDADES_COM_CLIENTES = "cidades_com_clientes_por_estado"

/**
 * Devolve os nomes das cidades com pelo menos um cliente cadastrado no
 * Estado `uf`. Nunca lança nem devolve `null` — em caso de erro ou ausência
 * de linhas, devolve array vazio (o Combobox já sabe renderizar a mensagem
 * de vazio nesse caso).
 */
export async function buscarCidadesComClientes(uf: string): Promise<string[]> {
  const { data }: { data: { nome: string }[] | null } = await createClient().rpc(
    RPC_CIDADES_COM_CLIENTES,
    { p_uf: uf }
  )
  return (data ?? []).map((row) => row.nome)
}
