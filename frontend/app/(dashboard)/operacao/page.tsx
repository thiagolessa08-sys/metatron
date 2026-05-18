"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Radio, Users, Phone, Clock } from "lucide-react"

interface AgenteAoVivo {
  operador: string
  total: number
  dur_media_s: number
  ultima_chamada: string | null
}

interface Snapshot {
  total_hoje: number
  agentes_ativos: number
  por_agente: AgenteAoVivo[]
  atualizado_em: string
}

function fmtDur(s: number) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}m ${r}s`
}

export default function OperacaoPage() {
  const { user } = useAuth()
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!user) return

    function connect() {
      const token = localStorage.getItem("access_token")
      const url = `/api/operacao/stream?token=${encodeURIComponent(token ?? "")}&interval=30`
      const es = new EventSource(url)
      esRef.current = es

      es.onopen = () => { setConnected(true); setError(null) }

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.error) {
            setError(data.error)
          } else {
            setSnap(data as Snapshot)
            setError(null)
          }
        } catch {
          setError("Falha ao processar dados do servidor.")
        }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        // Reconecta após 10s
        setTimeout(connect, 10_000)
      }
    }

    connect()
    return () => { esRef.current?.close() }
  }, [user])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operação Agora</h1>
          <p className="text-sm text-muted-foreground">Atualização automática a cada 30 segundos</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-400"}`} />
          <span className="text-xs text-muted-foreground">
            {connected ? "Ao vivo" : "Reconectando…"}
          </span>
          {snap && (
            <Badge variant="outline" className="ml-2 text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {snap.atualizado_em}
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ligações Hoje</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {snap ? (
              <p className="text-3xl font-bold">{snap.total_hoje.toLocaleString("pt-BR")}</p>
            ) : (
              <Skeleton className="h-9 w-24" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agentes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {snap ? (
              <p className="text-3xl font-bold">{snap.agentes_ativos}</p>
            ) : (
              <Skeleton className="h-9 w-16" />
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Média/Agente</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {snap ? (
              <p className="text-3xl font-bold">
                {snap.agentes_ativos > 0
                  ? Math.round(snap.total_hoje / snap.agentes_ativos).toLocaleString("pt-BR")
                  : "—"}
              </p>
            ) : (
              <Skeleton className="h-9 w-16" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela por agente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desempenho por Agente — Hoje</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!snap ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : snap.por_agente.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">Nenhum registro para hoje ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">#</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead className="text-right">Ligações</TableHead>
                  <TableHead className="text-right">Duração Média</TableHead>
                  <TableHead className="text-right pr-6">Última Chamada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snap.por_agente.map((ag, idx) => (
                  <TableRow key={ag.operador}>
                    <TableCell className="pl-6 text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{ag.operador}</TableCell>
                    <TableCell className="text-right">{ag.total.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">{fmtDur(ag.dur_media_s)}</TableCell>
                    <TableCell className="text-right pr-6 text-muted-foreground">
                      {ag.ultima_chamada ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
