"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div
        className="hidden h-10 w-10 place-items-center rounded-full bg-white sm:grid"
        style={{ boxShadow: "var(--shadow-card)" }}
        aria-hidden="true"
      />
    )
  }

  const isDark = theme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="hidden h-10 w-10 place-items-center rounded-full bg-white text-[#444] transition-colors hover:bg-[#f6f6f6] sm:grid"
      style={{ boxShadow: "var(--shadow-card)" }}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
    >
      {isDark ? (
        <Moon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      ) : (
        <Sun className="h-[18px] w-[18px]" strokeWidth={1.8} />
      )}
    </button>
  )
}
