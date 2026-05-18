"use client"

import { useAuth } from "@/lib/auth-context"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { Greeting } from "@/components/layout/greeting"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Activity,
  ArrowUpRight,
  CheckCircle,
  Phone,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react"

interface HealthFull {
  status: string
  service: string
  agent: string
  agent_url: string
}
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
  const topAgent = snap?.por_agente?.[0]

  return (
    <div className="flex flex-col gap-5 pb-4">
      <Greeting />

      {isGestorOrAdmin && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* KPI destacado em laranja */}
          <KpiCard
            highlight
            label="Ligações hoje"
            value={snap?.total_hoje?.toLocaleString("pt-BR") ?? "—"}
            loading={snapLoading}
            icon={<Phone className="h-4 w-4" />}
            footer="Atualizado em tempo real"
          />
          <KpiCard
            label="Agentes ativos"
            value={snap?.agentes_ativos?.toString() ?? "—"}
            loading={snapLoading}
            icon={<Users className="h-4 w-4" />}
            footer={
              snap?.agentes_ativos
                ? `${snap.agentes_ativos} operadores online agora`
                : "—"
            }
          />
          <KpiCard
            label="Top agente"
            value={topAgent?.operador ?? "—"}
            loading={snapLoading}
            icon={<TrendingUp className="h-4 w-4" />}
            footer={
              topAgent
                ? `${topAgent.total.toLocaleString("pt-BR")} ligações hoje`
                : "Sem dados"
            }
            valueSize="lg"
          />
          <KpiCard
            label="Duração média"
            value={
              topAgent?.dur_media_s
                ? `${Math.round(topAgent.dur_media_s)}s`
                : "—"
            }
            loading={snapLoading}
            icon={<Activity className="h-4 w-4" />}
            footer="Top agente, média por chamada"
          />
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Painel de agentes ao vivo */}
        {isGestorOrAdmin && (
          <div
            className="lg:col-span-2 rounded-[22px] bg-white p-5"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[18px] font-bold tracking-[-0.01em]">
                  Agentes em atividade
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-finexy)]">
                  Top 8 por volume de ligações hoje
                </p>
              </div>
              <a
                href="/agentes"
                className="inline-flex items-center gap-1 rounded-full bg-[var(--chip)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:bg-[#ececec]"
              >
                Ver todos
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>

            {snapLoading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : snap && snap.por_agente.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-[var(--line-2)]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--line-2)] bg-[#fafafa]">
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                        Operador
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                        Ligações
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                        Dur. média
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">
                        Última
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {snap.por_agente.slice(0, 8).map((a) => (
                      <tr
                        key={a.operador}
                        className="border-b border-[var(--line-2)] last:border-b-0"
                      >
                        <td className="px-3 py-2.5 text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <span
                              className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold"
                              style={{
                                background: "var(--orange-soft)",
                                color: "var(--orange)",
                              }}
                            >
                              {a.operador.charAt(0).toUpperCase()}
                            </span>
                            {a.operador}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                          {a.total.toLocaleString("pt-BR")}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums text-[var(--muted-finexy)]">
                          {Math.round(a.dur_media_s)}s
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-[var(--muted-finexy)]">
                          {a.ultima_chamada
                            ? new Date(a.ultima_chamada).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted-finexy)]">
                Nenhum agente ativo no momento.
              </div>
            )}
          </div>
        )}

        {/* Status de infraestrutura */}
        <div
          className={`rounded-[22px] bg-white p-5 ${isGestorOrAdmin ? "" : "lg:col-span-3"}`}
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h2 className="mb-4 text-[18px] font-bold tracking-[-0.01em]">
            Infraestrutura
          </h2>
          <div className="flex flex-col gap-3">
            <StatusRow
              label="API Backend"
              loading={healthLoading}
              ok={health?.status === "ok"}
              detail={health?.status === "ok" ? "Online" : "Indisponível"}
            />
            <StatusRow
              label="Sybase IQ Agent"
              loading={healthLoading}
              ok={agentOk}
              detail={agentOk ? "Conectado" : "Desconectado"}
              subDetail={health?.agent_url}
            />
          </div>

          {!agentOk && !healthLoading && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              ⚠️ Java Agent inacessível. Verifique se o Cloudflare Tunnel está ativo.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function KpiCard({
  label,
  value,
  loading,
  icon,
  footer,
  highlight = false,
  valueSize = "default",
}: {
  label: string
  value: string
  loading?: boolean
  icon?: React.ReactNode
  footer?: string
  highlight?: boolean
  valueSize?: "default" | "lg"
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] p-5 ${
        highlight ? "text-white" : "bg-white text-[var(--ink)]"
      }`}
      style={{
        background: highlight
          ? "linear-gradient(180deg, #ff7a3d 0%, #ff5a18 100%)"
          : undefined,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {highlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-8 -right-8 h-36 w-36 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)",
          }}
        />
      )}

      <div className="relative flex items-center justify-between text-[13px] font-medium">
        <span className={highlight ? "text-[#ffe7d8]" : "text-[var(--muted-finexy)]"}>
          {label}
        </span>
        <span
          className={`grid h-6 w-6 place-items-center rounded-full ${
            highlight ? "bg-white/20 text-white" : "bg-[#f3f3f3] text-[#bdbdbd]"
          }`}
        >
          {icon}
        </span>
      </div>
      <div
        className={`relative mt-3.5 mb-1.5 font-bold tracking-[-0.02em] ${
          valueSize === "lg" ? "text-[22px] truncate" : "text-[30px]"
        }`}
      >
        {loading ? (
          <Skeleton className={`h-9 ${valueSize === "lg" ? "w-32" : "w-24"} ${highlight ? "bg-white/30" : ""}`} />
        ) : (
          value
        )}
      </div>
      {footer && (
        <div
          className={`relative text-[11.5px] ${
            highlight ? "text-[#ffd9c2]" : "text-[var(--muted-finexy)]"
          }`}
        >
          {footer}
        </div>
      )}
    </div>
  )
}

function StatusRow({
  label,
  loading,
  ok,
  detail,
  subDetail,
}: {
  label: string
  loading?: boolean
  ok: boolean
  detail: string
  subDetail?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-[var(--line-2)] px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {loading ? (
          <Skeleton className="h-4 w-4 rounded-full" />
        ) : ok ? (
          <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          {subDetail && (
            <p className="truncate text-[11px] text-[var(--muted-finexy)]">
              {subDetail}
            </p>
          )}
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-5 w-16" />
      ) : (
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {detail}
        </span>
      )}
    </div>
  )
}
