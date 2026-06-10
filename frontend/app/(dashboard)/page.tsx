"use client"

import { useQuery } from "@tanstack/react-query"
import ReactECharts from "echarts-for-react"
import {
  CheckCircle,
  Clock,
  Megaphone,
  Tag,
  TrendingUp,
  Trophy,
  Users,
  XCircle,
  Calendar,
} from "lucide-react"
import api from "@/lib/api"
import { Greeting } from "@/components/layout/greeting"
import { useFilters } from "@/lib/filters-context"
import { Skeleton } from "@/components/ui/skeleton"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

interface HealthFull {
  status: string
  service: string
  agent: string
  agent_url: string
}
interface DateRangeResult {
  min_data: string | null
  max_data: string | null
  total: number
}
interface VolumeDiarioPonto {
  data: string
  total: number
}
interface TopItem {
  nome: string
  total: number
}
interface DashboardResult {
  total_ligacoes: number
  fechados_total: number
  funil: TopItem[]
  operadores_unicos: number
  campanhas_unicas: number
  qualificacoes_unicas: number
  duracao_media_s: number
  duracao_total_s: number
  volume_diario: VolumeDiarioPonto[]
  top_qualificacoes: TopItem[]
  top_campanhas: TopItem[]
  top_operadores: TopItem[]
  top_campanha: TopItem | null
  top_operador: TopItem | null
  top_qualificacao: TopItem | null
}

// Cores por etapa do funil (azul claro → escuro; Fechados em verde de sucesso)
const FUNNEL_COLOR: Record<string, string> = {
  "Total de ligações": "#9BDCEF",
  "Localizados": "#5EC7EA",
  "Agente Não Tabulou": "#AEB6BB",
  "Contatados": "#28ACDB",
  "Negociação": "#1784AD",
  "Fechados": "#16A34A",
}

