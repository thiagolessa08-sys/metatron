"use client"

import { useQuery } from "@tanstack/react-query"
import ReactECharts from "echarts-for-react"
import {
  Calendar,
  Clock,
  Crown,
  Sun,
  TrendingUp,
  Briefcase,
  Trophy,
  Sparkles,
} from "lucide-react"
import api from "@/lib/api"
import { useFilters } from "@/lib/filters-context"
import { Skeleton } from "@/components/ui/skeleton"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

interface HeatmapCell {
  dia_semana: number
  hora: number
  valor: number
}
interface PicoItem {
  dia_semana: number
  hora: number
  valor: number
  label: string
}
interface VolumeDiario {
  data: string
  total: number
}
interface DiaSemanaTotal {
  dia_semana: number
  label: string
  total: number
}
interface TurnoTotal {
  nome: string
  total: number
}
interface DiaUtilFds {
  dia_util: number
  fim_de_semana: number
  media_dia_util: number
  media_fds: number
}
interface CockpitResult {
  heatmap: HeatmapCell[]
  volume_diario: VolumeDiario[]
  por_dia_semana: DiaSemanaTotal[]
  por_turno: TurnoTotal[]
  dia_util_fds: DiaUtilFds
  picos: PicoItem[]
  total_periodo: number
  melhor_dia_semana: string | null
  melhor_turno: string | null
  pct_horario_comercial: number
  dia_recorde: string | null
  hora_pico: number | null
}

const DIAS_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
const HORAS_LABEL = Array.from({ length: 24 }, (_, h) => `${h.toString().padStart(2, "0")}h`)

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "d 'de' MMM", { locale: ptBR })
  } catch {
    return iso
  }
}

