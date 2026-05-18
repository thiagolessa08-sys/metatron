"use client"

import { ChevronDown, LogOut, User as UserIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/auth-context"

const ROLE_LABEL: Record<string, string> = {
  gestor: "Gestor",
  consultor: "Consultor",
  admin: "Admin",
}

function getInitial(text: string | undefined | null): string {
  if (!text) return "U"
  const trimmed = text.trim()
  return trimmed.charAt(0).toUpperCase() || "U"
}

function truncateEmail(email: string | undefined | null, max = 20): string {
  if (!email) return ""
  if (email.length <= max) return email
  return email.slice(0, max - 1) + "…"
}

function prettifyName(email: string | undefined | null): string {
  if (!email) return "Usuário"
  const localPart = email.split("@")[0] ?? ""
  const firstSegment = localPart.split(".")[0] ?? localPart
  if (!firstSegment) return "Usuário"
  return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)
}

export function ProfilePill() {
  const { user, logout } = useAuth()

  const initial = getInitial(user?.email)
  const displayName = prettifyName(user?.email)
  const role = user?.role ? ROLE_LABEL[user.role] ?? user.role : ""

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex cursor-pointer items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange)]/40"
        style={{ boxShadow: "var(--shadow-card)" }}
        aria-label="Menu do usuário"
      >
        <span
          className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold"
          style={{ background: "var(--orange-soft)", color: "var(--orange)" }}
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="hidden flex-col items-start leading-[1.15] sm:flex">
          <span className="text-[13.5px] font-bold text-[var(--ink)]">{displayName}</span>
          <span className="text-[11px] text-[#9a9a9a]">{truncateEmail(user?.email)}</span>
        </span>
        <ChevronDown className="ml-0.5 h-3.5 w-3.5 text-[#bdbdbd]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
            {role && (
              <span className="mt-1 inline-flex w-fit items-center rounded-full bg-[var(--orange-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--orange)]">
                {role}
              </span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-muted-foreground" disabled>
          <UserIcon className="mr-2 h-4 w-4" />
          Meu Perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
