"use client"

import { Bell, Info, Menu, Search, Megaphone, UserRound } from "lucide-react"
import { ProfilePill } from "@/components/layout/profile-pill"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { PeriodFilter } from "@/components/filters/period-filter"
import { EntityFilter } from "@/components/filters/entity-filter"
import { useFilters } from "@/lib/filters-context"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { pageFilters, campanha, setCampanha, operador, setOperador } = useFilters()

  return (
    <div className="flex items-center justify-between gap-[18px] px-1 py-0.5">
      <div className="flex shrink-0 items-center gap-3.5">
        <button
          type="button"
          onClick={onMenuClick}
          className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#444] md:hidden"
          style={{ boxShadow: "var(--shadow-card)" }}
          aria-label="Abrir menu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        <div className="text-[20px] font-extrabold tracking-[-0.01em] text-[var(--ink)]">
          Metatron
        </div>
      </div>

      <div className="hidden flex-1 items-center justify-center gap-2 md:flex">
        <PeriodFilter />
        <EntityFilter
          label="Campanha"
          source="campanhas"
          value={campanha}
          onChange={setCampanha}
          icon={<Megaphone className="h-4 w-4 text-[var(--muted-finexy)]" strokeWidth={1.8} />}
        />
        <EntityFilter
          label="Operador"
          source="operadores"
          value={operador}
          onChange={setOperador}
          icon={<UserRound className="h-4 w-4 text-[var(--muted-finexy)]" strokeWidth={1.8} />}
        />
        {pageFilters}
      </div>

      <div className="flex shrink-0 items-center gap-3.5">
        <button
          type="button"
          className="hidden h-10 w-10 place-items-center rounded-full bg-white text-[#444] transition-colors hover:bg-[#f6f6f6] lg:grid"
          style={{ boxShadow: "var(--shadow-card)" }}
          aria-label="Buscar"
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-[#444] transition-colors hover:bg-[#f6f6f6]"
          style={{ boxShadow: "var(--shadow-card)" }}
          aria-label="Notificações"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
          <span
            className="absolute right-2.5 top-2.5 h-[7px] w-[7px] rounded-full"
            style={{ background: "var(--orange)", border: "2px solid #fff" }}
            aria-hidden="true"
          />
        </button>
        <ThemeToggle />
        <ProfilePill />
      </div>
    </div>
  )
}
