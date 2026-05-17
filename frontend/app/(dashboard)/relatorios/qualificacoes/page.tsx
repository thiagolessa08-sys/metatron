"use client"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { FilterBar } from "@/components/filters/filter-bar"
import { ExportButton } from "@/components/relatorios/export-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { format, startOfMonth } from "date-fns"
import ReactECharts from "echarts-for-react"

interface QualItem { qualificacao: string; quantidade: number; percentual: number }
interface QualResult { total: number; items: QualItem[] }

function today() { return format(new Date(), "yyyy-MM-dd") }
function defaultStart() { return format(startOfMonth(new Date()), "yyyy-MM-dd") }

function QualificacoesContent() {
  const params = useSearchParams()
  const body = {
    data_inicio: params.get("data_inicio") ?? defaultStart(),
    data_fim: params.get("data_fim") ?? today(),
    campanha: params.get("campanha") ?? undefined,
    operador: params.get("operador") ?? undefined,
  }

  const { data, isLoading, isError } = useQuery<QualResult>({
    queryKey: ["qualificacoes", body],
    queryFn: async () => (await api.post("/api/relatorios/qualificacoes", body)).data,
    enabled: !!body.data_inicio && !!body.data_fim,
  })

  const chartOption = {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { orient: "vertical", right: 10, top: "center", type: "scroll" },
    series: [{
      type: "pie", radius: ["40%", "70%"], left: -100,
      data: data?.items.slice(0, 10).map(i => ({ name: i.qualificacao, value: i.quantidade })) ?? [],
      label: { show: false },
    }],
  }

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )

  if (isError) return (
    <div className="rounded-lg border border-destructive/50 p-6 text-center text-destructive">
      Erro ao carregar dados. O agente Sybase pode estar indisponível.
    </div>
  )

  if (!data || data.items.length === 0) return (
    <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
      Nenhum dado para os filtros selecionados.
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total de Acionamentos</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{data.total.toLocaleString("pt-BR")}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Tipos de Qualificação</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{data.items.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Qualificação Principal</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-semibold truncate">{data.items[0]?.qualificacao ?? "—"}</p></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Qualificação</CardTitle></CardHeader>
          <CardContent>
            <ReactECharts option={chartOption} style={{ height: 320 }} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Detalhamento</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
              {data.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b last:border-0">
                  <span className="text-sm truncate flex-1 mr-2">{item.qualificacao}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium">{item.quantidade.toLocaleString("pt-BR")}</span>
                    <Badge variant="secondary" className="text-xs w-16 justify-center">{item.percentual}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function QualificacoesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Qualificações</h1>
          <p className="text-muted-foreground text-sm">Distribuição de qualificações por período e filtros</p>
        </div>
        <Suspense>
          <ExportButtonWrapper />
        </Suspense>
      </div>
      <Suspense fallback={<Skeleton className="h-12 w-full" />}>
        <FilterBar fields={["periodo", "campanha", "operador"]} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <QualificacoesContent />
      </Suspense>
    </div>
  )
}

function ExportButtonWrapper() {
  const params = useSearchParams()
  const body = {
    data_inicio: params.get("data_inicio") ?? format(startOfMonth(new Date()), "yyyy-MM-dd"),
    data_fim: params.get("data_fim") ?? format(new Date(), "yyyy-MM-dd"),
    campanha: params.get("campanha") ?? undefined,
    operador: params.get("operador") ?? undefined,
  }
  return <ExportButton endpoint="/api/relatorios/qualificacoes" body={body} filename="qualificacoes" />
}
