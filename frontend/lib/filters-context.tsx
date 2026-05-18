"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { format, startOfMonth, subDays } from "date-fns"

export type PeriodPreset = "today" | "last7" | "month" | "last30" | "custom"

export interface PeriodRange {
  preset: PeriodPreset
  dataInicio: string // yyyy-MM-dd
  dataFim: string // yyyy-MM-dd
}

interface FiltersContextValue {
  // Global period
  period: PeriodRange
  setPeriod: (range: PeriodRange) => void
  // Per-page filter slot (ReactNode that the header renders)
  pageFilters: ReactNode
  setPageFilters: (node: ReactNode) => void
}

const FiltersContext = createContext<FiltersContextValue | null>(null)

const STORAGE_KEY = "metatron:filters:period"

function today(): string {
  return format(new Date(), "yyyy-MM-dd")
}

function defaultPeriod(): PeriodRange {
  return {
    preset: "month",
    dataInicio: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    dataFim: today(),
  }
}

export function computePresetRange(preset: PeriodPreset): PeriodRange {
  const now = new Date()
  switch (preset) {
    case "today":
      return { preset, dataInicio: today(), dataFim: today() }
    case "last7":
      return {
        preset,
        dataInicio: format(subDays(now, 6), "yyyy-MM-dd"),
        dataFim: today(),
      }
    case "month":
      return {
        preset,
        dataInicio: format(startOfMonth(now), "yyyy-MM-dd"),
        dataFim: today(),
      }
    case "last30":
      return {
        preset,
        dataInicio: format(subDays(now, 29), "yyyy-MM-dd"),
        dataFim: today(),
      }
    default:
      return defaultPeriod()
  }
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodState] = useState<PeriodRange>(defaultPeriod())
  const [pageFilters, setPageFilters] = useState<ReactNode>(null)

  // Restaura do localStorage no mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as PeriodRange
        if (parsed.preset && parsed.dataInicio && parsed.dataFim) {
          // Se é preset relativo, recalcula com a data atual
          if (parsed.preset !== "custom") {
            setPeriodState(computePresetRange(parsed.preset))
          } else {
            setPeriodState(parsed)
          }
        }
      }
    } catch {
      // ignora erro de parse
    }
  }, [])

  const setPeriod = useCallback((range: PeriodRange) => {
    setPeriodState(range)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(range))
    } catch {
      // ignora erro de storage
    }
  }, [])

  return (
    <FiltersContext.Provider
      value={{ period, setPeriod, pageFilters, setPageFilters }}
    >
      {children}
    </FiltersContext.Provider>
  )
}

export function useFilters() {
  const ctx = useContext(FiltersContext)
  if (!ctx) {
    throw new Error("useFilters deve ser usado dentro de FiltersProvider")
  }
  return ctx
}

/**
 * Hook para páginas registrarem filtros adicionais no slot do header.
 * Limpa o slot automaticamente ao desmontar a página.
 *
 * Uso:
 *   usePageFilters(<CampanhaFilter />)
 */
export function usePageFilters(node: ReactNode) {
  const { setPageFilters } = useFilters()
  useEffect(() => {
    setPageFilters(node)
    return () => setPageFilters(null)
  }, [node, setPageFilters])
}
