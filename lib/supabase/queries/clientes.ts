import { ETAPA_KEYS, type EtapaKey } from "@/lib/funil/etapas"
import { createClient } from "@/lib/supabase/server"

export type ClienteListItem = {
  id: string
  razao_social: string
  categoria_id: string | null
  responsavel: string
  etapa: EtapaKey
  status_acompanhamento: "em_andamento" | "perdido" | "ganho"
  cidade: string
  estado: string
  contato: string | null
  telefone: string | null
  email: string | null
  numero_de_lojas: number | null
}

export type ClientesAgrupadosPorEtapa = Record<EtapaKey, ClienteListItem[]>

/**
 * Server-side reader grouping every cliente visible to the caller by funil
 * stage, using the fixed ETAPA_KEYS order from lib/funil/etapas.ts.
 *
 * RLS on `clientes` (T-02-09) scopes which rows come back automatically — a
 * Vendedor's query returns only their own clientes, a Supervisor's returns
 * every cliente — with NO manual `responsavel` filter in this function. That
 * would be redundant with (and a risk of drifting from) the real
 * authorization boundary already enforced by the 02-01 SELECT policy.
 *
 * The selected columns include everything the client-list card needs
 * (razão social, categoria, cidade/estado) plus the fields used to detect an
 * incomplete cadastro (D-02: categoria_id/contato/telefone/email/
 * numero_de_lojas blank -> "Incompleto" badge in a later plan).
 */
export async function getClientesAgrupadosPorEtapa(): Promise<ClientesAgrupadosPorEtapa> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("clientes")
    .select(
      "id, razao_social, categoria_id, responsavel, etapa, status_acompanhamento, cidade, estado, contato, telefone, email, numero_de_lojas"
    )
    .order("posicao", { ascending: true })

  if (error) {
    throw new Error(`Falha ao carregar clientes: ${error.message}`)
  }

  const grouped = Object.fromEntries(
    ETAPA_KEYS.map((key) => [key, [] as ClienteListItem[]])
  ) as ClientesAgrupadosPorEtapa

  for (const cliente of data ?? []) {
    const key = cliente.etapa as EtapaKey
    grouped[key].push(cliente as ClienteListItem)
  }

  return grouped
}
