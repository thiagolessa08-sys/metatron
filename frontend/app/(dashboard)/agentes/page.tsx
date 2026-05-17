"use client"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { FilterBar } from "@/components/filters/filter-bar"
import { ExportButton } from "@/components/relatorios/export-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import api from "@/lib/api"
import { format, startOfMonth } from "date-fns"
import ReactECharts from "echarts-for-react"

interface AgenteMetrica {
  operador: string
  total_ligacoes: number
  duracao_total_s: number
  duracao_media_s: number
  qualificacoes: Record<string, number>
}
interface AgentesResult { items: AgenteMetrica[]; total_ligacoes: number; total_duracao_s: number }

function fmt_tempo(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

function today() { return format(new Date(), "yyyy-MM-dd") }
function defaultStart() { return format(startOfMonth(new Date()), "yyyy-MM-dd") }

function AgentesContent() {
  const params = useSearchParams()
  const body = {
    data_inicio: params.get("data_inicio") ?? defaultStart(),
    data_fim: params.get("data_fim") ?? today(),
    campanha: params.get("campanha") ?? undefined,
    operador: params.get("operador") ?? undefined,
  }

  const { data, isLoading, isError } = useQuery<AgentesResult>({
    queryKey: ["agentes-metricas", body],
    queryFn: async () => (await api.post("/api/agentes/metricas", body)).data,
  })

  const top10 = data?.items.slice(0, 10) ?? []

  const barChartOption = {
    tooltip: { trigger: "axis" },
    legend: { data: ["Ligações", "Duração Média (min)"] },
    xAxis: { type: "category", data: top10.map(i => i.operador.substring(0, 12)), axisLabel: { rotate: 30, fontSize: 11 } },
    yAxis: [{ type: "value", name: "Ligações" }, { type: "value", name: "Minutos" }],
    series: [
      { name: "Ligações", type: "bar", data: top10.map(i => i.total_ligacoes), yAxisIndex: 0 },
      { name: "Duração Média (min)", type: "line", data: top10.map(i => Math.round(i.duracao_media_s / 60)), yAxisIndex: 1 },
    ],
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (isError) return (
    <div className="rounded-lg border border-destructive/50 p-6 text-center text-destructive">
      Erro ao carregar dados. O agente Sybase pode estar indisponível ou sem permissão nas tabelas metatron.
    </div>
  )
  if (!data || data.items.length === 0) return (
    <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
      Nenhum dado para os filtros selecionados.
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total de Operadores</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{data.items.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total de Ligações</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{data.total_ligacoes.toLocaleString("pt-BR")}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Duração Total</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold font-mono">{fmt_tempo(data.total_duracao_s)}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tabela">
        <TabsList>
          <TabsTrigger value="tabela">Tabela</TabsTrigger>
          <TabsTrigger value="grafico">Gráfico (Top 10)</TabsTrigger>
        </TabsList>

        <TabsContent value="tabela">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operador</TableHead>
                    <TableHead className="text-right">Ligações</TableHead>
                    <TableHead className="text-right">Duração Total</TableHead>
                    <TableHead className="text-right">Duração Média</TableHead>
                    <TableHead>Top Qualificação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((row, i) => {
                    const topQual = Object.entries(row.qualificacoes).sort((a, b) => b[1] - a[1])[0]
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.operador}</TableCell>
                        <TableCell className="text-right">{row.total_ligacoes.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt_tempo(row.duracao_total_s)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt_tempo(row.duracao_media_s)}</TableCell>
                        <TableCell>
                          {topQual ? (
                            <Badge variant="secondary" className="text-xs max-w-[160px] truncate">{topQual[0]}</Badge>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grafico">
          <Card>
            <CardHeader><CardTitle className="text-base">Top 10 Operadores — Ligações e Duração Média</CardTitle></CardHeader>
            <CardContent>
              <ReactECharts option={barChartOption} style={{ height: 360 }} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function AgentesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Análise de Agentes</h1>
          <p className="text-muted-foreground text-sm">Ligações, duração e qualificações por operador</p>
        </div>
        <Suspense>
          <ExportWrapper />
        </Suspense>
      </div>
      <FilterBar fields={["periodo", "campanha", "operador"]} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AgentesContent />
      </Suspense>
    </div>
  )
}

function ExportWrapper() {
  const params = useSearchParams()
  const body = {
    data_inicio: params.get("data_inicio") ?? format(startOfMonth(new Date()), "yyyy-MM-dd"),
    data_fim: params.get("data_fim") ?? format(new Date(), "yyyy-MM-dd"),
    campanha: params.get("campanha") ?? undefined,
    operador: params.get("operador") ?? undefined,
  }
  return <ExportButton endpoint="/api/agentes/metricas" body={body} filename="agentes" />
}
