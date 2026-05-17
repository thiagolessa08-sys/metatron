"use client"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { FilterBar } from "@/components/filters/filter-bar"
import { ExportButton } from "@/components/relatorios/export-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import api from "@/lib/api"
import { format, startOfMonth } from "date-fns"
import ReactECharts from "echarts-for-react"

interface AprItem {
  campanha: string; total: number; localizados: number; em_contato: number
  contatados: number; discados_total: number; atendidas_hoje: number
  aproveitamento: number; agendamentos_publicos: number; agendamentos_privados: number
}
interface AprResult { items: AprItem[]; totais: AprItem | null }

function today() { return format(new Date(), "yyyy-MM-dd") }
function defaultStart() { return format(startOfMonth(new Date()), "yyyy-MM-dd") }

function AproveitamentoContent() {
  const params = useSearchParams()
  const body = {
    campanha: params.get("campanha") ?? undefined,
  }

  const { data, isLoading, isError } = useQuery<AprResult>({
    queryKey: ["aproveitamento", body],
    queryFn: async () => (await api.post("/api/relatorios/aproveitamento", body)).data,
  })

  const chartOption = {
    tooltip: { trigger: "axis" },
    legend: { data: ["Total", "Localizados", "Em Contato", "Contatados"] },
    xAxis: { type: "category", data: data?.items.map(i => i.campanha.substring(0, 15)) ?? [], axisLabel: { rotate: 30 } },
    yAxis: { type: "value" },
    series: [
      { name: "Total", type: "bar", data: data?.items.map(i => i.total) ?? [] },
      { name: "Localizados", type: "bar", data: data?.items.map(i => i.localizados) ?? [] },
      { name: "Em Contato", type: "bar", data: data?.items.map(i => i.em_contato) ?? [] },
      { name: "Contatados", type: "bar", data: data?.items.map(i => i.contatados) ?? [] },
    ],
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />
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

  const t = data.totais
  return (
    <div className="space-y-6">
      {t && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total", value: t.total },
            { label: "Localizados", value: t.localizados },
            { label: "Em Contato", value: t.em_contato },
            { label: "Aproveitamento Médio", value: `${t.aproveitamento}%` },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p></CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Métricas por Campanha</CardTitle></CardHeader>
        <CardContent>
          <ReactECharts option={chartOption} style={{ height: 300 }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tabela Detalhada</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Localizados</TableHead>
                <TableHead className="text-right">Em Contato</TableHead>
                <TableHead className="text-right">Contatados</TableHead>
                <TableHead className="text-right">Discados</TableHead>
                <TableHead className="text-right">Atend. Hoje</TableHead>
                <TableHead className="text-right">Aproveito %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{row.campanha}</TableCell>
                  <TableCell className="text-right">{row.total.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{row.localizados.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{row.em_contato.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{row.contatados.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{row.discados_total.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{row.atendidas_hoje.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-semibold">{row.aproveitamento}%</TableCell>
                </TableRow>
              ))}
              {t && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{t.total.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{t.localizados.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{t.em_contato.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{t.contatados.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{t.discados_total.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{t.atendidas_hoje.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{t.aproveitamento}%</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AproveitamentoPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Aproveitamento</h1>
          <p className="text-muted-foreground text-sm">Métricas de aproveitamento por campanha</p>
        </div>
        <Suspense>
          <ExportButtonWrapper />
        </Suspense>
      </div>
      <FilterBar fields={["campanha"]} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AproveitamentoContent />
      </Suspense>
    </div>
  )
}

function ExportButtonWrapper() {
  const params = useSearchParams()
  const body = { campanha: params.get("campanha") ?? undefined }
  return <ExportButton endpoint="/api/relatorios/aproveitamento" body={body} filename="aproveitamento" />
}
