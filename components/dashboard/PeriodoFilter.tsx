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
import type { PeriodoPreset } from "@/lib/dashboard/periodo"

const PRESET_OPTIONS: { value: PeriodoPreset; label: string }[] = [
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "este_mes", label: "Este mês" },
  { value: "este_ano", label: "Este ano" },
  { value: "personalizado", label: "Personalizado" },
]

type PeriodoFilterProps = {
  preset: PeriodoPreset
  customRange: { from: Date; to: Date } | undefined
  onPresetChange: (preset: PeriodoPreset) => void
  onCustomRangeApply: (range: { from: Date; to: Date }) => void
}

/**
 * Period filter row (D-01): a Select with the 4 presets that applies
 * immediately, plus a Popover+Calendar mode="range" custom-range picker
 * revealed only when "Personalizado" is selected — mirrors the exact
 * Popover/PopoverTrigger composition already used twice in
 * ClienteDetailSheet.tsx for single-date pickers (04-PATTERNS.md).
 *
 * Only "Aplicar período" commits `pendingRange` up to the parent (via
 * onCustomRangeApply); a half-selected range never updates the applied
 * período, and "Cancelar" discards the in-progress selection.
 */
export function PeriodoFilter({
  preset,
  customRange,
  onPresetChange,
  onCustomRangeApply,
}: PeriodoFilterProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(
    customRange
  )

  const handlePresetChange = (value: unknown) => {
    if (!value || typeof value !== "string") return
    const nextPreset = value as PeriodoPreset
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
        items={PRESET_OPTIONS}
      >
        <SelectTrigger className="w-fit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESET_OPTIONS.map((option) => (
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
