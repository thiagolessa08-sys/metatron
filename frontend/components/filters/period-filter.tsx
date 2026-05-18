"use client"

import { Calendar, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFilters, computePresetRange, type PeriodPreset } from "@/lib/filters-context"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState } from "react"

const PRESET_LABEL: Record<PeriodPreset, string> = {
  today: "Hoje",
  last7: "Últimos 7 dias",
  last30: "Últimos 30 dias",
  last90: "Últimos 90 dias",
  month: "Este mês",
  custom: "Personalizado",
}

function formatRange(dataInicio: string, dataFim: string): string {
  try {
    const start = parseISO(dataInicio)
    const end = parseISO(dataFim)
    if (dataInicio === dataFim) {
      return format(start, "d 'de' MMM", { locale: ptBR })
    }
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${format(start, "d", { locale: ptBR })}–${format(end, "d 'de' MMM", { locale: ptBR })}`
    }
    return `${format(start, "d MMM", { locale: ptBR })} – ${format(end, "d MMM", { locale: ptBR })}`
  } catch {
    return `${dataInicio} – ${dataFim}`
  }
}

export function PeriodFilter() {
  const { period, setPeriod } = useFilters()
  const [customOpen, setCustomOpen] = useState(false)
  const [tempStart, setTempStart] = useState(period.dataInicio)
  const [tempEnd, setTempEnd] = useState(period.dataFim)

  function handlePresetChange(value: string) {
    if (value === "custom") {
      setTempStart(period.dataInicio)
      setTempEnd(period.dataFim)
      setCustomOpen(true)
      return
    }
    setPeriod(computePresetRange(value as PeriodPreset))
  }

  function applyCustom() {
    if (tempStart && tempEnd && tempStart <= tempEnd) {
      setPeriod({ preset: "custom", dataInicio: tempStart, dataFim: tempEnd })
      setCustomOpen(false)
    }
  }

  const label =
    period.preset === "custom"
      ? formatRange(period.dataInicio, period.dataFim)
      : PRESET_LABEL[period.preset]

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:bg-[#f6f6f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)]/40"
          style={{ boxShadow: "var(--shadow-card)" }}
          aria-label="Filtro de período"
        >
          <Calendar className="h-4 w-4 text-[var(--muted-finexy)]" strokeWidth={1.8} />
          <span>{label}</span>
          <ChevronDown className="h-3.5 w-3.5 text-[#bdbdbd]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuRadioGroup
            value={period.preset}
            onValueChange={handlePresetChange}
          >
            <DropdownMenuRadioItem value="today">Hoje</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="last7">Últimos 7 dias</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="last30">Últimos 30 dias</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="last90">Últimos 90 dias</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="month">Este mês</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handlePresetChange("custom")}>
            <Calendar className="mr-2 h-4 w-4" />
            Personalizado…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {customOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => setCustomOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[22px] bg-white p-6"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}
          >
            <h2 className="mb-4 text-lg font-bold">Período personalizado</h2>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-[var(--ink)]">De</span>
                <input
                  type="date"
                  value={tempStart}
                  onChange={(e) => setTempStart(e.target.value)}
                  className="rounded-xl border border-[var(--line)] bg-[var(--chip)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--orange)]/40"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-[var(--ink)]">Até</span>
                <input
                  type="date"
                  value={tempEnd}
                  onChange={(e) => setTempEnd(e.target.value)}
                  className="rounded-xl border border-[var(--line)] bg-[var(--chip)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--orange)]/40"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCustomOpen(false)}
                className="rounded-xl bg-[var(--chip)] px-4 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[#ececec]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyCustom}
                disabled={!tempStart || !tempEnd || tempStart > tempEnd}
                className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
