"use client"
import { Suspense } from "react"
import { useQuery } from "@tanstack/react-query"
import { ExportButton } from "@/components/relatorios/export-button"
import { Skeleton } from "@/components/ui/skeleton"
import api from "@/lib/api"
import ReactECharts from "echarts-for-react"
import { useFilters } from "@/lib/filters-context"

interface QualItem {
  qualificacao: string
  quantidade: number
  percentual: number
}
interface QualResult {
  total: number
  items: QualItem[]
}

function QualificacoesContent() {
  const { period } = useFilters()
  const body = {
    data_inicio: period.dataInicio,
    data_fim: period.dataFim,
  }

  const { data, isLoading, isError } = useQuery<QualResult>({
    queryKey: ["qualificacoes", body],
    queryFn: async () => (await api.post("/api/relatorios/qualificacoes", body)).data,
    enabled: !!body.data_inicio && !!body.data_fim,
  })

  const chartOption = {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { orient: "vertical", right: 10, top: "center", type: "scroll" },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        left: -100,
        data:
          data?.items.slice(0, 10).map((i) => ({ name: i.qualificacao, value: i.quantidade })) ??
          [],
        label: { show: false },
      },
    ],
  }

  if (isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )

  if (isError)
    return (
      <div className="rounded-[22px] border border-red-200 bg-red-50 p-6 text-center text-red-700">
        Erro ao carregar dados. O agente Sybase pode estar indisponível.
      </div>
    )

  if (!data || data.items.length === 0)
    return (
      <div className="rounded-[22px] border border-dashed border-[var(--line)] bg-white p-12 text-center text-[var(--muted-finexy)]">
        Nenhum dado para os filtros selecionados.
      </div>
    )

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total de Acionamentos" value={data.total.toLocaleString("pt-BR")} />
        <StatCard label="Tipos de Qualificação" value={data.items.length.toString()} />
        <StatCard label="Qualificação Principal" value={data.items[0]?.qualificacao ?? "—"} valueSize="sm" />
      </div>

      <div
        className="grid grid-cols-1 gap-5 rounded-[22px] bg-white p-5 lg:grid-cols-2"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div>
          <h2 className="mb-1 text-[18px] font-bold tracking-[-0.01em]">Distribuição</h2>
          <p className="mb-3 text-xs text-[var(--muted-finexy)]">Top 10 qualificações no período</p>
          <ReactECharts option={chartOption} style={{ height: 340 }} />
        </div>
        <div>
          <h2 className="mb-3 text-[18px] font-bold tracking-[-0.01em]">Detalhamento</h2>
          <div className="space-y-2">
            {data.items.slice(0, 12).map((item) => (
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
                    style={{
                      background: "var(--orange-soft)",
                      color: "var(--orange)",
                    }}
                  >
                    {item.percentual.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  valueSize = "default",
}: {
  label: string
  value: string
  valueSize?: "default" | "sm"
}) {
  return (
    <div className="rounded-[22px] bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <p className="text-[13px] font-medium text-[var(--muted-finexy)]">{label}</p>
      <p
        className={`mt-2 font-bold tracking-[-0.02em] ${
          valueSize === "sm" ? "truncate text-[18px]" : "text-[30px]"
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function ExportButtonWrapper() {
  const { period } = useFilters()
  const body = {
    data_inicio: period.dataInicio,
    data_fim: period.dataFim,
  }
  return <ExportButton endpoint="/api/relatorios/qualificacoes" body={body} filename="qualificacoes" />
}

export default function QualificacoesPage() {
  return (
    <div className="flex flex-col gap-5 pb-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Qualificações</h1>
          <p className="mt-1 text-sm text-[var(--muted-finexy)]">
            Distribuição de qualificações por período
          </p>
        </div>
        <Suspense>
          <ExportButtonWrapper />
        </Suspense>
      </div>

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <QualificacoesContent />
      </Suspense>
    </div>
  )
}
