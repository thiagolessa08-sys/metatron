"use client"
import { useQuery } from "@tanstack/react-query"
import ReactECharts from "echarts-for-react"
import { ExportButton } from "@/components/relatorios/export-button"
import { Skeleton } from "@/components/ui/skeleton"
import api from "@/lib/api"
import { useFilters } from "@/lib/filters-context"
import { format, parseISO } from "date-fns"
import { Crown, Tag, TrendingDown, TrendingUp, Layers } from "lucide-react"

interface QualItem {
  qualificacao: string
  quantidade: number
  percentual: number
}
interface QualResult {
  total: number
  items: QualItem[]
}
interface TendenciaResult {
  datas: string[]
  qualificacoes: string[]
  series: { nome: string; valores: number[] }[]
}
interface HeatmapResult {
  operadores: string[]
  qualificacoes: string[]
  matriz: number[][]
}

const PALETA = [
  "#ff6a2c",
  "#111111",
  "#f4a51b",
  "#16a34a",
  "#8a8a8a",
  "#3a8df0",
  "#e23b3b",
  "#ff9966",
]

// Palavras-chave para classificar qualificações
const CONVERSAO_KEYWORDS = ["CONVER", "VENDA", "FECHADO", "OK", "EFETIV"]
const DESCARTE_KEYWORDS = ["DESCART", "INVALIDO", "NAO INTERESS", "DESLIGOU"]

function classify(item: QualItem): "conversao" | "descarte" | "outro" {
  const upper = item.qualificacao.toUpperCase()
  if (CONVERSAO_KEYWORDS.some((k) => upper.includes(k))) return "conversao"
  if (DESCARTE_KEYWORDS.some((k) => upper.includes(k))) return "descarte"
  return "outro"
}

