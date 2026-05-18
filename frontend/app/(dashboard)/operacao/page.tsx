"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { Radio, Users, Phone, Clock, AlertCircle, RefreshCw } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

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
  data_referencia: string | null
  is_today: boolean
}

const INTERVAL_MS = 30_000

function fmtDur(s: number) {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}m ${r}s`
}

function fmtDataExtenso(iso: string | null): string {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "d 'de' MMM 'de' yyyy", { locale: ptBR })
  } catch {
    return iso
  }
}

export default function OperacaoPage() {
  const { user } = useAuth()
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSnapshot = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch("/api/operacao/snapshot", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Snapshot = await res.json()
      setSnap(data)
      setError(null)
      setLastFetch(new Date())
    } catch (e) {
      setError("Falha ao carregar dados da operação.")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    fetchSnapshot()
    timerRef.current = setInterval(fetchSnapshot, INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [user, fetchSnapshot])

  const isFallback = snap && !snap.is_today

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Operação Agora</h1>
          <p className="mt-1 text-sm text-[var(--muted-finexy)]">
            Atualização automática a cada 30 segundos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchSnapshot}
            disabled={loading}
            className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:bg-[#f5f5f5] disabled:opacity-60"
            style={{ boxShadow: "var(--shadow-card)" }}
            title="Atualizar agora"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
          {lastFetch && (
            <div
              className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)]"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <Clock className="h-3 w-3 text-[var(--muted-finexy)]" />
              {lastFetch.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
          )}
        </div>
      </div>

      {isFallback && (
        <div className="flex items-start gap-3 rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Mostrando o último dia com dados</p>
            <p className="mt-0.5 text-[12.5px] text-amber-700">
              Não há ligações registradas hoje. Exibindo dados de{" "}
              <b>{fmtDataExtenso(snap.data_referencia)}</b> — o dia mais recente com atividade.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-[22px] border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Kpi
          highlight
          label={isFallback ? "Ligações no dia" : "Ligações hoje"}
          value={snap ? snap.total_hoje.toLocaleString("pt-BR") : null}
          icon={<Phone className="h-4 w-4" />}
          hint={snap?.data_referencia ? fmtDataExtenso(snap.data_referencia) : "—"}
        />
        <Kpi
          label="Agentes ativos"
          value={snap ? snap.agentes_ativos.toString() : null}
          icon={<Users className="h-4 w-4" />}
          hint="Operadores únicos no dia"
        />
        <Kpi
          label="Média / agente"
          value={
            snap
              ? snap.agentes_ativos > 0
                ? Math.round(snap.total_hoje / snap.agentes_ativos).toLocaleString("pt-BR")
                : "—"
              : null
          }
          icon={<Radio className="h-4 w-4" />}
          hint="Ligações por operador"
        />
      </div>

      {/* Tabela */}
      <div className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-bold tracking-[-0.01em]">Desempenho por agente</h2>
            <p className="mt-0.5 text-xs text-[var(--muted-finexy)]">
              Ordenado por volume de ligações
            </p>
          </div>
        </div>

        {!snap ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : snap.por_agente.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] p-10 text-center text-sm text-[var(--muted-finexy)]">
            Nenhum agente registrou ligações no dia.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--line-2)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line-2)] bg-[#fafafa]">
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">#</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">Operador</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">Ligações</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">Duração média</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#9a9a9a]">Última</th>
                </tr>
              </thead>
              <tbody>
                {snap.por_agente.map((ag, idx) => (
                  <tr
                    key={ag.operador}
                    className="border-b border-[var(--line-2)] last:border-b-0"
                  >
                    <td className="px-3 py-2.5 text-sm text-[var(--muted-finexy)]">{idx + 1}</td>
                    <td className="px-3 py-2.5 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold"
                          style={{ background: "var(--orange-soft)", color: "var(--orange)" }}
                        >
                          {ag.operador.charAt(0).toUpperCase()}
                        </span>
                        {ag.operador}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                      {ag.total.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-[var(--muted-finexy)]">
                      {fmtDur(ag.dur_media_s)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-[var(--muted-finexy)]">
                      {ag.ultima_chamada ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({
  label, value, hint, icon, highlight = false,
}: {
  label: string
  value: string | null
  hint?: string
  icon?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] p-5 ${highlight ? "text-white" : "bg-white text-[var(--ink)]"}`}
      style={{
        background: highlight ? "linear-gradient(180deg, #ff7a3d 0%, #ff5a18 100%)" : undefined,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {highlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)" }}
        />
      )}
      <div className="relative flex items-center justify-between text-[13px] font-medium">
        <span className={highlight ? "text-[#ffe7d8]" : "text-[var(--muted-finexy)]"}>{label}</span>
        <span className={`grid h-6 w-6 place-items-center rounded-full ${highlight ? "bg-white/20" : "bg-[#f3f3f3] text-[#bdbdbd]"}`}>
          {icon}
        </span>
      </div>
      <p className="relative mt-3 text-[28px] font-bold tracking-[-0.02em]">
        {value === null ? <Skeleton className="h-9 w-24" /> : value}
      </p>
      {hint && (
        <p className={`relative mt-1 text-[11.5px] ${highlight ? "text-[#ffd9c2]" : "text-[var(--muted-finexy)]"}`}>
          {hint}
        </p>
      )}
    </div>
  )
}
