"use client"

import { useAuth } from "@/lib/auth-context"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, CheckCircle, XCircle } from "lucide-react"

interface HealthFull {
  status: string
  service: string
  agent: string
  agent_url: string
}

export default function HomePage() {
  const { user } = useAuth()

  const { data: health, isLoading } = useQuery<HealthFull>({
    queryKey: ["health-full"],
    queryFn: () => api.get("/health/full").then((r) => r.data),
    refetchInterval: 30_000,
  })

  const agentOk = health?.agent === "ok"

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bem-vindo{user?.email ? `, ${user.email.split("@")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Dashboard Analítico da Discadora Joytec
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">API Backend</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            ) : (
              <Badge variant={health?.status === "ok" ? "default" : "destructive"}>
                {health?.status === "ok" ? "Online" : "Indisponível"}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sybase IQ Agent</CardTitle>
            {isLoading ? (
              <div className="h-4 w-4 rounded bg-muted animate-pulse" />
            ) : agentOk ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            ) : (
              <Badge variant={agentOk ? "default" : "destructive"}>
                {agentOk ? "Conectado" : "Desconectado"}
              </Badge>
            )}
            {health?.agent_url && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {health.agent_url}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {!agentOk && !isLoading && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 text-sm text-destructive">
            ⚠️ O Java Agent está inacessível. Verifique se o Cloudflare Tunnel está ativo e
            atualize <code className="font-mono">AGENT_URL</code> nas variáveis de ambiente.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
