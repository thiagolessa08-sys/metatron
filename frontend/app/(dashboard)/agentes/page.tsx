"use client"
import { Suspense, useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { ExportButton } from "@/components/relatorios/export-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import api from "@/lib/api"
import { useFilters } from "@/lib/filters-context"
import { differenceInDays, parseISO } from "date-fns"
import ReactECharts from "echarts-for-react"
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react"

interface AgenteMetrica {
  operador: string
  total_ligacoes: number
  duracao_total_s: number
  duracao_media_s: number
  qualificacoes: Record<string, number>
}
interface AgentesResult {
  items: AgenteMetrica[]
  total_ligacoes: number
  total_duracao_s: number
}

type SortKey = "operador" | "total_ligacoes" | "duracao_total_s" | "duracao_media_s"
type SortDir = "asc" | "desc"

function fmtTempo(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

const QUAL_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
  "#ec4899", "#6366f1",
]

function SortHeader({
  label, sortKey, current, dir, onSort,
}: {
  label: string
  sortKey: SortKey
  current: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (
          dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </TableHead>
  )
}

function AgentesContent() {
  const { period, campanha, operador, empresa } = useFilters()
  const body = {
    data_inicio: period.dataInicio,
    data_fim: period.dataFim,
    campanha: campanha ?? undefined,
    operador: operador ?? undefined,
    empresa: empresa ?? undefined,
  }

  const diasPeriodo = useMemo(() => {
    const d = differenceInDays(parseISO(body.data_fim), parseISO(body.data_inicio)) + 1
    return Math.max(d, 1)
  }, [body.data_inicio, body.data_fim])

  const { data, isLoading, isError, error } = useQuery<AgentesResult>({
    queryKey: ["agentes-metricas", body],
    queryFn: async () => (await api.post("/api/agentes/metricas", body)).data,
  })

  const [busca, setBusca] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("total_ligacoes")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(k); setSortDir("desc") }
  }

  const itensFiltrados = useMemo(() => {
    if (!data) return []
    return data.items
      .filter(i => i.operador.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => {
        const va = a[sortKey]
        const vb = b[sortKey]
        const cmp = typeof va === "string"
          ? (va as string).localeCompare(vb as string)
          : (va as number) - (vb as number)
        return sortDir === "asc" ? cmp : -cmp
      })
  }, [data, busca, sortKey, sortDir])

  const todasQuals = useMemo(() => {
    if (!data) return []
    const set = new Set<string>()
    data.items.forEach(i => Object.keys(i.qualificacoes).forEach(q => set.add(q)))
    return Array.from(set).sort()
  }, [data])

  const top15 = useMemo(() => data?.items.slice(0, 15) ?? [], [data])

  const qualChartOption = useMemo(() => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { type: "scroll", bottom: 0, data: todasQuals },
    grid: { left: "3%", right: "4%", bottom: 60, containLabel: true },
    xAxis: {
      type: "category",
      data: top15.map(i => i.operador.substring(0, 10)),
      axisLabel: { rotate: 30, fontSize: 11 },
    },
    yAxis: { type: "value", name: "Ligações" },
    series: todasQuals.map((q, idx) => ({
      name: q,
      type: "bar",
      stack: "qual",
      emphasis: { focus: "series" },
      color: QUAL_COLORS[idx % QUAL_COLORS.length],
      data: top15.map(i => i.qualificacoes[q] ?? 0),
    })),
  }), [top15, todasQuals])

  const agentesComparar = useMemo(
    () => data?.items.filter(i => selecionados.has(i.operador)) ?? [],
    [data, selecionados]
  )

  const compareChartOption = useMemo(() => ({
    tooltip: { trigger: "axis" },
    legend: { data: ["Ligações", "Duração Total (h)", "Duração Média (min)", "Ligações/dia"] },
    grid: { left: "3%", right: "4%", bottom: 40, containLabel: true },
    xAxis: {
      type: "category",
      data: agentesComparar.map(i => i.operador.substring(0, 14)),
      axisLabel: { rotate: agentesComparar.length > 5 ? 20 : 0 },
    },
    yAxis: { type: "value" },
    series: [
      {
        name: "Ligações",
        type: "bar",
        data: agentesComparar.map(i => i.total_ligacoes),
      },
      {
        name: "Duração Total (h)",
        type: "bar",
        data: agentesComparar.map(i => Math.round(i.duracao_total_s / 3600 * 10) / 10),
      },
      {
        name: "Duração Média (min)",
        type: "bar",
        data: agentesComparar.map(i => Math.round(i.duracao_media_s / 60 * 10) / 10),
      },
      {
        name: "Ligações/dia",
        type: "line",
        data: agentesComparar.map(i => Math.round(i.total_ligacoes / diasPeriodo * 10) / 10),
      },
    ],
  }), [agentesComparar, diasPeriodo])

  function toggleSelecionado(op: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(op)) next.delete(op)
      else next.add(op)
      return next
    })
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (isError) {
    const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    const msg = detail ?? (error instanceof Error ? error.message : String(error))
    return (
      <div className="rounded-lg border border-destructive/50 p-6 space-y-1 text-destructive">
        <p className="font-semibold text-center">Erro ao carregar dados</p>
        <p className="text-xs text-center font-mono break-all opacity-80">{msg}</p>
      </div>
    )
  }
  if (!data || data.items.length === 0) return (
    <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
      Nenhum dado para os filtros selecionados.
    </div>
  )

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-white" style={{ background: "linear-gradient(180deg, #4DC3E8 0%, #28ACDB 100%)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>Operadores</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold text-white">{data.items.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Total de Ligações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.total_ligacoes.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Duração Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{fmtTempo(data.total_duracao_s)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Média por Agente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">
              {fmtTempo(Math.round(data.total_duracao_s / (data.items.length || 1)))}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tabela">
        <TabsList>
          <TabsTrigger value="tabela">Tabela</TabsTrigger>
          <TabsTrigger value="qualificacoes">Qualificações por Agente</TabsTrigger>
          <TabsTrigger value="comparacao">
            Comparação
            {selecionados.size > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-xs">
                {selecionados.size}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab: Tabela */}
        <TabsContent value="tabela" className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar operador..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9 max-w-xs"
            />
          </div>
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <span className="sr-only">Comparar</span>
                    </TableHead>
                    <SortHeader label="Operador" sortKey="operador" current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Ligações" sortKey="total_ligacoes" current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Duração Total" sortKey="duracao_total_s" current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHeader label="Duração Média" sortKey="duracao_media_s" current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <TableHead>Ligações/dia</TableHead>
                    <TableHead>Top Qualificação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensFiltrados.map((row) => {
                    const topQual = Object.entries(row.qualificacoes)
                      .sort((a, b) => b[1] - a[1])[0]
                    const ligDia = (row.total_ligacoes / diasPeriodo).toFixed(1)
                    return (
                      <TableRow key={row.operador}>
                        <TableCell>
                          <Checkbox
                            checked={selecionados.has(row.operador)}
                            onCheckedChange={() => toggleSelecionado(row.operador)}
                            aria-label={`Comparar ${row.operador}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{row.operador}</TableCell>
                        <TableCell className="text-right">
                          {row.total_ligacoes.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtTempo(row.duracao_total_s)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmtTempo(row.duracao_media_s)}
                        </TableCell>
                        <TableCell className="text-right text-sm">{ligDia}</TableCell>
                        <TableCell>
                          {topQual ? (
                            <Badge variant="secondary" className="text-xs max-w-[160px] truncate">
                              {topQual[0]}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              {itensFiltrados.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum operador encontrado para &quot;{busca}&quot;
                </p>
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            {itensFiltrados.length} de {data.items.length} operadores · clique no header para ordenar · ✓ para comparar
          </p>
        </TabsContent>

        {/* Tab: Qualificações por Agente */}
        <TabsContent value="qualificacoes">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Qualificações por Agente — Top {top15.length}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Distribuição de qualificações (descricao) para cada operador no período
              </p>
            </CardHeader>
            <CardContent>
              {todasQuals.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sem dados de qualificação no período.
                </p>
              ) : (
                <ReactECharts option={qualChartOption} style={{ height: 420 }} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Comparação */}
        <TabsContent value="comparacao">
          {selecionados.size === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
              <p className="font-medium">Nenhum agente selecionado</p>
              <p className="text-sm mt-1">
                Na aba Tabela, marque os agentes que deseja comparar usando as caixas de seleção.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {Array.from(selecionados).map(op => (
                  <Badge
                    key={op}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => toggleSelecionado(op)}
                  >
                    {op} ✕
                  </Badge>
                ))}
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Comparativo de Desempenho</CardTitle>
                </CardHeader>
                <CardContent>
                  <ReactECharts option={compareChartOption} style={{ height: 360 }} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operador</TableHead>
                        <TableHead className="text-right">Ligações</TableHead>
                        <TableHead className="text-right">Lig./dia</TableHead>
                        <TableHead className="text-right">Duração Total</TableHead>
                        <TableHead className="text-right">Duração Média</TableHead>
                        <TableHead className="text-right">Qualificações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agentesComparar.map(row => (
                        <TableRow key={row.operador}>
                          <TableCell className="font-medium">{row.operador}</TableCell>
                          <TableCell className="text-right">
                            {row.total_ligacoes.toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right">
                            {(row.total_ligacoes / diasPeriodo).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {fmtTempo(row.duracao_total_s)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {fmtTempo(row.duracao_media_s)}
                          </TableCell>
                          <TableCell className="text-right">
                            {Object.values(row.qualificacoes).reduce((a, b) => a + b, 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ExportWrapper() {
  const { period, campanha, operador, empresa } = useFilters()
  const body = {
    data_inicio: period.dataInicio,
    data_fim: period.dataFim,
    campanha: campanha ?? undefined,
    operador: operador ?? undefined,
    empresa: empresa ?? undefined,
  }
  return <ExportButton endpoint="/api/agentes/metricas" body={body} filename="agentes" />
}

export default function AgentesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Análise de Agentes</h1>
          <p className="text-muted-foreground text-sm">
            Ligações, duração e qualificações por operador
          </p>
        </div>
        <Suspense>
          <ExportWrapper />
        </Suspense>
      </div>
      <AgentesContent />
    </div>
  )
}
