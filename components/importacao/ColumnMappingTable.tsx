"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NAO_IMPORTAR, type ColumnMapping, type MappingTarget } from "@/lib/importacao/mapping"
import { SYSTEM_FIELDS } from "@/lib/importacao/types"

/**
 * Step 2's per-column mapping grid (IMP-03/IMP-04). Purely a controlled
 * shell — no state of its own (ClienteToolbar.tsx pattern, 06-PATTERNS.md):
 * all mapping state lives in ImportWizard so it survives navigation between
 * wizard steps.
 */
export function ColumnMappingTable({
  columns,
  previews,
  mapping,
  onMappingChange,
}: {
  /** Raw headers detected in the uploaded file, in column order. */
  columns: string[]
  /** First 2-3 parsed values per column, same order as `columns`. */
  previews: string[][]
  mapping: ColumnMapping
  onMappingChange: (columnIndex: number, target: MappingTarget) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Coluna do arquivo</TableHead>
          <TableHead>Prévia</TableHead>
          <TableHead>Campo do sistema</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {columns.map((column, columnIndex) => (
          <TableRow key={columnIndex}>
            <TableCell className="font-medium">{column}</TableCell>
            <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">
              {(previews[columnIndex] ?? []).join(", ")}
            </TableCell>
            <TableCell>
              <Select
                value={mapping[columnIndex] ?? NAO_IMPORTAR}
                onValueChange={(value) =>
                  onMappingChange(columnIndex, value as MappingTarget)
                }
              >
                <SelectTrigger
                  className="w-full"
                  aria-label={`Campo do sistema para a coluna ${column}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_FIELDS.map((field) => (
                    <SelectItem key={field.key} value={field.key}>
                      {field.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={NAO_IMPORTAR}>
                    Não importar esta coluna
                  </SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
