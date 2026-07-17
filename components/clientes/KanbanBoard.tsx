import { ClienteCard, type ClienteCardData } from "@/components/clientes/ClienteCard"
import { Badge } from "@/components/ui/badge"
import { ETAPAS } from "@/lib/funil/etapas"
import type { ClientesAgrupadosPorEtapa } from "@/lib/supabase/queries/clientes"

/**
 * The 7-column compact kanban board (D-05) — the primary /clientes screen.
 * Columns are derived strictly from ETAPAS (lib/funil/etapas.ts), never a
 * hardcoded stage list, so column order/labels stay a single source of truth
 * shared with the `etapa_funil` Postgres enum.
 *
 * No drag-and-drop yet — that lands in 02-04. This is the static layout.
 */
export function KanbanBoard({
  grouped,
  callerRole,
}: {
  grouped: ClientesAgrupadosPorEtapa
  callerRole: "supervisor" | "vendedor"
}) {
  const showResponsavel = callerRole === "supervisor"

  return (
    <div className="flex flex-1 gap-4 overflow-x-auto pb-2">
      {ETAPAS.map((etapa) => {
        const clientes = grouped[etapa.key]

        return (
          <div
            key={etapa.key}
            className="flex w-[280px] shrink-0 flex-col gap-2"
          >
            <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2">
              <h2 className="truncate text-xl font-semibold">
                {etapa.label}
              </h2>
              <Badge variant="outline" className="shrink-0">
                {clientes.length}
              </Badge>
            </div>

            <div className="flex flex-col gap-2">
              {clientes.length === 0 ? (
                <p className="px-1 text-sm text-muted-foreground">
                  Nenhum cliente nesta etapa
                </p>
              ) : (
                clientes.map((cliente) => {
                  const cardData: ClienteCardData = {
                    id: cliente.id,
                    razaoSocial: cliente.razao_social,
                    categoriaNome: cliente.categoria_nome,
                    responsavelNome: cliente.responsavel_nome,
                    etapa: cliente.etapa,
                    statusAcompanhamento: cliente.status_acompanhamento,
                    cidade: cliente.cidade,
                    estado: cliente.estado,
                  }

                  return (
                    <ClienteCard
                      key={cliente.id}
                      cliente={cardData}
                      showResponsavel={showResponsavel}
                    />
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
