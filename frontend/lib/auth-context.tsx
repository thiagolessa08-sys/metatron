"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import api from "@/lib/api"

type Role = "gestor" | "consultor" | "admin"

interface User {
  id: string
  email: string
  role: Role
  agente_id_sybase: string | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) { setLoading(false); return }
    api.get("/api/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.clear())
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const { data } = await api.post("/api/auth/login", { email, password })
    localStorage.setItem("access_token", data.access_token)
    localStorage.setItem("refresh_token", data.refresh_token)
    setUser(data.user)
  }

  function logout() {
    localStorage.clear()
    setUser(null)
    window.location.href = "/login"
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider")
  return ctx
}
