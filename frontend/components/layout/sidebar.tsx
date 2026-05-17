"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  BarChart3,
  PieChart,
  Users,
  LogIn,
  List,
  Radio,
  TrendingUp,
} from "lucide-react"

const NAV_ITEMS = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["gestor", "consultor", "admin"],
    group: null,
  },
  {
    href: "/operacao",
    label: "Operação Agora",
    icon: Radio,
    roles: ["gestor", "admin"],
    group: null,
  },
  {
    href: "/relatorios/qualificacoes",
    label: "Qualificações",
    icon: PieChart,
    roles: ["gestor", "consultor", "admin"],
    group: "Relatórios",
  },
  {
    href: "/relatorios/aproveitamento",
    label: "Aproveitamento",
    icon: TrendingUp,
    roles: ["gestor", "consultor", "admin"],
    group: "Relatórios",
  },
  {
    href: "/relatorios/listas",
    label: "Listas",
    icon: List,
    roles: ["gestor", "admin"],
    group: "Relatórios",
  },
  {
    href: "/agentes",
    label: "Agentes",
    icon: Users,
    roles: ["gestor", "admin"],
    group: "Análise",
  },
  {
    href: "/historico-login",
    label: "Histórico de Login",
    icon: LogIn,
    roles: ["gestor", "admin"],
    group: "Análise",
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user } = useAuth()

  const visible = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  )

  return (
    <aside className="hidden md:flex flex-col w-60 border-r bg-background min-h-screen px-3 py-6 gap-1">
      <div className="px-3 mb-6">
        <span className="font-bold text-lg tracking-tight">Joytec</span>
        <p className="text-xs text-muted-foreground">Dashboard Analítico</p>
      </div>
      {(() => {
        const groups: string[] = []
        return visible.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + "/")
          const showGroup = item.group && !groups.includes(item.group)
          if (item.group && showGroup) groups.push(item.group)
          return (
            <div key={item.href}>
              {showGroup && (
                <p className="px-3 pt-4 pb-1 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  {item.group}
                </p>
              )}
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            </div>
          )
        })
      })()}
    </aside>
  )
}
