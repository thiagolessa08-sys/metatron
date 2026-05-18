"use client"

import { useQuery } from "@tanstack/react-query"
import ReactECharts from "echarts-for-react"
import { Clock, TrendingUp } from "lucide-react"
import api from "@/lib/api"
import { useFilters } from "@/lib/filters-context"
import { Skeleton } from "@/components/ui/skeleton"

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
interface ComparativoSerie {
  hora: number
  valor: number
}
interface CockpitResult {
  heatmap: HeatmapCell[]
  comparativo_hoje: ComparativoSerie[]
  comparativo_media7d: ComparativoSerie[]
  picos: PicoItem[]
  total_periodo: number
}

const DIAS_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
const HORAS_LABEL = Array.from({ length: 24 }, (_, h) => `${h.toString().padStart(2, "0")}h`)

export default function CockpitPage() {
  const { period } = useFilters()
  const body = { data_inicio: period.dataInicio, data_fim: period.dataFim }

  const { data, isLoading, isError } = useQuery<CockpitResult>({
    queryKey: ["cockpit", body],
    queryFn: async () => (await api.post("/api/cockpit/heatmap", body)).data,
  })

  const maxValor = data ? Math.max(...data.heatmap.map((c) => c.valor), 1) : 1

  const heatmapOption = data
    ? {
        tooltip: {
          position: "top",
          formatter: (p: { value: [number, number, number] }) => {
            const [h, ds, v] = p.value
            return `${DIAS_LABEL[ds]} às ${HORAS_LABEL[h]}: <b>${v} ligações</b>`
          },
        },
        grid: { left: 60, right: 20, top: 20, bottom: 60 },
        xAxis: {
          type: "category",
          data: HORAS_LABEL,
          splitArea: { show: true },
          axisLabel: { fontSize: 10 },
        },
        yAxis: {
          type: "category",
          data: DIAS_LABEL,
          splitArea: { show: true },
          axisLabel: { fontSize: 11 },
        },
        visualMap: {
          min: 0,
          max: maxValor,
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
            data: data.heatmap.map((c) => [c.hora, c.dia_semana, c.valor]),
            label: { show: false },
            emphasis: {
              itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.2)" },
            },
          },
        ],
      }
    : null

  const comparativoOption = data
    ? {
        tooltip: { trigger: "axis" },
        legend: { data: ["Hoje", "Média 7 dias"], top: 0, right: 0 },
        grid: { left: 50, right: 20, top: 40, bottom: 30 },
        xAxis: { type: "category", data: HORAS_LABEL, boundaryGap: false, axisLabel: { fontSize: 10 } },
        yAxis: { type: "value" },
        series: [
          {
            name: "Hoje",
            type: "line",
            smooth: true,
            data: data.comparativo_hoje.map((p) => p.valor),
            itemStyle: { color: "#ff6a2c" },
            lineStyle: { width: 3 },
            areaStyle: { color: "rgba(255,106,44,0.12)" },
          },
          {
            name: "Média 7 dias",
            type: "line",
            smooth: true,
            data: data.comparativo_media7d.map((p) => p.valor),
            itemStyle: { color: "#111" },
            lineStyle: { width: 2, type: "dashed" },
          },
        ],
      }
    : null

  return (
    <div className="flex flex-col gap-5 pb-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Cockpit Temporal</h1>
        <p className="mt-1 text-sm text-[var(--muted-finexy)]">
          Identifique os melhores horários e padrões de operação
        </p>
      </div>

      {isError && (
        <div className="rounded-[22px] border border-red-200 bg-red-50 p-6 text-center text-red-700">
          Erro ao carregar dados. O agente Sybase pode estar indisponível.
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Skeleton className="h-28 w-full rounded-[22px]" />
            <Skeleton className="h-28 w-full rounded-[22px]" />
            <Skeleton className="h-28 w-full rounded-[22px]" />
            <Skeleton className="h-28 w-full rounded-[22px]" />
          </div>
          <Skeleton className="h-[420px] w-full rounded-[22px]" />
          <Skeleton className="h-[340px] w-full rounded-[22px]" />
        </div>
      )}

      {data && !isLoading && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div
              className="rounded-[22px] bg-white p-5"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <p className="text-[13px] font-medium text-[var(--muted-finexy)]">
                Total no período
              </p>
              <p className="mt-2 text-[30px] font-bold tracking-[-0.02em]">
                {data.total_periodo.toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-[11.5px] text-[var(--muted-finexy)]">
                Ligações registradas
              </p>
            </div>

            {data.picos.slice(0, 3).map((p, i) => (
              <div
                key={`${p.dia_semana}-${p.hora}`}
                className={`relative overflow-hidden rounded-[22px] p-5 ${
                  i === 0 ? "text-white" : "bg-white"
                }`}
                style={
                  i === 0
                    ? {
                        background:
                          "linear-gradient(180deg, #ff7a3d 0%, #ff5a18 100%)",
                      }
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
                  <Clock
                    className={`h-4 w-4 ${
                      i === 0 ? "text-[#ffe7d8]" : "text-[var(--muted-finexy)]"
                    }`}
                  />
                  <span
                    className={
                      i === 0 ? "text-[#ffe7d8]" : "text-[var(--muted-finexy)]"
                    }
                  >
                    {i === 0 ? "Melhor horário" : `Pico #${i + 1}`}
                  </span>
                </div>
                <p className="relative mt-3 text-[20px] font-bold tracking-[-0.01em]">
                  {p.label}
                </p>
                <p
                  className={`relative mt-1 text-[11.5px] ${
                    i === 0 ? "text-[#ffd9c2]" : "text-[var(--muted-finexy)]"
                  }`}
                >
                  {p.valor.toLocaleString("pt-BR")} ligações
                </p>
              </div>
            ))}

            {data.picos.length === 0 && (
              <div
                className="rounded-[22px] bg-white p-5 md:col-span-3"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <p className="text-sm text-[var(--muted-finexy)]">
                  Sem dados suficientes para identificar picos no período.
                </p>
              </div>
            )}
          </section>

          <section
            className="rounded-[22px] bg-white p-5"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="mb-4">
              <h2 className="text-[18px] font-bold tracking-[-0.01em]">
                Mapa de calor — dia da semana × hora
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted-finexy)]">
                Cores mais escuras indicam maior volume de ligações no período
              </p>
            </div>
            {data.heatmap.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--line)] p-10 text-center text-sm text-[var(--muted-finexy)]">
                Nenhuma ligação registrada no período selecionado.
              </div>
            ) : (
              heatmapOption && (
                <ReactECharts option={heatmapOption} style={{ height: 360 }} />
              )
            )}
          </section>

          <section
            className="rounded-[22px] bg-white p-5"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[var(--orange)]" />
              <div>
                <h2 className="text-[18px] font-bold tracking-[-0.01em]">
                  Hoje vs Média 7 dias
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-finexy)]">
                  Compare o ritmo de hoje com o histórico recente
                </p>
              </div>
            </div>
            {comparativoOption && (
              <ReactECharts option={comparativoOption} style={{ height: 280 }} />
            )}
          </section>
        </>
      )}
    </div>
  )
}
