"use client"

import { CircleCheck, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export type ImportSummaryPuladaGroup = {
  motivo: string
  quantidade: number
}

type ImportSummaryProps = {
  importadosCount: number
  puladas: ImportSummaryPuladaGroup[]
  onVerClientes: () => void
  onImportarOutra: () => void
}

const integerFormatter = new Intl.NumberFormat("pt-BR")

/**
 * Post-confirmation summary screen (D-01, 07-UI-SPEC.md) — pure
 * presentational, no fetch effect (unlike GanhosPerdidosCards, whose
 * stat-tile layout this reuses): ImportWizard already has the confirm
 * result synchronously by the time this renders.
 *
 * Deliberately uses the project's locked 20px display size (`text-xl`) for
 * the two stat counts, NOT GanhosPerdidosCards' 36px waiver — that waiver
 * is explicitly scoped to the Dashboard's 3 original KPI tiles only
 * (07-UI-SPEC.md Typography).
 */
export function ImportSummary({
  importadosCount,
  puladas,
  onVerClientes,
  onImportarOutra,
}: ImportSummaryProps) {
  const puladasCount = puladas.reduce((sum, p) => sum + p.quantidade, 0)

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Importação concluída</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-green-600">
          <CardContent className="flex flex-col gap-2 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <CircleCheck className="size-4 text-muted-foreground" />
              Clientes importados
            </div>
            <p className="text-xl leading-[1.2] font-semibold text-foreground">
              {integerFormatter.format(importadosCount)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="flex flex-col gap-2 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <TriangleAlert className="size-4 text-muted-foreground" />
              Linhas puladas
            </div>
            <p className="text-xl leading-[1.2] font-semibold text-foreground">
              {integerFormatter.format(puladasCount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {puladas.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Motivos das linhas puladas</h3>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {puladas.map((grupo) => (
              <li key={grupo.motivo}>
                {grupo.motivo} — {grupo.quantidade} linha
                {grupo.quantidade === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" onClick={onVerClientes}>
          Ver clientes
        </Button>
        <Button type="button" variant="outline" onClick={onImportarOutra}>
          Importar outra planilha
        </Button>
      </div>
    </div>
  )
}
