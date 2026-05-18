"use client"

import { useQuery } from "@tanstack/react-query"
import ReactECharts from "echarts-for-react"
import {
  CheckCircle,
  Clock,
  Megaphone,
  Phone,
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

const PALETA = [
  "#ff6a2c",
  "#111111",
  "#f4a51b",
  "#16a34a",
  "#8a8a8a",
  "#ff9966",
  "#3a8df0",
  "#e23b3b",
]

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
  const { period, campanha, operador, setPeriod } = useFilters()
  const body = {
    data_inicio: period.dataInicio,
    data_fim: period.dataFim,
    campanha: campanha ?? undefined,
    operador: operador ?? undefined,
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
        grid: { left: 50, right: 20, top: 20, bottom: 50 },
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
            itemStyle: { color: "#ff6a2c" },
            lineStyle: { width: 2.5 },
            areaStyle: { color: "rgba(255,106,44,0.12)" },
            symbol: "circle",
            symbolSize: 5,
          },
        ],
      }
    : null

  const qualOption = data
    ? {
        tooltip: { trigger: "item", formatter: "{b}: <b>{c}</b> ({d}%)" },
        legend: {
          orient: "vertical",
          right: 0,
          top: "center",
          type: "scroll",
          textStyle: { fontSize: 11 },
        },
        series: [
          {
            type: "pie",
            radius: ["50%", "75%"],
            center: ["32%", "50%"],
            data: data.top_qualificacoes.slice(0, 6).map((q, i) => ({
              name: q.nome,
              value: q.total,
              itemStyle: { color: PALETA[i % PALETA.length] },
            })),
            label: { show: false },
            labelLine: { show: false },
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
            itemStyle: { color: "#ff6a2c", borderRadius: [0, 8, 8, 0] },
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
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Kpi
              highlight
              label="Total de ligações"
              value={data.total_ligacoes.toLocaleString("pt-BR")}
              hint="No período selecionado"
              icon={<Phone className="h-4 w-4" />}
            />
            <Kpi
              label="Operadores"
              value={data.operadores_unicos.toString()}
              hint="Únicos no período"
              icon={<Users className="h-4 w-4" />}
            />
            <Kpi
              label="Campanhas"
              value={data.campanhas_unicas.toString()}
              hint="Únicas no período"
              icon={<Megaphone className="h-4 w-4" />}
            />
            <Kpi
              label="Duração média"
              value={fmtSeg(data.duracao_media_s)}
              hint={`Total: ${fmtSeg(data.duracao_total_s)}`}
              icon={<Clock className="h-4 w-4" />}
            />
          </section>

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
              {volumeOption && <ReactECharts option={volumeOption} style={{ height: 260 }} />}
            </div>

            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="mb-3">
                <h2 className="text-[18px] font-bold tracking-[-0.01em]">Qualificações</h2>
                <p className="mt-0.5 text-xs text-[var(--muted-finexy)]">Top 6 no período</p>
              </div>
              {qualOption && data.top_qualificacoes.length > 0 ? (
                <ReactECharts option={qualOption} style={{ height: 260 }} />
              ) : (
                <div className="grid h-[260px] place-items-center text-xs text-[var(--muted-finexy)]">
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

function Kpi({
  label,
  value,
  hint,
  icon,
  highlight = false,
  valueSize = "default",
}: {
  label: string
  value: string
  hint?: string
  icon?: React.ReactNode
  highlight?: boolean
  valueSize?: "default" | "md"
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] p-5 ${
        highlight ? "text-white" : "bg-white text-[var(--ink)]"
      }`}
      style={{
        background: highlight ? "linear-gradient(180deg, #ff7a3d 0%, #ff5a18 100%)" : undefined,
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
        <span className={highlight ? "text-[#ffe7d8]" : "text-[var(--muted-finexy)]"}>{label}</span>
        <span
          className={`grid h-6 w-6 place-items-center rounded-full ${
            highlight ? "bg-white/20" : "bg-[#f3f3f3] text-[#bdbdbd]"
          }`}
        >
          {icon}
        </span>
      </div>
      <p
        className={`relative mt-3 truncate font-bold tracking-[-0.02em] ${
          valueSize === "md" ? "text-[20px]" : "text-[28px]"
        }`}
      >
        {value}
      </p>
      {hint && (
        <p
          className={`relative mt-1 text-[11.5px] ${
            highlight ? "text-[#ffd9c2]" : "text-[var(--muted-finexy)]"
          }`}
        >
          {hint}
        </p>
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