export default function QualificacoesPage() {
  const { period, campanha, operador } = useFilters()
  const body = {
    data_inicio: period.dataInicio,
    data_fim: period.dataFim,
    campanha: campanha ?? undefined,
    operador: operador ?? undefined,
  }

  const { data, isLoading, isError } = useQuery<QualResult>({
    queryKey: ["qualificacoes", body],
    queryFn: async () => (await api.post("/api/relatorios/qualificacoes", body)).data,
  })

  const { data: tendencia } = useQuery<TendenciaResult>({
    queryKey: ["qualificacoes-tendencia", body],
    queryFn: async () =>
      (await api.post("/api/relatorios/qualificacoes/tendencia", body)).data,
  })

  const { data: heatmap } = useQuery<HeatmapResult>({
    queryKey: ["qualificacoes-heatmap", body],
    queryFn: async () =>
      (await api.post("/api/relatorios/qualificacoes/heatmap", body)).data,
  })

  // KPIs derivados
  const conversoes = data
    ? data.items.filter((i) => classify(i) === "conversao").reduce((s, i) => s + i.quantidade, 0)
    : 0
  const descartes = data
    ? data.items.filter((i) => classify(i) === "descarte").reduce((s, i) => s + i.quantidade, 0)
    : 0
  const pctConversao = data && data.total > 0 ? (conversoes / data.total) * 100 : 0
  const pctDescarte = data && data.total > 0 ? (descartes / data.total) * 100 : 0

  // === ECharts options ===
  const donutOption = data
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
            radius: ["45%", "72%"],
            center: ["32%", "50%"],
            data: data.items.slice(0, 10).map((q, i) => ({
              name: q.qualificacao,
              value: q.quantidade,
              itemStyle: { color: PALETA[i % PALETA.length] },
            })),
            label: { show: false },
            labelLine: { show: false },
          },
        ],
      }
    : null

  const tendenciaOption = tendencia
    ? {
        tooltip: { trigger: "axis" },
        legend: { top: 0, type: "scroll", textStyle: { fontSize: 11 } },
        grid: { left: 50, right: 20, top: 40, bottom: 50 },
        xAxis: {
          type: "category",
          data: tendencia.datas.map((d) => {
            try {
              return format(parseISO(d), "d/MM")
            } catch {
              return d
            }
          }),
          axisLabel: {
            fontSize: 10,
            rotate: tendencia.datas.length > 30 ? 45 : 0,
          },
        },
        yAxis: { type: "value", axisLabel: { fontSize: 10 } },
        series: tendencia.series.map((s, i) => ({
          name: s.nome,
          type: "line",
          smooth: true,
          data: s.valores,
          itemStyle: { color: PALETA[i % PALETA.length] },
          lineStyle: { width: 2 },
          symbol: "circle",
          symbolSize: 5,
        })),
      }
    : null

  const heatmapOption = heatmap
    ? {
        tooltip: {
          position: "top",
          formatter: (p: { value: [number, number, number] }) => {
            const [qi, oi, v] = p.value
            return `${heatmap.operadores[oi]} × ${heatmap.qualificacoes[qi]}: <b>${v.toLocaleString("pt-BR")}</b>`
          },
        },
        grid: { left: 140, right: 20, top: 60, bottom: 50 },
        xAxis: {
          type: "category",
          data: heatmap.qualificacoes.map((q) =>
            q.length > 16 ? q.slice(0, 15) + "…" : q
          ),
          axisLabel: { fontSize: 10, rotate: 35 },
          position: "top",
          splitArea: { show: true },
        },
        yAxis: {
          type: "category",
          data: heatmap.operadores,
          axisLabel: { fontSize: 10 },
          splitArea: { show: true },
        },
        visualMap: {
          min: 0,
          max: Math.max(
            ...heatmap.matriz.flatMap((row) => row),
            1
          ),
          calculable: false,
          orient: "horizontal",
          left: "center",
          bottom: 5,
          textStyle: { fontSize: 10 },
          inRange: { color: ["#fff5ec", "#ffd9c2", "#ff7a3d", "#ff5a18"] },
        },
        series: [
          {
            type: "heatmap",
            data: heatmap.matriz.flatMap((row, oi) =>
              row.map((v, qi) => [qi, oi, v])
            ),
            label: { show: false },
          },
        ],
      }
    : null

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Qualificações</h1>
          <p className="mt-1 text-sm text-[var(--muted-finexy)]">
            Distribuição, tendência diária e perfil por operador
          </p>
        </div>
        <ExportButton
          endpoint="/api/relatorios/qualificacoes"
          body={body}
          filename="qualificacoes"
        />
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-[22px]" />
          <Skeleton className="h-96 w-full rounded-[22px]" />
        </div>
      )}

      {isError && (
        <div className="rounded-[22px] border border-red-200 bg-red-50 p-6 text-center text-red-700">
          Erro ao carregar dados. O agente Sybase pode estar indisponível.
        </div>
      )}

      {data && !isLoading && data.total === 0 && (
        <div className="rounded-[22px] border border-dashed border-[var(--line)] bg-white p-12 text-center text-[var(--muted-finexy)]">
          Nenhuma qualificação encontrada com os filtros atuais.
        </div>
      )}

      {data && !isLoading && data.total > 0 && (
        <>
          {/* KPIs */}
          <section className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Kpi
              highlight
              label="Total"
              value={data.total.toLocaleString("pt-BR")}
              hint="Acionamentos"
              icon={<Layers className="h-4 w-4" />}
            />
            <Kpi
              label="Tipos únicos"
              value={data.items.length.toString()}
              hint="Diferentes qualificações"
              icon={<Tag className="h-4 w-4" />}
            />
            <Kpi
              label="Conversões"
              value={conversoes.toLocaleString("pt-BR")}
              hint={`${pctConversao.toFixed(1)}% do total`}
              icon={<TrendingUp className="h-4 w-4" />}
              accent="green"
            />
            <Kpi
              label="Descartes"
              value={descartes.toLocaleString("pt-BR")}
              hint={`${pctDescarte.toFixed(1)}% do total`}
              icon={<TrendingDown className="h-4 w-4" />}
              accent="red"
            />
            <Kpi
              label="Principal"
              value={data.items[0]?.qualificacao ?? "—"}
              hint={`${data.items[0]?.percentual.toFixed(1)}%`}
              icon={<Crown className="h-4 w-4" />}
              valueSize="sm"
            />
          </section>

          {/* Donut + Tabela */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h2 className="mb-1 text-[18px] font-bold tracking-[-0.01em]">Distribuição</h2>
              <p className="mb-2 text-xs text-[var(--muted-finexy)]">Top 10 do período</p>
              {donutOption && <ReactECharts option={donutOption} style={{ height: 320 }} />}
            </div>

            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em]">Detalhamento</h2>
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {data.items.slice(0, 20).map((item) => (
                  <div
                    key={item.qualificacao}
                    className="flex items-center justify-between rounded-xl border border-[var(--line-2)] px-3 py-2.5"
                  >
                    <span className="truncate text-sm font-medium">{item.qualificacao}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular-nums text-[var(--muted-finexy)]">
                        {item.quantidade.toLocaleString("pt-BR")}
                      </span>
                      <span
                        className="inline-flex w-14 justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ background: "var(--orange-soft)", color: "var(--orange)" }}
                      >
                        {item.percentual.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Tendência */}
          {tendencia && tendencia.datas.length > 0 && (
            <section
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="mb-3">
                <h2 className="text-[18px] font-bold tracking-[-0.01em]">
                  Tendência diária — Top 5 qualificações
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-finexy)]">
                  Como as principais qualificações evoluem ao longo do período
                </p>
              </div>
              {tendenciaOption && (
                <ReactECharts option={tendenciaOption} style={{ height: 300 }} />
              )}
            </section>
          )}

          {/* Heatmap operador × qualificação */}
          {heatmap && heatmap.operadores.length > 0 && (
            <section
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="mb-3">
                <h2 className="text-[18px] font-bold tracking-[-0.01em]">
                  Perfil por operador
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-finexy)]">
                  Quem qualifica o quê — top 10 operadores × top 10 qualificações
                </p>
              </div>
              {heatmapOption && (
                <ReactECharts
                  option={heatmapOption}
                  style={{ height: Math.max(420, heatmap.operadores.length * 36 + 100) }}
                />
              )}
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
  accent,
  valueSize = "default",
}: {
  label: string
  value: string
  hint?: string
  icon?: React.ReactNode
  highlight?: boolean
  accent?: "green" | "red"
  valueSize?: "default" | "sm"
}) {
  const accentColor = accent === "green" ? "#16a34a" : accent === "red" ? "#e23b3b" : undefined
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] p-4 ${
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
          className="pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)",
          }}
        />
      )}
      <div className="relative flex items-center justify-between text-[12px] font-medium">
        <span className={highlight ? "text-[#ffe7d8]" : "text-[var(--muted-finexy)]"}>{label}</span>
        <span
          className={`grid h-5 w-5 place-items-center rounded-full ${
            highlight ? "bg-white/20" : "bg-[#f3f3f3] text-[#bdbdbd]"
          }`}
          style={accent && !highlight ? { color: accentColor } : undefined}
        >
          {icon}
        </span>
      </div>
      <p
        className={`relative mt-2 truncate font-bold tracking-[-0.01em] ${
          valueSize === "sm" ? "text-[16px]" : "text-[22px]"
        }`}
        style={accent && !highlight ? { color: accentColor } : undefined}
      >
        {value}
      </p>
      {hint && (
        <p
          className={`relative mt-0.5 text-[11px] ${
            highlight ? "text-[#ffd9c2]" : "text-[var(--muted-finexy)]"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
