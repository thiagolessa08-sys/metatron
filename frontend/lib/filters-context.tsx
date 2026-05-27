"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { format, subDays, parseISO } from "date-fns"

// PoC: data de referência fixa (último dia com dados na base de teste).
// Em produção (D-1), trocar por: new Date()
const REFERENCE_DATE_ISO = "2026-04-01"
function referenceDate(): Date {
  return parseISO(REFERENCE_DATE_ISO)
}

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
  empresa: string | null
  setEmpresa: (value: string | null) => void
  // Per-page filter slot
  pageFilters: ReactNode
  setPageFilters: (node: ReactNode) => void
}

const FiltersContext = createContext<FiltersContextValue | null>(null)

const STORAGE_KEY_PERIOD = "metatron:filters:period"
const STORAGE_KEY_CAMPANHA = "metatron:filters:campanha"
const STORAGE_KEY_OPERADOR = "metatron:filters:operador"
const STORAGE_KEY_EMPRESA = "metatron:filters:empresa"

function today(): string {
  return format(referenceDate(), "yyyy-MM-dd")
}

// Default: últimos 90 dias a partir da data de referência
function defaultPeriod(): PeriodRange {
  return {
    preset: "last90",
    dataInicio: format(subDays(referenceDate(), 89), "yyyy-MM-dd"),
    dataFim: today(),
  }
}

export function computePresetRange(preset: PeriodPreset): PeriodRange {
  const ref = referenceDate()
  switch (preset) {
    case "today":
      return { preset, dataInicio: today(), dataFim: today() }
    case "last7":
      return {
        preset,
        dataInicio: format(subDays(ref, 6), "yyyy-MM-dd"),
        dataFim: today(),
      }
    case "last30":
      return {
        preset,
        dataInicio: format(subDays(ref, 29), "yyyy-MM-dd"),
        dataFim: today(),
      }
    case "last90":
      return {
        preset,
        dataInicio: format(subDays(ref, 89), "yyyy-MM-dd"),
        dataFim: today(),
      }
    case "month": {
      const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1)
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
  const [empresa, setEmpresaState] = useState<string | null>(null)
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
      const rawE = localStorage.getItem(STORAGE_KEY_EMPRESA)
      if (rawE && rawE !== "null") setEmpresaState(rawE)
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

  const setEmpresa = useCallback((value: string | null) => {
    setEmpresaState(value)
    // Reseta campanha sempre que empresa mudar
    setCampanhaState(null)
    try {
      if (value) localStorage.setItem(STORAGE_KEY_EMPRESA, value)
      else localStorage.removeItem(STORAGE_KEY_EMPRESA)
      localStorage.removeItem(STORAGE_KEY_CAMPANHA)
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
        empresa,
        setEmpresa,
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