function fmtSeg(s: number): string {
  if (!s) return "—"
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m}m ${sec.toString().padStart(2, "0")}s`
  return `${sec}s`
}

export default function HomePage() {
  const { period, campanha, operador, empresa, setPeriod } = useFilters()
  const body = {
    data_inicio: period.dataInicio,
    data_fim: period.dataFim,
    campanha: campanha ?? undefined,
    operador: operador ?? undefined,
    empresa: empresa ?? undefined,
  }

  const { data, isLoading } = useQuery<DashboardResult>({
    queryKey: ["dashboard-exec", body],
    queryFn: async () => (await api.post("/api/dashboard/executive", body)).data,
  })

  // Descobre o intervalo real de dados na base — só busca uma vez
  const { data: dateRange } = useQuery<DateRangeResult>({
    queryKey: ["dashboard-date-range"],
    queryFn: async () => (await api.get("/api/dashboard/date-range")).data,
    staleTime: 5 * 60_000,
  })

  const { data: health, isLoading: healthLoading } = useQuery<HealthFull>({
    queryKey: ["health-full"],
    queryFn: () => api.get("/health/full").then((r) => r.data),
    refetchInterval: 30_000,
  })

  const agentOk = health?.agent === "ok"

  // === ECharts options ===
  const volumeOption = data
    ? {
        tooltip: { trigger: "axis" },
        grid: { left: 50, right: 20, top: 8, bottom: 36 },
        xAxis: {
          type: "category",
          data: data.volume_diario.map((d) => {
            try {
              return format(parseISO(d.data), "d/MM")
            } catch {
              return d.data
            }
          }),
          axisLabel: {
            fontSize: 10,
            rotate: data.volume_diario.length > 30 ? 45 : 0,
          },
        },
        yAxis: { type: "value", axisLabel: { fontSize: 10 } },
        series: [
          {
            type: "line",
            smooth: true,
            data: data.volume_diario.map((d) => d.total),
            itemStyle: { color: "#4DC3E8" },
            lineStyle: { width: 2.5 },
            areaStyle: { color: "rgba(77,195,232,0.12)" },
            symbol: "circle",
            symbolSize: 5,
          },
        ],
      }
    : null

  const totalFunil = data?.funil?.[0]?.total ?? 0
  const funnelOption = data
    ? {
        tooltip: {
          trigger: "item",
          formatter: (p: { name: string; value: number }) => {
            const pct = totalFunil > 0 ? ((p.value / totalFunil) * 100).toFixed(1) : "0"
            return `${p.name}: <b>${p.value.toLocaleString("pt-BR")}</b> (${pct}%)`
          },
        },
        series: [
          {
            type: "funnel",
            left: "4%",
            right: "4%",
            top: 8,
            bottom: 8,
            minSize: "14%",
            maxSize: "100%",
            sort: "descending",
            gap: 3,
            funnelAlign: "center",
            label: {
              show: true,
              position: "inside",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              formatter: (p: { name: string; value: number }) =>
                `${p.name}  ${p.value.toLocaleString("pt-BR")}`,
            },
            labelLine: { show: false },
            itemStyle: { borderColor: "#fff", borderWidth: 2 },
            emphasis: { label: { fontSize: 12 } },
            data: (data.funil ?? []).map((f) => ({
              name: f.nome,
              value: f.total,
              itemStyle: { color: FUNNEL_COLOR[f.nome] ?? "#4DC3E8" },
            })),
          },
        ],
      }
    : null

  const campanhasOption = data
    ? {
        tooltip: { trigger: "item", formatter: "{b}: <b>{c}</b>" },
        grid: { left: 110, right: 20, top: 10, bottom: 25 },
        xAxis: { type: "value", axisLabel: { fontSize: 10 } },
        yAxis: {
          type: "category",
          data: data.top_campanhas
            .slice(0, 5)
            .map((c) => c.nome.length > 18 ? c.nome.slice(0, 17) + "…" : c.nome)
            .reverse(),
          axisLabel: { fontSize: 11 },
        },
        series: [
          {
            type: "bar",
            data: data.top_campanhas.slice(0, 5).map((c) => c.total).reverse(),
            itemStyle: { color: "#4DC3E8", borderRadius: [0, 8, 8, 0] },
            barMaxWidth: 22,
            label: {
              show: true,
              position: "right",
              fontSize: 10,
              formatter: (p: { value: number }) => p.value.toLocaleString("pt-BR"),
            },
          },
        ],
      }
    : null

  const operadoresOption = data
    ? {
        tooltip: { trigger: "item", formatter: "{b}: <b>{c}</b>" },
        grid: { left: 110, right: 20, top: 10, bottom: 25 },
        xAxis: { type: "value", axisLabel: { fontSize: 10 } },
        yAxis: {
          type: "category",
          data: data.top_operadores
            .slice(0, 5)
            .map((c) => c.nome.length > 18 ? c.nome.slice(0, 17) + "…" : c.nome)
            .reverse(),
          axisLabel: { fontSize: 11 },
        },
        series: [
          {
            type: "bar",
            data: data.top_operadores.slice(0, 5).map((c) => c.total).reverse(),
            itemStyle: { color: "#111", borderRadius: [0, 8, 8, 0] },
            barMaxWidth: 22,
            label: {
              show: true,
              position: "right",
              fontSize: 10,
              formatter: (p: { value: number }) => p.value.toLocaleString("pt-BR"),
            },
          },
        ],
      }
    : null

  return (
    <div className="flex flex-col gap-5 pb-4">
      <Greeting />

      {isLoading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[22px]" />
          ))}
        </div>
      )}

      {data && !isLoading && data.total_ligacoes === 0 && (
        <div className="rounded-[22px] border border-dashed border-[var(--line)] bg-white p-12 text-center">
          <p className="text-[var(--muted-finexy)]">
            Nenhuma ligação encontrada nos filtros atuais.
          </p>
          {dateRange?.min_data && dateRange.max_data ? (
            <div className="mt-4 flex flex-col items-center gap-3">
              <p className="text-sm text-[#7c7c7c]">
                <span className="font-semibold">Dados disponíveis na base:</span>{" "}
                {(() => {
                  try {
                    const ini = format(parseISO(dateRange.min_data), "d 'de' MMM 'de' yyyy", { locale: ptBR })
                    const fim = format(parseISO(dateRange.max_data), "d 'de' MMM 'de' yyyy", { locale: ptBR })
                    return `${ini} até ${fim}`
                  } catch {
                    return `${dateRange.min_data} até ${dateRange.max_data}`
                  }
                })()}{" "}
                <span className="text-[#9a9a9a]">
                  ({dateRange.total.toLocaleString("pt-BR")} ligações no total)
                </span>
              </p>
              <button
                type="button"
                onClick={() =>
                  setPeriod({
                    preset: "custom",
                    dataInicio: dateRange.min_data!,
                    dataFim: dateRange.max_data!,
                  })
                }
                className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black"
              >
                <Calendar className="h-4 w-4" />
                Aplicar período disponível
              </button>
            </div>
          ) : (
            <p className="mt-1 text-xs text-[#9a9a9a]">
              Tente ampliar o período ou limpar campanha/operador.
            </p>
          )}
        </div>
      )}

      {data && !isLoading && data.total_ligacoes > 0 && (
        <>
          {/* KPIs — linha 1 */}
          {(() => {
            const spark = data.volume_diario.map((d) => d.total)
            const trend = calcTrend(spark)
            return (
              <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Kpi
                  highlight
                  label="Fechados"
                  value={data.fechados_total.toLocaleString("pt-BR")}
                  hint={
                    data.total_ligacoes > 0
                      ? `${((data.fechados_total / data.total_ligacoes) * 100).toFixed(2)}% de ${data.total_ligacoes.toLocaleString("pt-BR")} ligações`
                      : "No período selecionado"
                  }
                  icon={<CheckCircle className="h-4 w-4" />}
                />
                <Kpi
                  label="Operadores"
                  value={data.operadores_unicos.toString()}
                  hint="Únicos no período"
                  icon={<Users className="h-4 w-4" />}
                  sparklineData={spark}
                  trend={trend}
                />
                <Kpi
                  label="Campanhas"
                  value={data.campanhas_unicas.toString()}
                  hint="Únicas no período"
                  icon={<Megaphone className="h-4 w-4" />}
                  sparklineData={spark}
                  trend={trend}
                />
                <Kpi
                  label="Duração média"
                  value={fmtSeg(data.duracao_media_s)}
                  hint={`Total: ${fmtSeg(data.duracao_total_s)}`}
                  icon={<Clock className="h-4 w-4" />}
                  sparklineData={spark}
                  trend={trend}
                />
              </section>
            )
          })()}

          {/* KPIs — linha 2 (destaques) */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Kpi
              label="Top campanha"
              value={data.top_campanha?.nome ?? "—"}
              hint={
                data.top_campanha
                  ? `${data.top_campanha.total.toLocaleString("pt-BR")} ligações`
                  : "Sem dados"
              }
              icon={<Trophy className="h-4 w-4" />}
              valueSize="md"
            />
            <Kpi
              label="Top operador"
              value={data.top_operador?.nome ?? "—"}
              hint={
                data.top_operador
                  ? `${data.top_operador.total.toLocaleString("pt-BR")} ligações`
                  : "Sem dados"
              }
              icon={<TrendingUp className="h-4 w-4" />}
              valueSize="md"
            />
            <Kpi
              label="Qualificação principal"
              value={data.top_qualificacao?.nome ?? "—"}
              hint={
                data.top_qualificacao
                  ? `${data.top_qualificacao.total.toLocaleString("pt-BR")} ocorrências`
                  : "Sem dados"
              }
              icon={<Tag className="h-4 w-4" />}
              valueSize="md"
              highlight
            />
          </section>

          {/* Volume diário + Qualificações */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div
              className="lg:col-span-2 rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="mb-3">
                <h2 className="text-[18px] font-bold tracking-[-0.01em]">Volume diário</h2>
                <p className="mt-0.5 text-xs text-[var(--muted-finexy)]">
                  Evolução de ligações no período
                </p>
              </div>
              {volumeOption && <ReactECharts option={volumeOption} style={{ height: 300 }} />}
            </div>

            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="mb-3">
                <h2 className="text-[18px] font-bold tracking-[-0.01em]">Funil de conversão</h2>
                <p className="mt-0.5 text-xs text-[var(--muted-finexy)]">
                  Da ligação ao fechamento
                </p>
              </div>
              {funnelOption && data.funil.length > 0 ? (
                <ReactECharts option={funnelOption} style={{ height: 320 }} />
              ) : (
                <div className="grid h-[320px] place-items-center text-xs text-[var(--muted-finexy)]">
                  Sem dados
                </div>
              )}
            </div>
          </section>

          {/* Top campanhas + Top operadores + Infra */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em]">
                Top 5 campanhas
              </h2>
              {campanhasOption && data.top_campanhas.length > 0 ? (
                <ReactECharts option={campanhasOption} style={{ height: 240 }} />
              ) : (
                <div className="grid h-[240px] place-items-center text-xs text-[var(--muted-finexy)]">
                  Sem dados
                </div>
              )}
            </div>

            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em]">
                Top 5 operadores
              </h2>
              {operadoresOption && data.top_operadores.length > 0 ? (
                <ReactECharts option={operadoresOption} style={{ height: 240 }} />
              ) : (
                <div className="grid h-[240px] place-items-center text-xs text-[var(--muted-finexy)]">
                  Sem dados
                </div>
              )}
            </div>

            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em]">Infraestrutura</h2>
              <div className="flex flex-col gap-2.5">
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
                />
              </div>
              {!agentOk && !healthLoading && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  ⚠️ Java Agent inacessível.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function calcTrend(vals: number[]): number | null {
  if (vals.length < 4) return null
  const half = Math.floor(vals.length / 2)
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const first = avg(vals.slice(0, half))
  const second = avg(vals.slice(half))
  if (first === 0) return null
  return Math.round(((second - first) / first) * 1000) / 10
}

function Sparkline({
  data,
  color,
  height,
  id,
}: {
  data: number[]
  color: string
  height: number
  id: string
}) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const W = 100
  const H = height
  const pad = H * 0.1
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - pad - ((v - min) / range) * (H - pad * 2),
  ])
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ")
  const fillPath =
    `M${pts[0][0]},${H} ` +
    pts.map((p) => `L${p[0]},${p[1]}`).join(" ") +
    ` L${pts[pts.length - 1][0]},${H} Z`
  const gradId = `spk-${id}`
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height, display: "block" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Kpi({
  label,
  value,
  hint,
  icon,
  highlight = false,
  valueSize = "default",
  sparklineData,
  trend,
  bgColor,
}: {
  label: string
  value: string
  hint?: string
  icon?: React.ReactNode
  highlight?: boolean
  valueSize?: "default" | "md"
  sparklineData?: number[]
  trend?: number | null
  bgColor?: string
}) {
  const hasSparkline = sparklineData && sparklineData.length >= 2
  const sparkColor = highlight ? "rgba(255,255,255,0.6)" : "#9ADCEF"
  const safeId = label.replace(/\s+/g, "-").toLowerCase()

  return (
    <div
      className={`relative overflow-hidden rounded-[22px] ${hasSparkline ? "pt-5 px-5 pb-0" : "p-5"} ${
        highlight ? "text-white" : "bg-white text-[var(--ink)]"
      }`}
      style={{
        background: highlight ? "linear-gradient(180deg, #4DC3E8 0%, #28ACDB 100%)" : bgColor ?? undefined,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {highlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)",
          }}
        />
      )}
      <div className="relative flex items-center justify-between text-[13px] font-medium">
        <span className={highlight ? "text-[#D0F0FA]" : "text-[var(--muted-finexy)]"}>{label}</span>
        <span
          className={`grid h-7 w-7 place-items-center rounded-full ${
            highlight ? "bg-white/20" : "bg-[#f3f3f3] text-[#bdbdbd]"
          }`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`relative mt-3 truncate font-bold tracking-[-0.03em] leading-none ${
          valueSize === "md" ? "text-[22px]" : "text-[38px]"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p
          className={`relative mt-1.5 text-[11.5px] ${
            highlight ? "text-[#C5EBF7]" : "text-[var(--muted-finexy)]"
          }`}
        >
          {hint}
        </p>
      )}
      {hasSparkline && (
        <div className="relative mt-3">
          {trend !== undefined && trend !== null && (
            <p
              className={`mb-1.5 text-[11px] font-semibold ${
                trend >= 0
                  ? highlight
                    ? "text-white/75"
                    : "text-green-600"
                  : highlight
                  ? "text-white/55"
                  : "text-red-500"
              }`}
            >
              {trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% vs período anterior
            </p>
          )}
          <Sparkline data={sparklineData} color={sparkColor} height={52} id={safeId} />
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
}: {
  label: string
  loading?: boolean
  ok: boolean
  detail: string
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--line-2)] px-3 py-2">
      <div className="flex items-center gap-2">
        {loading ? (
          <Skeleton className="h-4 w-4 rounded-full" />
        ) : ok ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
        <span className="text-sm font-semibold">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-5 w-16" />
      ) : (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {detail}
        </span>
      )}
    </div>
  )
}
