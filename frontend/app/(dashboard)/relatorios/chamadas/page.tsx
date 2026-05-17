"use client"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { FilterBar } from "@/components/filters/filter-bar"
import { ExportButton } from "@/components/relatorios/export-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import api from "@/lib/api"
import { format, startOfMonth } from "date-fns"

interface ChamadaItem {
  data_hora: string
  numero: string
  operadora: string
  resultado: string
  duracao: string
  dur_min: string
  valor: string
}
interface ChamadasResult { items: ChamadaItem[]; total: number; truncated: boolean }

function today() { return format(new Date(), "yyyy-MM-dd") }
function defaultStart() { return format(startOfMonth(new Date()), "yyyy-MM-dd") }

function resultadoBadgeVariant(resultado: string): "default" | "secondary" | "destructive" | "outline" {
  const r = resultado.toLowerCase()
  if (r.includes("atend") || r.includes("contato")) return "default"
  if (r.includes("ocup") || r.includes("não atend") || r.includes("nao atend")) return "destructive"
  return "secondary"
}

function ChamadasContent() {
  const params = useSearchParams()
  const body = {
    data_inicio: params.get("data_inicio") ?? defaultStart(),
    data_fim: params.get("data_fim") ?? today(),
    resultado: params.get("resultado") ?? undefined,
    operadora: params.get("operadora") ?? undefined,
  }

  const { data, isLoading, isError } = useQuery<ChamadasResult>({
    queryKey: ["chamadas", body],
    queryFn: async () => (await api.post("/api/agentes/chamadas", body)).data,
  })

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (isError) return (
    <div className="rounded-lg border border-destructive/50 p-6 text-center text-destructive">
      Erro ao carregar dados. Verifique permissões do agente Sybase na tabela metatron.TT_RELATORIO_METATRON.
    </div>
  )
  if (!data || data.items.length === 0) return (
    <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
      Nenhum dado para os filtros selecionados.
    </div>
  )

  return (
    <div className="space-y-4">
      {data.truncated && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">
          Exibindo os 1.000 registros mais recentes. Refine os filtros para um período menor.
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            Total de registros: <span className="text-foreground font-bold">{data.total.toLocaleString("pt-BR")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Operadora</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead className="text-right">Duração</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-mono whitespace-nowrap">{row.data_hora}</TableCell>
                  <TableCell className="font-mono text-sm">{row.numero}</TableCell>
                  <TableCell className="text-sm">{row.operadora}</TableCell>
                  <TableCell>
                    <Badge variant={resultadoBadgeVariant(row.resultado)} className="text-xs max-w-[180px] truncate">
                      {row.resultado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{row.duracao}</TableCell>
                  <TableCell className="text-right text-sm">{row.dur_min}</TableCell>
                  <TableCell className="text-right text-sm">{row.valor}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ChamadasPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatório de Chamadas</h1>
          <p className="text-muted-foreground text-sm">Histórico detalhado de ligações com duração e valor</p>
        </div>
        <Suspense>
          <ExportWrapper />
        </Suspense>
      </div>
      <Suspense fallback={<Skeleton className="h-12 w-full" />}>
        <FilterBar fields={["periodo", "resultado", "operadora"]} />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ChamadasContent />
      </Suspense>
    </div>
  )
}

function ExportWrapper() {
  const params = useSearchParams()
  const body = {
    data_inicio: params.get("data_inicio") ?? format(startOfMonth(new Date()), "yyyy-MM-dd"),
    data_fim: params.get("data_fim") ?? format(new Date(), "yyyy-MM-dd"),
    resultado: params.get("resultado") ?? undefined,
    operadora: params.get("operadora") ?? undefined,
  }
  return <ExportButton endpoint="/api/agentes/chamadas" body={body} filename="chamadas" />
}