export default function CockpitPage() {
  const { period, campanha, operador, empresa } = useFilters()
  const body = {
    data_inicio: period.dataInicio,
    data_fim: period.dataFim,
    campanha,
    operador,
    empresa: empresa ?? undefined,
  }

  const { data, isLoading, isError } = useQuery<CockpitResult>({
    queryKey: ["cockpit", body],
    queryFn: async () => (await api.post("/api/cockpit/heatmap", body)).data,
  })

  // === ECharts options ===
  const maxValor = data ? Math.max(...data.heatmap.map((c) => c.valor), 1) : 1

  const heatmapOption = data
    ? {
        tooltip: {
          position: "top",
          formatter: (p: { value: [number, number, number] }) => {
            const [h, ds, v] = p.value
            return `${DIAS_LABEL[ds]} às ${HORAS_LABEL[h]}: <b>${v.toLocaleString("pt-BR")} ligações</b>`
          },
        },
        grid: { left: 60, right: 20, top: 20, bottom: 60 },
        xAxis: { type: "category", data: HORAS_LABEL, splitArea: { show: true }, axisLabel: { fontSize: 10 } },
        yAxis: { type: "category", data: DIAS_LABEL, splitArea: { show: true }, axisLabel: { fontSize: 11 } },
        visualMap: {
          min: 0,
          max: maxValor,
          calculable: false,
          orient: "horizontal",
          left: "center",
          bottom: 5,
          textStyle: { fontSize: 10 },
          inRange: { color: ["#E0F5FC", "#C5EBF7", "#4DC3E8", "#28ACDB"] },
        },
        series: [
          {
            type: "heatmap",
            data: data.heatmap.map((c) => [c.hora, c.dia_semana, c.valor]),
            label: { show: false },
            emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.2)" } },
          },
        ],
      }
    : null

  const volumeDiarioOption = data
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
          axisLabel: { fontSize: 10, rotate: data.volume_diario.length > 30 ? 45 : 0 },
        },
        yAxis: { type: "value" },
        series: [
          {
            type: "line",
            smooth: true,
            data: data.volume_diario.map((d) => d.total),
            itemStyle: { color: "#4DC3E8" },
            lineStyle: { width: 2.5 },
            areaStyle: { color: "rgba(77,195,232,0.12)" },
            symbol: "circle",
            symbolSize: 6,
          },
        ],
      }
    : null

  const turnoOption = data
    ? {
        tooltip: { trigger: "item", formatter: "{b}: <b>{c} ligações</b>" },
        grid: { left: 70, right: 20, top: 10, bottom: 30 },
        xAxis: { type: "value", axisLabel: { fontSize: 10 } },
        yAxis: { type: "category", data: data.por_turno.map((t) => t.nome), axisLabel: { fontSize: 12 } },
        series: [
          {
            type: "bar",
            data: data.por_turno.map((t) => t.total),
            itemStyle: {
              color: "#4DC3E8",
              borderRadius: [0, 8, 8, 0],
            },
            label: {
              show: true,
              position: "right",
              fontSize: 11,
              formatter: (p: { value: number }) => p.value.toLocaleString("pt-BR"),
            },
          },
        ],
      }
    : null

  const diaSemanaOption = data
    ? {
        tooltip: { trigger: "axis", formatter: "{b}: <b>{c} ligações</b>" },
        grid: { left: 50, right: 20, top: 20, bottom: 30 },
        xAxis: {
          type: "category",
          data: data.por_dia_semana.map((d) => d.label.slice(0, 3)),
          axisLabel: { fontSize: 11 },
        },
        yAxis: { type: "value", axisLabel: { fontSize: 10 } },
        series: [
          {
            type: "bar",
            data: data.por_dia_semana.map((d, i) => ({
              value: d.total,
              itemStyle: {
                color: i >= 5 ? "#a8a8a8" : "#4DC3E8",
                borderRadius: [8, 8, 0, 0],
              },
            })),
            barMaxWidth: 36,
          },
        ],
      }
    : null

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Cockpit Temporal</h1>
        <p className="mt-1 text-sm text-[var(--muted-finexy)]">
          Identifique os melhores horários, dias e padrões da operação
        </p>
      </div>

      {isError && (
        <div className="rounded-[22px] border border-red-200 bg-red-50 p-6 text-center text-red-700">
          Erro ao carregar dados. O agente Sybase pode estar indisponível.
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-[22px]" />
            ))}
          </div>
          <Skeleton className="h-[420px] w-full rounded-[22px]" />
          <Skeleton className="h-[340px] w-full rounded-[22px]" />
        </div>
      )}

      {data && !isLoading && data.total_periodo === 0 && (
        <div className="rounded-[22px] border border-dashed border-[var(--line)] bg-white p-12 text-center">
          <p className="text-[var(--muted-finexy)]">
            Nenhuma ligação encontrada com os filtros atuais.
          </p>
          <p className="mt-1 text-xs text-[#9a9a9a]">
            Tente ampliar o período ou remover filtros de campanha/operador.
          </p>
        </div>
      )}

      {data && !isLoading && data.total_periodo > 0 && (
        <>
          {/* KPIs */}
          <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Kpi
              highlight
              icon={<Sparkles className="h-4 w-4" />}
              label="Total no período"
              value={data.total_periodo.toLocaleString("pt-BR")}
              hint="Ligações"
            />
            <Kpi
              icon={<Crown className="h-4 w-4" />}
              label="Melhor dia"
              value={data.melhor_dia_semana ?? "—"}
              hint="Da semana"
            />
            <Kpi
              icon={<Sun className="h-4 w-4" />}
              label="Melhor turno"
              value={data.melhor_turno ?? "—"}
              hint={`${data.pct_horario_comercial}% em hor. comercial`}
            />
            <Kpi
              icon={<Clock className="h-4 w-4" />}
              label="Hora de pico"
              value={data.hora_pico !== null ? `${data.hora_pico.toString().padStart(2, "0")}h` : "—"}
              hint="Maior volume horário"
            />
            <Kpi
              icon={<Trophy className="h-4 w-4" />}
              label="Dia recorde"
              value={formatDate(data.dia_recorde)}
              hint="Maior volume diário"
            />
            <Kpi
              icon={<Briefcase className="h-4 w-4" />}
              label="Mix Útil × FDS"
              value={
                data.dia_util_fds.dia_util + data.dia_util_fds.fim_de_semana > 0
                  ? `${Math.round(
                      (data.dia_util_fds.dia_util /
                        (data.dia_util_fds.dia_util + data.dia_util_fds.fim_de_semana)) *
                        100
                    )}%`
                  : "—"
              }
              hint="Volume em dias úteis"
            />
          </section>

          {/* Volume diário */}
          <section className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[var(--orange)]" />
              <div>
                <h2 className="text-[18px] font-bold tracking-[-0.01em]">Volume diário</h2>
                <p className="mt-0.5 text-xs text-[var(--muted-finexy)]">
                  Evolução de ligações no período selecionado
                </p>
              </div>
            </div>
            {volumeDiarioOption && <ReactECharts option={volumeDiarioOption} style={{ height: 260 }} />}
          </section>

          {/* Heatmap */}
          <section className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="mb-4">
              <h2 className="text-[18px] font-bold tracking-[-0.01em]">
                Mapa de calor — dia da semana × hora
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted-finexy)]">
                Cores mais escuras = maior volume de ligações
              </p>
            </div>
            {heatmapOption && <ReactECharts option={heatmapOption} style={{ height: 320 }} />}
          </section>

          {/* Grid 3 colunas — Dia da semana / Turno / Dia útil x FDS */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h3 className="mb-1 text-[15px] font-bold tracking-[-0.01em]">
                Por dia da semana
              </h3>
              <p className="mb-2 text-[11px] text-[var(--muted-finexy)]">
                Cinza = fim de semana
              </p>
              {diaSemanaOption && <ReactECharts option={diaSemanaOption} style={{ height: 200 }} />}
            </div>

            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h3 className="mb-1 text-[15px] font-bold tracking-[-0.01em]">Por turno</h3>
              <p className="mb-2 text-[11px] text-[var(--muted-finexy)]">
                Manhã 6-12 · Tarde 12-18 · Noite 18-24
              </p>
              {turnoOption && <ReactECharts option={turnoOption} style={{ height: 200 }} />}
            </div>

            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h3 className="mb-3 text-[15px] font-bold tracking-[-0.01em]">
                Dia útil × Final de semana
              </h3>
              <div className="flex flex-col gap-3">
                <CompareRow
                  label="Dias úteis"
                  total={data.dia_util_fds.dia_util}
                  media={data.dia_util_fds.media_dia_util}
                  pct={
                    data.dia_util_fds.dia_util + data.dia_util_fds.fim_de_semana > 0
                      ? (data.dia_util_fds.dia_util /
                          (data.dia_util_fds.dia_util + data.dia_util_fds.fim_de_semana)) *
                        100
                      : 0
                  }
                  color="var(--orange)"
                />
                <CompareRow
                  label="Final de semana"
                  total={data.dia_util_fds.fim_de_semana}
                  media={data.dia_util_fds.media_fds}
                  pct={
                    data.dia_util_fds.dia_util + data.dia_util_fds.fim_de_semana > 0
                      ? (data.dia_util_fds.fim_de_semana /
                          (data.dia_util_fds.dia_util + data.dia_util_fds.fim_de_semana)) *
                        100
                      : 0
                  }
                  color="#a8a8a8"
                />
              </div>
            </div>
          </section>

          {/* Picos cards */}
          {data.picos.length > 0 && (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {data.picos.map((p, i) => (
                <div
                  key={`${p.dia_semana}-${p.hora}`}
                  className={`relative overflow-hidden rounded-[22px] p-5 ${
                    i === 0 ? "text-white" : "bg-white"
                  }`}
                  style={
                    i === 0
                      ? { background: "linear-gradient(180deg, #4DC3E8 0%, #28ACDB 100%)" }
                      : { boxShadow: "var(--shadow-card)" }
                  }
                >
                  {i === 0 && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full"
                      style={{
                        background:
                          "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)",
                      }}
                    />
                  )}
                  <div className="relative flex items-center gap-2 text-[13px] font-medium">
                    <Calendar
                      className={`h-4 w-4 ${i === 0 ? "text-[#D0F0FA]" : "text-[var(--muted-finexy)]"}`}
                    />
                    <span className={i === 0 ? "text-[#D0F0FA]" : "text-[var(--muted-finexy)]"}>
                      {i === 0 ? "Melhor combinação" : `Pico #${i + 1}`}
                    </span>
                  </div>
                  <p className="relative mt-3 text-[22px] font-bold tracking-[-0.01em]">{p.label}</p>
                  <p
                    className={`relative mt-1 text-[12px] ${
                      i === 0 ? "text-[#C5EBF7]" : "text-[var(--muted-finexy)]"
                    }`}
                  >
                    {p.valor.toLocaleString("pt-BR")} ligações
                  </p>
                </div>
              ))}
            </section>
          )}
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
}: {
  label: string
  value: string
  hint?: string
  icon?: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] p-4 ${
        highlight ? "text-white" : "bg-white text-[var(--ink)]"
      }`}
      style={{
        background: highlight ? "linear-gradient(180deg, #4DC3E8 0%, #28ACDB 100%)" : undefined,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {highlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)",
          }}
        />
      )}
      <div className="relative flex items-center justify-between text-[12px] font-medium">
        <span className={highlight ? "text-[#D0F0FA]" : "text-[var(--muted-finexy)]"}>{label}</span>
        <span
          className={`grid h-5 w-5 place-items-center rounded-full ${
            highlight ? "bg-white/20" : "bg-[#f3f3f3] text-[#bdbdbd]"
          }`}
        >
          {icon}
        </span>
      </div>
      <p className="relative mt-2 truncate text-[20px] font-bold tracking-[-0.01em]">{value}</p>
      {hint && (
        <p
          className={`relative mt-0.5 text-[10.5px] ${
            highlight ? "text-[#C5EBF7]" : "text-[var(--muted-finexy)]"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

function CompareRow({
  label,
  total,
  media,
  pct,
  color,
}: {
  label: string
  total: number
  media: number
  pct: number
  color: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="text-[12px] tabular-nums text-[var(--muted-finexy)]">
          {total.toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--chip)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(pct, 2)}%`, background: color }}
        />
      </div>
      <p className="text-[10.5px] text-[var(--muted-finexy)]">
        Média {media.toLocaleString("pt-BR")} por dia · {pct.toFixed(1)}% do total
      </p>
    </div>
  )
}
