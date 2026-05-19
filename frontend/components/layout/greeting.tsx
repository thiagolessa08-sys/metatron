"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"

function getPeriodGreeting(hour: number): string {
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

function prettifyName(email: string | undefined | null): string {
  if (!email) return ""
  const localPart = email.split("@")[0] ?? ""
  const firstSegment = localPart.split(".")[0] ?? localPart
  if (!firstSegment) return ""
  return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)
}

export function Greeting() {
  const { user } = useAuth()
  const [greeting, setGreeting] = useState<string>("Olá")

  useEffect(() => {
    setGreeting(getPeriodGreeting(new Date().getHours()))
  }, [])

  const name = prettifyName(user?.email)

  return (
    <div className="px-1">
      <h1 className="m-0 mb-1 text-[34px] font-bold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
        {greeting}
        {name && <span>, <span className="text-[var(--orange)]">{name}</span></span>}
      </h1>
      <p className="m-0 text-sm text-[#7c7c7c]">
        Acompanhe suas operações, métricas e ligações em tempo real.
      </p>
    </div>
  )
}
