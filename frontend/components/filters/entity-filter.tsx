"use client"

import { useState, useMemo } from "react"
import { ChevronDown, Search, X } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface FilterItem {
  id: string
  label: string
}
interface FilterOptions {
  campanhas: FilterItem[]
  operadores: FilterItem[]
  qualificacoes: FilterItem[]
  empresas: FilterItem[]
}

interface EntityFilterProps {
  label: string
  source: "campanhas" | "operadores" | "qualificacoes" | "empresas"
  value: string | null
  onChange: (value: string | null) => void
  icon?: React.ReactNode
  filterByEmpresa?: string | null
}

export function EntityFilter({
  label,
  source,
  value,
  onChange,
  icon,
  filterByEmpresa,
}: EntityFilterProps) {
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)

  // Campanhas filtradas por empresa (endpoint dinâmico)
  const { data: campanhasDinamicas } = useQuery<FilterItem[]>({
    queryKey: ["filter-campanhas-empresa", filterByEmpresa],
    queryFn: async () =>
      (await api.get(`/api/filters/campanhas?empresa=${encodeURIComponent(filterByEmpresa!)}`)).data,
    enabled: source === "campanhas" && !!filterByEmpresa,
    staleTime: 2 * 60_000,
  })

  // Opções gerais (todos os filtros, sem empresa)
  const { data } = useQuery<FilterOptions>({
    queryKey: ["filter-options"],
    queryFn: async () => (await api.get("/api/filters/options")).data,
    staleTime: 5 * 60_000,
    enabled: !(source === "campanhas" && !!filterByEmpresa),
  })

  const items: FilterItem[] =
    source === "campanhas" && filterByEmpresa
      ? (campanhasDinamicas ?? [])
      : (data?.[source] ?? [])
  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((i) => i.label.toLowerCase().includes(q))
  }, [items, search])

  const selectedLabel =
    value && items.find((i) => i.id === value)?.label
      ? items.find((i) => i.id === value)!.label
      : null

  const displayLabel = selectedLabel ?? label

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)]/40 ${
          value
            ? "bg-[var(--orange-soft)] text-[var(--orange)]"
            : "bg-white text-[var(--ink)] hover:bg-[#f6f6f6]"
        }`}
        style={{ boxShadow: "var(--shadow-card)" }}
        aria-label={`Filtro ${label}`}
      >
        {icon}
        <span className="max-w-[140px] truncate">{displayLabel}</span>
        {value ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
            }}
            aria-label="Limpar filtro"
            className="grid h-4 w-4 place-items-center rounded-full hover:bg-[var(--orange)]/20"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-[#bdbdbd]" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-0">
        <div className="border-b border-[var(--line)] p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9a9a9a]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Buscar…"
              className="w-full rounded-lg bg-[var(--chip)] py-1.5 pl-8 pr-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--orange)]/40"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[var(--muted-finexy)]">
              Nenhum resultado
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id)
                  setOpen(false)
                  setSearch("")
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--chip)] ${
                  value === item.id ? "font-semibold text-[var(--orange)]" : ""
                }`}
              >
                <span className="truncate">{item.label}</span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
