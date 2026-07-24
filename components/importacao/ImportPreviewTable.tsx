"use client"

import { useEffect, useState } from "react"

import type { ValidatedRow } from "@/app/actions/importacao"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { statusBorderClass, summaryCounts } from "@/lib/importacao/preview"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 50

const STATUS_LABEL: Record<ValidatedRow["status"], string> = {
  ok: "OK",
  duplicado: "Possível duplicado",
  erro: "Erro",
}

const EMPTY_HEADING = "Nenhuma linha encontrada nesta planilha"
const EMPTY_BODY =
  "Verifique se o arquivo tem dados abaixo da linha de cabeçalho e tente enviar novamente."

/**
 * Step 3's paginated review table (IMP-07/IMP-08). Client-side 50-rows-per-
 * page slice over plain React state — NOT @tanstack/react-table (not in
 * package.json; adding it would need another package-legitimacy checkpoint,
 * and a simple slice covers the same 50/page UX, per 06-04-PLAN.md).
 *
 * Per-row Importar/Pular decision (duplicado rows only, default "Pular") is
 * owned here as row-keyed local state, mirroring EditableListTab.tsx's
 * internal editingId/reactivatingId pattern (06-PATTERNS.md) — nothing
 * outside this component reads it in this phase; Fase 7's
 * confirmarLoteImportacao is what will eventually consume these decisions.
 */
export function ImportPreviewTable({ linhas }: { linhas: ValidatedRow[] }) {
  const [page, setPage] = useState(0)
  const [decisions, setDecisions] = useState<
    Record<number, "importar" | "pular">
  >({})

  // A fresh validarLoteImportacao run produces a new `linhas` array — reset
  // pagination so the Supervisor always starts reviewing from page 1.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0)
  }, [linhas])

  const counts = summaryCounts(linhas)
  const totalPages = Math.max(1, Math.ceil(linhas.length / PAGE_SIZE))
  const pageRows = linhas.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  function decisionFor(row: number): "importar" | "pular" {
    return decisions[row] ?? "pular"
  }

  function setDecision(row: number, decision: "importar" | "pular") {
    setDecisions((current) => ({ ...current, [row]: decision }))
  }

  if (linhas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <p className="text-base font-semibold">{EMPTY_HEADING}</p>
        <p className="max-w-md text-sm text-muted-foreground">{EMPTY_BODY}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground">
        {counts.total} linhas no total — {counts.ok} OK · {counts.erros} com
        erro · {counts.duplicados} possíveis duplicados
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Linha</TableHead>
            <TableHead>Razão social</TableHead>
            <TableHead>Cidade/UF</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((linha) => (
            <TableRow
              key={linha.row}
              className={cn(statusBorderClass(linha.status))}
            >
              <TableCell>{linha.row + 1}</TableCell>
              <TableCell className="font-medium">
                {linha.resolved.razaoSocial || "—"}
              </TableCell>
              <TableCell>
                {linha.resolved.cidade || "—"}/{linha.resolved.estado || "—"}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant="outline" className="w-fit">
                    {STATUS_LABEL[linha.status]}
                  </Badge>
                  {linha.reasons.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {linha.reasons.join(" · ")}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                {linha.status === "duplicado" ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-pressed={decisionFor(linha.row) === "importar"}
                      className={
                        decisionFor(linha.row) === "importar"
                          ? "bg-accent"
                          : undefined
                      }
                      onClick={() => setDecision(linha.row, "importar")}
                    >
                      Importar mesmo assim
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-pressed={decisionFor(linha.row) === "pular"}
                      className={
                        decisionFor(linha.row) === "pular"
                          ? "bg-accent"
                          : undefined
                      }
                      onClick={() => setDecision(linha.row, "pular")}
                    >
                      Pular
                    </Button>
                  </div>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() =>
                setPage((current) => Math.min(totalPages - 1, current + 1))
              }
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
