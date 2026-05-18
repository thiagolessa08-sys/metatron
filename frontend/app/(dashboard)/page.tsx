"use client"

import { useAuth } from "@/lib/auth-context"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity, CheckCircle, XCircle, Phone, Users, TrendingUp } from "lucide-react"

interface HealthFull { status: string; service: string; agent: string; agent_url: string }
interface AgenteAoVivo { operador: string; total: number; dur_media_s: number; ultima_chamada: string | null }
interface Snapshot { total_hoje: number; agentes_ativos: number; por_agente: AgenteAoVivo[]; atualizado_em: string }

export default function HomePage() {
  const { user } = useAuth()

  const { data: health, isLoading: healthLoading } = useQuery<HealthFull>({
    queryKey: ["health-full"],
    queryFn: () => api.get("/health/full").then((r) => r.data),
    refetchInterval: 30_000,
  })

  const isGestorOrAdmin = user?.role === "gestor" || user?.role === "admin"

  const { data: snap, isLoading: snapLoading } = useQuery<Snapshot>({
    queryKey: ["operacao-snapshot"],
    queryFn: () => api.get("/api/operacao/snapshot").then((r) => r.data),
    refetchInterval: 60_000,
    enabled: isGestorOrAdmin,
  })

  const agentOk = health?.agent === "ok"

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bem-vindo{user?.email ? `, ${user.email.split("@")[0]}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Dashboard Analítico da Discadora Joytec
        </p>
      </div>

      {/* Stats de Hoje — só gestor/admin */}
      {isGestorOrAdmin && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Hoje</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ligações</CardTitle>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {snapLoading ? (
                  <Skeleton className="h-9 w-24" />
                ) : (
                  <p className="text-3xl font-bold">{snap?.total_hoje.toLocaleString("pt-BR") ?? "—"}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Agentes Ativos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {snapLoading ? (
                  <Skeleton className="h-9 w-16" />
                ) : (
                  <p className="text-3xl font-bold">{snap?.agentes_ativos ?? "—"}</p>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-2 md:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Top Agente</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {snapLoading ? (
                  <Skeleton className="h-9 w-32" />
                ) : snap?.por_agente[0] ? (
                  <div>
                    <p className="text-lg font-bold truncate">{snap.por_agente[0].operador}</p>
                    <p className="text-xs text-muted-foreground">{snap.por_agente[0].total.toLocaleString("pt-BR")} ligações</p>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-muted-foreground">—</p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Status de infraestrutura */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Infraestrutura</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">API Backend</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="h-5 w-20 rounded bg-muted animate-pulse" />
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
              {healthLoading ? (
                <div className="h-4 w-4 rounded bg-muted animate-pulse" />
              ) : agentOk ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="h-5 w-24 rounded bg-muted animate-pulse" />
              ) : (
                <Badge variant={agentOk ? "default" : "destructive"}>
                  {agentOk ? "Conectado" : "Desconectado"}
                </Badge>
              )}
              {health?.agent_url && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{health.agent_url}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {!agentOk && !healthLoading && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-4 text-sm text-destructive">
              ⚠️ O Java Agent está inacessível. Verifique se o Cloudflare Tunnel está ativo e
              atualize <code className="font-mono">AGENT_URL</code> nas variáveis de ambiente.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
