"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Radio,
  PieChart,
  TrendingUp,
  Users,
  PhoneCall,
  MessageSquare,
  LifeBuoy,
  LogOut,
  Activity,
  CalendarClock,
  Terminal,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

type Role = "gestor" | "consultor" | "admin"

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  roles: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["gestor", "consultor", "admin"] },
  { href: "/operacao", label: "Operação Agora", icon: Radio, roles: ["gestor", "admin"] },
  { href: "/cockpit", label: "Cockpit Temporal", icon: CalendarClock, roles: ["gestor", "admin"] },
  { href: "/relatorios/qualificacoes", label: "Qualificações", icon: PieChart, roles: ["gestor", "consultor", "admin"] },
  { href: "/relatorios/aproveitamento", label: "Aproveitamento", icon: TrendingUp, roles: ["gestor", "consultor", "admin"] },
  { href: "/agentes", label: "Agentes", icon: Users, roles: ["gestor", "admin"] },
  { href: "/relatorios/chamadas", label: "Chamadas", icon: PhoneCall, roles: ["gestor", "admin"] },
  { href: "/chat", label: "Chat Analítico", icon: MessageSquare, roles: ["gestor", "consultor", "admin"] },
  { href: "/sql", label: "SQL Explorer", icon: Terminal, roles: ["admin", "gestor"] },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const visible = NAV_ITEMS.filter((item) =>
    user?.role ? item.roles.includes(user.role as Role) : false
  )

  return (
    <>
      <nav
        className="mt-[172px] flex flex-col items-center gap-1 rounded-[36px] bg-white px-1.5 py-2.5"
        style={{ boxShadow: "var(--shadow-card)" }}
        aria-label="Navegação principal"
      >
        {visible.map((item) => {
          const Icon = item.icon
          const active = isActiveRoute(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              title={item.label}
              aria-label={item.label}
              className={cn(
                "grid h-[38px] w-[38px] place-items-center rounded-xl transition-colors",
                active
                  ? "bg-[#111] text-white"
                  : "text-[#b6b6b6] hover:bg-[#f6f6f6] hover:text-[#555]"
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2.5">
        <button
          type="button"
          title="Ajuda"
          aria-label="Ajuda"
          className="grid h-[38px] w-[38px] place-items-center rounded-xl text-[#b6b6b6] transition-colors hover:bg-white hover:text-[#555]"
        >
          <LifeBuoy className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={() => {
            onClose?.()
            logout()
          }}
          title="Sair"
          aria-label="Sair"
          className="grid h-[38px] w-[38px] place-items-center rounded-xl text-[#b6b6b6] transition-colors hover:bg-white hover:text-[#555]"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
      </div>
    </>
  )
}

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex w-16 shrink-0 flex-col items-center gap-[18px] py-2 pb-[14px]">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-16 flex-col items-center gap-[18px] bg-[var(--bg)] py-3 pb-[14px] transition-transform duration-200 md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent onClose={onClose} />
      </aside>
    </>
  )
}
