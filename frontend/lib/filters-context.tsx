"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { format, subDays } from "date-fns"

export type PeriodPreset = "today" | "last7" | "last30" | "last90" | "month" | "custom"

export interface PeriodRange {
  preset: PeriodPreset
  dataInicio: string // yyyy-MM-dd
  dataFim: string // yyyy-MM-dd
}

interface FiltersContextValue {
  // Global filters
  period: PeriodRange
  setPeriod: (range: PeriodRange) => void
  campanha: string | null
  setCampanha: (value: string | null) => void
  operador: string | null
  setOperador: (value: string | null) => void
  // Per-page filter slot
  pageFilters: ReactNode
  setPageFilters: (node: ReactNode) => void
}

const FiltersContext = createContext<FiltersContextValue | null>(null)

const STORAGE_KEY_PERIOD = "metatron:filters:period"
const STORAGE_KEY_CAMPANHA = "metatron:filters:campanha"
const STORAGE_KEY_OPERADOR = "metatron:filters:operador"

function today(): string {
  return format(new Date(), "yyyy-MM-dd")
}

// Default: últimos 90 dias para garantir cobertura em base de teste/PoC
function defaultPeriod(): PeriodRange {
  return {
    preset: "last90",
    dataInicio: format(subDays(new Date(), 89), "yyyy-MM-dd"),
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
    case "last30":
      return {
        preset,
        dataInicio: format(subDays(now, 29), "yyyy-MM-dd"),
        dataFim: today(),
      }
    case "last90":
      return {
        preset,
        dataInicio: format(subDays(now, 89), "yyyy-MM-dd"),
        dataFim: today(),
      }
    case "month": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        preset,
        dataInicio: format(monthStart, "yyyy-MM-dd"),
        dataFim: today(),
      }
    }
    default:
      return defaultPeriod()
  }
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodState] = useState<PeriodRange>(defaultPeriod())
  const [campanha, setCampanhaState] = useState<string | null>(null)
  const [operador, setOperadorState] = useState<string | null>(null)
  const [pageFilters, setPageFilters] = useState<ReactNode>(null)

  // Restaura do localStorage no mount
  useEffect(() => {
    try {
      const rawP = localStorage.getItem(STORAGE_KEY_PERIOD)
      if (rawP) {
        const parsed = JSON.parse(rawP) as PeriodRange
        if (parsed.preset && parsed.dataInicio && parsed.dataFim) {
          if (parsed.preset !== "custom") {
            setPeriodState(computePresetRange(parsed.preset))
          } else {
            setPeriodState(parsed)
          }
        }
      }
      const rawC = localStorage.getItem(STORAGE_KEY_CAMPANHA)
      if (rawC && rawC !== "null") setCampanhaState(rawC)
      const rawO = localStorage.getItem(STORAGE_KEY_OPERADOR)
      if (rawO && rawO !== "null") setOperadorState(rawO)
    } catch {
      // ignora
    }
  }, [])

  const setPeriod = useCallback((range: PeriodRange) => {
    setPeriodState(range)
    try {
      localStorage.setItem(STORAGE_KEY_PERIOD, JSON.stringify(range))
    } catch {
      /* */
    }
  }, [])

  const setCampanha = useCallback((value: string | null) => {
    setCampanhaState(value)
    try {
      if (value) localStorage.setItem(STORAGE_KEY_CAMPANHA, value)
      else localStorage.removeItem(STORAGE_KEY_CAMPANHA)
    } catch {
      /* */
    }
  }, [])

  const setOperador = useCallback((value: string | null) => {
    setOperadorState(value)
    try {
      if (value) localStorage.setItem(STORAGE_KEY_OPERADOR, value)
      else localStorage.removeItem(STORAGE_KEY_OPERADOR)
    } catch {
      /* */
    }
  }, [])

  return (
    <FiltersContext.Provider
      value={{
        period,
        setPeriod,
        campanha,
        setCampanha,
        operador,
        setOperador,
        pageFilters,
        setPageFilters,
      }}
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

export function usePageFilters(node: ReactNode) {
  const { setPageFilters } = useFilters()
  useEffect(() => {
    setPageFilters(node)
    return () => setPageFilters(null)
  }, [node, setPageFilters])
}
