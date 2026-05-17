"use client"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useCallback } from "react"
import { format, subDays, startOfMonth } from "date-fns"

export interface Filters {
  data_inicio: string
  data_fim: string
  campanha?: string
  operador?: string
  qualificacao?: string
}

function today() {
  return format(new Date(), "yyyy-MM-dd")
}

function defaultStart() {
  return format(startOfMonth(new Date()), "yyyy-MM-dd")
}

export function useFilters(): [Filters, (f: Partial<Filters>) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const filters: Filters = {
    data_inicio: params.get("data_inicio") ?? defaultStart(),
    data_fim: params.get("data_fim") ?? today(),
    campanha: params.get("campanha") ?? undefined,
    operador: params.get("operador") ?? undefined,
    qualificacao: params.get("qualificacao") ?? undefined,
  }

  const setFilters = useCallback(
    (patch: Partial<Filters>) => {
      const next = new URLSearchParams(params.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") {
          next.delete(k)
        } else {
          next.set(k, v)
        }
      }
      router.push(`${pathname}?${next.toString()}`)
    },
    [router, pathname, params]
  )

  return [filters, setFilters]
}

export const PERIOD_PRESETS = [
  { label: "Hoje", getValue: () => ({ data_inicio: today(), data_fim: today() }) },
  { label: "Ontem", getValue: () => { const d = format(subDays(new Date(), 1), "yyyy-MM-dd"); return { data_inicio: d, data_fim: d } } },
  { label: "7 dias", getValue: () => ({ data_inicio: format(subDays(new Date(), 7), "yyyy-MM-dd"), data_fim: today() }) },
  { label: "30 dias", getValue: () => ({ data_inicio: format(subDays(new Date(), 30), "yyyy-MM-dd"), data_fim: today() }) },
  { label: "Mês atual", getValue: () => ({ data_inicio: defaultStart(), data_fim: today() }) },
]
