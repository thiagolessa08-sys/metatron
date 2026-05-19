"use client"

import { useState, useMemo } from "react"
import { ChevronDown, Search, X, Building2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface EmpresaFilterProps {
  value: string | null
  onChange: (value: string | null) => void
}

export function EmpresaFilter({ value, onChange }: EmpresaFilterProps) {
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)

  const { data: empresas = [] } = useQuery<string[]>({
    queryKey: ["aproveitamento-empresas"],
    queryFn: async () => (await api.get("/api/relatorios/aproveitamento/empresas")).data,
    staleTime: 5 * 60_000,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return empresas.slice(0, 50)
    const q = search.toLowerCase()
    return empresas.filter((e) => e.toLowerCase().includes(q)).slice(0, 50)
  }, [empresas, search])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)]/40 ${
          value
            ? "bg-[var(--orange-soft)] text-[var(--orange)]"
            : "bg-white text-[var(--ink)] hover:bg-[#f6f6f6]"
        }`}
        style={{ boxShadow: "var(--shadow-card)" }}
        aria-label="Filtro Empresa"
      >
        <Building2 className="h-4 w-4 text-[var(--muted-finexy)]" strokeWidth={1.8} />
        <span className="max-w-[140px] truncate">{value ?? "Empresa"}</span>
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
      <DropdownMenuContent align="start" className="w-56 p-0">
        <div className="border-b border-[var(--line)] p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9a9a9a]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full rounded-lg bg-[var(--chip)] py-1.5 pl-8 pr-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--orange)]/40"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[var(--muted-finexy)]">
              Nenhum resultado
            </div>
          ) : (
            filtered.map((emp) => (
              <button
                key={emp}
                type="button"
                onClick={() => {
                  onChange(emp)
                  setOpen(false)
                  setSearch("")
                }}
                className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-[var(--chip)] ${
                  value === emp ? "font-semibold text-[var(--orange)]" : ""
                }`}
              >
                <span className="truncate">{emp}</span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
