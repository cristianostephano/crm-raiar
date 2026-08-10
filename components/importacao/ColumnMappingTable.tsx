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
import { NAO_IMPORTAR, type ColumnMappingOf, type MappingTargetOf } from "@/lib/importacao/mapping"
import { SYSTEM_FIELDS, type SystemField, type SystemFieldDefinition } from "@/lib/importacao/types"

/**
 * Step 2's per-column mapping grid (IMP-03/IMP-04). Purely a controlled
 * shell — no state of its own (ClienteToolbar.tsx pattern, 06-PATTERNS.md):
 * all mapping state lives in ImportWizard so it survives navigation between
 * wizard steps.
 *
 * Fase 17 (D4): este componente serve DUAS listas de campos desde a Fase 17
 * — a lista de 14 da importação de clientes (padrão) e a lista de 2 da
 * importação de frequências — por isso a lista de campos é PARÂMETRO
 * (`fields`, opcional, com o padrão de sempre).
 */
export function ColumnMappingTable<K extends string = SystemField>({
  columns,
  previews,
  mapping,
  onMappingChange,
  fields = SYSTEM_FIELDS as unknown as SystemFieldDefinition<K>[],
}: {
  /** Raw headers detected in the uploaded file, in column order. */
  columns: string[]
  /** First 2-3 parsed values per column, same order as `columns`. */
  previews: string[][]
  mapping: ColumnMappingOf<K>
  onMappingChange: (columnIndex: number, target: MappingTargetOf<K>) => void
  /** Lista de campos do sistema oferecida no Select de cada coluna —
   * opcional, com valor padrão igual à lista de 14 (SYSTEM_FIELDS). O ponto
   * de uso existente no assistente de clientes não passa esta propriedade e
   * continua se comportando exatamente como antes. */
  fields?: SystemFieldDefinition<K>[]
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
              <Select<MappingTargetOf<K>>
                value={mapping[columnIndex] ?? NAO_IMPORTAR}
                onValueChange={(value) =>
                  onMappingChange(columnIndex, value as MappingTargetOf<K>)
                }
              >
                <SelectTrigger
                  className="w-full"
                  aria-label={`Campo do sistema para a coluna ${column}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((field) => (
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
