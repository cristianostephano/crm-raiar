"use client"

import { useState } from "react"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PERIODO_PRESETS_PERDIDOS, type PeriodoPresetPerdidos } from "@/lib/perdidos/lista"

type PerdidosPeriodoFilterProps = {
  preset: PeriodoPresetPerdidos
  customRange: { from: Date; to: Date } | undefined
  onPresetChange: (preset: PeriodoPresetPerdidos) => void
  onCustomRangeApply: (range: { from: Date; to: Date }) => void
}

/**
 * Filtro de período da tela Perdidos (UI-SPEC seção 3) — cópia estrutural de
 * components/dashboard/PeriodoFilter.tsx (mesmo Select que aplica na hora,
 * mesmo Popover+Calendar mode="range" revelado só em "personalizado", mesmo
 * rodapé Cancelar/Aplicar período), mas com um preset set PRÓPRIO desta
 * fase (`PERIODO_PRESETS_PERDIDOS`, tipo `PeriodoPresetPerdidos`) — não
 * importa nada de lib/dashboard nem de components/dashboard.
 *
 * Só "Aplicar período" confirma `pendingRange` para o pai (via
 * onCustomRangeApply); um intervalo pela metade nunca aplica, e "Cancelar"
 * descarta a seleção em andamento.
 */
export function PerdidosPeriodoFilter({
  preset,
  customRange,
  onPresetChange,
  onCustomRangeApply,
}: PerdidosPeriodoFilterProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(
    customRange
  )

  const handlePresetChange = (value: unknown) => {
    if (!value || typeof value !== "string") return
    const nextPreset = value as PeriodoPresetPerdidos
    if (nextPreset === "personalizado") {
      setPendingRange(customRange)
      setPopoverOpen(true)
    }
    onPresetChange(nextPreset)
  }

  const handleAplicar = () => {
    if (!pendingRange?.from || !pendingRange?.to) return
    onCustomRangeApply({ from: pendingRange.from, to: pendingRange.to })
    setPopoverOpen(false)
  }

  const handleCancelar = () => {
    setPendingRange(customRange)
    setPopoverOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-semibold">Período</span>
      <Select
        value={preset}
        onValueChange={handlePresetChange}
        items={PERIODO_PRESETS_PERDIDOS}
      >
        <SelectTrigger className="w-fit" aria-label="Período">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIODO_PRESETS_PERDIDOS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "personalizado" ? (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger className="w-fit rounded-lg border border-input px-2.5 py-1.5 text-left text-sm">
            {customRange
              ? `${format(customRange.from, "dd/MM/yyyy")} - ${format(customRange.to, "dd/MM/yyyy")}`
              : "Selecionar período"}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={pendingRange}
              onSelect={setPendingRange}
            />
            <div className="flex justify-end gap-2 border-t p-2.5">
              <Button type="button" variant="ghost" onClick={handleCancelar}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleAplicar}
                disabled={!pendingRange?.from || !pendingRange?.to}
              >
                Aplicar período
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}
