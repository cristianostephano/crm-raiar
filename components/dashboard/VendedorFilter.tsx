"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { VendedorFiltroOpcao } from "@/lib/supabase/queries/dashboard"

/** Sentinel Select value para "sem filtro" — mesma convenção do filtro de
 * vendedor da Agenda ("" é reservado pelo Select da base-ui para o estado de
 * placeholder). */
const SEM_FILTRO = "__todos__"

type VendedorFilterProps = {
  vendedores: VendedorFiltroOpcao[]
  vendedorId: string | null
  onVendedorChange: (vendedorId: string | null) => void
}

/**
 * Seletor "Vendedor" do Dashboard (quick 261009-npp, D-01/D-07) — "Todos os
 * vendedores" (padrão, igual a hoje) mais uma opção por vendedor ATIVO, só o
 * nome. Só o Supervisor vê este componente (DashboardClient decide); esse
 * detalhe de tela nunca é a fronteira de autorização — a RLS do banco é.
 * Copiado em comportamento do filtro de vendedor da Agenda (AgendaList), sem
 * importar de lá.
 */
export function VendedorFilter({
  vendedores,
  vendedorId,
  onVendedorChange,
}: VendedorFilterProps) {
  const selectItems = [
    { value: SEM_FILTRO, label: "Todos os vendedores" },
    ...vendedores.map((vendedor) => ({
      value: vendedor.id,
      label: vendedor.nome,
    })),
  ]

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="dashboard-filtro-vendedor">Vendedor</Label>
      <Select
        value={vendedorId ?? SEM_FILTRO}
        onValueChange={(value) =>
          onVendedorChange(value === SEM_FILTRO ? null : String(value))
        }
        items={selectItems}
      >
        <SelectTrigger id="dashboard-filtro-vendedor" className="w-56">
          <SelectValue placeholder="Todos os vendedores" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SEM_FILTRO}>Todos os vendedores</SelectItem>
          {vendedores.map((vendedor) => (
            <SelectItem key={vendedor.id} value={vendedor.id}>
              {vendedor.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
