"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { FiltersProvider } from "@/lib/filters-context"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [user, loading, router])

  if (loading || !user) return null

  return (
    <FiltersProvider>
      <div
        className="flex h-screen gap-[18px] overflow-hidden px-[22px] py-[18px]"
        style={{ background: "var(--bg)" }}
      >
        <Sidebar open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          <Header onMenuClick={() => setMobileSidebarOpen(true)} />
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">{children}</div>
        </main>
      </div>
    </FiltersProvider>
  )
}
